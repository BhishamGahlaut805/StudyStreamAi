const { SOCKET_EVENTS } = require("../utils/constants");
const RetentionSession = require("../models/RetentionSession");
const QuestionRepetition = require("../models/QuestionRepetition");
const retentionFlaskService = require("./retentionFlaskService");

const initializeRetentionSocket = (io) => {
  const retentionNamespace = io.of("/retention");

  retentionNamespace.on("connection", (socket) => {
    console.log(`Retention client connected: ${socket.id}`);

    // Join retention session
    socket.on("join-retention-session", async ({ sessionId, studentId }) => {
      try {
        socket.join(`retention:${sessionId}`);
        socket.data.sessionId = sessionId;
        socket.data.studentId = studentId;

        const session = await RetentionSession.findOne({ sessionId });

        if (session) {
          const currentQuestionIndex = session.currentQuestionIndex;
          const totalQuestions = session.currentBatchQuestions.length;

          socket.emit("retention-session-joined", {
            sessionId,
            subject: session.subject,
            topics: session.topics,
            status: session.status,
            currentBatchType: session.currentBatchType,
            currentQuestionIndex,
            totalQuestions,
            answeredCount: session.answers.length,
            metrics: session.metrics,
            predictions: session.flaskPredictions,
          });

          const queueState = await buildSocketQueueState(session);
          socket.emit("retention-queue-sync", {
            sessionId,
            queueState,
          });
        }

        console.log(
          `Student ${studentId} joined retention session ${sessionId}`,
        );
      } catch (error) {
        console.error("Error joining retention session:", error);
        socket.emit("error", { message: error.message });
      }
    });

    socket.on("leave-retention-session", ({ sessionId }) => {
      const safeSessionId = String(
        sessionId || socket.data.sessionId || "",
      ).trim();
      if (!safeSessionId) return;

      socket.leave(`retention:${safeSessionId}`);
      if (socket.data.sessionId === safeSessionId) {
        socket.data.sessionId = null;
      }
    });

    // Submit answer via socket
    socket.on(
      "submit-retention-answer",
      async ({ sessionId, questionId, answerData = {} }) => {
        try {
          const session = await RetentionSession.findOne({ sessionId });

          if (!session) {
            socket.emit("error", { message: "Session not found" });
            return;
          }

          const currentQuestionData =
            session.currentBatchQuestions?.[session.currentQuestionIndex] ||
            null;
          const resolvedQuestionId =
            questionId ||
            answerData.questionId ||
            answerData.question_id ||
            currentQuestionData?.questionId;

          if (!resolvedQuestionId) {
            socket.emit("error", {
              message: "Missing questionId in retention answer payload",
            });
            return;
          }

          // Get question details (simplified - you'd need to fetch from somewhere)
          const isCorrect = checkAnswer(
            answerData.selectedOptions,
            resolvedQuestionId,
          ); // Simplified

          const resolvedTopicId =
            answerData.topicId ||
            currentQuestionData?.topicId ||
            normalizeRetentionTopic(
              session.subject,
              answerData.topicCategory || answerData.topic,
            );
          const resolvedTopicCategory = normalizeRetentionTopic(
            session.subject,
            answerData.topicCategory || answerData.topic || resolvedTopicId,
          );

          const answer = {
            questionId: resolvedQuestionId,
            topicId: resolvedTopicId,
            subject: session.subject,
            topicCategory: resolvedTopicCategory,
            isCorrect,
            responseTimeMs: answerData.responseTimeMs || 0,
            hesitationCount: answerData.hesitationCount || 0,
            confidence: answerData.confidence || 0.5,
            difficulty: answerData.difficulty,
            stressLevel: answerData.stressLevel || 0.3,
            fatigueIndex: answerData.fatigueIndex || 0.3,
            focusScore: answerData.focusScore || 0.7,
            attemptNumber: answerData.attemptNumber || 1,
            sessionPosition: session.answers.length + 1,
            timeSinceLastMs: answerData.timeSinceLastMs || 0,
            answerChanges: answerData.answerChanges || 0,
            moodScore: answerData.moodScore || 0.5,
            sleepQuality: answerData.sleepQuality || 0.7,
          };

          session.answers.push(answer);
          session.currentQuestionIndex++;

          // Check if need more questions
          const remainingInBatch =
            session.currentBatchQuestions.length - session.currentQuestionIndex;

          let nextQuestion = null;
          let sessionComplete = false;

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

              const flaskResponse =
                await retentionFlaskService.getNextQuestions(
                  session.flaskSessionId || session.sessionId,
                  recentAnswers,
                  {
                    currentStress: answerData.stressLevel || 0.3,
                    currentFatigue: answerData.fatigueIndex || 0.3,
                  },
                );

              if (flaskResponse.success && flaskResponse.questions) {
                appendQuestionsToQueue(session, flaskResponse.questions, {
                  source: "fresh",
                });

                if (flaskResponse.predictions) {
                  session.flaskPredictions = {
                    ...session.flaskPredictions,
                    ...flaskResponse.predictions,
                  };
                }
              }
            } catch (error) {
              console.error("Error getting next batch:", error);
            }
          }

          // Get next question if available
          if (
            session.currentQuestionIndex < session.currentBatchQuestions.length
          ) {
            const nextQuestionData =
              session.currentBatchQuestions[session.currentQuestionIndex];
            nextQuestion = {
              id: nextQuestionData.questionId,
              // Add other question details here
            };
          } else {
            session.status = "completed";
            session.endTime = new Date();
            session.calculateMetrics();
            sessionComplete = true;
          }

          await session.save();

          // Calculate current metrics
          const correct = session.answers.filter((a) => a.isCorrect).length;
          const accuracy = (correct / session.answers.length) * 100;

          const recentAnswers = session.answers.slice(-10);
          const recentCorrect = recentAnswers.filter((a) => a.isCorrect).length;
          const recentAccuracy = (recentCorrect / recentAnswers.length) * 100;

          socket.emit("answer-confirmed", {
            sessionId,
            questionId: resolvedQuestionId,
            isCorrect,
            correctAnswer: answerData.correctAnswer,
            explanation: answerData.explanation,
            currentMetrics: {
              overallAccuracy: accuracy,
              recentAccuracy,
              questionsAnswered: session.answers.length,
              correctAnswers: correct,
            },
            nextQuestion,
            sessionComplete,
          });

          // Broadcast to all in room
          retentionNamespace
            .to(`retention:${sessionId}`)
            .emit("answer-processed", {
              sessionId,
              questionId: resolvedQuestionId,
              isCorrect,
              answeredCount: session.answers.length,
              currentMetrics: {
                overallAccuracy: accuracy,
                recentAccuracy,
              },
            });

          if (sessionComplete) {
            retentionNamespace
              .to(`retention:${sessionId}`)
              .emit("retention-session-complete", {
                sessionId,
                metrics: session.metrics,
              });
          }
        } catch (error) {
          console.error("Error processing retention answer:", error);
          socket.emit("error", { message: error.message });
        }
      },
    );

    // Request next question
    socket.on("request-next-retention-question", async ({ sessionId }) => {
      try {
        const session = await RetentionSession.findOne({ sessionId });

        if (!session) {
          socket.emit("error", { message: "Session not found" });
          return;
        }

        // Keep socket path aligned with REST: schedule due repeats next, but never preempt
        // a question that has already been served and is awaiting submission.
        await injectDueQuestionIntoQueue(session);

        if (
          session.currentQuestionIndex >= session.currentBatchQuestions.length
        ) {
          // Check if session complete
          if (session.status !== "completed") {
            session.status = "completed";
            session.endTime = new Date();
            session.calculateMetrics();
            await session.save();
          }

          socket.emit("no-more-questions", {
            sessionId,
            message: "Session complete",
            metrics: session.metrics,
          });
          return;
        }

        const nextQuestionData =
          session.currentBatchQuestions[session.currentQuestionIndex];
        // Fetch full question details
        const question = await getQuestionDetails(nextQuestionData.questionId);

        if (!question) {
          socket.emit("error", {
            message: `Question not found for id ${nextQuestionData.questionId}`,
          });
          return;
        }

        const resolvedNextQuestionId =
          question._id ||
          question.questionId ||
          question.id ||
          nextQuestionData.questionId;

        markQuestionAsSent(
          session,
          resolvedNextQuestionId,
          nextQuestionData?.source || "fresh",
        );
        if (
          session.currentBatchQuestions?.[session.currentQuestionIndex] &&
          nextQuestionData?.source !== "retention"
        ) {
          session.currentBatchQuestions[session.currentQuestionIndex].sentAt =
            new Date();
        }
        await session.save();

        socket.emit("next-retention-question", {
          sessionId,
          question: {
            id: resolvedNextQuestionId,
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
          },
          questionNumber: session.currentQuestionIndex + 1,
          totalInBatch: session.currentBatchQuestions.length,
          batchType: session.currentBatchType,
          predictions: {
            expectedRetention:
              session.flaskPredictions.micro?.current_retention,
            stressImpact: session.flaskPredictions.micro?.stress_impact,
            fatigueLevel: session.flaskPredictions.micro?.fatigue_level,
          },
        });
      } catch (error) {
        console.error("Error requesting next question:", error);
        socket.emit("error", { message: error.message });
      }
    });

    // Request real-time analytics
    socket.on("request-retention-analytics", async ({ sessionId }) => {
      try {
        const session = await RetentionSession.findOne({ sessionId });

        if (!session) {
          socket.emit("error", { message: "Session not found" });
          return;
        }

        const answers = session.answers;
        if (answers.length === 0) {
          socket.emit("retention-analytics-update", {
            sessionId,
            analytics: {
              currentAccuracy: 0,
              questionsAnswered: 0,
              averageStress: 0,
              averageFatigue: 0,
            },
          });
          return;
        }

        const correct = answers.filter((a) => a.isCorrect).length;
        const accuracy = (correct / answers.length) * 100;

        const recentAnswers = answers.slice(-10);
        const recentCorrect = recentAnswers.filter((a) => a.isCorrect).length;
        const recentAccuracy = (recentCorrect / recentAnswers.length) * 100;

        const avgStress =
          answers.reduce((sum, a) => sum + a.stressLevel, 0) / answers.length;
        const avgFatigue =
          answers.reduce((sum, a) => sum + a.fatigueIndex, 0) / answers.length;

        // Topic-wise breakdown
        const topicBreakdown = {};
        answers.forEach((a) => {
          if (!topicBreakdown[a.topicCategory]) {
            topicBreakdown[a.topicCategory] = { total: 0, correct: 0 };
          }
          topicBreakdown[a.topicCategory].total++;
          if (a.isCorrect) topicBreakdown[a.topicCategory].correct++;
        });

        Object.keys(topicBreakdown).forEach((topic) => {
          topicBreakdown[topic].accuracy =
            (topicBreakdown[topic].correct / topicBreakdown[topic].total) * 100;
        });

        socket.emit("retention-analytics-update", {
          sessionId,
          analytics: {
            currentAccuracy: accuracy,
            recentAccuracy,
            questionsAnswered: answers.length,
            correctAnswers: correct,
            averageStress: avgStress,
            averageFatigue: avgFatigue,
            topicBreakdown,
            currentStreak: calculateStreak(answers),
            pace: calculatePace(answers),
          },
        });
      } catch (error) {
        console.error("Error requesting analytics:", error);
        socket.emit("error", { message: error.message });
      }
    });

    // Request retention queue snapshot for reconnect recovery
    socket.on("request-retention-queue-state", async ({ sessionId }) => {
      try {
        const session = await RetentionSession.findOne({ sessionId });

        if (!session) {
          socket.emit("error", { message: "Session not found" });
          return;
        }

        const queueState = await buildSocketQueueState(session);
        socket.emit("retention-queue-sync", {
          sessionId,
          queueState,
        });
      } catch (error) {
        console.error("Error getting retention queue state:", error);
        socket.emit("error", { message: error.message });
      }
    });

    // Pause session
    socket.on("pause-retention-session", async ({ sessionId }) => {
      try {
        const session = await RetentionSession.findOne({ sessionId });

        if (session && session.status === "active") {
          session.status = "paused";
          await session.save();

          retentionNamespace
            .to(`retention:${sessionId}`)
            .emit("retention-session-paused", {
              sessionId,
              pausedAt: new Date(),
            });
        }
      } catch (error) {
        console.error("Error pausing session:", error);
        socket.emit("error", { message: error.message });
      }
    });

    // Resume session
    socket.on("resume-retention-session", async ({ sessionId }) => {
      try {
        const session = await RetentionSession.findOne({ sessionId });

        if (session && session.status === "paused") {
          session.status = "active";
          await session.save();

          retentionNamespace
            .to(`retention:${sessionId}`)
            .emit("retention-session-resumed", {
              sessionId,
              resumedAt: new Date(),
            });
        }
      } catch (error) {
        console.error("Error resuming session:", error);
        socket.emit("error", { message: error.message });
      }
    });

    // Disconnect
    socket.on("disconnect", () => {
      console.log(`Retention client disconnected: ${socket.id}`);
    });
  });
};

