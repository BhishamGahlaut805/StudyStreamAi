const RetentionSession = require("../models/RetentionSession");
const RetentionMetrics = require("../models/RetentionMetrics");
const QuestionRepetition = require("../models/QuestionRepetition");
const retentionFlaskService = require("../Services/retentionFlaskService");
const questionBankService = require("../Services/questionBankService");
const retentionAnalyticsController = require("./retentionAnalyticsController");
const { randomUUID } = require("crypto");
const mongoose = require("mongoose");

const SUBJECT_BANK_MAP = {
  english: "english",
  gk: "general_knowledge",
};

const RETENTION_TOPICS = {
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

const toRetentionSubject = (subject) =>
  subject === "general_knowledge" ? "gk" : subject;

const normalizeRetentionTopic = (subject, topic) => {
  const s = String(topic || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (subject === "english") {
    if (s.includes("vocabulary")) return "vocabulary";
    if (s.includes("idiom")) return "idioms";
    if (s.includes("phrase")) return "phrases";
    if (s.includes("synonym")) return "synonyms";
    if (s.includes("antonym")) return "antonyms";
    if (s.includes("one word") || s.includes("substitution"))
      return "one_word_substitution";
    return "vocabulary";
  }

  if (subject === "gk") {
    if (s.includes("history")) return "history";
    if (s.includes("geography")) return "geography";
    if (s.includes("science")) return "science";
    if (s.includes("current") || s.includes("affair")) return "current_affairs";
    return "history";
  }

  return String(topic || "").toLowerCase();
};

const getSessionStartMsSafe = (value) => {
  const ms = new Date(value || 0).getTime();
  return Number.isFinite(ms) ? ms : 0;
};

const wasRepetitionCreatedInSessionTimeline = (repetition, sessionLike) => {
  if (!repetition) return false;
  const sessionStartMs = getSessionStartMsSafe(sessionLike?.startTime);
  if (!(sessionStartMs > 0)) return true;
  const repetitionCreatedMs = new Date(repetition.createdAt || 0).getTime();
  return (
    Number.isFinite(repetitionCreatedMs) &&
    repetitionCreatedMs >= sessionStartMs
  );
};

const isRepetitionInSessionTimeline = (repetition, sessionLike) => {
  if (!repetition) return false;
  if (wasRepetitionCreatedInSessionTimeline(repetition, sessionLike)) {
    return true;
  }

  const sessionId = String(sessionLike?.sessionId || "").trim();
  const sessionStartMs = getSessionStartMsSafe(sessionLike?.startTime);
  const questionId = String(repetition?.questionId || "").trim();

  const answerInSession = (
    Array.isArray(sessionLike?.answers) ? sessionLike.answers : []
  ).some((answer) => {
    if (String(answer?.questionId || "").trim() !== questionId) return false;
    const submittedAtMs = new Date(answer?.submittedAt || 0).getTime();
    if (!(sessionStartMs > 0)) return true;
    return Number.isFinite(submittedAtMs) && submittedAtMs >= sessionStartMs;
  });

  if (answerInSession) return true;

  return (
    Array.isArray(repetition?.retentionHistory)
      ? repetition.retentionHistory
      : []
  ).some((entry) => {
    const entrySessionId = String(entry?.sessionId || "").trim();
    if (sessionId && entrySessionId === sessionId) return true;

    const answeredAtMs = new Date(entry?.answeredAt || 0).getTime();
    if (!(sessionStartMs > 0)) return false;
    return Number.isFinite(answeredAtMs) && answeredAtMs >= sessionStartMs;
  });
};

const toFlaskAnswerRow = (answer, sessionId, rawContext = {}) => ({
  user_id: rawContext.user_id,
  question_id: answer.questionId,
  session_id: sessionId,
  subject: rawContext.subject || answer.subject,
  topic: rawContext.topic || answer.topicCategory,
  topic_id: answer.topicId,
  question_difficulty: Number(
    rawContext.question_difficulty ?? answer.difficulty ?? 0.5,
  ),
  selected_answer: rawContext.selected_answer ?? rawContext.selectedOptions,
  correct_answer_flag: rawContext.correct_answer_flag,
  response_time: Number(rawContext.response_time ?? answer.responseTimeMs ?? 0),
  hint_used: Boolean(rawContext.hint_used || false),
  answer_changes: Number(
    rawContext.answer_changes ?? answer.answerChanges ?? 0,
  ),
  confidence_rating: Number(
    rawContext.confidence_rating ?? answer.confidence ?? 0.5,
  ),
  session_start_time: rawContext.session_start_time,
  device_focus_loss_event: Boolean(rawContext.device_focus_loss_event || false),
  concept_area: answer.topicCategory,
  correct: Boolean(answer.isCorrect),
  time_spent: Number(answer.responseTimeMs || 0),
  response_time_ms: Number(answer.responseTimeMs || 0),
  confidence: Number(answer.confidence || 0.5),
  difficulty: Number(answer.difficulty || 0.5),
  answer_changes: Number(answer.answerChanges || 0),
  hesitation_count: Number(answer.hesitationCount || 0),
  stress_level: Number(answer.stressLevel || 0.3),
  fatigue_index: Number(answer.fatigueIndex || 0.3),
  focus_score: Number(answer.focusScore || 0.7),
  attempt_number: Number(answer.attemptNumber || 1),
  micro_features: normalizeFeatureArray(rawContext.micro_features, 20),
  meso_features: normalizeFeatureArray(rawContext.meso_features, 40),
  macro_features: normalizeFeatureArray(rawContext.macro_features, 40),
  derived_targets: rawContext.derived_targets || {},
  schedule_hint: rawContext.schedule_hint || {},
  quality_signals: rawContext.quality_signals || {},
  client_generated_at: rawContext.client_generated_at,
  timestamp: new Date().toISOString(),
});

const clampRatio = (value, fallback = 0) => {
  const n = Number(value);
  if (!Number.isFinite(n))
    return Math.max(0, Math.min(1, Number(fallback) || 0));
  if (n > 1 && n <= 100) return Math.max(0, Math.min(1, n / 100));
  return Math.max(0, Math.min(1, n));
};

const clampDifficulty = (value, fallback = 3) => {
  const n = Number(value);
  if (!Number.isFinite(n))
    return Math.max(1, Math.min(5, Number(fallback) || 3));
  return Math.max(1, Math.min(5, Math.round(n)));
};

const firstDefined = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
};

const toNumberSafe = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const TIMER_FRAMES_SECONDS = [30, 60, 120, 300, 600, 3600, 7200];

const pickNearestTimerFrameSeconds = (value) => {
  const safe = Math.max(0, toNumberSafe(value, 300));
  return TIMER_FRAMES_SECONDS.reduce((best, frame) =>
    Math.abs(frame - safe) < Math.abs(best - safe) ? frame : best,
  );
};

const timerFrameLabelFromSeconds = (value) => {
  const sec = pickNearestTimerFrameSeconds(value);
  if (sec === 30) return "30_seconds";
  if (sec === 60) return "1_minute";
  if (sec === 120) return "2_minutes";
  if (sec === 300) return "5_minutes";
  if (sec === 600) return "10_minutes";
  if (sec === 3600) return "1_hour";
  if (sec === 7200) return "2_hours";
  return `${sec}_seconds`;
};

const toBatchTypeFromTimerSeconds = (seconds) => {
  const sec = pickNearestTimerFrameSeconds(seconds);
  if (sec <= 60) return "immediate";
  if (sec <= 300) return "short_term";
  if (sec <= 600) return "medium_term";
  if (sec <= 3600) return "long_term";
  return "mastered";
};

const scheduleFromRetentionScore = (retentionProbability) => {
  const score = clampRatio(retentionProbability, 0.5);
  let timerFrameSeconds = 300;

  if (score < 0.3) timerFrameSeconds = 30;
  else if (score < 0.45) timerFrameSeconds = 60;
  else if (score < 0.55) timerFrameSeconds = 120;
  else if (score < 0.65) timerFrameSeconds = 300;
  else if (score < 0.75) timerFrameSeconds = 600;
  else if (score < 0.88) timerFrameSeconds = 3600;
  else timerFrameSeconds = 7200;

  const frameSeconds = pickNearestTimerFrameSeconds(timerFrameSeconds);
  const batchType = toBatchTypeFromTimerSeconds(frameSeconds);

  return {
    retentionProbability: score,
    timerFrameSeconds: frameSeconds,
    timerFrameLabel: timerFrameLabelFromSeconds(frameSeconds),
    reviewBatchType: batchType,
    repeatInSeconds: frameSeconds,
    repeatInDays: Number((frameSeconds / 86400).toFixed(4)),
    revisionAvailableAt: new Date(Date.now() + frameSeconds * 1000),
  };
};

const normalizeFeatureArray = (arr, maxLen = 40) => {
  if (!Array.isArray(arr)) return [];
  return arr
    .slice(0, maxLen)
    .map((value) => toNumberSafe(value, 0))
    .filter((value) => Number.isFinite(value));
};

const resolveQuestionIdentifier = (questionLike) => {
  if (!questionLike || typeof questionLike !== "object") return "";

  const candidates = [
    questionLike.questionId,
    questionLike.question_id,
    questionLike._id,
    questionLike.id,
    questionLike.sourceQuestionId,
  ];

  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue;
    const text = String(candidate).trim();
    if (text) return text;
  }

  return "";
};

const formatRetentionTag = (batchType) => {
  const labels = {
    immediate: "Immediate Review",
    short_term: "Short-term Review",
    medium_term: "Medium-term Review",
    long_term: "Long-term Review",
    mastered: "Mastered",
  };
  return labels[batchType] || "Review";
};

const toBatchTypeFromRepeatDays = (days) => {
  const d = Number(days);
  if (!Number.isFinite(d)) return "medium_term";
  if (d <= 0) return "immediate";
  if (d <= 1) return "short_term";
  if (d <= 3) return "medium_term";
  if (d <= 14) return "long_term";
  return "mastered";
};

