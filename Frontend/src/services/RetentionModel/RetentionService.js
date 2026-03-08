import axios from "axios";
import io from "socket.io-client";

// API Configuration
const NODE_API_URL =
  import.meta.env.VITE_NODE_API_URL || "http://localhost:5000/api";
const FLASK_API_URL =
  import.meta.env.VITE_FLASK_API_URL || "http://localhost:5500/api";

class RetentionService {
  constructor() {
    this.nodeApi = axios.create({
      baseURL: NODE_API_URL,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
      withCredentials: true,
    });

    this.flaskApi = axios.create({
      baseURL: FLASK_API_URL,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.socket = null;
    this.currentSessionId = null;
    this.currentStudentId = null;
    this.eventListeners = new Map();
    this.lastUiStateSignatureBySession = new Map();
    this.uiStateSaveInflightBySession = new Map();
    this.pendingUiStateBySession = new Map();
  }

  normalizeUiStateForSignature(payload = {}) {
    if (Array.isArray(payload)) {
      return payload.map((item) => this.normalizeUiStateForSignature(item));
    }

    if (!payload || typeof payload !== "object") {
      return payload;
    }

    const out = {};
    Object.keys(payload)
      .sort()
      .forEach((key) => {
        if (
          key === "updatedAt" ||
          key === "scheduledAt" ||
          key === "lastQueuedAt" ||
          key === "retiredAt"
        ) {
          return;
        }
        out[key] = this.normalizeUiStateForSignature(payload[key]);
      });

    return out;
  }

  getUiStateSignature(uiState = {}) {
    try {
      return JSON.stringify(this.normalizeUiStateForSignature(uiState));
    } catch {
      return "";
    }
  }

  parseRetryAfterMs(error, fallbackMs = 1500) {
    const retryAfterHeader =
      error?.response?.headers?.["retry-after"] ||
      error?.response?.headers?.["Retry-After"];

    if (!retryAfterHeader) return fallbackMs;

    const asNumber = Number(retryAfterHeader);
    if (Number.isFinite(asNumber) && asNumber >= 0) {
      return Math.max(500, Math.round(asNumber * 1000));
    }

    const asDateMs = new Date(retryAfterHeader).getTime();
    if (Number.isFinite(asDateMs)) {
      return Math.max(500, asDateMs - Date.now());
    }

    return fallbackMs;
  }

  async waitMs(ms) {
    const delay = Math.max(0, Number(ms) || 0);
    if (!delay) return;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  async postWith429Retry(url, payload, options = {}) {
    const { retries = 2, initialDelayMs = 1200, maxDelayMs = 6000 } = options;
    let attempt = 0;

    while (attempt <= retries) {
      try {
        return await this.nodeApi.post(url, payload);
      } catch (error) {
        const status = Number(error?.response?.status || 0);
        const shouldRetry = status === 429 && attempt < retries;
        if (!shouldRetry) throw error;

        const baseDelayMs = this.parseRetryAfterMs(error, initialDelayMs);
        const backoffDelayMs = Math.min(
          maxDelayMs,
          Math.round(baseDelayMs * 2 ** attempt),
        );
        const jitterMs = Math.floor(Math.random() * 300);
        const retryDelayMs = backoffDelayMs + jitterMs;
        await this.waitMs(retryDelayMs);
        attempt += 1;
      }
    }

    throw new Error("Request failed after retry attempts");
  }

  // ==================== Authentication & Setup ====================

  /**
   * Set auth token for Node.js API
   */
  setAuthToken(token) {
    if (token) {
      this.nodeApi.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete this.nodeApi.defaults.headers.common["Authorization"];
    }
  }

  /**
   * Initialize retention service for a student
   */
  initialize(studentId, connectSocket = true) {
    this.currentStudentId = studentId;
    if (connectSocket) {
      this.connectSocket();
    }
  }

  /**
   * Connect to WebSocket for real-time updates
   */
  connectSocket() {
    if (this.socket) return;

    this.socket = io(
      `${import.meta.env.VITE_NODE_API_URL?.replace("/api", "") || "http://localhost:5000"}/retention`,
      {
        withCredentials: true,
        transports: ["websocket"],
      },
    );

    this.socket.on("connect", () => {
      console.log("Retention socket connected");

      // Re-join active session after reconnect so queue/analytics sync resumes.
      if (this.currentSessionId && this.currentStudentId) {
        this.socket.emit("join-retention-session", {
          sessionId: this.currentSessionId,
          studentId: this.currentStudentId,
        });
      }
    });

    this.socket.on("disconnect", () => {
      console.log("Retention socket disconnected");
    });

    this.socket.on("error", (error) => {
      console.error("Retention socket error:", error);
      this.emitEvent("socketError", error);
    });

    // Session events
    this.socket.on("retention-session-joined", (data) => {
      this.emitEvent("sessionJoined", data);
    });

    this.socket.on("answer-confirmed", (data) => {
      this.emitEvent("answerConfirmed", data);
    });

    this.socket.on("answer-processed", (data) => {
      this.emitEvent("answerProcessed", data);
    });

    this.socket.on("next-retention-question", (data) => {
      this.emitEvent("nextQuestion", data);
    });

    this.socket.on("retention-analytics-update", (data) => {
      this.emitEvent("analyticsUpdate", data);
    });

    this.socket.on("retention-session-paused", (data) => {
      this.emitEvent("sessionPaused", data);
    });

    this.socket.on("retention-session-resumed", (data) => {
      this.emitEvent("sessionResumed", data);
    });

    this.socket.on("retention-session-complete", (data) => {
      this.emitEvent("sessionComplete", data);
    });

    this.socket.on("retention-queue-sync", (data) => {
      this.emitEvent("queueSync", data);
    });

    this.socket.on("no-more-questions", (data) => {
      this.emitEvent("noMoreQuestions", data);
    });
  }

  /**
   * Join (or rejoin) a retention session room for real-time sync.
   */
  joinSession(sessionId, studentId = this.currentStudentId) {
    const normalizedSessionId = String(sessionId || "").trim();
    if (!normalizedSessionId) return;

    this.currentSessionId = normalizedSessionId;
    if (studentId) {
      this.currentStudentId = studentId;
    }

    if (this.socket && this.socket.connected) {
      this.socket.emit("join-retention-session", {
        sessionId: normalizedSessionId,
        studentId: this.currentStudentId,
      });
    }
  }

  /**
   * Disconnect socket
   */
  disconnectSocket() {
    if (this.socket) {
      if (this.currentSessionId) {
        this.socket.emit("leave-retention-session", {
          sessionId: this.currentSessionId,
        });
      }
      this.socket.disconnect();
      this.socket = null;
      this.currentSessionId = null;
    }
  }

  /**
   * Add event listener
   */
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners
        .get(event)
        .filter((cb) => cb !== callback);
      this.eventListeners.set(event, listeners);
    }
  }

  /**
   * Emit event to listeners
   */
  emitEvent(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach((callback) => callback(data));
    }
  }

