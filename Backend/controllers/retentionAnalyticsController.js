const RetentionSession = require("../models/RetentionSession");
const QuestionRepetition = require("../models/QuestionRepetition");
const RetentionSessionAnalytics = require("../models/RetentionSessionAnalytics");

const clamp01 = (value, fallback = 0) => {
  const n = Number(value);
  if (!Number.isFinite(n))
    return Math.max(0, Math.min(1, Number(fallback) || 0));
  if (n > 1 && n <= 100) return Math.max(0, Math.min(1, n / 100));
  return Math.max(0, Math.min(1, n));
};

const firstDefined = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
};

const avg = (arr, fallback = 0) => {
  const list = Array.isArray(arr)
    ? arr.map((v) => Number(v)).filter((v) => Number.isFinite(v))
    : [];
  if (!list.length) return fallback;
  return list.reduce((a, b) => a + b, 0) / list.length;
};

const stdDev = (arr, fallback = 0) => {
  const list = Array.isArray(arr)
    ? arr.map((v) => Number(v)).filter((v) => Number.isFinite(v))
    : [];
  if (!list.length) return fallback;
  const mean = avg(list, fallback);
  const variance = avg(
    list.map((v) => (v - mean) ** 2),
    0,
  );
  return Math.sqrt(Math.max(0, variance));
};

const msBetween = (a, b) => {
  const left = new Date(a || 0).getTime();
  const right = new Date(b || 0).getTime();
  if (!Number.isFinite(left) || !Number.isFinite(right)) return 0;
  return Math.max(0, left - right);
};

const formatTopic = (topic) =>
  String(topic || "General")
    .replaceAll("_", " ")
    .trim();

const toHourLabel = (hour) => `${String(hour).padStart(2, "0")}:00`;

