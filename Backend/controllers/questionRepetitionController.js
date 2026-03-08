const QuestionRepetition = require("../models/QuestionRepetition");
const RetentionSession = require("../models/RetentionSession");
const retentionFlaskService = require("../Services/retentionFlaskService");

// Get repetition schedule for a question
exports.getQuestionRepetition = async (req, res) => {
  try {
    const { studentId, questionId } = req.params;

    const repetition = await QuestionRepetition.findOne({
      studentId,
      questionId,
    });

    if (!repetition) {
      return res.status(404).json({
        success: false,
        error: "Repetition schedule not found for this question",
      });
    }

    res.json({
      success: true,
      repetition: {
        questionId: repetition.questionId,
        topicId: repetition.topicId,
        topicCategory: repetition.topicCategory,
        subject: repetition.subject,
        currentRepetition: repetition.currentRepetition,
        maxRepetitions: repetition.maxRepetitions,
        nextScheduledDate: repetition.nextScheduledDate,
        currentBatchType: repetition.currentBatchType,
        currentRetention: repetition.currentRetention,
        stabilityIndex: repetition.stabilityIndex,
        easeFactor: repetition.easeFactor,
        timesCorrect: repetition.timesCorrect,
        timesIncorrect: repetition.timesIncorrect,
        lastAccuracy: repetition.lastAccuracy,
        isMastered: repetition.isMastered,
        masteredAt: repetition.masteredAt,
        nextRepetitionDates: repetition.nextRepetitionDates.map((r) => ({
          repetitionNumber: r.repetitionNumber,
          scheduledDate: r.scheduledDate,
          batchType: r.batchType,
          completed: r.completed,
          completedAt: r.completedAt,
        })),
        retentionHistory: repetition.retentionHistory.slice(-10),
      },
    });
  } catch (error) {
    console.error("Error getting question repetition:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get all repetition schedules for a student
exports.getStudentRepetitions = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { batchType, mastered, limit = 50 } = req.query;

    const query = { studentId };
    if (batchType) query.currentBatchType = batchType;
    if (mastered === "true") query.isMastered = true;
    if (mastered === "false") query.isMastered = false;

    const repetitions = await QuestionRepetition.find(query)
      .sort({ nextScheduledDate: 1 })
      .limit(parseInt(limit));

    const summary = {
      total: repetitions.length,
      byBatchType: {
        immediate: repetitions.filter((r) => r.currentBatchType === "immediate")
          .length,
        short_term: repetitions.filter(
          (r) => r.currentBatchType === "short_term",
        ).length,
        medium_term: repetitions.filter(
          (r) => r.currentBatchType === "medium_term",
        ).length,
        long_term: repetitions.filter((r) => r.currentBatchType === "long_term")
          .length,
        mastered: repetitions.filter((r) => r.isMastered).length,
      },
      dueToday: repetitions.filter(
        (r) =>
          !r.isMastered &&
          r.nextScheduledDate &&
          new Date(r.nextScheduledDate).toDateString() ===
            new Date().toDateString(),
      ).length,
      dueThisWeek: repetitions.filter(
        (r) =>
          !r.isMastered &&
          r.nextScheduledDate &&
          new Date(r.nextScheduledDate) <=
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ).length,
    };

    res.json({
      success: true,
      repetitions: repetitions.map((r) => ({
        questionId: r.questionId,
        topicId: r.topicId,
        topicCategory: r.topicCategory,
        subject: r.subject,
        currentRepetition: r.currentRepetition,
        nextScheduledDate: r.nextScheduledDate,
        currentBatchType: r.currentBatchType,
        currentRetention: r.currentRetention,
        lastAccuracy: r.lastAccuracy,
        isMastered: r.isMastered,
      })),
      summary,
    });
  } catch (error) {
    console.error("Error getting student repetitions:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get questions due for review
exports.getDueQuestions = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { date, batchType, limit = 20 } = req.query;

    const targetDate = date ? new Date(date) : new Date();
    if (Number.isNaN(targetDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: "Invalid date value",
      });
    }

    const query = {
      studentId,
      isMastered: false,
      nextScheduledDate: { $lte: targetDate },
    };

    if (batchType) query.currentBatchType = batchType;

    const dueQuestions = await QuestionRepetition.find(query)
      .sort({ nextScheduledDate: 1, currentRetention: 1 })
      .limit(parseInt(limit));

    // Get full question details
    const questions = await getQuestionsWithDetails(
      dueQuestions.map((q) => q.questionId),
    );

    res.json({
      success: true,
      dueQuestions: questions.map((q, index) => ({
        ...q,
        repetitionInfo: {
          currentRepetition: dueQuestions[index].currentRepetition,
          currentBatchType: dueQuestions[index].currentBatchType,
          currentRetention: dueQuestions[index].currentRetention,
          nextScheduledDate: dueQuestions[index].nextScheduledDate,
          easeFactor: dueQuestions[index].easeFactor,
          retentionTag: formatRetentionTag(
            dueQuestions[index].currentBatchType,
          ),
          timer: {
            dueAt: dueQuestions[index].nextScheduledDate,
            remainingMs: Math.max(
              0,
              new Date(dueQuestions[index].nextScheduledDate).getTime() -
                Date.now(),
            ),
            isDue:
              new Date(dueQuestions[index].nextScheduledDate) <= new Date(),
          },
          flaskMetrics: dueQuestions[index].latestFlaskMetrics || null,
        },
      })),
      count: dueQuestions.length,
      date: targetDate,
    });
  } catch (error) {
    console.error("Error getting due questions:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Update repetition schedule from Flask
exports.updateFromFlask = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Get Flask repetition sequence
    let flaskSequence = null;
    try {
      flaskSequence = await retentionFlaskService.getQuestionSequence(
        studentId,
        "immediate",
        50,
      );
    } catch (error) {
      console.error("Error getting Flask sequence:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to get sequence from Flask",
      });
    }

    if (!flaskSequence || !flaskSequence.sequence) {
      return res.status(404).json({
        success: false,
        error: "No sequence received from Flask",
      });
    }

    // Update or create repetition schedules
    const results = {
      updated: 0,
      created: 0,
      failed: 0,
    };

    for (const item of flaskSequence.sequence) {
      try {
        let repetition = await QuestionRepetition.findOne({
          studentId,
          questionId: item.question_id,
        });

        if (!repetition) {
          // Get question details
          const question = await getQuestionById(item.question_id);
          if (!question) {
            results.failed++;
            continue;
          }

          repetition = new QuestionRepetition({
            studentId,
            userId: req.user.id,
            questionId: item.question_id,
            topicId: question.topicId || question.topic,
            subject: question.subject,
            topicCategory: question.topicCategory || question.topic,
            difficulty: question.difficulty,
            currentBatchType: item.batch_type || "immediate",
            currentRetention: item.retention || 0.5,
            metadata: {
              sourceQuestionId: item.question_id,
              generatedBy: "flask",
            },
          });
          repetition.initializeSchedule();
          results.created++;
        } else {
          // Update existing
          repetition.currentBatchType =
            item.batch_type || repetition.currentBatchType;
          repetition.currentRetention =
            item.retention || repetition.currentRetention;
          results.updated++;
        }

        // Update next scheduled date based on batch type
        if (item.scheduled_date) {
          repetition.nextScheduledDate = new Date(item.scheduled_date);
        } else {
          // Calculate based on batch type
          const daysToAdd = getDaysForBatchType(
            item.batch_type || repetition.currentBatchType,
          );
          const newDate = new Date();
          newDate.setDate(newDate.getDate() + daysToAdd);
          repetition.nextScheduledDate = newDate;
        }

        await repetition.save();
      } catch (error) {
        console.error(
          `Error updating repetition for question ${item.question_id}:`,
          error,
        );
        results.failed++;
      }
    }

    res.json({
      success: true,
      message: "Repetition schedules updated from Flask",
      results,
    });
  } catch (error) {
    console.error("Error updating from Flask:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Manually schedule a question
exports.scheduleQuestion = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { questionId, batchType, scheduledDate } = req.body;

    // Get question details
    const question = await getQuestionById(questionId);

    if (!question) {
      return res.status(404).json({
        success: false,
        error: "Question not found",
      });
    }

    let repetition = await QuestionRepetition.findOne({
      studentId,
      questionId,
    });

    if (!repetition) {
      repetition = new QuestionRepetition({
        studentId,
        userId: req.user.id,
        questionId,
        topicId: question.topicId || question.topic,
        subject: normalizeRetentionSubject(question.subject),
        topicCategory: question.topicCategory || question.topic,
        difficulty: question.difficulty,
        currentBatchType: batchType || "immediate",
        metadata: {
          sourceQuestionId: questionId,
          generatedBy: "manual",
        },
      });
      repetition.initializeSchedule();
    }

    // Update schedule
    if (batchType) repetition.currentBatchType = batchType;

    if (scheduledDate) {
      const parsed = new Date(scheduledDate);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({
          success: false,
          error: "Invalid scheduledDate value",
        });
      }
      repetition.nextScheduledDate = parsed;
    } else {
      const daysToAdd = getDaysForBatchType(
        batchType || repetition.currentBatchType,
      );
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + daysToAdd);
      repetition.nextScheduledDate = newDate;
    }

    await repetition.save();

    res.json({
      success: true,
      message: "Question scheduled successfully",
      repetition: {
        questionId: repetition.questionId,
        topicCategory: repetition.topicCategory,
        currentBatchType: repetition.currentBatchType,
        nextScheduledDate: repetition.nextScheduledDate,
      },
    });
  } catch (error) {
    console.error("Error scheduling question:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get repetition statistics
exports.getRepetitionStats = async (req, res) => {
  try {
    const { studentId } = req.params;

    const repetitions = await QuestionRepetition.find({ studentId });

    const stats = {
      totalQuestions: repetitions.length,
      masteredQuestions: repetitions.filter((r) => r.isMastered).length,
      inProgress: repetitions.filter((r) => !r.isMastered).length,

      byBatchType: {
        immediate: repetitions.filter(
          (r) => r.currentBatchType === "immediate" && !r.isMastered,
        ).length,
        short_term: repetitions.filter(
          (r) => r.currentBatchType === "short_term" && !r.isMastered,
        ).length,
        medium_term: repetitions.filter(
          (r) => r.currentBatchType === "medium_term" && !r.isMastered,
        ).length,
        long_term: repetitions.filter(
          (r) => r.currentBatchType === "long_term" && !r.isMastered,
        ).length,
      },

      averageRetention:
        repetitions
          .filter((r) => !r.isMastered)
          .reduce((sum, r) => sum + r.currentRetention, 0) /
          Math.max(1, repetitions.filter((r) => !r.isMastered).length) || 0,

      averageEaseFactor:
        repetitions.reduce((sum, r) => sum + r.easeFactor, 0) /
        Math.max(1, repetitions.length),

      totalRepetitions: repetitions.reduce(
        (sum, r) => sum + r.currentRepetition,
        0,
      ),

      successRate:
        repetitions.reduce((sum, r) => sum + r.timesCorrect, 0) /
          Math.max(
            1,
            repetitions.reduce(
              (sum, r) => sum + r.timesCorrect + r.timesIncorrect,
              0,
            ),
          ) || 0,

      byTopic: {},
    };

    // Group by topic
    repetitions.forEach((r) => {
      if (!stats.byTopic[r.topicCategory]) {
        stats.byTopic[r.topicCategory] = {
          total: 0,
          mastered: 0,
          inProgress: 0,
          averageRetention: 0,
        };
      }

      stats.byTopic[r.topicCategory].total++;
      if (r.isMastered) {
        stats.byTopic[r.topicCategory].mastered++;
      } else {
        stats.byTopic[r.topicCategory].inProgress++;
        stats.byTopic[r.topicCategory].averageRetention =
          (stats.byTopic[r.topicCategory].averageRetention *
            (stats.byTopic[r.topicCategory].inProgress - 1) +
            r.currentRetention) /
          stats.byTopic[r.topicCategory].inProgress;
      }
    });

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Error getting repetition stats:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ==================== Helper Functions ====================

const getDaysForBatchType = (batchType) => {
  const days = {
    immediate: 0,
    short_term: 1,
    medium_term: 3,
    long_term: 7,
    mastered: 30,
  };
  return days[batchType] || 3;
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

const normalizeRetentionSubject = (subject) => {
  const normalized = String(subject || "")
    .trim()
    .toLowerCase();
  if (normalized === "general_knowledge") return "gk";
  if (normalized === "gk" || normalized === "english") return normalized;
  return "english";
};

const getQuestionById = async (questionId) => {
  const Question = require("mongoose").model("Question");
  let question = await Question.findOne({ questionId });

  if (!question) {
    const questionBankService = require("../Services/questionBankService");
    question = questionBankService.getQuestionById(questionId);
  }

  return question;
};

const getQuestionsWithDetails = async (questionIds) => {
  const Question = require("mongoose").model("Question");
  const questions = await Question.find({ questionId: { $in: questionIds } });

  // Fill missing with question bank
  const foundIds = questions.map((q) => q.questionId);
  const missingIds = questionIds.filter((id) => !foundIds.includes(id));

  const questionBankService = require("../Services/questionBankService");
  for (const id of missingIds) {
    const q = questionBankService.getQuestionById(id);
    if (q) questions.push(q);
  }

  return questions.map((q) => ({
    id: q.questionId,
    text: q.text,
    type: q.type,
    difficulty: q.difficulty,
    difficultyLevel: q.difficultyLevel,
    options: q.type !== "NAT" ? q.options : undefined,
    topic: q.topic,
    topicCategory: q.topicCategory,
    marks: q.marks,
    expectedTime: q.expectedTime,
  }));
};
