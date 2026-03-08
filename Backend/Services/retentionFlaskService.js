const axios = require("axios");

const DEFAULT_FLASK_API_URL = "http://localhost:5500/api/retention";

const normalizeFlaskApiUrl = (rawUrl) => {
  const trimmed = String(rawUrl || "")
    .trim()
    .replace(/\/+$/, "");
  if (!trimmed) return DEFAULT_FLASK_API_URL;

  if (/\/api\/retention$/i.test(trimmed)) return trimmed;
  if (/\/api$/i.test(trimmed)) return `${trimmed}/retention`;
  if (/\/retention$/i.test(trimmed)) {
    if (/\/api\//i.test(trimmed)) return trimmed;
    return `${trimmed.replace(/\/retention$/i, "")}/api/retention`;
  }

  return `${trimmed}/api/retention`;
};

const FLASK_API_URL = normalizeFlaskApiUrl(process.env.FLASK_API_URL);
const DEFAULT_FLASK_TIMEOUT_MS = Number(
  process.env.RETENTION_FLASK_TIMEOUT_MS || 10000,
);
const NEXT_QUESTIONS_TIMEOUT_MS = Number(
  process.env.RETENTION_FLASK_NEXT_TIMEOUT_MS || 2500,
);
const UPDATE_PREDICTIONS_TIMEOUT_MS = Number(
  process.env.RETENTION_FLASK_UPDATE_TIMEOUT_MS || 1500,
);
const COMPLETE_SESSION_TIMEOUT_MS = Number(
  process.env.RETENTION_FLASK_COMPLETE_TIMEOUT_MS || 60000,
);
const PREDICTIONS_TIMEOUT_MS = Number(
  process.env.RETENTION_FLASK_PREDICTIONS_TIMEOUT_MS || 1800,
);
const PREDICTIONS_CACHE_TTL_MS = Number(
  process.env.RETENTION_FLASK_PREDICTIONS_CACHE_TTL_MS || 45000,
);
const PREDICTIONS_STALE_MAX_AGE_MS = Number(
  process.env.RETENTION_FLASK_PREDICTIONS_STALE_MAX_AGE_MS || 600000,
);
const PREDICTIONS_MAX_WAIT_MS = Number(
  process.env.RETENTION_FLASK_PREDICTIONS_MAX_WAIT_MS || 500,
);
const COOLDOWN_MS = Number(process.env.RETENTION_FLASK_COOLDOWN_MS || 30000);
const FAILURE_THRESHOLD = Number(
  process.env.RETENTION_FLASK_FAILURE_THRESHOLD || 2,
);

class RetentionFlaskService {
  constructor() {
    this.client = axios.create({
      baseURL: FLASK_API_URL,
      timeout: DEFAULT_FLASK_TIMEOUT_MS,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.consecutiveFailures = 0;
    this.unavailableUntil = 0;
    this.predictionsCache = new Map();
    this.predictionsInflight = new Map();
  }

  getPredictionsCacheKey(studentId, subject = null) {
    return `${String(studentId || "").trim()}::${String(subject || "")
      .trim()
      .toLowerCase()}`;
  }

  normalizePredictionPayload(raw = {}) {
    return {
      micro: raw?.predictions?.micro || raw?.micro || {},
      meso: raw?.predictions?.meso || raw?.meso || {},
      macro: raw?.predictions?.macro || raw?.macro || {},
      forgettingCurves:
        raw?.predictions?.forgetting_curves || raw?.forgettingCurves || {},
      stressFatigue: {
        stress:
          raw?.predictions?.stress_patterns || raw?.stressFatigue?.stress || {},
        fatigue:
          raw?.predictions?.fatigue_patterns ||
          raw?.stressFatigue?.fatigue ||
          {},
      },
      lastUpdated: new Date(),
    };
  }

  setCachedPredictions(studentId, subject, payload) {
    const key = this.getPredictionsCacheKey(studentId, subject);
    this.predictionsCache.set(key, {
      value: payload,
      fetchedAt: Date.now(),
    });
    return payload;
  }

  getCachedPredictions(
    studentId,
    subject,
    { allowStale = true, maxAgeMs = PREDICTIONS_STALE_MAX_AGE_MS } = {},
  ) {
    const key = this.getPredictionsCacheKey(studentId, subject);
    const entry = this.predictionsCache.get(key);
    if (!entry || !entry.value) return null;

    const ageMs = Date.now() - Number(entry.fetchedAt || 0);
    const isFresh = ageMs <= PREDICTIONS_CACHE_TTL_MS;
    const isAllowedStale = allowStale && ageMs <= Math.max(maxAgeMs, 0);
    if (!isFresh && !isAllowedStale) return null;

    return {
      ...entry.value,
      cache: {
        hit: true,
        fresh: isFresh,
        ageMs,
      },
    };
  }

  async waitForInflightPredictions(studentId, subject, maxWaitMs) {
    const key = this.getPredictionsCacheKey(studentId, subject);
    const inflight = this.predictionsInflight.get(key);
    if (!inflight) return null;
    const waitMs = Math.max(0, Number(maxWaitMs) || 0);

    if (!waitMs) {
      return null;
    }

    const timeout = new Promise((resolve) => {
      setTimeout(() => resolve(null), waitMs);
    });

    return Promise.race([inflight, timeout]);
  }

  async fetchPredictionsFromFlask(studentId, subject = null, timeoutMs) {
    const url = subject
      ? `/predictions/${studentId}?subject=${subject}`
      : `/predictions/${studentId}`;

    const response = await this.request(
      {
        method: "get",
        url,
        timeout: Number(timeoutMs || PREDICTIONS_TIMEOUT_MS),
      },
      "getPredictions",
    );

    return this.normalizePredictionPayload(response.data || {});
  }

  refreshPredictions(studentId, subject = null, options = {}) {
    const key = this.getPredictionsCacheKey(studentId, subject);
    if (this.predictionsInflight.has(key)) {
      return this.predictionsInflight.get(key);
    }

    const task = this.fetchPredictionsFromFlask(
      studentId,
      subject,
      Number(options.timeoutMs || PREDICTIONS_TIMEOUT_MS),
    )
      .then((payload) => this.setCachedPredictions(studentId, subject, payload))
      .finally(() => {
        this.predictionsInflight.delete(key);
      });

    this.predictionsInflight.set(key, task);
    return task;
  }

  isServiceUnavailable() {
    return Date.now() < this.unavailableUntil;
  }

  getUnavailableRemainingMs() {
    return Math.max(0, this.unavailableUntil - Date.now());
  }

  markSuccess() {
    this.consecutiveFailures = 0;
    this.unavailableUntil = 0;
  }

  markFailure(error) {
    const statusCode = Number(error?.response?.status || 0);
    const errorCode = String(error?.code || "").toUpperCase();
    const isTimeout =
      errorCode === "ECONNABORTED" ||
      /timeout/i.test(String(error?.message || ""));
    const isConnectionError =
      errorCode === "ECONNREFUSED" ||
      errorCode === "ENOTFOUND" ||
      errorCode === "EAI_AGAIN";
    const isServerOverloaded = statusCode >= 500;

    if (isTimeout || isConnectionError || isServerOverloaded) {
      this.consecutiveFailures += 1;
      if (this.consecutiveFailures >= FAILURE_THRESHOLD) {
        this.unavailableUntil = Date.now() + COOLDOWN_MS;
      }
    } else {
      this.consecutiveFailures = 0;
      this.unavailableUntil = 0;
    }
  }

  async request(config, operationName, options = {}) {
    const { bypassUnavailableGate = false } = options;

    if (!bypassUnavailableGate && this.isServiceUnavailable()) {
      const remainingMs = this.getUnavailableRemainingMs();
      throw new Error(
        `Flask retention service temporarily unavailable (${operationName}); retry in ${Math.ceil(remainingMs / 1000)}s`,
      );
    }

    try {
      const response = await this.client.request(config);
      this.markSuccess();
      return response;
    } catch (error) {
      this.markFailure(error);
      throw error;
    }
  }

  isTransientError(error) {
    const statusCode = Number(error?.response?.status || 0);
    const errorCode = String(error?.code || "").toUpperCase();
    const message = String(error?.message || "");

    return (
      errorCode === "ECONNABORTED" ||
      errorCode === "ECONNREFUSED" ||
      errorCode === "ENOTFOUND" ||
      errorCode === "EAI_AGAIN" ||
      /timeout|temporarily unavailable/i.test(message) ||
      statusCode >= 500
    );
  }

  toErrorMessage(error) {
    return String(error?.response?.data?.error || error?.message || error);
  }

  // Start a retention session
  async startRetentionSession(studentId, subject, topics, sessionType) {
    try {
      const response = await this.request(
        {
          method: "post",
          url: "/session/start",
          data: {
            student_id: studentId,
            subject,
            topics,
            session_type: sessionType,
          },
          timeout: DEFAULT_FLASK_TIMEOUT_MS,
        },
        "startRetentionSession",
      );

      return {
        success: true,
        session_id: response.data.session_id,
        predictions: response.data.predictions || {},
        questions: response.data.questions || [],
        metadata: response.data.metadata || {},
      };
    } catch (error) {
      console.error(
        "Error starting retention session:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  // Get next questions
  async getNextQuestions(sessionId, recentAnswers, context = {}) {
    try {
      const response = await this.request(
        {
          method: "post",
          url: `/session/${sessionId}/next`,
          data: {
            responses: recentAnswers,
            student_id: context.studentId || context.userId,
            user_id: context.userId || context.studentId,
            subject: context.subject,
            current_stress: context.currentStress || 0.3,
            current_fatigue: context.currentFatigue || 0.3,
          },
          timeout: Number(context.timeoutMs || NEXT_QUESTIONS_TIMEOUT_MS),
        },
        "getNextQuestions",
      );

      return {
        success: true,
        questions: response.data.questions || [],
        predictions: response.data.predictions || {},
        metadata: response.data.metadata || {},
      };
    } catch (error) {
      const message = this.toErrorMessage(error);
      if (this.isTransientError(error)) {
        return {
          success: false,
          error: message,
          questions: [],
          predictions: {},
          metadata: {
            transient: true,
            fallbackSuggested: true,
          },
        };
      }
      console.error("Error getting next questions:", message);
      throw error;
    }
  }

  // Complete retention session
  async completeRetentionSession(sessionId, data, options = {}) {
    try {
      const response = await this.request(
        {
          method: "post",
          url: `/session/${sessionId}/complete`,
          data: {
            student_id: data.student_id || data.studentId,
            user_id: data.user_id || data.userId,
            subject: data.subject,
            session_type: data.session_type || data.sessionType,
            answers: data.answers,
            metrics: data.metrics,
          },
          timeout: Number(options.timeoutMs || COMPLETE_SESSION_TIMEOUT_MS),
        },
        "completeRetentionSession",
        {
          // Completion is critical; do a real probe even during cooldown windows.
          bypassUnavailableGate: true,
        },
      );

      return {
        success: true,
        analysis: response.data.analysis || {},
        updated_predictions: response.data.updated_predictions || {},
      };
    } catch (error) {
      const errorDetails = error.response?.data || error.message;
      if (this.isTransientError(error)) {
        console.warn("Transient retention completion failure:", errorDetails);
      } else {
        console.error("Error completing retention session:", errorDetails);
      }
      throw error;
    }
  }

  // Get predictions for student
  async getPredictions(studentId, subject = null, options = {}) {
    try {
      const {
        preferCache = true,
        allowStale = true,
        maxWaitMs = PREDICTIONS_MAX_WAIT_MS,
        backgroundRefresh = true,
        timeoutMs = PREDICTIONS_TIMEOUT_MS,
      } = options;

      const cached = this.getCachedPredictions(studentId, subject, {
        allowStale,
      });
      const hasFreshCache = Boolean(cached?.cache?.fresh);

      if (hasFreshCache && preferCache) {
        return cached;
      }

      const inflightResult = await this.waitForInflightPredictions(
        studentId,
        subject,
        maxWaitMs,
      );
      if (inflightResult) {
        return {
          ...inflightResult,
          cache: {
            ...(inflightResult.cache || {}),
            hit: false,
            sharedInflight: true,
          },
        };
      }

      if (this.isServiceUnavailable()) {
        if (cached) {
          if (backgroundRefresh) {
            this.refreshPredictions(studentId, subject, {
              timeoutMs,
            }).catch(() => {});
          }
          return {
            ...cached,
            cache: {
              ...(cached.cache || {}),
              unavailableFallback: true,
            },
          };
        }
      }

      if (cached && !hasFreshCache && preferCache) {
        if (backgroundRefresh) {
          this.refreshPredictions(studentId, subject, {
            timeoutMs,
          }).catch(() => {});
        }
        return {
          ...cached,
          cache: {
            ...(cached.cache || {}),
            staleFallback: true,
          },
        };
      }

      const payload = await this.refreshPredictions(studentId, subject, {
        timeoutMs,
      });

      return {
        ...payload,
        cache: {
          hit: false,
          fresh: true,
          ageMs: 0,
        },
      };
    } catch (error) {
      const cached = this.getCachedPredictions(studentId, subject, {
        allowStale: true,
      });
      if (this.isTransientError(error) && cached) {
        return {
          ...cached,
          cache: {
            ...(cached.cache || {}),
            staleFallback: true,
            transientErrorFallback: true,
          },
        };
      }
      console.error(
        "Error getting predictions:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  // Get retention summary
  async getRetentionSummary(studentId, subject = null) {
    try {
      const url = subject
        ? `/summary/${studentId}?subject=${subject}`
        : `/summary/${studentId}`;

      const response = await this.request(
        {
          method: "get",
          url,
          timeout: DEFAULT_FLASK_TIMEOUT_MS,
        },
        "getRetentionSummary",
      );

      return {
        overallRetention: response.data.summary?.overall_retention || 0.5,
        topicsByStatus: response.data.summary?.topics_by_status || {},
        totalTopics: response.data.summary?.total_topics || 0,
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error(
        "Error getting retention summary:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  // Get forgetting curves
  async getForgettingCurves(studentId, topicId = null) {
    try {
      const url = topicId
        ? `/forgetting-curves/${studentId}?topic_id=${topicId}`
        : `/forgetting-curves/${studentId}`;

      const response = await this.request(
        {
          method: "get",
          url,
          timeout: DEFAULT_FLASK_TIMEOUT_MS,
        },
        "getForgettingCurves",
      );
      if (topicId) {
        return response.data.curve || [];
      }
      return response.data.curves || {};
    } catch (error) {
      console.error(
        "Error getting forgetting curves:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  // Get daily schedule
  async getDailySchedule(studentId, subject = "both") {
    try {
      const response = await this.request(
        {
          method: "get",
          url: `/schedule/daily/${studentId}?subject=${subject}`,
          timeout: DEFAULT_FLASK_TIMEOUT_MS,
        },
        "getDailySchedule",
      );

      const schedule = response.data.schedule || {};
      const immediateQuestions = schedule.immediate_batch?.questions || [];
      const sessionBatches = schedule.session_batch?.batches || [];

      const dailyPlans = [
        {
          day: 1,
          questions: [...immediateQuestions, ...(sessionBatches[0] || [])].map(
            (q) => ({
              question_id: q.question_id || q.id || q.topic_id,
              topic_id: q.topic_id,
              subject: q.subject,
              topic_category: q.topic_category || q.topic_id,
              batch_type: q.batch_type || "immediate",
              priority: q.priority,
              retention: q.retention,
            }),
          ),
        },
      ];

      return {
        schedule_id: schedule.id || `${studentId}-${Date.now()}`,
        daily_plans: dailyPlans,
        batch_recommendations: schedule.batch_recommendations || {},
        weekly_plan: schedule.weekly_plan || {},
        monthly_plan: schedule.monthly_plan || {},
        generated_at: schedule.generated_at,
      };
    } catch (error) {
      console.error(
        "Error getting daily schedule:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  // Get question repetition sequence
  async getQuestionSequence(studentId, batchType = "immediate", count = 20) {
    try {
      const response = await this.request(
        {
          method: "get",
          url: `/question-sequence/${studentId}?batch_type=${batchType}&count=${count}`,
          timeout: DEFAULT_FLASK_TIMEOUT_MS,
        },
        "getQuestionSequence",
      );

      return {
        sequence: response.data.sequence || [],
        batch_type: response.data.batch_type,
        count: response.data.count || 0,
      };
    } catch (error) {
      console.error(
        "Error getting question sequence:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  // Get stress and fatigue predictions
  async getStressFatiguePredictions(studentId) {
    try {
      const response = await this.request(
        {
          method: "get",
          url: `/stress-fatigue/${studentId}`,
          timeout: DEFAULT_FLASK_TIMEOUT_MS,
        },
        "getStressFatiguePredictions",
      );

      return {
        stress: response.data.stress_fatigue?.stress || {},
        fatigue: response.data.stress_fatigue?.fatigue || {},
        recommendations: response.data.stress_fatigue?.recommendations || [],
      };
    } catch (error) {
      console.error(
        "Error getting stress fatigue:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  // Get optimal study times
  async getOptimalStudyTimes(studentId) {
    try {
      const response = await this.request(
        {
          method: "get",
          url: `/schedule/optimal-study-times/${studentId}`,
          timeout: DEFAULT_FLASK_TIMEOUT_MS,
        },
        "getOptimalStudyTimes",
      );

      return response.data.optimal_times || {};
    } catch (error) {
      console.error(
        "Error getting optimal study times:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  // Update after interaction
  async updateAfterInteraction(
    sessionId,
    questionId,
    wasCorrect,
    responseTime,
    stressLevel,
    fatigueLevel,
  ) {
    try {
      const response = await this.request(
        {
          method: "post",
          url: "/update-after-interaction",
          data: {
            session_id: sessionId,
            question_id: questionId,
            correct: wasCorrect,
            response_time_ms: responseTime,
            stress_level: stressLevel,
            fatigue_index: fatigueLevel,
          },
          timeout: UPDATE_PREDICTIONS_TIMEOUT_MS,
        },
        "updateAfterInteraction",
      );

      return {
        updated_prediction: response.data.updated_prediction || {},
        training_needed: response.data.training_needed || false,
      };
    } catch (error) {
      console.error(
        "Error updating after interaction:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  // Get updated predictions after session
  async getUpdatedPredictions(studentId, recentAnswers, context = {}) {
    try {
      const response = await this.request(
        {
          method: "post",
          url: `/predictions/update/${studentId}`,
          data: {
            answers: recentAnswers,
            session_id: context.sessionId,
            subject: context.subject,
          },
          timeout: Number(context.timeoutMs || UPDATE_PREDICTIONS_TIMEOUT_MS),
        },
        "getUpdatedPredictions",
      );

      return {
        success: true,
        predictions: response.data.predictions || {},
        schedule_update_needed: response.data.schedule_update_needed || false,
        training_needed: response.data.training_needed || {},
        sequence_status: response.data.sequence_status || {},
        models_ready: response.data.models_ready || {},
        model_outputs: response.data.model_outputs || {},
        live_analysis: response.data.live_analysis || {},
        timestamp: response.data.timestamp,
      };
    } catch (error) {
      const message = this.toErrorMessage(error);
      if (this.isTransientError(error)) {
        return {
          success: false,
          error: message,
          predictions: {},
          training_needed: {},
          sequence_status: {},
          models_ready: {},
          model_outputs: {},
          live_analysis: {},
          transient: true,
        };
      }
      console.error("Error getting updated predictions:", message);
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    try {
      const response = await this.request(
        {
          method: "get",
          url: "/health",
          timeout: 2000,
        },
        "healthCheck",
      );
      return response.data;
    } catch (error) {
      console.error("Flask retention health check failed:", error.message);
      return null;
    }
  }
}

module.exports = new RetentionFlaskService();