  // ==================== Session Management ====================

  /**
   * Start a new retention practice session
   * Step 1 in API Flow: Frontend starts dedicated practice session
   */
  async startSession(subject, topics = [], sessionType = "practice") {
    try {
      if (!this.currentStudentId) {
        throw new Error("Student not initialized. Call initialize() first.");
      }

      // Validate subject and topics
      this.validateSubjectTopics(subject, topics);

      // Create session on Node.js backend
      const response = await this.nodeApi.post("/retention/sessions", {
        studentId: this.currentStudentId,
        subject,
        topics: topics.length > 0 ? topics : this.getDefaultTopics(subject),
        sessionType,
      });

      const sessionData = response.data;

      // Join socket room for real-time updates
      this.joinSession(sessionData.sessionId, this.currentStudentId);

      return {
        success: true,
        sessionId: sessionData.sessionId,
        flaskSessionId: sessionData.flaskSessionId,
        subject: sessionData.subject,
        topics: sessionData.topics,
        questions: sessionData.questions,
        totalQuestions: sessionData.totalQuestions,
        currentBatchType: sessionData.currentBatchType,
        predictions: sessionData.predictions,
        startTime: sessionData.startTime,
      };
    } catch (error) {
      console.error("Error starting retention session:", error);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  /**
   * Kept for backward compatibility, but Flask session start is delegated to Node.
   */
  async startFlaskSession(sessionId, subject, topics, sessionType) {
    return {
      success: true,
      delegatedTo: "node",
      sessionId,
      subject,
      topics,
      sessionType,
    };
  }

  /**
   * Get next question in the session
   */
  async getNextQuestion(sessionId, context = {}) {
    try {
      const forceRest = Boolean(context.forceRest);
      const preferSocket = Boolean(context.preferSocket);
      const apiContext = { ...context };
      delete apiContext.forceRest;
      delete apiContext.preferSocket;

      const getNextQuestionViaRest = async () => {
        const response = await this.nodeApi.get(
          `/retention/sessions/${sessionId}/next`,
          {
            params: apiContext,
          },
        );

        return {
          success: true,
          question: response.data.question,
          questionNumber: response.data.questionNumber,
          totalInBatch: response.data.totalInBatch,
          batchType: response.data.batchType,
          predictions: response.data.predictions,
          sessionComplete: Boolean(response.data.sessionComplete),
          metrics: response.data.metrics,
        };
      };

      // REST is the source of truth for adaptive refill/completion logic.
      // Socket mode can be explicitly enabled for experiments.
      if (
        !forceRest &&
        preferSocket &&
        this.socket &&
        this.socket.connected &&
        sessionId === this.currentSessionId
      ) {
        try {
          return await new Promise((resolve, reject) => {
            let settled = false;

            const cleanup = () => {
              this.off("nextQuestion", nextHandler);
              this.off("noMoreQuestions", noMoreHandler);
              this.off("error", errorHandler);
            };

            const settleResolve = (value) => {
              if (settled) return;
              settled = true;
              clearTimeout(timeout);
              cleanup();
              resolve(value);
            };

            const settleReject = (err) => {
              if (settled) return;
              settled = true;
              clearTimeout(timeout);
              cleanup();
              reject(err);
            };

            const timeout = setTimeout(() => {
              settleReject(new Error("Socket timeout"));
            }, 10000);

            const nextHandler = (data) => {
              if (data?.sessionId !== sessionId) return;
              settleResolve({
                success: true,
                ...data,
              });
            };

            const noMoreHandler = (data) => {
              if (data?.sessionId !== sessionId) return;
              // Let REST confirm completion to avoid premature session end.
              settleReject(new Error("Socket reported no-more-questions"));
            };

            const errorHandler = (data) => {
              const message = String(
                data?.message || data?.error || "Socket error",
              );
              settleReject(new Error(message));
            };

            this.on("nextQuestion", nextHandler);
            this.on("noMoreQuestions", noMoreHandler);
            this.on("error", errorHandler);
            this.socket.emit("request-next-retention-question", { sessionId });
          });
        } catch (socketError) {
          console.warn(
            "Socket next-question failed, falling back to REST:",
            socketError?.message || socketError,
          );
          return await getNextQuestionViaRest();
        }
      }

      // Fallback to REST API
      return await getNextQuestionViaRest();
    } catch (error) {
      console.error("Error getting next question:", error);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  /**
   * Submit answer for current question
   */
  async submitAnswer(sessionId, questionId, answerData) {
    try {
      // Add metadata
      const enrichedAnswerData = {
        ...answerData,
        user_id: this.currentStudentId,
        session_id: sessionId,
        question_id: questionId,
        subject: answerData.subject,
        topic: answerData.topic || answerData.topicCategory,
        topicId:
          answerData.topicId || answerData.topic || answerData.topicCategory,
        question_difficulty:
          answerData.question_difficulty ?? answerData.difficulty,
        selected_answer:
          answerData.selected_answer ?? answerData.selectedOptions,
        correct_answer_flag: answerData.correct_answer_flag,
        response_time:
          answerData.response_time ?? answerData.responseTimeMs ?? 0,
        hint_used: Boolean(answerData.hint_used || false),
        answer_changes:
          answerData.answer_changes ?? answerData.answerChanges ?? 0,
        confidence_rating:
          answerData.confidence_rating ?? answerData.confidence ?? 0.5,
        session_start_time: answerData.session_start_time,
        device_focus_loss_event: Boolean(
          answerData.device_focus_loss_event || false,
        ),
        timestamp: new Date().toISOString(),
        studentId: this.currentStudentId,
      };

      // Use REST API as source of truth for answer evaluation + Flask feedback.
      const response = await this.postWith429Retry(
        `/retention/sessions/${sessionId}/submit`,
        {
          questionId,
          ...enrichedAnswerData,
        },
        {
          retries: 2,
          initialDelayMs: 1200,
        },
      );

      return {
        success: true,
        isCorrect: response.data.isCorrect,
        correctAnswer: response.data.correctAnswer,
        explanation: response.data.explanation,
        solutionSteps: response.data.solutionSteps,
        currentMetrics: response.data.currentMetrics,
        sessionComplete: response.data.sessionComplete,
        nextBatchType: response.data.nextBatchType,
        answeredCount: response.data.answeredCount,
        flaskFeedback: response.data.flaskFeedback,
        retentionReview: response.data.retentionReview || null,
      };
    } catch (error) {
      console.error("Error submitting answer:", error);
      const responseData = error.response?.data || {};
      return {
        success: false,
        error: responseData.error || error.message,
        status: Number(error.response?.status || 0) || null,
        retryAfterMs:
          Number(error.response?.status || 0) === 429
            ? this.parseRetryAfterMs(error, 1200)
            : null,
        code: responseData.code || null,
        expectedQuestionId: responseData.expectedQuestionId || null,
        receivedQuestionId: responseData.receivedQuestionId || null,
        currentQuestion: responseData.currentQuestion || null,
      };
    }
  }

  /**
   * Kept for backward compatibility, but answer updates are delegated to Node.
   */
  async updateFlaskAfterAnswer(sessionId, questionId, answerResult) {
    return {
      success: true,
      delegatedTo: "node",
      sessionId,
      questionId,
      answerResult,
    };
  }

  /**
   * Complete the current session
   */
  async completeSession(sessionId) {
    try {
      const response = await this.postWith429Retry(
        `/retention/sessions/${sessionId}/complete`,
        {},
        {
          retries: 3,
          initialDelayMs: 1500,
          maxDelayMs: 9000,
        },
      );

      // Leave socket room
      if (
        this.socket &&
        this.socket.connected &&
        sessionId === this.currentSessionId
      ) {
        this.socket.emit("leave-retention-session", { sessionId });
        this.currentSessionId = null;
      }

      return {
        success: true,
        pending: Boolean(response.data?.pending),
        code: response.data?.code || null,
        message: response.data?.message || "",
        metrics: response.data.metrics,
        summary: response.data.summary,
        flaskCompletion: response.data.flaskCompletion || null,
      };
    } catch (error) {
      console.error("Error completing session:", error);
      const responseData = error.response?.data || {};
      return {
        success: false,
        error: responseData.error || error.message,
        code: responseData.code || null,
        attempts: Number(responseData.attempts || 0) || 0,
        details: responseData.details || null,
      };
    }
  }

  /**
   * Kept for backward compatibility, but completion is delegated to Node.
   */
  async completeFlaskSession(sessionId) {
    return {
      success: true,
      delegatedTo: "node",
      sessionId,
    };
  }

  /**
   * Pause current session
   */
  pauseSession(sessionId) {
    if (
      this.socket &&
      this.socket.connected &&
      sessionId === this.currentSessionId
    ) {
      this.socket.emit("pause-retention-session", { sessionId });
    }
  }

  /**
   * Resume paused session
   */
  resumeSession(sessionId) {
    if (
      this.socket &&
      this.socket.connected &&
      sessionId === this.currentSessionId
    ) {
      this.socket.emit("resume-retention-session", { sessionId });
    }
  }

  /**
   * Request real-time analytics update
   */
  requestAnalytics(sessionId) {
    if (
      this.socket &&
      this.socket.connected &&
      sessionId === this.currentSessionId
    ) {
      this.socket.emit("request-retention-analytics", { sessionId });
    }
  }

  /**
   * Request queue/timer snapshot for robust reconnect recovery.
   */
  requestQueueState(sessionId) {
    if (
      this.socket &&
      this.socket.connected &&
      sessionId === this.currentSessionId
    ) {
      this.socket.emit("request-retention-queue-state", { sessionId });
    }
  }

  /**
   * Get session summary
   */
  async getSessionSummary(sessionId) {
    try {
      const response = await this.nodeApi.get(
        `/retention/sessions/${sessionId}/summary`,
      );

      return {
        success: true,
        summary: response.data.summary,
        topicBreakdown: response.data.topicBreakdown,
        difficultyBreakdown: response.data.difficultyBreakdown,
        stressPattern: response.data.stressPattern,
        fatiguePattern: response.data.fatiguePattern,
        focusPattern: response.data.focusPattern,
        recommendations: response.data.recommendations,
      };
    } catch (error) {
      console.error("Error getting session summary:", error);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  /**
   * Get persisted analytics snapshot for one retention session.
   */
  async getSessionAnalyticsSnapshot(sessionId, refresh = false) {
    try {
      const response = await this.nodeApi.get(
        `/retention/analytics/session/${sessionId}`,
        {
          params: { refresh: refresh ? "true" : "false" },
        },
      );

      return {
        success: true,
        analytics: response.data?.analytics || null,
      };
    } catch (error) {
      console.error(
        "Error getting retention session analytics snapshot:",
        error,
      );
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  /**
   * Force-refresh persisted analytics snapshot for one session.
   */
  async syncSessionAnalyticsSnapshot(sessionId) {
    try {
      const response = await this.nodeApi.post(
        `/retention/analytics/session/${sessionId}/sync`,
      );

      return {
        success: true,
        analytics: response.data?.analytics || null,
      };
    } catch (error) {
      console.error(
        "Error syncing retention session analytics snapshot:",
        error,
      );
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  /**
   * Get all sessions for student
   */
  async getStudentSessions(params = {}) {
    try {
      const response = await this.nodeApi.get(
        `/retention/sessions/student/${this.currentStudentId}`,
        {
          params,
        },
      );

      return {
        success: true,
        sessions: response.data.sessions,
        pagination: response.data.pagination,
      };
    } catch (error) {
      console.error("Error getting student sessions:", error);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  /**
   * Get one session by id for refresh recovery.
   */
  async getSession(sessionId) {
    try {
      const response = await this.nodeApi.get(
        `/retention/sessions/${sessionId}`,
      );
      return {
        success: true,
        session: response.data.session,
      };
    } catch (error) {
      console.error("Error getting session:", error);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  /**
   * Persist refresh-recovery UI state for a session.
   */
  async saveSessionUiState(sessionId, uiState = {}) {
    const normalizedSessionId = String(sessionId || "").trim();
    if (!normalizedSessionId) {
      return {
        success: false,
        error: "Session id is required",
      };
    }

    const signature = this.getUiStateSignature(uiState);
    const lastSignature =
      this.lastUiStateSignatureBySession.get(normalizedSessionId);

    if (
      signature &&
      lastSignature &&
      signature === lastSignature &&
      !this.uiStateSaveInflightBySession.has(normalizedSessionId)
    ) {
      return {
        success: true,
        skipped: true,
      };
    }

    if (this.uiStateSaveInflightBySession.has(normalizedSessionId)) {
      this.pendingUiStateBySession.set(normalizedSessionId, {
        uiState,
        signature,
      });
      return {
        success: true,
        queued: true,
      };
    }

    const saveTask = (async () => {
      try {
        const response = await this.nodeApi.put(
          `/retention/sessions/${normalizedSessionId}/state`,
          uiState,
        );

        if (signature) {
          this.lastUiStateSignatureBySession.set(
            normalizedSessionId,
            signature,
          );
        }

        return {
          success: true,
          uiState: response.data?.uiState || null,
        };
      } catch (error) {
        console.error("Error saving session UI state:", error);
        return {
          success: false,
          error: error.response?.data?.error || error.message,
        };
      } finally {
        this.uiStateSaveInflightBySession.delete(normalizedSessionId);

        const pending = this.pendingUiStateBySession.get(normalizedSessionId);
        if (!pending) return;

        this.pendingUiStateBySession.delete(normalizedSessionId);
        const latestSignature =
          this.lastUiStateSignatureBySession.get(normalizedSessionId);
        if (pending.signature && pending.signature === latestSignature) {
          return;
        }

        this.saveSessionUiState(normalizedSessionId, pending.uiState).catch(
          () => {
            // Best-effort follow-up save.
          },
        );
      }
    })();

    this.uiStateSaveInflightBySession.set(normalizedSessionId, saveTask);
    return saveTask;
  }

  // ==================== Schedule Management ====================

  /**
   * Generate learning schedule
   * Step 6 in API Flow: Flask generates daily schedule
   */
  async generateSchedule(subject = "both", days = 7) {
    try {
      const response = await this.nodeApi.post(
        `/retention/schedules/generate/${this.currentStudentId}`,
        {
          subject,
          days,
        },
      );

      return {
        success: true,
        schedule: response.data.schedule,
      };
    } catch (error) {
      console.error("Error generating schedule:", error);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  /**
   * Get current active schedule
   */
  async getCurrentSchedule() {
    try {
      const response = await this.nodeApi.get(
        `/retention/schedules/current/${this.currentStudentId}`,
      );

      return {
        success: true,
        schedule: response.data.schedule,
      };
    } catch (error) {
      console.error("Error getting current schedule:", error);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  /**
   * Get schedule for specific date
   */
  async getScheduleForDate(date) {
    try {
      const response = await this.nodeApi.get(
        `/retention/schedules/date/${this.currentStudentId}`,
        {
          params: { date: date.toISOString() },
        },
      );

      return {
        success: true,
        date: response.data.date,
        schedule: response.data.schedule,
      };
    } catch (error) {
      console.error("Error getting schedule for date:", error);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  /**
   * Get next scheduled questions
   */
  async getNextScheduledQuestions(count = 5) {
    try {
      const response = await this.nodeApi.get(
        `/retention/schedules/next/${this.currentStudentId}`,
        {
          params: { count },
        },
      );

      return {
        success: true,
        questions: response.data.questions,
        count: response.data.count,
      };
    } catch (error) {
      console.error("Error getting next scheduled questions:", error);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  /**
   * Update schedule based on performance
   */
  async updateSchedule(sessionId, performance) {
    try {
      const response = await this.nodeApi.put(
        `/retention/schedules/update/${this.currentStudentId}`,
        {
          sessionId,
          performance,
        },
      );

      return {
        success: true,
        todayProgress: response.data.todayProgress,
      };
    } catch (error) {
      console.error("Error updating schedule:", error);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  // ==================== Metrics & Analytics ====================

  /**
   * Get overall performance metrics
   * Step 8 in API Flow: Fetch predictions and metrics
   */
  async getOverallMetrics() {
    try {
      const response = await this.nodeApi.get(
        `/retention/metrics/overall/${this.currentStudentId}`,
      );

      return {
        success: true,
        overall: response.data.metrics.overall,
        topicMetrics: response.data.metrics.topicMetrics,
        dailyMetrics: response.data.metrics.dailyMetrics,
        stressPatterns: response.data.metrics.stressPatterns,
        fatiguePatterns: response.data.metrics.fatiguePatterns,
        forgettingCurves: response.data.metrics.forgettingCurves,
        insights: response.data.metrics.insights,
        flaskPredictions: response.data.metrics.flaskPredictions,
      };
    } catch (error) {
      console.error("Error getting overall metrics:", error);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  /**
   * Get topic-wise metrics
   */
  async getTopicMetrics(params = {}) {
    try {
      const response = await this.nodeApi.get(
        `/retention/metrics/topics/${this.currentStudentId}`,
        {
          params,
        },
      );

      return {
        success: true,
        topics: response.data.topics,
        distribution: response.data.distribution,
        totalTopics: response.data.totalTopics,
      };
    } catch (error) {
      console.error("Error getting topic metrics:", error);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  /**
   * Get daily performance trends
   */
  async getDailyTrends(days = 30) {
    try {
      const response = await this.nodeApi.get(
        `/retention/metrics/trends/${this.currentStudentId}`,
        {
          params: { days },
        },
      );

      return {
        success: true,
        trends: response.data.trends,
        movingAverage: response.data.movingAverage,
        summary: response.data.summary,
      };
    } catch (error) {
      console.error("Error getting daily trends:", error);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  /**
   * Get forgetting curves
   */
  async getForgettingCurves(topicId = null) {
    try {
      const params = topicId ? { topicId } : {};
      const response = await this.nodeApi.get(
        `/retention/metrics/forgetting-curves/${this.currentStudentId}`,
        {
          params,
        },
      );

      return {
        success: true,
        curves: response.data.curves,
        ...(topicId && {
          currentRetention: response.data.currentRetention,
          lastPracticed: response.data.lastPracticed,
          nextReview: response.data.nextReview,
        }),
      };
    } catch (error) {
      console.error("Error getting forgetting curves:", error);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  /**
   * Get stress and fatigue patterns
   * Step 9 in API Flow: Get stress/fatigue predictions
   */
  async getStressFatiguePatterns(days = 30) {
    try {
      const response = await this.nodeApi.get(
        `/retention/metrics/stress-fatigue/${this.currentStudentId}`,
        {
          params: { days },
        },
      );

      return {
        success: true,
        stressPatterns: response.data.stressPatterns,
        fatiguePatterns: response.data.fatiguePatterns,
      };
    } catch (error) {
      console.error("Error getting stress fatigue patterns:", error);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  /**
   * Get learning path
   */
  async getLearningPath() {
    try {
      const response = await this.nodeApi.get(
        `/retention/metrics/learning-path/${this.currentStudentId}`,
      );

      return {
        success: true,
        learningPath: response.data.learningPath,
      };
    } catch (error) {
      console.error("Error getting learning path:", error);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  /**
   * Get personalized recommendations
   */
  async getRecommendations() {
    try {
      const response = await this.nodeApi.get(
        `/retention/metrics/recommendations/${this.currentStudentId}`,
      );

      return {
        success: true,
        recommendations: response.data.recommendations,
        summary: response.data.summary,
      };
    } catch (error) {
      console.error("Error getting recommendations:", error);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  // ==================== Flask Direct API Calls ====================

  /**
   * Get predictions directly from Flask
   */
  async getFlaskPredictions(subject = null) {
    try {
      const url = subject
        ? `/retention/predictions/${this.currentStudentId}?subject=${subject}`
        : `/retention/predictions/${this.currentStudentId}`;

      const response = await this.flaskApi.get(url);

      return {
        success: true,
        micro: response.data.predictions?.micro,
        meso: response.data.predictions?.meso,
        macro: response.data.predictions?.macro,
        forgettingCurves: response.data.predictions?.forgetting_curves,
        stressFatigue: response.data.predictions?.stress_fatigue,
      };
    } catch (error) {
      console.error("Error getting Flask predictions:", error);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  /**
   * Get live retention outputs from Flask update endpoint without adding answers.
   * This returns model readiness, model outputs and live analysis fields.
   */
  async getFlaskLivePredictions(subject = null, sessionId = null) {
    try {
      const response = await this.flaskApi.post(
        `/retention/predictions/update/${this.currentStudentId}`,
        {
          subject,
          session_id: sessionId,
          answers: [],
        },
      );

      return {
        success: true,
        predictions: response.data.predictions || {},
        modelOutputs: response.data.model_outputs || {},
        modelsReady: response.data.models_ready || {},
        trainingNeeded: response.data.training_needed || {},
        sequenceStatus: response.data.sequence_status || {},
        liveAnalysis: response.data.live_analysis || {},
        timestamp: response.data.timestamp,
      };
    } catch (error) {
      console.error("Error getting Flask live predictions:", error);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  /**
   * Get retention summary from Flask
   */
  async getFlaskRetentionSummary(subject = null) {
    try {
      const url = subject
        ? `/retention/summary/${this.currentStudentId}?subject=${subject}`
        : `/retention/summary/${this.currentStudentId}`;

      const response = await this.flaskApi.get(url);

      return {
        success: true,
        overallRetention: response.data.summary?.overall_retention,
        topicsByStatus: response.data.summary?.topics_by_status,
        totalTopics: response.data.summary?.total_topics,
      };
    } catch (error) {
      console.error("Error getting Flask retention summary:", error);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  /**
   * Get forgetting curves from Flask
   */
  async getFlaskForgettingCurves(topicId = null) {
    try {
      const url = topicId
        ? `/retention/forgetting-curves/${this.currentStudentId}?topic_id=${topicId}`
        : `/retention/forgetting-curves/${this.currentStudentId}`;

      const response = await this.flaskApi.get(url);

      return {
        success: true,
        curves: response.data.curves,
      };
    } catch (error) {
      console.error("Error getting Flask forgetting curves:", error);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  /**
   * Get daily schedule from Flask
   */
  async getFlaskDailySchedule(subject = "both") {
    try {
      const response = await this.flaskApi.get(
        `/retention/schedule/daily/${this.currentStudentId}?subject=${subject}`,
      );

      return {
        success: true,
        schedule: response.data.schedule,
      };
    } catch (error) {
      console.error("Error getting Flask daily schedule:", error);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  /**
   * Get question repetition sequence from Flask
   * Step 7 in API Flow: Get question_id repetition sequence
   */
  async getFlaskQuestionSequence(batchType = "immediate", count = 20) {
    try {
      const response = await this.flaskApi.get(
        `/retention/question-sequence/${this.currentStudentId}?batch_type=${batchType}&count=${count}`,
      );

      return {
        success: true,
        sequence: response.data.sequence,
        batchType: response.data.batch_type,
        count: response.data.count,
      };
    } catch (error) {
      console.error("Error getting Flask question sequence:", error);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  /**
   * Get stress/fatigue predictions from Flask
   */
  async getFlaskStressFatigue() {
    try {
      const response = await this.flaskApi.get(
        `/retention/stress-fatigue/${this.currentStudentId}`,
      );

      return {
        success: true,
        stress: response.data.stress_fatigue?.stress,
        fatigue: response.data.stress_fatigue?.fatigue,
        recommendations: response.data.stress_fatigue?.recommendations,
      };
    } catch (error) {
      console.error("Error getting Flask stress fatigue:", error);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  /**
   * Get optimal study times from Flask
   */
  async getFlaskOptimalStudyTimes() {
    try {
      const response = await this.flaskApi.get(
        `/retention/schedule/optimal-study-times/${this.currentStudentId}`,
      );

      return {
        success: true,
        optimalTimes: response.data.optimal_times,
      };
    } catch (error) {
      console.error("Error getting Flask optimal study times:", error);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  // ==================== Repetition Management ====================

  /**
   * Get repetition schedule for a question
   */
  async getQuestionRepetition(questionId) {
    try {
      const response = await this.nodeApi.get(
        `/retention/repetitions/${this.currentStudentId}/${questionId}`,
      );

      return {
        success: true,
        repetition: response.data.repetition,
      };
    } catch (error) {
      console.error("Error getting question repetition:", error);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  /**
   * Get all repetitions for student
   */
  async getStudentRepetitions(params = {}) {
    try {
      const response = await this.nodeApi.get(
        `/retention/repetitions/student/${this.currentStudentId}`,
        {
          params,
        },
      );

      return {
        success: true,
        repetitions: response.data.repetitions,
        summary: response.data.summary,
      };
    } catch (error) {
      console.error("Error getting student repetitions:", error);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  /**
   * Get questions due for review
   */
  async getDueQuestions(params = {}) {
    try {
      const response = await this.nodeApi.get(
        `/retention/repetitions/due/${this.currentStudentId}`,
        {
          params,
        },
      );

      return {
        success: true,
        dueQuestions: response.data.dueQuestions,
        count: response.data.count,
        date: response.data.date,
      };
    } catch (error) {
      console.error("Error getting due questions:", error);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  /**
   * Update repetitions from Flask
   */
  async updateRepetitionsFromFlask() {
    try {
      const response = await this.nodeApi.post(
        `/retention/repetitions/update-from-flask/${this.currentStudentId}`,
      );

      return {
        success: true,
        results: response.data.results,
      };
    } catch (error) {
      console.error("Error updating repetitions from Flask:", error);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  /**
   * Manually schedule a question
   */
  async scheduleQuestion(questionId, batchType, scheduledDate = null) {
    try {
      const response = await this.postWith429Retry(
        `/retention/repetitions/schedule/${this.currentStudentId}`,
        {
          questionId,
          batchType,
          scheduledDate,
        },
        {
          retries: 1,
          initialDelayMs: 1000,
        },
      );

      return {
        success: true,
        repetition: response.data.repetition,
      };
    } catch (error) {
      console.error("Error scheduling question:", error);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
        status: Number(error.response?.status || 0) || null,
        retryAfterMs:
          Number(error.response?.status || 0) === 429
            ? this.parseRetryAfterMs(error, 1000)
            : null,
      };
    }
  }

  /**
   * Get repetition statistics
   */
  async getRepetitionStats() {
    try {
      const response = await this.nodeApi.get(
        `/retention/repetitions/stats/${this.currentStudentId}`,
      );

      return {
        success: true,
        stats: response.data.stats,
      };
    } catch (error) {
      console.error("Error getting repetition stats:", error);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  // ==================== Helper Methods ====================

  /**
   * Validate subject and topics
   */
  validateSubjectTopics(subject, topics) {
    const validSubjects = ["english", "gk"];
    if (!validSubjects.includes(subject)) {
      throw new Error(
        `Invalid subject. Must be one of: ${validSubjects.join(", ")}`,
      );
    }

    const validTopics = {
      english: [
        "vocabulary",
        "idioms",
        "phrases",
        "synonyms",
        "antonyms",
        "one_word_substitution",
      ],
      gk: ["history", "geography", "science", "current_affairs"],
    };

    if (topics && topics.length > 0) {
      const invalidTopics = topics.filter(
        (t) => !validTopics[subject].includes(t),
      );
      if (invalidTopics.length > 0) {
        throw new Error(
          `Invalid topics for ${subject}: ${invalidTopics.join(", ")}`,
        );
      }
    }
  }

  /**
   * Get default topics for a subject
   */
  getDefaultTopics(subject) {
    const defaultTopics = {
      english: [
        "vocabulary",
        "idioms",
        "phrases",
        "synonyms",
        "antonyms",
        "one_word_substitution",
      ],
      gk: ["history", "geography", "science", "current_affairs"],
    };
    return defaultTopics[subject] || [];
  }

  /**
   * Calculate retention color based on value
   */
  getRetentionColor(retention) {
    if (retention < 0.3) return "#ef4444"; // red
    if (retention < 0.5) return "#f97316"; // orange
    if (retention < 0.7) return "#eab308"; // yellow
    if (retention < 0.85) return "#22c55e"; // green
    return "#10b981"; // emerald
  }

  /**
   * Get status text based on retention
   */
  getRetentionStatus(retention) {
    if (retention < 0.3) return "Critical";
    if (retention < 0.5) return "Warning";
    if (retention < 0.7) return "Moderate";
    if (retention < 0.85) return "Good";
    return "Excellent";
  }

  /**
   * Format time for display
   */
  formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  /**
   * Clean up service
   */
  cleanup() {
    this.disconnectSocket();
    this.eventListeners.clear();
    this.currentSessionId = null;
    this.currentStudentId = null;
  }
}

// Create singleton instance
const retentionService = new RetentionService();
export default retentionService;
