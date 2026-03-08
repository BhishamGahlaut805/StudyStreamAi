const mongoose = require("mongoose");

const AnswerSchema = new mongoose.Schema({
  questionId: {
    type: String,
    required: true,
  },
  questionText: String,
  selectedOptions: mongoose.Schema.Types.Mixed,
  isCorrect: Boolean,
  marksObtained: Number,
  timeSpent: Number, // seconds
  answerChanges: {
    type: Number,
    default: 0,
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.5,
  },
  conceptArea: String,
  topic: String,
  difficulty: Number,
  difficultyLevel: String,
  submittedAt: {
    type: Date,
    default: Date.now,
  },
});

const PauseSchema = new mongoose.Schema({
  startTime: Date,
  endTime: Date,
  duration: Number, // seconds
});

const TestSessionSchema = new mongoose.Schema(
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
    studentId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    testType: {
      type: String,
      enum: ["practice", "real"],
      required: true,
    },
    testConfig: {
      title: String,
      description: String,
      totalDuration: Number, // minutes for real tests
      totalQuestions: Number,
      selectedTopics: [String],
      selectedPdfs: [String],
      questionTypes: [String],
      adaptiveEnabled: {
        type: Boolean,
        default: true,
      },
      batchSize: {
        type: Number,
        default: 2,
      },
      difficulty: {
        type: Number,
        min: 0,
        max: 1,
        default: 0.5,
      },
      allowReview: {
        type: Boolean,
        default: true,
      },
      showSolutions: {
        type: Boolean,
        default: false,
      },
      flaskEnabled: Boolean,
      sections: [
        {
          name: String,
          subject: String,
          questionCount: Number,
          marksPerQuestion: Number,
        },
      ],
    },
    questions: [
      {
        _id: String,
        text: String,
        type: {
          type: String,
          enum: ["MCQ", "MSQ", "NAT"],
        },
        difficulty: Number,
        difficultyLevel: String,
        options: [
          {
            id: String,
            text: String,
          },
        ],
        correctAnswer: mongoose.Schema.Types.Mixed,
        explanation: String,
        solutionSteps: [String],
        conceptArea: String,
        topic: String,
        subtopic: String,
        marks: Number,
        expectedTime: Number,
        metadata: {
          generatedAt: Date,
          sourcePdf: String,
          tags: [String],
          lstmOutput: mongoose.Schema.Types.Mixed,
        },
      },
    ],
    answers: [AnswerSchema],
    currentQuestionIndex: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["pending", "active", "paused", "completed", "abandoned"],
      default: "pending",
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: Date,
    timeRemaining: Number, // seconds for real tests
    pauses: [PauseSchema],
    summary: {
      totalQuestions: Number,
      answeredQuestions: Number,
      unansweredQuestions: Number,
      correctAnswers: Number,
      incorrectAnswers: Number,
      accuracy: Number, // percentage
      totalMarks: Number,
      marksObtained: Number,
      percentageScore: Number,
      totalTimeSpent: Number, // seconds
      averageTimePerQuestion: Number, // seconds
      conceptWisePerformance: mongoose.Schema.Types.Mixed,
      difficultyWisePerformance: mongoose.Schema.Types.Mixed,
    },
    analytics: {
      conceptMastery: mongoose.Schema.Types.Mixed,
      stabilityIndex: mongoose.Schema.Types.Mixed,
      confidenceCalibration: Number,
      errorPatterns: mongoose.Schema.Types.Mixed,
      weaknessPriority: mongoose.Schema.Types.Mixed,
      forgettingCurve: mongoose.Schema.Types.Mixed,
      fatigueIndex: Number,
      behaviorCluster: String,
      difficultyTolerance: Number,
      studyEfficiency: Number,
      focusLossFrequency: Number,
      timeAllocation: mongoose.Schema.Types.Mixed,
    },
    metadata: {
      ipAddress: String,
      userAgent: String,
      deviceInfo: String,
      flaskSessionId: String,
      flaskMetadata: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for faster queries
TestSessionSchema.index({ studentId: 1, startTime: -1 });
TestSessionSchema.index({ status: 1, testType: 1 });

// Calculate summary
TestSessionSchema.methods.calculateSummary = function () {
  const answered = this.answers.filter((a) => a.submittedAt).length;
  const correct = this.answers.filter((a) => a.isCorrect).length;
  const totalMarks = this.questions.reduce((sum, q) => sum + (q.marks || 0), 0);
  const marksObtained = this.answers.reduce(
    (sum, a) => sum + (a.marksObtained || 0),
    0,
  );
  const totalTimeSpent = this.answers.reduce(
    (sum, a) => sum + (a.timeSpent || 0),
    0,
  );

  // Concept-wise performance
  const conceptWise = {};
  this.answers.forEach((answer) => {
    const concept = answer.conceptArea || "general";
    if (!conceptWise[concept]) {
      conceptWise[concept] = {
        total: 0,
        correct: 0,
        totalTime: 0,
      };
    }
    conceptWise[concept].total++;
    if (answer.isCorrect) conceptWise[concept].correct++;
    conceptWise[concept].totalTime += answer.timeSpent || 0;
  });

  // Add accuracy to concept-wise
  Object.keys(conceptWise).forEach((concept) => {
    conceptWise[concept].accuracy =
      (conceptWise[concept].correct / conceptWise[concept].total) * 100;
    conceptWise[concept].averageTime =
      conceptWise[concept].totalTime / conceptWise[concept].total;
  });

  // Difficulty-wise performance
  const difficultyWise = {};
  this.answers.forEach((answer) => {
    const diff = answer.difficultyLevel || "medium";
    if (!difficultyWise[diff]) {
      difficultyWise[diff] = {
        total: 0,
        correct: 0,
      };
    }
    difficultyWise[diff].total++;
    if (answer.isCorrect) difficultyWise[diff].correct++;
  });

  Object.keys(difficultyWise).forEach((diff) => {
    difficultyWise[diff].accuracy =
      (difficultyWise[diff].correct / difficultyWise[diff].total) * 100;
  });

  this.summary = {
    totalQuestions: this.questions.length,
    answeredQuestions: answered,
    unansweredQuestions: this.questions.length - answered,
    correctAnswers: correct,
    incorrectAnswers: answered - correct,
    accuracy: answered > 0 ? (correct / answered) * 100 : 0,
    totalMarks,
    marksObtained,
    percentageScore: totalMarks > 0 ? (marksObtained / totalMarks) * 100 : 0,
    totalTimeSpent,
    averageTimePerQuestion: answered > 0 ? totalTimeSpent / answered : 0,
    conceptWisePerformance: conceptWise,
    difficultyWisePerformance: difficultyWise,
  };
};

// Check if test is complete
TestSessionSchema.methods.isComplete = function () {
  if (this.testType === "real") {
    return (
      this.answers.length >= this.questions.length || this.timeRemaining <= 0
    );
  }
  return false; // Practice mode never auto-completes
};

// End test
TestSessionSchema.methods.endTest = function () {
  this.status = "completed";
  this.endTime = new Date();
  this.calculateSummary();
};

// Add answer
TestSessionSchema.methods.addAnswer = function (answer) {
  this.answers.push(answer);
  this.currentQuestionIndex++;
};

module.exports = mongoose.model("TestSession", TestSessionSchema);
