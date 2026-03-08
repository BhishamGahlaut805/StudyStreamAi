const mongoose = require("mongoose");

const TopicMetricSchema = new mongoose.Schema({
  topicId: String,
  subject: String,
  topicCategory: String,
  accuracy: Number,
  questionsAttempted: Number,
  correctAnswers: Number,
  averageResponseTime: Number,
  masteryLevel: {
    type: String,
    enum: ["beginner", "intermediate", "advanced", "expert"],
  },
  retentionScore: {
    type: Number,
    min: 0,
    max: 1,
  },
  forgettingRate: Number,
  stabilityIndex: Number,
  lastPracticed: Date,
  nextReview: Date,
  reviewInterval: Number, // days
  stressImpact: Number,
  fatigueImpact: Number,
});

const DailyMetricSchema = new mongoose.Schema({
  date: Date,
  accuracy: Number,
  questionsAttempted: Number,
  timeSpentMinutes: Number,
  averageDifficulty: Number,
  averageStress: Number,
  averageFatigue: Number,
  averageFocus: Number,
  newTopicsLearned: Number,
  reviewedTopics: Number,
});

const RetentionMetricsSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    overallMetrics: {
      totalSessions: {
        type: Number,
        default: 0,
      },
      totalQuestions: {
        type: Number,
        default: 0,
      },
      totalCorrect: {
        type: Number,
        default: 0,
      },
      overallAccuracy: {
        type: Number,
        default: 0,
      },
      totalTimeSpentMinutes: {
        type: Number,
        default: 0,
      },
      averageResponseTimeMs: {
        type: Number,
        default: 0,
      },
      learningVelocity: {
        type: Number,
        default: 0,
      },
      retentionRate: {
        type: Number,
        default: 0.5,
      },
      currentStreak: {
        type: Number,
        default: 0,
      },
      longestStreak: {
        type: Number,
        default: 0,
      },
    },
    topicMetrics: [TopicMetricSchema],
    dailyMetrics: [DailyMetricSchema],
    weeklyMetrics: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    monthlyMetrics: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Flask model predictions stored for reference
    flaskPredictions: {
      micro: mongoose.Schema.Types.Mixed,
      meso: mongoose.Schema.Types.Mixed,
      macro: mongoose.Schema.Types.Mixed,
      lastUpdated: Date,
    },
    // Forgetting curves
    forgettingCurves: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Stress and fatigue patterns
    stressPatterns: {
      average: Number,
      trend: String,
      peakHours: [Number],
      lowHours: [Number],
      recommendations: [String],
    },
    fatiguePatterns: {
      average: Number,
      trend: String,
      criticalThreshold: Number,
      recommendations: [String],
    },
    // Performance predictions
    performancePredictions: {
      nextWeekAccuracy: Number,
      nextMonthAccuracy: Number,
      predictedRetention: Number,
      confidence: Number,
    },
    // Learning path
    learningPath: {
      currentLevel: String,
      nextLevel: String,
      requirements: mongoose.Schema.Types.Mixed,
      recommendedTopics: [String],
      estimatedCompletion: Date,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Update with session data
RetentionMetricsSchema.methods.updateWithSession = function (session) {
  // Update overall stats
  this.overallMetrics.totalSessions += 1;
  this.overallMetrics.totalQuestions += session.answers.length;
  this.overallMetrics.totalCorrect += session.answers.filter(
    (a) => a.isCorrect,
  ).length;
  this.overallMetrics.totalTimeSpentMinutes +=
    session.answers.reduce((sum, a) => sum + a.responseTimeMs, 0) / (1000 * 60);

  this.overallMetrics.overallAccuracy =
    (this.overallMetrics.totalCorrect / this.overallMetrics.totalQuestions) *
    100;

  const avgTime =
    session.answers.reduce((sum, a) => sum + a.responseTimeMs, 0) /
    session.answers.length;
  this.overallMetrics.averageResponseTimeMs =
    (this.overallMetrics.averageResponseTimeMs *
      (this.overallMetrics.totalQuestions - session.answers.length) +
      avgTime * session.answers.length) /
    this.overallMetrics.totalQuestions;

  // Update streak
  const today = new Date().setHours(0, 0, 0, 0);
  const lastActive = this.lastUpdated
    ? new Date(this.lastUpdated).setHours(0, 0, 0, 0)
    : null;

  if (lastActive && today - lastActive === 86400000) {
    this.overallMetrics.currentStreak += 1;
  } else if (lastActive && today - lastActive > 86400000) {
    this.overallMetrics.currentStreak = 1;
  } else if (!lastActive) {
    this.overallMetrics.currentStreak = 1;
  }

  this.overallMetrics.longestStreak = Math.max(
    this.overallMetrics.longestStreak,
    this.overallMetrics.currentStreak,
  );

  // Update topic metrics
  session.answers.forEach((answer) => {
    let topicMetric = this.topicMetrics.find(
      (t) => t.topicId === answer.topicId,
    );

    if (!topicMetric) {
      topicMetric = {
        topicId: answer.topicId,
        subject: answer.subject,
        topicCategory: answer.topicCategory,
        accuracy: 0,
        questionsAttempted: 0,
        correctAnswers: 0,
        averageResponseTime: 0,
        masteryLevel: "beginner",
        retentionScore: 0.5,
        forgettingRate: 0.15,
        stabilityIndex: 0.5,
        lastPracticed: new Date(),
        stressImpact: 0,
        fatigueImpact: 0,
      };
      this.topicMetrics.push(topicMetric);
    }

    topicMetric.questionsAttempted++;
    if (answer.isCorrect) topicMetric.correctAnswers++;
    topicMetric.accuracy =
      (topicMetric.correctAnswers / topicMetric.questionsAttempted) * 100;

    topicMetric.averageResponseTime =
      (topicMetric.averageResponseTime * (topicMetric.questionsAttempted - 1) +
        answer.responseTimeMs) /
      topicMetric.questionsAttempted;

    topicMetric.lastPracticed = answer.submittedAt;
    topicMetric.stressImpact =
      (topicMetric.stressImpact * (topicMetric.questionsAttempted - 1) +
        answer.stressLevel) /
      topicMetric.questionsAttempted;
    topicMetric.fatigueImpact =
      (topicMetric.fatigueImpact * (topicMetric.questionsAttempted - 1) +
        answer.fatigueIndex) /
      topicMetric.questionsAttempted;

    // Update mastery level
    if (topicMetric.questionsAttempted >= 20 && topicMetric.accuracy >= 80) {
      topicMetric.masteryLevel = "expert";
    } else if (
      topicMetric.questionsAttempted >= 15 &&
      topicMetric.accuracy >= 70
    ) {
      topicMetric.masteryLevel = "advanced";
    } else if (
      topicMetric.questionsAttempted >= 10 &&
      topicMetric.accuracy >= 60
    ) {
      topicMetric.masteryLevel = "intermediate";
    }

    // Calculate retention score (simplified Ebbinghaus)
    const daysSinceLast = Math.max(
      1,
      (new Date() - new Date(topicMetric.lastPracticed)) /
        (1000 * 60 * 60 * 24),
    );
    topicMetric.retentionScore = Math.max(
      0.1,
      Math.min(
        1,
        (topicMetric.accuracy / 100) *
          Math.exp(-topicMetric.forgettingRate * daysSinceLast),
      ),
    );
  });

  // Update daily metrics
  const todayStr = new Date().toDateString();
  let dailyMetric = this.dailyMetrics.find(
    (d) => new Date(d.date).toDateString() === todayStr,
  );

  if (!dailyMetric) {
    dailyMetric = {
      date: new Date(),
      accuracy: 0,
      questionsAttempted: 0,
      timeSpentMinutes: 0,
      averageDifficulty: 0,
      averageStress: 0,
      averageFatigue: 0,
      averageFocus: 0,
      newTopicsLearned: 0,
      reviewedTopics: 0,
    };
    this.dailyMetrics.push(dailyMetric);
  }

  const sessionTime =
    session.answers.reduce((sum, a) => sum + a.responseTimeMs, 0) / (1000 * 60);
  dailyMetric.timeSpentMinutes += sessionTime;
  dailyMetric.questionsAttempted += session.answers.length;
  dailyMetric.accuracy =
    (session.answers.filter((a) => a.isCorrect).length /
      session.answers.length) *
    100;

  const avgStress =
    session.answers.reduce((sum, a) => sum + a.stressLevel, 0) /
    session.answers.length;
  dailyMetric.averageStress =
    (dailyMetric.averageStress *
      (dailyMetric.questionsAttempted - session.answers.length) +
      avgStress * session.answers.length) /
    dailyMetric.questionsAttempted;

  const avgFatigue =
    session.answers.reduce((sum, a) => sum + a.fatigueIndex, 0) /
    session.answers.length;
  dailyMetric.averageFatigue =
    (dailyMetric.averageFatigue *
      (dailyMetric.questionsAttempted - session.answers.length) +
      avgFatigue * session.answers.length) /
    dailyMetric.questionsAttempted;

  const avgFocus =
    session.answers.reduce((sum, a) => sum + a.focusScore, 0) /
    session.answers.length;
  dailyMetric.averageFocus =
    (dailyMetric.averageFocus *
      (dailyMetric.questionsAttempted - session.answers.length) +
      avgFocus * session.answers.length) /
    dailyMetric.questionsAttempted;

  const avgDifficulty =
    session.answers.reduce((sum, a) => sum + a.difficulty, 0) /
    session.answers.length;
  dailyMetric.averageDifficulty =
    (dailyMetric.averageDifficulty *
      (dailyMetric.questionsAttempted - session.answers.length) +
      avgDifficulty * session.answers.length) /
    dailyMetric.questionsAttempted;

  // Keep only last 90 days
  if (this.dailyMetrics.length > 90) {
    this.dailyMetrics = this.dailyMetrics.slice(-90);
  }

  this.lastUpdated = new Date();
};

// Update with Flask predictions
RetentionMetricsSchema.methods.updateFlaskPredictions = function (predictions) {
  this.flaskPredictions = {
    micro: predictions.micro || {},
    meso: predictions.meso || {},
    macro: predictions.macro || {},
    lastUpdated: new Date(),
  };

  // Update forgetting curves if available
  if (predictions.forgettingCurves) {
    this.forgettingCurves = predictions.forgettingCurves;
  }

  // Update stress and fatigue patterns
  if (predictions.stressFatigue) {
    this.stressPatterns =
      predictions.stressFatigue.stress || this.stressPatterns;
    this.fatiguePatterns =
      predictions.stressFatigue.fatigue || this.fatiguePatterns;
  }
};

// Generate insights
RetentionMetricsSchema.methods.generateInsights = function () {
  // Find strongest topics
  const strongTopics = this.topicMetrics
    .filter((t) => t.questionsAttempted >= 5 && t.accuracy >= 70)
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 5)
    .map((t) => ({
      topic: t.topicCategory,
      accuracy: t.accuracy,
      mastery: t.masteryLevel,
    }));

  // Find weakest topics
  const weakTopics = this.topicMetrics
    .filter((t) => t.questionsAttempted >= 5 && t.accuracy < 60)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 5)
    .map((t) => ({
      topic: t.topicCategory,
      accuracy: t.accuracy,
      retentionScore: t.retentionScore,
      nextReview: t.nextReview,
    }));

  // Topics needing review
  const needsReview = this.topicMetrics
    .filter((t) => t.retentionScore < 0.6 && t.questionsAttempted >= 3)
    .sort((a, b) => a.retentionScore - b.retentionScore)
    .slice(0, 5)
    .map((t) => ({
      topic: t.topicCategory,
      retentionScore: t.retentionScore,
      lastPracticed: t.lastPracticed,
    }));

  // Learning velocity trend
  const recentDaily = this.dailyMetrics.slice(-7);
  const avgVelocity =
    recentDaily.length > 0
      ? recentDaily.reduce((sum, d) => sum + (d.newTopicsLearned || 0), 0) /
        recentDaily.length
      : 0;

  return {
    strongTopics,
    weakTopics,
    needsReview,
    learningVelocity: avgVelocity,
    overallRetention: this.overallMetrics.retentionRate,
    predictedAccuracy: this.performancePredictions?.nextWeekAccuracy,
    recommendations: this.generateRecommendations(weakTopics, needsReview),
  };
};