const toStudySchedule = (macroOutput = {}, timelineAnalytics = []) => {
  const suggested = firstDefined(
    macroOutput.optimal_daily_study_schedule,
    macroOutput.optimal_daily_schedule,
    macroOutput.daily_schedule,
    [],
  );

  if (Array.isArray(suggested) && suggested.length > 0) {
    return suggested
      .slice(0, 8)
      .map((entry, index) => {
        const label = String(entry?.label || entry?.title || "").trim();
        const startTime = String(
          entry?.startTime || entry?.start_time || "",
        ).trim();
        const endTime = String(entry?.endTime || entry?.end_time || "").trim();
        const focus = String(entry?.focus || entry?.task || "").trim();
        const plannedQuestions = Number(
          firstDefined(entry?.plannedQuestions, entry?.planned_questions, 0),
        );

        // Keep only model-backed rows with meaningful non-null content.
        const hasCoreValue =
          Boolean(label) ||
          Boolean(startTime) ||
          Boolean(endTime) ||
          Boolean(focus) ||
          Number.isFinite(plannedQuestions);

        if (!hasCoreValue) return null;

        return {
          label: label || `Study Slot ${index + 1}`,
          startTime,
          endTime,
          focus,
          plannedQuestions: Math.max(
            0,
            Number.isFinite(plannedQuestions) ? plannedQuestions : 0,
          ),
          source: "model",
        };
      })
      .filter(Boolean);
  }

  // If model schedule is not available, derive session schedule from actual
  // timestamp density, not fixed placeholders.
  const buckets = new Map();
  timelineAnalytics.forEach((point) => {
    const hour = new Date(point?.timestamp || 0).getHours();
    if (!Number.isFinite(hour)) return;
    if (!buckets.has(hour)) {
      buckets.set(hour, {
        hour,
        count: 0,
        retentionSum: 0,
        complexitySum: 0,
      });
    }
    const bucket = buckets.get(hour);
    bucket.count += 1;
    bucket.retentionSum += clamp01(point?.retentionProbability, 0);
    bucket.complexitySum += clamp01(point?.complexityIndex, 0);
  });

  return Array.from(buckets.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
    .map((bucket, index) => {
      const avgRetention =
        bucket.count > 0 ? bucket.retentionSum / bucket.count : 0;
      const avgComplexity =
        bucket.count > 0 ? bucket.complexitySum / bucket.count : 0;

      return {
        label: `Peak Session Window ${index + 1}`,
        startTime: toHourLabel(bucket.hour),
        endTime: toHourLabel(Math.min(23, bucket.hour + 1)),
        focus:
          avgRetention < 0.55
            ? "Retention reinforcement"
            : avgComplexity > 0.6
              ? "Complexity balancing"
              : "Stability maintenance",
        plannedQuestions: bucket.count,
        source: "session",
      };
    });
};

const toSubjectPriority = (subject, macroOutput = {}) => {
  const raw = firstDefined(
    macroOutput.subject_priority_order,
    macroOutput.subjectPriorityOrder,
    [],
  );

  if (Array.isArray(raw) && raw.length > 0) {
    return raw.slice(0, 5).map((entry, index) => ({
      rank: Number(entry?.rank || index + 1),
      subject: String(entry?.subject || entry?.name || subject || "General"),
      score: Math.round(
        clamp01(firstDefined(entry?.score, entry?.priorityScore, 0.7), 0.7) *
          100,
      ),
    }));
  }

  return [];
};

const buildTopicPriority = (questionAnalytics = []) => {
  const byTopic = new Map();

  questionAnalytics.forEach((item) => {
    const key = formatTopic(item.topic || "General");
    if (!byTopic.has(key)) {
      byTopic.set(key, {
        topic: key,
        total: 0,
        retentionTotal: 0,
        correct: 0,
      });
    }

    const row = byTopic.get(key);
    row.total += 1;
    row.retentionTotal += clamp01(item.retentionProbability, 0);
    if (item.isCorrect) row.correct += 1;
  });

  return Array.from(byTopic.values())
    .map((row) => {
      const retentionScore = row.total > 0 ? row.retentionTotal / row.total : 0;
      const accuracy = row.total > 0 ? row.correct / row.total : 0;
      const priorityScore = Math.max(
        0,
        Math.min(
          100,
          Math.round((1 - retentionScore) * 70 + (1 - accuracy) * 30),
        ),
      );

      return {
        topic: row.topic,
        retentionScore,
        questionsAttempted: row.total,
        priorityScore,
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 10);
};

const buildQuestionAnalytics = (session, repetitionsByQuestion = new Map()) => {
  const microPredictions = Array.isArray(session?.flaskPredictions?.micro)
    ? session.flaskPredictions.micro
    : session?.flaskPredictions?.micro
      ? [session.flaskPredictions.micro]
      : [];

  return (Array.isArray(session?.answers) ? session.answers : []).map(
    (answer, index) => {
      const qid = String(answer?.questionId || "").trim();
      const repetition = repetitionsByQuestion.get(qid) || null;
      const metrics = repetition?.latestFlaskMetrics || {};
      const microHit =
        microPredictions.find(
          (row) =>
            String(row?.question_id || row?.questionId || "").trim() === qid,
        ) || {};

      const retentionProbability = clamp01(
        firstDefined(
          metrics.retentionProbability,
          metrics.retention_probability,
          microHit.retention_probability,
          repetition?.currentRetention,
        ),
        0,
      );

      const nextQuestionDifficulty = clamp01(
        firstDefined(
          metrics.nextQuestionDifficulty,
          metrics.next_question_difficulty,
          microHit.next_question_difficulty,
          answer?.difficulty,
        ),
        0.5,
      );

      const probabilityCorrectNextAttempt = clamp01(
        firstDefined(
          metrics.probabilityCorrectNext,
          metrics.probability_correct_next,
          microHit.probability_correct_next,
        ),
        0,
      );

      const repeatDays = Number(
        firstDefined(
          metrics.repeatInDays,
          metrics.repeat_in_days,
          metrics.optimalRevisionIntervalDays,
        ),
      );

      return {
        questionId: qid,
        questionText: String(
          firstDefined(
            repetition?.latestQuestionSnapshot?.text,
            answer?.questionText,
            `Question ${index + 1}`,
          ),
        ),
        topic: formatTopic(
          firstDefined(answer?.topicCategory, answer?.topicId, "General"),
        ),
        sequence: index + 1,
        attemptedAt: answer?.submittedAt || new Date(),
        isCorrect: Boolean(answer?.isCorrect),
        responseTimeMs: Math.max(0, Number(answer?.responseTimeMs || 0)),
        attemptNumber: Math.max(1, Number(answer?.attemptNumber || 1)),
        retentionProbability,
        nextQuestionDifficulty,
        probabilityCorrectNextAttempt,
        optimalRevisionIntervalDays: Number.isFinite(repeatDays)
          ? Math.max(0, repeatDays)
          : 0,
        reviewStage: String(
          firstDefined(
            metrics.reviewBatchType,
            metrics.batch_type,
            repetition?.currentBatchType,
            "scheduled",
          ),
        ),
      };
    },
  );
};

const buildTimelineAnalytics = (session, questionAnalytics = []) => {
  const answers = Array.isArray(session?.answers) ? session.answers : [];
  const byQuestionId = new Map(
    questionAnalytics.map((row) => [String(row?.questionId || ""), row]),
  );

  const startMs = new Date(session?.startTime || 0).getTime();
  const safeStartMs = Number.isFinite(startMs) ? startMs : Date.now();

  return answers.map((answer, index) => {
    const qid = String(answer?.questionId || "").trim();
    const qAnalytics = byQuestionId.get(qid) || {};
    const timestamp = answer?.submittedAt || new Date();
    const attemptMs = new Date(timestamp || 0).getTime();
    const prevTimestamp =
      index > 0 ? answers[index - 1]?.submittedAt : session?.startTime;
    const gapMs = msBetween(timestamp, prevTimestamp);
    const elapsedMs = Number.isFinite(attemptMs)
      ? Math.max(0, attemptMs - safeStartMs)
      : Math.max(
          0,
          answers
            .slice(0, index + 1)
            .reduce((sum, item) => sum + Number(item?.responseTimeMs || 0), 0),
        );

    const responseSeconds = Math.max(
      0,
      Number(answer?.responseTimeMs || 0) / 1000,
    );
    const normalizedTime = Math.max(0, Math.min(1, responseSeconds / 90));
    const stress = clamp01(answer?.stressLevel, 0);
    const fatigue = clamp01(answer?.fatigueIndex, 0);
    const focus = clamp01(answer?.focusScore, 0);
    const complexityIndex = clamp01(
      normalizedTime * 0.32 +
        stress * 0.24 +
        fatigue * 0.24 +
        (1 - focus) * 0.2,
      0,
    );

    return {
      sequence: index + 1,
      questionId: qid,
      timestamp,
      elapsedSeconds: Number((elapsedMs / 1000).toFixed(1)),
      gapSeconds: Number((gapMs / 1000).toFixed(1)),
      retentionProbability: clamp01(qAnalytics?.retentionProbability, 0),
      nextQuestionDifficulty: clamp01(qAnalytics?.nextQuestionDifficulty, 0),
      probabilityCorrectNextAttempt: clamp01(
        qAnalytics?.probabilityCorrectNextAttempt,
        0,
      ),
      responseTimeMs: Math.max(0, Number(answer?.responseTimeMs || 0)),
      isCorrect: Boolean(answer?.isCorrect),
      stressLevel: stress,
      fatigueIndex: fatigue,
      focusScore: focus,
      complexityIndex,
    };
  });
};

const buildTimestampSummary = (session, timelineAnalytics = []) => {
  const startTime = session?.startTime || null;
  const endTime =
    session?.endTime ||
    (timelineAnalytics.length ? timelineAnalytics.at(-1)?.timestamp : null);
  const durationMs = startTime && endTime ? msBetween(endTime, startTime) : 0;

  const gaps = timelineAnalytics.map((row) => Number(row?.gapSeconds || 0));
  const hours = timelineAnalytics
    .map((row) => new Date(row?.timestamp || 0).getHours())
    .filter((h) => Number.isFinite(h));

  const hourCount = new Map();
  hours.forEach((h) => {
    hourCount.set(h, (hourCount.get(h) || 0) + 1);
  });

  let peakHour = null;
  let peakCount = -1;
  for (const [h, count] of hourCount.entries()) {
    if (count > peakCount) {
      peakHour = h;
      peakCount = count;
    }
  }

  const attemptsCount = timelineAnalytics.length;
  const durationMinutes = durationMs > 0 ? durationMs / 60000 : 0;

  return {
    firstAttemptAt: timelineAnalytics[0]?.timestamp || null,
    lastAttemptAt: timelineAnalytics.at(-1)?.timestamp || null,
    sessionStartedAt: startTime,
    sessionEndedAt: endTime,
    durationMinutes: Number(durationMinutes.toFixed(2)),
    attemptsPerMinute:
      durationMinutes > 0
        ? Number((attemptsCount / durationMinutes).toFixed(3))
        : 0,
    averageGapSeconds: Number(avg(gaps, 0).toFixed(2)),
    minGapSeconds: gaps.length ? Number(Math.min(...gaps).toFixed(2)) : 0,
    maxGapSeconds: gaps.length ? Number(Math.max(...gaps).toFixed(2)) : 0,
    peakActivityHour: Number.isFinite(peakHour) ? peakHour : null,
    activeHours: Array.from(hourCount.keys()).sort((a, b) => a - b),
  };
};

const buildComplexityAnalytics = (
  timelineAnalytics = [],
  questionAnalytics = [],
) => {
  const complexityValues = timelineAnalytics.map((row) =>
    clamp01(row?.complexityIndex, 0),
  );
  const responseTimes = timelineAnalytics.map((row) =>
    Number(row?.responseTimeMs || 0),
  );
  const retentionValues = questionAnalytics.map((row) =>
    clamp01(row?.retentionProbability, 0),
  );
  const pNextValues = questionAnalytics.map((row) =>
    clamp01(row?.probabilityCorrectNextAttempt, 0),
  );

  const correctnessVolatility = stdDev(
    timelineAnalytics.map((row) => (row?.isCorrect ? 1 : 0)),
    0,
  );

  return {
    averageComplexityIndex: Number(avg(complexityValues, 0).toFixed(4)),
    peakComplexityIndex: Number(
      (complexityValues.length ? Math.max(...complexityValues) : 0).toFixed(4),
    ),
    complexityVolatility: Number(stdDev(complexityValues, 0).toFixed(4)),
    averageResponseTimeMs: Number(avg(responseTimes, 0).toFixed(2)),
    responseTimeVolatilityMs: Number(stdDev(responseTimes, 0).toFixed(2)),
    correctnessVolatility: Number(correctnessVolatility.toFixed(4)),
    retentionStabilityIndex: Number(
      (1 - Math.min(1, stdDev(retentionValues, 0))).toFixed(4),
    ),
    predictionStabilityIndex: Number(
      (1 - Math.min(1, stdDev(pNextValues, 0))).toFixed(4),
    ),
  };
};

const buildGraphSnapshots = (
  timelineAnalytics = [],
  questionAnalytics = [],
) => {
  const timelineSeries = timelineAnalytics.map((row) => ({
    sequence: row.sequence,
    timestamp: row.timestamp,
    elapsedSeconds: row.elapsedSeconds,
    retentionProbability: row.retentionProbability,
    probabilityCorrectNextAttempt: row.probabilityCorrectNextAttempt,
    nextQuestionDifficulty: row.nextQuestionDifficulty,
    complexityIndex: row.complexityIndex,
    responseTimeMs: row.responseTimeMs,
    isCorrect: row.isCorrect,
  }));

  const hourlyBuckets = new Map();
  timelineAnalytics.forEach((row) => {
    const hour = new Date(row?.timestamp || 0).getHours();
    if (!Number.isFinite(hour)) return;
    if (!hourlyBuckets.has(hour)) {
      hourlyBuckets.set(hour, {
        hour,
        count: 0,
        complexitySum: 0,
        retentionSum: 0,
      });
    }
    const bucket = hourlyBuckets.get(hour);
    bucket.count += 1;
    bucket.complexitySum += clamp01(row?.complexityIndex, 0);
    bucket.retentionSum += clamp01(row?.retentionProbability, 0);
  });

  const hourlySeries = Array.from(hourlyBuckets.values())
    .sort((a, b) => a.hour - b.hour)
    .map((bucket) => ({
      hour: bucket.hour,
      attempts: bucket.count,
      averageComplexityIndex:
        bucket.count > 0
          ? Number((bucket.complexitySum / bucket.count).toFixed(4))
          : 0,
      averageRetentionProbability:
        bucket.count > 0
          ? Number((bucket.retentionSum / bucket.count).toFixed(4))
          : 0,
    }));

  const questionScatter = questionAnalytics.map((row) => ({
    questionId: row.questionId,
    sequence: row.sequence,
    retentionProbability: row.retentionProbability,
    probabilityCorrectNextAttempt: row.probabilityCorrectNextAttempt,
    nextQuestionDifficulty: row.nextQuestionDifficulty,
    optimalRevisionIntervalDays: row.optimalRevisionIntervalDays,
    isCorrect: row.isCorrect,
  }));

  return {
    timelineSeries,
    hourlySeries,
    questionScatter,
  };
};

const summarizeInsights = (snapshot) => {
  const insights = [];

  if (snapshot.subjectRetentionScore < 0.45) {
    insights.push(
      "Retention is currently fragile; prioritize immediate and short-gap review blocks.",
    );
  } else if (snapshot.subjectRetentionScore >= 0.75) {
    insights.push(
      "Retention is strong; keep spaced repetition consistent to protect long-term memory.",
    );
  }

  if (snapshot.fatigueRiskProbability >= 0.65) {
    insights.push(
      "Fatigue risk is elevated; reduce session length and increase short breaks.",
    );
  }

  if (snapshot.nextTopicRevisionPriority.length > 0) {
    const top = snapshot.nextTopicRevisionPriority[0];
    insights.push(
      `Highest revision priority is ${top.topic} (${top.priorityScore}/100).`,
    );
  }

  const avgGap = Number(snapshot?.timestampSummary?.averageGapSeconds || 0);
  if (avgGap > 80) {
    insights.push(
      "Long gaps between attempts were detected; tighter pacing may improve memory continuity.",
    );
  }

  const complexity = Number(
    snapshot?.complexityAnalytics?.averageComplexityIndex || 0,
  );
  if (complexity >= 0.65) {
    insights.push(
      "Session cognitive complexity stayed high; use shorter bursts and active recall checkpoints.",
    );
  }

  return insights.slice(0, 4);
};

const buildAnalyticsSnapshot = async (session, source = "session-summary") => {
  const questionIds = Array.from(
    new Set(
      (Array.isArray(session?.answers) ? session.answers : [])
        .map((a) => String(a?.questionId || "").trim())
        .filter(Boolean),
    ),
  );

  const repetitions = await QuestionRepetition.find({
    studentId: session.studentId,
    questionId: { $in: questionIds },
  })
    .sort({ updatedAt: -1 })
    .lean();

  const repetitionsByQuestion = new Map();
  repetitions.forEach((row) => {
    const qid = String(row?.questionId || "").trim();
    if (qid && !repetitionsByQuestion.has(qid)) {
      repetitionsByQuestion.set(qid, row);
    }
  });

  const questionAnalytics = buildQuestionAnalytics(
    session,
    repetitionsByQuestion,
  );

  const macroOutput = firstDefined(session?.flaskPredictions?.macro, {});
  const mesoOutput = Array.isArray(session?.flaskPredictions?.meso)
    ? session.flaskPredictions.meso[0] || {}
    : session?.flaskPredictions?.meso || {};

  const subjectRetentionScore = clamp01(
    firstDefined(
      mesoOutput.subject_retention_score,
      mesoOutput.retention_30d,
      avg(
        questionAnalytics.map((q) => q.retentionProbability),
        0.5,
      ),
    ),
    0.5,
  );

  const predictedLongTermRetentionScore = clamp01(
    firstDefined(
      macroOutput.predicted_long_term_retention_score,
      macroOutput.projected_retention,
      mesoOutput.retention_90d,
      subjectRetentionScore,
    ),
    subjectRetentionScore,
  );

  const fatigueRiskProbability = clamp01(
    firstDefined(
      macroOutput.fatigue_risk_probability,
      macroOutput.burnout_risk,
      avg(
        (Array.isArray(session?.answers) ? session.answers : []).map(
          (a) => a?.fatigueIndex,
        ),
        0.3,
      ),
    ),
    0.3,
  );

  const optimalRevisionIntervalDays = Math.max(
    0,
    avg(
      questionAnalytics.map((q) => q.optimalRevisionIntervalDays),
      0,
    ),
  );

  const snapshot = {
    sessionId: session.sessionId,
    studentId: session.studentId,
    userId: session.userId,
    subject: session.subject,
    topics: Array.isArray(session.topics) ? session.topics : [],
    status: session.status,
    sessionStartTime: session.startTime,
    sessionEndTime: session.endTime || null,
    sessionDurationMinutes:
      session.endTime && session.startTime
        ? Math.max(
            0,
            (new Date(session.endTime).getTime() -
              new Date(session.startTime).getTime()) /
              60000,
          )
        : 0,

    subjectRetentionScore,
    nextTopicRevisionPriority: buildTopicPriority(questionAnalytics),
    optimalRevisionIntervalDays,

    retentionProbabilityOverall: clamp01(
      avg(
        questionAnalytics.map((q) => q.retentionProbability),
        subjectRetentionScore,
      ),
      subjectRetentionScore,
    ),
    nextQuestionDifficultyOverall: clamp01(
      avg(
        questionAnalytics.map((q) => q.nextQuestionDifficulty),
        0.5,
      ),
      0.5,
    ),
    probabilityCorrectNextAttemptOverall: clamp01(
      avg(
        questionAnalytics.map((q) => q.probabilityCorrectNextAttempt),
        subjectRetentionScore,
      ),
      subjectRetentionScore,
    ),

    optimalDailyStudySchedule: toStudySchedule(
      macroOutput,
      buildTimelineAnalytics(session, questionAnalytics),
    ),
    subjectPriorityOrder: toSubjectPriority(session.subject, macroOutput),
    predictedLongTermRetentionScore,
    fatigueRiskProbability,

    questionAnalytics,
    timelineAnalytics: buildTimelineAnalytics(session, questionAnalytics),
    source,
  };

  snapshot.timestampSummary = buildTimestampSummary(
    session,
    snapshot.timelineAnalytics,
  );
  snapshot.complexityAnalytics = buildComplexityAnalytics(
    snapshot.timelineAnalytics,
    questionAnalytics,
  );
  snapshot.graphSnapshots = buildGraphSnapshots(
    snapshot.timelineAnalytics,
    questionAnalytics,
  );

  snapshot.insights = summarizeInsights(snapshot);
  return snapshot;
};

const upsertSessionAnalyticsSnapshot = async (
  session,
  source = "session-summary",
) => {
  if (!session?.sessionId || !session?.studentId) return null;

  const snapshot = await buildAnalyticsSnapshot(session, source);
  await RetentionSessionAnalytics.findOneAndUpdate(
    { sessionId: session.sessionId },
    { $set: snapshot },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true },
  );

  return snapshot;
};

exports.getSessionAnalytics = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await RetentionSession.findOne({ sessionId });
    if (!session) {
      return res
        .status(404)
        .json({ success: false, error: "Session not found" });
    }

    if (String(session.studentId) !== String(req.user?.studentId || "")) {
      return res
        .status(403)
        .json({ success: false, error: "Unauthorized access to this session" });
    }

    const forceRefresh =
      String(req.query?.refresh || "").toLowerCase() === "true";

    let analyticsDoc = null;
    if (!forceRefresh) {
      analyticsDoc = await RetentionSessionAnalytics.findOne({
        sessionId,
      }).lean();
    }

    if (!analyticsDoc) {
      await upsertSessionAnalyticsSnapshot(session, "session-summary");
      analyticsDoc = await RetentionSessionAnalytics.findOne({
        sessionId,
      }).lean();
    }

    return res.json({
      success: true,
      analytics: analyticsDoc,
    });
  } catch (error) {
    console.error("Error getting retention analytics snapshot:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

exports.syncSessionAnalytics = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await RetentionSession.findOne({ sessionId });

    if (!session) {
      return res
        .status(404)
        .json({ success: false, error: "Session not found" });
    }

    if (String(session.studentId) !== String(req.user?.studentId || "")) {
      return res
        .status(403)
        .json({ success: false, error: "Unauthorized access to this session" });
    }

    const snapshot = await upsertSessionAnalyticsSnapshot(
      session,
      "session-summary",
    );
    return res.json({ success: true, analytics: snapshot });
  } catch (error) {
    console.error("Error syncing retention analytics snapshot:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

exports.upsertSessionAnalyticsSnapshot = upsertSessionAnalyticsSnapshot;