const extractFlaskQuestionSchedule = (feedback, topicId) => {
  if (!feedback || typeof feedback !== "object") return null;

  const modelOutputs = feedback.model_outputs || feedback.modelOutputs || {};
  const liveAnalysis = feedback.live_analysis || feedback.liveAnalysis || {};
  const predictions = feedback.predictions || {};
  const scheduleHint = feedback.schedule_hint || feedback.scheduleHint || {};
  const targetHints = feedback.derived_targets || feedback.derivedTargets || {};

  const microOutput = modelOutputs?.micro_lstm?.output || {};
  const microPredictions = Array.isArray(predictions.micro)
    ? predictions.micro
    : predictions.micro
      ? [predictions.micro]
      : [];

  const topicKey = String(topicId || "").toLowerCase();
  const selectedMicroPred =
    microPredictions.find(
      (item) => String(item?.topic_id || "").toLowerCase() === topicKey,
    ) ||
    microPredictions[0] ||
    {};

  const retentionProbability = clampRatio(
    microOutput.retention_score ??
      microOutput.current_retention ??
      selectedMicroPred.retention_probability ??
      selectedMicroPred.current_retention,
    0.5,
  );

  const probabilityCorrectNext = clampRatio(
    microOutput.probability_correct_next_attempt ??
      microOutput.next_retention ??
      selectedMicroPred.probability_correct_next ??
      selectedMicroPred.next_retention,
    retentionProbability,
  );

  const stressImpact = clampRatio(
    microOutput.stress_impact ?? selectedMicroPred.stress_impact,
    0.3,
  );

  const fatigueLevel = clampRatio(
    microOutput.fatigue_prediction ??
      microOutput.fatigue_level ??
      selectedMicroPred.fatigue_level,
    0.3,
  );

  const repeatInDays = Number(
    firstDefined(
      liveAnalysis?.planned_revision?.after_days,
      microOutput.repeat_in_days,
      selectedMicroPred.repeat_in_days,
      targetHints?.micro?.repeat_in_days,
      1,
    ),
  );

  const repeatInSeconds = Number(
    firstDefined(
      liveAnalysis?.planned_revision?.after_seconds,
      microOutput.repeat_in_seconds,
      selectedMicroPred.repeat_in_seconds,
      scheduleHint.timer_frame_seconds,
      scheduleHint.timerFrameSeconds,
      targetHints?.micro?.repeat_in_seconds,
      repeatInDays * 86400,
    ),
  );

  const timerFrameSeconds = pickNearestTimerFrameSeconds(repeatInSeconds);

  const reviewBatchType =
    microOutput.batch_type ||
    selectedMicroPred.batch_type ||
    scheduleHint.batch_type ||
    toBatchTypeFromTimerSeconds(timerFrameSeconds) ||
    toBatchTypeFromRepeatDays(repeatInDays);

  const nextQuestionDifficulty = clampDifficulty(
    microOutput.next_question_difficulty ??
      selectedMicroPred.next_question_difficulty,
    3,
  );

  const revisionAvailableAt = new Date(
    Date.now() + Math.max(0, timerFrameSeconds) * 1000,
  );

  return {
    retentionProbability,
    nextQuestionDifficulty,
    probabilityCorrectNext,
    stressImpact,
    fatigueLevel,
    repeatInDays: Number((timerFrameSeconds / 86400).toFixed(4)),
    repeatInSeconds: timerFrameSeconds,
    timerFrameSeconds,
    timerFrameLabel: timerFrameLabelFromSeconds(timerFrameSeconds),
    reviewBatchType,
    reviewLabel: formatRetentionTag(reviewBatchType),
    revisionAvailableAt,
    source: "flask",
    updatedAt: new Date(),
  };
};

const getRetentionReviewMeta = async (
  studentId,
  questionId,
  sessionContext = {},
) => {
  if (!studentId || !questionId) return null;
  const repetition = await QuestionRepetition.findOne({
    studentId,
    questionId: String(questionId),
  });
  if (!repetition) return null;

  if (!wasRepetitionCreatedInSessionTimeline(repetition, sessionContext)) {
    return null;
  }

  const sessionId = String(sessionContext?.sessionId || "").trim();
  const sessionStartMs = new Date(sessionContext?.sessionStart || 0).getTime();

  // Keep review badges session-scoped: only show repeat metadata when this
  // question was repeated during the active session window.
  const sessionHistory = (
    Array.isArray(repetition.retentionHistory)
      ? repetition.retentionHistory
      : []
  ).filter((entry) => {
    const entrySessionId = String(entry?.sessionId || "").trim();
    const answeredAtMs = new Date(entry?.answeredAt || 0).getTime();
    const inSessionId = sessionId && entrySessionId === sessionId;
    const inSessionTime =
      Number.isFinite(sessionStartMs) &&
      sessionStartMs > 0 &&
      Number.isFinite(answeredAtMs) &&
      answeredAtMs >= sessionStartMs;
    return inSessionId || inSessionTime;
  });

  if (sessionHistory.length === 0) {
    return null;
  }

  const dueAt = repetition.nextScheduledDate
    ? new Date(repetition.nextScheduledDate)
    : null;
  const remainingMs = dueAt ? Math.max(0, dueAt.getTime() - Date.now()) : 0;

  return {
    retentionTag: formatRetentionTag(repetition.currentBatchType),
    batchType: repetition.currentBatchType,
    dueAt,
    remainingMs,
    isDue: dueAt ? dueAt.getTime() <= Date.now() : false,
    flaskMetrics: repetition.latestFlaskMetrics || null,
    repeatsDoneInSession: sessionHistory.length,
    schedulingHistory: Array.isArray(repetition.schedulingHistory)
      ? repetition.schedulingHistory
          .filter((entry) => {
            const scheduledAtMs = new Date(entry?.scheduledAt || 0).getTime();
            if (!Number.isFinite(sessionStartMs) || sessionStartMs <= 0) {
              return true;
            }
            return (
              Number.isFinite(scheduledAtMs) && scheduledAtMs >= sessionStartMs
            );
          })
          .slice(-5)
      : [],
  };
};

const safeAssignFlexiblePath = (doc, path, value) => {
  const schemaPath = doc?.schema?.path(path);

  // Backward compatibility: older runtime/schema versions may still have this as String.
  if (schemaPath?.instance === "String") {
    doc.set(path, JSON.stringify(value || {}));
    return;
  }

  doc.set(path, value);
};

const ensureSentQuestionStore = (session) => {
  if (!session) return;
  if (!Array.isArray(session.sentQuestionIds)) {
    session.sentQuestionIds = [];
  }
};

const getAnsweredQuestionIdSet = (session) => {
  return new Set(
    (Array.isArray(session?.answers) ? session.answers : [])
      .map((a) => String(a?.questionId || ""))
      .filter(Boolean),
  );
};

const addQuestionsToSessionQueue = (
  session,
  questions = [],
  source = "fresh",
  options = {},
) => {
  if (!session) return 0;

  ensureSentQuestionStore(session);

  const safeSource = source === "retention" ? "retention" : "fresh";
  const { insertAt = null, allowAlreadySent = false } = options;
  const sentFreshIds = new Set(
    (session.sentQuestionIds || []).map((id) => String(id)).filter(Boolean),
  );
  const answeredIds = getAnsweredQuestionIdSet(session);
  const pendingQueuedIds = new Set(
    (session.currentBatchQuestions || [])
      .slice(Number(session.currentQuestionIndex || 0))
      .map((item) => String(item?.questionId || ""))
      .filter(Boolean),
  );

  const rows = [];
  (Array.isArray(questions) ? questions : []).forEach((q) => {
    const resolvedQuestionId = resolveQuestionIdentifier(q);
    if (!resolvedQuestionId) return;

    const key = String(resolvedQuestionId);
    const isFresh = safeSource === "fresh";

    // Fresh questions should never repeat inside the same session.
    if (isFresh && (sentFreshIds.has(key) || answeredIds.has(key))) return;
    if (isFresh && !allowAlreadySent && pendingQueuedIds.has(key)) return;

    // Keep queue free from duplicate pending rows for both source types.
    if (pendingQueuedIds.has(key)) return;

    pendingQueuedIds.add(key);
    rows.push({
      questionId: key,
      topicId: normalizeRetentionTopic(session.subject, q.topicId || q.topic),
      source: safeSource,
    });
  });

  if (rows.length === 0) return 0;

  if (Number.isInteger(insertAt) && insertAt >= 0) {
    session.currentBatchQuestions.splice(insertAt, 0, ...rows);
  } else {
    session.currentBatchQuestions.push(...rows);
  }

  session.currentBatchQuestions = session.currentBatchQuestions.map(
    (item, idx) => ({
      ...item,
      order: idx,
      source: item?.source === "retention" ? "retention" : "fresh",
    }),
  );

  return rows.length;
};

const markQuestionAsSent = (session, questionId, source = "fresh") => {
  if (!session || !questionId) return;
  if (source === "retention") return;

  ensureSentQuestionStore(session);
  const key = String(questionId);
  if (!session.sentQuestionIds.includes(key)) {
    session.sentQuestionIds.push(key);
  }
};

const injectDueQuestionIntoQueue = async (session) => {
  if (!session?.studentId) return null;

  const now = new Date();
  const pendingIds = new Set(
    (session.currentBatchQuestions || [])
      .slice(session.currentQuestionIndex || 0)
      .map((q) => String(q.questionId)),
  );

  const dueCandidates = await QuestionRepetition.find({
    studentId: session.studentId,
    subject: session.subject,
    isMastered: false,
    nextScheduledDate: { $lte: now },
    questionId: { $nin: Array.from(pendingIds) },
  })
    .sort({ nextScheduledDate: 1, currentRetention: 1 })
    .limit(40);

  const dueRepetition = (
    Array.isArray(dueCandidates) ? dueCandidates : []
  ).find((candidate) => isRepetitionInSessionTimeline(candidate, session));

  if (!dueRepetition) return null;

  const insertAt = Math.max(0, Number(session.currentQuestionIndex || 0));
  addQuestionsToSessionQueue(
    session,
    [
      {
        questionId: dueRepetition.questionId,
        topicId: dueRepetition.topicId,
      },
    ],
    "retention",
    { insertAt },
  );

  await session.save();
  return dueRepetition;
};

const toFiniteNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const sanitizeUiStatePayload = (payload = {}) => {
  const safeQueue = (
    Array.isArray(payload.retentionQueue) ? payload.retentionQueue : []
  ).slice(0, 150);

  const safeArchive = (
    Array.isArray(payload.retentionArchive) ? payload.retentionArchive : []
  ).slice(0, 200);

  const safeServedIds = (
    Array.isArray(payload.servedQuestionIds) ? payload.servedQuestionIds : []
  )
    .map((id) => String(id || "").trim())
    .filter(Boolean)
    .slice(0, 500);

  const runtime =
    payload.runtime && typeof payload.runtime === "object"
      ? {
          sessionStartMs: toFiniteNumber(payload.runtime.sessionStartMs, 0),
          questionStartMs: toFiniteNumber(payload.runtime.questionStartMs, 0),
          updatedAt: toFiniteNumber(payload.runtime.updatedAt, Date.now()),
        }
      : null;

  return {
    retentionQueue: safeQueue,
    retentionArchive: safeArchive,
    servedQuestionIds: safeServedIds,
    runtime,
    updatedAt: new Date(),
  };
};

