// file: models/QuestionRepetition.js
// Update the schema to make subject optional and add courseId

const mongoose = require("mongoose");

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
    courseId: {
      type: String,
      required: true,
      index: true,
    },
    courseName: {
      type: String,
      default: "",
    },
    topicId: {
      type: String,
      required: true,
      index: true,
    },
    subject: {
      type: String,
      default: "general", // Make optional with default
    },
    topicCategory: {
      type: String,
      required: true,
    },
    difficulty: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5,
    },
    currentRepetition: {
      type: Number,
      default: 0,
    },
    maxRepetitions: {
      type: Number,
      default: 7,
    },
    nextScheduledDate: {
      type: Date,
      required: true,
    },
    currentBatchType: {
      type: String,
      enum: ["immediate", "short_term", "medium_term", "long_term", "mastered"],
      default: "immediate",
    },
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
      default: 2.5,
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
      min: 0,
      max: 1,
      default: 0.5,
    },
    isMastered: {
      type: Boolean,
      default: false,
    },
    masteredAt: Date,
    nextRepetitionDates: [
      {
        repetitionNumber: Number,
        scheduledDate: Date,
        batchType: String,
        completed: Boolean,
        completedAt: Date,
      },
    ],
    retentionHistory: [
      {
        repetitionNumber: Number,
        answeredAt: Date,
        wasCorrect: Boolean,
        retentionAfter: Number,
        sessionId: String,
      },
    ],
    schedulingHistory: [
      {
        source: String,
        timerFrameSeconds: Number,
        timerFrameLabel: String,
        batchType: String,
        retentionProbability: Number,
        dueAt: Date,
        scheduledAt: Date,
      },
    ],
    latestFlaskMetrics: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    latestQuestionSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    metadata: {
      sourceQuestionId: String,
      generatedBy: {
        type: String,
        enum: ["flask", "manual", "system"],
        default: "system",
      },
    },
  },
  {
    timestamps: true,
  },
);

// Compound index for efficient queries
QuestionRepetitionSchema.index(
  { studentId: 1, questionId: 1 },
  { unique: true },
);
QuestionRepetitionSchema.index({ studentId: 1, nextScheduledDate: 1 });
QuestionRepetitionSchema.index({ studentId: 1, courseId: 1, isMastered: 1 });

// Initialize schedule for a new question
QuestionRepetitionSchema.methods.initializeSchedule = function () {
  const now = new Date();
  this.currentRepetition = 0;
  this.nextScheduledDate = now;
  this.currentBatchType = "immediate";
  this.currentRetention = 0.5;
  this.stabilityIndex = 0.5;
  this.easeFactor = 2.5;
  this.timesCorrect = 0;
  this.timesIncorrect = 0;
  this.lastAccuracy = 0.5;
  this.isMastered = false;
  this.retentionHistory = [];
};

// Update after a repetition attempt
QuestionRepetitionSchema.methods.updateAfterRepetition = async function (
  wasCorrect,
  responseTimeMs,
  sessionId,
) {
  // Update counts
  if (wasCorrect) {
    this.timesCorrect++;
  } else {
    this.timesIncorrect++;
  }

  // Update last accuracy
  const totalAttempts = this.timesCorrect + this.timesIncorrect;
  this.lastAccuracy = this.timesCorrect / totalAttempts;

  // Calculate new retention based on SM-2 like algorithm
  const quality = wasCorrect
    ? Math.min(5, Math.floor(responseTimeMs / 1000 / 30) + 3)
    : 0;

  // Update ease factor (SM-2 algorithm)
  if (quality >= 3) {
    let newEase =
      this.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    this.easeFactor = Math.min(2.5, Math.max(1.3, newEase));
  }

  // Calculate new interval
  let interval = 1;
  if (this.currentRepetition === 0) {
    interval = 1;
  } else if (this.currentRepetition === 1) {
    interval = 6;
  } else {
    interval = Math.round(this.currentRepetition * this.easeFactor);
  }

  // Cap interval and convert to days
  interval = Math.min(365, interval);
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + interval);

  // Update retention probability
  const newRetention = Math.min(
    0.95,
    Math.max(
      0.1,
      this.lastAccuracy * 0.6 + (wasCorrect ? 0.25 : 0) + quality / 10,
    ),
  );
  this.currentRetention = newRetention;

  // Determine batch type based on interval
  if (interval <= 0) this.currentBatchType = "immediate";
  else if (interval <= 1) this.currentBatchType = "short_term";
  else if (interval <= 3) this.currentBatchType = "medium_term";
  else if (interval <= 14) this.currentBatchType = "long_term";
  else this.currentBatchType = "mastered";

  this.currentRepetition++;
  this.nextScheduledDate = nextDate;

  // Check if mastered (3+ correct in a row with good retention)
  if (
    this.currentRepetition >= 5 &&
    this.lastAccuracy >= 0.8 &&
    this.currentRetention >= 0.8
  ) {
    this.isMastered = true;
    this.masteredAt = new Date();
  }

  // Add to history
  this.retentionHistory.push({
    repetitionNumber: this.currentRepetition,
    answeredAt: new Date(),
    wasCorrect,
    retentionAfter: this.currentRetention,
    sessionId,
  });

  // Keep history limited
  if (this.retentionHistory.length > 20) {
    this.retentionHistory = this.retentionHistory.slice(-20);
  }
};

// Add scheduling history entry
QuestionRepetitionSchema.methods.pushSchedulingHistory = function (entry) {
  if (!Array.isArray(this.schedulingHistory)) {
    this.schedulingHistory = [];
  }
  this.schedulingHistory.push({
    ...entry,
    scheduledAt: new Date(),
  });
  if (this.schedulingHistory.length > 50) {
    this.schedulingHistory = this.schedulingHistory.slice(-50);
  }
};

// Static method to find due questions
QuestionRepetitionSchema.statics.findDueQuestions = async function (
  studentId,
  courseId = null,
) {
  const query = {
    studentId,
    isMastered: false,
    nextScheduledDate: { $lte: new Date() },
  };
  if (courseId) {
    query.courseId = courseId;
  }
  return this.find(query).sort({ nextScheduledDate: 1, currentRetention: 1 });
};

module.exports = mongoose.model("QuestionRepetition", QuestionRepetitionSchema);
