const mongoose = require("mongoose");

const ScheduledQuestionSchema = new mongoose.Schema({
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
  batchType: {
    type: String,
    enum: ["immediate", "short_term", "medium_term", "long_term", "mastered"],
    required: true,
  },
  scheduledFor: {
    type: Date,
    required: true,
  },
  priority: {
    type: Number,
    min: 1,
    max: 5,
    default: 3,
  },
  retentionAtScheduling: {
    type: Number,
    min: 0,
    max: 1,
    required: true,
  },
  scheduledAt: {
    type: Date,
    default: Date.now,
  },
  completed: {
    type: Boolean,
    default: false,
  },
  completedAt: Date,
  performance: {
    correct: Boolean,
    responseTimeMs: Number,
  },
});

const DailyScheduleSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
  },
  questions: [ScheduledQuestionSchema],
  totalQuestions: Number,
  completedQuestions: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ["pending", "in_progress", "completed"],
    default: "pending",
  },
});

const RetentionScheduleSchema = new mongoose.Schema(
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
    subject: {
      type: String,
      enum: ["english", "gk", "both"],
      default: "both",
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
    generatedBy: {
      type: String,
      enum: ["flask", "manual", "system"],
      default: "flask",
    },
    flaskScheduleId: String,
    dailySchedules: [DailyScheduleSchema],
    weeklyPlan: {
      weekStart: Date,
      weekEnd: Date,
      focusTopics: [String],
      estimatedQuestions: Number,
      estimatedTimeMinutes: Number,
    },
    monthlyPlan: {
      monthStart: Date,
      monthEnd: Date,
      goals: mongoose.Schema.Types.Mixed,
      milestones: [String],
    },
    batchRecommendations: {
      immediate: [
        {
          topicId: String,
          questions: Number,
          priority: String,
        },
      ],
      short_term: [
        {
          topicId: String,
          questions: Number,
          scheduledDay: Number,
        },
      ],
      medium_term: [
        {
          topicId: String,
          questions: Number,
          scheduledDay: Number,
        },
      ],
      long_term: [
        {
          topicId: String,
          questions: Number,
          scheduledDay: Number,
        },
      ],
      mastered: [
        {
          topicId: String,
          questions: Number,
          scheduledDay: Number,
        },
      ],
    },
    metrics: {
      totalQuestions: Number,
      totalTimeMinutes: Number,
      averageDailyQuestions: Number,
      reviewRatio: Number,
      newVsReview: Number,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(+new Date() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
RetentionScheduleSchema.index({ studentId: 1, isActive: 1 });
RetentionScheduleSchema.index({ "dailySchedules.date": 1 });

// Get today's schedule
RetentionScheduleSchema.methods.getTodaySchedule = function () {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return this.dailySchedules.find(
    (schedule) => schedule.date.toDateString() === today.toDateString()
  );
};

// Get next questions
RetentionScheduleSchema.methods.getNextQuestions = function (count = 5) {
  const todaySchedule = this.getTodaySchedule();
  if (!todaySchedule) return [];

  const pendingQuestions = todaySchedule.questions.filter((q) => !q.completed);
  return pendingQuestions.slice(0, count);
};

// Mark question as completed
RetentionScheduleSchema.methods.completeQuestion = async function (
  questionId,
  performance
) {
  for (const dailySchedule of this.dailySchedules) {
    const question = dailySchedule.questions.find(
      (q) => q.questionId === questionId
    );
    if (question) {
      question.completed = true;
      question.completedAt = new Date();
      question.performance = performance;
      dailySchedule.completedQuestions++;
      break;
    }
  }

  // Update daily schedule status
  const todaySchedule = this.getTodaySchedule();
  if (todaySchedule) {
    if (todaySchedule.completedQuestions >= todaySchedule.totalQuestions) {
      todaySchedule.status = "completed";
    } else if (todaySchedule.completedQuestions > 0) {
      todaySchedule.status = "in_progress";
    }
  }

  await this.save();
};

// Generate summary
RetentionScheduleSchema.methods.generateSummary = function () {
  const totalQuestions = this.dailySchedules.reduce(
    (sum, day) => sum + day.questions.length,
    0
  );
  const completedQuestions = this.dailySchedules.reduce(
    (sum, day) => sum + day.completedQuestions,
    0
  );

  const immediateCount = this.batchRecommendations.immediate.length;
  const shortTermCount = this.batchRecommendations.short_term.length;
  const mediumTermCount = this.batchRecommendations.medium_term.length;
  const longTermCount = this.batchRecommendations.long_term.length;
  const masteredCount = this.batchRecommendations.mastered.length;

  return {
    totalQuestions,
    completedQuestions,
    completionRate: totalQuestions > 0 ? (completedQuestions / totalQuestions) * 100 : 0,
    batchDistribution: {
      immediate: immediateCount,
      short_term: shortTermCount,
      medium_term: mediumTermCount,
      long_term: longTermCount,
      mastered: masteredCount,
    },
    estimatedStudyTime: this.metrics.totalTimeMinutes,
    focusTopics: this.weeklyPlan?.focusTopics || [],
  };
};

module.exports = mongoose.model("RetentionSchedule", RetentionScheduleSchema);
