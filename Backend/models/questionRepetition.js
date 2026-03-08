const mongoose = require("mongoose");

const RepetitionHistorySchema = new mongoose.Schema({
  questionId: {
    type: String,
    required: true,
  },
  sessionId: {
    type: String,
    required: true,
  },
  answeredAt: {
    type: Date,
    required: true,
  },
  wasCorrect: {
    type: Boolean,
    required: true,
  },
  responseTimeMs: Number,
  batchType: {
    type: String,
    enum: ["immediate", "short_term", "medium_term", "long_term", "mastered"],
  },
  retentionBefore: Number,
  retentionAfter: Number,
});

const SchedulingHistorySchema = new mongoose.Schema({
  scheduledAt: {
    type: Date,
    default: Date.now,
  },
  source: {
    type: String,
    enum: ["flask", "fallback", "manual"],
    default: "fallback",
  },
  timerFrameSeconds: {
    type: Number,
    min: 0,
  },
  timerFrameLabel: String,
  batchType: {
    type: String,
    enum: ["immediate", "short_term", "medium_term", "long_term", "mastered"],
  },
  retentionProbability: {
    type: Number,
    min: 0,
    max: 1,
  },
  dueAt: Date,
});

const QuestionRepetitionSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    questionId: {
      type: String,
      required: true,
    },
    topicId: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      enum: ["english", "gk"],
      required: true,
    },
    topicCategory: {
      type: String,
      required: true,
    },
    difficulty: {
      type: Number,
      min: 0,
      max: 1,
      required: true,
    },
    currentRepetition: {
      type: Number,
      default: 0,
    },
    maxRepetitions: {
      type: Number,
      default: 5,
    },
    // Spaced repetition intervals (in days)
    repetitionIntervals: {
      type: [Number],
      default: [0, 1, 3, 7, 14, 30],
    },
    nextRepetitionDates: [
      {
        repetitionNumber: Number,
        scheduledDate: Date,
        batchType: String,
        completed: {
          type: Boolean,
          default: false,
        },
        completedAt: Date,
        performance: {
          correct: Boolean,
          responseTimeMs: Number,
        },
      },
    ],
    lastRepetitionDate: Date,
    nextScheduledDate: Date,
    currentBatchType: {
      type: String,
      enum: ["immediate", "short_term", "medium_term", "long_term", "mastered"],
      default: "immediate",
    },
    retentionHistory: [RepetitionHistorySchema],
    currentRetention: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5,
    },
    stabilityIndex: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5,
    },
    easeFactor: {
      type: Number,
      min: 1.3,
      max: 2.5,
      default: 2.0,
    },
    timesCorrect: {
      type: Number,
      default: 0,
    },
    timesIncorrect: {
      type: Number,
      default: 0,
    },
    lastAccuracy: {
      type: Number,
      default: 0,
    },
    isMastered: {
      type: Boolean,
      default: false,
    },
    masteredAt: Date,
    metadata: {
      sourceQuestionId: String,
      generatedBy: {
        type: String,
        enum: ["flask", "manual"],
        default: "flask",
      },
    },
    // Keep these as Mixed for backward/forward compatibility with evolving Flask payload shape.
    latestQuestionSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    latestFlaskMetrics: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    schedulingHistory: {
      type: [SchedulingHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
QuestionRepetitionSchema.index({ studentId: 1, nextScheduledDate: 1 });
QuestionRepetitionSchema.index({ studentId: 1, topicId: 1 });
QuestionRepetitionSchema.index({ studentId: 1, currentBatchType: 1 });

// Initialize repetition schedule
QuestionRepetitionSchema.methods.initializeSchedule = function () {
  this.nextRepetitionDates = [];

  for (let i = 1; i <= this.maxRepetitions; i++) {
    const interval = this.repetitionIntervals[i] || 30;
    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + interval);

    let batchType = "medium_term";
    if (i === 1) batchType = "immediate";
    else if (i === 2) batchType = "short_term";
    else if (i <= 3) batchType = "medium_term";
    else if (i <= 4) batchType = "long_term";
    else batchType = "mastered";

    this.nextRepetitionDates.push({
      repetitionNumber: i,
      scheduledDate,
      batchType,
      completed: false,
    });
  }

  this.nextScheduledDate = this.nextRepetitionDates[0]?.scheduledDate;
  this.currentBatchType = this.nextRepetitionDates[0]?.batchType || "immediate";
};

// Update after repetition
QuestionRepetitionSchema.methods.updateAfterRepetition = function (
  wasCorrect,
  responseTimeMs,
  sessionId,
) {
  // Update repetition count
  this.currentRepetition++;

  // Update history
  const retentionBefore = this.currentRetention;
  this.retentionHistory.push({
    questionId: this.questionId,
    sessionId,
    answeredAt: new Date(),
    wasCorrect,
    responseTimeMs,
    batchType: this.currentBatchType,
    retentionBefore,
    retentionAfter: this.currentRetention,
  });

  // Update stats
  if (wasCorrect) {
    this.timesCorrect++;
  } else {
    this.timesIncorrect++;
  }

  this.lastAccuracy =
    this.timesCorrect / (this.timesCorrect + this.timesIncorrect);

  // Mark current repetition as completed
  const currentRep = this.nextRepetitionDates.find(
    (r) => r.repetitionNumber === this.currentRepetition,
  );
  if (currentRep) {
    currentRep.completed = true;
    currentRep.completedAt = new Date();
    currentRep.performance = {
      correct: wasCorrect,
      responseTimeMs,
    };
  }

  // Update retention using SM-2 algorithm
  this.updateRetention(wasCorrect, responseTimeMs);

  // Set next repetition
  this.lastRepetitionDate = new Date();

  if (this.currentRepetition >= this.maxRepetitions || this.isMastered) {
    this.nextScheduledDate = null;
    this.currentBatchType = "mastered";
    this.isMastered = true;
    this.masteredAt = new Date();
  } else {
    const nextRep = this.nextRepetitionDates[this.currentRepetition];
    this.nextScheduledDate = nextRep?.scheduledDate || null;
    this.currentBatchType = nextRep?.batchType || "mastered";
  }

  // Save to database
  return this.save();
};

QuestionRepetitionSchema.methods.pushSchedulingHistory = function (event) {
  if (!event || typeof event !== "object") return;
  this.schedulingHistory.push({
    scheduledAt: event.scheduledAt || new Date(),
    source: event.source || "fallback",
    timerFrameSeconds: Number(event.timerFrameSeconds || 0),
    timerFrameLabel: event.timerFrameLabel || "",
    batchType: event.batchType || this.currentBatchType,
    retentionProbability: Number(
      event.retentionProbability || this.currentRetention || 0,
    ),
    dueAt: event.dueAt || this.nextScheduledDate,
  });
  if (this.schedulingHistory.length > 100) {
    this.schedulingHistory = this.schedulingHistory.slice(-100);
  }
};

// Update retention using SM-2 algorithm
QuestionRepetitionSchema.methods.updateRetention = function (
  wasCorrect,
  responseTimeMs,
) {
  // Quality of response (0-5)
  let quality = 3; // Medium by default

  if (wasCorrect) {
    if (responseTimeMs < 5000)
      quality = 5; // Fast correct
    else if (responseTimeMs < 10000)
      quality = 4; // Normal correct
    else quality = 3; // Slow correct
  } else {
    quality = 1; // Incorrect
  }

  // SM-2 algorithm
  if (quality >= 3) {
    // Correct response
    if (this.currentRepetition === 1) {
      this.repetitionIntervals[this.currentRepetition] = 1;
    } else if (this.currentRepetition === 2) {
      this.repetitionIntervals[this.currentRepetition] = 6;
    } else {
      this.repetitionIntervals[this.currentRepetition] = Math.round(
        this.repetitionIntervals[this.currentRepetition - 1] * this.easeFactor,
      );
    }
    this.easeFactor =
      this.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  } else {
    // Incorrect response - reset
    this.currentRepetition = 0;
    this.repetitionIntervals[this.currentRepetition] = 1;
    this.easeFactor = Math.max(1.3, this.easeFactor - 0.2);
  }

  // Ensure bounds
  this.easeFactor = Math.max(1.3, Math.min(2.5, this.easeFactor));

  // Calculate current retention (exponential decay)
  const daysSinceLast = this.lastRepetitionDate
    ? (new Date() - this.lastRepetitionDate) / (1000 * 60 * 60 * 24)
    : 0;

  const baseRetention = this.lastAccuracy;
  const decayConstant = 0.1 / (this.easeFactor - 1);
  this.currentRetention = Math.max(
    0.1,
    Math.min(1, baseRetention * Math.exp(-decayConstant * daysSinceLast)),
  );

  // Mastery threshold
  if (this.timesCorrect >= 10 && this.lastAccuracy > 0.9) {
    this.isMastered = true;
  }
};

// Get batch type based on retention
QuestionRepetitionSchema.statics.getBatchTypeFromRetention = function (
  retention,
) {
  if (retention < 0.3) return "immediate";
  if (retention < 0.5) return "short_term";
  if (retention < 0.7) return "medium_term";
  if (retention < 0.85) return "long_term";
  return "mastered";
};

// Find questions due for review
QuestionRepetitionSchema.statics.findDueQuestions = function (
  studentId,
  date = new Date(),
) {
  return this.find({
    studentId,
    nextScheduledDate: { $lte: date },
    isMastered: false,
  }).sort({ nextScheduledDate: 1 });
};

module.exports = mongoose.models.QuestionRepetition || mongoose.model("QuestionRepetition", QuestionRepetitionSchema);
