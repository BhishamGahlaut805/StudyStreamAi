import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FiArrowRight,
  FiBarChart2,
  FiClock,
  FiPauseCircle,
  FiPlayCircle,
  FiSend,
  FiSidebar,
  FiTrendingUp,
  FiCpu,
  FiBookOpen,
  FiCalendar,
  FiAlertCircle,
  FiCheckCircle,
  FiXCircle,
  FiRefreshCw,
  FiMoon,
  FiSun,
  FiMaximize2,
  FiMinimize2,
} from "react-icons/fi";
import { useAuth } from "../../context/authContext";
import authService from "../../services/authService";
import retentionService from "../../services/RetentionModel/RetentionService";

const ACTIVE_SESSION_KEY = "retention_active_session";
const RETENTION_THEME_KEY = "retention_interface_theme";
const runtimeKey = (sessionId) => `retention_runtime_${sessionId}`;
const retentionQueueKey = (sessionId) => `retention_queue_${sessionId}`;
const retentionQueueBackupKey = (sessionId) =>
  `retention_queue_backup_${sessionId}`;
const retentionArchiveKey = (sessionId) =>
  `retention_queue_archive_${sessionId}`;
const retentionArchiveBackupKey = (sessionId) =>
  `retention_queue_archive_backup_${sessionId}`;
const servedQuestionIdsKey = (sessionId) =>
  `retention_served_question_ids_${sessionId}`;
const servedQuestionIdsBackupKey = (sessionId) =>
  `retention_served_question_ids_backup_${sessionId}`;
const RETENTION_TIMER_FRAMES_SEC = [30, 60, 120, 300, 600, 3600, 7200];
const MAX_RETENTION_REPEATS = 2;
const RETENTION_SUBJECT_TOPICS = {
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

const toRetentionSubjectKey = (subject) => {
  const normalized = String(subject || "")
    .trim()
    .toLowerCase();
  if (normalized === "general_knowledge") return "gk";
  return normalized;
};

const pickNearestTimerFrameSec = (seconds) => {
  const raw = Number(seconds);
  const safe = Number.isFinite(raw) ? Math.max(0, raw) : 300;
  return RETENTION_TIMER_FRAMES_SEC.reduce((best, frame) =>
    Math.abs(frame - safe) < Math.abs(best - safe) ? frame : best,
  );
};

const timerFrameLabelFromSec = (seconds) => {
  const sec = pickNearestTimerFrameSec(seconds);
  if (sec === 30) return "30 seconds";
  if (sec === 60) return "1 minute";
  if (sec === 120) return "2 minutes";
  if (sec === 300) return "5 minutes";
  if (sec === 600) return "10 minutes";
  if (sec === 3600) return "1 hour";
  if (sec === 7200) return "2 hours";
  return `${sec} seconds`;
};

const normalizeIdValue = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") {
    const out = String(value).trim();
    return out && out !== "[object Object]" ? out : "";
  }
  if (typeof value === "object") {
    const nested =
      value.$oid ??
      value.oid ??
      value.id ??
      value._id ??
      value.questionId ??
      value.question_id ??
      null;
    if (nested !== null && nested !== undefined && nested !== value) {
      const resolvedNested = normalizeIdValue(nested);
      if (resolvedNested) return resolvedNested;
    }

    if (typeof value.toString === "function") {
      const text = String(value.toString()).trim();
      if (text && text !== "[object Object]") return text;
    }
  }
  return "";
};

const resolveQuestionId = (question) => {
  if (!question || typeof question !== "object") return "";
  const candidates = [
    question.id,
    question.questionId,
    question.question_id,
    question._id,
    question.sourceQuestionId,
    question?.retentionReview?.questionId,
    question?.retentionReview?.question_id,
    question?.retentionReview?.flaskMetrics?.questionId,
    question?.retentionReview?.flaskMetrics?.question_id,
    question?.metadata?.questionId,
    question?.metadata?.question_id,
    question?.question?.id,
    question?.question?.questionId,
    question?.question?._id,
  ];
  for (const candidate of candidates) {
    const resolved = normalizeIdValue(candidate);
    if (resolved) return resolved;
  }
  return "";
};

const normalizeQuestionShape = (question) => {
  if (!question || typeof question !== "object") return null;
  const resolvedId = resolveQuestionId(question);
  return {
    ...question,
    id: resolvedId || question.id,
    questionId: resolvedId || question.questionId,
  };
};

const buildQuestionSubmitKey = (question, questionIndex) => {
  const qid = resolveQuestionId(question);
  if (qid) return `id:${qid}`;
  const text = String(question?.text || "")
    .trim()
    .toLowerCase()
    .slice(0, 120);
  const topic = String(question?.topicCategory || question?.topic || "")
    .trim()
    .toLowerCase();
  return `idx:${Number(questionIndex || 0)}|topic:${topic}|text:${text}`;
};