const mapSessionUiStateForResponse = (session) => {
  if (!session?.uiState || typeof session.uiState !== "object") return null;

  return {
    retentionQueue: Array.isArray(session.uiState.retentionQueue)
      ? session.uiState.retentionQueue
      : [],
    retentionArchive: Array.isArray(session.uiState.retentionArchive)
      ? session.uiState.retentionArchive
      : [],
    servedQuestionIds: Array.isArray(session.uiState.servedQuestionIds)
      ? session.uiState.servedQuestionIds
      : [],
    runtime:
      session.uiState.runtime && typeof session.uiState.runtime === "object"
        ? {
            sessionStartMs: toFiniteNumber(
              session.uiState.runtime.sessionStartMs,
              0,
            ),
            questionStartMs: toFiniteNumber(
              session.uiState.runtime.questionStartMs,
              0,
            ),
            updatedAt: toFiniteNumber(session.uiState.runtime.updatedAt, 0),
          }
        : null,
    updatedAt: session.uiState.updatedAt || session.updatedAt || null,
  };
};

const toUiUpdatedAtMs = (uiState) => {
  const value = uiState?.updatedAt;
  if (!value) return 0;
  const asMs = new Date(value).getTime();
  return Number.isFinite(asMs) ? asMs : 0;
};

const toUiQuestionKey = (row) => {
  if (!row || typeof row !== "object") return "";
  const qid = String(row.questionId || row.id || "").trim();
  return qid;
};

const dedupeUiRows = (rows = []) => {
  const map = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (!row || typeof row !== "object") return;
    const key = toUiQuestionKey(row);
    if (!key) return;

    const normalized = {
      ...row,
      id: key,
      questionId: key,
    };

    const existing = map.get(key);
    if (!existing) {
      map.set(key, normalized);
      return;
    }

    const existingUpdatedAt = Math.max(
      toNumberSafe(new Date(existing.lastQueuedAt).getTime(), 0),
      toNumberSafe(new Date(existing.updatedAt).getTime(), 0),
      toNumberSafe(new Date(existing.retiredAt).getTime(), 0),
    );
    const nextUpdatedAt = Math.max(
      toNumberSafe(new Date(normalized.lastQueuedAt).getTime(), 0),
      toNumberSafe(new Date(normalized.updatedAt).getTime(), 0),
      toNumberSafe(new Date(normalized.retiredAt).getTime(), 0),
    );

    if (nextUpdatedAt >= existingUpdatedAt) {
      map.set(key, normalized);
    }
  });

  return Array.from(map.values());
};

const mergeUiStateSnapshots = (
  persistedUiState = null,
  fallbackUiState = null,
) => {
  const persisted = persistedUiState || {};
  const fallback = fallbackUiState || {};

  const mergedQueue = dedupeUiRows([
    ...(Array.isArray(fallback.retentionQueue) ? fallback.retentionQueue : []),
    ...(Array.isArray(persisted.retentionQueue)
      ? persisted.retentionQueue
      : []),
  ]).slice(0, 150);

  const mergedArchive = dedupeUiRows([
    ...(Array.isArray(fallback.retentionArchive)
      ? fallback.retentionArchive
      : []),
    ...(Array.isArray(persisted.retentionArchive)
      ? persisted.retentionArchive
      : []),
  ]).slice(0, 200);

  const mergedServedIds = Array.from(
    new Set([
      ...(Array.isArray(fallback.servedQuestionIds)
        ? fallback.servedQuestionIds
        : []
      )
        .map((id) => String(id || "").trim())
        .filter(Boolean),
      ...(Array.isArray(persisted.servedQuestionIds)
        ? persisted.servedQuestionIds
        : []
      )
        .map((id) => String(id || "").trim())
        .filter(Boolean),
    ]),
  ).slice(0, 500);

  const persistedRuntimeUpdatedAt = toNumberSafe(
    persisted?.runtime?.updatedAt,
    0,
  );
  const fallbackRuntimeUpdatedAt = toNumberSafe(
    fallback?.runtime?.updatedAt,
    0,
  );

  const mergedRuntime =
    persistedRuntimeUpdatedAt >= fallbackRuntimeUpdatedAt
      ? persisted.runtime || fallback.runtime || null
      : fallback.runtime || persisted.runtime || null;

  return {
    retentionQueue: mergedQueue,
    retentionArchive: mergedArchive,
    servedQuestionIds: mergedServedIds,
    runtime: mergedRuntime,
    updatedAt:
      toUiUpdatedAtMs(persisted) >= toUiUpdatedAtMs(fallback)
        ? persisted.updatedAt || fallback.updatedAt || new Date()
        : fallback.updatedAt || persisted.updatedAt || new Date(),
  };
};

const getUiStateShapeCounts = (uiState = null) => {
  const queueLen = Array.isArray(uiState?.retentionQueue)
    ? uiState.retentionQueue.length
    : 0;
  const archiveLen = Array.isArray(uiState?.retentionArchive)
    ? uiState.retentionArchive.length
    : 0;
  const servedLen = Array.isArray(uiState?.servedQuestionIds)
    ? uiState.servedQuestionIds.length
    : 0;

  return {
    queueLen,
    archiveLen,
    servedLen,
    total: queueLen + archiveLen + servedLen,
  };
};

const isUiStateEffectivelyEmpty = (uiState = null) => {
  const counts = getUiStateShapeCounts(uiState);
  return counts.total === 0;
};

const buildRecoveredUiStateFromRepetition = async (session) => {
  if (!session?.studentId) return null;

  const activeSessionId = String(session?.sessionId || "").trim();
  const sessionStartMs = getSessionStartMsSafe(session?.startTime);

  const sessionAnswerTimesByQuestion = new Map();
  (Array.isArray(session.answers) ? session.answers : []).forEach((answer) => {
    const qid = String(answer?.questionId || "").trim();
    if (!qid) return;
    const submittedAtMs = new Date(answer?.submittedAt || 0).getTime();
    if (!Number.isFinite(submittedAtMs)) return;
    if (
      Number.isFinite(sessionStartMs) &&
      sessionStartMs > 0 &&
      submittedAtMs < sessionStartMs
    ) {
      return;
    }

    const list = sessionAnswerTimesByQuestion.get(qid) || [];
    list.push(submittedAtMs);
    sessionAnswerTimesByQuestion.set(qid, list);
  });

  const answeredQuestionIds = Array.from(
    new Set(
      (Array.isArray(session.answers) ? session.answers : [])
        .map((answer) => String(answer?.questionId || "").trim())
        .filter(Boolean),
    ),
  );

  if (answeredQuestionIds.length === 0) {
    return {
      retentionQueue: [],
      retentionArchive: [],
      servedQuestionIds: [],
      runtime: null,
      updatedAt: session.updatedAt || new Date(),
    };
  }

  const repetitions = await QuestionRepetition.find({
    studentId: session.studentId,
    questionId: { $in: answeredQuestionIds },
  })
    .sort({ updatedAt: -1 })
    .limit(250);

  const now = Date.now();
  const queueRows = [];
  const archiveRows = [];

  repetitions.forEach((rep) => {
    const questionId = String(rep?.questionId || "").trim();
    if (!questionId) return;

    if (!isRepetitionInSessionTimeline(rep, session)) return;

    const sessionHistory = (
      Array.isArray(rep?.retentionHistory) ? rep.retentionHistory : []
    ).filter((entry) => {
      const entrySessionId = String(entry?.sessionId || "").trim();
      const answeredAtMs = new Date(entry?.answeredAt || 0).getTime();
      const inSessionId = activeSessionId && entrySessionId === activeSessionId;
      const inSessionTime =
        Number.isFinite(sessionStartMs) &&
        sessionStartMs > 0 &&
        Number.isFinite(answeredAtMs) &&
        answeredAtMs >= sessionStartMs;
      return inSessionId || inSessionTime;
    });

    const fallbackTimes = sessionAnswerTimesByQuestion.get(questionId) || [];

    const sortedAttemptTimes =
      sessionHistory.length > 0
        ? sessionHistory
            .map((entry) => new Date(entry?.answeredAt || 0).getTime())
            .filter(Number.isFinite)
            .sort((a, b) => a - b)
        : fallbackTimes.filter(Number.isFinite).sort((a, b) => a - b);

    // Ignore historical repetition attempts from older sessions.
    if (sortedAttemptTimes.length === 0) return;

    const sessionAttemptCount = sortedAttemptTimes.length;
    const firstSessionAttemptAt = sortedAttemptTimes[0];
    const lastSessionAttemptAt =
      sortedAttemptTimes[sortedAttemptTimes.length - 1];

    const dueAt = rep?.nextScheduledDate
      ? new Date(rep.nextScheduledDate)
      : null;
    const dueAtMs =
      dueAt && Number.isFinite(dueAt.getTime()) ? dueAt.getTime() : 0;
    const latestMetrics = rep?.latestFlaskMetrics || {};
    const snapshot = rep?.latestQuestionSnapshot || {};

    const timerFrameSeconds = pickNearestTimerFrameSeconds(
      firstDefined(
        latestMetrics?.timerFrameSeconds,
        latestMetrics?.repeatInSeconds,
        dueAtMs > 0 ? Math.max(0, Math.round((dueAtMs - now) / 1000)) : 300,
      ),
    );

    const row = {
      id: questionId,
      questionId,
      questionText: String(snapshot?.text || "Question text unavailable"),
      optionsText: Array.isArray(snapshot?.options)
        ? snapshot.options.map((opt) => String(opt || "")).join(" | ")
        : "",
      correctAnswerText: "",
      nextRepeatAt:
        dueAtMs > 0
          ? new Date(dueAtMs).toISOString()
          : new Date(Date.now() + timerFrameSeconds * 1000).toISOString(),
      timerFrameSeconds,
      timerFrameLabel: timerFrameLabelFromSeconds(timerFrameSeconds),
      scheduledSpecial: false,
      specialTag: "",
      specialColor: "",
      scheduledAt: null,
      retentionScore: Math.round(clampRatio(rep?.currentRetention, 0.5) * 100),
      needsRetention: !Boolean(rep?.isMastered),
      retentionTag: formatRetentionTag(rep?.currentBatchType),
      queueStatus: rep?.isMastered
        ? "completed"
        : dueAtMs <= now
          ? "pending"
          : "pending",
      repeatsDone: Number(Math.max(0, sessionAttemptCount - 1)),
      queueEntryCount: Number(sessionAttemptCount),
      firstQueuedAt: Number.isFinite(firstSessionAttemptAt)
        ? new Date(firstSessionAttemptAt)
        : rep?.createdAt || session.startTime || new Date(),
      lastQueuedAt: Number.isFinite(lastSessionAttemptAt)
        ? new Date(lastSessionAttemptAt)
        : rep?.updatedAt || new Date(),
      retiredAt: rep?.isMastered ? rep?.masteredAt || rep?.updatedAt : null,
      retiredReason: rep?.isMastered ? "retention_resolved" : null,
      updatedAt: rep?.updatedAt || new Date(),
    };

    if (rep?.isMastered) {
      archiveRows.push(row);
    } else {
      queueRows.push(row);
    }
  });

  return {
    retentionQueue: dedupeUiRows(queueRows).slice(0, 150),
    retentionArchive: dedupeUiRows(archiveRows).slice(0, 200),
    servedQuestionIds: answeredQuestionIds.slice(0, 500),
    runtime: null,
    updatedAt: session.updatedAt || new Date(),
  };
};

