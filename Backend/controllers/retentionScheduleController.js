const RetentionSchedule = require("../models/RetentionSchedule");
const RetentionSession = require("../models/RetentionSession");
const QuestionRepetition = require("../models/QuestionRepetition");
const retentionFlaskService = require("../Services/retentionFlaskService");

// Generate schedule from Flask predictions
exports.generateSchedule = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { subject = "both", days = 7 } = req.body;

    // Get Flask predictions
    let flaskSchedule = null;
    try {
      flaskSchedule = await retentionFlaskService.getDailySchedule(
        studentId,
        subject,
      );
    } catch (error) {
      console.error("Error getting Flask schedule:", error);
    }

    // Get due questions from repetition system
    const dueQuestions = await QuestionRepetition.findDueQuestions(studentId);

    // Get recent performance
    const recentSessions = await RetentionSession.find({
      studentId,
      status: "completed",
    })
      .sort({ endTime: -1 })
      .limit(5);

    // Create schedule
    const schedule = new RetentionSchedule({
      studentId,
      userId: req.user.id,
      subject,
      generatedBy: flaskSchedule ? "flask" : "system",
      flaskScheduleId: flaskSchedule?.schedule_id,
    });

    // Generate daily schedules
    const dailySchedules = [];
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);

      const dailyQuestions = [];

      // Add due questions
      const dueForDate = dueQuestions.filter((q) => {
        const nextDate = new Date(q.nextScheduledDate);
        return nextDate.toDateString() === date.toDateString();
      });

      dueForDate.forEach((q) => {
        dailyQuestions.push({
          questionId: q.questionId,
          topicId: q.topicId,
          subject: q.subject,
          topicCategory: q.topicCategory,
          batchType: q.currentBatchType,
          scheduledFor: date,
          priority: calculatePriority(q),
          retentionAtScheduling: q.currentRetention,
        });
      });

      // Add Flask recommended questions
      if (flaskSchedule?.daily_plans?.[i]) {
        const flaskDay = flaskSchedule.daily_plans[i];
        flaskDay.questions.forEach((q) => {
          // Avoid duplicates
          if (!dailyQuestions.some((dq) => dq.questionId === q.question_id)) {
            dailyQuestions.push({
              questionId: q.question_id,
              topicId: q.topic_id,
              subject: q.subject,
              topicCategory: q.topic_category,
              batchType: q.batch_type,
              scheduledFor: date,
              priority: q.priority || 3,
              retentionAtScheduling: q.retention,
            });
          }
        });
      }

      // Sort by priority
      dailyQuestions.sort((a, b) => b.priority - a.priority);

      dailySchedules.push({
        date,
        questions: dailyQuestions,
        totalQuestions: dailyQuestions.length,
        completedQuestions: 0,
      });
    }

    schedule.dailySchedules = dailySchedules;

    // Set batch recommendations
    if (flaskSchedule?.batch_recommendations) {
      schedule.batchRecommendations = flaskSchedule.batch_recommendations;
    } else {
      // Generate local batch recommendations
      schedule.batchRecommendations = generateLocalBatchRecommendations(
        dueQuestions,
        recentSessions,
      );
    }

    // Calculate metrics
    schedule.metrics = {
      totalQuestions: dailySchedules.reduce(
        (sum, day) => sum + day.totalQuestions,
        0,
      ),
      totalTimeMinutes: dailySchedules.reduce(
        (sum, day) => sum + day.totalQuestions * 1.5,
        0,
      ), // 1.5 min per question
      averageDailyQuestions:
        dailySchedules.reduce((sum, day) => sum + day.totalQuestions, 0) / days,
      reviewRatio: calculateReviewRatio(dueQuestions, recentSessions),
      newVsReview: 0.5, // Placeholder
    };

    // Set weekly plan
    if (flaskSchedule?.weekly_plan) {
      schedule.weeklyPlan = flaskSchedule.weekly_plan;
    }

    // Set monthly plan
    if (flaskSchedule?.monthly_plan) {
      schedule.monthlyPlan = flaskSchedule.monthly_plan;
    }

    // Deactivate old schedules
    await RetentionSchedule.updateMany(
      { studentId, isActive: true },
      { isActive: false },
    );

    await schedule.save();

    res.json({
      success: true,
      schedule: {
        id: schedule._id,
        generatedAt: schedule.generatedAt,
        generatedBy: schedule.generatedBy,
        dailySchedules: schedule.dailySchedules.map((day) => ({
          date: day.date,
          totalQuestions: day.totalQuestions,
          questions: day.questions.slice(0, 5).map((q) => ({
            questionId: q.questionId,
            topic: q.topicCategory,
            batchType: q.batchType,
          })),
        })),
        metrics: schedule.metrics,
        batchRecommendations: schedule.batchRecommendations,
        weeklyPlan: schedule.weeklyPlan,
      },
    });
  } catch (error) {
    console.error("Error generating schedule:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get current schedule
exports.getCurrentSchedule = async (req, res) => {
  try {
    const { studentId } = req.params;

    const schedule = await RetentionSchedule.findOne({
      studentId,
      isActive: true,
    }).sort({ generatedAt: -1 });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: "No active schedule found",
      });
    }

    const todaySchedule = schedule.getTodaySchedule();

    res.json({
      success: true,
      schedule: {
        id: schedule._id,
        generatedAt: schedule.generatedAt,
        generatedBy: schedule.generatedBy,
        today: todaySchedule
          ? {
              date: todaySchedule.date,
              totalQuestions: todaySchedule.totalQuestions,
              completedQuestions: todaySchedule.completedQuestions,
              status: todaySchedule.status,
              nextQuestions: todaySchedule.questions
                .filter((q) => !q.completed)
                .slice(0, 5)
                .map((q) => ({
                  questionId: q.questionId,
                  topic: q.topicCategory,
                  batchType: q.batchType,
                  priority: q.priority,
                })),
            }
          : null,
        weekStart: schedule.weeklyPlan?.weekStart,
        weekEnd: schedule.weeklyPlan?.weekEnd,
        focusTopics: schedule.weeklyPlan?.focusTopics || [],
        metrics: schedule.generateSummary(),
        batchRecommendations: schedule.batchRecommendations,
      },
    });
  } catch (error) {
    console.error("Error getting current schedule:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get schedule for specific date
exports.getScheduleForDate = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { date } = req.query;

    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const schedule = await RetentionSchedule.findOne({
      studentId,
      isActive: true,
      "dailySchedules.date": targetDate,
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: "No schedule found for this date",
      });
    }

    const daySchedule = schedule.dailySchedules.find(
      (d) => d.date.toDateString() === targetDate.toDateString(),
    );

    res.json({
      success: true,
      date: targetDate,
      schedule: {
        totalQuestions: daySchedule.totalQuestions,
        completedQuestions: daySchedule.completedQuestions,
        status: daySchedule.status,
        questions: daySchedule.questions.map((q) => ({
          questionId: q.questionId,
          topic: q.topicCategory,
          batchType: q.batchType,
          priority: q.priority,
          retentionAtScheduling: q.retentionAtScheduling,
          completed: q.completed,
          completedAt: q.completedAt,
          performance: q.performance,
        })),
      },
    });
  } catch (error) {
    console.error("Error getting schedule for date:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Update schedule based on performance
exports.updateSchedule = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { sessionId, performance } = req.body;

    const session = await RetentionSession.findOne({ sessionId });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Session not found",
      });
    }

    // Get current schedule
    const schedule = await RetentionSchedule.findOne({
      studentId,
      isActive: true,
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: "No active schedule found",
      });
    }

    // Update question completion status
    for (const answer of session.answers) {
      await schedule.completeQuestion(answer.questionId, {
        correct: answer.isCorrect,
        responseTimeMs: answer.responseTimeMs,
      });
    }

    // Check if we need to regenerate schedule
    const todaySchedule = schedule.getTodaySchedule();
    if (todaySchedule && todaySchedule.status === "completed") {
      // Get updated Flask predictions
      try {
        const updatedPredictions =
          await retentionFlaskService.getUpdatedPredictions(
            studentId,
            session.answers,
          );

        if (updatedPredictions.schedule_update_needed) {
          // Regenerate schedule
          return exports.generateSchedule(req, res);
        }
      } catch (error) {
        console.error("Error getting updated predictions:", error);
      }
    }

    res.json({
      success: true,
      message: "Schedule updated",
      todayProgress: {
        completed: todaySchedule?.completedQuestions || 0,
        total: todaySchedule?.totalQuestions || 0,
        status: todaySchedule?.status,
      },
    });
  } catch (error) {
    console.error("Error updating schedule:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Mark question as completed
exports.completeQuestion = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { questionId, performance } = req.body;

    const schedule = await RetentionSchedule.findOne({
      studentId,
      isActive: true,
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: "No active schedule found",
      });
    }

    await schedule.completeQuestion(questionId, performance);

    res.json({
      success: true,
      message: "Question marked as completed",
    });
  } catch (error) {
    console.error("Error completing question:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get next scheduled questions
exports.getNextQuestions = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { count = 5 } = req.query;

    const schedule = await RetentionSchedule.findOne({
      studentId,
      isActive: true,
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: "No active schedule found",
      });
    }

    const nextQuestions = schedule.getNextQuestions(parseInt(count));

    // Get full question details
    const questions = await getQuestionsWithDetails(
      nextQuestions.map((q) => q.questionId),
    );

    res.json({
      success: true,
      questions: questions.map((q, index) => ({
        ...q,
        scheduledInfo: nextQuestions[index],
      })),
      count: questions.length,
    });
  } catch (error) {
    console.error("Error getting next questions:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ==================== Helper Functions ====================

const calculatePriority = (question) => {
  // Higher priority for:
  // - Lower retention
  // - Earlier due dates
  // - Important topics (could be based on exam weightage)

  let priority = 3; // Default medium

  // Retention-based
  if (question.currentRetention < 0.3) priority += 2;
  else if (question.currentRetention < 0.5) priority += 1;

  // Due date proximity
  const daysUntilDue =
    (new Date(question.nextScheduledDate) - new Date()) / (1000 * 60 * 60 * 24);
  if (daysUntilDue < 0) priority += 2;
  else if (daysUntilDue < 1) priority += 1;

  return Math.min(5, Math.max(1, priority));
};

const generateLocalBatchRecommendations = (dueQuestions, recentSessions) => {
  const recommendations = {
    immediate: [],
    short_term: [],
    medium_term: [],
    long_term: [],
    mastered: [],
  };

  // Categorize due questions
  dueQuestions.forEach((q) => {
    const batchType = q.currentBatchType;
    if (recommendations[batchType]) {
      recommendations[batchType].push({
        topicId: q.topicId,
        questions: 1,
        priority: calculatePriority(q) >= 4 ? "high" : "medium",
      });
    }
  });

  // Aggregate by topic
  Object.keys(recommendations).forEach((batchType) => {
    const topicMap = {};
    recommendations[batchType].forEach((item) => {
      if (!topicMap[item.topicId]) {
        topicMap[item.topicId] = {
          topicId: item.topicId,
          questions: 0,
          priority: item.priority,
        };
      }
      topicMap[item.topicId].questions++;
    });

    recommendations[batchType] = Object.values(topicMap);

    // Add scheduled day for non-immediate batches
    if (batchType !== "immediate") {
      recommendations[batchType] = recommendations[batchType].map(
        (item, index) => ({
          ...item,
          scheduledDay: index + 1,
        }),
      );
    }
  });

  return recommendations;
};

const calculateReviewRatio = (dueQuestions, recentSessions) => {
  const totalReviewed = dueQuestions.length;
  const totalNew = recentSessions.reduce(
    (sum, session) =>
      sum + session.answers.filter((a) => a.attemptNumber === 1).length,
    0,
  );

  return totalNew > 0 ? totalReviewed / totalNew : 0.5;
};

const getQuestionsWithDetails = async (questionIds) => {
  const Question = require("mongoose").model("Question");
  const questions = await Question.find({ questionId: { $in: questionIds } });

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