const RetentionPageInterface = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const stateSession = location.state?.session;
  const persistedActiveSession = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(ACTIVE_SESSION_KEY) || "null");
    } catch {
      return null;
    }
  }, []);

  const stateConfig = location.state?.config || persistedActiveSession || {};

  const studentId = useMemo(
    () =>
      stateConfig.studentId ||
      user?.studentId ||
      user?.id ||
      authService.getStudentId(),
    [stateConfig.studentId, user],
  );

  // ==================== State Management ====================
  const [session, setSession] = useState(
    stateSession ||
      (persistedActiveSession?.sessionId
        ? { sessionId: persistedActiveSession.sessionId }
        : null),
  );
  const currentSessionId = useMemo(
    () =>
      session?.sessionId ||
      stateSession?.sessionId ||
      persistedActiveSession?.sessionId ||
      null,
    [
      session?.sessionId,
      stateSession?.sessionId,
      persistedActiveSession?.sessionId,
    ],
  );
  const activeSubjectKey = useMemo(
    () =>
      toRetentionSubjectKey(
        session?.subject ||
          stateSession?.subject ||
          persistedActiveSession?.subject ||
          stateConfig.subject ||
          "",
      ),
    [
      persistedActiveSession?.subject,
      session?.subject,
      stateConfig.subject,
      stateSession?.subject,
    ],
  );

  const activeTopicScope = useMemo(() => {
    const configuredTopics =
      (Array.isArray(session?.topics) && session.topics.length > 0
        ? session.topics
        : Array.isArray(stateConfig?.topics) && stateConfig.topics.length > 0
          ? stateConfig.topics
          : RETENTION_SUBJECT_TOPICS[activeSubjectKey] || []) || [];

    return configuredTopics
      .map((topic) =>
        String(topic || "")
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean);
  }, [activeSubjectKey, session?.topics, stateConfig?.topics]);

  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingNext, setLoadingNext] = useState(false);
  const [recoveringSession, setRecoveringSession] = useState(false);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [hasAnsweredCurrent, setHasAnsweredCurrent] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const savedTheme = localStorage.getItem(RETENTION_THEME_KEY);
      if (savedTheme === "dark") return true;
      if (savedTheme === "light") return false;
      return Boolean(
        window.matchMedia?.("(prefers-color-scheme: dark)")?.matches,
      );
    } catch {
      return false;
    }
  });

  // Feature tracking for LSTM models
  const [answerChanges, setAnswerChanges] = useState(0);
  const [focusLossCount, setFocusLossCount] = useState(0);
  const [sessionElapsedSec, setSessionElapsedSec] = useState(0);
  const [questionElapsedSec, setQuestionElapsedSec] = useState(0);
  const [wrongStreak, setWrongStreak] = useState(0);
  const [hintUsed, setHintUsed] = useState(false);
  const [confidenceRating, setConfidenceRating] = useState(3);

  // Session metrics
  const [metrics, setMetrics] = useState({
    questionsAnswered: 0,
    correctAnswers: 0,
    overallAccuracy: 0,
    averageResponseTime: 0,
    recentAccuracy: 0,
    currentStreak: 0,
  });

  // LSTM Model Outputs
  const [microLSTM, setMicroLSTM] = useState({
    retentionProbability: 0,
    nextQuestionDifficulty: 3,
    probabilityCorrectNext: 0,
    stressImpact: 0,
    fatigueLevel: 0,
    repeatInDays: 0,
    batchType: "medium_term",
  });

  const [mesoLSTM, setMesoLSTM] = useState({
    subjectRetentionScore: 0,
    nextTopicRevisionPriority: [],
    optimalRevisionIntervalDays: 7,
    retention7d: 0,
    retention30d: 0,
    retention90d: 0,
    targetQuestions: 8,
  });

  const [macroLSTM, setMacroLSTM] = useState({
    optimalDailyStudySchedule: [],
    subjectPriorityOrder: [],
    predictedLongTermRetentionScore: 0,
    fatigueRiskProbability: 0,
    burnoutStatus: "low",
    recommendedBreakMinutes: 10,
    optimalDailyMinutes: 60,
    weeklyStructure: {},
  });

  const [analysisReady, setAnalysisReady] = useState(false);
  const [analysisMeta, setAnalysisMeta] = useState(null);
  const [modelTrainingStatus, setModelTrainingStatus] = useState({
    micro: false,
    meso: false,
    macro: false,
  });
  const [isFinishingSession, setIsFinishingSession] = useState(false);
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const [autoAdvanceSecondsLeft, setAutoAdvanceSecondsLeft] = useState(0);
  const [retentionRows, setRetentionRows] = useState([]);
  const [retentionArchiveRows, setRetentionArchiveRows] = useState([]);
  const [retentionChartHoverIndex, setRetentionChartHoverIndex] = useState(-1);
  const [queueTick, setQueueTick] = useState(0);
  const [isHydratingPersistence, setIsHydratingPersistence] = useState(true);
  const [sessionBootstrapReady, setSessionBootstrapReady] = useState(false);

  // Refs
  const questionStartRef = useRef(Date.now());
  const sessionStartMsRef = useRef(Date.now());
  const timerRef = useRef(null);
  const pausedRef = useRef(false);
  const autoLoadRef = useRef(false);
  const submitLockRef = useRef(false);
  const lastSubmittedQuestionRef = useRef(null);
  const scheduledQueueRowsRef = useRef(new Set());
  const queueScheduleInFlightRef = useRef(new Set());
  const queueRetryAtRef = useRef(new Map());
  const queueHydratedRef = useRef(false);
  const archiveHydratedRef = useRef(false);
  const backendUiHydratedRef = useRef(false);
  const loadNextInFlightRef = useRef(false);
  const servedQuestionIdsRef = useRef(new Set());
  const focusPanelRef = useRef(null);
  const autoAdvanceTimeoutRef = useRef(null);
  const autoAdvanceIntervalRef = useRef(null);
  const completionLockRef = useRef(false);
  const sessionStartRef = useRef(
    stateSession?.startTime ||
      stateConfig.startedAt ||
      new Date().toISOString(),
  );

  const clearAutoAdvanceTimers = useCallback(() => {
    if (autoAdvanceTimeoutRef.current) {
      window.clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
    if (autoAdvanceIntervalRef.current) {
      window.clearInterval(autoAdvanceIntervalRef.current);
      autoAdvanceIntervalRef.current = null;
    }
    setAutoAdvanceSecondsLeft(0);
  }, []);

  // ==================== Utility Functions ====================
  const clamp = (value, min = 0, max = 1) =>
    Math.max(min, Math.min(max, Number(value) || 0));

  const toNumberSafe = useCallback((value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }, []);

  const toRatio = useCallback((value, fallback = 0) => {
    const n = Number(value);
    const safe = Number.isFinite(n) ? n : fallback;
    if (safe > 1 && safe <= 100) return Math.max(0, Math.min(1, safe / 100));
    return Math.max(0, Math.min(1, safe));
  }, []);

  const toPercent = useCallback((value, fallback = 0) => {
    const n = Number(value);
    const safe = Number.isFinite(n) ? n : fallback;
    if (safe <= 1) return Math.max(0, Math.min(100, safe * 100));
    return Math.max(0, Math.min(100, safe));
  }, []);

  const firstDefined = useCallback((...values) => {
    for (const value of values) {
      if (value !== undefined && value !== null && value !== "") {
        return value;
      }
    }
    return undefined;
  }, []);

  const normalizeAnswerToken = useCallback((value) => {
    if (value && typeof value === "object") {
      return String(value.value ?? value.id ?? value.label ?? value.text ?? "")
        .trim()
        .toLowerCase();
    }
    return String(value ?? "")
      .trim()
      .toLowerCase();
  }, []);

  const isAnswerCorrect = useCallback(
    (selected, correct) => {
      const selectedList = Array.isArray(selected) ? selected : [selected];
      const correctList = Array.isArray(correct) ? correct : [correct];

      const selectedNorm = selectedList
        .map((item) => normalizeAnswerToken(item))
        .filter(Boolean)
        .sort();
      const correctNorm = correctList
        .map((item) => normalizeAnswerToken(item))
        .filter(Boolean)
        .sort();

      if (selectedNorm.length !== correctNorm.length) return false;
      return JSON.stringify(selectedNorm) === JSON.stringify(correctNorm);
    },
    [normalizeAnswerToken],
  );

  const toClock = (seconds) => {
    const sec = Math.max(0, Number(seconds) || 0);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const toDurationLabel = (ms) => {
    const totalSec = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${totalSec}s`;
  };

  const toCountdownLabel = useCallback((ms) => {
    const totalSec = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, []);

  const formatEstimatedRepeatStamp = useCallback((iso) => {
    if (!iso) return "-";
    const value = new Date(iso);
    if (!Number.isFinite(value.getTime())) return "-";
    return value.toLocaleString([], {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      month: "short",
      day: "2-digit",
    });
  }, []);

  const toQueueMs = useCallback((value) => {
    const ms = value ? new Date(value).getTime() : 0;
    return Number.isFinite(ms) ? ms : 0;
  }, []);

  const getQueueQuestionKey = useCallback((row) => {
    if (!row || typeof row !== "object") return "";
    const resolved = normalizeIdValue(row.questionId || row.id || "");
    return resolved ? String(resolved) : "";
  }, []);

  const normalizeQueueRow = useCallback(
    (row) => {
      if (!row || typeof row !== "object") return null;
      const questionKey = getQueueQuestionKey(row);
      if (!questionKey) return null;

      const timerFrameSeconds = pickNearestTimerFrameSec(
        firstDefined(row.timerFrameSeconds, row.repeatInSeconds, 300),
      );
      const fallbackDueAt = new Date(
        Date.now() + Math.max(0, timerFrameSeconds) * 1000,
      ).toISOString();
      const dueAt = row.nextRepeatAt || row.dueAt || fallbackDueAt;

      return {
        ...row,
        id: questionKey,
        questionId: questionKey,
        timerFrameSeconds,
        timerFrameLabel:
          row.timerFrameLabel || timerFrameLabelFromSec(timerFrameSeconds),
        nextRepeatAt: dueAt,
        queueStatus: row.queueStatus || "pending",
        repeatsDone: Number(row.repeatsDone || 0),
        queueEntryCount: Number(
          firstDefined(
            row.queueEntryCount,
            Number(row.repeatsDone || 0) + 1,
            0,
          ),
        ),
        firstQueuedAt: row.firstQueuedAt || new Date().toISOString(),
        lastQueuedAt: row.lastQueuedAt || new Date().toISOString(),
      };
    },
    [firstDefined, getQueueQuestionKey],
  );

  const getQueueRowFreshnessMs = useCallback(
    (row) =>
      Math.max(
        toQueueMs(row?.updatedAt),
        toQueueMs(row?.scheduledAt),
        toQueueMs(row?.lastQueuedAt),
        toQueueMs(row?.retiredAt),
        toQueueMs(row?.firstQueuedAt),
      ),
    [toQueueMs],
  );

  const dedupeRetentionRows = useCallback(
    (rows = []) => {
      const byQuestion = new Map();

      (Array.isArray(rows) ? rows : []).forEach((row) => {
        const normalized = normalizeQueueRow(row);
        if (!normalized) return;
        const key = normalized.questionId;
        const existing = byQuestion.get(key);

        if (!existing) {
          byQuestion.set(key, normalized);
          return;
        }

        const existingFreshness = getQueueRowFreshnessMs(existing);
        const nextFreshness = getQueueRowFreshnessMs(normalized);
        if (nextFreshness > existingFreshness) {
          byQuestion.set(key, normalized);
          return;
        }
        if (existingFreshness > nextFreshness) {
          return;
        }

        const existingDue = toQueueMs(existing.nextRepeatAt);
        const nextDue = toQueueMs(normalized.nextRepeatAt);
        const existingQueueCount = Number(
          existing.queueEntryCount || existing.repeatsDone || 0,
        );
        const nextQueueCount = Number(
          normalized.queueEntryCount || normalized.repeatsDone || 0,
        );

        const shouldReplace =
          nextQueueCount > existingQueueCount ||
          (!existingDue && Boolean(nextDue)) ||
          (nextDue > 0 && existingDue > 0 && nextDue > existingDue) ||
          (nextDue === existingDue &&
            Number(normalized.retentionScore || 0) <
              Number(existing.retentionScore || 0));

        if (shouldReplace) {
          byQuestion.set(key, normalized);
        }
      });

      return Array.from(byQuestion.values())
        .sort(
          (a, b) =>
            toQueueMs(a.nextRepeatAt) - toQueueMs(b.nextRepeatAt) ||
            Number(a.retentionScore || 0) - Number(b.retentionScore || 0),
        )
        .slice(0, 50);
    },
    [getQueueRowFreshnessMs, normalizeQueueRow, toQueueMs],
  );

  const mergeArchiveRows = useCallback(
    (baseRows = [], incomingRows = []) => {
      const merged = new Map();
      const allRows = [
        ...(Array.isArray(incomingRows) ? incomingRows : []),
        ...(Array.isArray(baseRows) ? baseRows : []),
      ];

      allRows.forEach((row) => {
        const normalized = normalizeQueueRow(row);
        if (!normalized) return;

        const key = getQueueQuestionKey(normalized);
        if (!key) return;

        const existing = merged.get(key);
        if (!existing) {
          merged.set(key, normalized);
          return;
        }

        const existingRetiredAt = toQueueMs(existing?.retiredAt);
        const incomingRetiredAt = toQueueMs(normalized?.retiredAt);
        if (incomingRetiredAt >= existingRetiredAt) {
          merged.set(key, normalized);
        }
      });

      return Array.from(merged.values()).slice(0, 120);
    },
    [getQueueQuestionKey, normalizeQueueRow, toQueueMs],
  );

  const buildUiStateSnapshot = useCallback(() => {
    return {
      retentionQueue: dedupeRetentionRows(retentionRows),
      retentionArchive: (Array.isArray(retentionArchiveRows)
        ? retentionArchiveRows
        : []
      ).slice(0, 120),
      servedQuestionIds: Array.from(servedQuestionIdsRef.current),
      runtime: {
        sessionStartMs: Number(sessionStartMsRef.current || 0),
        questionStartMs: Number(questionStartRef.current || 0),
        updatedAt: Date.now(),
      },
    };
  }, [dedupeRetentionRows, retentionArchiveRows, retentionRows]);

  const getRetentionColor = (value) => {
    if (value < 0.3) return "#ef4444";
    if (value < 0.5) return "#f97316";
    if (value < 0.7) return "#eab308";
    if (value < 0.85) return "#22c55e";
    return "#10b981";
  };

  const getDifficultyLabel = (difficulty) => {
    const labels = {
      1: "Very Easy",
      2: "Easy",
      3: "Medium",
      4: "Hard",
      5: "Very Hard",
    };
    return labels[difficulty] || "Medium";
  };

  const getBatchTypeLabel = (type) => {
    const labels = {
      immediate: "Immediate Review",
      short_term: "Short-term Review",
      medium_term: "Medium-term Review",
      long_term: "Long-term Review",
      mastered: "Mastered",
    };
    return labels[type] || type;
  };

  const getInsightTierLabel = (tier) => {
    const labels = {
      micro: "Question Insights",
      meso: "Subject Insights",
      macro: "Study Strategy",
    };
    return labels[tier] || String(tier || "Insight");
  };

  const normalizeOption = useCallback((option) => {
    if (option && typeof option === "object") {
      const value = String(
        option.value ?? option.id ?? option.label ?? option.text ?? "",
      );
      const label = String(
        option.label ?? option.text ?? option.value ?? option.id ?? "",
      );
      return { value, label };
    }
    const text = String(option ?? "");
    return { value: text, label: text };
  }, []);

  const formatOptionsInline = useCallback(
    (options = []) =>
      (Array.isArray(options) ? options : [])
        .map((option) => normalizeOption(option).label)
        .filter(Boolean)
        .join(" | "),
    [normalizeOption],
  );

  const resolveCorrectAnswerLabel = useCallback(
    (correctAnswer, options = []) => {
      const normalizedOptions = (Array.isArray(options) ? options : []).map(
        (option) => normalizeOption(option),
      );

      const resolveOne = (value) => {
        const asString = String(value ?? "");
        const match = normalizedOptions.find(
          (option) => option.value === asString || option.label === asString,
        );
        return match?.label || asString;
      };

      if (Array.isArray(correctAnswer)) {
        return correctAnswer.map((item) => resolveOne(item)).join(", ");
      }

      return resolveOne(correctAnswer);
    },
    [normalizeOption],
  );

  // ==================== Feature Engineering for LSTM Models ====================

  /**
   * Compute all 15 features for Micro LSTM (Topic Level)
   */
  const computeMicroFeatures = useCallback(
    ({
      responseTimeMs,
      expectedTimeSec,
      answerChangesCount,
      totalFocusLoss,
      isCorrect,
      topicAccuracy,
      topicAttempts,
      sessionElapsed,
      answered,
      difficulty,
      confidence,
    }) => {
      const expectedMs = Math.max(1000, Number(expectedTimeSec || 90) * 1000);
      const avgResponseTime = metrics.averageResponseTime || expectedMs;

      // 1. Answer Correctness
      const answerCorrectness = isCorrect ? 1 : 0;

      // 2. Normalized Response Time
      const normalizedResponseTime =
        responseTimeMs / Math.max(avgResponseTime, 1);

      // 3. Rolling Accuracy (Topic)
      const rollingAccuracyTopic = topicAccuracy || 0.5;

      // 4. Consecutive Correct Streak
      const consecutiveCorrectStreak = metrics.currentStreak || 0;

      // 5. Time Since Last Attempt (in seconds)
      const timeSinceLastAttempt = sessionElapsed; // Simplified

      // 6. Answer Change Count
      const answerChangeCount = answerChangesCount;

      // 7. Confidence Rating (1-5)
      const confidenceRatingValue = Math.max(
        1,
        Math.min(5, Math.round(confidence * 5)),
      );

      // 8. Concept Mastery Score (weighted accuracy with decay)
      const conceptMasteryScore = clamp(
        rollingAccuracyTopic * 0.7 + (isCorrect ? 0.3 : 0),
      );

      // 9. Question Difficulty (1-5)
      const questionDifficulty = difficulty;

      // 10. Fatigue Indicator
      const fatigueIndicator = clamp(sessionElapsed / 3600); // Normalized to 1 hour

      // 11. Focus Loss Frequency
      const focusLossFrequency = totalFocusLoss / Math.max(answered, 1);

      // 12. Rolling Response Time Variance
      const rollingTimeVariance = clamp(
        Math.abs(normalizedResponseTime - 1) * 2,
      );

      // 13. Hint Usage Flag
      const hintUsageFlag = hintUsed ? 1 : 0;

      // 14. Preferred Difficulty Offset
      const optimalDifficulty = Math.round(
        3 - (rollingAccuracyTopic - 0.5) * 2,
      );
      const preferredDifficultyOffset = difficulty - optimalDifficulty;

      // 15. Attempt Count Per Topic
      const attemptCountPerTopic = topicAttempts || answered;

      return {
        // Features array (for backend)
        features: [
          answerCorrectness,
          normalizedResponseTime,
          rollingAccuracyTopic,
          consecutiveCorrectStreak,
          timeSinceLastAttempt,
          answerChangeCount,
          confidenceRatingValue,
          conceptMasteryScore,
          questionDifficulty,
          fatigueIndicator,
          focusLossFrequency,
          rollingTimeVariance,
          hintUsageFlag,
          preferredDifficultyOffset,
          attemptCountPerTopic,
        ],
        // Computed targets
        retentionProbability: clamp(
          0.45 * rollingAccuracyTopic +
            0.25 * conceptMasteryScore +
            0.15 * (confidenceRatingValue / 5) +
            0.15 * clamp(1 / Math.max(normalizedResponseTime, 0.1)),
        ),
        probabilityCorrectNext: clamp(
          0.4 * rollingAccuracyTopic +
            0.3 * conceptMasteryScore +
            0.2 * (confidenceRatingValue / 5) -
            0.1 * fatigueIndicator,
        ),
        nextDifficulty: Math.max(
          1,
          Math.min(5, Math.round(2.5 + (rollingAccuracyTopic - 0.5) * 3)),
        ),
      };
    },
    [metrics.averageResponseTime, metrics.currentStreak, hintUsed],
  );

  /**
   * Compute all 15 features for Meso LSTM (Subject Level)
   */
  const computeMesoFeatures = useCallback(() => {
    const accuracy = metrics.overallAccuracy / 100 || 0;
    const answered = metrics.questionsAnswered || 1;

    return {
      // 1. Subject Accuracy Rate
      subjectAccuracyRate: accuracy,

      // 2. Topic Mastery Vector (simplified for demo)
      topicMasteryVector: [accuracy * 0.9, accuracy * 0.8, accuracy * 0.7],

      // 3. Forgetting Rate
      forgettingRate: Math.max(0, 0.1 - (accuracy - 0.5) * 0.1),

      // 4. Session Performance Trend
      sessionPerformanceTrend: metrics.recentAccuracy / 100 - accuracy || 0,

      // 5. Average Response Time
      avgResponseTime: metrics.averageResponseTime / 5000,

      // 6. Response Time Improvement Rate
      rtImprovement: 0.1,

      // 7. Difficulty Success Rate
      difficultySuccessRate: accuracy,

      // 8. Revision Interval
      revisionInterval: sessionElapsedSec / 86400, // Days

      // 9. Topic Switch Frequency
      topicSwitchFrequency: 0.2,

      // 10. Incorrect Pattern Frequency
      incorrectPatternFrequency: 1 - accuracy,

      // 11. Learning Velocity
      learningVelocity: (accuracy * answered) / 10,

      // 12. Engagement Score
      engagementScore: answered / Math.max(1, sessionElapsedSec / 60),

      // 13. Fatigue Trend
      fatigueTrend: microLSTM.fatigueLevel - 0.3,

      // 14. Hint Dependency Rate
      hintDependencyRate: hintUsed ? 0.1 : 0,

      // 15. Retention Decay Index
      retentionDecayIndex: Math.max(0, 0.2 - accuracy * 0.1),
    };
  }, [metrics, sessionElapsedSec, microLSTM.fatigueLevel, hintUsed]);

  /**
   * Compute all 15 features for Macro LSTM (Learning Path)
   */
  const computeMacroFeatures = useCallback(() => {
    const accuracy = metrics.overallAccuracy / 100 || 0;
    const answered = metrics.questionsAnswered || 1;
    const performanceVariability = Math.abs(
      metrics.recentAccuracy / 100 - accuracy,
    );

    return {
      // 1. Overall Accuracy Rate
      overallAccuracyRate: accuracy,

      // 2. Cross Subject Mastery Vector
      crossSubjectMasteryVector: [accuracy * 0.9, accuracy * 0.8],

      // 3. Daily Study Duration
      dailyStudyDuration: sessionElapsedSec / 3600,

      // 4. Study Consistency Index
      studyConsistencyIndex: 0.7,

      // 5. Fatigue Pattern
      fatiguePattern: microLSTM.fatigueLevel,

      // 6. Forgetting Curve Slope
      forgettingCurveSlope: -0.1 * (1 - accuracy),

      // 7. Performance Variability
      performanceVariability,

      // 8. Session Start Time Pattern
      sessionStartTimePattern: new Date().getHours() / 24,

      // 9. Topic Completion Rate
      topicCompletionRate: accuracy,

      // 10. Learning Efficiency Score
      learningEfficiencyScore:
        accuracy / Math.max(0.1, sessionElapsedSec / 3600),

      // 11. Break Frequency
      breakFrequency: focusLossCount / Math.max(1, answered),

      // 12. Cognitive Load Index
      cognitiveLoadIndex: microLSTM.nextQuestionDifficulty / 5,

      // 13. Motivation Index
      motivationIndex: clamp(0.5 + accuracy * 0.3),

      // 14. Stress Indicator
      stressIndicator: wrongStreak * microLSTM.stressImpact,

      // 15. Retention Stability Score
      retentionStabilityScore: 1 - performanceVariability,
    };
  }, [metrics, sessionElapsedSec, microLSTM, focusLossCount, wrongStreak]);

  const buildLstmPayload = useCallback(
    ({ microFeatures, responseTimeMs, isCorrect, usedHint }) => {
      const meso = computeMesoFeatures();
      const macro = computeMacroFeatures();
      const retentionNow = toRatio(microFeatures.retentionProbability, 0.5);
      const nextCorrect = toRatio(microFeatures.probabilityCorrectNext, 0.5);
      const nextFrameSec = pickNearestTimerFrameSec(
        retentionNow < 0.3
          ? 30
          : retentionNow < 0.45
            ? 60
            : retentionNow < 0.55
              ? 120
              : retentionNow < 0.65
                ? 300
                : retentionNow < 0.75
                  ? 600
                  : retentionNow < 0.88
                    ? 3600
                    : 7200,
      );

      return {
        micro_features: microFeatures.features,
        meso_features: [
          meso.subjectAccuracyRate,
          ...(Array.isArray(meso.topicMasteryVector)
            ? meso.topicMasteryVector
            : []),
          meso.forgettingRate,
          meso.sessionPerformanceTrend,
          meso.avgResponseTime,
          meso.rtImprovement,
          meso.difficultySuccessRate,
          meso.revisionInterval,
          meso.topicSwitchFrequency,
          meso.incorrectPatternFrequency,
          meso.learningVelocity,
          meso.engagementScore,
          meso.fatigueTrend,
          meso.hintDependencyRate,
          meso.retentionDecayIndex,
        ],
        macro_features: [
          macro.overallAccuracyRate,
          ...(Array.isArray(macro.crossSubjectMasteryVector)
            ? macro.crossSubjectMasteryVector
            : []),
          macro.dailyStudyDuration,
          macro.studyConsistencyIndex,
          macro.fatiguePattern,
          macro.forgettingCurveSlope,
          macro.performanceVariability,
          macro.sessionStartTimePattern,
          macro.topicCompletionRate,
          macro.learningEfficiencyScore,
          macro.breakFrequency,
          macro.cognitiveLoadIndex,
          macro.motivationIndex,
          macro.stressIndicator,
          macro.retentionStabilityScore,
        ],
        derived_targets: {
          micro: {
            retention_probability: retentionNow,
            probability_correct_next: nextCorrect,
            next_question_difficulty: Number(microFeatures.nextDifficulty || 3),
            repeat_in_seconds: nextFrameSec,
            repeat_in_days: Number((nextFrameSec / 86400).toFixed(4)),
          },
          meso: {
            subject_retention_score: toRatio(
              meso.subjectAccuracyRate,
              retentionNow,
            ),
            optimal_revision_interval_days: Number(
              Math.max(0.0003, meso.revisionInterval || 0.1).toFixed(4),
            ),
          },
          macro: {
            predicted_long_term_retention_score: toRatio(
              macro.retentionStabilityScore,
              retentionNow,
            ),
            fatigue_risk_probability: toRatio(macro.fatiguePattern, 0.3),
          },
        },
        schedule_hint: {
          timer_frame_seconds: nextFrameSec,
          timer_frame_label: timerFrameLabelFromSec(nextFrameSec),
          next_repeat_at: new Date(
            Date.now() + nextFrameSec * 1000,
          ).toISOString(),
        },
        quality_signals: {
          is_correct: Boolean(isCorrect),
          used_hint: Boolean(usedHint),
          response_time_ms: Number(responseTimeMs || 0),
          answer_changes: Number(answerChanges || 0),
          focus_losses: Number(focusLossCount || 0),
          confidence_rating: Number(confidenceRating || 3),
          question_elapsed_sec: Number(questionElapsedSec || 0),
          session_elapsed_sec: Number(sessionElapsedSec || 0),
        },
      };
    },
    [
      answerChanges,
      computeMacroFeatures,
      computeMesoFeatures,
      confidenceRating,
      focusLossCount,
      questionElapsedSec,
      sessionElapsedSec,
      toRatio,
    ],
  );

  // ==================== Model Output Processing ====================

  /**
   * Process Flask feedback to update LSTM model outputs
   */
  const processModelOutputs = useCallback(
    (feedback) => {
      if (!feedback) return;

      const modelOutputs =
        feedback.modelOutputs || feedback.model_outputs || {};
      const liveAnalysis =
        feedback.liveAnalysis || feedback.live_analysis || {};
      const readyMap = feedback.modelsReady || feedback.models_ready || {};
      const trainingNeeded =
        feedback.trainingNeeded || feedback.training_needed || {};
      const sequenceStatus =
        feedback.sequenceStatus || feedback.sequence_status || {};
      const stressFatigueBurnout =
        feedback.stress_fatigue_burnout ||
        modelOutputs.stress_fatigue_burnout ||
        null;

      const microFromNextQuestion =
        (feedback?.predictions &&
          typeof feedback.predictions === "object" &&
          !Array.isArray(feedback.predictions) && {
            expectedRetention: feedback.predictions.expectedRetention,
            stressImpact: feedback.predictions.stressImpact,
            fatigueLevel: feedback.predictions.fatigueLevel,
          }) ||
        {};

      const hasNextQuestionSignals = [
        microFromNextQuestion.expectedRetention,
        microFromNextQuestion.stressImpact,
        microFromNextQuestion.fatigueLevel,
      ].some((v) => v !== undefined && v !== null);

      const microPredList = Array.isArray(feedback?.predictions?.micro)
        ? feedback.predictions.micro
        : feedback?.predictions?.micro
          ? [feedback.predictions.micro]
          : [];
      const mesoPredList = Array.isArray(feedback?.predictions?.meso)
        ? feedback.predictions.meso
        : feedback?.predictions?.meso
          ? [feedback.predictions.meso]
          : [];
      const macroPredObj =
        feedback?.predictions?.macro &&
        typeof feedback.predictions.macro === "object"
          ? feedback.predictions.macro
          : {};

      const hasStructuredPredictionBlocks =
        microPredList.length > 0 ||
        mesoPredList.length > 0 ||
        Object.keys(macroPredObj).length > 0;

      const hasStructuredModelOutputs = Object.values({
        micro: modelOutputs.micro_lstm?.output,
        meso: modelOutputs.meso_lstm?.output,
        macro: modelOutputs.macro_lstm?.output,
      }).some((output) => output && Object.keys(output).length > 0);

      const hasLiveAnalysis = Object.keys(liveAnalysis || {}).length > 0;
      const isStaleFeedback = Boolean(feedback.stale);

      if (
        !hasStructuredPredictionBlocks &&
        !hasStructuredModelOutputs &&
        !hasLiveAnalysis &&
        !hasNextQuestionSignals &&
        isStaleFeedback
      ) {
        return;
      }

      const hasMicroOutput =
        Boolean(modelOutputs.micro_lstm?.output) &&
        Object.keys(modelOutputs.micro_lstm.output || {}).length > 0;
      const hasMesoOutput =
        Boolean(modelOutputs.meso_lstm?.output) &&
        Object.keys(modelOutputs.meso_lstm.output || {}).length > 0;
      const hasMacroOutput =
        Boolean(modelOutputs.macro_lstm?.output) &&
        Object.keys(modelOutputs.macro_lstm.output || {}).length > 0;

      setModelTrainingStatus({
        micro:
          Boolean(readyMap.micro) || hasMicroOutput || microPredList.length > 0,
        meso:
          Boolean(readyMap.meso) || hasMesoOutput || mesoPredList.length > 0,
        macro:
          Boolean(readyMap.macro) ||
          hasMacroOutput ||
          Object.keys(macroPredObj).length > 0,
      });

      const hasMicroData =
        hasMicroOutput ||
        microPredList.length > 0 ||
        Number(liveAnalysis.retention_score || 0) > 0;
      const hasMesoData =
        hasMesoOutput ||
        mesoPredList.length > 0 ||
        Number(liveAnalysis.subject_retention_score || 0) > 0;
      const hasMacroData =
        hasMacroOutput ||
        Object.keys(macroPredObj).length > 0 ||
        Number(liveAnalysis.predicted_long_term_retention_score || 0) > 0;

      const readyCount = [hasMicroData, hasMesoData, hasMacroData].filter(
        Boolean,
      ).length;

      const isReady =
        (readyMap.micro && readyMap.meso && readyMap.macro) ||
        (hasMicroData && hasMesoData && hasMacroData) ||
        readyCount >= 2;
      setAnalysisReady(isReady);

      setAnalysisMeta({
        ...sequenceStatus,
        micro_required_windows:
          trainingNeeded?.models?.micro?.min_required || 20,
      });

      // ===== Micro LSTM Outputs =====
      const micro = modelOutputs.micro_lstm?.output || {};
      const microPred = microPredList[0] || null;
      const repeatInDays =
        micro.repeat_in_days ?? microPred?.repeat_in_days ?? 1;
      const difficultyFromRepeat =
        repeatInDays === 0
          ? 1
          : repeatInDays === 1
            ? 2
            : repeatInDays === 3
              ? 3
              : repeatInDays === 7
                ? 4
                : 5;

      setMicroLSTM((prev) => {
        const retentionCandidate = firstDefined(
          liveAnalysis.retention_score,
          liveAnalysis.current_retention,
          micro.retention_probability_topic,
          micro.retention_probability,
          micro.current_retention,
          micro.retention_score,
          microPred?.retention_probability,
          microPred?.current_retention,
          microFromNextQuestion.expectedRetention,
        );

        const difficultyCandidate = firstDefined(
          micro.next_question_difficulty,
          microPred?.next_question_difficulty,
          difficultyFromRepeat,
        );

        const probNextCandidate = firstDefined(
          liveAnalysis.probability_next_correct_attempt,
          micro.probability_correct_next_attempt,
          micro.probability_correct_next,
          microPred?.probability_correct_next,
          micro.next_retention,
          microPred?.next_retention,
        );

        const stressCandidate = firstDefined(
          micro.stress_impact,
          microPred?.stress_impact,
          stressFatigueBurnout?.current_stress,
          microFromNextQuestion.stressImpact,
        );

        const fatigueCandidate = firstDefined(
          micro.fatigue_prediction,
          micro.fatigue_level,
          microPred?.fatigue_level,
          stressFatigueBurnout?.current_fatigue,
          microFromNextQuestion.fatigueLevel,
        );

        const repeatInDaysCandidate = firstDefined(
          liveAnalysis?.planned_revision?.after_days,
          repeatInDays,
          prev.repeatInDays,
        );

        const batchTypeCandidate = firstDefined(
          micro.batch_type,
          microPred?.batch_type,
          prev.batchType,
          "medium_term",
        );

        return {
          retentionProbability: toRatio(
            retentionCandidate,
            prev.retentionProbability,
          ),
          nextQuestionDifficulty: Number(
            firstDefined(difficultyCandidate, prev.nextQuestionDifficulty, 3),
          ),
          probabilityCorrectNext: toRatio(
            probNextCandidate,
            prev.probabilityCorrectNext,
          ),
          stressImpact: toRatio(stressCandidate, prev.stressImpact),
          fatigueLevel: toRatio(fatigueCandidate, prev.fatigueLevel),
          repeatInDays: Number(
            firstDefined(repeatInDaysCandidate, prev.repeatInDays, 1),
          ),
          batchType: String(batchTypeCandidate || "medium_term"),
        };
      });

      // ===== Meso LSTM Outputs =====
      const meso = modelOutputs.meso_lstm?.output || {};
      const mesoPred = mesoPredList;
      const meso7 = Number(
        meso.subject_retention_7d ??
          (mesoPred.length
            ? mesoPred.reduce(
                (sum, item) => sum + Number(item?.retention_7d || 0),
                0,
              ) / mesoPred.length
            : 0),
      );
      const meso30 = Number(
        meso.subject_retention_30d ??
          (mesoPred.length
            ? mesoPred.reduce(
                (sum, item) => sum + Number(item?.retention_30d || 0),
                0,
              ) / mesoPred.length
            : 0),
      );
      const meso90 = Number(
        meso.subject_retention_90d ??
          (mesoPred.length
            ? mesoPred.reduce(
                (sum, item) => sum + Number(item?.retention_90d || 0),
                0,
              ) / mesoPred.length
            : 0),
      );

      setMesoLSTM((prev) => {
        const nextPriorityFromOutput = Array.isArray(
          meso.next_topic_revision_priority,
        )
          ? meso.next_topic_revision_priority
              .map((t) => t?.topic_id || t?.topic)
              .filter(Boolean)
          : [];

        const nextPriorityFromPred = mesoPred
          .slice(0, 3)
          .map((t) => t?.topic_id || t?.topic)
          .filter(Boolean);

        const nextPriority =
          nextPriorityFromOutput.length > 0
            ? nextPriorityFromOutput
            : nextPriorityFromPred.length > 0
              ? nextPriorityFromPred
              : prev.nextTopicRevisionPriority;

        const intervalCandidate = firstDefined(
          liveAnalysis?.optimal_revision_plan?.days_until_next_revision,
          meso.optimal_revision_interval_days,
          mesoPred.length
            ? Math.round(
                mesoPred.reduce(
                  (sum, item) =>
                    sum +
                    Number(item?.chapter_repeat_plan?.next_review_days || 7),
                  0,
                ) / mesoPred.length,
              )
            : undefined,
        );

        return {
          subjectRetentionScore: toRatio(
            firstDefined(
              liveAnalysis.subject_retention_score,
              meso.subject_retention_score,
              meso7,
            ),
            prev.subjectRetentionScore,
          ),
          nextTopicRevisionPriority: nextPriority,
          optimalRevisionIntervalDays: Number(
            firstDefined(
              intervalCandidate,
              prev.optimalRevisionIntervalDays,
              7,
            ),
          ),
          retention7d: toRatio(meso7, prev.retention7d),
          retention30d: toRatio(meso30, prev.retention30d),
          retention90d: toRatio(meso90, prev.retention90d),
          targetQuestions: Number(
            firstDefined(
              liveAnalysis?.optimal_revision_plan?.target_questions,
              prev.targetQuestions,
              8,
            ),
          ),
        };
      });

      // ===== Macro LSTM Outputs =====
      const macro = modelOutputs.macro_lstm?.output || {};
      const macroPred = macroPredObj;
      const weeklyStructure =
        macro.optimal_daily_study_schedule || macroPred.weekly_structure || {};
      setMacroLSTM((prev) => {
        const nextSchedule = [
          weeklyStructure.revision_days?.[0],
          weeklyStructure.revision_days?.[1],
          weeklyStructure.revision_days?.[2],
        ].filter(Boolean);

        const nextPriorityOrder = Array.isArray(macro.subject_priority_order)
          ? macro.subject_priority_order
          : Array.isArray(liveAnalysis.subject_priority_order)
            ? liveAnalysis.subject_priority_order
            : Array.isArray(prev.subjectPriorityOrder)
              ? prev.subjectPriorityOrder
              : ["english", "gk"];

        return {
          optimalDailyStudySchedule:
            nextSchedule.length > 0
              ? nextSchedule
              : prev.optimalDailyStudySchedule,
          subjectPriorityOrder: nextPriorityOrder,
          predictedLongTermRetentionScore: toRatio(
            firstDefined(
              liveAnalysis.predicted_long_term_retention_score,
              macro.predicted_long_term_retention_score,
              macroPred.projected_retention,
            ),
            prev.predictedLongTermRetentionScore,
          ),
          fatigueRiskProbability: toRatio(
            firstDefined(
              liveAnalysis.fatigue_risk_probability,
              macro.fatigue_risk_probability,
              macroPred.burnout_risk,
            ),
            prev.fatigueRiskProbability,
          ),
          burnoutStatus: String(
            firstDefined(
              stressFatigueBurnout?.burnout_status,
              prev.burnoutStatus,
              "low",
            ),
          ),
          recommendedBreakMinutes: Number(
            firstDefined(
              stressFatigueBurnout?.recommended_break_minutes,
              prev.recommendedBreakMinutes,
              10,
            ),
          ),
          optimalDailyMinutes: Number(
            firstDefined(
              macroPred.optimal_daily_minutes,
              prev.optimalDailyMinutes,
              60,
            ),
          ),
          weeklyStructure:
            Object.keys(weeklyStructure || {}).length > 0
              ? weeklyStructure
              : prev.weeklyStructure,
        };
      });

      // Update stress/fatigue from dedicated endpoint if available
      if (stressFatigueBurnout) {
        setMicroLSTM((prev) => ({
          ...prev,
          stressImpact: toRatio(
            stressFatigueBurnout.current_stress ?? prev.stressImpact,
          ),
          fatigueLevel: toRatio(
            stressFatigueBurnout.current_fatigue ?? prev.fatigueLevel,
          ),
        }));
      }
    },
    [firstDefined, toRatio],
  );

  const applySocketAnalytics = useCallback(
    (payload) => {
      if (!payload?.analytics) return;
      setMetrics((prev) => ({
        ...prev,
        overallAccuracy: toPercent(
          payload.analytics.currentAccuracy ??
            payload.analytics.current_accuracy ??
            prev.overallAccuracy ??
            0,
        ),
        recentAccuracy: toPercent(
          payload.analytics.recentAccuracy ??
            payload.analytics.recent_accuracy ??
            prev.recentAccuracy ??
            0,
        ),
        questionsAnswered: Number(
          payload.analytics.questionsAnswered ??
            payload.analytics.questions_answered ??
            prev.questionsAnswered ??
            0,
        ),
        correctAnswers: Number(
          payload.analytics.correctAnswers ??
            payload.analytics.correct_answers ??
            prev.correctAnswers ??
            0,
        ),
        averageResponseTime: Number(
          payload.analytics.averageResponseTime ??
            payload.analytics.average_response_time ??
            prev.averageResponseTime ??
            0,
        ),
        currentStreak: Number(
          payload.analytics.currentStreak ??
            payload.analytics.current_streak ??
            prev.currentStreak ??
            0,
        ),
      }));

      setMicroLSTM((prev) => ({
        ...prev,
        stressImpact: toRatio(
          payload.analytics.averageStress ?? prev.stressImpact ?? 0.3,
        ),
        fatigueLevel: toRatio(
          payload.analytics.averageFatigue ?? prev.fatigueLevel ?? 0.3,
        ),
      }));
    },
    [toPercent, toRatio],
  );

  const completeAndNavigate = useCallback(
    async (sessionIdToClose) => {
      if (
        !sessionIdToClose ||
        isFinishingSession ||
        completionLockRef.current
      ) {
        return;
      }

      completionLockRef.current = true;
      try {
        setIsFinishingSession(true);
        let completionResult =
          await retentionService.completeSession(sessionIdToClose);

        if (!completionResult?.success) {
          const detailsText = String(completionResult?.details || "");
          const retryMatch = detailsText.match(/retry\s+in\s+(\d+)s/i);
          const retrySeconds = retryMatch ? Number(retryMatch[1]) : 0;

          if (retrySeconds > 0 && retrySeconds <= 25) {
            setError(
              `Flask finalization cooling down. Retrying in ${retrySeconds}s...`,
            );
            await new Promise((resolve) =>
              setTimeout(resolve, (retrySeconds + 1) * 1000),
            );
            completionResult =
              await retentionService.completeSession(sessionIdToClose);
          }
        }

        if (!completionResult?.success) {
          const attemptsLabel = completionResult?.attempts
            ? ` (attempts: ${completionResult.attempts})`
            : "";
          const details = completionResult?.details
            ? ` ${completionResult.details}`
            : "";
          setError(
            `${completionResult?.error || "Could not finalize session on all services."}${attemptsLabel}${details}`,
          );
          return;
        }

        if (completionResult?.pending) {
          setError(
            "Session is completed. Final analytics synchronization is still running in background.",
          );
        }

        localStorage.removeItem(runtimeKey(sessionIdToClose));
        localStorage.removeItem(retentionQueueKey(sessionIdToClose));
        localStorage.removeItem(ACTIVE_SESSION_KEY);
        navigate("/retention/analytics", {
          state: {
            sessionId: sessionIdToClose,
            config: stateConfig,
            queueArchive: retentionArchiveRows,
          },
        });
      } catch (err) {
        setError(
          String(err?.message || "Session completion failed. Please retry."),
        );
      } finally {
        setIsFinishingSession(false);
        completionLockRef.current = false;
      }
    },
    [isFinishingSession, navigate, retentionArchiveRows, stateConfig],
  );

  // ==================== Session Management ====================

  /**
   * Load next question in the session
   */
  const releaseDueRetentionQueue = useCallback(async () => {
    if (!retentionRows.length) {
      return { attempted: 0, scheduled: 0 };
    }

    const now = Date.now();
    const scheduleStaleMs = 45000;

    const dueRows = dedupeRetentionRows(retentionRows).filter((row) => {
      if (!row?.needsRetention) return false;
      const questionKey = getQueueQuestionKey(row);
      if (!questionKey) return false;

      const dueAtMs = toQueueMs(row?.nextRepeatAt);
      if (!(dueAtMs > 0 && dueAtMs <= now)) return false;

      const retryAtMs = Number(queueRetryAtRef.current.get(questionKey) || 0);
      if (retryAtMs > now) return false;

      if (row?.queueStatus !== "scheduled") return true;

      const scheduledAtMs = toQueueMs(row?.scheduledAt);
      const staleSinceDueMs = now - dueAtMs;
      const staleSinceScheduledMs = scheduledAtMs > 0 ? now - scheduledAtMs : 0;

      return (
        staleSinceDueMs >= scheduleStaleMs ||
        staleSinceScheduledMs >= scheduleStaleMs
      );
    });

    if (dueRows.length === 0) {
      return { attempted: 0, scheduled: 0 };
    }

    const orderedDueRows = [...dueRows].sort(
      (a, b) =>
        toQueueMs(a?.nextRepeatAt) - toQueueMs(b?.nextRepeatAt) ||
        Number(a?.retentionScore || 0) - Number(b?.retentionScore || 0),
    );

    const candidate = orderedDueRows[0] || null;
    if (!candidate) {
      return { attempted: 0, scheduled: 0 };
    }

    const questionKey = getQueueQuestionKey(candidate);
    if (!questionKey) {
      return { attempted: dueRows.length, scheduled: 0 };
    }

    if (queueScheduleInFlightRef.current.has(questionKey)) {
      return { attempted: dueRows.length, scheduled: 0 };
    }

    const retryAtMs = Number(queueRetryAtRef.current.get(questionKey) || 0);
    if (retryAtMs > Date.now()) {
      return { attempted: dueRows.length, scheduled: 0 };
    }

    queueScheduleInFlightRef.current.add(questionKey);
    let scheduled = false;

    try {
      const scheduleResponse = await retentionService.scheduleQuestion(
        questionKey,
        "immediate",
        new Date().toISOString(),
      );

      if (!scheduleResponse?.success) {
        if (Number(scheduleResponse?.status || 0) === 429) {
          const retryAfterMs = Math.max(
            1500,
            Number(scheduleResponse?.retryAfterMs || 5000),
          );
          queueRetryAtRef.current.set(questionKey, Date.now() + retryAfterMs);
        }
      } else {
        queueRetryAtRef.current.delete(questionKey);
        scheduledQueueRowsRef.current.add(questionKey);

        setRetentionRows((prev) =>
          dedupeRetentionRows(
            (Array.isArray(prev) ? prev : []).map((entry) => {
              const entryKey = getQueueQuestionKey(entry);
              if (entryKey !== questionKey) return entry;
              const wasScheduled = entry?.queueStatus === "scheduled";
              return {
                ...entry,
                queueStatus: "scheduled",
                scheduledSpecial: true,
                needsRetention: true,
                retentionTag: wasScheduled
                  ? "Escalated Repeat"
                  : "Queued for Repeat",
                specialTag: wasScheduled
                  ? "Escalated Repeat"
                  : "Queued for Repeat",
                specialColor: wasScheduled ? "rose" : "sky",
                scheduledAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
            }),
          ),
        );

        if (currentSessionId) {
          retentionService.requestQueueState(currentSessionId);
        }
        scheduled = true;
      }
    } catch {
      queueRetryAtRef.current.set(questionKey, Date.now() + 3000);
    } finally {
      queueScheduleInFlightRef.current.delete(questionKey);
    }

    return {
      attempted: dueRows.length,
      scheduled: scheduled ? 1 : 0,
    };
  }, [
    currentSessionId,
    dedupeRetentionRows,
    getQueueQuestionKey,
    retentionRows,
    toQueueMs,
  ]);

  const persistServedQuestionIds = useCallback((sessionId) => {
    if (!sessionId) return;
    try {
      const servedIds = Array.from(servedQuestionIdsRef.current);
      localStorage.setItem(
        servedQuestionIdsKey(sessionId),
        JSON.stringify(servedIds),
      );
      if (servedIds.length > 0) {
        localStorage.setItem(
          servedQuestionIdsBackupKey(sessionId),
          JSON.stringify(servedIds),
        );
      }
    } catch {
      // Ignore localStorage write failures.
    }
  }, []);

  const isQuestionManagedByRetentionQueue = useCallback(
    (questionId) => {
      const key = String(questionId || "").trim();
      if (!key) return false;

      if (scheduledQueueRowsRef.current.has(key)) return true;

      const inQueue = (Array.isArray(retentionRows) ? retentionRows : []).some(
        (row) => getQueueQuestionKey(row) === key,
      );
      if (inQueue) return true;

      return (
        Array.isArray(retentionArchiveRows) ? retentionArchiveRows : []
      ).some((row) => {
        if (getQueueQuestionKey(row) !== key) return false;
        return Number(row?.queueEntryCount || row?.repeatsDone || 0) > 0;
      });
    },
    [getQueueQuestionKey, retentionArchiveRows, retentionRows],
  );

  const loadNextQuestion = async ({ fromNextButton = false } = {}) => {
    if (loadNextInFlightRef.current) return;
    loadNextInFlightRef.current = true;

    try {
      clearAutoAdvanceTimers();
      setLoadingNext(true);
      setError("");
      setResult(null);

      const nowMs = Date.now();
      const dueQueueExists = dedupeRetentionRows(retentionRows).some((row) => {
        if (!row?.needsRetention || row?.queueStatus === "retired")
          return false;
        const dueAtMs = toQueueMs(row?.nextRepeatAt);
        return dueAtMs > 0 && dueAtMs <= nowMs;
      });

      if (fromNextButton || dueQueueExists) {
        await releaseDueRetentionQueue();
      }

      const response = await retentionService.getNextQuestion(
        currentSessionId,
        {
          forceRest: true,
          currentStress: microLSTM.stressImpact,
          currentFatigue: microLSTM.fatigueLevel,
        },
      );

      if (!response.success) {
        if ((response.error || "").toLowerCase().includes("completed")) {
          await completeAndNavigate(currentSessionId);
          return;
        }
        throw new Error(response.error || "Unable to fetch next question");
      }

      if (response.sessionComplete) {
        await completeAndNavigate(currentSessionId);
        return;
      }

      if (response.predictions && typeof response.predictions === "object") {
        processModelOutputs({ predictions: response.predictions });
      }

      if (!response.question) {
        // One soft retry (REST-forced) before surfacing recoverable error.
        const retryResponse = await retentionService.getNextQuestion(
          currentSessionId,
          {
            currentStress: microLSTM.stressImpact,
            currentFatigue: microLSTM.fatigueLevel,
            forceRest: true,
          },
        );

        if (!retryResponse.success) {
          throw new Error(
            retryResponse.error || "Unable to fetch next question",
          );
        }

        if (retryResponse.sessionComplete) {
          await completeAndNavigate(currentSessionId);
          return;
        }

        if (!retryResponse.question) {
          setError(
            "Next question is not ready yet. Please try again in a few seconds.",
          );
          return;
        }

        response.question = retryResponse.question;
        response.questionNumber = retryResponse.questionNumber;
      } else {
        // Keep original response question.
      }

      let nextQuestion = normalizeQuestionShape(response.question);
      let nextQuestionNumber = response.questionNumber;
      const shouldPrioritizeQueue = dueQueueExists;

      // Prefer unseen fresh questions; if backend returns duplicates repeatedly,
      // still accept one to avoid blocking the session UI after refresh.
      // When queue rows are due, prefer queue-managed questions first.
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const nextQuestionId = resolveQuestionId(nextQuestion);
        if (!nextQuestionId) break;

        const alreadyServed = servedQuestionIdsRef.current.has(nextQuestionId);
        const queueManaged = isQuestionManagedByRetentionQueue(nextQuestionId);

        const needsQueuePriority = shouldPrioritizeQueue && !queueManaged;
        const needsDuplicateRecovery = alreadyServed && !queueManaged;

        if (!needsQueuePriority && !needsDuplicateRecovery) break;

        const replacement = await retentionService.getNextQuestion(
          currentSessionId,
          {
            forceRest: true,
            currentStress: microLSTM.stressImpact,
            currentFatigue: microLSTM.fatigueLevel,
          },
        );

        if (!replacement?.success) {
          break;
        }

        if (replacement.sessionComplete) {
          await completeAndNavigate(currentSessionId);
          return;
        }

        if (!replacement.question) {
          break;
        }

        nextQuestion = normalizeQuestionShape(replacement.question);
        nextQuestionNumber = replacement.questionNumber;
      }

      const acceptedQuestionId = resolveQuestionId(nextQuestion);
      if (acceptedQuestionId) {
        const alreadyServed =
          servedQuestionIdsRef.current.has(acceptedQuestionId);
        const queueManaged =
          isQuestionManagedByRetentionQueue(acceptedQuestionId);
        if (alreadyServed && !queueManaged) {
          // Do not deadlock the page when backend repeatedly serves a duplicate non-queue question.
          // We normalize by allowing this question and resetting duplicate lock for this id.
          servedQuestionIdsRef.current.delete(acceptedQuestionId);
          persistServedQuestionIds(currentSessionId);
        }
      }

      setCurrentQuestion(nextQuestion);
      setQuestionIndex((prev) => nextQuestionNumber || prev + 1);
      if (acceptedQuestionId) {
        servedQuestionIdsRef.current.add(acceptedQuestionId);
        persistServedQuestionIds(currentSessionId);
      }

      setSelectedAnswer(null);
      setAnswerChanges(0);
      setHasAnsweredCurrent(false);
      setResult(null);
      submitLockRef.current = false;
      lastSubmittedQuestionRef.current = null;
      questionStartRef.current = Date.now();
      setQuestionElapsedSec(0);

      localStorage.setItem(
        runtimeKey(currentSessionId),
        JSON.stringify({
          sessionStartMs: sessionStartMsRef.current,
          questionStartMs: questionStartRef.current,
          updatedAt: Date.now(),
        }),
      );
    } catch (err) {
      const message = String(err?.message || "");
      const isTransientError =
        /timeout|network|fetch|socket/i.test(message) ||
        message.includes("ECONN") ||
        message.includes("ERR_");

      setError(
        isTransientError
          ? "Connection was interrupted while loading the next question. Please click Next Question again."
          : message || "Failed to load next question.",
      );
    } finally {
      loadNextInFlightRef.current = false;
      setLoadingNext(false);
    }
  };

  const startAutoAdvanceToNext = useCallback(() => {
    clearAutoAdvanceTimers();
    setAutoAdvanceSecondsLeft(5);

    autoAdvanceIntervalRef.current = window.setInterval(() => {
      setAutoAdvanceSecondsLeft((prev) => {
        if (prev <= 1) {
          if (autoAdvanceIntervalRef.current) {
            window.clearInterval(autoAdvanceIntervalRef.current);
            autoAdvanceIntervalRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    autoAdvanceTimeoutRef.current = window.setTimeout(() => {
      autoAdvanceTimeoutRef.current = null;
      loadNextQuestion({ fromNextButton: true });
    }, 5000);
  }, [clearAutoAdvanceTimers, loadNextQuestion]);

  // ==================== Answer Submission ====================

  /**
   * Submit current answer with all required features
   */
  const submitCurrentAnswer = async ({
    overrideAnswer = null,
    autoAdvanceAfterSubmit = false,
  } = {}) => {
    const currentQuestionId = resolveQuestionId(currentQuestion);
    const currentSubmitKey = buildQuestionSubmitKey(
      currentQuestion,
      questionIndex,
    );
    const answerToSubmit =
      overrideAnswer !== null && overrideAnswer !== undefined
        ? overrideAnswer
        : selectedAnswer;

    if (!currentQuestion) {
      setError("Question is not ready yet. Please wait for the next question.");
      return;
    }
    if (!currentQuestionId) {
      try {
        const recovered = await retentionService.getNextQuestion(
          currentSessionId,
          {
            forceRest: true,
            currentStress: microLSTM.stressImpact,
            currentFatigue: microLSTM.fatigueLevel,
          },
        );

        if (recovered?.success && recovered?.question) {
          setCurrentQuestion(normalizeQuestionShape(recovered.question));
          setQuestionIndex((prev) => recovered.questionNumber || prev + 1);
          setSelectedAnswer(null);
          setHasAnsweredCurrent(false);
          submitLockRef.current = false;
          lastSubmittedQuestionRef.current = null;
          setError(
            "Question context was out of sync and has been refreshed. Please answer this question again and submit.",
          );
          return;
        }
      } catch {
        // Keep the user-facing error below.
      }

      setError(
        "Could not resolve question reference. Please click Next Question to continue.",
      );
      submitLockRef.current = false;
      return;
    }
    if (answerToSubmit === null || paused || hasAnsweredCurrent) return;
    if (isSubmitting || submitLockRef.current) {
      setError("Submission is in progress. Please wait a moment.");
      return;
    }
    if (lastSubmittedQuestionRef.current === currentSubmitKey) {
      setError(
        "This question was already submitted. Please load the next question.",
      );
      return;
    }

    try {
      submitLockRef.current = true;
      setIsSubmitting(true);
      setError("");

      const responseTimeMs = Date.now() - questionStartRef.current;
      const topicAccuracy = metrics.overallAccuracy / 100 || 0.5;
      const topicAttempts = metrics.questionsAnswered || 1;

      // Determine if answer is correct
      const isCorrect = isAnswerCorrect(
        answerToSubmit,
        currentQuestion.correctAnswer,
      );

      // Update hint usage based on time and changes
      const usedHint =
        responseTimeMs > currentQuestion.expectedTime * 1000 * 1.5 ||
        answerChanges >= 3;

      // Compute Micro LSTM features
      const microFeatures = computeMicroFeatures({
        responseTimeMs,
        expectedTimeSec: currentQuestion.expectedTime,
        answerChangesCount: answerChanges,
        totalFocusLoss: focusLossCount,
        isCorrect,
        topicAccuracy,
        topicAttempts,
        sessionElapsed: sessionElapsedSec,
        answered: metrics.questionsAnswered,
        difficulty: Number(currentQuestion.difficulty || 3),
        confidence: confidenceRating / 5,
      });

      const lstmPayload = buildLstmPayload({
        microFeatures,
        responseTimeMs,
        isCorrect,
        usedHint,
      });

      const answerPayload = {
        selectedOptions: answerToSubmit,
        responseTimeMs,
        hesitationCount: answerChanges,
        confidence: confidenceRating / 5,
        stressLevel: microFeatures.retentionProbability * 0.3 + 0.2,
        fatigueIndex: microFeatures.retentionProbability * 0.2 + 0.2,
        focusScore: 1 - microFeatures.retentionProbability * 0.3,
        answerChanges,
        topicCategory: currentQuestion.topicCategory || currentQuestion.topic,
        topicId: currentQuestion.topicCategory || currentQuestion.topic,
        difficulty: Number(currentQuestion.difficulty || 3),
        subject: activeSubjectKey,
        topic: currentQuestion.topicCategory || currentQuestion.topic,
        hint_used: usedHint,
        confidence_rating: Math.max(
          1,
          Math.min(5, Math.round(confidenceRating)),
        ),
        session_start_time: sessionStartRef.current,
        device_focus_loss_event: focusLossCount > 0,

        // Include all computed features for backend
        ...lstmPayload,
        retention_probability: microFeatures.retentionProbability,
        probability_correct_next: microFeatures.probabilityCorrectNext,
        next_question_difficulty: microFeatures.nextDifficulty,
        client_generated_at: new Date().toISOString(),
      };

      const response = await retentionService.submitAnswer(
        currentSessionId,
        currentQuestionId || null,
        answerPayload,
      );

      if (!response.success) {
        const submitError = new Error(
          response.error || "Unable to submit answer",
        );
        submitError.code = response.code || null;
        submitError.status = response.status || null;
        submitError.retryAfterMs = response.retryAfterMs || null;
        submitError.currentQuestion = response.currentQuestion || null;
        submitError.expectedQuestionId = response.expectedQuestionId || null;
        submitError.receivedQuestionId = response.receivedQuestionId || null;
        throw submitError;
      }

      setResult(response);
      setHasAnsweredCurrent(true);
      setSelectedAnswer(answerToSubmit);
      lastSubmittedQuestionRef.current = currentSubmitKey;

      const reviewInfo =
        response?.retentionReview || currentQuestion?.retentionReview || {};
      const reviewMetrics = reviewInfo?.flaskMetrics || {};
      const dueAtRaw = reviewInfo?.dueAt || reviewMetrics?.revisionAvailableAt;
      const dueAtDate = dueAtRaw ? new Date(dueAtRaw) : null;
      const repeatSeconds = Number(
        firstDefined(
          reviewMetrics?.repeatInSeconds,
          reviewMetrics?.timerFrameSeconds,
          Number(
            firstDefined(
              reviewMetrics?.repeatInDays,
              microLSTM.repeatInDays,
              1,
            ),
          ) * 86400,
        ),
      );
      const safeRepeatSeconds = pickNearestTimerFrameSec(repeatSeconds);
      const fallbackDueAt = new Date(
        Date.now() + Math.max(0, safeRepeatSeconds) * 1000,
      );
      const nextRepeatAt =
        dueAtDate && Number.isFinite(dueAtDate.getTime())
          ? dueAtDate.toISOString()
          : fallbackDueAt.toISOString();
      const retentionScore = Math.round(
        toPercent(
          firstDefined(
            reviewMetrics?.retentionProbability,
            microLSTM.retentionProbability,
            metrics.overallAccuracy,
          ),
        ),
      );
      const rowBatchType =
        reviewInfo?.batchType ||
        reviewMetrics?.reviewBatchType ||
        microLSTM.batchType ||
        "medium_term";
      const conceptMasteryScore = toRatio(
        firstDefined(
          reviewMetrics?.conceptMasteryScore,
          reviewMetrics?.concept_mastery_score,
          microFeatures?.features?.[7],
          retentionScore / 100,
        ),
        retentionScore / 100,
      );
      const needsRetention = rowBatchType !== "mastered" && retentionScore < 85;

      const newRow = normalizeQueueRow({
        id: String(currentQuestionId || currentSubmitKey),
        questionId: String(currentQuestionId || ""),
        questionText: String(
          currentQuestion.text || "Question text unavailable",
        ),
        optionsText: formatOptionsInline(currentQuestion.options || []),
        correctAnswerText: resolveCorrectAnswerLabel(
          response.correctAnswer,
          currentQuestion.options || [],
        ),
        nextRepeatAt,
        timerFrameSeconds: safeRepeatSeconds,
        timerFrameLabel: timerFrameLabelFromSec(safeRepeatSeconds),
        scheduledSpecial: false,
        specialTag: "",
        specialColor: "",
        scheduledAt: null,
        topicCategory: String(
          currentQuestion.topicCategory || currentQuestion.topic || "General",
        ),
        conceptMasteryScore,
        retentionScore,
        needsRetention,
        retentionTag:
          reviewInfo?.retentionTag || getBatchTypeLabel(rowBatchType),
        queueStatus: "pending",
        repeatsDone: 0,
        queueEntryCount: 0,
        firstQueuedAt: new Date().toISOString(),
        lastQueuedAt: new Date().toISOString(),
      });

      setRetentionRows((prev) => {
        const currentKey = String(currentQuestionId || "");
        const existingForQuestion = (Array.isArray(prev) ? prev : []).find(
          (row) => getQueueQuestionKey(row) === currentKey,
        );
        const archivedForQuestion = (
          Array.isArray(retentionArchiveRows) ? retentionArchiveRows : []
        ).find((row) => getQueueQuestionKey(row) === currentKey);
        const withoutCurrent = (Array.isArray(prev) ? prev : []).filter(
          (row) => getQueueQuestionKey(row) !== currentKey,
        );
        const wasQueued = Boolean(existingForQuestion);
        const historicalQueueEntries = Number(
          firstDefined(
            existingForQuestion?.queueEntryCount,
            archivedForQuestion?.queueEntryCount,
            existingForQuestion?.repeatsDone,
            archivedForQuestion?.repeatsDone,
            0,
          ),
        );
        const nextQueueEntryCount = historicalQueueEntries + 1;

        // Question has just been repeated now, clear any stale pending schedule lock.
        scheduledQueueRowsRef.current.delete(currentKey);
        queueScheduleInFlightRef.current.delete(currentKey);
        queueRetryAtRef.current.delete(currentKey);

        if (!newRow || !newRow.needsRetention) {
          if (wasQueued || historicalQueueEntries > 0) {
            setRetentionArchiveRows((archivePrev) => {
              const baseArchive = Array.isArray(archivePrev) ? archivePrev : [];
              const filtered = baseArchive.filter(
                (item) => getQueueQuestionKey(item) !== currentKey,
              );
              const archivedItem = {
                ...(archivedForQuestion || {}),
                ...(existingForQuestion || {}),
                ...(newRow || {}),
                questionId: currentKey,
                id: currentKey,
                repeatsDone: Math.max(0, historicalQueueEntries - 1),
                queueEntryCount: historicalQueueEntries,
                retiredReason: "retention_resolved",
                retiredAt: new Date().toISOString(),
                queueStatus: "completed",
              };
              return [archivedItem, ...filtered].slice(0, 120);
            });
          }
          return dedupeRetentionRows(withoutCurrent);
        }

        if (nextQueueEntryCount > MAX_RETENTION_REPEATS) {
          setRetentionArchiveRows((archivePrev) => {
            const baseArchive = Array.isArray(archivePrev) ? archivePrev : [];
            const filtered = baseArchive.filter(
              (item) => getQueueQuestionKey(item) !== currentKey,
            );
            const archivedItem = {
              ...(existingForQuestion || {}),
              ...(newRow || {}),
              questionId: currentKey,
              id: currentKey,
              repeatsDone: MAX_RETENTION_REPEATS,
              queueEntryCount: MAX_RETENTION_REPEATS,
              retiredReason: "max_repeat_reached",
              retiredAt: new Date().toISOString(),
              queueStatus: "retired",
            };
            return [archivedItem, ...filtered].slice(0, 120);
          });
          return dedupeRetentionRows(withoutCurrent);
        }

        const hydratedRow = {
          ...newRow,
          repeatsDone: Math.max(0, nextQueueEntryCount - 1),
          queueEntryCount: nextQueueEntryCount,
          firstQueuedAt:
            existingForQuestion?.firstQueuedAt || new Date().toISOString(),
          lastQueuedAt: new Date().toISOString(),
        };

        return dedupeRetentionRows([hydratedRow, ...withoutCurrent]);
      });

      // Update metrics
      if (response.currentMetrics) {
        setMetrics((prev) => ({
          ...prev,
          ...response.currentMetrics,
          overallAccuracy: toPercent(
            response.currentMetrics.overallAccuracy ??
              response.currentMetrics.accuracy ??
              prev.overallAccuracy ??
              0,
          ),
          recentAccuracy: toPercent(
            response.currentMetrics.recentAccuracy ??
              response.currentMetrics.recent_accuracy ??
              prev.recentAccuracy ??
              0,
          ),
          questionsAnswered: Number(
            response.currentMetrics.questionsAnswered ??
              response.currentMetrics.questions_answered ??
              prev.questionsAnswered ??
              0,
          ),
          correctAnswers: Number(
            response.currentMetrics.correctAnswers ??
              response.currentMetrics.correct_answers ??
              prev.correctAnswers ??
              0,
          ),
          averageResponseTime: Number(
            response.currentMetrics.averageResponseTime ??
              response.currentMetrics.average_response_time ??
              prev.averageResponseTime ??
              0,
          ),
          currentStreak: Number(
            response.currentMetrics.currentStreak ??
              response.currentMetrics.current_streak ??
              prev.currentStreak ??
              0,
          ),
        }));

        if (Number(response.currentMetrics.questionsAnswered || 0) >= 1) {
          setAnalysisReady(true);
        }
      }

      // Process model outputs from Flask
      processModelOutputs(response.flaskFeedback);

      if (response?.flaskFeedback?.stale) {
        retentionService
          .getFlaskLivePredictions(activeSubjectKey || null, currentSessionId)
          .then((liveResponse) => {
            if (!liveResponse?.success) return;
            processModelOutputs({
              predictions: liveResponse.predictions || {},
              modelOutputs: liveResponse.modelOutputs || {},
              modelsReady: liveResponse.modelsReady || {},
              trainingNeeded: liveResponse.trainingNeeded || {},
              sequenceStatus: liveResponse.sequenceStatus || {},
              liveAnalysis: liveResponse.liveAnalysis || {},
            });
          })
          .catch(() => {
            // Keep UI stable if live refresh fails.
          });
      }

      // Update streaks
      if (response.isCorrect) {
        setWrongStreak(0);
        setHintUsed(false);
      } else {
        setWrongStreak((prev) => prev + 1);
      }

      // Update confidence based on result
      setConfidenceRating((prev) =>
        response.isCorrect ? Math.min(5, prev + 0.5) : Math.max(1, prev - 0.5),
      );

      if (response.sessionComplete) {
        setResult((prev) => ({
          ...prev,
          explanation:
            (prev?.explanation ? `${prev.explanation} ` : "") +
            "Section complete. Click Next Question to continue.",
        }));
      } else if (autoAdvanceAfterSubmit) {
        startAutoAdvanceToNext();
      }
    } catch (err) {
      const msg = String(err?.message || "");
      const isQuestionSyncError =
        /questionId is required/i.test(msg) ||
        err?.code === "QUESTION_CONTEXT_OUT_OF_SYNC" ||
        /out of sync/i.test(msg);

      if (isQuestionSyncError) {
        if (err?.currentQuestion && typeof err.currentQuestion === "object") {
          setCurrentQuestion(normalizeQuestionShape(err.currentQuestion));
          setSelectedAnswer(null);
          setHasAnsweredCurrent(false);
          setResult(null);
          setAnswerChanges(0);
          lastSubmittedQuestionRef.current = null;
          setError(
            "Question context was out of sync and has been refreshed. Please answer this question again and submit.",
          );
          submitLockRef.current = false;
          return;
        }

        try {
          const recovered = await retentionService.getNextQuestion(
            currentSessionId,
            {
              forceRest: true,
              currentStress: microLSTM.stressImpact,
              currentFatigue: microLSTM.fatigueLevel,
            },
          );
          if (recovered?.success && recovered?.question) {
            setCurrentQuestion(normalizeQuestionShape(recovered.question));
            setQuestionIndex((prev) => recovered.questionNumber || prev + 1);
            setSelectedAnswer(null);
            setHasAnsweredCurrent(false);
            setResult(null);
            setAnswerChanges(0);
            lastSubmittedQuestionRef.current = null;
            setError(
              "Question context was out of sync and has been refreshed. Please answer this question again and submit.",
            );
          } else {
            setError("Question sync failed. Please click Next Question.");
          }
        } catch {
          setError("Question sync failed. Please click Next Question.");
        }
      } else {
        const isRateLimited =
          Number(err?.status || 0) === 429 ||
          /\b429\b|too many requests/i.test(msg);

        if (isRateLimited) {
          const retryAfterMs = Math.max(
            1000,
            Number(err?.retryAfterMs || 2000),
          );
          setError(
            `Too many requests right now. Please wait ${Math.ceil(retryAfterMs / 1000)}s and submit again.`,
          );
          submitLockRef.current = false;
          return;
        }

        setError(msg || "Failed to submit answer.");
      }
      submitLockRef.current = false;
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==================== UI Event Handlers ====================

  const selectOption = (value) => {
    if (result || hasAnsweredCurrent) return;
    if (selectedAnswer !== null && selectedAnswer !== value) {
      setAnswerChanges((prev) => prev + 1);
    }
    setSelectedAnswer(value);

    if (isFocusMode && !paused && !isSubmitting && !loadingNext) {
      submitCurrentAnswer({
        overrideAnswer: value,
        autoAdvanceAfterSubmit: true,
      });
    }
  };

  const toggleHint = () => {
    if (hasAnsweredCurrent || isSubmitting) return;
    setHintUsed(true);
    setConfidenceRating((prev) => Math.max(1, prev - 0.5));
  };

  useEffect(() => {
    try {
      localStorage.setItem(RETENTION_THEME_KEY, isDarkMode ? "dark" : "light");
    } catch {
      // Ignore localStorage write failures.
    }
  }, [isDarkMode]);

  const toggleFocusMode = useCallback(async () => {
    const panelEl = focusPanelRef.current;
    if (!panelEl || typeof document === "undefined") return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      if (typeof panelEl.requestFullscreen === "function") {
        await panelEl.requestFullscreen();
      }
    } catch {
      // Ignore fullscreen API errors (browser/permissions/user gesture constraints).
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const handleFullscreenChange = () => {
      setIsFocusMode(document.fullscreenElement === focusPanelRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!isFocusMode) return;
    setAnalyticsOpen(false);
  }, [isFocusMode]);

  useEffect(() => {
    if (!isFocusMode) {
      clearAutoAdvanceTimers();
    }
  }, [clearAutoAdvanceTimers, isFocusMode]);

  const submitSessionAndViewAnalytics = async () => {
    if (
      !currentSessionId ||
      isFinishingSession ||
      isSubmitting ||
      loadingNext
    ) {
      return;
    }

    setIsSubmitDialogOpen(true);
  };

  const confirmSubmitSession = async () => {
    if (!currentSessionId) return;
    setIsSubmitDialogOpen(false);
    await completeAndNavigate(currentSessionId);
  };

  // ==================== Effects ====================

  // Timer effect
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Enter" && event.target?.tagName !== "TEXTAREA") {
        event.preventDefault();
      }
      if (event.key === "Escape" && isSubmitDialogOpen) {
        setIsSubmitDialogOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isSubmitDialogOpen]);

  useEffect(() => {
    return () => {
      clearAutoAdvanceTimers();
    };
  }, [clearAutoAdvanceTimers]);

  // Session initialization
  useEffect(() => {
    let cancelled = false;

    const ensureSessionContext = async () => {
      setSessionBootstrapReady(false);

      if (!studentId) {
        if (!cancelled) setSessionBootstrapReady(true);
        return;
      }

      const token = authService.getToken();
      retentionService.disconnectSocket();
      retentionService.initialize(studentId, true);
      if (token) retentionService.setAuthToken(token);

      const activeSessionId =
        session?.sessionId ||
        stateSession?.sessionId ||
        persistedActiveSession?.sessionId;

      if (!activeSessionId) {
        if (!cancelled) setSessionBootstrapReady(true);
        navigate("/retention/start");
        return;
      }

      const liveSessionResponse =
        await retentionService.getSession(activeSessionId);

      if (!liveSessionResponse.success || !liveSessionResponse.session) {
        const msg = String(liveSessionResponse.error || "").toLowerCase();
        if (msg.includes("not found")) {
          localStorage.removeItem(ACTIVE_SESSION_KEY);
          localStorage.removeItem(runtimeKey(activeSessionId));
          navigate("/retention/start");
        } else {
          if (!cancelled) {
            setError(
              "Could not reconnect session right now. Please wait or refresh once.",
            );
          }
        }
        if (!cancelled) setSessionBootstrapReady(true);
        return;
      }

      const liveSession = liveSessionResponse.session;
      if (liveSession.status === "completed") {
        localStorage.removeItem(runtimeKey(liveSession.sessionId));
        localStorage.removeItem(ACTIVE_SESSION_KEY);
        if (!cancelled) setSessionBootstrapReady(true);
        navigate("/retention/analytics", {
          state: {
            sessionId: liveSession.sessionId,
            config: stateConfig,
          },
        });
        return;
      }

      if (!cancelled) {
        setRecoveringSession(true);
        setSession((prev) => ({
          ...(prev || {}),
          sessionId: liveSession.sessionId,
          subject: liveSession.subject,
          topics: liveSession.topics,
          status: liveSession.status,
          startTime: liveSession.startTime,
          currentBatchType: liveSession.currentBatchType,
          metrics: liveSession.metrics,
          uiState: liveSession.uiState || null,
        }));
      }

      localStorage.setItem(
        ACTIVE_SESSION_KEY,
        JSON.stringify({
          sessionId: liveSession.sessionId,
          studentId,
          subject: liveSession.subject,
          topics: liveSession.topics,
          sessionType:
            liveSession.sessionType || stateConfig.sessionType || "practice",
          startedAt: liveSession.startTime || stateConfig.startedAt,
        }),
      );

      if (liveSession.uiState && typeof liveSession.uiState === "object") {
        try {
          const localQueueRaw = localStorage.getItem(
            retentionQueueKey(liveSession.sessionId),
          );
          const localQueueBackupRaw = localStorage.getItem(
            retentionQueueBackupKey(liveSession.sessionId),
          );
          const localArchiveRaw = localStorage.getItem(
            retentionArchiveKey(liveSession.sessionId),
          );
          const localArchiveBackupRaw = localStorage.getItem(
            retentionArchiveBackupKey(liveSession.sessionId),
          );
          const localServedRaw = localStorage.getItem(
            servedQuestionIdsKey(liveSession.sessionId),
          );
          const localServedBackupRaw = localStorage.getItem(
            servedQuestionIdsBackupKey(liveSession.sessionId),
          );
          const localRuntimeRaw = localStorage.getItem(
            runtimeKey(liveSession.sessionId),
          );

          const localQueue = localQueueRaw ? JSON.parse(localQueueRaw) : [];
          const localQueueBackup = localQueueBackupRaw
            ? JSON.parse(localQueueBackupRaw)
            : [];
          const localArchive = localArchiveRaw
            ? JSON.parse(localArchiveRaw)
            : [];
          const localArchiveBackup = localArchiveBackupRaw
            ? JSON.parse(localArchiveBackupRaw)
            : [];
          const localServed = localServedRaw ? JSON.parse(localServedRaw) : [];
          const localServedBackup = localServedBackupRaw
            ? JSON.parse(localServedBackupRaw)
            : [];
          const localRuntime = localRuntimeRaw
            ? JSON.parse(localRuntimeRaw)
            : null;

          const mergedQueue = dedupeRetentionRows([
            ...(Array.isArray(liveSession.uiState.retentionQueue)
              ? liveSession.uiState.retentionQueue
              : []),
            ...(Array.isArray(localQueue) ? localQueue : []),
            ...(Array.isArray(localQueueBackup) ? localQueueBackup : []),
          ]);

          const mergedArchive = mergeArchiveRows(
            [
              ...(Array.isArray(localArchive) ? localArchive : []),
              ...(Array.isArray(localArchiveBackup) ? localArchiveBackup : []),
            ],
            Array.isArray(liveSession.uiState.retentionArchive)
              ? liveSession.uiState.retentionArchive
              : [],
          );

          const mergedServedIds = Array.from(
            new Set([
              ...(Array.isArray(localServed) ? localServed : [])
                .map((id) => String(id || "").trim())
                .filter(Boolean),
              ...(Array.isArray(localServedBackup) ? localServedBackup : [])
                .map((id) => String(id || "").trim())
                .filter(Boolean),
              ...(Array.isArray(liveSession.uiState.servedQuestionIds)
                ? liveSession.uiState.servedQuestionIds
                : []
              )
                .map((id) => String(id || "").trim())
                .filter(Boolean),
            ]),
          );

          const backendRuntime =
            liveSession.uiState.runtime &&
            typeof liveSession.uiState.runtime === "object"
              ? liveSession.uiState.runtime
              : null;
          const localRuntimeUpdatedAt = Number(localRuntime?.updatedAt || 0);
          const backendRuntimeUpdatedAt = Number(
            backendRuntime?.updatedAt || 0,
          );
          const mergedRuntime =
            backendRuntimeUpdatedAt >= localRuntimeUpdatedAt
              ? backendRuntime || localRuntime || null
              : localRuntime || backendRuntime || null;

          localStorage.setItem(
            retentionQueueKey(liveSession.sessionId),
            JSON.stringify(mergedQueue),
          );
          if (mergedQueue.length > 0) {
            localStorage.setItem(
              retentionQueueBackupKey(liveSession.sessionId),
              JSON.stringify(mergedQueue),
            );
          }
          localStorage.setItem(
            retentionArchiveKey(liveSession.sessionId),
            JSON.stringify(mergedArchive),
          );
          if (mergedArchive.length > 0) {
            localStorage.setItem(
              retentionArchiveBackupKey(liveSession.sessionId),
              JSON.stringify(mergedArchive),
            );
          }
          localStorage.setItem(
            servedQuestionIdsKey(liveSession.sessionId),
            JSON.stringify(mergedServedIds),
          );
          if (mergedServedIds.length > 0) {
            localStorage.setItem(
              servedQuestionIdsBackupKey(liveSession.sessionId),
              JSON.stringify(mergedServedIds),
            );
          }

          if (mergedRuntime && typeof mergedRuntime === "object") {
            localStorage.setItem(
              runtimeKey(liveSession.sessionId),
              JSON.stringify(mergedRuntime),
            );
          }
        } catch {
          // Ignore localStorage write failures during recovery.
        }
      }

      // Rejoin socket room and trigger immediate sync on recovered sessions.
      retentionService.joinSession(liveSession.sessionId, studentId);
      retentionService.requestQueueState(liveSession.sessionId);
      retentionService.requestAnalytics(liveSession.sessionId);

      if (!cancelled) {
        setRecoveringSession(false);
        setSessionBootstrapReady(true);
      }
    };

    ensureSessionContext().catch(() => {
      if (!cancelled) {
        setRecoveringSession(false);
        setSessionBootstrapReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    navigate,
    persistedActiveSession?.sessionId,
    session?.sessionId,
    stateConfig.sessionType,
    stateConfig.startedAt,
    stateSession?.sessionId,
    studentId,
  ]);

  useEffect(() => {
    if (!currentSessionId) return;
    autoLoadRef.current = false;
    setSessionBootstrapReady(false);
    setIsHydratingPersistence(true);
    queueHydratedRef.current = false;
    archiveHydratedRef.current = false;
    backendUiHydratedRef.current = false;
    scheduledQueueRowsRef.current = new Set();
    queueScheduleInFlightRef.current = new Set();
    queueRetryAtRef.current = new Map();
    servedQuestionIdsRef.current = new Set();
    setRetentionRows([]);
    setRetentionArchiveRows([]);
    setCurrentQuestion(null);
    setSelectedAnswer(null);
    setResult(null);
    setHasAnsweredCurrent(false);
  }, [currentSessionId]);

  useEffect(() => {
    if (!currentSessionId) return undefined;

    const onJoined = () => {
      if (isFinishingSession) return;
      retentionService.requestAnalytics(currentSessionId);
    };
    const onAnalytics = (payload) => {
      if (isFinishingSession) return;
      applySocketAnalytics(payload);
    };
    const onQueueSync = (payload) => {
      if (isFinishingSession) return;
      if (!payload || payload.sessionId !== currentSessionId) return;
      const queueState =
        payload.queueState && typeof payload.queueState === "object"
          ? payload.queueState
          : null;
      if (!queueState) return;

      setRetentionRows((prev) =>
        dedupeRetentionRows([
          ...(Array.isArray(queueState.retentionQueue)
            ? queueState.retentionQueue
            : []),
          ...(Array.isArray(prev) ? prev : []),
        ]),
      );

      setRetentionArchiveRows((prev) =>
        mergeArchiveRows(prev, queueState.retentionArchive),
      );

      const mergedServed = new Set([
        ...Array.from(servedQuestionIdsRef.current),
        ...(Array.isArray(queueState.servedQuestionIds)
          ? queueState.servedQuestionIds
          : []
        )
          .map((id) => String(id || "").trim())
          .filter(Boolean),
      ]);
      servedQuestionIdsRef.current = mergedServed;
      persistServedQuestionIds(currentSessionId);

      if (queueState.runtime && typeof queueState.runtime === "object") {
        const localRuntimeRaw = localStorage.getItem(
          runtimeKey(currentSessionId),
        );
        let localRuntime = null;
        try {
          localRuntime = localRuntimeRaw ? JSON.parse(localRuntimeRaw) : null;
        } catch {
          localRuntime = null;
        }

        const localUpdatedAt = Number(localRuntime?.updatedAt || 0);
        const queueUpdatedAt = Number(queueState.runtime?.updatedAt || 0);
        if (queueUpdatedAt >= localUpdatedAt) {
          if (Number(queueState.runtime.sessionStartMs || 0) > 0) {
            sessionStartMsRef.current = Number(
              queueState.runtime.sessionStartMs,
            );
          }
          if (Number(queueState.runtime.questionStartMs || 0) > 0) {
            questionStartRef.current = Number(
              queueState.runtime.questionStartMs,
            );
          }

          setSessionElapsedSec(
            Math.floor((Date.now() - sessionStartMsRef.current) / 1000),
          );
          setQuestionElapsedSec(
            Math.floor((Date.now() - questionStartRef.current) / 1000),
          );

          try {
            localStorage.setItem(
              runtimeKey(currentSessionId),
              JSON.stringify(queueState.runtime),
            );
          } catch {
            // Ignore localStorage write failures.
          }
        }
      }
    };

    retentionService.on("sessionJoined", onJoined);
    retentionService.on("analyticsUpdate", onAnalytics);
    retentionService.on("queueSync", onQueueSync);

    retentionService.requestQueueState(currentSessionId);

    const intervalId = window.setInterval(() => {
      if (isFinishingSession) return;
      retentionService.requestAnalytics(currentSessionId);
      retentionService.requestQueueState(currentSessionId);
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
      retentionService.off("sessionJoined", onJoined);
      retentionService.off("analyticsUpdate", onAnalytics);
      retentionService.off("queueSync", onQueueSync);
    };
  }, [
    applySocketAnalytics,
    currentSessionId,
    dedupeRetentionRows,
    isFinishingSession,
    mergeArchiveRows,
    persistServedQuestionIds,
  ]);

  // Timer interval
  useEffect(() => {
    const activeSessionId =
      session?.sessionId ||
      stateSession?.sessionId ||
      persistedActiveSession?.sessionId;

    if (!activeSessionId) return;

    const savedRuntimeRaw = localStorage.getItem(runtimeKey(activeSessionId));
    let savedRuntime = null;
    try {
      savedRuntime = savedRuntimeRaw ? JSON.parse(savedRuntimeRaw) : null;
    } catch {
      savedRuntime = null;
    }

    const backendRuntime =
      session?.uiState?.runtime && typeof session.uiState.runtime === "object"
        ? session.uiState.runtime
        : null;

    const localUpdatedAt = Number(savedRuntime?.updatedAt || 0);
    const backendUpdatedAt = Number(backendRuntime?.updatedAt || 0);
    if (backendRuntime && backendUpdatedAt > localUpdatedAt) {
      savedRuntime = backendRuntime;
      try {
        localStorage.setItem(
          runtimeKey(activeSessionId),
          JSON.stringify(backendRuntime),
        );
      } catch {
        // Ignore localStorage write failures.
      }
    }

    const baseStartedAt =
      session?.startTime ||
      stateSession?.startTime ||
      stateConfig.startedAt ||
      persistedActiveSession?.startedAt ||
      sessionStartRef.current;
    const startedAtMs = new Date(baseStartedAt).getTime();

    sessionStartMsRef.current =
      savedRuntime?.sessionStartMs ||
      (Number.isNaN(startedAtMs) ? Date.now() : startedAtMs);

    if (savedRuntime?.questionStartMs) {
      questionStartRef.current = savedRuntime.questionStartMs;
    }

    setSessionElapsedSec(
      Math.floor((Date.now() - sessionStartMsRef.current) / 1000),
    );
    setQuestionElapsedSec(
      Math.floor((Date.now() - questionStartRef.current) / 1000),
    );

    timerRef.current = setInterval(() => {
      const now = Date.now();
      setSessionElapsedSec(
        Math.floor((now - sessionStartMsRef.current) / 1000),
      );
      if (!pausedRef.current) {
        setQuestionElapsedSec(
          Math.floor((now - questionStartRef.current) / 1000),
        );
      }

      localStorage.setItem(
        runtimeKey(activeSessionId),
        JSON.stringify({
          sessionStartMs: sessionStartMsRef.current,
          questionStartMs: questionStartRef.current,
          updatedAt: now,
        }),
      );
    }, 1000);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        setFocusLossCount((prev) => prev + 1);
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [
    persistedActiveSession?.sessionId,
    persistedActiveSession?.startedAt,
    session?.sessionId,
    session?.startTime,
    session?.uiState?.runtime?.questionStartMs,
    session?.uiState?.runtime?.sessionStartMs,
    session?.uiState?.runtime?.updatedAt,
    stateConfig.startedAt,
    stateSession?.sessionId,
    stateSession?.startTime,
  ]);

  // Auto-load first question
  useEffect(() => {
    if (
      !currentSessionId ||
      currentQuestion ||
      !sessionBootstrapReady ||
      recoveringSession ||
      isHydratingPersistence ||
      autoLoadRef.current
    ) {
      return;
    }
    autoLoadRef.current = true;
    loadNextQuestion();
  }, [
    currentQuestion,
    currentSessionId,
    isHydratingPersistence,
    recoveringSession,
    sessionBootstrapReady,
  ]);

  useEffect(() => {
    if (!activeSubjectKey) return;

    const subject = activeSubjectKey;
    retentionService
      .getFlaskLivePredictions(subject, currentSessionId)
      .then((res) => {
        if (!res?.success) return;
        processModelOutputs({
          predictions: res.predictions || {},
          modelOutputs: res.modelOutputs || {},
          modelsReady: res.modelsReady || {},
          trainingNeeded: res.trainingNeeded || {},
          sequenceStatus: res.sequenceStatus || {},
          liveAnalysis: res.liveAnalysis || {},
        });
      });
  }, [currentSessionId, processModelOutputs, activeSubjectKey]);

  useEffect(() => {
    if (Number(metrics.questionsAnswered || 0) > 0) {
      setAnalysisReady(true);
    }
  }, [metrics.questionsAnswered]);

  useEffect(() => {
    const submitKey = buildQuestionSubmitKey(currentQuestion, questionIndex);
    if (!submitKey) return;
    // Reset submit lock whenever question changes to a new resolved id.
    if (lastSubmittedQuestionRef.current !== submitKey) {
      submitLockRef.current = false;
    }
  }, [currentQuestion, questionIndex]);

  useEffect(() => {
    if (!currentSessionId) return;
    try {
      const raw = localStorage.getItem(retentionQueueKey(currentSessionId));
      const backupRaw = localStorage.getItem(
        retentionQueueBackupKey(currentSessionId),
      );
      const parsed = raw ? JSON.parse(raw) : [];
      const backupParsed = backupRaw ? JSON.parse(backupRaw) : [];
      const normalizedRows = dedupeRetentionRows([
        ...(Array.isArray(parsed) ? parsed : []),
        ...(Array.isArray(backupParsed) ? backupParsed : []),
      ]);
      setRetentionRows(normalizedRows);
      scheduledQueueRowsRef.current = new Set(
        normalizedRows
          .filter(
            (row) => row?.queueStatus === "scheduled" || row?.scheduledSpecial,
          )
          .map((row) => String(row.questionId || row.id))
          .filter(Boolean),
      );
      if (normalizedRows.length > 0) {
        localStorage.setItem(
          retentionQueueBackupKey(currentSessionId),
          JSON.stringify(normalizedRows),
        );
      }
    } catch {
      // Ignore malformed persisted queue payloads.
      setRetentionRows([]);
      scheduledQueueRowsRef.current = new Set();
    } finally {
      queueHydratedRef.current = true;
    }
  }, [currentSessionId, dedupeRetentionRows]);

  useEffect(() => {
    if (!currentSessionId) return;
    try {
      const raw = localStorage.getItem(retentionArchiveKey(currentSessionId));
      const backupRaw = localStorage.getItem(
        retentionArchiveBackupKey(currentSessionId),
      );
      const parsed = raw ? JSON.parse(raw) : [];
      const backupParsed = backupRaw ? JSON.parse(backupRaw) : [];
      const normalizedArchive = mergeArchiveRows(
        Array.isArray(parsed) ? parsed : [],
        Array.isArray(backupParsed) ? backupParsed : [],
      )
        .map((row) => normalizeQueueRow(row))
        .filter(Boolean)
        .slice(0, 120);

      setRetentionArchiveRows(normalizedArchive);
      if (normalizedArchive.length > 0) {
        localStorage.setItem(
          retentionArchiveBackupKey(currentSessionId),
          JSON.stringify(normalizedArchive),
        );
      }
    } catch {
      // Ignore malformed persisted archive payloads.
      setRetentionArchiveRows([]);
    } finally {
      archiveHydratedRef.current = true;
    }
  }, [currentSessionId, normalizeQueueRow]);

  useEffect(() => {
    if (!currentSessionId) return;
    try {
      const raw = localStorage.getItem(servedQuestionIdsKey(currentSessionId));
      const backupRaw = localStorage.getItem(
        servedQuestionIdsBackupKey(currentSessionId),
      );
      const parsed = raw ? JSON.parse(raw) : [];
      const backupParsed = backupRaw ? JSON.parse(backupRaw) : [];
      const mergedServedIds = [
        ...(Array.isArray(parsed) ? parsed : []),
        ...(Array.isArray(backupParsed) ? backupParsed : []),
      ];
      servedQuestionIdsRef.current = new Set(
        mergedServedIds.map((id) => String(id || "").trim()).filter(Boolean),
      );
      if (servedQuestionIdsRef.current.size > 0) {
        localStorage.setItem(
          servedQuestionIdsBackupKey(currentSessionId),
          JSON.stringify(Array.from(servedQuestionIdsRef.current)),
        );
      }
    } catch {
      servedQuestionIdsRef.current = new Set();
    }
  }, [currentSessionId]);

  useEffect(() => {
    if (!currentSessionId) return;
    if (!sessionBootstrapReady) return;
    if (!queueHydratedRef.current || !archiveHydratedRef.current) return;
    if (backendUiHydratedRef.current) return;

    const backendUiState =
      session?.uiState && typeof session.uiState === "object"
        ? session.uiState
        : null;

    if (backendUiState) {
      setRetentionRows((prev) => {
        const mergedRows = dedupeRetentionRows([
          ...(Array.isArray(backendUiState.retentionQueue)
            ? backendUiState.retentionQueue
            : []),
          ...(Array.isArray(prev) ? prev : []),
        ]);

        scheduledQueueRowsRef.current = new Set(
          mergedRows
            .filter(
              (row) =>
                row?.queueStatus === "scheduled" || row?.scheduledSpecial,
            )
            .map((row) => String(row.questionId || row.id))
            .filter(Boolean),
        );

        return mergedRows;
      });

      setRetentionArchiveRows((prev) =>
        mergeArchiveRows(prev, backendUiState.retentionArchive),
      );

      const backendServedIds = (
        Array.isArray(backendUiState.servedQuestionIds)
          ? backendUiState.servedQuestionIds
          : []
      )
        .map((id) => String(id || "").trim())
        .filter(Boolean);

      if (backendServedIds.length > 0) {
        servedQuestionIdsRef.current = new Set([
          ...Array.from(servedQuestionIdsRef.current),
          ...backendServedIds,
        ]);
        persistServedQuestionIds(currentSessionId);
      }

      const backendRuntime =
        backendUiState.runtime && typeof backendUiState.runtime === "object"
          ? backendUiState.runtime
          : null;

      const localRuntimeRaw = localStorage.getItem(
        runtimeKey(currentSessionId),
      );
      let localRuntime = null;
      try {
        localRuntime = localRuntimeRaw ? JSON.parse(localRuntimeRaw) : null;
      } catch {
        localRuntime = null;
      }

      const localUpdatedAt = Number(localRuntime?.updatedAt || 0);
      const backendUpdatedAt = Number(backendRuntime?.updatedAt || 0);
      if (backendRuntime && backendUpdatedAt > localUpdatedAt) {
        if (Number(backendRuntime.sessionStartMs || 0) > 0) {
          sessionStartMsRef.current = Number(backendRuntime.sessionStartMs);
        }
        if (Number(backendRuntime.questionStartMs || 0) > 0) {
          questionStartRef.current = Number(backendRuntime.questionStartMs);
        }

        setSessionElapsedSec(
          Math.floor((Date.now() - sessionStartMsRef.current) / 1000),
        );
        setQuestionElapsedSec(
          Math.floor((Date.now() - questionStartRef.current) / 1000),
        );

        try {
          localStorage.setItem(
            runtimeKey(currentSessionId),
            JSON.stringify(backendRuntime),
          );
        } catch {
          // Ignore localStorage write failures.
        }
      }
    }

    backendUiHydratedRef.current = true;
    setIsHydratingPersistence(false);
  }, [
    currentSessionId,
    dedupeRetentionRows,
    mergeArchiveRows,
    persistServedQuestionIds,
    retentionArchiveRows,
    retentionRows,
    sessionBootstrapReady,
    session?.uiState,
  ]);

  useEffect(() => {
    if (!currentSessionId) return;
    if (!queueHydratedRef.current) return;
    try {
      const normalizedRows = dedupeRetentionRows(retentionRows);
      localStorage.setItem(
        retentionQueueKey(currentSessionId),
        JSON.stringify(normalizedRows),
      );
      if (normalizedRows.length > 0) {
        localStorage.setItem(
          retentionQueueBackupKey(currentSessionId),
          JSON.stringify(normalizedRows),
        );
      }
    } catch {
      // Ignore localStorage write failures.
    }
  }, [currentSessionId, dedupeRetentionRows, retentionRows]);

  useEffect(() => {
    if (!currentSessionId) return;
    if (!archiveHydratedRef.current) return;
    try {
      const safeArchive = (
        Array.isArray(retentionArchiveRows) ? retentionArchiveRows : []
      ).slice(0, 120);
      localStorage.setItem(
        retentionArchiveKey(currentSessionId),
        JSON.stringify(safeArchive),
      );
      if (safeArchive.length > 0) {
        localStorage.setItem(
          retentionArchiveBackupKey(currentSessionId),
          JSON.stringify(safeArchive),
        );
      }
    } catch {
      // Ignore localStorage write failures.
    }
  }, [currentSessionId, retentionArchiveRows]);

  useEffect(() => {
    if (!currentSessionId) return;
    if (!sessionBootstrapReady) return;
    if (isFinishingSession) return;
    if (recoveringSession || isHydratingPersistence) return;
    if (!queueHydratedRef.current || !archiveHydratedRef.current) return;

    const saveTimer = window.setTimeout(() => {
      const snapshot = buildUiStateSnapshot();
      let safeSnapshot = snapshot;

      const snapshotQueueLen = Array.isArray(snapshot?.retentionQueue)
        ? snapshot.retentionQueue.length
        : 0;
      const snapshotArchiveLen = Array.isArray(snapshot?.retentionArchive)
        ? snapshot.retentionArchive.length
        : 0;
      const snapshotServedLen = Array.isArray(snapshot?.servedQuestionIds)
        ? snapshot.servedQuestionIds.length
        : 0;

      if (
        snapshotQueueLen === 0 &&
        snapshotArchiveLen === 0 &&
        snapshotServedLen === 0
      ) {
        try {
          const queueBackupRaw = localStorage.getItem(
            retentionQueueBackupKey(currentSessionId),
          );
          const archiveBackupRaw = localStorage.getItem(
            retentionArchiveBackupKey(currentSessionId),
          );
          const servedBackupRaw = localStorage.getItem(
            servedQuestionIdsBackupKey(currentSessionId),
          );

          const queueBackup = queueBackupRaw ? JSON.parse(queueBackupRaw) : [];
          const archiveBackup = archiveBackupRaw
            ? JSON.parse(archiveBackupRaw)
            : [];
          const servedBackup = servedBackupRaw
            ? JSON.parse(servedBackupRaw)
            : [];

          const fallbackQueue = dedupeRetentionRows(
            Array.isArray(queueBackup) ? queueBackup : [],
          );
          const fallbackArchive = mergeArchiveRows(
            Array.isArray(archiveBackup) ? archiveBackup : [],
            [],
          );
          const fallbackServed = Array.from(
            new Set(
              (Array.isArray(servedBackup) ? servedBackup : [])
                .map((id) => String(id || "").trim())
                .filter(Boolean),
            ),
          );

          if (
            fallbackQueue.length > 0 ||
            fallbackArchive.length > 0 ||
            fallbackServed.length > 0
          ) {
            safeSnapshot = {
              ...snapshot,
              retentionQueue: fallbackQueue,
              retentionArchive: fallbackArchive,
              servedQuestionIds: fallbackServed,
            };
          }
        } catch {
          // Keep original snapshot if backup parsing fails.
        }
      }

      retentionService
        .saveSessionUiState(currentSessionId, safeSnapshot)
        .catch(() => {
          // Best-effort sync only.
        });
    }, 900);

    return () => window.clearTimeout(saveTimer);
  }, [
    buildUiStateSnapshot,
    currentSessionId,
    isHydratingPersistence,
    isFinishingSession,
    recoveringSession,
    retentionArchiveRows,
    retentionRows,
    sessionBootstrapReady,
  ]);

  useEffect(() => {
    if (!currentSessionId) return undefined;
    if (!sessionBootstrapReady) return undefined;
    if (isFinishingSession) return undefined;
    if (recoveringSession || isHydratingPersistence) return undefined;
    if (!queueHydratedRef.current || !archiveHydratedRef.current) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      const snapshot = buildUiStateSnapshot();
      let safeSnapshot = snapshot;

      const snapshotQueueLen = Array.isArray(snapshot?.retentionQueue)
        ? snapshot.retentionQueue.length
        : 0;
      const snapshotArchiveLen = Array.isArray(snapshot?.retentionArchive)
        ? snapshot.retentionArchive.length
        : 0;
      const snapshotServedLen = Array.isArray(snapshot?.servedQuestionIds)
        ? snapshot.servedQuestionIds.length
        : 0;

      if (
        snapshotQueueLen === 0 &&
        snapshotArchiveLen === 0 &&
        snapshotServedLen === 0
      ) {
        try {
          const queueBackupRaw = localStorage.getItem(
            retentionQueueBackupKey(currentSessionId),
          );
          const archiveBackupRaw = localStorage.getItem(
            retentionArchiveBackupKey(currentSessionId),
          );
          const servedBackupRaw = localStorage.getItem(
            servedQuestionIdsBackupKey(currentSessionId),
          );

          const queueBackup = queueBackupRaw ? JSON.parse(queueBackupRaw) : [];
          const archiveBackup = archiveBackupRaw
            ? JSON.parse(archiveBackupRaw)
            : [];
          const servedBackup = servedBackupRaw
            ? JSON.parse(servedBackupRaw)
            : [];

          const fallbackQueue = dedupeRetentionRows(
            Array.isArray(queueBackup) ? queueBackup : [],
          );
          const fallbackArchive = mergeArchiveRows(
            Array.isArray(archiveBackup) ? archiveBackup : [],
            [],
          );
          const fallbackServed = Array.from(
            new Set(
              (Array.isArray(servedBackup) ? servedBackup : [])
                .map((id) => String(id || "").trim())
                .filter(Boolean),
            ),
          );

          if (
            fallbackQueue.length > 0 ||
            fallbackArchive.length > 0 ||
            fallbackServed.length > 0
          ) {
            safeSnapshot = {
              ...snapshot,
              retentionQueue: fallbackQueue,
              retentionArchive: fallbackArchive,
              servedQuestionIds: fallbackServed,
            };
          }
        } catch {
          // Keep original snapshot if backup parsing fails.
        }
      }

      retentionService
        .saveSessionUiState(currentSessionId, safeSnapshot)
        .catch(() => {
          // Best-effort timer sync only.
        });
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [
    buildUiStateSnapshot,
    currentSessionId,
    isHydratingPersistence,
    isFinishingSession,
    recoveringSession,
    sessionBootstrapReady,
  ]);

  useEffect(() => {
    const tickId = window.setInterval(() => {
      setQueueTick((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(tickId);
  }, []);

  const hasAnsweredData =
    Number(metrics.questionsAnswered || 0) > 0 ||
    Number(metrics.correctAnswers || 0) > 0;

  const accuracyRatioFallback = toRatio(metrics.overallAccuracy, 0);
  const recentRatioFallback = toRatio(
    metrics.recentAccuracy,
    accuracyRatioFallback,
  );

  const displayMicroRetention =
    microLSTM.retentionProbability > 0
      ? microLSTM.retentionProbability
      : hasAnsweredData
        ? accuracyRatioFallback
        : microLSTM.retentionProbability;

  const displayProbabilityCorrectNext =
    microLSTM.probabilityCorrectNext > 0
      ? microLSTM.probabilityCorrectNext
      : hasAnsweredData
        ? recentRatioFallback
        : microLSTM.probabilityCorrectNext;

  const displaySubjectRetention =
    mesoLSTM.subjectRetentionScore > 0
      ? mesoLSTM.subjectRetentionScore
      : hasAnsweredData
        ? displayMicroRetention
        : mesoLSTM.subjectRetentionScore;

  const displayRetention7d =
    mesoLSTM.retention7d > 0 ? mesoLSTM.retention7d : displaySubjectRetention;
  const displayRetention30d =
    mesoLSTM.retention30d > 0
      ? mesoLSTM.retention30d
      : clamp(displaySubjectRetention * 0.92);
  const displayRetention90d =
    mesoLSTM.retention90d > 0
      ? mesoLSTM.retention90d
      : clamp(displaySubjectRetention * 0.84);

  const displayTopicRevisionPriority =
    mesoLSTM.nextTopicRevisionPriority.length > 0
      ? mesoLSTM.nextTopicRevisionPriority
      : [
          currentQuestion?.topicCategory || currentQuestion?.topic,
          ...(Array.isArray(session?.topics) ? session.topics : []),
          ...(Array.isArray(stateConfig?.topics) ? stateConfig.topics : []),
        ]
          .filter(Boolean)
          .map((topic) => String(topic))
          .filter((topic, index, arr) => arr.indexOf(topic) === index)
          .slice(0, 3);

  const currentRetentionReview = currentQuestion?.retentionReview || null;
  const flaskMetrics = currentRetentionReview?.flaskMetrics || null;

  const questionRetentionProbability = toRatio(
    flaskMetrics?.retentionProbability,
    displayMicroRetention,
  );
  const questionNextDifficulty = Number(
    firstDefined(
      flaskMetrics?.nextQuestionDifficulty,
      microLSTM.nextQuestionDifficulty,
      3,
    ),
  );
  const questionProbabilityCorrectNext = toRatio(
    flaskMetrics?.probabilityCorrectNext,
    displayProbabilityCorrectNext,
  );
  const questionStressImpact = toRatio(
    flaskMetrics?.stressImpact,
    microLSTM.stressImpact,
  );
  const questionFatigueLevel = toRatio(
    flaskMetrics?.fatigueLevel,
    microLSTM.fatigueLevel,
  );
  const questionBatchType =
    currentRetentionReview?.batchType ||
    flaskMetrics?.reviewBatchType ||
    microLSTM.batchType;
  const questionRepeatInDays = Number(
    firstDefined(flaskMetrics?.repeatInDays, microLSTM.repeatInDays, 1),
  );
  const questionRepeatInSeconds = pickNearestTimerFrameSec(
    firstDefined(
      flaskMetrics?.repeatInSeconds,
      flaskMetrics?.timerFrameSeconds,
      questionRepeatInDays * 86400,
    ),
  );

  const dueAtRaw =
    currentRetentionReview?.dueAt || flaskMetrics?.revisionAvailableAt || null;
  const dueAtDate = dueAtRaw ? new Date(dueAtRaw) : null;
  const revisionRemainingMs = dueAtDate
    ? Math.max(0, dueAtDate.getTime() - Date.now())
    : questionRepeatInSeconds * 1000;
  const revisionAvailabilityLabel =
    dueAtDate && Number.isFinite(dueAtDate.getTime())
      ? revisionRemainingMs === 0
        ? "Available now"
        : `Available in ${toDurationLabel(revisionRemainingMs)}`
      : `Available in ${timerFrameLabelFromSec(questionRepeatInSeconds)}`;

  const currentQuestionId = resolveQuestionId(currentQuestion);
  const currentQuestionQueueManaged = currentQuestionId
    ? isQuestionManagedByRetentionQueue(currentQuestionId)
    : false;

  const currentQueueSnapshot = useMemo(() => {
    if (!currentQuestionId) return null;
    return (
      (Array.isArray(retentionRows) ? retentionRows : []).find(
        (row) => getQueueQuestionKey(row) === currentQuestionId,
      ) ||
      (Array.isArray(retentionArchiveRows) ? retentionArchiveRows : []).find(
        (row) => getQueueQuestionKey(row) === currentQuestionId,
      ) ||
      null
    );
  }, [
    currentQuestionId,
    getQueueQuestionKey,
    retentionArchiveRows,
    retentionRows,
  ]);

  const repeatedAttemptsCount = Number(
    firstDefined(
      currentQueueSnapshot?.queueEntryCount,
      currentQueueSnapshot?.repeatsDone,
      0,
    ),
  );

  const repeatedCyclesCount = Number(
    firstDefined(
      currentQueueSnapshot?.repeatsDone,
      currentRetentionReview?.repeatsDoneInSession,
      Math.max(0, repeatedAttemptsCount - 1),
      0,
    ),
  );

  const hasRepeatEvidence =
    repeatedCyclesCount > 0 ||
    Number(currentQueueSnapshot?.queueEntryCount || 0) > 1 ||
    currentRetentionReview?.isRepeat === true;

  const isRepeatedQuestion = Boolean(
    currentQuestionId &&
    (String(currentQuestion?.source || "").toLowerCase() === "retention" ||
      (hasRepeatEvidence && currentQuestionQueueManaged)),
  );

  const repeatedQuestionStatusLabel =
    currentQueueSnapshot?.retentionTag ||
    currentRetentionReview?.retentionTag ||
    getBatchTypeLabel(questionBatchType);

  const repeatedQuestionPanelClass = isRepeatedQuestion
    ? isDarkMode
      ? "rounded-2xl border border-rose-500/50 bg-gradient-to-r from-rose-950/60 via-fuchsia-950/40 to-amber-950/30 p-6 shadow-[0_12px_32px_rgba(15,23,42,0.5)]"
      : "rounded-2xl border border-rose-300 bg-gradient-to-r from-rose-100 via-fuchsia-100 to-amber-100 p-6 shadow-[0_12px_32px_rgba(190,24,93,0.24)]"
    : isDarkMode
      ? "rounded-xl border border-slate-700 bg-gradient-to-r from-slate-800/70 to-sky-900/40 p-6"
      : "rounded-xl bg-gradient-to-r from-slate-50 to-sky-50 p-6";

  const repeatedOptionPalette = [
    "border-rose-300 bg-gradient-to-r from-rose-50 to-pink-50 hover:border-rose-400 hover:from-rose-100 hover:to-pink-100",
    "border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 hover:border-amber-400 hover:from-amber-100 hover:to-orange-100",
    "border-sky-300 bg-gradient-to-r from-sky-50 to-cyan-50 hover:border-sky-400 hover:from-sky-100 hover:to-cyan-100",
    "border-emerald-300 bg-gradient-to-r from-emerald-50 to-teal-50 hover:border-emerald-400 hover:from-emerald-100 hover:to-teal-100",
  ];

  const visibleRetentionRows = useMemo(() => {
    const normalized = dedupeRetentionRows(retentionRows);
    return normalized
      .filter((row) => row?.needsRetention && row?.queueStatus !== "retired")
      .sort(
        (a, b) =>
          toQueueMs(a.nextRepeatAt) - toQueueMs(b.nextRepeatAt) ||
          Number(a.retentionScore || 0) - Number(b.retentionScore || 0),
      );
  }, [dedupeRetentionRows, retentionRows, toQueueMs]);

  const overdueScheduledCount = useMemo(() => {
    const now = Date.now();
    return visibleRetentionRows.filter((row) => {
      if (row?.queueStatus !== "scheduled") return false;
      const dueAtMs = toQueueMs(row?.nextRepeatAt);
      return dueAtMs > 0 && dueAtMs <= now;
    }).length;
  }, [queueTick, toQueueMs, visibleRetentionRows]);

  const retentionQueueSummary = useMemo(() => {
    const now = Date.now();

    let dueNowCount = 0;
    let pendingCount = 0;
    let scheduledCount = 0;
    let nextDueMs = 0;

    visibleRetentionRows.forEach((row) => {
      const dueAtMs = toQueueMs(row.nextRepeatAt);
      const remainingMs = Math.max(0, dueAtMs - now);
      if (remainingMs === 0) dueNowCount += 1;
      if (row.queueStatus === "scheduled") scheduledCount += 1;
      if (row.queueStatus !== "scheduled") pendingCount += 1;
      if (remainingMs > 0 && (nextDueMs === 0 || remainingMs < nextDueMs)) {
        nextDueMs = remainingMs;
      }
    });

    return {
      total: visibleRetentionRows.length,
      dueNowCount,
      pendingCount,
      scheduledCount,
      overdueScheduledCount,
      nextDueMs,
    };
  }, [overdueScheduledCount, queueTick, toQueueMs, visibleRetentionRows]);

  const globalRetentionMessage =
    !hasAnsweredCurrent && retentionQueueSummary.total > 0
      ? "Queue timers are running. Due repeats are prioritized on the next question load."
      : retentionQueueSummary.total === 0
        ? "No pending repeats yet. Submit answers to build your smart retention queue."
        : retentionQueueSummary.overdueScheduledCount > 0
          ? `${retentionQueueSummary.overdueScheduledCount} scheduled repeat${retentionQueueSummary.overdueScheduledCount > 1 ? "s are" : " is"} overdue. They are being retried automatically.`
          : retentionQueueSummary.dueNowCount > 0
            ? `${retentionQueueSummary.dueNowCount} question${retentionQueueSummary.dueNowCount > 1 ? "s are" : " is"} due now and ready to be served.`
            : `Next repeat unlocks in ${toDurationLabel(retentionQueueSummary.nextDueMs)}.`;

  useEffect(() => {
    if (!currentSessionId) return;
    if (!hasAnsweredCurrent) return;
    if (paused || loadingNext || isSubmitting) return;
    if (retentionQueueSummary.dueNowCount <= 0) return;

    const autoReleaseId = window.setTimeout(() => {
      loadNextQuestion({ fromNextButton: true });
    }, 350);

    return () => window.clearTimeout(autoReleaseId);
  }, [
    currentSessionId,
    hasAnsweredCurrent,
    isSubmitting,
    loadNextQuestion,
    loadingNext,
    paused,
    retentionQueueSummary.dueNowCount,
  ]);

  const retentionGraphData = useMemo(() => {
    const rows = (
      Array.isArray(visibleRetentionRows) ? visibleRetentionRows : []
    )
      .slice(0, 12)
      .map((row, idx) => {
        const retentionScore = Math.max(
          0,
          Math.min(100, Math.round(Number(row?.retentionScore || 0))),
        );
        const conceptMastery = Math.max(
          0,
          Math.min(
            100,
            Math.round(
              toPercent(
                firstDefined(
                  row?.conceptMasteryScore,
                  row?.concept_mastery_score,
                  row?.conceptMastery,
                  retentionScore,
                ),
                retentionScore,
              ),
            ),
          ),
        );

        return {
          id: String(row?.id || `q-${idx + 1}`),
          index: idx,
          label: `Q${idx + 1}`,
          questionText: String(
            row?.questionText || "Question text unavailable",
          ),
          topicCategory: String(row?.topicCategory || row?.topic || "General"),
          optionsText: String(row?.optionsText || ""),
          retentionScore,
          conceptMastery,
          queueStatus: String(row?.queueStatus || "pending"),
        };
      });

    if (!rows.length) {
      return {
        points: [],
        retentionPath: "",
        masteryPath: "",
      };
    }

    const toY = (value) => {
      const normalized = Math.max(0, Math.min(100, Number(value || 0)));
      return 96 - normalized * 0.9;
    };

    const points = rows.map((row, idx) => {
      const x = rows.length === 1 ? 50 : 4 + (idx * 92) / (rows.length - 1);
      return {
        ...row,
        x,
        yRetention: toY(row.retentionScore),
        yMastery: toY(row.conceptMastery),
      };
    });

    const retentionPath = points
      .map(
        (point, idx) =>
          `${idx === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.yRetention.toFixed(2)}`,
      )
      .join(" ");
    const masteryPath = points
      .map(
        (point, idx) =>
          `${idx === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.yMastery.toFixed(2)}`,
      )
      .join(" ");

    return {
      points,
      retentionPath,
      masteryPath,
    };
  }, [firstDefined, toPercent, visibleRetentionRows]);

  const hoveredRetentionPoint =
    retentionChartHoverIndex >= 0
      ? retentionGraphData.points.find(
          (point) => point.index === retentionChartHoverIndex,
        ) || null
      : null;

  const pageShellClass = isDarkMode
    ? "min-h-screen bg-[radial-gradient(circle_at_top_left,_#1f2937_0%,_#0f172a_45%,_#020617_100%)] px-4 py-6 text-slate-100 sm:px-8"
    : "min-h-screen bg-[radial-gradient(circle_at_top_left,_#eff6ff_0%,_#ffffff_40%,_#e2e8f0_100%)] px-4 py-6 text-slate-900 sm:px-8";
  const cardClass = isDarkMode
    ? "rounded-3xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/40 backdrop-blur"
    : "rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-xl shadow-slate-200/60 backdrop-blur";
  const focusedCardClass = isFocusMode
    ? `${cardClass} h-full p-4 sm:p-5`
    : cardClass;
  const focusModePanelClass = isDarkMode
    ? "border-sky-500/30 bg-[radial-gradient(circle_at_top,_rgba(14,116,144,0.22),_rgba(2,6,23,0.92)_58%)]"
    : "border-sky-200 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.14),_rgba(255,255,255,0.98)_62%)]";
  const focusModeBannerClass = isDarkMode
    ? "border border-sky-500/30 bg-slate-900/70 text-slate-100"
    : "border border-sky-200 bg-white/90 text-slate-900";
  const mutedTextClass = isDarkMode ? "text-slate-300" : "text-slate-600";
  const titleTextClass = isDarkMode ? "text-slate-100" : "text-slate-900";
  const optionDefaultClass = isDarkMode
    ? "border-slate-700 bg-slate-900/60 hover:border-sky-400 hover:bg-slate-800/80"
    : "border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50";

  // ==================== Render ====================

  if (!currentQuestion) {
    return (
      <div className={pageShellClass}>
        <div className="mx-auto flex max-w-4xl flex-col items-center px-6 py-20 text-center">
          <div
            className={`mb-6 rounded-full p-4 ${
              isDarkMode ? "bg-sky-500/20" : "bg-sky-100"
            }`}
          >
            <FiCpu className="h-8 w-8 text-sky-600" />
          </div>
          <p className="text-sm uppercase tracking-widest text-sky-500">
            Adaptive Learning System
          </p>
          <h1 className={`mt-3 text-3xl font-black ${titleTextClass}`}>
            {recoveringSession
              ? "Resuming your session..."
              : "Preparing your personalized session..."}
          </h1>
          <p className={`mt-3 text-sm ${mutedTextClass}`}>
            {recoveringSession
              ? "Your progress is being restored."
              : "Loading questions optimized for your learning pace."}
          </p>
          <div className="mt-8 flex gap-4">
            <button
              type="button"
              onClick={loadNextQuestion}
              className="rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white shadow-lg hover:bg-slate-800"
            >
              Start Practice
            </button>
            <button
              type="button"
              onClick={() => navigate("/retention/start")}
              className={`rounded-xl px-6 py-3 font-semibold ${
                isDarkMode
                  ? "border border-slate-600 bg-slate-900 text-slate-200 hover:bg-slate-800"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Choose Different Subject
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={pageShellClass}>
      <div
        className={`mx-auto grid w-full gap-6 ${isFocusMode ? "max-w-5xl" : "max-w-[1400px]"} ${analyticsOpen && !isFocusMode ? "lg:grid-cols-[2.2fr_1fr]" : "lg:grid-cols-[1fr]"}`}
      >
        {/* Main Question Panel */}
        <section
          ref={focusPanelRef}
          className={`${focusedCardClass} ${isFocusMode ? "mx-auto w-full max-w-3xl" : ""} ${
            isFocusMode
              ? `relative overflow-hidden ${isDarkMode ? "bg-slate-950" : "bg-white"} ${focusModePanelClass}`
              : ""
          }`}
        >
          {isFocusMode && (
            <div className="pointer-events-none absolute inset-0 opacity-70">
              <div className="absolute -top-20 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-sky-400/20 blur-3xl" />
              <div className="absolute -bottom-20 right-8 h-40 w-40 rounded-full bg-indigo-400/20 blur-3xl" />
            </div>
          )}

          {/* Header */}
          <div
            className={`flex flex-wrap items-center justify-between gap-3 border-b pb-4 ${
              isDarkMode ? "border-slate-700" : "border-slate-200"
            }`}
          >
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-sky-700">
                {activeSubjectKey === "english"
                  ? "📚 English Practice"
                  : "🌍 GK Practice"}
              </p>
              <h1 className={`mt-1 text-2xl font-black ${titleTextClass}`}>
                Question {questionIndex}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsDarkMode((prev) => !prev)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium ${
                  isDarkMode
                    ? "border border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {isDarkMode ? (
                  <>
                    <FiSun className="h-4 w-4" />
                    Light
                  </>
                ) : (
                  <>
                    <FiMoon className="h-4 w-4" />
                    Dark
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setPaused((prev) => !prev)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium ${
                  isDarkMode
                    ? "border border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700"
                    : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {paused ? (
                  <>
                    <FiPlayCircle className="h-4 w-4" />
                    Resume
                  </>
                ) : (
                  <>
                    <FiPauseCircle className="h-4 w-4" />
                    Pause
                  </>
                )}
              </button>
              {!isFocusMode && (
                <button
                  type="button"
                  onClick={() => setAnalyticsOpen((prev) => !prev)}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-md hover:from-sky-600 hover:to-indigo-600"
                >
                  <FiSidebar className="h-4 w-4" />
                  {analyticsOpen ? "Close Side Window" : "Open Side Window"}
                </button>
              )}
              <button
                type="button"
                onClick={toggleFocusMode}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:from-emerald-600 hover:to-teal-600"
              >
                {isFocusMode ? (
                  <>
                    <FiMinimize2 className="h-4 w-4" />
                    Exit Focus
                  </>
                ) : (
                  <>
                    <FiMaximize2 className="h-4 w-4" />
                    Focus
                  </>
                )}
              </button>
            </div>
          </div>

          {isFocusMode && (
            <div
              className={`relative mt-4 rounded-2xl px-4 py-3 ${focusModeBannerClass}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-500">
                    Deep Focus Mode
                  </p>
                  <p className={`mt-1 text-sm font-semibold ${titleTextClass}`}>
                    Read once, recall actively, commit confidently.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                  <span
                    className={`rounded-full px-2 py-1 ${
                      isDarkMode
                        ? "bg-sky-900/40 text-sky-200"
                        : "bg-sky-100 text-sky-700"
                    }`}
                  >
                    Due now: {retentionQueueSummary.dueNowCount}
                  </span>
                  <span
                    className={`rounded-full px-2 py-1 ${
                      isDarkMode
                        ? "bg-emerald-900/40 text-emerald-200"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    Q Timer: {toClock(questionElapsedSec)}
                  </span>
                  <span
                    className={`rounded-full px-2 py-1 ${
                      isDarkMode
                        ? "bg-violet-900/40 text-violet-200"
                        : "bg-violet-100 text-violet-700"
                    }`}
                  >
                    Retention: {Math.round(questionRetentionProbability * 100)}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Question Metadata */}
          {!isFocusMode && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`rounded-full px-3 py-1 font-medium ${
                  isDarkMode
                    ? "bg-sky-900/40 text-sky-200"
                    : "bg-sky-100 text-sky-800"
                }`}
              >
                {activeSubjectKey}
              </span>
              <span
                className={`rounded-full px-3 py-1 font-medium ${
                  isDarkMode
                    ? "bg-indigo-900/40 text-indigo-200"
                    : "bg-indigo-100 text-indigo-800"
                }`}
              >
                {currentQuestion.topicCategory || currentQuestion.topic}
              </span>
              <span
                className={`rounded-full px-3 py-1 font-medium ${
                  isDarkMode
                    ? "bg-cyan-900/40 text-cyan-200"
                    : "bg-cyan-100 text-cyan-800"
                }`}
              >
                Scope {activeTopicScope.length}
              </span>
              <span
                className={`rounded-full px-3 py-1 font-medium ${
                  isDarkMode
                    ? "bg-violet-900/40 text-violet-200"
                    : "bg-violet-100 text-violet-800"
                }`}
              >
                Difficulty {String(currentQuestion.difficulty ?? "-")}/5
              </span>
              <span
                className={`flex items-center gap-1 rounded-full px-3 py-1 font-medium ${
                  isDarkMode
                    ? "bg-amber-900/40 text-amber-200"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                <FiClock className="h-3 w-3" />
                Session {toClock(sessionElapsedSec)}
              </span>
              <span
                className={`flex items-center gap-1 rounded-full px-3 py-1 font-medium ${
                  isDarkMode
                    ? "bg-emerald-900/40 text-emerald-200"
                    : "bg-emerald-100 text-emerald-800"
                }`}
              >
                <FiClock className="h-3 w-3" />
                Question {toClock(questionElapsedSec)}
              </span>
              {isRepeatedQuestion && (
                <span className="rounded-full border border-rose-300 bg-gradient-to-r from-rose-500 to-fuchsia-600 px-3 py-1 font-bold uppercase tracking-wide text-white shadow-sm">
                  Repeated Question
                </span>
              )}
            </div>
          )}

          {isRepeatedQuestion && !isFocusMode && (
            <div
              className={`mt-4 rounded-2xl border p-4 ${
                isDarkMode
                  ? "border-rose-500/50 bg-gradient-to-r from-rose-950/50 via-fuchsia-950/40 to-amber-950/30"
                  : "border-rose-300 bg-gradient-to-r from-rose-50 via-fuchsia-50 to-amber-50"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p
                    className={`text-xs font-semibold uppercase tracking-[0.18em] ${
                      isDarkMode ? "text-rose-300" : "text-rose-700"
                    }`}
                  >
                    Repeated Question
                  </p>
                  <p
                    className={`mt-1 text-sm font-semibold ${
                      isDarkMode ? "text-rose-100" : "text-rose-900"
                    }`}
                  >
                    This question is resurfaced from your retention queue for
                    reinforced recall.
                  </p>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-bold ${
                    isDarkMode
                      ? "border-rose-400/60 bg-rose-900/30 text-rose-200"
                      : "border-rose-300 bg-white text-rose-700"
                  }`}
                >
                  Cycle {Math.max(1, repeatedCyclesCount)} /{" "}
                  {MAX_RETENTION_REPEATS}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div
                  className={`rounded-lg p-2 ${
                    isDarkMode ? "bg-slate-900/40" : "bg-white/80"
                  }`}
                >
                  <p className={mutedTextClass}>Retention Stage</p>
                  <p className={`font-semibold ${titleTextClass}`}>
                    {repeatedQuestionStatusLabel}
                  </p>
                </div>
                <div
                  className={`rounded-lg p-2 ${
                    isDarkMode ? "bg-slate-900/40" : "bg-white/80"
                  }`}
                >
                  <p className={mutedTextClass}>Queue Status</p>
                  <p className={`font-semibold ${titleTextClass}`}>
                    {String(
                      currentQueueSnapshot?.queueStatus || "active_repeat",
                    )
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (m) => m.toUpperCase())}
                  </p>
                </div>
                <div
                  className={`rounded-lg p-2 ${
                    isDarkMode ? "bg-slate-900/40" : "bg-white/80"
                  }`}
                >
                  <p className={mutedTextClass}>Next Window</p>
                  <p className={`font-semibold ${titleTextClass}`}>
                    {currentQueueSnapshot?.timerFrameLabel ||
                      timerFrameLabelFromSec(questionRepeatInSeconds)}
                  </p>
                </div>
                <div
                  className={`rounded-lg p-2 ${
                    isDarkMode ? "bg-slate-900/40" : "bg-white/80"
                  }`}
                >
                  <p className={mutedTextClass}>Retention Score</p>
                  <p className={`font-semibold ${titleTextClass}`}>
                    {Number(
                      firstDefined(currentQueueSnapshot?.retentionScore, 0),
                    )}
                    %
                  </p>
                </div>
              </div>
            </div>
          )}

          <div
            className={
              isRepeatedQuestion
                ? `relative ${isFocusMode ? "mt-4" : "mt-6"}`
                : isFocusMode
                  ? "mt-4"
                  : "mt-6"
            }
          >
            {isRepeatedQuestion && !isFocusMode && (
              <>
                <div className="pointer-events-none absolute -inset-[2px] rounded-[1.7rem] bg-[conic-gradient(from_0deg,_#f43f5e,_#f97316,_#facc15,_#22d3ee,_#6366f1,_#ec4899,_#f43f5e)] opacity-95 animate-[spin_9s_linear_infinite]" />
                <div className="pointer-events-none absolute -inset-[3px] rounded-[1.85rem] bg-[conic-gradient(from_190deg,_#fb7185,_#f59e0b,_#34d399,_#38bdf8,_#a78bfa,_#fb7185)] opacity-55 blur-md animate-[spin_12s_linear_infinite_reverse]" />
              </>
            )}

            <div
              className={
                isRepeatedQuestion
                  ? `relative rounded-[1.55rem] border p-4 sm:p-5 ${
                      isDarkMode
                        ? "border-rose-400/40 bg-slate-950/85"
                        : "border-rose-200/80 bg-white/95"
                    }`
                  : isFocusMode
                    ? `relative rounded-[1.35rem] border p-4 sm:p-5 ${
                        isDarkMode
                          ? "border-sky-500/30 bg-slate-950/75"
                          : "border-sky-200 bg-white/95"
                      }`
                    : ""
              }
            >
              {/* Question Text */}
              <div className={repeatedQuestionPanelClass}>
                <p
                  className={`text-lg font-semibold leading-relaxed ${
                    isFocusMode ? "text-xl sm:text-2xl" : ""
                  } ${
                    isRepeatedQuestion
                      ? isDarkMode
                        ? "text-rose-100"
                        : "text-rose-950"
                      : titleTextClass
                  }`}
                >
                  {currentQuestion.text || "Question text unavailable"}
                </p>

                {isFocusMode && (
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] font-semibold">
                    <div
                      className={`rounded-lg px-2 py-1 text-center ${
                        isDarkMode
                          ? "bg-slate-800 text-slate-200"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      1. Recall
                    </div>
                    <div
                      className={`rounded-lg px-2 py-1 text-center ${
                        isDarkMode
                          ? "bg-slate-800 text-slate-200"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      2. Eliminate
                    </div>
                    <div
                      className={`rounded-lg px-2 py-1 text-center ${
                        isDarkMode
                          ? "bg-slate-800 text-slate-200"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      3. Commit
                    </div>
                  </div>
                )}
              </div>

              {/* Options */}
              <div
                className={`${isFocusMode ? "mt-4 space-y-2" : "mt-6 space-y-3"}`}
              >
                {(currentQuestion.options || []).map((option, index) => {
                  const value = option.value ?? option.id ?? option;
                  const label = option.label ?? option.text ?? String(option);
                  const active = selectedAnswer === value;
                  const optionTag = String.fromCharCode(65 + index);

                  const answerKey =
                    result?.correctAnswer ?? currentQuestion.correctAnswer;
                  const answerList = Array.isArray(answerKey)
                    ? answerKey
                    : [answerKey];
                  const normalizedAnswerList = answerList.map((item) =>
                    String(item ?? "")
                      .trim()
                      .toLowerCase(),
                  );
                  const normalizedValue = String(value ?? "")
                    .trim()
                    .toLowerCase();
                  const normalizedLabel = String(label ?? "")
                    .trim()
                    .toLowerCase();
                  const isCorrectOption =
                    normalizedAnswerList.includes(normalizedValue) ||
                    normalizedAnswerList.includes(normalizedLabel);
                  const isWrongSelected =
                    Boolean(hasAnsweredCurrent || result) &&
                    active &&
                    !isCorrectOption;

                  const repeatedDefaultClass =
                    repeatedOptionPalette[index % repeatedOptionPalette.length];

                  const optionClass =
                    isCorrectOption && (hasAnsweredCurrent || result)
                      ? "border-emerald-500 bg-emerald-50 shadow-md"
                      : isWrongSelected
                        ? "border-rose-500 bg-rose-50 shadow-md"
                        : active
                          ? isRepeatedQuestion
                            ? "border-fuchsia-500 bg-gradient-to-r from-fuchsia-100 via-rose-100 to-amber-100 shadow-lg ring-2 ring-fuchsia-200"
                            : "border-sky-500 bg-gradient-to-r from-sky-50 to-indigo-50 shadow-md"
                          : isRepeatedQuestion
                            ? `${repeatedDefaultClass} shadow-sm transition-all hover:shadow-md`
                            : optionDefaultClass;

                  const focusModeOptionClass = isFocusMode
                    ? isDarkMode
                      ? "shadow-[0_4px_14px_rgba(2,132,199,0.12)] hover:shadow-[0_6px_18px_rgba(56,189,248,0.16)]"
                      : "shadow-[0_4px_12px_rgba(59,130,246,0.1)] hover:shadow-[0_6px_18px_rgba(56,189,248,0.14)]"
                    : "";

                  const tagClass =
                    isCorrectOption && (hasAnsweredCurrent || result)
                      ? "bg-emerald-600 text-white"
                      : isWrongSelected
                        ? "bg-rose-600 text-white"
                        : active
                          ? isRepeatedQuestion
                            ? "bg-gradient-to-r from-fuchsia-600 to-rose-600 text-white"
                            : "bg-sky-600 text-white"
                          : isRepeatedQuestion
                            ? "bg-gradient-to-r from-rose-500 to-fuchsia-500 text-white"
                            : "bg-slate-200 text-slate-700";

                  return (
                    <button
                      key={`${value}-${index}`}
                      type="button"
                      onClick={() => selectOption(value)}
                      className={`w-full rounded-2xl border text-left transition-all ${isFocusMode ? "px-5 py-3" : "px-6 py-4"} ${optionClass} ${focusModeOptionClass}`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${tagClass}`}
                        >
                          {optionTag}
                        </span>
                        <span
                          className={`font-medium ${isFocusMode ? "text-base sm:text-lg" : ""}`}
                        >
                          {label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Question Controls: intentionally placed right under options */}
              <div
                className={`mt-4 rounded-2xl border p-4 ${
                  isDarkMode
                    ? "border-slate-700 bg-gradient-to-r from-slate-900/80 to-slate-800/70"
                    : "border-slate-200 bg-gradient-to-r from-slate-50 to-indigo-50"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <p
                    className={`font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-800"}`}
                  >
                    {isFocusMode
                      ? "Focus flow: select, submit, reflect, continue"
                      : "Answer flow: choose one option, submit, then move next"}
                  </p>
                  <span
                    className={`rounded-full px-2 py-1 font-semibold ${
                      isDarkMode
                        ? "bg-rose-900/40 text-rose-200"
                        : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    Due now: {retentionQueueSummary.dueNowCount}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={
                      paused ||
                      isSubmitting ||
                      selectedAnswer === null ||
                      hasAnsweredCurrent ||
                      submitLockRef.current
                    }
                    onClick={submitCurrentAnswer}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-3 font-bold text-white shadow-lg transition-all hover:from-slate-800 hover:to-slate-700 disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-400"
                  >
                    <FiSend className="h-4 w-4" />
                    {isSubmitting ? "Analyzing..." : "Submit Answer"}
                  </button>
                  <button
                    type="button"
                    disabled={
                      loadingNext || isSubmitting || !hasAnsweredCurrent
                    }
                    onClick={() => loadNextQuestion({ fromNextButton: true })}
                    className={`flex items-center gap-2 rounded-xl px-6 py-3 font-semibold shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                      isDarkMode
                        ? "border border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700"
                        : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <FiArrowRight className="h-4 w-4" />
                    {loadingNext ? "Loading..." : "Next Question"}
                  </button>
                  <button
                    type="button"
                    onClick={toggleHint}
                    disabled={hasAnsweredCurrent || isSubmitting}
                    className={`rounded-xl px-4 py-2 text-sm font-medium ${
                      isDarkMode
                        ? "border border-slate-600 bg-slate-800 text-sky-300 hover:text-sky-200 disabled:text-slate-500"
                        : "border border-slate-300 bg-white text-sky-700 hover:text-sky-800 disabled:text-slate-400"
                    }`}
                  >
                    Need a hint?
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* AI Insights Bar */}
          {!isFocusMode && (
            <div
              className={`mt-6 rounded-2xl border p-4 ${
                isDarkMode
                  ? "border-slate-700 bg-gradient-to-r from-indigo-900/30 to-violet-900/20"
                  : "border-slate-200 bg-gradient-to-r from-indigo-50 to-purple-50"
              }`}
            >
              <div className="flex items-center gap-2 text-sm">
                <FiCpu
                  className={`h-5 w-5 ${isDarkMode ? "text-indigo-300" : "text-indigo-600"}`}
                />
                {!analysisReady ? (
                  <p
                    className={isDarkMode ? "text-slate-200" : "text-slate-700"}
                  >
                    {analysisMeta?.micro_sequence_windows
                      ? `Model warmup: ${analysisMeta.micro_sequence_windows}/${analysisMeta.micro_required_windows} windows`
                      : "Learning from your responses..."}
                  </p>
                ) : (
                  <p
                    className={isDarkMode ? "text-slate-200" : "text-slate-700"}
                  >
                    Predictions are live. Open analytics to view Question,
                    Subject, and Strategy insights.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-4 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <div className="flex items-center gap-2">
                <FiAlertCircle className="h-4 w-4" />
                {error}
              </div>
            </div>
          )}

          {/* Result Display */}
          {result && (
            <div
              className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
                result.isCorrect
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-amber-300 bg-amber-50 text-amber-700"
              }`}
            >
              <div className="flex items-start gap-2">
                {result.isCorrect ? (
                  <FiCheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                ) : (
                  <FiXCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                )}
                <div>
                  <p className="font-semibold">
                    {result.isCorrect ? "Correct!" : "Incorrect"}
                  </p>
                  <p className={`mt-1 ${isFocusMode ? "line-clamp-2" : ""}`}>
                    {result.explanation ||
                      "Detailed explanation is unavailable for this question."}
                  </p>
                  {isFocusMode && autoAdvanceSecondsLeft > 0 && (
                    <p className="mt-2 rounded-lg bg-white/70 px-2 py-1 text-xs font-semibold text-slate-700">
                      Moving to next question in {autoAdvanceSecondsLeft}s...
                    </p>
                  )}
                  {!isFocusMode && result.solutionSteps && (
                    <div className="mt-2 rounded-lg bg-white/50 p-2">
                      <p className="font-medium">Solution:</p>
                      <p className="text-xs">{result.solutionSteps}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Session Submission (Separated) */}
          {!isFocusMode && (
            <div
              className={`mt-6 rounded-2xl border p-4 ${
                isDarkMode
                  ? "border-indigo-700/50 bg-indigo-950/20"
                  : "border-indigo-200 bg-indigo-50/80"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p
                    className={`text-sm font-bold ${isDarkMode ? "text-indigo-100" : "text-indigo-900"}`}
                  >
                    {"Finish Session & View Analytics"}
                  </p>
                  <p className={`text-xs ${mutedTextClass}`}>
                    {
                      "Use this after completing your question cycle. This action is intentionally separated from per-question flow."
                    }
                  </p>
                </div>
                <button
                  type="button"
                  disabled={
                    isSubmitting ||
                    loadingNext ||
                    isFinishingSession ||
                    Number(metrics.questionsAnswered || 0) === 0
                  }
                  onClick={submitSessionAndViewAnalytics}
                  className={`flex items-center gap-2 rounded-xl px-6 py-3 font-semibold shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                    isDarkMode
                      ? "border border-indigo-400/50 bg-indigo-900/40 text-indigo-100 hover:bg-indigo-900/60"
                      : "border border-indigo-300 bg-indigo-100 text-indigo-800 hover:bg-indigo-200"
                  }`}
                >
                  <FiBarChart2 className="h-4 w-4" />
                  {isFinishingSession
                    ? "Submitting Session..."
                    : "Submit Session"}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Analytics Panel */}
        {analyticsOpen && (
          <aside
            className={`rounded-3xl border p-5 shadow-lg transition-all ${
              isDarkMode
                ? "border-slate-700 bg-slate-900/80"
                : "border-slate-200 bg-white"
            }`}
          >
            <div
              className={`rounded-2xl border p-4 ${
                isDarkMode
                  ? "border-indigo-700/60 bg-gradient-to-r from-indigo-900/40 to-sky-900/30"
                  : "border-indigo-200 bg-gradient-to-r from-indigo-50 to-sky-50"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3
                  className={`text-sm font-bold ${
                    isDarkMode ? "text-indigo-100" : "text-indigo-900"
                  }`}
                >
                  Retention Recommendation
                </h3>
                <span
                  className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                    isDarkMode
                      ? "bg-indigo-900/60 text-indigo-200"
                      : "bg-indigo-100 text-indigo-800"
                  }`}
                >
                  {currentRetentionReview?.retentionTag ||
                    getBatchTypeLabel(questionBatchType)}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                <div
                  className={`rounded-lg p-2 ${isDarkMode ? "bg-slate-800" : "bg-white"}`}
                >
                  <p className={mutedTextClass}>Retention Probability</p>
                  <p className={`text-sm font-semibold ${titleTextClass}`}>
                    {Math.round(questionRetentionProbability * 100)}%
                  </p>
                </div>
                <div
                  className={`rounded-lg p-2 ${isDarkMode ? "bg-slate-800" : "bg-white"}`}
                >
                  <p className={mutedTextClass}>Next Difficulty</p>
                  <p className={`text-sm font-semibold ${titleTextClass}`}>
                    {getDifficultyLabel(questionNextDifficulty)}
                  </p>
                </div>
                <div
                  className={`rounded-lg p-2 ${isDarkMode ? "bg-slate-800" : "bg-white"}`}
                >
                  <p className={mutedTextClass}>Probability Correct Next</p>
                  <p className={`text-sm font-semibold ${titleTextClass}`}>
                    {Math.round(questionProbabilityCorrectNext * 100)}%
                  </p>
                </div>
                <div
                  className={`rounded-lg p-2 ${isDarkMode ? "bg-slate-800" : "bg-white"}`}
                >
                  <p className={mutedTextClass}>Stress Impact</p>
                  <p className={`text-sm font-semibold ${titleTextClass}`}>
                    {Math.round(questionStressImpact * 100)}%
                  </p>
                </div>
                <div
                  className={`rounded-lg p-2 ${isDarkMode ? "bg-slate-800" : "bg-white"}`}
                >
                  <p className={mutedTextClass}>Fatigue Level</p>
                  <p className={`text-sm font-semibold ${titleTextClass}`}>
                    {Math.round(questionFatigueLevel * 100)}%
                  </p>
                </div>
                <div
                  className={`rounded-lg p-2 ${isDarkMode ? "bg-slate-800" : "bg-white"}`}
                >
                  <p className={mutedTextClass}>Review Schedule</p>
                  <p className={`text-sm font-semibold ${titleTextClass}`}>
                    {getBatchTypeLabel(questionBatchType)}
                  </p>
                </div>
              </div>

              <p
                className={`mt-3 text-xs font-medium ${
                  isDarkMode ? "text-indigo-200" : "text-indigo-900"
                }`}
              >
                {revisionAvailabilityLabel}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <h2 className={`mt-5 text-lg font-bold ${titleTextClass}`}>
                Learning Analytics
              </h2>
              <span className="rounded-full bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-800">
                AI-Powered
              </span>
            </div>

            <p className={`mt-1 text-xs ${mutedTextClass}`}>
              Real-time learning insights from your current session
            </p>

            {/* Model Training Status */}
            <div className="mt-4 flex gap-2">
              {Object.entries(modelTrainingStatus).map(([model, trained]) => (
                <div
                  key={model}
                  className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs ${
                    trained
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${
                      trained ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                  {getInsightTierLabel(model)}
                </div>
              ))}
            </div>

            {/* Session Metrics Grid */}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3">
                <p className="text-xs uppercase tracking-widest text-slate-500">
                  Accuracy
                </p>
                <p className="mt-1 text-2xl font-black text-slate-900">
                  {Math.round(metrics.overallAccuracy || 0)}%
                </p>
                <p className="text-xs text-slate-500">
                  {metrics.correctAnswers} / {metrics.questionsAnswered} correct
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3">
                <p className="text-xs uppercase tracking-widest text-slate-500">
                  Streak
                </p>
                <p className="mt-1 text-2xl font-black text-slate-900">
                  {metrics.currentStreak || 0}
                </p>
                <p className="text-xs text-slate-500">
                  {wrongStreak > 0 ? `${wrongStreak} wrong` : "Perfect!"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3">
                <p className="text-xs uppercase tracking-widest text-slate-500">
                  Recent Accuracy
                </p>
                <p className="mt-1 text-2xl font-black text-slate-900">
                  {Math.round(metrics.recentAccuracy || 0)}%
                </p>
                <p className="text-xs text-slate-500">Last 10 questions</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3">
                <p className="text-xs uppercase tracking-widest text-slate-500">
                  Avg Response
                </p>
                <p className="mt-1 text-2xl font-black text-slate-900">
                  {toClock(
                    Math.round(
                      toNumberSafe(metrics.averageResponseTime, 0) / 1000,
                    ),
                  )}
                </p>
                <p className="text-xs text-slate-500">Per question</p>
              </div>
            </div>

            {/* Micro LSTM - Topic Level */}
            {analysisReady && (
              <>
                <div className="mt-6 rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-4">
                  <div className="flex items-center gap-2">
                    <FiBookOpen className="h-4 w-4 text-sky-600" />
                    <h3 className="font-semibold text-sky-900">Topic Level</h3>
                  </div>

                  <div className="mt-3 space-y-3">
                    {/* Retention Probability */}
                    <div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-600">
                          Retention Probability
                        </span>
                        <span
                          className="font-medium"
                          style={{
                            color: getRetentionColor(displayMicroRetention),
                          }}
                        >
                          {Math.round(displayMicroRetention * 100)}%
                        </span>
                      </div>
                      <div className="mt-1 h-2 w-full rounded-full bg-slate-200">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${displayMicroRetention * 100}%`,
                            backgroundColor: getRetentionColor(
                              displayMicroRetention,
                            ),
                          }}
                        />
                      </div>
                    </div>

                    {/* Next Question Difficulty */}
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600">
                        Next Question Difficulty
                      </span>
                      <span className="font-medium text-slate-900">
                        {getDifficultyLabel(microLSTM.nextQuestionDifficulty)}
                      </span>
                    </div>

                    {/* Probability Correct Next */}
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600">
                        Probability Correct Next
                      </span>
                      <span className="font-medium text-slate-900">
                        {Math.round(displayProbabilityCorrectNext * 100)}%
                      </span>
                    </div>

                    {/* Stress & Fatigue */}
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <div className="rounded-lg bg-white p-2">
                        <p className="text-xs text-slate-500">Stress Impact</p>
                        <p className="text-sm font-medium text-slate-900">
                          {Math.round(microLSTM.stressImpact * 100)}%
                        </p>
                      </div>
                      <div className="rounded-lg bg-white p-2">
                        <p className="text-xs text-slate-500">Fatigue Level</p>
                        <p className="text-sm font-medium text-slate-900">
                          {Math.round(microLSTM.fatigueLevel * 100)}%
                        </p>
                      </div>
                    </div>

                    {/* Batch Type */}
                    <div className="rounded-lg bg-white p-2">
                      <p className="text-xs text-slate-500">Review Schedule</p>
                      <p className="text-sm font-medium text-slate-900">
                        {getBatchTypeLabel(microLSTM.batchType)}
                        {` (${timerFrameLabelFromSec(
                          firstDefined(
                            flaskMetrics?.repeatInSeconds,
                            flaskMetrics?.timerFrameSeconds,
                            microLSTM.repeatInDays * 86400,
                          ),
                        )})`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Meso LSTM - Subject Level */}
                <div className="mt-4 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4">
                  <div className="flex items-center gap-2">
                    <FiTrendingUp className="h-4 w-4 text-indigo-600" />
                    <h3 className="font-semibold text-indigo-900">
                      Subject Level
                    </h3>
                  </div>

                  <div className="mt-3 space-y-3">
                    {/* Subject Retention Score */}
                    <div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-600">
                          Subject Retention Score
                        </span>
                        <span className="font-medium text-indigo-700">
                          {Math.round(displaySubjectRetention * 100)}%
                        </span>
                      </div>
                      <div className="mt-1 h-2 w-full rounded-full bg-slate-200">
                        <div
                          className="h-2 rounded-full bg-indigo-500"
                          style={{
                            width: `${displaySubjectRetention * 100}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Retention Horizons */}
                    <div className="grid grid-cols-3 gap-1 pt-2">
                      <div className="rounded bg-white p-2 text-center">
                        <p className="text-xs text-slate-500">7 Days</p>
                        <p className="text-sm font-medium text-slate-900">
                          {Math.round(displayRetention7d * 100)}%
                        </p>
                      </div>
                      <div className="rounded bg-white p-2 text-center">
                        <p className="text-xs text-slate-500">30 Days</p>
                        <p className="text-sm font-medium text-slate-900">
                          {Math.round(displayRetention30d * 100)}%
                        </p>
                      </div>
                      <div className="rounded bg-white p-2 text-center">
                        <p className="text-xs text-slate-500">90 Days</p>
                        <p className="text-sm font-medium text-slate-900">
                          {Math.round(displayRetention90d * 100)}%
                        </p>
                      </div>
                    </div>

                    {/* Revision Priority */}
                    {displayTopicRevisionPriority.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-500">
                          Next Topics to Review
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {displayTopicRevisionPriority
                            .slice(0, 3)
                            .map((topic, i) => (
                              <span
                                key={i}
                                className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800"
                              >
                                {topic}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Optimal Revision Interval */}
                    <div className="flex items-center justify-between rounded-lg bg-white p-2">
                      <span className="text-xs text-slate-500">
                        Optimal Revision
                      </span>
                      <span className="text-sm font-medium text-indigo-700">
                        {mesoLSTM.optimalRevisionIntervalDays} days
                      </span>
                    </div>
                  </div>
                </div>

                {/* Macro LSTM - Learning Path */}
                <div className="mt-4 rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-white p-4">
                  <div className="flex items-center gap-2">
                    <FiCalendar className="h-4 w-4 text-purple-600" />
                    <h3 className="font-semibold text-purple-900">
                      Learning Path
                    </h3>
                  </div>

                  <div className="mt-3 space-y-3">
                    {/* Long-term Retention */}
                    <div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-600">
                          Long-term Retention
                        </span>
                        <span className="font-medium text-purple-700">
                          {Math.round(
                            macroLSTM.predictedLongTermRetentionScore * 100,
                          )}
                          %
                        </span>
                      </div>
                      <div className="mt-1 h-2 w-full rounded-full bg-slate-200">
                        <div
                          className="h-2 rounded-full bg-purple-500"
                          style={{
                            width: `${macroLSTM.predictedLongTermRetentionScore * 100}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Fatigue Risk */}
                    <div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Fatigue Risk</span>
                        <span
                          className={`font-medium ${
                            macroLSTM.fatigueRiskProbability > 0.7
                              ? "text-rose-600"
                              : macroLSTM.fatigueRiskProbability > 0.4
                                ? "text-amber-600"
                                : "text-emerald-600"
                          }`}
                        >
                          {Math.round(macroLSTM.fatigueRiskProbability * 100)}%
                        </span>
                      </div>
                      <div className="mt-1 h-2 w-full rounded-full bg-slate-200">
                        <div
                          className={`h-2 rounded-full ${
                            macroLSTM.fatigueRiskProbability > 0.7
                              ? "bg-rose-500"
                              : macroLSTM.fatigueRiskProbability > 0.4
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                          }`}
                          style={{
                            width: `${macroLSTM.fatigueRiskProbability * 100}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Burnout Status */}
                    <div className="flex items-center justify-between rounded-lg bg-white p-2">
                      <span className="text-xs text-slate-500">
                        Burnout Risk
                      </span>
                      <span
                        className={`text-sm font-medium ${
                          macroLSTM.burnoutStatus === "high"
                            ? "text-rose-600"
                            : macroLSTM.burnoutStatus === "moderate"
                              ? "text-amber-600"
                              : "text-emerald-600"
                        }`}
                      >
                        {macroLSTM.burnoutStatus.charAt(0).toUpperCase() +
                          macroLSTM.burnoutStatus.slice(1)}
                      </span>
                    </div>

                    {/* Recommended Break */}
                    {macroLSTM.recommendedBreakMinutes > 0 && (
                      <div className="flex items-center justify-between rounded-lg bg-white p-2">
                        <span className="text-xs text-slate-500">
                          Recommended Break
                        </span>
                        <span className="text-sm font-medium text-purple-700">
                          {macroLSTM.recommendedBreakMinutes} minutes
                        </span>
                      </div>
                    )}

                    {/* Subject Priority */}
                    {macroLSTM.subjectPriorityOrder.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-500">
                          Subject Priority
                        </p>
                        <div className="mt-1 flex gap-2">
                          {macroLSTM.subjectPriorityOrder.map((subject, i) => (
                            <span
                              key={i}
                              className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800"
                            >
                              {subject}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Weekly Schedule */}
                    {macroLSTM.optimalDailyStudySchedule.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-500">
                          Optimal Study Days
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {macroLSTM.optimalDailyStudySchedule.map((day, i) => (
                            <span
                              key={i}
                              className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800"
                            >
                              {day}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Loading State */}
            {!analysisReady && (
              <div
                className={`mt-6 flex flex-col items-center justify-center rounded-xl p-8 text-center ${
                  isDarkMode ? "bg-slate-800/80" : "bg-slate-50"
                }`}
              >
                <FiRefreshCw className="h-8 w-8 animate-spin text-sky-500" />
                <p className={`mt-2 text-sm ${mutedTextClass}`}>
                  Building your personalized model...
                </p>
                <p className={`mt-1 text-xs ${mutedTextClass}`}>
                  Answer a few more questions for better predictions
                </p>
              </div>
            )}

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() =>
                retentionService
                  .getFlaskLivePredictions(
                    activeSubjectKey || null,
                    currentSessionId,
                  )
                  .then((res) => {
                    if (res.success) {
                      processModelOutputs({
                        predictions: res.predictions || {},
                        modelOutputs: res.modelOutputs || {},
                        modelsReady: res.modelsReady || {},
                        trainingNeeded: res.trainingNeeded || {},
                        sequenceStatus: res.sequenceStatus || {},
                        liveAnalysis: res.liveAnalysis || {},
                      });
                    }
                  })
              }
              className={`mt-4 w-full rounded-lg px-3 py-2 text-xs font-medium ${
                isDarkMode
                  ? "border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              Refresh Predictions
            </button>
          </aside>
        )}
      </div>

      {!isFocusMode && (
        <section
          className={`mx-auto mt-6 w-full max-w-[1400px] rounded-3xl border p-4 shadow-md ${
            isDarkMode
              ? "border-slate-700 bg-slate-900/80"
              : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3
              className={`text-sm font-bold uppercase tracking-[0.18em] ${
                isDarkMode ? "text-slate-200" : "text-slate-700"
              }`}
            >
              Retention Queue
            </h3>
            <div className="flex items-center gap-2 text-[11px] font-semibold">
              <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-700">
                Due now: {retentionQueueSummary.dueNowCount}
              </span>
              <span className="rounded-full bg-fuchsia-100 px-2 py-1 text-fuchsia-700">
                Overdue Scheduled: {retentionQueueSummary.overdueScheduledCount}
              </span>
              <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">
                Pending: {retentionQueueSummary.pendingCount}
              </span>
              <span className="rounded-full bg-sky-100 px-2 py-1 text-sky-700">
                Scheduled: {retentionQueueSummary.scheduledCount}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                Total: {retentionQueueSummary.total}
              </span>
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 to-indigo-50 px-4 py-3 text-xs font-medium text-sky-900">
            <span className="font-semibold">Scheduler Insight:</span>{" "}
            {globalRetentionMessage}
          </div>

          <div
            className={`mt-4 rounded-2xl border p-4 ${
              isDarkMode
                ? "border-slate-700 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/30"
                : "border-indigo-200 bg-gradient-to-br from-white via-indigo-50/60 to-sky-50/70"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p
                  className={`text-xs font-bold uppercase tracking-[0.2em] ${
                    isDarkMode ? "text-indigo-300" : "text-indigo-700"
                  }`}
                >
                  Question Retention Graph
                </p>
                <p className={`mt-1 text-xs ${mutedTextClass}`}>
                  Hover points to compare retention score and concept mastery
                  for each queued question.
                </p>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-semibold">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${
                    isDarkMode
                      ? "bg-emerald-900/40 text-emerald-200"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Retention
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${
                    isDarkMode
                      ? "bg-fuchsia-900/40 text-fuchsia-200"
                      : "bg-fuchsia-100 text-fuchsia-800"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-fuchsia-500" />
                  Concept Mastery
                </span>
              </div>
            </div>

            {retentionGraphData.points.length === 0 ? (
              <div
                className={`mt-3 rounded-xl border border-dashed px-4 py-5 text-center text-xs ${
                  isDarkMode
                    ? "border-slate-600 bg-slate-900/70 text-slate-300"
                    : "border-slate-300 bg-white text-slate-600"
                }`}
              >
                Submit a few answers to populate this graph.
              </div>
            ) : (
              <div className="mt-3">
                <div
                  className={`relative overflow-hidden rounded-xl border p-3 ${
                    isDarkMode
                      ? "border-slate-700 bg-slate-950/70"
                      : "border-slate-200 bg-white/90"
                  }`}
                  onMouseLeave={() => setRetentionChartHoverIndex(-1)}
                >
                  <svg
                    viewBox="0 0 100 100"
                    className="h-56 w-full"
                    role="img"
                    aria-label="Question retention and concept mastery graph"
                  >
                    <line
                      x1="4"
                      y1="96"
                      x2="96"
                      y2="96"
                      stroke="#94a3b8"
                      strokeWidth="0.5"
                    />
                    <line
                      x1="4"
                      y1="73.5"
                      x2="96"
                      y2="73.5"
                      stroke="#cbd5e1"
                      strokeWidth="0.35"
                      strokeDasharray="1.2 1.2"
                    />
                    <line
                      x1="4"
                      y1="51"
                      x2="96"
                      y2="51"
                      stroke="#cbd5e1"
                      strokeWidth="0.35"
                      strokeDasharray="1.2 1.2"
                    />
                    <line
                      x1="4"
                      y1="28.5"
                      x2="96"
                      y2="28.5"
                      stroke="#cbd5e1"
                      strokeWidth="0.35"
                      strokeDasharray="1.2 1.2"
                    />
                    <line
                      x1="4"
                      y1="6"
                      x2="96"
                      y2="6"
                      stroke="#cbd5e1"
                      strokeWidth="0.35"
                      strokeDasharray="1.2 1.2"
                    />

                    <path
                      d={retentionGraphData.retentionPath}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="1.25"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d={retentionGraphData.masteryPath}
                      fill="none"
                      stroke="#d946ef"
                      strokeWidth="1.25"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {retentionGraphData.points.map((point) => (
                      <g key={`r-${point.id}`}>
                        <circle
                          cx={point.x}
                          cy={point.yRetention}
                          r="1.5"
                          fill="#10b981"
                          className="cursor-pointer"
                          onMouseEnter={() =>
                            setRetentionChartHoverIndex(point.index)
                          }
                          onFocus={() =>
                            setRetentionChartHoverIndex(point.index)
                          }
                        />
                        <circle
                          cx={point.x}
                          cy={point.yMastery}
                          r="1.5"
                          fill="#d946ef"
                          className="cursor-pointer"
                          onMouseEnter={() =>
                            setRetentionChartHoverIndex(point.index)
                          }
                          onFocus={() =>
                            setRetentionChartHoverIndex(point.index)
                          }
                        />
                      </g>
                    ))}
                  </svg>

                  {hoveredRetentionPoint && (
                    <div
                      className={`pointer-events-none absolute z-10 max-w-xs -translate-x-1/2 rounded-xl border px-3 py-2 text-xs shadow-xl ${
                        isDarkMode
                          ? "border-slate-600 bg-slate-900 text-slate-100"
                          : "border-slate-200 bg-white text-slate-800"
                      }`}
                      style={{
                        left: `${hoveredRetentionPoint.x}%`,
                        top: `${Math.max(6, Math.min(74, hoveredRetentionPoint.yRetention - 28))}%`,
                      }}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-500">
                        {hoveredRetentionPoint.label} •{" "}
                        {hoveredRetentionPoint.topicCategory}
                      </p>
                      <p className="mt-1 line-clamp-3 text-[12px] font-semibold leading-relaxed">
                        "{hoveredRetentionPoint.questionText}"
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700">
                          <p className="text-[10px] font-semibold uppercase tracking-wide">
                            Retention
                          </p>
                          <p className="text-sm font-bold">
                            {hoveredRetentionPoint.retentionScore}%
                          </p>
                        </div>
                        <div className="rounded-md bg-fuchsia-50 px-2 py-1 text-fuchsia-700">
                          <p className="text-[10px] font-semibold uppercase tracking-wide">
                            Concept Mastery
                          </p>
                          <p className="text-sm font-bold">
                            {hoveredRetentionPoint.conceptMastery}%
                          </p>
                        </div>
                      </div>
                      {hoveredRetentionPoint.optionsText && (
                        <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-slate-500">
                          Options: {hoveredRetentionPoint.optionsText}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div
                  className={`mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] ${
                    isDarkMode ? "text-slate-400" : "text-slate-600"
                  }`}
                  onMouseLeave={() => setRetentionChartHoverIndex(-1)}
                >
                  {retentionGraphData.points.map((point) => (
                    <button
                      key={`label-${point.id}`}
                      type="button"
                      onMouseEnter={() =>
                        setRetentionChartHoverIndex(point.index)
                      }
                      onFocus={() => setRetentionChartHoverIndex(point.index)}
                      className={`rounded-md px-2 py-1 transition-colors ${
                        retentionChartHoverIndex === point.index
                          ? isDarkMode
                            ? "bg-slate-700 text-slate-100"
                            : "bg-slate-200 text-slate-900"
                          : isDarkMode
                            ? "hover:bg-slate-800"
                            : "hover:bg-slate-100"
                      }`}
                    >
                      {point.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {visibleRetentionRows.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center">
              <p className="text-xs font-medium text-slate-600">
                Smart queue is empty right now.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                As you submit answers, each question gets one unique repeat
                timer and appears here until repeated.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleRetentionRows.map((row) => {
                const dueAtMs = toQueueMs(row.nextRepeatAt);
                const remainingMs = Math.max(0, dueAtMs - Date.now());
                const isOverdueScheduled =
                  row.queueStatus === "scheduled" && remainingMs === 0;
                const timerText =
                  remainingMs === 0 ? "Due now" : toCountdownLabel(remainingMs);
                const status = isOverdueScheduled
                  ? "Overdue Scheduled"
                  : row.queueStatus === "scheduled"
                    ? "Scheduled"
                    : remainingMs === 0
                      ? "Ready"
                      : "Pending";
                const statusClass =
                  status === "Overdue Scheduled"
                    ? "bg-fuchsia-600 text-white"
                    : status === "Scheduled"
                      ? "bg-sky-100 text-sky-700"
                      : status === "Ready"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-amber-100 text-amber-700";
                const paletteClass =
                  status === "Overdue Scheduled"
                    ? "border-fuchsia-300 bg-gradient-to-br from-fuchsia-50 via-rose-50 to-white ring-1 ring-fuchsia-200"
                    : status === "Scheduled"
                      ? "border-sky-200 bg-gradient-to-br from-sky-50 via-cyan-50 to-white"
                      : status === "Ready"
                        ? "border-rose-200 bg-gradient-to-br from-rose-50 via-orange-50 to-white"
                        : "border-amber-200 bg-gradient-to-br from-amber-50 via-yellow-50 to-white";
                const progress = Math.max(
                  0,
                  Math.min(
                    100,
                    Math.round(
                      (Number(row.retentionScore || 0) / Math.max(1, 100)) *
                        100,
                    ),
                  ),
                );

                return (
                  <div
                    key={row.id}
                    className={`rounded-2xl border p-3 shadow-sm ${paletteClass}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-xs font-semibold leading-relaxed text-slate-900">
                        {row.questionText}
                      </p>
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold ${statusClass}`}
                        >
                          {status}
                        </span>
                        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">
                          Repeat{" "}
                          {Math.min(
                            Number(row.repeatsDone || 0) + 1,
                            MAX_RETENTION_REPEATS,
                          )}
                          /{MAX_RETENTION_REPEATS}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 space-y-1 text-[11px] text-slate-600">
                      {isOverdueScheduled && (
                        <p className="rounded-md bg-fuchsia-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-fuchsia-800">
                          Escalated: this repeat is overdue and being
                          force-prioritized.
                        </p>
                      )}
                      <p>
                        <span className="font-semibold text-slate-800">
                          Timer:
                        </span>{" "}
                        {row.timerFrameLabel || "-"}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-800">
                          Countdown:
                        </span>{" "}
                        {timerText}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-800">
                          Estimated Repeat Time:
                        </span>{" "}
                        {formatEstimatedRepeatStamp(row.nextRepeatAt)}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-800">
                          Queue Tag:
                        </span>{" "}
                        {row.specialTag || row.retentionTag || "Retention"}
                      </p>
                    </div>

                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        <span>Retention Score</span>
                        <span>{Number(row.retentionScore || 0)}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-rose-400 via-amber-400 to-emerald-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {isSubmitDialogOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
          <button
            type="button"
            aria-label="Close submit session dialog"
            onClick={() => setIsSubmitDialogOpen(false)}
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Submit retention session"
            className={`relative w-full max-w-xl rounded-3xl border p-6 shadow-2xl ${
              isDarkMode
                ? "border-slate-700 bg-slate-900 text-slate-100"
                : "border-slate-200 bg-white text-slate-900"
            }`}
          >
            <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-bl-[3rem] bg-gradient-to-b from-indigo-400/30 to-sky-300/10 blur-2xl" />

            <div className="relative">
              <p
                className={`text-xs font-semibold uppercase tracking-[0.2em] ${
                  isDarkMode ? "text-sky-300" : "text-sky-700"
                }`}
              >
                Ready to Finish
              </p>
              <h3 className="mt-2 text-2xl font-black">
                Submit Session & Open Analytics
              </h3>
              <p className={`mt-2 text-sm ${mutedTextClass}`}>
                Your current progress will be finalized, retention signals will
                be saved, and analytics will open immediately.
              </p>

              <div
                className={`mt-4 grid grid-cols-2 gap-3 rounded-2xl border p-3 text-sm ${
                  isDarkMode
                    ? "border-slate-700 bg-slate-950/70"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <div>
                  <p className={mutedTextClass}>Answered</p>
                  <p className="text-lg font-bold">
                    {Number(metrics.questionsAnswered || 0)}
                  </p>
                </div>
                <div>
                  <p className={mutedTextClass}>Accuracy</p>
                  <p className="text-lg font-bold">
                    {Math.round(metrics.overallAccuracy || 0)}%
                  </p>
                </div>
                <div>
                  <p className={mutedTextClass}>Current Streak</p>
                  <p className="text-lg font-bold">
                    {Number(metrics.currentStreak || 0)}
                  </p>
                </div>
                <div>
                  <p className={mutedTextClass}>Queue Pending</p>
                  <p className="text-lg font-bold">
                    {Number(retentionQueueSummary.total || 0)}
                  </p>
                </div>
              </div>

              <div
                className={`mt-4 rounded-xl border px-3 py-2 text-xs ${
                  isDarkMode
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                Tip: You can continue answering if you want richer analytics, or
                submit now to review your current retention pattern.
              </div>

              <div className="mt-5 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsSubmitDialogOpen(false)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                    isDarkMode
                      ? "border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
                      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Continue Session
                </button>
                <button
                  type="button"
                  disabled={isFinishingSession || isSubmitting || loadingNext}
                  onClick={confirmSubmitSession}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 px-5 py-2 text-sm font-bold text-white shadow-md transition hover:from-indigo-700 hover:to-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FiBarChart2 className="h-4 w-4" />
                  {isFinishingSession ? "Submitting..." : "Yes, Submit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RetentionPageInterface;