// Create a new retention session
exports.createSession = async (req, res) => {
  try {
    const { subject, topics, sessionType = "practice" } = req.body;
    const { studentId, id: userId } = req.user;

    if (!subject || !["english", "gk"].includes(subject)) {
      return res.status(400).json({
        success: false,
        error: "Valid subject (english/gk) is required",
      });
    }

    // Generate session ID
    const sessionId = randomUUID();
    const sessionStartAt = new Date();

    // Start Flask session for AI predictions
    let flaskSessionId = null;
    let flaskPredictions = {};

    try {
      const flaskResponse = await retentionFlaskService.startRetentionSession(
        studentId,
        subject,
        topics,
        sessionType,
      );
      flaskSessionId = flaskResponse.session_id;
      flaskPredictions = flaskResponse.predictions || {};
    } catch (error) {
      console.error("Error starting Flask session:", error.message);
      // Continue without Flask - will use local scheduling
    }

    // Get initial questions based on batch type
    const initialQuestionBundle = await getInitialQuestions(
      studentId,
      subject,
      topics,
      flaskPredictions,
      {
        sessionStartAt,
      },
    );
    const initialQuestions = initialQuestionBundle.questions || [];
    const initialRetentionIds = new Set(
      (initialQuestionBundle.retentionQuestionIds || [])
        .map((id) => String(id))
        .filter(Boolean),
    );

    // Create session
    const session = new RetentionSession({
      sessionId,
      flaskSessionId,
      userId,
      studentId,
      subject,
      topics: topics || getDefaultTopics(subject),
      sessionType,
      startTime: sessionStartAt,
      currentBatchQuestions: [],
      sentQuestionIds: [],
      flaskPredictions,
      flaskCompletion: {
        status: flaskSessionId ? "pending" : "not_started",
        attempts: 0,
      },
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });

    const initialRetentionQuestions = initialQuestions.filter((q) =>
      initialRetentionIds.has(String(resolveQuestionIdentifier(q) || "")),
    );
    const initialFreshQuestions = initialQuestions.filter(
      (q) =>
        !initialRetentionIds.has(String(resolveQuestionIdentifier(q) || "")),
    );

    addQuestionsToSessionQueue(session, initialRetentionQuestions, "retention");
    addQuestionsToSessionQueue(session, initialFreshQuestions, "fresh");

    await session.save();

    // Prepare questions for response (without answers)
    const questionsWithDetails = initialQuestions.map((q) => ({
      id: resolveQuestionIdentifier(q),
      questionId: resolveQuestionIdentifier(q),
      text: q.text,
      type: q.type,
      difficulty: q.difficulty,
      difficultyLevel: q.difficultyLevel,
      options: q.type !== "NAT" ? q.options : undefined,
      topic: normalizeRetentionTopic(subject, q.topic),
      topicCategory: normalizeRetentionTopic(
        subject,
        q.topicCategory || q.topic,
      ),
      marks: q.marks,
      expectedTime: q.expectedTime,
    }));

    res.status(201).json({
      success: true,
      sessionId: session.sessionId,
      flaskSessionId: session.flaskSessionId,
      subject: session.subject,
      topics: session.topics,
      questions: questionsWithDetails,
      totalQuestions: questionsWithDetails.length,
      currentBatchType: session.currentBatchType,
      predictions: {
        micro: flaskPredictions.micro,
        stressFatigue: flaskPredictions.stressFatigue,
      },
      startTime: session.startTime,
    });
  } catch (error) {
    console.error("Error creating retention session:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get session by ID
exports.getSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await RetentionSession.findOne({ sessionId });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Session not found",
      });
    }

    // Verify ownership
    if (session.studentId !== req.user.studentId) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized access to this session",
      });
    }

    const persistedUiState = mapSessionUiStateForResponse(session);
    const recoveredUiState = await buildRecoveredUiStateFromRepetition(session);
    const mergedUiState = mergeUiStateSnapshots(
      persistedUiState,
      recoveredUiState,
    );

    // Self-heal persisted UI state when recovery can reconstruct richer queue data.
    const persistedQueueLen = Array.isArray(persistedUiState?.retentionQueue)
      ? persistedUiState.retentionQueue.length
      : 0;
    const persistedArchiveLen = Array.isArray(
      persistedUiState?.retentionArchive,
    )
      ? persistedUiState.retentionArchive.length
      : 0;
    const persistedServedLen = Array.isArray(
      persistedUiState?.servedQuestionIds,
    )
      ? persistedUiState.servedQuestionIds.length
      : 0;

    const mergedQueueLen = Array.isArray(mergedUiState?.retentionQueue)
      ? mergedUiState.retentionQueue.length
      : 0;
    const mergedArchiveLen = Array.isArray(mergedUiState?.retentionArchive)
      ? mergedUiState.retentionArchive.length
      : 0;
    const mergedServedLen = Array.isArray(mergedUiState?.servedQuestionIds)
      ? mergedUiState.servedQuestionIds.length
      : 0;

    if (
      mergedQueueLen > persistedQueueLen ||
      mergedArchiveLen > persistedArchiveLen ||
      mergedServedLen > persistedServedLen
    ) {
      session.uiState = sanitizeUiStatePayload(mergedUiState);
      await session.save();
    }

    res.json({
      success: true,
      session: {
        sessionId: session.sessionId,
        flaskSessionId: session.flaskSessionId,
        subject: session.subject,
        topics: session.topics,
        status: session.status,
        sessionType: session.sessionType,
        startTime: session.startTime,
        endTime: session.endTime,
        currentBatchType: session.currentBatchType,
        currentQuestionIndex: session.currentQuestionIndex,
        totalQuestions:
          session.answers.length + session.currentBatchQuestions.length,
        answeredCount: session.answers.length,
        metrics: session.metrics,
        predictions: session.flaskPredictions,
        uiState: mergedUiState,
      },
    });
  } catch (error) {
    console.error("Error getting session:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Persist frontend UI snapshot for refresh-safe recovery.
exports.saveSessionUiState = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await RetentionSession.findOne({ sessionId });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Session not found",
      });
    }

    if (session.studentId !== req.user.studentId) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized access to this session",
      });
    }

    const incomingUiState = sanitizeUiStatePayload(req.body || {});
    const persistedUiState = mapSessionUiStateForResponse(session);
    const recoveredUiState = await buildRecoveredUiStateFromRepetition(session);

    // Keep queue snapshots robust: merge payload with DB/recovered state,
    // so a transient empty client payload on refresh can't wipe retention rows.
    const persistenceBase = mergeUiStateSnapshots(
      persistedUiState,
      recoveredUiState,
    );
    const mergedUiState = mergeUiStateSnapshots(
      incomingUiState,
      persistenceBase,
    );

    const baseCounts = getUiStateShapeCounts(persistenceBase);
    const mergedCounts = getUiStateShapeCounts(mergedUiState);

    // Defensive guard: avoid regressing to empty/degraded snapshots on refresh races.
    const shouldKeepBaseSnapshot =
      baseCounts.total > 0 &&
      (isUiStateEffectivelyEmpty(incomingUiState) ||
        mergedCounts.total < baseCounts.total ||
        mergedCounts.queueLen < baseCounts.queueLen);

    const safeUiState = shouldKeepBaseSnapshot
      ? {
          ...persistenceBase,
          runtime:
            toNumberSafe(incomingUiState?.runtime?.updatedAt, 0) >=
            toNumberSafe(persistenceBase?.runtime?.updatedAt, 0)
              ? incomingUiState.runtime || persistenceBase.runtime || null
              : persistenceBase.runtime || incomingUiState.runtime || null,
          updatedAt: new Date(),
        }
      : mergedUiState;

    session.uiState = sanitizeUiStatePayload(safeUiState);
    await session.save();

    res.json({
      success: true,
      uiState: mapSessionUiStateForResponse(session),
    });
  } catch (error) {
    console.error("Error saving retention UI state:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get all sessions for a student
exports.getStudentSessions = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { subject, limit = 20, page = 1 } = req.query;

    // Verify ownership
    if (studentId !== req.user.studentId) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized access",
      });
    }

    const query = { studentId };
    if (subject) query.subject = subject;

    const skip = (page - 1) * limit;

    const sessions = await RetentionSession.find(query)
      .sort({ startTime: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select(
        "sessionId subject topics status sessionType startTime endTime metrics currentBatchType",
      );

    const total = await RetentionSession.countDocuments(query);

    res.json({
      success: true,
      sessions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalSessions: total,
        hasNext: skip + sessions.length < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Error getting student sessions:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get next question
exports.getNextQuestion = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { currentStress, currentFatigue } = req.query;

    const session = await RetentionSession.findOne({ sessionId });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Session not found",
      });
    }

    if (session.status === "completed") {
      return res.status(400).json({
        success: false,
        error: "Session already completed",
      });
    }

    ensureSentQuestionStore(session);

    // Always prioritize due retention questions by injecting one at current index.
    await injectDueQuestionIntoQueue(session);

    // Check if we need more questions
    const remainingInBatch =
      session.currentBatchQuestions.length - session.currentQuestionIndex;

    if (remainingInBatch < 2) {
      // Get next batch from Flask
      try {
        const recentAnswers = session.answers.slice(-10).map((a) => ({
          question_id: a.questionId,
          correct: a.isCorrect,
          time_spent: a.responseTimeMs,
          answer_changes: a.answerChanges,
          confidence: a.confidence,
          concept_area: a.topicCategory,
          difficulty: a.difficulty,
          stress_level: a.stressLevel,
          fatigue_index: a.fatigueIndex,
        }));

        const flaskResponse = await retentionFlaskService.getNextQuestions(
          session.flaskSessionId || session.sessionId,
          recentAnswers,
          {
            studentId: session.studentId,
            subject: session.subject,
            currentStress: currentStress || 0.3,
            currentFatigue: currentFatigue || 0.3,
            timeoutMs: 2500,
          },
        );

        if (
          flaskResponse.success &&
          Array.isArray(flaskResponse.questions) &&
          flaskResponse.questions.length > 0
        ) {
          const newQuestions = await processFlaskQuestions(
            flaskResponse.questions,
            session.subject,
          );

          // Add only unseen fresh questions.
          addQuestionsToSessionQueue(session, newQuestions, "fresh");

          // Update predictions
          if (flaskResponse.predictions) {
            session.flaskPredictions = {
              ...session.flaskPredictions,
              ...flaskResponse.predictions,
            };
          }
          await session.save();
        } else {
          const localQuestions = await getLocalQuestions(
            session.studentId,
            session.subject,
            session.topics,
            session.currentBatchType,
          );

          addQuestionsToSessionQueue(session, localQuestions, "fresh");

          await session.save();
        }
      } catch (error) {
        console.error("Error getting next batch from Flask:", error?.message);
        // Fallback to local questions
        const localQuestions = await getLocalQuestions(
          session.studentId,
          session.subject,
          session.topics,
          session.currentBatchType,
        );

        addQuestionsToSessionQueue(session, localQuestions, "fresh");

        await session.save();
      }
    }

    // Get current question
    const currentQuestionData =
      session.currentBatchQuestions[session.currentQuestionIndex];

    if (!currentQuestionData) {
      // Session complete
      session.status = "completed";
      session.endTime = new Date();
      session.calculateMetrics();
      await session.save();

      return res.json({
        success: true,
        sessionComplete: true,
        metrics: session.metrics,
      });
    }

    // Get full question details
    const question = await getQuestionById(currentQuestionData.questionId);

    if (!question) {
      // Skip this question
      session.currentQuestionIndex++;
      await session.save();
      return exports.getNextQuestion(req, res);
    }

    const responseQuestionId =
      resolveQuestionIdentifier(question) ||
      String(currentQuestionData.questionId || "");

    markQuestionAsSent(
      session,
      responseQuestionId,
      currentQuestionData?.source || "fresh",
    );
    if (
      session.currentBatchQuestions?.[session.currentQuestionIndex] &&
      (!session.currentBatchQuestions[session.currentQuestionIndex].sentAt ||
        session.currentBatchQuestions[session.currentQuestionIndex].source !==
          "retention")
    ) {
      session.currentBatchQuestions[session.currentQuestionIndex].sentAt =
        new Date();
    }
    await session.save();

    res.json({
      success: true,
      question: {
        id: responseQuestionId,
        questionId: responseQuestionId,
        text: question.text,
        type: question.type,
        difficulty: question.difficulty,
        difficultyLevel: question.difficultyLevel,
        options: question.type !== "NAT" ? question.options : undefined,
        topic: question.topic,
        topicCategory: normalizeRetentionTopic(
          session.subject,
          question.topicCategory || question.topic,
        ),
        marks: question.marks,
        expectedTime: question.expectedTime,
        retentionReview: await getRetentionReviewMeta(
          session.studentId,
          currentQuestionData.questionId,
          {
            sessionId: session.sessionId,
            sessionStart: session.startTime,
          },
        ),
      },
      questionNumber: session.currentQuestionIndex + 1,
      totalInBatch: session.currentBatchQuestions.length,
      batchType: session.currentBatchType,
      predictions: {
        expectedRetention: session.flaskPredictions.micro?.current_retention,
        stressImpact: session.flaskPredictions.micro?.stress_impact,
        fatigueLevel: session.flaskPredictions.micro?.fatigue_level,
      },
    });
  } catch (error) {
    console.error("Error getting next question:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Submit answer
exports.submitAnswer = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const {
      questionId,
      selectedOptions,
      responseTimeMs,
      hesitationCount,
      confidence,
      stressLevel,
      fatigueIndex,
      focusScore,
      answerChanges,
      moodScore,
      sleepQuality,
    } = req.body;

    const session = await RetentionSession.findOne({ sessionId });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Session not found",
      });
    }

    const currentQuestionData =
      session.currentBatchQuestions?.[session.currentQuestionIndex] || null;
    const requestedQuestionId =
      questionId || req.body.question_id || req.body.questionId;
    const expectedQuestionId = currentQuestionData?.questionId
      ? String(currentQuestionData.questionId)
      : "";

    if (
      expectedQuestionId &&
      requestedQuestionId &&
      String(requestedQuestionId) !== expectedQuestionId
    ) {
      const expectedQuestion = await getQuestionById(expectedQuestionId);
      const normalizedExpectedId =
        resolveQuestionIdentifier(expectedQuestion) || expectedQuestionId;

      return res.status(409).json({
        success: false,
        code: "QUESTION_CONTEXT_OUT_OF_SYNC",
        error:
          "Question context was out of sync and has been refreshed. Please answer this question again and submit.",
        expectedQuestionId,
        receivedQuestionId: String(requestedQuestionId),
        currentQuestion: expectedQuestion
          ? {
              id: normalizedExpectedId,
              questionId: normalizedExpectedId,
              text: expectedQuestion.text,
              type: expectedQuestion.type,
              difficulty: expectedQuestion.difficulty,
              difficultyLevel: expectedQuestion.difficultyLevel,
              options:
                expectedQuestion.type !== "NAT"
                  ? expectedQuestion.options
                  : undefined,
              topic: expectedQuestion.topic,
              topicCategory: normalizeRetentionTopic(
                session.subject,
                expectedQuestion.topicCategory || expectedQuestion.topic,
              ),
              marks: expectedQuestion.marks,
              expectedTime: expectedQuestion.expectedTime,
            }
          : null,
      });
    }

    const resolvedQuestionId = requestedQuestionId || expectedQuestionId;

    if (!resolvedQuestionId) {
      return res.status(400).json({
        success: false,
        error: "questionId is required to submit retention answer",
      });
    }

    // Get question details
    const question = await getQuestionById(resolvedQuestionId);

    if (!question) {
      return res.status(404).json({
        success: false,
        error: "Question not found",
      });
    }

    // Check if answer is correct
    const isCorrect = checkAnswer(question, selectedOptions);

    // Create answer object
    const answer = {
      questionId: resolvedQuestionId,
      topicId: normalizeRetentionTopic(
        session.subject,
        question.topicId || question.topic,
      ),
      subject: session.subject,
      topicCategory: normalizeRetentionTopic(
        session.subject,
        question.topicCategory || question.topic,
      ),
      isCorrect,
      responseTimeMs: responseTimeMs || 0,
      hesitationCount: hesitationCount || 0,
      confidence: confidence || 0.5,
      difficulty: question.difficulty,
      stressLevel: stressLevel || 0.3,
      fatigueIndex: fatigueIndex || 0.3,
      focusScore: focusScore || 0.7,
      attemptNumber: getAttemptNumber(session, resolvedQuestionId),
      sessionPosition: session.answers.length + 1,
      timeSinceLastMs: getTimeSinceLast(session),
      answerChanges: answerChanges || 0,
      moodScore: moodScore || 0.5,
      sleepQuality: sleepQuality || 0.7,
    };

    session.answers.push(answer);
    session.currentQuestionIndex++;

    let flaskFeedback = null;
    let flaskScheduleForQuestion = null;
    if (session.flaskSessionId) {
      const answerRows = [
        toFlaskAnswerRow(answer, session.sessionId, {
          ...req.body,
          user_id: session.studentId,
          subject: session.subject,
        }),
      ];

      try {
        const updateResponse =
          await retentionFlaskService.getUpdatedPredictions(
            session.studentId,
            answerRows,
            {
              sessionId: session.flaskSessionId,
              subject: session.subject,
              timeoutMs: 2500,
            },
          );

        if (updateResponse?.success) {
          session.flaskPredictions = {
            ...(session.flaskPredictions || {}),
            ...(updateResponse.predictions || {}),
          };

          flaskFeedback = {
            predictions: updateResponse.predictions || {},
            trainingNeeded: updateResponse.training_needed || {},
            scheduleUpdateNeeded: Boolean(
              updateResponse.schedule_update_needed,
            ),
            sequenceStatus: updateResponse.sequence_status || {},
            modelsReady: updateResponse.models_ready || {},
            modelOutputs: updateResponse.model_outputs || {},
            liveAnalysis: updateResponse.live_analysis || {},
            stale: false,
          };

          flaskScheduleForQuestion = extractFlaskQuestionSchedule(
            {
              predictions: updateResponse.predictions || {},
              model_outputs: updateResponse.model_outputs || {},
              live_analysis: updateResponse.live_analysis || {},
              schedule_hint: req.body?.schedule_hint || {},
              derived_targets: req.body?.derived_targets || {},
            },
            answer.topicId,
          );
        }
      } catch (error) {
        flaskFeedback = {
          predictions: session.flaskPredictions || {},
          trainingNeeded: {},
          scheduleUpdateNeeded: false,
          sequenceStatus: {},
          modelsReady: {},
          modelOutputs: {},
          liveAnalysis: {},
          stale: true,
        };
      }

      if (!flaskFeedback) {
        flaskFeedback = {
          predictions: session.flaskPredictions || {},
          trainingNeeded: {},
          scheduleUpdateNeeded: false,
          sequenceStatus: {},
          modelsReady: {},
          modelOutputs: {},
          liveAnalysis: {},
          stale: true,
        };
      }
    }

    // Update question repetition schedule
    const updatedRetentionReview = await updateQuestionRepetition(
      session.studentId,
      session.userId,
      resolvedQuestionId,
      isCorrect,
      responseTimeMs,
      sessionId,
      session.currentBatchType,
      {
        question,
        topicId: answer.topicId,
        topicCategory: answer.topicCategory,
        flaskSchedule: flaskScheduleForQuestion,
      },
    );

    // Keep session active; next-question endpoint handles adaptive refill/completion.
    if (session.status !== "active") {
      session.status = "active";
    }

    await session.save();

    // Persist session analytics snapshot so analytics pages can read one
    // consistent backend payload without relying on browser-side state only.
    try {
      await retentionAnalyticsController.upsertSessionAnalyticsSnapshot(
        session,
        "session-submit",
      );
    } catch (analyticsError) {
      console.warn(
        "Retention analytics snapshot update failed on submit:",
        analyticsError?.message || analyticsError,
      );
    }

    // Calculate current metrics
    const currentMetrics = calculateCurrentMetrics(session);

    res.json({
      success: true,
      isCorrect,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      solutionSteps: question.solutionSteps,
      currentMetrics,
      sessionComplete: false,
      nextBatchType: session.currentBatchType,
      answeredCount: session.answers.length,
      totalInSession:
        session.answers.length +
        session.currentBatchQuestions.length -
        session.currentQuestionIndex,
      flaskFeedback,
      retentionReview: updatedRetentionReview,
    });
  } catch (error) {
    console.error("Error submitting answer:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const waitMs = (ms) =>
  new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));

