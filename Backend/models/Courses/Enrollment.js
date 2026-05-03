const mongoose = require("mongoose");

const enrollmentSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Student is required"],
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: [true, "Course is required"],
    },
    enrolledAt: {
      type: Date,
      default: Date.now,
    },
    enrollmentStatus: {
      type: String,
      enum: ["active", "completed", "dropped", "paused"],
      default: "active",
    },
    progress: {
      overallProgress: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
      completedLessons: [
        {
          lessonId: {
            type: mongoose.Schema.Types.ObjectId,
          },
          chapterId: {
            type: mongoose.Schema.Types.ObjectId,
          },
          completedAt: {
            type: Date,
            default: Date.now,
          },
          timeSpent: {
            type: Number,
            default: 0,
          },
          score: {
            type: Number,
            min: 0,
            max: 100,
          },
          attempts: {
            type: Number,
            default: 1,
          },
        },
      ],
      completedQuizzes: [
        {
          quizId: {
            type: mongoose.Schema.Types.ObjectId,
          },
          chapterId: {
            type: mongoose.Schema.Types.ObjectId,
          },
          score: {
            type: Number,
            min: 0,
            max: 100,
          },
          passed: {
            type: Boolean,
            default: false,
          },
          attempts: {
            type: Number,
            default: 1,
          },
          completedAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      completedAssignments: [
        {
          assignmentId: {
            type: mongoose.Schema.Types.ObjectId,
          },
          chapterId: {
            type: mongoose.Schema.Types.ObjectId,
          },
          submissionUrl: String,
          submittedAt: {
            type: Date,
            default: Date.now,
          },
          gradedAt: Date,
          score: {
            type: Number,
            min: 0,
            max: 100,
          },
          feedback: String,
          status: {
            type: String,
            enum: ["submitted", "graded", "revision_requested"],
            default: "submitted",
          },
        },
      ],
    },
    learningMetrics: {
      totalTimeSpent: {
        type: Number,
        default: 0,
      },
      averageQuizScore: {
        type: Number,
        default: 0,
      },
      averageAssignmentScore: {
        type: Number,
        default: 0,
      },
      lastActivityAt: {
        type: Date,
        default: Date.now,
      },
      studyStreak: {
        type: Number,
        default: 0,
      },
      longestStreak: {
        type: Number,
        default: 0,
      },
      weeklyActivity: [
        {
          week: {
            type: Date,
          },
          timeSpent: {
            type: Number,
            default: 0,
          },
          lessonsCompleted: {
            type: Number,
            default: 0,
          },
        },
      ],
    },
    certificate: {
      issued: {
        type: Boolean,
        default: false,
      },
      certificateUrl: String,
      issuedAt: Date,
      certificateId: String,
    },
    paymentDetails: {
      amount: {
        type: Number,
        required: [true, "Payment amount is required"],
        default: 0,
      },
      currency: {
        type: String,
        default: "USD",
      },
      paymentMethod: {
        type: String,
        default: "free",
      },
      transactionId: {
        type: String,
        default: "FREE_COURSE",
      },
      paymentStatus: {
        type: String,
        enum: ["pending", "completed", "failed", "refunded"],
        default: "completed",
      },
      paidAt: {
        type: Date,
        default: Date.now,
      },
    },
    notes: {
      type: String,
      maxlength: [500, "Notes cannot exceed 500 characters"],
    },
    completedAt: Date,
    droppedAt: Date,
  },
  {
    timestamps: true,
  },
);

// Compound index to ensure one enrollment per student per course
enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });
enrollmentSchema.index({ course: 1, "progress.overallProgress": -1 });
enrollmentSchema.index({ student: 1, enrollmentStatus: 1 });
enrollmentSchema.index({ "learningMetrics.lastActivityAt": -1 });

// REMOVED THE PRE-SAVE HOOK COMPLETELY
// Instead, add a static method to calculate progress when needed