// Helper functions
const calculateStreak = (answers) => {
  let streak = 0;
  for (let i = answers.length - 1; i >= 0; i--) {
    if (answers[i].isCorrect) streak++;
    else break;
  }
  return streak;
};

const calculatePace = (answers) => {
  if (answers.length < 5) return "normal";

  const recent = answers.slice(-5);
  const avgTime = recent.reduce((sum, a) => sum + a.responseTimeMs, 0) / 5;

  if (avgTime < 30000) return "fast"; // < 30 seconds
  if (avgTime < 60000) return "normal"; // < 60 seconds
  return "slow"; // > 60 seconds
};

const checkAnswer = (selectedOptions, questionId) => {
  // This would need actual question data
  // Simplified for socket handler
  return true;
};

const resolveQuestionId = (questionLike) => {
  if (!questionLike || typeof questionLike !== "object") return "";
  const candidates = [
    questionLike.questionId,
    questionLike.question_id,
    questionLike._id,
    questionLike.id,
  ];
  for (const candidate of candidates) {
    const text = String(candidate || "").trim();
    if (text) return text;
  }
  return "";
};

const ensureSentQuestionStore = (session) => {
  if (!Array.isArray(session?.sentQuestionIds)) {
    session.sentQuestionIds = [];
  }
};