// Generate recommendations
RetentionMetricsSchema.methods.generateRecommendations = function (
  weakTopics,
  needsReview,
) {
  const recommendations = [];

  weakTopics.slice(0, 3).forEach((topic) => {
    recommendations.push({
      type: "weakness",
      priority: "high",
      topic: topic.topic,
      message: `Focus on improving ${topic.topic} (${Math.round(topic.accuracy)}% accuracy)`,
      action: `Practice more questions in ${topic.topic}`,
    });
  });

  needsReview.slice(0, 3).forEach((topic) => {
    recommendations.push({
      type: "review",
      priority: "medium",
      topic: topic.topic,
      message: `Review ${topic.topic} - retention dropped to ${Math.round(
        topic.retentionScore * 100,
      )}%`,
      action: `Schedule review session for ${topic.topic}`,
    });
  });

  if (this.stressPatterns?.average > 0.7) {
    recommendations.push({
      type: "stress",
      priority: "high",
      message: "High stress levels detected",
      action: "Take more breaks and practice relaxation techniques",
    });
  }

  if (this.fatiguePatterns?.average > 0.7) {
    recommendations.push({
      type: "fatigue",
      priority: "high",
      message: "High fatigue levels detected",
      action: "Consider shorter study sessions with adequate rest",
    });
  }

  return recommendations;
};

module.exports = mongoose.model("RetentionMetrics", RetentionMetricsSchema);