// Static method to update progress
enrollmentSchema.statics.updateProgress = async function (
  enrollmentId,
  totalLessons,
) {
  if (!totalLessons || totalLessons === 0) return;

  const enrollment = await this.findById(enrollmentId);
  if (!enrollment) return;

  const completedCount = enrollment.progress.completedLessons.length;
  enrollment.progress.overallProgress = Math.round(
    (completedCount / totalLessons) * 100,
  );

  // Calculate average scores
  if (enrollment.progress.completedQuizzes.length > 0) {
    enrollment.learningMetrics.averageQuizScore =
      enrollment.progress.completedQuizzes.reduce(
        (sum, q) => sum + (q.score || 0),
        0,
      ) / enrollment.progress.completedQuizzes.length;
  }

  if (enrollment.progress.completedAssignments.length > 0) {
    const gradedAssignments = enrollment.progress.completedAssignments.filter(
      (a) => a.status === "graded" && a.score !== undefined,
    );
    if (gradedAssignments.length > 0) {
      enrollment.learningMetrics.averageAssignmentScore =
        gradedAssignments.reduce((sum, a) => sum + (a.score || 0), 0) /
        gradedAssignments.length;
    }
  }

  await enrollment.save();
};

// Instance methods
enrollmentSchema.methods.markLessonComplete = function (
  lessonId,
  chapterId,
  score = null,
  timeSpent = 0,
) {
  // Ensure arrays exist
  if (!this.progress.completedLessons) {
    this.progress.completedLessons = [];
  }

  // Check if already completed
  const existingIndex = this.progress.completedLessons.findIndex(
    (l) => l.lessonId && l.lessonId.toString() === lessonId.toString(),
  );

  if (existingIndex > -1) {
    this.progress.completedLessons[existingIndex].attempts += 1;
    this.progress.completedLessons[existingIndex].completedAt = new Date();
    this.progress.completedLessons[existingIndex].timeSpent += timeSpent;
    if (score !== null) {
      this.progress.completedLessons[existingIndex].score = score;
    }
  } else {
    this.progress.completedLessons.push({
      lessonId,
      chapterId,
      completedAt: new Date(),
      timeSpent,
      score,
      attempts: 1,
    });
  }

  // Update learning metrics
  if (!this.learningMetrics) {
    this.learningMetrics = {};
  }
  this.learningMetrics.totalTimeSpent =
    (this.learningMetrics.totalTimeSpent || 0) + timeSpent;
  this.learningMetrics.lastActivityAt = new Date();
};

enrollmentSchema.methods.completeQuiz = function (
  quizId,
  chapterId,
  score,
  passed,
) {
  // Ensure array exists
  if (!this.progress.completedQuizzes) {
    this.progress.completedQuizzes = [];
  }

  const existingQuiz = this.progress.completedQuizzes.find(
    (q) => q.quizId && q.quizId.toString() === quizId.toString(),
  );

  if (existingQuiz) {
    existingQuiz.attempts += 1;
    existingQuiz.score = score;
    existingQuiz.passed = passed;
    existingQuiz.completedAt = new Date();
  } else {
    this.progress.completedQuizzes.push({
      quizId,
      chapterId,
      score,
      passed,
      attempts: 1,
      completedAt: new Date(),
    });
  }
};

enrollmentSchema.methods.submitAssignment = function (
  assignmentId,
  chapterId,
  submissionUrl,
) {
  // Ensure array exists
  if (!this.progress.completedAssignments) {
    this.progress.completedAssignments = [];
  }

  this.progress.completedAssignments.push({
    assignmentId,
    chapterId,
    submissionUrl,
    submittedAt: new Date(),
    status: "submitted",
  });
};

enrollmentSchema.methods.updateStudyStreak = function () {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastActivity = this.learningMetrics.lastActivityAt
    ? new Date(this.learningMetrics.lastActivityAt)
    : new Date();
  lastActivity.setHours(0, 0, 0, 0);

  const diffTime = Math.abs(today - lastActivity);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // Already studied today, streak continues
  } else if (diffDays === 1) {
    // Studied yesterday, increment streak
    this.learningMetrics.studyStreak =
      (this.learningMetrics.studyStreak || 0) + 1;
    if (
      this.learningMetrics.studyStreak >
      (this.learningMetrics.longestStreak || 0)
    ) {
      this.learningMetrics.longestStreak = this.learningMetrics.studyStreak;
    }
  } else {
    // Streak broken
    this.learningMetrics.studyStreak = 1;
  }
};

const Enrollment = mongoose.model("Enrollment", enrollmentSchema);

module.exports = Enrollment;