const FLASK_COMPLETE_BASE_TIMEOUT_MS = Number(
  process.env.RETENTION_FLASK_COMPLETE_BASE_TIMEOUT_MS || 20000,
);
const FLASK_COMPLETE_PER_ANSWER_TIMEOUT_MS = Number(
  process.env.RETENTION_FLASK_COMPLETE_PER_ANSWER_TIMEOUT_MS || 70,
);
const FLASK_COMPLETE_MAX_TIMEOUT_MS = Number(
  process.env.RETENTION_FLASK_COMPLETE_MAX_TIMEOUT_MS || 180000,
);
const FLASK_COMPLETION_PENDING_WINDOW_MS = Number(
  process.env.RETENTION_FLASK_COMPLETION_PENDING_WINDOW_MS || 120000,
);

const completionJobBySessionId = new Map();

const computeCompletionTimeoutMs = (session, attempt) => {
  const answersCount = Array.isArray(session?.answers)
    ? session.answers.length
    : 0;
  const scaledByAnswers =
    FLASK_COMPLETE_BASE_TIMEOUT_MS +
    answersCount * FLASK_COMPLETE_PER_ANSWER_TIMEOUT_MS;
  const attemptMultiplier = Math.min(2.2, 1 + (Number(attempt) - 1) * 0.4);
  return Math.min(
    FLASK_COMPLETE_MAX_TIMEOUT_MS,
    Math.max(3000, Math.round(scaledByAnswers * attemptMultiplier)),
  );
};

