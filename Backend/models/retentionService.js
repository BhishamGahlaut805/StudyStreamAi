const mongoose = require("mongoose");

const RetentionAnswerSchema = new mongoose.Schema({
  questionId: {
    type: String,
    required: true,
  },
  topicId: {
    type: String,
    required: true,
    index: true,
  },
  courseId: {
    type: String,
    required: true,
    index: true,
  },
  subject: {
    type: String,
    default: "general",
  },
  topicCategory: {
    type: String,
    required: true,
  },
  isCorrect: {
    type: Boolean,
    required: true,
  },
  responseTimeMs: {
    type: Number,
    required: true,
  },
  hesitationCount: {
    type: Number,
    default: 0,
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.5,
  },
  difficulty: {
    type: Number,
    min: 0,
    max: 1,
    required: true,
  },
  stressLevel: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.3,
  },
  fatigueIndex: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.3,
  },
  focusScore: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.7,
  },
  attemptNumber: {
    type: Number,
    default: 1,
  },
  sessionPosition: {
    type: Number,
    required: true,
  },
  timeSinceLastMs: {
    type: Number,
    default: 0,
  },
  answerChanges: {
    type: Number,
    default: 0,
  },
  moodScore: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.5,
  },
  sleepQuality: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.7,
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
});

const RetentionSessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
    },
    flaskSessionId: {
      type: String,
      sparse: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    studentId: {
      type: String,
      required: true,
      index: true,
    },
    courseId: {
      type: String,
      required: true,
      index: true,
    },
    courseName: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      default: "general",
    },
    topics: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["pending", "active", "paused", "completed", "abandoned"],
      default: "pending",
    },
    sessionType: {
      type: String,
      enum: ["practice", "review", "test"],
      default: "practice",
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: Date,
    answers: [RetentionAnswerSchema],
    currentBatchType: {
      type: String,
      enum: ["immediate", "short_term", "medium_term", "long_term", "mastered"],
      default: "immediate",
    },
    currentBatchQuestions: [
      {
        questionId: String,
        topicId: String,
        topicCategory: String,
        order: Number,
        courseId: String,
        source: {
          type: String,
          enum: ["fresh", "retention"],
          default: "fresh",
        },
        sentAt: Date,
      },
    ],
    sentQuestionIds: {
      type: [String],
      default: [],
    },
    currentQuestionIndex: {
      type: Number,
      default: 0,
    },
    flaskPredictions: {
      micro: mongoose.Schema.Types.Mixed,
      meso: mongoose.Schema.Types.Mixed,
      macro: mongoose.Schema.Types.Mixed,
      forgettingCurves: mongoose.Schema.Types.Mixed,
      stressFatigue: mongoose.Schema.Types.Mixed,
    },
    flaskCompletion: {
      status: {
        type: String,
        enum: ["not_started", "pending", "completed", "failed"],
        default: "not_started",
      },
      attempts: {
        type: Number,
        default: 0,
      },
      lastAttemptAt: Date,
      completedAt: Date,
      lastError: String,
    },
    metrics: {
      accuracy: Number,
      averageResponseTime: Number,
      totalQuestions: Number,
      answeredQuestions: Number,
      correctAnswers: Number,
      incorrectAnswers: Number,
      averageDifficulty: Number,
      learningVelocity: Number,
      retentionRate: Number,
      stressPattern: mongoose.Schema.Types.Mixed,
      fatigueTrend: mongoose.Schema.Types.Mixed,
      focusTrend: mongoose.Schema.Types.Mixed,
      topicBreakdown: mongoose.Schema.Types.Mixed,
    },
    uiState: {
      retentionQueue: {
        type: [mongoose.Schema.Types.Mixed],
        default: [],
      },
      retentionArchive: {
        type: [mongoose.Schema.Types.Mixed],
        default: [],
      },
      servedQuestionIds: {
        type: [String],
        default: [],
      },
      runtime: {
        sessionStartMs: Number,
        questionStartMs: Number,
        updatedAt: Number,
      },
      updatedAt: {
        type: Date,
      },
    },
    metadata: {
      ipAddress: String,
      userAgent: String,
      deviceInfo: String,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
RetentionSessionSchema.index({ studentId: 1, startTime: -1 });
RetentionSessionSchema.index({ studentId: 1, courseId: 1 });
RetentionSessionSchema.index({ studentId: 1, status: 1 });

// Calculate metrics
RetentionSessionSchema.methods.calculateMetrics = function () {
  const answered = this.answers.length;
  if (answered === 0) return;

  const correct = this.answers.filter((a) => a.isCorrect).length;
  const totalTime = this.answers.reduce((sum, a) => sum + a.responseTimeMs, 0);
  const avgDifficulty =
    this.answers.reduce((sum, a) => sum + a.difficulty, 0) / answered;

  // Calculate accuracy by topic
  const topicBreakdown = {};
  this.answers.forEach((answer) => {
    const topicKey = answer.topicCategory || answer.topicId || "General";
    if (!topicBreakdown[topicKey]) {
      topicBreakdown[topicKey] = { total: 0, correct: 0, timeSum: 0 };
    }
    topicBreakdown[topicKey].total++;
    if (answer.isCorrect) topicBreakdown[topicKey].correct++;
    topicBreakdown[topicKey].timeSum += answer.responseTimeMs;
  });

  // Add accuracy percentages
  Object.keys(topicBreakdown).forEach((topic) => {
    const data = topicBreakdown[topic];
    data.accuracy = (data.correct / data.total) * 100;
    data.avgTimeMs = data.timeSum / data.total;
  });

  // Calculate stress pattern
  const stressLevels = this.answers.map((a) => a.stressLevel);
  const avgStress =
    stressLevels.length > 0
      ? stressLevels.reduce((a, b) => a + b, 0) / stressLevels.length
      : 0;
  const stressTrend = this.calculateTrend(stressLevels);

  // Calculate fatigue trend
  const fatigueLevels = this.answers.map((a) => a.fatigueIndex);
  const fatigueTrend = this.calculateTrend(fatigueLevels);

  // Calculate focus trend
  const focusLevels = this.answers.map((a) => a.focusScore);
  const focusTrend = this.calculateTrend(focusLevels);

  this.metrics = {
    accuracy: (correct / answered) * 100,
    averageResponseTime: totalTime / answered,
    totalQuestions: this.answers.length,
    answeredQuestions: answered,
    correctAnswers: correct,
    incorrectAnswers: answered - correct,
    averageDifficulty: avgDifficulty,
    learningVelocity: this.calculateLearningVelocity(),
    retentionRate: this.calculateRetentionRate(),
    stressPattern: {
      average: avgStress,
      trend:
        stressTrend > 0.01
          ? "increasing"
          : stressTrend < -0.01
            ? "decreasing"
            : "stable",
    },
    fatigueTrend:
      fatigueTrend > 0.01
        ? "increasing"
        : fatigueTrend < -0.01
          ? "decreasing"
          : "stable",
    focusTrend:
      focusTrend > 0.01
        ? "improving"
        : focusTrend < -0.01
          ? "declining"
          : "stable",
    topicBreakdown,
  };
};

// Calculate trend
RetentionSessionSchema.methods.calculateTrend = function (values) {
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

// Calculate learning velocity
RetentionSessionSchema.methods.calculateLearningVelocity = function () {
  if (this.answers.length < 10) return 0;

  // Group by topic and calculate mastery
  const topicMastery = {};
  this.answers.forEach((answer) => {
    const topicKey = answer.topicCategory || answer.topicId || "General";
    if (!topicMastery[topicKey]) {
      topicMastery[topicKey] = { total: 0, correct: 0 };
    }
    topicMastery[topicKey].total++;
    if (answer.isCorrect) topicMastery[topicKey].correct++;
  });

  // Count topics with >70% accuracy and at least 3 attempts
  const masteredTopics = Object.values(topicMastery).filter(
    (t) => t.total >= 3 && t.correct / t.total > 0.7,
  ).length;

  // Normalize by session duration (minutes)
  const duration = this.endTime
    ? (this.endTime - this.startTime) / (1000 * 60)
    : 30;

  return duration > 0 ? (masteredTopics / duration) * 60 : 0; // topics per hour
};

// Calculate retention rate
RetentionSessionSchema.methods.calculateRetentionRate = function () {
  if (this.answers.length < 5) return 0.5;

  // Compare first half vs second half performance
  const half = Math.floor(this.answers.length / 2);
  const firstHalf = this.answers.slice(0, half);
  const secondHalf = this.answers.slice(half);

  const firstAccuracy =
    firstHalf.filter((a) => a.isCorrect).length / firstHalf.length;
  const secondAccuracy =
    secondHalf.filter((a) => a.isCorrect).length / secondHalf.length;

  return secondAccuracy / Math.max(0.1, firstAccuracy);
};

// Complete session
RetentionSessionSchema.methods.complete = function () {
  this.status = "completed";
  this.endTime = new Date();
  this.calculateMetrics();
};

// Get session summary
RetentionSessionSchema.methods.getSummary = function () {
  return {
    sessionId: this.sessionId,
    courseId: this.courseId,
    courseName: this.courseName,
    topics: this.topics,
    startTime: this.startTime,
    endTime: this.endTime,
    duration: this.endTime
      ? (this.endTime - this.startTime) / (1000 * 60)
      : null,
    metrics: this.metrics,
    totalQuestions: this.answers.length,
    topicsCovered: Object.keys(this.metrics?.topicBreakdown || {}),
  };
};

module.exports = mongoose.model("RetentionSession", RetentionSessionSchema);
