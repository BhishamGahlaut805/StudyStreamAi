const StudentPerformance = require("../models/studentPerformance");
const TestSession = require("../models/TestSession");
const User = require("../models/user");
const flaskApiService = require("../Services/flaskAPIService");

/**
 * Get student performance summary
 */
exports.getStudentPerformance = async (req, res) => {
  try {
    const { studentId } = req.params;

    let performance = await StudentPerformance.findOne({ studentId });

    if (!performance) {
      // Check if student exists
      const user = await User.findOne({ studentId });
      if (!user) {
        return res.status(404).json({
          success: false,
          error: "Student not found",
        });
      }

      performance = new StudentPerformance({
        studentId,
        userId: user._id,
      });
      await performance.save();
    }

    // Calculate latest analytics
    const analytics = performance.calculateAnalytics();

    // Get Flask model info
    let modelInfo = null;
    try {
      modelInfo = await flaskApiService.getModelInfo(studentId);
    } catch (error) {
      console.error("Error fetching Flask model info:", error.message);
    }

    // Get recent test sessions
    const recentTests = await TestSession.find({
      studentId,
      status: "completed",
    })
      .sort({ endTime: -1 })
      .limit(5)
      .select("sessionId testType testConfig.title endTime summary");

    res.json({
      success: true,
      performance: {
        overallStats: performance.overallStats,
        topicPerformance: performance.topicPerformance.slice(0, 10),
        insights: {
          ...performance.insights,
          modelInfo: modelInfo?.dashboard_data?.predictions || null,
        },
        testHistory: recentTests,
        analytics: performance.analytics,
      },
    });
  } catch (error) {
    console.error("Error getting student performance:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get performance trends
 */
exports.getPerformanceTrends = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { period = "weekly" } = req.query;

    const performance = await StudentPerformance.findOne({ studentId });

    if (!performance) {
      return res.json({
        success: true,
        trends: [],
      });
    }

    const trends = performance.performanceTrends[period] || [];

    // Calculate moving averages
    const movingAverage = this.calculateMovingAverage(trends, 3);

    res.json({
      success: true,
      trends,
      movingAverage,
      period,
    });
  } catch (error) {
    console.error("Error getting performance trends:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Calculate moving average
 */
exports.calculateMovingAverage = (trends, windowSize) => {
  if (!trends || trends.length < windowSize) return [];

  const averages = [];
  for (let i = windowSize - 1; i < trends.length; i++) {
    const sum = trends
      .slice(i - windowSize + 1, i + 1)
      .reduce((acc, curr) => acc + (curr.accuracy || 0), 0);
    averages.push({
      date: trends[i].date,
      value: sum / windowSize,
    });
  }
  return averages;
};

/**
 * Get topic-wise performance
 */
exports.getTopicPerformance = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { sortBy = "accuracy", limit = 20 } = req.query;

    const performance = await StudentPerformance.findOne({ studentId });

    if (!performance) {
      return res.json({
        success: true,
        topics: [],
      });
    }

    let sortedTopics = [...performance.topicPerformance];

    switch (sortBy) {
      case "accuracy":
        sortedTopics.sort((a, b) => b.accuracy - a.accuracy);
        break;
      case "questions":
        sortedTopics.sort(
          (a, b) => b.questionsAttempted - a.questionsAttempted,
        );
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
      case "recent":
        sortedTopics.sort(
          (a, b) => new Date(b.lastPracticed) - new Date(a.lastPracticed),
        );
        break;
      default:
        sortedTopics.sort((a, b) => b.accuracy - a.accuracy);
    }

    const topics = sortedTopics.slice(0, parseInt(limit)).map((t) => ({
      topic: t.topic,
      subject: t.subject,
      accuracy: t.accuracy,
      questionsAttempted: t.questionsAttempted,
      correctAnswers: t.correctAnswers,
      masteryLevel: t.masteryLevel,
      lastPracticed: t.lastPracticed,
      timeSpent: t.timeSpent,
      averageDifficulty: t.averageDifficulty,
      stabilityIndex: t.stabilityIndex || 0.5,
      retentionScore: t.retentionScore || 0.5,
      weaknessPriority: t.weaknessPriority || 0,
      status: this.getTopicStatus(t.accuracy, t.questionsAttempted),
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
      totalTopics: performance.topicPerformance.length,
    });
  } catch (error) {
    console.error("Error getting topic performance:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get topic status
 */
exports.getTopicStatus = (accuracy, attempts) => {
  if (attempts < 5) return "insufficient_data";
  if (accuracy >= 80) return "strong";
  if (accuracy >= 60) return "good";
  if (accuracy >= 40) return "average";
  return "weak";
};

/**
 * Get weak topics
 */
exports.getWeakTopics = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { minQuestions = 5, threshold = 50 } = req.query;

    const performance = await StudentPerformance.findOne({ studentId });

    if (!performance) {
      return res.json({
        success: true,
        weakTopics: [],
      });
    }

    const weakTopics = performance.topicPerformance
      .filter(
        (t) =>
          t.questionsAttempted >= parseInt(minQuestions) &&
          t.accuracy < parseInt(threshold),
      )
      .sort((a, b) => a.accuracy - b.accuracy)
      .map((t) => ({
        topic: t.topic,
        subject: t.subject,
        accuracy: t.accuracy,
        questionsAttempted: t.questionsAttempted,
        correctAnswers: t.correctAnswers,
        masteryLevel: t.masteryLevel,
        lastPracticed: t.lastPracticed,
        timeSpent: t.timeSpent,
        weaknessPriority:
          performance.analytics?.weaknessPriority?.find(
            (w) => w.topic === t.topic,
          )?.score || 0,
        recommendation: this.generateTopicRecommendation(t, "weak"),
      }));

    res.json({
      success: true,
      weakTopics,
      count: weakTopics.length,
    });
  } catch (error) {
    console.error("Error getting weak topics:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get strong topics
 */
exports.getStrongTopics = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { minQuestions = 5, threshold = 75 } = req.query;

    const performance = await StudentPerformance.findOne({ studentId });

    if (!performance) {
      return res.json({
        success: true,
        strongTopics: [],
      });
    }

    const strongTopics = performance.topicPerformance
      .filter(
        (t) =>
          t.questionsAttempted >= parseInt(minQuestions) &&
          t.accuracy >= parseInt(threshold),
      )
      .sort((a, b) => b.accuracy - a.accuracy)
      .map((t) => ({
        topic: t.topic,
        subject: t.subject,
        accuracy: t.accuracy,
        questionsAttempted: t.questionsAttempted,
        correctAnswers: t.correctAnswers,
        masteryLevel: t.masteryLevel,
        lastPracticed: t.lastPracticed,
        timeSpent: t.timeSpent,
        recommendation: this.generateTopicRecommendation(t, "strong"),
      }));

    res.json({
      success: true,
      strongTopics,
      count: strongTopics.length,
    });
  } catch (error) {
    console.error("Error getting strong topics:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Generate topic recommendation
 */
exports.generateTopicRecommendation = (topic, type) => {
  if (type === "weak") {
    return `Focus on improving ${topic.topic}. Your accuracy is ${topic.accuracy.toFixed(1)}%. Practice more questions and review fundamental concepts.`;
  } else {
    return `You're doing great in ${topic.topic} with ${topic.accuracy.toFixed(1)}% accuracy. Consider moving to advanced topics or helping others learn.`;
  }
};

/**
 * Get student insights (including all 12 analytics models)
 */
exports.getStudentInsights = async (req, res) => {
  try {
    const { studentId } = req.params;

    const performance = await StudentPerformance.findOne({ studentId });

    if (!performance) {
      return res.json({
        success: true,
        insights: {
          strongestTopics: [],
          weakestTopics: [],
          recommendedDifficulty: 0.5,
          consistencyScore: 0,
          improvementRate: 0,
          predictedScore: 0,
          studyEfficiency: 0,
          analytics: null,
        },
      });
    }

    // Ensure analytics are calculated
    if (
      !performance.analytics ||
      Object.keys(performance.analytics).length === 0
    ) {
      performance.calculateAnalytics();
      await performance.save();
    }

    // Get Flask predictions for comparison
    let flaskPredictions = null;
    try {
      const flaskData = await flaskApiService.getModelInfo(studentId);
      flaskPredictions = flaskData?.dashboard_data?.predictions;
    } catch (error) {
      console.error("Error getting Flask predictions:", error.message);
    }

    res.json({
      success: true,
      insights: {
        ...performance.insights,
        predictedScore: this.calculatePredictedScore(performance),
        studyEfficiency: performance.analytics.studyEfficiency?.score || 0,
        timeDistribution: this.calculateTimeDistribution(performance),
        difficultyAdaptation: this.calculateDifficultyAdaptation(performance),
        recommendedTopics: this.generateRecommendedTopics(performance),
        nextMilestone: this.calculateNextMilestone(performance),
        analytics: performance.analytics,
        flaskPredictions,
      },
    });
  } catch (error) {
    console.error("Error getting student insights:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Calculate predicted score
 */
exports.calculatePredictedScore = (performance) => {
  const recentTests = performance.testHistory.slice(-3);
  if (recentTests.length < 2) return performance.overallStats.accuracy || 50;

  const trend =
    recentTests.reduce((acc, test, idx, arr) => {
      if (idx === 0) return 0;
      return acc + (test.accuracy - arr[idx - 1].accuracy);
    }, 0) /
    (recentTests.length - 1);

  const lastScore = recentTests[recentTests.length - 1].accuracy || 50;
  const predicted = lastScore + trend;

  return Math.min(100, Math.max(0, Math.round(predicted)));
};

/**
 * Calculate time distribution
 */
exports.calculateTimeDistribution = (performance) => {
  const totalTime = performance.topicPerformance.reduce(
    (sum, t) => sum + (t.timeSpent || 0),
    0,
  );
  if (totalTime === 0) return [];

  return performance.topicPerformance
    .map((t) => ({
      topic: t.topic,
      percentage: Math.round((t.timeSpent / totalTime) * 100),
      timeSpent: t.timeSpent,
    }))
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 5);
};

/**
 * Calculate difficulty adaptation
 */
exports.calculateDifficultyAdaptation = (performance) => {
  const recentTests = performance.testHistory.slice(-5);
  if (recentTests.length < 2) return 0.5;

  const difficultyTrend =
    recentTests.reduce((acc, test, idx, arr) => {
      if (idx === 0) return 0;
      return (
        acc +
        ((test.averageDifficulty || 0.5) -
          (arr[idx - 1].averageDifficulty || 0.5))
      );
    }, 0) /
    (recentTests.length - 1);

  return Math.max(0, Math.min(1, 0.5 + difficultyTrend));
};

/**
 * Generate recommended topics
 */
exports.generateRecommendedTopics = (performance) => {
  const weakTopics = performance.topicPerformance
    .filter((t) => t.accuracy < 50 && t.questionsAttempted >= 3)
    .map((t) => t.topic);

  const unpracticedTopics = performance.topicPerformance
    .filter((t) => t.questionsAttempted < 5)
    .map((t) => t.topic);

  const priorityTopics =
    performance.analytics?.weaknessPriority?.slice(0, 3).map((w) => w.topic) ||
    [];

  return {
    urgent: weakTopics.slice(0, 3),
    explore: unpracticedTopics.slice(0, 3),
    priority: priorityTopics,
    maintain: performance.topicPerformance
      .filter((t) => t.accuracy >= 70 && t.questionsAttempted >= 10)
      .map((t) => t.topic)
      .slice(0, 3),
  };
};

/**
 * Calculate next milestone
 */
exports.calculateNextMilestone = (performance) => {
  const milestones = [
    {
      threshold: 50,
      name: "50 questions",
      achieved: performance.overallStats.totalQuestions >= 50,
    },
    {
      threshold: 100,
      name: "100 questions",
      achieved: performance.overallStats.totalQuestions >= 100,
    },
    {
      threshold: 500,
      name: "500 questions",
      achieved: performance.overallStats.totalQuestions >= 500,
    },
    {
      threshold: 70,
      name: "70% accuracy",
      achieved: performance.overallStats.accuracy >= 70,
    },
    {
      threshold: 85,
      name: "85% accuracy",
      achieved: performance.overallStats.accuracy >= 85,
    },
    {
      threshold: 7,
      name: "7-day streak",
      achieved: performance.overallStats.currentStreak >= 7,
    },
    {
      threshold: 30,
      name: "30-day streak",
      achieved: performance.overallStats.currentStreak >= 30,
    },
  ];

  const nextMilestone = milestones.find((m) => !m.achieved);
  const progress = nextMilestone
    ? this.calculateProgress(performance, nextMilestone)
    : 100;

  return {
    current: nextMilestone?.name || "Master",
    progress,
    nextThreshold: nextMilestone?.threshold,
  };
};

/**
 * Calculate progress towards milestone
 */
exports.calculateProgress = (performance, milestone) => {
  if (milestone.name.includes("questions")) {
    return Math.min(
      100,
      (performance.overallStats.totalQuestions / milestone.threshold) * 100,
    );
  }
  if (milestone.name.includes("accuracy")) {
    return Math.min(
      100,
      (performance.overallStats.accuracy / milestone.threshold) * 100,
    );
  }
  if (milestone.name.includes("streak")) {
    return Math.min(
      100,
      (performance.overallStats.currentStreak / milestone.threshold) * 100,
    );
  }
  return 0;
};

/**
 * Get test history
 */
exports.getTestHistory = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { limit = 20, page = 1, testType } = req.query;

    const skip = (page - 1) * limit;

    const query = { studentId, status: "completed" };
    if (testType) query.testType = testType;

    const tests = await TestSession.find(query)
      .sort({ endTime: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select("sessionId testType testConfig.title endTime summary startTime");

    const total = await TestSession.countDocuments(query);

    const enhancedTests = tests.map((test, index) => {
      const testObj = test.toObject();
      if (index > 0 && tests[index - 1]) {
        const prevAccuracy = tests[index - 1].summary?.accuracy || 0;
        const currentAccuracy = test.summary?.accuracy || 0;
        testObj.trend =
          currentAccuracy > prevAccuracy
            ? "up"
            : currentAccuracy < prevAccuracy
              ? "down"
              : "stable";
        testObj.change = Math.abs(currentAccuracy - prevAccuracy).toFixed(1);
      }
      return testObj;
    });

    res.json({
      success: true,
      tests: enhancedTests,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalTests: total,
        hasNext: skip + tests.length < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Error getting test history:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get test details
 */
exports.getTestDetails = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const testSession = await TestSession.findOne({ sessionId });

    if (!testSession) {
      return res.status(404).json({
        success: false,
        error: "Test session not found",
      });
    }

    let flaskAnalysis = null;
    if (testSession.flaskSessionId) {
      try {
        flaskAnalysis = await flaskApiService.completeTestSession(
          testSession.flaskSessionId,
        );
      } catch (error) {
        console.error("Error fetching Flask analysis:", error.message);
      }
    }

    res.json({
      success: true,
      test: {
        sessionId: testSession.sessionId,
        testType: testSession.testType,
        title: testSession.testConfig.title,
        startTime: testSession.startTime,
        endTime: testSession.endTime,
        summary: testSession.summary,
        config: testSession.testConfig,
        topics: testSession.testConfig.selectedTopics,
        analytics: testSession.analytics,
        flaskAnalysis,
      },
    });
  } catch (error) {
    console.error("Error getting test details:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get learning recommendations
 */
exports.getRecommendations = async (req, res) => {
  try {
    const { studentId } = req.params;

    const performance = await StudentPerformance.findOne({ studentId });

    if (!performance) {
      return res.json({
        success: true,
        recommendations: [
          {
            type: "welcome",
            priority: "high",
            message:
              "Welcome! Start your first test to get personalized recommendations.",
            action: "Take a practice test",
            icon: "🎯",
          },
        ],
      });
    }

    const recommendations = [];

    // Topic-based recommendations from weakness priority
    const weaknesses = performance.analytics?.weaknessPriority || [];
    weaknesses.slice(0, 3).forEach((w) => {
      recommendations.push({
        type: "weakness",
        priority: "high",
        topic: w.topic,
        message: `Focus on improving ${w.topic} (priority rank #${w.rank})`,
        action: `Practice more questions in ${w.topic} and review fundamental concepts`,
        icon: "📚",
      });
    });

    // Streak-based recommendations
    if (performance.overallStats.currentStreak > 5) {
      recommendations.push({
        type: "motivation",
        priority: "medium",
        message: `Great job! You're on a ${performance.overallStats.currentStreak}-day streak!`,
        action: "Keep up the consistency to build strong learning habits",
        icon: "🔥",
      });
    }

    // Fatigue-based recommendations
    if (performance.analytics?.fatigueIndex?.current > 0.7) {
      recommendations.push({
        type: "fatigue",
        priority: "high",
        message: "High fatigue detected. Your performance may be affected.",
        action: "Take a short break and come back refreshed",
        icon: "😴",
      });
    }

    // Focus loss recommendations
    if (performance.analytics?.focusLoss?.frequency > 0.3) {
      recommendations.push({
        type: "focus",
        priority: "medium",
        message: "Focus loss detected in recent sessions",
        action: "Try shorter study sessions with breaks in between",
        icon: "🎯",
      });
    }

    // Time allocation recommendations
    const timeAllocation = performance.analytics?.timeAllocation || [];
    timeAllocation.slice(0, 2).forEach((t) => {
      recommendations.push({
        type: "time",
        priority: "medium",
        topic: t.topic,
        message: `Allocate ${t.recommendedMinutes} minutes to ${t.topic} today`,
        action: t.reason,
        icon: "⏰",
      });
    });

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

/**
 * Get peer comparison
 */
exports.getPeerComparison = async (req, res) => {
  try {
    const { studentId } = req.params;

    const performance = await StudentPerformance.findOne({ studentId });

    if (!performance) {
      return res.json({
        success: true,
        comparison: null,
      });
    }

    const allPerformances = await StudentPerformance.find({}).select(
      "overallStats.accuracy overallStats.totalQuestions overallStats.totalTimeSpent",
    );

    if (allPerformances.length <= 1) {
      return res.json({
        success: true,
        comparison: {
          message: "Not enough data for comparison",
        },
      });
    }

    const allAccuracies = allPerformances
      .map((p) => p.overallStats.accuracy || 0)
      .filter((a) => a > 0);
    const allQuestions = allPerformances
      .map((p) => p.overallStats.totalQuestions || 0)
      .filter((q) => q > 0);

    const percentile = this.calculatePercentile(
      performance.overallStats.accuracy || 0,
      allAccuracies,
    );
    const questionsPercentile = this.calculatePercentile(
      performance.overallStats.totalQuestions || 0,
      allQuestions,
    );

    res.json({
      success: true,
      comparison: {
        accuracyPercentile: Math.round(percentile),
        questionsPercentile: Math.round(questionsPercentile),
        rank: {
          accuracy: Math.round((allAccuracies.length * percentile) / 100) + 1,
          total: allAccuracies.length + 1,
        },
        averageAccuracy: Math.round(
          allAccuracies.reduce((a, b) => a + b, 0) / allAccuracies.length,
        ),
        averageQuestions: Math.round(
          allQuestions.reduce((a, b) => a + b, 0) / allQuestions.length,
        ),
      },
    });
  } catch (error) {
    console.error("Error getting peer comparison:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Calculate percentile
 */
exports.calculatePercentile = (value, array) => {
  if (!array.length) return 50;
  const below = array.filter((v) => v < value).length;
  const equal = array.filter((v) => v === value).length;
  return ((below + 0.5 * equal) / array.length) * 100;
};

/**
 * Get learning path
 */
exports.getLearningPath = async (req, res) => {
  try {
    const { studentId } = req.params;

    const performance = await StudentPerformance.findOne({ studentId });

    if (!performance) {
      return res.json({
        success: true,
        learningPath: {
          currentLevel: "beginner",
          nextMilestone: "Complete first test",
          recommendedTopics: [],
        },
      });
    }

    let currentLevel = "beginner";
    const avgAccuracy = performance.overallStats.accuracy || 0;
    const totalQuestions = performance.overallStats.totalQuestions || 0;

    if (avgAccuracy >= 80 && totalQuestions >= 100) {
      currentLevel = "expert";
    } else if (avgAccuracy >= 70 && totalQuestions >= 50) {
      currentLevel = "advanced";
    } else if (avgAccuracy >= 60 && totalQuestions >= 25) {
      currentLevel = "intermediate";
    }

    const weakTopics = performance.topicPerformance
      .filter((t) => t.accuracy < 60 && t.questionsAttempted >= 3)
      .map((t) => t.topic);

    const unpracticedTopics = performance.topicPerformance
      .filter((t) => t.questionsAttempted < 3)
      .map((t) => t.topic);

    const masteredTopics = performance.topicPerformance
      .filter((t) => t.accuracy >= 80 && t.questionsAttempted >= 10)
      .map((t) => t.topic);

    res.json({
      success: true,
      learningPath: {
        currentLevel,
        levelProgress: this.calculateLevelProgress(performance, currentLevel),
        nextLevel: this.getNextLevel(currentLevel),
        requirementsForNext: this.getLevelRequirements(currentLevel),
        focusTopics: weakTopics.slice(0, 5),
        exploreTopics: unpracticedTopics.slice(0, 3),
        masteredTopics: masteredTopics.slice(0, 5),
        recommendedActions: this.generateLearningActions(
          performance,
          currentLevel,
        ),
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

/**
 * Calculate level progress
 */
exports.calculateLevelProgress = (performance, currentLevel) => {
  const accuracy = performance.overallStats.accuracy || 0;
  const questions = performance.overallStats.totalQuestions || 0;

  switch (currentLevel) {
    case "beginner":
      return Math.min(100, (questions / 25) * 100);
    case "intermediate":
      return Math.min(100, (accuracy / 60) * 100);
    case "advanced":
      return Math.min(100, (accuracy / 70) * 100);
    case "expert":
      return 100;
    default:
      return 0;
  }
};

/**
 * Get next level
 */
exports.getNextLevel = (currentLevel) => {
  const levels = {
    beginner: "intermediate",
    intermediate: "advanced",
    advanced: "expert",
    expert: "master",
  };
  return levels[currentLevel] || "expert";
};

/**
 * Get level requirements
 */
exports.getLevelRequirements = (currentLevel) => {
  const requirements = {
    beginner: { accuracy: "60%", questions: "25 questions" },
    intermediate: { accuracy: "70%", questions: "50 questions" },
    advanced: { accuracy: "80%", questions: "100 questions" },
    expert: { accuracy: "90%", questions: "200 questions" },
  };
  return requirements[currentLevel] || requirements.beginner;
};

/**
 * Generate learning actions
 */
exports.generateLearningActions = (performance, level) => {
  const actions = [];

  if (level === "beginner") {
    actions.push({
      title: "Build Foundation",
      tasks: [
        "Complete 25 questions in each core topic",
        "Focus on understanding concepts rather than speed",
        "Review all explanations for incorrect answers",
      ],
    });
  } else if (level === "intermediate") {
    actions.push({
      title: "Strengthen Understanding",
      tasks: [
        "Practice mixed topic tests",
        "Start timing your practice sessions",
        "Focus on weak areas identified in performance",
      ],
    });
  } else if (level === "advanced") {
    actions.push({
      title: "Mastery & Speed",
      tasks: [
        "Take full-length timed tests",
        "Practice advanced difficulty questions",
        "Analyze mistake patterns and eliminate them",
      ],
    });
  } else {
    actions.push({
      title: "Maintain Excellence",
      tasks: [
        "Regular review of all topics",
        "Help others learn (teaching reinforces learning)",
        "Explore advanced applications and connections",
      ],
    });
  }

  // Add personalized tasks from analytics
  if (performance.analytics?.focusLoss?.frequency > 0.3) {
    actions[0].tasks.push("Use Pomodoro technique (25 min study, 5 min break)");
  }

  if (performance.analytics?.fatigueIndex?.current > 0.6) {
    actions[0].tasks.push("Take longer breaks between sessions");
  }

  return actions;
};

/**
 * Update student settings
 */
exports.updateSettings = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { profile = {}, examPreferences = {} } = req.body || {};

    const user = await User.findOne({ studentId });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Student not found",
      });
    }

    const allowedProfileFields = [
      "phone",
      "dateOfBirth",
      "gender",
      "address",
      "city",
      "state",
      "pincode",
    ];
    const allowedPreferenceFields = [
      "targetExam",
      "preferredSubjects",
      "dailyGoal",
      "difficultyLevel",
    ];

    if (!user.profile) {
      user.profile = {};
    }
    if (!user.examPreferences) {
      user.examPreferences = {};
    }

    allowedProfileFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(profile, field)) {
        user.profile[field] = profile[field];
      }
    });

    allowedPreferenceFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(examPreferences, field)) {
        user.examPreferences[field] = examPreferences[field];
      }
    });

    await user.save();

    res.json({
      success: true,
      message: "Settings updated successfully",
      settings: {
        profile: user.profile,
        examPreferences: user.examPreferences,
      },
    });
  } catch (error) {
    console.error("Error updating student settings:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
