const mongoose = require("mongoose");

const TopicPerformanceSchema = new mongoose.Schema({
  topic: String,
  subject: String,
  accuracy: Number,
  questionsAttempted: Number,
  correctAnswers: Number,
  masteryLevel: {
    type: String,
    enum: ["beginner", "intermediate", "advanced", "expert"],
    default: "beginner",
  },
  stabilityIndex: Number,
  retentionScore: Number,
  weaknessPriority: Number,
  lastPracticed: Date,
  timeSpent: Number, // minutes
  averageDifficulty: Number,
  conceptMasteryHistory: [Number],
  errorPatterns: {
    conceptual: Number,
    careless: Number,
    guess: Number,
    overconfidence: Number,
  },
});

const PerformanceTrendSchema = new mongoose.Schema({
  date: Date,
  accuracy: Number,
  questionsAttempted: Number,
  timeSpent: Number,
  difficulty: Number,
});

const StudentPerformanceSchema = new mongoose.Schema(
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
    },
    overallStats: {
      totalQuestions: {
        type: Number,
        default: 0,
      },
      totalCorrect: {
        type: Number,
        default: 0,
      },
      accuracy: {
        type: Number,
        default: 0,
      },
      totalTimeSpent: {
        type: Number,
        default: 0, // minutes
      },
      totalTests: {
        type: Number,
        default: 0,
      },
      averageDifficulty: {
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
      lastActive: Date,
    },
    topicPerformance: [TopicPerformanceSchema],
    testHistory: [
      {
        sessionId: String,
        testType: String,
        date: Date,
        accuracy: Number,
        totalQuestions: Number,
        timeSpent: Number,
        averageDifficulty: Number,
        conceptsTested: [String],
      },
    ],
    performanceTrends: {
      daily: [PerformanceTrendSchema],
      weekly: [PerformanceTrendSchema],
      monthly: [PerformanceTrendSchema],
    },
    insights: {
      strongestTopics: [String],
      weakestTopics: [String],
      recommendedDifficulty: {
        type: Number,
        default: 0.5,
      },
      consistencyScore: {
        type: Number,
        default: 0,
      },
      improvementRate: {
        type: Number,
        default: 0,
      },
      predictedScore: {
        type: Number,
        default: 0,
      },
      studyEfficiency: {
        type: Number,
        default: 0,
      },
    },

    // Analytics Models (12 models output)
    analytics: {
      // 1. Concept Mastery (per topic)
      conceptMastery: mongoose.Schema.Types.Mixed,

      // 2. Stability Index (per topic)
      stabilityIndex: mongoose.Schema.Types.Mixed,

      // 3. Confidence Calibration
      confidenceCalibration: {
        overall: Number,
        byTopic: mongoose.Schema.Types.Mixed,
        byDifficulty: mongoose.Schema.Types.Mixed,
      },

      // 4. Error Pattern Classification
      errorPatterns: {
        conceptual: Number,
        careless: Number,
        guess: Number,
        overconfidence: Number,
        byTopic: mongoose.Schema.Types.Mixed,
      },

      // 5. Weakness Severity Ranking
      weaknessPriority: [
        {
          topic: String,
          score: Number,
          rank: Number,
        },
      ],

      // 6. Forgetting Curve
      forgettingCurve: {
        decayConstant: Number,
        retentionScores: mongoose.Schema.Types.Mixed,
      },

      // 7. Fatigue Sensitivity
      fatigueIndex: {
        current: Number,
        trend: String,
        bySession: [Number],
      },

      // 8. Cognitive Behavior Profile
      behaviorCluster: {
        type: String,
        enum: [
          "risk-averse",
          "impulsive",
          "overthinker",
          "balanced",
          "unclassified",
        ],
        default: "unclassified",
      },
      behaviorMetrics: {
        averageTime: Number,
        skipRate: Number,
        hardQuestionRate: Number,
        answerChangeFrequency: Number,
        difficultyPreference: Number,
      },

      // 9. Difficulty Tolerance
      difficultyTolerance: {
        maxSustainable: Number,
        easyAccuracy: Number,
        mediumAccuracy: Number,
        hardAccuracy: Number,
        veryHardAccuracy: Number,
      },

      // 10. Study Efficiency
      studyEfficiency: {
        score: Number,
        improvementPerHour: Number,
        trend: String,
      },

      // 11. Focus Loss Detection
      focusLoss: {
        frequency: Number,
        lastDetected: Date,
        triggers: [String],
      },

      // 12. Adaptive Time Allocation
      timeAllocation: [
        {
          topic: String,
          recommendedMinutes: Number,
          priority: String,
          reason: String,
        },
      ],
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

// Update with test session
StudentPerformanceSchema.methods.updateWithTestSession = function (
  testSession,
) {
  // Update overall stats
  this.overallStats.totalQuestions += testSession.questions.length;
  this.overallStats.totalCorrect += testSession.summary.correctAnswers || 0;
  this.overallStats.accuracy =
    (this.overallStats.totalCorrect / this.overallStats.totalQuestions) * 100;
  this.overallStats.totalTimeSpent +=
    testSession.summary.totalTimeSpent / 60 || 0; // convert to minutes
  this.overallStats.totalTests += 1;
  this.overallStats.lastActive = new Date();

  // Update streak
  const today = new Date().setHours(0, 0, 0, 0);
  const lastActive = this.overallStats.lastActive
    ? new Date(this.overallStats.lastActive).setHours(0, 0, 0, 0)
    : null;

  if (lastActive && today - lastActive === 86400000) {
    this.overallStats.currentStreak += 1;
  } else if (lastActive && today - lastActive > 86400000) {
    this.overallStats.currentStreak = 1;
  } else if (!lastActive) {
    this.overallStats.currentStreak = 1;
  }

  this.overallStats.longestStreak = Math.max(
    this.overallStats.longestStreak,
    this.overallStats.currentStreak,
  );

  // Add to test history
  this.testHistory.push({
    sessionId: testSession.sessionId,
    testType: testSession.testType,
    date: new Date(),
    accuracy: testSession.summary.accuracy || 0,
    totalQuestions: testSession.questions.length,
    timeSpent: testSession.summary.totalTimeSpent / 60 || 0,
    averageDifficulty: testSession.testConfig.difficulty || 0.5,
    conceptsTested: [
      ...new Set(
        testSession.questions.map((q) => q.conceptArea).filter(Boolean),
      ),
    ],
  });

  // Keep only last 50 tests
  if (this.testHistory.length > 50) {
    this.testHistory = this.testHistory.slice(-50);
  }

  // Update topic performance
  testSession.answers.forEach((answer) => {
    const topic = answer.topic || answer.conceptArea || "general";
    let topicPerf = this.topicPerformance.find((t) => t.topic === topic);

    if (!topicPerf) {
      topicPerf = {
        topic,
        subject: answer.subject || "general",
        accuracy: 0,
        questionsAttempted: 0,
        correctAnswers: 0,
        masteryLevel: "beginner",
        stabilityIndex: 0,
        retentionScore: 0.5,
        weaknessPriority: 0,
        lastPracticed: new Date(),
        timeSpent: 0,
        averageDifficulty: 0,
        conceptMasteryHistory: [],
        errorPatterns: {
          conceptual: 0,
          careless: 0,
          guess: 0,
          overconfidence: 0,
        },
      };
      this.topicPerformance.push(topicPerf);
    }

    topicPerf.questionsAttempted++;
    topicPerf.timeSpent += (answer.timeSpent || 0) / 60;
    topicPerf.averageDifficulty =
      (topicPerf.averageDifficulty * (topicPerf.questionsAttempted - 1) +
        (answer.difficulty || 0.5)) /
      topicPerf.questionsAttempted;

    if (answer.isCorrect) {
      topicPerf.correctAnswers++;
    }

    topicPerf.accuracy =
      (topicPerf.correctAnswers / topicPerf.questionsAttempted) * 100;
    topicPerf.lastPracticed = new Date();

    // Update mastery level based on accuracy and attempts
    if (topicPerf.questionsAttempted < 5) {
      topicPerf.masteryLevel = "beginner";
    } else if (topicPerf.accuracy >= 80 && topicPerf.questionsAttempted >= 20) {
      topicPerf.masteryLevel = "expert";
    } else if (topicPerf.accuracy >= 70 && topicPerf.questionsAttempted >= 15) {
      topicPerf.masteryLevel = "advanced";
    } else if (topicPerf.accuracy >= 60 && topicPerf.questionsAttempted >= 10) {
      topicPerf.masteryLevel = "intermediate";
    } else {
      topicPerf.masteryLevel = "beginner";
    }

    // Track mastery history (keep last 20)
    if (!topicPerf.conceptMasteryHistory) {
      topicPerf.conceptMasteryHistory = [];
    }
    topicPerf.conceptMasteryHistory.push(topicPerf.accuracy / 100);
    if (topicPerf.conceptMasteryHistory.length > 20) {
      topicPerf.conceptMasteryHistory =
        topicPerf.conceptMasteryHistory.slice(-20);
    }
  });

  this.lastUpdated = new Date();
};

// Calculate all 12 analytics models
StudentPerformanceSchema.methods.calculateAnalytics = function () {
  const analytics = {};

  // 1. Concept Mastery Update (Bayesian Knowledge Tracing / EMA)
  analytics.conceptMastery = this.calculateConceptMastery();

  // 2. Consistency / Stability Model
  analytics.stabilityIndex = this.calculateStabilityIndex();

  // 3. Confidence Calibration Model
  analytics.confidenceCalibration = this.calculateConfidenceCalibration();

  // 4. Error Pattern Classification Model
  analytics.errorPatterns = this.calculateErrorPatterns();

  // 5. Weakness Severity Ranking Model
  analytics.weaknessPriority = this.calculateWeaknessPriority();

  // 6. Forgetting Curve Model
  analytics.forgettingCurve = this.calculateForgettingCurve();

  // 7. Fatigue Sensitivity Model
  analytics.fatigueIndex = this.calculateFatigueIndex();

  // 8. Cognitive Behavior Profiling Model
  const behavior = this.calculateBehaviorProfile();
  analytics.behaviorCluster = behavior.cluster;
  analytics.behaviorMetrics = behavior.metrics;

  // 9. Difficulty Tolerance Model
  analytics.difficultyTolerance = this.calculateDifficultyTolerance();

  // 10. Study Efficiency Model
  analytics.studyEfficiency = this.calculateStudyEfficiency();

  // 11. Focus Loss Detection Model
  analytics.focusLoss = this.calculateFocusLoss();

  // 12. Adaptive Time Allocation Model
  analytics.timeAllocation = this.calculateTimeAllocation(analytics);

  this.analytics = analytics;
  return analytics;
};
// ==================== COMPLETE 12 ANALYTICS MODELS ====================

// 1. Concept Mastery Update (Bayesian Knowledge Tracing / EMA)
StudentPerformanceSchema.methods.calculateConceptMastery = function () {
  const mastery = {};
  const learningRate = 0.3; // Can be adjusted per student

  this.topicPerformance.forEach((topic) => {
    if (topic.questionsAttempted === 0) {
      mastery[topic.topic] = 0.5;
      return;
    }

    // Get recent performance signal (last 5 questions)
    const recentHistory = topic.conceptMasteryHistory?.slice(-5) || [];
    const performanceSignal = recentHistory.length > 0
      ? recentHistory.reduce((a, b) => a + b, 0) / recentHistory.length
      : topic.accuracy / 100;

    // EMA formula with confidence weighting
    const oldMastery =
      topic.conceptMasteryHistory?.length > 0
        ? topic.conceptMasteryHistory[topic.conceptMasteryHistory.length - 1]
        : 0.5;

    // Adjust learning rate based on question count (more data = more stable)
    const adjustedRate = learningRate * (1 - Math.min(0.5, topic.questionsAttempted / 100));

    const newMastery =
      oldMastery + adjustedRate * (performanceSignal - oldMastery);
    mastery[topic.topic] = Math.min(1, Math.max(0, newMastery));
  });

  return mastery;
};

// 2. Consistency / Stability Index
StudentPerformanceSchema.methods.calculateStabilityIndex = function () {
  const stability = {};

  this.topicPerformance.forEach((topic) => {
    if (
      !topic.conceptMasteryHistory ||
      topic.conceptMasteryHistory.length < 5
    ) {
      stability[topic.topic] = 0.5;
      return;
    }

    // Calculate rolling variance with exponential weighting
    const recent = topic.conceptMasteryHistory.slice(-15);
    const weights = recent.map((_, i) => Math.exp(i / recent.length)); // More weight to recent
    const weightSum = weights.reduce((a, b) => a + b, 0);

    const weightedMean = recent.reduce((sum, val, i) => sum + val * weights[i], 0) / weightSum;
    const weightedVariance = recent.reduce((sum, val, i) =>
      sum + weights[i] * Math.pow(val - weightedMean, 2), 0) / weightSum;

    const maxPossibleVariance = 0.25;

    // Stability score with trend adjustment
    const trend = this.calculateTrend(recent);
    const baseStability = 1 - Math.min(1, weightedVariance / maxPossibleVariance);

    // If improving trend, boost stability slightly
    const trendBoost = trend > 0.01 ? 0.1 : trend < -0.01 ? -0.1 : 0;

    stability[topic.topic] = Math.max(0, Math.min(1, baseStability + trendBoost));
  });

  return stability;
};

// Helper: Calculate trend from array
StudentPerformanceSchema.methods.calculateTrend = function (arr) {
  if (arr.length < 2) return 0;
  const n = arr.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = arr.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((a, b, i) => a + b * arr[i], 0);
  const sumX2 = x.reduce((a, b) => a + b * b, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  return isNaN(slope) ? 0 : slope;
};

// 3. Confidence Calibration Model
StudentPerformanceSchema.methods.calculateConfidenceCalibration = function () {
  // This would use actual confidence scores from answers
  // For now, derive from test history
  const calibration = {
    overall: 0,
    byTopic: {},
    byDifficulty: {
      easy: 0,
      medium: 0,
      hard: 0,
      very_hard: 0
    }
  };

  // If we have test history with confidence data
  if (this.testHistory && this.testHistory.length > 0) {
    // Placeholder - in real implementation, you'd aggregate confidence from answers
    calibration.overall = 0.15; // Calibration error (lower is better)
    calibration.byDifficulty = {
      easy: 0.08,
      medium: 0.12,
      hard: 0.18,
      very_hard: 0.22
    };
  }

  return calibration;
};

// 4. Error Pattern Classification
StudentPerformanceSchema.methods.calculateErrorPatterns = function () {
  const patterns = {
    conceptual: 0,
    careless: 0,
    guess: 0,
    overconfidence: 0,
    byTopic: {}
  };

  // Analyze topic performance to infer error patterns
  this.topicPerformance.forEach(topic => {
    const mastery = topic.accuracy / 100;
    const attempts = topic.questionsAttempted;

    if (attempts < 5) return;

    // Infer patterns based on mastery and consistency
    let conceptual = 0, careless = 0, guess = 0, overconfidence = 0;

    if (mastery < 0.4) {
      // Low mastery suggests conceptual errors
      conceptual = 0.6;
      guess = 0.3;
      careless = 0.1;
    } else if (mastery < 0.6) {
      // Medium mastery - mixed errors
      conceptual = 0.3;
      careless = 0.3;
      guess = 0.3;
      overconfidence = 0.1;
    } else if (mastery < 0.8) {
      // Good mastery - mostly careless errors
      conceptual = 0.1;
      careless = 0.5;
      guess = 0.1;
      overconfidence = 0.3;
    } else {
      // High mastery - overconfidence when wrong
      conceptual = 0.05;
      careless = 0.25;
      guess = 0.1;
      overconfidence = 0.6;
    }

    patterns.byTopic[topic.topic] = {
      conceptual,
      careless,
      guess,
      overconfidence
    };

    // Aggregate to overall
    patterns.conceptual += conceptual;
    patterns.careless += careless;
    patterns.guess += guess;
    patterns.overconfidence += overconfidence;
  });

  // Normalize overall patterns
  const total = patterns.conceptual + patterns.careless + patterns.guess + patterns.overconfidence;
  if (total > 0) {
    patterns.conceptual /= total;
    patterns.careless /= total;
    patterns.guess /= total;
    patterns.overconfidence /= total;
  }

  return patterns;
};

// 5. Weakness Severity Ranking
StudentPerformanceSchema.methods.calculateWeaknessPriority = function () {
  const priorities = [];

  this.topicPerformance.forEach((topic) => {
    if (topic.questionsAttempted < 3) return; // Not enough data

    const mastery = topic.accuracy / 100;
    const errorRate = 1 - mastery;

    // Exam weightage - could be configured per exam
    const examWeights = {
      'Mathematics': 1.0,
      'Number System': 0.9,
      'Algebra': 0.9,
      'Geometry': 0.8,
      'Trigonometry': 0.7,
      'English': 0.8,
      'Grammar': 0.8,
      'Vocabulary': 0.7,
      'Reasoning': 0.9,
      'General Knowledge': 0.6
    };

    const weightage = examWeights[topic.topic] || 0.7;

    // Retention decay (how long since practiced)
    const daysSince = topic.lastPracticed
      ? Math.floor((new Date() - new Date(topic.lastPracticed)) / (1000 * 60 * 60 * 24))
      : 30;
    const retentionDecay = Math.min(1, daysSince / 14); // 14 days = full decay

    // Stability factor (unstable topics need more attention)
    const stability = topic.stabilityIndex || 0.5;
    const instabilityFactor = 1 - stability;

    // weakness_score = (1 - mastery) × weightage × error_rate × retention_decay × instability
    const weaknessScore =
      (1 - mastery) *
      weightage *
      errorRate *
      retentionDecay *
      (1 + instabilityFactor);

    priorities.push({
      topic: topic.topic,
      subject: topic.subject,
      score: weaknessScore,
      mastery: mastery,
      questionsAttempted: topic.questionsAttempted,
      lastPracticed: topic.lastPracticed
    });
  });

  // Sort by weakness score (higher = more urgent)
  priorities.sort((a, b) => b.score - a.score);

  // Add rank and recommendation
  priorities.forEach((p, i) => {
    p.rank = i + 1;
    p.recommendation = this.generateWeaknessRecommendation(p);
  });

  return priorities.slice(0, 15); // Top 15 weaknesses
};

// Generate recommendation for weakness
StudentPerformanceSchema.methods.generateWeaknessRecommendation = function (weakness) {
  if (weakness.mastery < 0.3) {
    return `Critical: Review fundamental concepts in ${weakness.topic}`;
  } else if (weakness.mastery < 0.5) {
    return `Focus: Practice more questions in ${weakness.topic}`;
  } else if (weakness.mastery < 0.7) {
    return `Improve: Work on advanced problems in ${weakness.topic}`;
  } else {
    return `Maintain: Regular revision of ${weakness.topic}`;
  }
};

// 6. Forgetting Curve Model
StudentPerformanceSchema.methods.calculateForgettingCurve = function () {
  // Ebbinghaus forgetting curve: R = e^(-t/S)
  // where S is relative strength of memory

  const retention = {};
  let totalDecayConstant = 0;
  let topicCount = 0;

  this.topicPerformance.forEach((topic) => {
    if (!topic.lastPracticed) return;

    const daysSince = Math.floor(
      (new Date() - new Date(topic.lastPracticed)) / (1000 * 60 * 60 * 24)
    );

    if (daysSince < 0) return;

    // Calculate individual decay constant based on mastery
    // Higher mastery = slower decay
    const mastery = topic.accuracy / 100;
    const baseDecay = 0.1;
    const decayConstant = baseDecay * (1 - mastery * 0.5); // 0.05 to 0.1

    // Retention score using exponential decay
    const retentionScore = mastery * Math.exp(-decayConstant * daysSince);

    retention[topic.topic] = {
      current: retentionScore,
      original: mastery,
      daysSince,
      decayRate: decayConstant,
      predicted7Day: mastery * Math.exp(-decayConstant * 7),
      predicted30Day: mastery * Math.exp(-decayConstant * 30)
    };

    totalDecayConstant += decayConstant;
    topicCount++;
  });

  return {
    decayConstant: topicCount > 0 ? totalDecayConstant / topicCount : 0.1,
    retentionScores: retention,
    reviewRecommendations: this.generateReviewRecommendations(retention)
  };
};

// Generate review recommendations based on forgetting curve
StudentPerformanceSchema.methods.generateReviewRecommendations = function (retention) {
  const recommendations = [];
  const now = new Date();

  Object.entries(retention).forEach(([topic, data]) => {
    if (data.retentionScore < 0.6) {
      // Needs review soon
      const reviewDay = Math.ceil(Math.log(0.7 / data.mastery) / -data.decayRate);
      recommendations.push({
        topic,
        priority: data.retentionScore < 0.4 ? 'high' : 'medium',
        reviewIn: Math.max(0, reviewDay),
        reason: `Retention dropped to ${Math.round(data.retentionScore * 100)}%`
      });
    }
  });

  return recommendations.sort((a, b) => a.reviewIn - b.reviewIn).slice(0, 5);
};

// 7. Fatigue Sensitivity Model
StudentPerformanceSchema.methods.calculateFatigueIndex = function () {
  // Analyze recent test sessions for fatigue patterns
  const recentTests = this.testHistory.slice(-10);
  const bySession = [];

  if (recentTests.length < 3) {
    return {
      current: 0.2,
      trend: 'stable',
      bySession: [0.2],
      recommendations: ['Take more tests to establish fatigue pattern']
    };
  }

  // Calculate fatigue indicators for each session
  recentTests.forEach((test, index) => {
    // Fatigue score based on:
    // - Accuracy drop from first half to second half (if we had that data)
    // - Time spent relative to average
    // - For now, use simple inverse of accuracy
    const fatigueScore = 1 - (test.accuracy / 100);
    bySession.push(fatigueScore);
  });

  // Calculate trend
  const trend = this.calculateTrend(bySession);
  const trendDirection = trend > 0.02 ? 'increasing' : trend < -0.02 ? 'decreasing' : 'stable';

  // Current fatigue (weighted average of recent sessions)
  const weights = [0.4, 0.3, 0.2, 0.1]; // More weight to recent
  const current = bySession.slice(-4).reduce((sum, score, i) =>
    sum + score * (weights[i] || 0.1), 0) / weights.slice(0, bySession.slice(-4).length).reduce((a, b) => a + b, 0);

  // Generate recommendations
  const recommendations = [];
  if (current > 0.6) {
    recommendations.push('High fatigue detected - take a longer break');
  } else if (current > 0.4) {
    recommendations.push('Moderate fatigue - consider a short break');
  }

  if (trendDirection === 'increasing') {
    recommendations.push('Fatigue is increasing - consider reducing session length');
  }

  return {
    current: Math.min(1, Math.max(0, current)),
    trend: trendDirection,
    bySession,
    recommendations
  };
};

// 8. Cognitive Behavior Profile
StudentPerformanceSchema.methods.calculateBehaviorProfile = function () {
  // Analyze behavior patterns from test history
  // This would need actual answer data with timestamps, etc.

  // For now, derive from topic performance
  const metrics = {
    averageTime: 60, // seconds - placeholder
    skipRate: 0.05,
    hardQuestionRate: 0,
    answerChangeFrequency: 0.2,
    difficultyPreference: 0.5,
    confidenceLevel: 0.6
  };

  // Calculate hard question rate from topic performance
  const hardTopics = this.topicPerformance.filter(t =>
    t.averageDifficulty > 0.7 && t.questionsAttempted > 5
  );
  metrics.hardQuestionRate = hardTopics.length / Math.max(1, this.topicPerformance.length);

  // Determine cluster based on metrics
  let cluster = 'balanced';
  let description = 'Balanced learner with good mix of speed and accuracy';

  if (metrics.averageTime < 40 && metrics.answerChangeFrequency < 0.1) {
    cluster = 'impulsive';
    description = 'Tends to answer quickly, sometimes without full consideration';
  } else if (metrics.averageTime > 90 && metrics.answerChangeFrequency > 0.3) {
    cluster = 'overthinker';
    description = 'Takes time to analyze, may second-guess answers';
  } else if (metrics.difficultyPreference < 0.3) {
    cluster = 'risk-averse';
    description = 'Prefers easier questions, avoids challenging topics';
  } else if (metrics.hardQuestionRate > 0.5) {
    cluster = 'challenge-seeker';
    description = 'Actively seeks difficult questions to improve';
  }

  return {
    cluster,
    description,
    metrics
  };
};

// 9. Difficulty Tolerance
StudentPerformanceSchema.methods.calculateDifficultyTolerance = function () {
  // Calculate accuracy by difficulty level
  // This would need actual answer data with difficulty ratings

  // For now, derive from topic performance
  let easyTotal = 0, easyCorrect = 0;
  let mediumTotal = 0, mediumCorrect = 0;
  let hardTotal = 0, hardCorrect = 0;
  let veryHardTotal = 0, veryHardCorrect = 0;

  this.topicPerformance.forEach(topic => {
    const diff = topic.averageDifficulty || 0.5;
    const correct = Math.round(topic.accuracy * topic.questionsAttempted / 100);

    if (diff < 0.3) {
      easyTotal += topic.questionsAttempted;
      easyCorrect += correct;
    } else if (diff < 0.5) {
      mediumTotal += topic.questionsAttempted;
      mediumCorrect += correct;
    } else if (diff < 0.7) {
      hardTotal += topic.questionsAttempted;
      hardCorrect += correct;
    } else {
      veryHardTotal += topic.questionsAttempted;
      veryHardCorrect += correct;
    }
  });

  const easyAcc = easyTotal > 0 ? (easyCorrect / easyTotal) * 100 : 70;
  const mediumAcc = mediumTotal > 0 ? (mediumCorrect / mediumTotal) * 100 : 60;
  const hardAcc = hardTotal > 0 ? (hardCorrect / hardTotal) * 100 : 50;
  const veryHardAcc = veryHardTotal > 0 ? (veryHardCorrect / veryHardTotal) * 100 : 40;

  // Determine max sustainable difficulty
  let maxSustainable = 0.5;
  if (hardAcc >= 65) {
    maxSustainable = 0.8;
  } else if (mediumAcc >= 70) {
    maxSustainable = 0.6;
  } else if (easyAcc >= 80) {
    maxSustainable = 0.4;
  }

  return {
    maxSustainable,
    easyAccuracy: easyAcc,
    mediumAccuracy: mediumAcc,
    hardAccuracy: hardAcc,
    veryHardAccuracy: veryHardAcc,
    recommendation: this.getDifficultyRecommendation(maxSustainable, hardAcc)
  };
};

// Helper for difficulty recommendation
StudentPerformanceSchema.methods.getDifficultyRecommendation = function (maxSustainable, hardAcc) {
  if (maxSustainable >= 0.8) {
    return 'You can handle very difficult questions. Focus on advanced topics.';
  } else if (maxSustainable >= 0.6) {
    if (hardAcc < 50) {
      return 'Build confidence with medium-hard questions before attempting very hard ones.';
    }
    return 'Good progress. Gradually increase difficulty.';
  } else {
    return 'Focus on mastering easy and medium difficulty questions first.';
  }
};

// 10. Study Efficiency
StudentPerformanceSchema.methods.calculateStudyEfficiency = function () {
  // Improvement per hour of study
  const recentTests = this.testHistory.slice(-15);

  if (recentTests.length < 3) {
    return {
      score: 0.5,
      improvementPerHour: 0,
      trend: 'stable',
      efficiencyRating: 'Insufficient data'
    };
  }

  // Calculate time spent and improvement
  const firstTest = recentTests[0];
  const lastTest = recentTests[recentTests.length - 1];

  const totalTimeSpent = recentTests.reduce((sum, t) => sum + (t.timeSpent || 0), 0);
  const avgTimePerTest = totalTimeSpent / recentTests.length;

  const improvement = lastTest.accuracy - firstTest.accuracy;
  const improvementPerHour = totalTimeSpent > 0 ? (improvement / totalTimeSpent) * 60 : 0; // per hour

  // Calculate rolling efficiency
  const efficiencies = [];
  for (let i = 1; i < recentTests.length; i++) {
    const timeDiff = recentTests[i].timeSpent || 0;
    const accDiff = recentTests[i].accuracy - recentTests[i-1].accuracy;
    if (timeDiff > 0) {
      efficiencies.push(accDiff / timeDiff);
    }
  }

  const avgEfficiency = efficiencies.length > 0
    ? efficiencies.reduce((a, b) => a + b, 0) / efficiencies.length
    : 0;

  const trend = avgEfficiency > 0.1 ? 'improving' : avgEfficiency < -0.1 ? 'declining' : 'stable';

  // Efficiency score (0-1)
  const score = Math.max(0, Math.min(1, 0.5 + improvementPerHour * 2));

  // Efficiency rating
  let efficiencyRating = 'Average';
  if (score > 0.8) efficiencyRating = 'Excellent';
  else if (score > 0.6) efficiencyRating = 'Good';
  else if (score > 0.4) efficiencyRating = 'Average';
  else efficiencyRating = 'Needs Improvement';

  return {
    score,
    improvementPerHour: Math.round(improvementPerHour * 100) / 100,
    trend,
    avgTimePerTest: Math.round(avgTimePerTest),
    efficiencyRating,
    recommendations: this.getEfficiencyRecommendations(score, trend)
  };
};

// Helper for efficiency recommendations
StudentPerformanceSchema.methods.getEfficiencyRecommendations = function (score, trend) {
  const recs = [];
  if (score < 0.4) {
    recs.push('Focus on understanding concepts rather than just answering');
    recs.push('Review explanations for all questions, especially incorrect ones');
  } else if (score < 0.6) {
    recs.push('Good progress. Try to identify patterns in your mistakes');
  } else {
    recs.push('Great efficiency! Challenge yourself with harder questions');
  }

  if (trend === 'declining') {
    recs.push('Recent efficiency decline - consider taking a break or changing study method');
  }

  return recs;
};

// 11. Focus Loss Detection
StudentPerformanceSchema.methods.calculateFocusLoss = function () {
  // Detect focus loss patterns from answer data
  // This would need actual answer data with timestamps and patterns

  // For now, derive from topic performance and test history
  const focusLoss = {
    frequency: 0,
    lastDetected: null,
    triggers: [],
    pattern: 'unknown'
  };

  // Analyze recent tests for focus loss indicators
  const recentTests = this.testHistory.slice(-10);
  let focusLossEvents = 0;

  recentTests.forEach((test, index) => {
    // Simulated focus loss detection based on accuracy drops
    if (index > 0) {
      const prevAcc = recentTests[index - 1].accuracy;
      const currAcc = test.accuracy;

      // Significant accuracy drop might indicate focus loss
      if (currAcc < prevAcc - 20) {
        focusLossEvents++;
        focusLoss.lastDetected = test.date;
        focusLoss.triggers.push(`Significant accuracy drop in test on ${new Date(test.date).toLocaleDateString()}`);
      }
    }
  });

  focusLoss.frequency = focusLossEvents / Math.max(1, recentTests.length);

  // Determine pattern
  if (focusLoss.frequency > 0.3) {
    focusLoss.pattern = 'frequent';
    focusLoss.recommendation = 'Consider shorter study sessions with breaks';
  } else if (focusLoss.frequency > 0.1) {
    focusLoss.pattern = 'occasional';
    focusLoss.recommendation = 'Monitor your focus during longer sessions';
  } else {
    focusLoss.pattern = 'rare';
    focusLoss.recommendation = 'Good focus maintenance';
  }

  return focusLoss;
};

// 12. Adaptive Time Allocation
StudentPerformanceSchema.methods.calculateTimeAllocation = function (analytics) {
  const allocation = [];
  const totalTime = 120; // minutes available per day

  // Get weakness priorities
  const weaknesses = analytics.weaknessPriority || [];

  if (weaknesses.length === 0) {
    return [{
      topic: 'General Practice',
      recommendedMinutes: 60,
      priority: 'medium',
      reason: 'Start with mixed practice to identify areas for improvement'
    }];
  }

  // Calculate total weakness score for normalization
  const totalScore = weaknesses.reduce((sum, w) => sum + w.score, 0);

  // Allocate time based on weakness score, with diminishing returns
  weaknesses.forEach((w) => {
    // Normalize score with square root to avoid extreme allocations
    const normalizedScore = Math.sqrt(w.score / totalScore);
    const normalizedTotal = weaknesses.reduce((sum, w2) =>
      sum + Math.sqrt(w2.score / totalScore), 0);

    // Calculate minutes, with min/max bounds
    let minutes = Math.round((normalizedScore / normalizedTotal) * totalTime);
    minutes = Math.min(45, Math.max(10, minutes)); // Between 10 and 45 minutes

    // Determine priority based on rank and mastery
    let priority = 'medium';
    if (w.rank <= 3 && w.mastery < 0.5) {
      priority = 'high';
    } else if (w.rank > 8 || w.mastery > 0.8) {
      priority = 'low';
    }

    // Generate reason
    let reason = '';
    if (w.mastery < 0.3) {
      reason = `Critical weakness - needs fundamental review`;
    } else if (w.mastery < 0.5) {
      reason = `Needs significant practice`;
    } else if (w.mastery < 0.7) {
      reason = `Moderate improvement needed`;
    } else {
      reason = `Maintenance practice`;
    }

    allocation.push({
      topic: w.topic,
      recommendedMinutes: minutes,
      priority,
      reason,
      currentMastery: Math.round(w.mastery * 100)
    });
  });

  // Sort by priority (high first) then by minutes
  const priorityOrder = { high: 1, medium: 2, low: 3 };
  allocation.sort((a, b) => {
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return b.recommendedMinutes - a.recommendedMinutes;
  });

  return allocation.slice(0, 8); // Top 8 topics
};

module.exports = mongoose.model("StudentPerformance", StudentPerformanceSchema);
