const RetentionMetrics = require("../models/RetentionMetrics");
const RetentionSession = require("../models/RetentionSession");
const retentionFlaskService = require("../Services/retentionFlaskService");

const FLASK_PREDICTIONS_WAIT_BUDGET_MS = Number(
  process.env.RETENTION_FLASK_PREDICTIONS_WAIT_BUDGET_MS || 650,
);

const withTimeout = async (promise, timeoutMs) => {
  const budgetMs = Math.max(0, Number(timeoutMs) || 0);
  if (!budgetMs) return promise;

  let timeoutId = null;
  const timeoutPromise = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve(null), budgetMs);
  });

  const result = await Promise.race([promise, timeoutPromise]);
  if (timeoutId) clearTimeout(timeoutId);
  return result;
};

// Get overall metrics
exports.getOverallMetrics = async (req, res) => {
  try {
    const { studentId } = req.params;

    let metrics = await RetentionMetrics.findOne({ studentId });

    if (!metrics) {
      // Create default metrics
      metrics = new RetentionMetrics({
        studentId,
        userId: req.user.id,
      });
      await metrics.save();
    }

    // Get latest Flask predictions with a strict response-time budget.
    let flaskPredictions = null;
    const flaskAttempt = retentionFlaskService
      .getPredictions(studentId, null, {
        preferCache: true,
        allowStale: true,
        maxWaitMs: FLASK_PREDICTIONS_WAIT_BUDGET_MS,
        backgroundRefresh: true,
      })
      .catch((error) => {
        console.error("Error getting Flask predictions:", error?.message);
        return null;
      });

    flaskPredictions = await withTimeout(
      flaskAttempt,
      FLASK_PREDICTIONS_WAIT_BUDGET_MS,
    );

    if (flaskPredictions) {
      metrics.updateFlaskPredictions(flaskPredictions);
      await metrics.save();
      res.setHeader(
        "X-Retention-Flask-Source",
        flaskPredictions?.cache?.fresh ? "cache_fresh" : "cache_or_live",
      );
    } else {
      // Keep request latency stable and refresh predictions asynchronously.
      retentionFlaskService
        .refreshPredictions(studentId)
        .then(async (freshPredictions) => {
          if (!freshPredictions) return;
          try {
            const latestMetrics = await RetentionMetrics.findOne({ studentId });
            if (!latestMetrics) return;
            latestMetrics.updateFlaskPredictions(freshPredictions);
            await latestMetrics.save();
          } catch (persistError) {
            console.error(
              "Error persisting async Flask predictions:",
              persistError?.message || persistError,
            );
          }
        })
        .catch(() => {});

      res.setHeader("X-Retention-Flask-Source", "deferred_refresh");
    }

    const insights = metrics.generateInsights();

    res.json({
      success: true,
      metrics: {
        overall: metrics.overallMetrics,
        topicMetrics: metrics.topicMetrics.slice(0, 10),
        dailyMetrics: metrics.dailyMetrics.slice(-30),
        stressPatterns: metrics.stressPatterns,
        fatiguePatterns: metrics.fatiguePatterns,
        forgettingCurves: metrics.forgettingCurves,
        insights,
        flaskPredictions: metrics.flaskPredictions,
      },
    });
  } catch (error) {
    console.error("Error getting overall metrics:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get topic-wise metrics
exports.getTopicMetrics = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { sortBy = "accuracy", limit = 20 } = req.query;

    const metrics = await RetentionMetrics.findOne({ studentId });

    if (!metrics) {
      return res.json({
        success: true,
        topics: [],
      });
    }

    let sortedTopics = [...metrics.topicMetrics];

    switch (sortBy) {
      case "accuracy":
        sortedTopics.sort((a, b) => b.accuracy - a.accuracy);
        break;
      case "questions":
        sortedTopics.sort(
          (a, b) => b.questionsAttempted - a.questionsAttempted,
        );
        break;
      case "retention":
        sortedTopics.sort((a, b) => b.retentionScore - a.retentionScore);
        break;
      case "mastery":
        const masteryOrder = {
          expert: 4,
          advanced: 3,
          intermediate: 2,
          beginner: 1,
        };
        sortedTopics.sort(
          (a, b) =>
            (masteryOrder[b.masteryLevel] || 0) -
            (masteryOrder[a.masteryLevel] || 0),
        );
        break;
      case "lastPracticed":
        sortedTopics.sort(
          (a, b) => new Date(b.lastPracticed) - new Date(a.lastPracticed),
        );
        break;
      default:
        sortedTopics.sort((a, b) => b.accuracy - a.accuracy);
    }

    const topics = sortedTopics.slice(0, parseInt(limit)).map((t) => ({
      topicId: t.topicId,
      topicCategory: t.topicCategory,
      subject: t.subject,
      accuracy: t.accuracy,
      questionsAttempted: t.questionsAttempted,
      correctAnswers: t.correctAnswers,
      masteryLevel: t.masteryLevel,
      retentionScore: t.retentionScore,
      stabilityIndex: t.stabilityIndex,
      lastPracticed: t.lastPracticed,
      averageResponseTime: t.averageResponseTime,
      nextReview: t.nextReview,
      stressImpact: t.stressImpact,
      fatigueImpact: t.fatigueImpact,
      status: getTopicStatus(t.accuracy, t.questionsAttempted),
    }));

    const distribution = {
      beginner: topics.filter((t) => t.masteryLevel === "beginner").length,
      intermediate: topics.filter((t) => t.masteryLevel === "intermediate")
        .length,
      advanced: topics.filter((t) => t.masteryLevel === "advanced").length,
      expert: topics.filter((t) => t.masteryLevel === "expert").length,
    };

    res.json({
      success: true,
      topics,
      distribution,
      totalTopics: metrics.topicMetrics.length,
    });
  } catch (error) {
    console.error("Error getting topic metrics:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get daily trends
exports.getDailyTrends = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { days = 30 } = req.query;

    const metrics = await RetentionMetrics.findOne({ studentId });

    if (!metrics) {
      return res.json({
        success: true,
        trends: [],
      });
    }

    const dailyTrends = metrics.dailyMetrics
      .slice(-parseInt(days))
      .map((day) => ({
        date: day.date,
        accuracy: day.accuracy,
        questionsAttempted: day.questionsAttempted,
        timeSpentMinutes: day.timeSpentMinutes,
        averageDifficulty: day.averageDifficulty,
        averageStress: day.averageStress,
        averageFatigue: day.averageFatigue,
        averageFocus: day.averageFocus,
        newTopicsLearned: day.newTopicsLearned,
        reviewedTopics: day.reviewedTopics,
      }));

    // Calculate moving averages
    const movingAverageAccuracy = calculateMovingAverage(
      dailyTrends.map((d) => d.accuracy),
      3,
    );

    res.json({
      success: true,
      trends: dailyTrends,
      movingAverage: movingAverageAccuracy,
      summary: {
        averageAccuracy:
          dailyTrends.reduce((sum, d) => sum + d.accuracy, 0) /
          dailyTrends.length,
        totalQuestions: dailyTrends.reduce(
          (sum, d) => sum + d.questionsAttempted,
          0,
        ),
        totalTimeSpent: dailyTrends.reduce(
          (sum, d) => sum + d.timeSpentMinutes,
          0,
        ),
        averageStress:
          dailyTrends.reduce((sum, d) => sum + d.averageStress, 0) /
          dailyTrends.length,
        averageFatigue:
          dailyTrends.reduce((sum, d) => sum + d.averageFatigue, 0) /
          dailyTrends.length,
      },
    });
  } catch (error) {
    console.error("Error getting daily trends:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get forgetting curves
exports.getForgettingCurves = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { topicId } = req.query;

    const metrics = await RetentionMetrics.findOne({ studentId });

    if (!metrics) {
      return res.json({
        success: true,
        curves: {},
      });
    }

    if (topicId) {
      // Get curve for specific topic
      const curve = metrics.forgettingCurves[topicId] || [];
      const topicMetric = metrics.topicMetrics.find(
        (t) => t.topicId === topicId,
      );

      res.json({
        success: true,
        topicId,
        curve,
        currentRetention: topicMetric?.retentionScore || 0.5,
        lastPracticed: topicMetric?.lastPracticed,
        nextReview: topicMetric?.nextReview,
      });
    } else {
      // Get all curves
      res.json({
        success: true,
        curves: metrics.forgettingCurves,
      });
    }
  } catch (error) {
    console.error("Error getting forgetting curves:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get stress and fatigue patterns
exports.getStressFatiguePatterns = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { days = 30 } = req.query;

    const metrics = await RetentionMetrics.findOne({ studentId });

    if (!metrics) {
      return res.json({
        success: true,
        stressPatterns: {},
        fatiguePatterns: {},
      });
    }

    const recentDaily = metrics.dailyMetrics.slice(-parseInt(days));

    const stressByHour = {};
    const fatigueByHour = {};

    // Get recent sessions for hourly patterns
    const recentSessions = await RetentionSession.find({
      studentId,
      status: "completed",
    })
      .sort({ endTime: -1 })
      .limit(20);

    recentSessions.forEach((session) => {
      session.answers.forEach((answer) => {
        const hour = new Date(answer.submittedAt).getHours();

        if (!stressByHour[hour]) {
          stressByHour[hour] = { total: 0, count: 0 };
          fatigueByHour[hour] = { total: 0, count: 0 };
        }

        stressByHour[hour].total += answer.stressLevel;
        stressByHour[hour].count++;
        fatigueByHour[hour].total += answer.fatigueIndex;
        fatigueByHour[hour].count++;
      });
    });

    // Calculate averages
    const stressHourlyAvg = {};
    const fatigueHourlyAvg = {};

    Object.keys(stressByHour).forEach((hour) => {
      stressHourlyAvg[hour] =
        stressByHour[hour].total / stressByHour[hour].count;
      fatigueHourlyAvg[hour] =
        fatigueByHour[hour].total / fatigueByHour[hour].count;
    });

    // Find peak and low hours
    const stressHours = Object.entries(stressHourlyAvg)
      .map(([hour, value]) => ({ hour: parseInt(hour), value }))
      .sort((a, b) => b.value - a.value);

    const fatigueHours = Object.entries(fatigueHourlyAvg)
      .map(([hour, value]) => ({ hour: parseInt(hour), value }))
      .sort((a, b) => b.value - a.value);

    res.json({
      success: true,
      stressPatterns: {
        current: metrics.stressPatterns?.average || 0.3,
        trend: metrics.stressPatterns?.trend || "stable",
        byHour: stressHourlyAvg,
        peakHours: stressHours.slice(0, 3).map((h) => h.hour),
        lowHours: stressHours.slice(-3).map((h) => h.hour),
        recommendations: metrics.stressPatterns?.recommendations || [],
      },
      fatiguePatterns: {
        current: metrics.fatiguePatterns?.average || 0.3,
        trend: metrics.fatiguePatterns?.trend || "stable",
        byHour: fatigueHourlyAvg,
        peakHours: fatigueHours.slice(0, 3).map((h) => h.hour),
        lowHours: fatigueHours.slice(-3).map((h) => h.hour),
        recommendations: metrics.fatiguePatterns?.recommendations || [],
      },
    });
  } catch (error) {
    console.error("Error getting stress fatigue patterns:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get learning path
exports.getLearningPath = async (req, res) => {
  try {
    const { studentId } = req.params;

    const metrics = await RetentionMetrics.findOne({ studentId });

    if (!metrics) {
      return res.json({
        success: true,
        learningPath: {
          currentLevel: "beginner",
          nextLevel: "intermediate",
          requirements: { accuracy: "60%", questions: "25" },
          recommendedTopics: [],
        },
      });
    }

    const insights = metrics.generateInsights();

    // Determine current level
    let currentLevel = "beginner";
    const accuracy = metrics.overallMetrics.overallAccuracy || 0;
    const questions = metrics.overallMetrics.totalQuestions || 0;

    if (accuracy >= 80 && questions >= 100) {
      currentLevel = "expert";
    } else if (accuracy >= 70 && questions >= 50) {
      currentLevel = "advanced";
    } else if (accuracy >= 60 && questions >= 25) {
      currentLevel = "intermediate";
    }

    // Next level requirements
    const nextLevel = getNextLevel(currentLevel);
    const requirements = getLevelRequirements(currentLevel);

    // Calculate progress
    const progress = calculateLevelProgress(metrics, currentLevel);

    res.json({
      success: true,
      learningPath: {
        currentLevel,
        currentLevelProgress: progress,
        nextLevel,
        nextLevelRequirements: requirements,
        strongTopics: insights.strongTopics,
        weakTopics: insights.weakTopics,
        needsReview: insights.needsReview,
        recommendedTopics: [
          ...insights.weakTopics.slice(0, 3).map((t) => t.topic),
          ...insights.needsReview.slice(0, 2).map((t) => t.topic),
        ],
        estimatedTimeToNextLevel: estimateTimeToNextLevel(
          metrics,
          currentLevel,
        ),
        milestones: generateMilestones(metrics, currentLevel),
      },
    });
  } catch (error) {
    console.error("Error getting learning path:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get recommendations
exports.getRecommendations = async (req, res) => {
  try {
    const { studentId } = req.params;

    const metrics = await RetentionMetrics.findOne({ studentId });

    if (!metrics) {
      return res.json({
        success: true,
        recommendations: [],
      });
    }

    const insights = metrics.generateInsights();
    const recommendations = insights.recommendations || [];

    // Add time-based recommendations
    const currentHour = new Date().getHours();
    const stressPatterns = metrics.stressPatterns;

    if (stressPatterns?.peakHours?.includes(currentHour)) {
      recommendations.push({
        type: "stress_aware",
        priority: "medium",
        message: "Current time is typically high-stress for you",
        action: "Consider taking a short break before starting",
      });
    }

    if (stressPatterns?.lowHours?.includes(currentHour)) {
      recommendations.push({
        type: "optimal_time",
        priority: "medium",
        message: "This is an optimal time for focused study",
        action: "Great time to tackle difficult topics",
      });
    }

    // Sort by priority
    const priorityOrder = { high: 1, medium: 2, low: 3 };
    recommendations.sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
    );

    res.json({
      success: true,
      recommendations,
      summary: {
        total: recommendations.length,
        highPriority: recommendations.filter((r) => r.priority === "high")
          .length,
        mediumPriority: recommendations.filter((r) => r.priority === "medium")
          .length,
        lowPriority: recommendations.filter((r) => r.priority === "low").length,
      },
    });
  } catch (error) {
    console.error("Error getting recommendations:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ==================== Helper Functions ====================

const getTopicStatus = (accuracy, attempts) => {
  if (attempts < 5) return "insufficient_data";
  if (accuracy >= 80) return "strong";
  if (accuracy >= 60) return "good";
  if (accuracy >= 40) return "average";
  return "weak";
};

const calculateMovingAverage = (values, window) => {
  const result = [];
  for (let i = window - 1; i < values.length; i++) {
    const sum = values.slice(i - window + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(sum / window);
  }
  return result;
};

const getNextLevel = (currentLevel) => {
  const levels = {
    beginner: "intermediate",
    intermediate: "advanced",
    advanced: "expert",
    expert: "master",
  };
  return levels[currentLevel] || "expert";
};

const getLevelRequirements = (currentLevel) => {
  const requirements = {
    beginner: {
      accuracy: 60,
      questions: 25,
      description: "Achieve 60% accuracy with 25+ questions",
    },
    intermediate: {
      accuracy: 70,
      questions: 50,
      description: "Achieve 70% accuracy with 50+ questions",
    },
    advanced: {
      accuracy: 80,
      questions: 100,
      description: "Achieve 80% accuracy with 100+ questions",
    },
    expert: {
      accuracy: 90,
      questions: 200,
      description: "Achieve 90% accuracy with 200+ questions",
    },
  };
  return requirements[currentLevel] || requirements.beginner;
};

const calculateLevelProgress = (metrics, currentLevel) => {
  const accuracy = metrics.overallMetrics.overallAccuracy || 0;
  const questions = metrics.overallMetrics.totalQuestions || 0;

  switch (currentLevel) {
    case "beginner":
      return Math.min(100, (questions / 25) * 100);
    case "intermediate":
      return Math.min(100, (accuracy / 70) * 100);
    case "advanced":
      return Math.min(100, (accuracy / 80) * 100);
    case "expert":
      return 100;
    default:
      return 0;
  }
};

const estimateTimeToNextLevel = (metrics, currentLevel) => {
  const recentDaily = metrics.dailyMetrics.slice(-7);
  const avgDailyQuestions =
    recentDaily.reduce((sum, d) => sum + d.questionsAttempted, 0) / 7;

  const requirements = getLevelRequirements(currentLevel);
  const currentQuestions = metrics.overallMetrics.totalQuestions || 0;
  const remainingQuestions = requirements.questions - currentQuestions;

  if (remainingQuestions <= 0) return 0;
  if (avgDailyQuestions <= 0) return 7;

  return Math.ceil(remainingQuestions / avgDailyQuestions);
};

const generateMilestones = (metrics, currentLevel) => {
  const milestones = [];

  // Question-based milestones
  const questionCounts = [50, 100, 250, 500, 1000];
  questionCounts.forEach((count) => {
    if (metrics.overallMetrics.totalQuestions < count) {
      milestones.push({
        type: "questions",
        target: count,
        current: metrics.overallMetrics.totalQuestions,
        progress: (metrics.overallMetrics.totalQuestions / count) * 100,
        description: `Answer ${count} questions total`,
      });
    }
  });

  // Accuracy-based milestones
  const accuracyTargets = [60, 70, 80, 90];
  accuracyTargets.forEach((target) => {
    if (metrics.overallMetrics.overallAccuracy < target) {
      milestones.push({
        type: "accuracy",
        target: target,
        current: metrics.overallMetrics.overallAccuracy,
        progress: (metrics.overallMetrics.overallAccuracy / target) * 100,
        description: `Achieve ${target}% overall accuracy`,
      });
    }
  });

  // Streak-based milestones
  const streakTargets = [7, 14, 30, 60, 90];
  streakTargets.forEach((target) => {
    if (metrics.overallMetrics.longestStreak < target) {
      milestones.push({
        type: "streak",
        target: target,
        current: metrics.overallMetrics.longestStreak,
        progress: (metrics.overallMetrics.longestStreak / target) * 100,
        description: `Maintain a ${target}-day study streak`,
      });
    }
  });

  // Topic mastery milestones
  const topicMastery = metrics.topicMetrics.filter(
    (t) => t.masteryLevel === "expert",
  ).length;
  const masteryTargets = [5, 10, 15, 20];
  masteryTargets.forEach((target) => {
    if (topicMastery < target) {
      milestones.push({
        type: "mastery",
        target: target,
        current: topicMastery,
        progress: (topicMastery / target) * 100,
        description: `Master ${target} topics (Expert level)`,
      });
    }
  });

  return milestones.slice(0, 5); // Top 5 milestones
};
