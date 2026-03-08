const mongoose = require("mongoose");

const TopicPrioritySchema = new mongoose.Schema(
  {
    topic: { type: String, required: true },
    priorityScore: { type: Number, min: 0, max: 100, default: 0 },
    retentionScore: { type: Number, min: 0, max: 1, default: 0 },
    questionsAttempted: { type: Number, default: 0 },
  },
  { _id: false },
);

const SubjectPrioritySchema = new mongoose.Schema(
  {
    rank: { type: Number, required: true },
    subject: { type: String, required: true },
    score: { type: Number, min: 0, max: 100, default: 0 },
  },
  { _id: false },
);

const StudyScheduleEntrySchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    startTime: { type: String, default: "" },
    endTime: { type: String, default: "" },
    focus: { type: String, default: "" },
    plannedQuestions: { type: Number, default: 0 },
  },
  { _id: false },
);

const QuestionAnalyticsSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    questionText: { type: String, default: "" },
    topic: { type: String, default: "General" },
    sequence: { type: Number, default: 1 },
    attemptedAt: { type: Date, default: Date.now },
    isCorrect: { type: Boolean, default: false },
    responseTimeMs: { type: Number, default: 0 },
    attemptNumber: { type: Number, default: 1 },
    retentionProbability: { type: Number, min: 0, max: 1, default: 0 },
    nextQuestionDifficulty: { type: Number, min: 0, max: 1, default: 0 },
    probabilityCorrectNextAttempt: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },
    optimalRevisionIntervalDays: { type: Number, min: 0, default: 0 },
    reviewStage: { type: String, default: "scheduled" },
  },
  { _id: false },
);

const TimelinePointSchema = new mongoose.Schema(
  {
    sequence: { type: Number, default: 1 },
    questionId: { type: String, default: "" },
    timestamp: { type: Date, default: Date.now },
    elapsedSeconds: { type: Number, default: 0 },
    gapSeconds: { type: Number, default: 0 },
    retentionProbability: { type: Number, min: 0, max: 1, default: 0 },
    nextQuestionDifficulty: { type: Number, min: 0, max: 1, default: 0 },
    probabilityCorrectNextAttempt: { type: Number, min: 0, max: 1, default: 0 },
    responseTimeMs: { type: Number, default: 0 },
    isCorrect: { type: Boolean, default: false },
    stressLevel: { type: Number, min: 0, max: 1, default: 0 },
    fatigueIndex: { type: Number, min: 0, max: 1, default: 0 },
    focusScore: { type: Number, min: 0, max: 1, default: 0 },
    complexityIndex: { type: Number, min: 0, max: 1, default: 0 },
  },
  { _id: false },
);

const RetentionSessionAnalyticsSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    studentId: { type: String, required: true, index: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    subject: { type: String, enum: ["english", "gk"], required: true },
    topics: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["pending", "active", "paused", "completed", "abandoned"],
      default: "active",
    },
    sessionStartTime: { type: Date, default: Date.now },
    sessionEndTime: { type: Date, default: null },
    sessionDurationMinutes: { type: Number, default: 0 },

    subjectRetentionScore: { type: Number, min: 0, max: 1, default: 0 },
    nextTopicRevisionPriority: { type: [TopicPrioritySchema], default: [] },
    optimalRevisionIntervalDays: { type: Number, min: 0, default: 0 },

    retentionProbabilityOverall: { type: Number, min: 0, max: 1, default: 0 },
    nextQuestionDifficultyOverall: { type: Number, min: 0, max: 1, default: 0 },
    probabilityCorrectNextAttemptOverall: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },

    optimalDailyStudySchedule: {
      type: [StudyScheduleEntrySchema],
      default: [],
    },
    subjectPriorityOrder: { type: [SubjectPrioritySchema], default: [] },
    predictedLongTermRetentionScore: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },
    fatigueRiskProbability: { type: Number, min: 0, max: 1, default: 0 },

    questionAnalytics: { type: [QuestionAnalyticsSchema], default: [] },
    timelineAnalytics: { type: [TimelinePointSchema], default: [] },
    timestampSummary: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    complexityAnalytics: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    graphSnapshots: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    insights: { type: [String], default: [] },

    source: {
      type: String,
      enum: ["session-submit", "session-complete", "session-summary"],
      default: "session-summary",
    },
  },
  { timestamps: true },
);

RetentionSessionAnalyticsSchema.index({ studentId: 1, updatedAt: -1 });
RetentionSessionAnalyticsSchema.index({
  studentId: 1,
  subject: 1,
  updatedAt: -1,
});

module.exports =
  mongoose.models.RetentionSessionAnalytics ||
  mongoose.model("RetentionSessionAnalytics", RetentionSessionAnalyticsSchema);