const parseRetryInMsFromError = (error) => {
  const text = String(
    error?.response?.data?.error || error?.message || "",
  ).toLowerCase();
  const match = text.match(/retry\s+in\s+(\d+)s/i);
  if (!match) return 0;

  const sec = Number(match[1]);
  if (!Number.isFinite(sec) || sec <= 0) return 0;
  return sec * 1000;
};

const finalizeFlaskSessionWithRetry = async (session, maxAttempts = 3) => {
  if (!session?.flaskSessionId) {
    return {
      success: true,
      skipped: true,
      attempts: 0,
      response: null,
    };
  }

  let attempts = 0;
  let lastError = null;

  while (attempts < maxAttempts) {
    attempts += 1;
    try {
      const completionTimeoutMs = computeCompletionTimeoutMs(session, attempts);
      const response = await retentionFlaskService.completeRetentionSession(
        session.flaskSessionId,
        {
          student_id: session.studentId,
          user_id: session.studentId,
          subject: session.subject,
          session_type: session.sessionType,
          answers: session.answers,
          metrics: session.metrics,
        },
        {
          timeoutMs: completionTimeoutMs,
        },
      );

      return {
        success: true,
        skipped: false,
        attempts,
        response,
      };
    } catch (error) {
      lastError = error;
      const isTransient = retentionFlaskService.isTransientError(error);
      if (!isTransient || attempts >= maxAttempts) {
        break;
      }

      const hintedDelayMs = parseRetryInMsFromError(error);
      const fallbackBackoffMs = 700 * 2 ** (attempts - 1);
      // Honor explicit retry windows from Flask cooldown messages.
      await waitMs(Math.max(fallbackBackoffMs, hintedDelayMs + 300));
    }
  }

  return {
    success: false,
    skipped: false,
    attempts,
    error: lastError,
  };
};

const emitSessionCompleted = (req, session) => {
  const io = req.app.get("io");
  if (!io) return;

  io.of("/retention")
    .to(`retention:${session.sessionId}`)
    .emit("retention-session-complete", {
      sessionId: session.sessionId,
      metrics: session.metrics,
      completedAt: session.endTime || new Date(),
      source: "rest-complete",
    });
};

const runBackgroundFlaskCompletion = async (sessionId) => {
  if (!sessionId || completionJobBySessionId.has(sessionId)) {
    return completionJobBySessionId.get(sessionId) || null;
  }

  const job = (async () => {
    let session = await RetentionSession.findOne({ sessionId });
    if (!session || !session.flaskSessionId) {
      return {
        success: true,
        skipped: true,
        attempts: 0,
      };
    }

    const completionResult = await finalizeFlaskSessionWithRetry(session, 4);

    session = await RetentionSession.findOne({ sessionId });
    if (!session) {
      return completionResult;
    }

    session.flaskCompletion = {
      status: completionResult.success ? "completed" : "failed",
      attempts:
        Number(session.flaskCompletion?.attempts || 0) +
        Number(completionResult.attempts || 0),
      lastAttemptAt: new Date(),
      completedAt: completionResult.success ? new Date() : null,
      lastError: completionResult.success
        ? null
        : String(
            completionResult.error?.response?.data?.error ||
              completionResult.error?.message ||
              "Flask completion failed",
          ).slice(0, 500),
    };

    await session.save();

    try {
      await retentionAnalyticsController.upsertSessionAnalyticsSnapshot(
        session,
        completionResult.success
          ? "session-complete-flask"
          : "session-complete-flask-failed",
      );
    } catch (analyticsError) {
      console.warn(
        "Retention analytics snapshot update failed after background completion:",
        analyticsError?.message || analyticsError,
      );
    }

    return completionResult;
  })()
    .catch((error) => {
      console.error(
        "Background Flask completion failed:",
        error?.message || error,
      );
      return {
        success: false,
        skipped: false,
        attempts: 0,
        error,
      };
    })
    .finally(() => {
      completionJobBySessionId.delete(sessionId);
    });

  completionJobBySessionId.set(sessionId, job);
  return job;
};