const markQuestionAsSent = (session, questionId, source = "fresh") => {
  if (!session || !questionId || source === "retention") return;
  ensureSentQuestionStore(session);
  const id = String(questionId);
  if (!session.sentQuestionIds.includes(id)) {
    session.sentQuestionIds.push(id);
  }
};

const appendQuestionsToQueue = (
  session,
  questions = [],
  { source = "fresh", insertAt = null } = {},
) => {
  if (!session) return 0;
  ensureSentQuestionStore(session);

  const sentFreshIds = new Set(
    (session.sentQuestionIds || []).map((id) => String(id)).filter(Boolean),
  );
  const answeredIds = new Set(
    (session.answers || [])
      .map((a) => String(a?.questionId || ""))
      .filter(Boolean),
  );
  const queuedIds = new Set(
    (session.currentBatchQuestions || [])
      .map((row) => String(row?.questionId || ""))
      .filter(Boolean),
  );

  const safeSource = source === "retention" ? "retention" : "fresh";
  const rows = [];

  (Array.isArray(questions) ? questions : []).forEach((q) => {
    const questionId = resolveQuestionId(q);
    if (!questionId) return;

    if (
      safeSource === "fresh" &&
      (sentFreshIds.has(questionId) || answeredIds.has(questionId))
    ) {
      return;
    }

    if (queuedIds.has(questionId)) return;

    queuedIds.add(questionId);
    rows.push({
      questionId,
      topicId: normalizeRetentionTopic(
        session.subject,
        q.topic_id || q.topicId || q.topic || q.concept_area,
      ),
      order: 0,
      source: safeSource,
    });
  });

  if (!rows.length) return 0;
  if (Number.isInteger(insertAt) && insertAt >= 0) {
    session.currentBatchQuestions.splice(insertAt, 0, ...rows);
  } else {
    session.currentBatchQuestions.push(...rows);
  }
  session.currentBatchQuestions = session.currentBatchQuestions.map(
    (row, index) => ({
      ...row,
      order: index,
      source: row?.source === "retention" ? "retention" : "fresh",
    }),
  );
  return rows.length;
};

const getSessionStartMsSafe = (value) => {
  const ms = new Date(value || 0).getTime();
  return Number.isFinite(ms) ? ms : 0;
};

const isRepetitionInSessionTimeline = (repetition, sessionLike) => {
  if (!repetition) return false;

  const sessionId = String(sessionLike?.sessionId || "").trim();
  const sessionStartMs = getSessionStartMsSafe(sessionLike?.startTime);
  const questionId = String(repetition?.questionId || "").trim();

  const repetitionCreatedMs = new Date(repetition?.createdAt || 0).getTime();
  if (!(sessionStartMs > 0)) return true;
  if (
    Number.isFinite(repetitionCreatedMs) &&
    repetitionCreatedMs >= sessionStartMs
  ) {
    return true;
  }

  const answerInSession = (
    Array.isArray(sessionLike?.answers) ? sessionLike.answers : []
  ).some((answer) => {
    if (String(answer?.questionId || "").trim() !== questionId) return false;
    const submittedAtMs = new Date(answer?.submittedAt || 0).getTime();
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
    return Number.isFinite(answeredAtMs) && answeredAtMs >= sessionStartMs;
  });
};

const injectDueQuestionIntoQueue = async (session) => {
  if (!session?.studentId) return null;

  const now = new Date();
  const pendingIds = new Set(
    (session.currentBatchQuestions || [])
      .slice(session.currentQuestionIndex || 0)
      .map((q) => String(q?.questionId || ""))
      .filter(Boolean),
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

  const currentIndex = Math.max(0, Number(session.currentQuestionIndex || 0));
  const currentRow = session.currentBatchQuestions?.[currentIndex] || null;
  const hasCurrentServedQuestion = Boolean(
    currentRow?.questionId && currentRow?.sentAt,
  );
  const insertAt = hasCurrentServedQuestion ? currentIndex + 1 : currentIndex;

  appendQuestionsToQueue(
    session,
    [
      {
        questionId: dueRepetition.questionId,
        topicId: dueRepetition.topicId,
      },
    ],
    {
      source: "retention",
      insertAt,
    },
  );

  await session.save();
  return dueRepetition;
};

const getQuestionDetails = async (questionId) => {
  const Question = require("mongoose").model("Question");
  let question = await Question.findOne({ questionId });

  if (!question) {
    const questionBankService = require("./questionBankService");
    question =
      questionBankService.getQuestionById(questionId) ||
      questionBankService.getRetentionQuestionById(questionId);
  }

  return question;
};

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
    if (s.includes("one word") || s.includes("substitution")) {
      return "one_word_substitution";
    }
    return "vocabulary";
  }

  if (subject === "gk") {
    if (s.includes("history")) return "history";
    if (s.includes("geography")) return "geography";
    if (s.includes("science")) return "science";
    if (s.includes("current") || s.includes("affair")) return "current_affairs";
    return "history";
  }

  return s || "history";
};