// Complete session
exports.completeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await RetentionSession.findOne({ sessionId });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Session not found",
      });
    }

    if (!session.metrics || Object.keys(session.metrics || {}).length === 0) {
      session.calculateMetrics();
    }

    const shouldFinalizeFlask = Boolean(session.flaskSessionId);
    if (!shouldFinalizeFlask) {
      session.flaskCompletion = {
        status: "not_started",
        attempts: Number(session.flaskCompletion?.attempts || 0),
        lastAttemptAt: null,
        completedAt: null,
        lastError: null,
      };
    } else {
      const completionStatus = String(session.flaskCompletion?.status || "");
      const completionAttempts = Number(session.flaskCompletion?.attempts || 0);
      const completionInFlight = completionJobBySessionId.has(sessionId);
      const lastAttemptMs = new Date(
        session.flaskCompletion?.lastAttemptAt || 0,
      ).getTime();
      const isPendingWindowActive =
        completionStatus === "pending" &&
        Number.isFinite(lastAttemptMs) &&
        Date.now() - lastAttemptMs <= FLASK_COMPLETION_PENDING_WINDOW_MS;

      if (completionStatus === "completed" && session.status === "completed") {
        return res.json({
          success: true,
          pending: false,
          message: "Session already completed and synchronized",
          metrics: session.metrics,
          summary: {
            totalQuestions: session.answers.length,
            correctAnswers: session.answers.filter((a) => a.isCorrect).length,
            accuracy: session.metrics?.accuracy || 0,
            averageTime: session.metrics?.averageResponseTime || 0,
            topicsCovered: [
              ...new Set(session.answers.map((a) => a.topicCategory)),
            ],
          },
          flaskCompletion: {
            status: session.flaskCompletion?.status || "not_started",
            attempts: completionAttempts,
            completedAt: session.flaskCompletion?.completedAt || null,
          },
          flaskAnalysis: null,
        });
      }

      if (completionInFlight || isPendingWindowActive) {
        return res.status(202).json({
          success: true,
          pending: true,
          code: "FLASK_COMPLETION_PENDING",
          message:
            "Session finalized locally. Flask synchronization is still in progress.",
          metrics: session.metrics,
          summary: {
            totalQuestions: session.answers.length,
            correctAnswers: session.answers.filter((a) => a.isCorrect).length,
            accuracy: session.metrics?.accuracy || 0,
            averageTime: session.metrics?.averageResponseTime || 0,
            topicsCovered: [
              ...new Set(session.answers.map((a) => a.topicCategory)),
            ],
          },
          flaskCompletion: {
            status: "pending",
            attempts: completionAttempts,
            completedAt: null,
          },
        });
      }

      session.flaskCompletion = {
        status: "pending",
        attempts: completionAttempts,
        lastAttemptAt: new Date(),
        completedAt: null,
        lastError: null,
      };
    }

    if (session.status !== "completed") {
      session.status = "completed";
      session.endTime = new Date();
      session.calculateMetrics();
      await updateRetentionMetrics(session);
    }

    await session.save();

    try {
      await retentionAnalyticsController.upsertSessionAnalyticsSnapshot(
        session,
        "session-complete",
      );
    } catch (analyticsError) {
      console.warn(
        "Retention analytics snapshot update failed on complete:",
        analyticsError?.message || analyticsError,
      );
    }

    emitSessionCompleted(req, session);

    if (shouldFinalizeFlask) {
      runBackgroundFlaskCompletion(sessionId).catch(() => {
        // Background sync errors are persisted in flaskCompletion and should not fail the response.
      });
    }

    res.status(shouldFinalizeFlask ? 202 : 200).json({
      success: true,
      pending: shouldFinalizeFlask,
      code: shouldFinalizeFlask ? "FLASK_COMPLETION_PENDING" : null,
      message: shouldFinalizeFlask
        ? "Session completed. Flask synchronization is running in background."
        : "Session completed and synchronized",
      metrics: session.metrics,
      summary: {
        totalQuestions: session.answers.length,
        correctAnswers: session.answers.filter((a) => a.isCorrect).length,
        accuracy: session.metrics?.accuracy || 0,
        averageTime: session.metrics?.averageResponseTime || 0,
        topicsCovered: [
          ...new Set(session.answers.map((a) => a.topicCategory)),
        ],
      },
      flaskCompletion: {
        status: shouldFinalizeFlask
          ? "pending"
          : session.flaskCompletion?.status || "not_started",
        attempts: Number(session.flaskCompletion?.attempts || 0),
        completedAt: session.flaskCompletion?.completedAt || null,
      },
      flaskAnalysis: null,
    });
  } catch (error) {
    console.error("Error completing session:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get session summary
exports.getSessionSummary = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await RetentionSession.findOne({ sessionId });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Session not found",
      });
    }

    // Ensure metrics are calculated
    if (!session.metrics || Object.keys(session.metrics).length === 0) {
      session.calculateMetrics();
    }

    // Get topic-wise breakdown
    const topicBreakdown = {};
    session.answers.forEach((answer) => {
      const topic = answer.topicCategory;
      if (!topicBreakdown[topic]) {
        topicBreakdown[topic] = {
          total: 0,
          correct: 0,
          totalTime: 0,
        };
      }
      topicBreakdown[topic].total++;
      if (answer.isCorrect) topicBreakdown[topic].correct++;
      topicBreakdown[topic].totalTime += answer.responseTimeMs;
    });

    Object.keys(topicBreakdown).forEach((topic) => {
      topicBreakdown[topic].accuracy =
        (topicBreakdown[topic].correct / topicBreakdown[topic].total) * 100;
      topicBreakdown[topic].avgTime =
        topicBreakdown[topic].totalTime / topicBreakdown[topic].total;
    });

    // Get difficulty-wise breakdown
    const difficultyBreakdown = {};
    session.answers.forEach((answer) => {
      const diff =
        answer.difficulty < 0.4
          ? "easy"
          : answer.difficulty < 0.7
            ? "medium"
            : "hard";
      if (!difficultyBreakdown[diff]) {
        difficultyBreakdown[diff] = {
          total: 0,
          correct: 0,
        };
      }
      difficultyBreakdown[diff].total++;
      if (answer.isCorrect) difficultyBreakdown[diff].correct++;
    });

    Object.keys(difficultyBreakdown).forEach((diff) => {
      difficultyBreakdown[diff].accuracy =
        (difficultyBreakdown[diff].correct / difficultyBreakdown[diff].total) *
        100;
    });

    res.json({
      success: true,
      summary: {
        sessionId: session.sessionId,
        subject: session.subject,
        topics: session.topics,
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.endTime
          ? (session.endTime - session.startTime) / (1000 * 60)
          : null,
        metrics: session.metrics,
        topicBreakdown,
        difficultyBreakdown,
        stressPattern: {
          average:
            session.answers.reduce((sum, a) => sum + a.stressLevel, 0) /
            session.answers.length,
          trend: calculateTrend(session.answers.map((a) => a.stressLevel)),
        },
        fatiguePattern: {
          average:
            session.answers.reduce((sum, a) => sum + a.fatigueIndex, 0) /
            session.answers.length,
          trend: calculateTrend(session.answers.map((a) => a.fatigueIndex)),
        },
        focusPattern: {
          average:
            session.answers.reduce((sum, a) => sum + a.focusScore, 0) /
            session.answers.length,
          trend: calculateTrend(session.answers.map((a) => a.focusScore)),
        },
        recommendations: generateSessionRecommendations(
          session,
          topicBreakdown,
        ),
      },
    });
  } catch (error) {
    console.error("Error getting session summary:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ==================== Helper Functions ====================

const getDefaultTopics = (subject) => {
  return RETENTION_TOPICS[subject] || RETENTION_TOPICS.gk;
};

const getInitialQuestions = async (
  studentId,
  subject,
  topics,
  predictions,
  options = {},
) => {
  const sessionStartMs = getSessionStartMsSafe(options?.sessionStartAt);
  const sessionStartDate = sessionStartMs > 0 ? new Date(sessionStartMs) : null;

  // Get due questions from repetition schedule
  const dueQuestions = sessionStartDate
    ? await QuestionRepetition.find({
        studentId,
        isMastered: false,
        nextScheduledDate: { $lte: new Date() },
        createdAt: { $gte: sessionStartDate },
      }).sort({ nextScheduledDate: 1 })
    : await QuestionRepetition.findDueQuestions(studentId);

  if (dueQuestions.length > 0) {
    // Use due questions first
    const questionIds = dueQuestions.slice(0, 5).map((q) => q.questionId);
    const questions = await getQuestionsByIds(questionIds);
    return {
      questions,
      retentionQuestionIds: questionIds,
    };
  }

  // Get new questions based on predictions
  const batchType = predictions.micro?.batch_type || "immediate";
  const count = getQuestionsCountForBatch(batchType);

  return {
    questions: getPracticeQuestionsByTopics(subject, topics, count),
    retentionQuestionIds: [],
  };
};

const getQuestionsCountForBatch = (batchType) => {
  const counts = {
    immediate: 3,
    short_term: 5,
    medium_term: 8,
    long_term: 10,
    mastered: 5,
  };
  return counts[batchType] || 5;
};

const processFlaskQuestions = async (flaskQuestions, subject) => {
  const questions = [];

  for (const q of flaskQuestions) {
    // Check if question exists in our bank
    let question = await getQuestionBySourceId(q.id);

    if (!question) {
      // Create new question in our bank
      question = {
        _id: q.id || `gen_${Date.now()}_${Math.random()}`,
        text: q.text,
        type: q.type || "MCQ",
        difficulty: q.difficulty || 0.5,
        difficultyLevel: mapDifficultyLevel(q.difficulty || 0.5),
        options: q.options || [],
        correctAnswer: q.correct_answer,
        explanation: q.explanation || "",
        solutionSteps: q.solution_steps || [],
        topic: q.topic || q.concept_area,
        topicCategory: q.topic_category || q.concept_area,
        subject,
        marks: q.marks || 4,
        expectedTime: q.expected_time || 120,
        sourceQuestionId: q.id,
        generatedBy: "flask",
      };
    }

    questions.push(question);
  }

  return questions;
};

const getLocalQuestions = async (studentId, subject, topics, batchType) => {
  const count = getQuestionsCountForBatch(batchType);
  return getPracticeQuestionsByTopics(subject, topics, count);
};

const normalizeQuestionForSession = (question) => {
  if (!question) return null;
  const resolvedId = resolveQuestionIdentifier(question);
  return {
    ...question,
    _id: resolvedId || question._id || question.questionId || question.id,
    questionId:
      resolvedId || question.questionId || question._id || question.id,
    topicCategory: question.topicCategory || question.topic,
    expectedTime: question.expectedTime || 90,
  };
};

const getPracticeQuestionsByTopics = (subject, topics, count) => {
  const retentionSubject = toRetentionSubject(subject);
  const mappedSubject = SUBJECT_BANK_MAP[retentionSubject] || retentionSubject;
  const selectedTopics =
    Array.isArray(topics) && topics.length > 0
      ? topics
      : getDefaultTopics(retentionSubject);

  // Dedicated retention bank first.
  const retentionPool = questionBankService.getRetentionQuestions({
    subject: retentionSubject,
    topics: selectedTopics,
    count,
  });
  if (retentionPool.length >= count) {
    return retentionPool.map(normalizeQuestionForSession);
  }

  const picked = [];
  const seen = new Set();

  const addUnique = (items = []) => {
    items.forEach((item) => {
      const normalized = normalizeQuestionForSession(item);
      const id = normalized?._id || normalized?.questionId;
      if (!normalized || !id || seen.has(id) || picked.length >= count) return;
      seen.add(id);
      picked.push(normalized);
    });
  };

  // Topic-priority sampling from selected subject.
  const perTopicCount = Math.max(
    1,
    Math.ceil(count / Math.max(1, selectedTopics.length)),
  );
  selectedTopics.forEach((topic) => {
    const byTopic = questionBankService.getQuestions({
      subject: mappedSubject,
      topic,
      count: perTopicCount,
      excludeIds: Array.from(seen),
    });
    addUnique(byTopic);
  });

  // Subject fallback to fill remaining slots.
  if (picked.length < count) {
    const subjectPool = questionBankService.getQuestions({
      subject: mappedSubject,
      count: count - picked.length,
      excludeIds: Array.from(seen),
    });
    addUnique(subjectPool);
  }

  // Subject-only adaptive fallback (keeps retention strictly scoped by chosen subject).
  if (picked.length < count) {
    const adaptiveSubjectPool = questionBankService
      .getQuestions({
        subject: mappedSubject,
        minDifficulty: 0,
        maxDifficulty: 1,
        count: Math.max(count * 2, count - picked.length),
        excludeIds: Array.from(seen),
      })
      .filter((q) =>
        selectedTopics.length > 0 ? selectedTopics.includes(q.topic) : true,
      );
    addUnique(adaptiveSubjectPool);
  }

  // Subject-topic reuse fallback: repeat from already chosen subject/topic pool only.
  if (picked.length < count) {
    const subjectTopicPool = questionBankService.getQuestions({
      subject: mappedSubject,
      count: Math.max(count * 3, count),
      excludeIds: [],
    });

    const filteredReusePool = subjectTopicPool.filter((q) =>
      selectedTopics.length > 0 ? selectedTopics.includes(q.topic) : true,
    );

    const reusePool =
      filteredReusePool.length > 0 ? filteredReusePool : subjectTopicPool;

    reusePool.forEach((item) => {
      const normalized = normalizeQuestionForSession(item);
      if (!normalized || picked.length >= count) return;
      picked.push(normalized);
    });
  }

  return picked.slice(0, count);
};

const getQuestionBySourceId = async (sourceId) => {
  if (!sourceId) return null;
  const Question = mongoose.model("Question");
  const mongoQuestion = await Question.findOne({ questionId: sourceId });
  if (mongoQuestion) {
    return normalizeQuestionForSession(
      mongoQuestion.toObject ? mongoQuestion.toObject() : mongoQuestion,
    );
  }
  const bankQuestion =
    questionBankService.getQuestionById(sourceId) ||
    questionBankService.getRetentionQuestionById(sourceId);
  return normalizeQuestionForSession(bankQuestion);
};

const getQuestionById = async (questionId) => {
  // Try to get from MongoDB first
  const Question = mongoose.model("Question");
  let question = await Question.findOne({ questionId });

  if (!question) {
    // Fallback to question bank service
    question =
      questionBankService.getQuestionById(questionId) ||
      questionBankService.getRetentionQuestionById(questionId);
  }

  return question;
};

const getQuestionsByIds = async (questionIds) => {
  const Question = mongoose.model("Question");
  const questions = await Question.find({ questionId: { $in: questionIds } });

  // Fill missing with question bank
  const foundIds = questions.map((q) => q.questionId);
  const missingIds = questionIds.filter((id) => !foundIds.includes(id));

  for (const id of missingIds) {
    const q = questionBankService.getQuestionById(id);
    if (q) questions.push(q);
  }

  return questions;
};

const checkAnswer = (question, selectedOptions) => {
  if (!question || !selectedOptions) return false;

  switch (question.type) {
    case "MCQ":
      return selectedOptions === question.correctAnswer;
    case "MSQ":
      const selected = Array.isArray(selectedOptions)
        ? selectedOptions.sort()
        : [selectedOptions];
      const correct = Array.isArray(question.correctAnswer)
        ? question.correctAnswer.sort()
        : [question.correctAnswer];
      return JSON.stringify(selected) === JSON.stringify(correct);
    case "NAT":
      const numSelected = parseFloat(selectedOptions);
      const numCorrect = parseFloat(question.correctAnswer);
      return Math.abs(numSelected - numCorrect) < 0.001;
    default:
      return false;
  }
};

const getAttemptNumber = (session, questionId) => {
  return session.answers.filter((a) => a.questionId === questionId).length + 1;
};

const getTimeSinceLast = (session) => {
  if (session.answers.length === 0) return 86400000; // 24 hours default

  const lastAnswer = session.answers[session.answers.length - 1];
  return Date.now() - new Date(lastAnswer.submittedAt).getTime();
};

const updateQuestionRepetition = async (
  studentId,
  userId,
  questionId,
  wasCorrect,
  responseTimeMs,
  sessionId,
  batchType,
  context = {},
) => {
  let question = context.question || null;
  let repetition = await QuestionRepetition.findOne({
    studentId,
    questionId,
  });

  if (!repetition) {
    // Get question details
    question = await getQuestionById(questionId);
    if (!question) return;

    repetition = new QuestionRepetition({
      studentId,
      userId,
      questionId,
      topicId: question.topicId || question.topic,
      subject: toRetentionSubject(question.subject),
      topicCategory: question.topicCategory || question.topic,
      difficulty: question.difficulty,
      currentBatchType: batchType,
    });
    repetition.initializeSchedule();
  }

  await repetition.updateAfterRepetition(wasCorrect, responseTimeMs, sessionId);

  const questionRef = context.question || question;
  if (questionRef) {
    safeAssignFlexiblePath(repetition, "latestQuestionSnapshot", {
      text: questionRef.text,
      type: questionRef.type,
      difficulty: Number(questionRef.difficulty || 0),
      topic: questionRef.topic,
      topicCategory:
        context.topicCategory || questionRef.topicCategory || questionRef.topic,
      subject: questionRef.subject,
      options: Array.isArray(questionRef.options)
        ? questionRef.options.map((opt) =>
            String(opt?.label || opt?.text || opt?.value || opt),
          )
        : [],
      expectedTime: Number(questionRef.expectedTime || 0),
      savedAt: new Date(),
    });
  }

  const flaskSchedule = context.flaskSchedule;
  const fallbackSchedule = scheduleFromRetentionScore(
    repetition.currentRetention,
  );
  const effectiveSchedule = flaskSchedule
    ? {
        ...fallbackSchedule,
        ...flaskSchedule,
        timerFrameSeconds: pickNearestTimerFrameSeconds(
          firstDefined(
            flaskSchedule.timerFrameSeconds,
            flaskSchedule.repeatInSeconds,
            fallbackSchedule.timerFrameSeconds,
          ),
        ),
      }
    : fallbackSchedule;

  effectiveSchedule.timerFrameLabel = timerFrameLabelFromSeconds(
    effectiveSchedule.timerFrameSeconds,
  );
  effectiveSchedule.repeatInSeconds = effectiveSchedule.timerFrameSeconds;
  effectiveSchedule.repeatInDays = Number(
    (effectiveSchedule.timerFrameSeconds / 86400).toFixed(4),
  );
  effectiveSchedule.reviewBatchType =
    effectiveSchedule.reviewBatchType ||
    toBatchTypeFromTimerSeconds(effectiveSchedule.timerFrameSeconds);
  effectiveSchedule.revisionAvailableAt =
    effectiveSchedule.revisionAvailableAt ||
    new Date(Date.now() + effectiveSchedule.timerFrameSeconds * 1000);
  effectiveSchedule.source = flaskSchedule ? "flask" : "fallback";
  effectiveSchedule.updatedAt = new Date();

  safeAssignFlexiblePath(repetition, "latestFlaskMetrics", effectiveSchedule);
  repetition.currentRetention = clampRatio(
    effectiveSchedule.retentionProbability,
    repetition.currentRetention,
  );
  repetition.currentBatchType =
    effectiveSchedule.reviewBatchType || repetition.currentBatchType;
  repetition.nextScheduledDate = effectiveSchedule.revisionAvailableAt;

  if (typeof repetition.pushSchedulingHistory === "function") {
    repetition.pushSchedulingHistory({
      source: effectiveSchedule.source,
      timerFrameSeconds: effectiveSchedule.timerFrameSeconds,
      timerFrameLabel: effectiveSchedule.timerFrameLabel,
      batchType: repetition.currentBatchType,
      retentionProbability: repetition.currentRetention,
      dueAt: repetition.nextScheduledDate,
    });
  }

  await repetition.save();

  const dueAt = repetition.nextScheduledDate
    ? new Date(repetition.nextScheduledDate)
    : null;

  return {
    questionId: String(questionId),
    retentionTag: formatRetentionTag(repetition.currentBatchType),
    batchType: repetition.currentBatchType,
    dueAt,
    remainingMs: dueAt ? Math.max(0, dueAt.getTime() - Date.now()) : 0,
    isDue: dueAt ? dueAt.getTime() <= Date.now() : false,
    flaskMetrics: repetition.latestFlaskMetrics || null,
    repeatsDone: Number(repetition.currentRepetition || 0),
    schedulingHistory: Array.isArray(repetition.schedulingHistory)
      ? repetition.schedulingHistory.slice(-5)
      : [],
  };
};

const updateRetentionMetrics = async (session) => {
  let metrics = await RetentionMetrics.findOne({
    studentId: session.studentId,
  });

  if (!metrics) {
    metrics = new RetentionMetrics({
      studentId: session.studentId,
      userId: session.userId,
    });
  }

  metrics.updateWithSession(session);

  // Update with Flask predictions if available
  if (session.flaskPredictions) {
    metrics.updateFlaskPredictions(session.flaskPredictions);
  }

  await metrics.save();
};

const calculateCurrentMetrics = (session) => {
  const answers = session.answers;
  if (answers.length === 0) return {};

  const correct = answers.filter((a) => a.isCorrect).length;
  const accuracy = (correct / answers.length) * 100;

  const recentAnswers = answers.slice(-10);
  const recentCorrect = recentAnswers.filter((a) => a.isCorrect).length;
  const recentAccuracy = (recentCorrect / recentAnswers.length) * 100;

  const avgStress =
    answers.reduce((sum, a) => sum + a.stressLevel, 0) / answers.length;
  const avgFatigue =
    answers.reduce((sum, a) => sum + a.fatigueIndex, 0) / answers.length;
  const avgResponseTime =
    answers.reduce((sum, a) => sum + Number(a.responseTimeMs || 0), 0) /
    answers.length;

  return {
    overallAccuracy: accuracy,
    recentAccuracy,
    questionsAnswered: answers.length,
    correctAnswers: correct,
    averageResponseTime: avgResponseTime,
    averageStress: avgStress,
    averageFatigue: avgFatigue,
    currentStreak: calculateStreak(answers),
  };
};

const calculateStreak = (answers) => {
  let streak = 0;
  for (let i = answers.length - 1; i >= 0; i--) {
    if (answers[i].isCorrect) streak++;
    else break;
  }
  return streak;
};

const calculateTrend = (values) => {
  if (values.length < 2) return 0;
  const n = values.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((a, b, i) => a + b * values[i], 0);
  const sumX2 = x.reduce((a, b) => a + b * b, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  return isNaN(slope) ? 0 : slope;
};

const generateSessionRecommendations = (session, topicBreakdown) => {
  const recommendations = [];

  // Find weak topics
  const weakTopics = Object.entries(topicBreakdown)
    .filter(([_, data]) => data.total >= 3 && data.accuracy < 50)
    .map(([topic]) => topic);

  weakTopics.slice(0, 3).forEach((topic) => {
    recommendations.push({
      type: "weakness",
      priority: "high",
      topic,
      message: `Focus on improving ${topic}`,
      action: `Practice more questions in ${topic}`,
    });
  });

  // Check stress
  const avgStress =
    session.answers.reduce((sum, a) => sum + a.stressLevel, 0) /
    session.answers.length;
  if (avgStress > 0.7) {
    recommendations.push({
      type: "stress",
      priority: "high",
      message: "High stress levels detected",
      action: "Take breaks and practice deep breathing",
    });
  }

  // Check fatigue
  const avgFatigue =
    session.answers.reduce((sum, a) => sum + a.fatigueIndex, 0) /
    session.answers.length;
  if (avgFatigue > 0.7) {
    recommendations.push({
      type: "fatigue",
      priority: "high",
      message: "High fatigue detected",
      action: "Consider shorter sessions with adequate rest",
    });
  }

  return recommendations;
};

const mapDifficultyLevel = (difficulty) => {
  if (difficulty < 0.2) return "very_easy";
  if (difficulty < 0.4) return "easy";
  if (difficulty < 0.6) return "medium";
  if (difficulty < 0.8) return "hard";
  return "very_hard";
};