const dedupeQueueRows = (rows = []) => {
  const map = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (!row || typeof row !== "object") return;
    const key = String(row.questionId || row.id || "").trim();
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

    const existingUpdated = new Date(
      existing.updatedAt || existing.lastQueuedAt || existing.retiredAt || 0,
    ).getTime();
    const nextUpdated = new Date(
      normalized.updatedAt ||
        normalized.lastQueuedAt ||
        normalized.retiredAt ||
        0,
    ).getTime();

    if (
      (Number.isFinite(nextUpdated) ? nextUpdated : 0) >=
      (Number.isFinite(existingUpdated) ? existingUpdated : 0)
    ) {
      map.set(key, normalized);
    }
  });

  return Array.from(map.values());
};

const buildRecoveredRowsFromRepetition = async (session) => {
  const activeSessionId = String(session?.sessionId || "").trim();
  const rawSessionStartMs = new Date(session?.startTime || 0).getTime();
  const sessionStartMs = Number.isFinite(rawSessionStartMs)
    ? rawSessionStartMs
    : 0;

  const sessionAnswerTimesByQuestion = new Map();
  (Array.isArray(session?.answers) ? session.answers : []).forEach((answer) => {
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

  const answeredIds = Array.from(
    new Set(
      (Array.isArray(session?.answers) ? session.answers : [])
        .map((a) => String(a?.questionId || "").trim())
        .filter(Boolean),
    ),
  );

  if (!session?.studentId || answeredIds.length === 0) {
    return { queueRows: [], archiveRows: [], servedQuestionIds: answeredIds };
  }

  const repetitions = await QuestionRepetition.find({
    studentId: session.studentId,
    questionId: { $in: answeredIds },
  })
    .sort({ updatedAt: -1 })
    .limit(250);

  const now = Date.now();
  const queueRows = [];
  const archiveRows = [];

  repetitions.forEach((rep) => {
    const qid = String(rep?.questionId || "").trim();
    if (!qid) return;

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

    const fallbackTimes = sessionAnswerTimesByQuestion.get(qid) || [];

    const sortedAttemptTimes =
      sessionHistory.length > 0
        ? sessionHistory
            .map((entry) => new Date(entry?.answeredAt || 0).getTime())
            .filter(Number.isFinite)
            .sort((a, b) => a - b)
        : fallbackTimes.filter(Number.isFinite).sort((a, b) => a - b);

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
    const metrics = rep?.latestFlaskMetrics || {};
    const timerFrameSeconds = Math.max(
      30,
      Number(metrics?.timerFrameSeconds || metrics?.repeatInSeconds || 300),
    );

    const row = {
      id: qid,
      questionId: qid,
      questionText: String(
        rep?.latestQuestionSnapshot?.text || "Question text unavailable",
      ),
      nextRepeatAt:
        dueAtMs > 0
          ? new Date(dueAtMs).toISOString()
          : new Date(Date.now() + timerFrameSeconds * 1000).toISOString(),
      timerFrameSeconds,
      timerFrameLabel: metrics?.timerFrameLabel || `${timerFrameSeconds}s`,
      retentionScore: Math.round(
        Math.max(0, Math.min(1, Number(rep?.currentRetention || 0.5))) * 100,
      ),
      retentionTag: rep?.currentBatchType || "medium_term",
      needsRetention: !Boolean(rep?.isMastered),
      queueStatus: rep?.isMastered ? "completed" : "pending",
      repeatsDone: Number(Math.max(0, sessionAttemptCount - 1)),
      queueEntryCount: Number(sessionAttemptCount),
      firstQueuedAt: Number.isFinite(firstSessionAttemptAt)
        ? new Date(firstSessionAttemptAt)
        : rep?.createdAt || session?.startTime || new Date(),
      lastQueuedAt: Number.isFinite(lastSessionAttemptAt)
        ? new Date(lastSessionAttemptAt)
        : rep?.updatedAt || new Date(),
      retiredAt: rep?.isMastered ? rep?.masteredAt || rep?.updatedAt : null,
      retiredReason: rep?.isMastered ? "retention_resolved" : null,
      updatedAt: rep?.updatedAt || new Date(),
    };

    if (rep?.isMastered) archiveRows.push(row);
    else queueRows.push(row);
  });

  return {
    queueRows: dedupeQueueRows(queueRows),
    archiveRows: dedupeQueueRows(archiveRows),
    servedQuestionIds: answeredIds,
  };
};

const buildSocketQueueState = async (session) => {
  const uiState =
    session?.uiState && typeof session.uiState === "object"
      ? session.uiState
      : {};

  const recovered = await buildRecoveredRowsFromRepetition(session);

  return {
    retentionQueue: dedupeQueueRows([
      ...(Array.isArray(recovered.queueRows) ? recovered.queueRows : []),
      ...(Array.isArray(uiState.retentionQueue) ? uiState.retentionQueue : []),
    ]).slice(0, 150),
    retentionArchive: dedupeQueueRows([
      ...(Array.isArray(recovered.archiveRows) ? recovered.archiveRows : []),
      ...(Array.isArray(uiState.retentionArchive)
        ? uiState.retentionArchive
        : []),
    ]).slice(0, 200),
    servedQuestionIds: Array.from(
      new Set([
        ...(Array.isArray(recovered.servedQuestionIds)
          ? recovered.servedQuestionIds
          : []
        )
          .map((id) => String(id || "").trim())
          .filter(Boolean),
        ...(Array.isArray(uiState.servedQuestionIds)
          ? uiState.servedQuestionIds
          : []
        )
          .map((id) => String(id || "").trim())
          .filter(Boolean),
      ]),
    ).slice(0, 500),
    runtime:
      uiState.runtime && typeof uiState.runtime === "object"
        ? uiState.runtime
        : null,
    updatedAt: uiState.updatedAt || session?.updatedAt || new Date(),
  };
};

module.exports = { initializeRetentionSocket };
