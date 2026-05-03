// models/Question/questionAdaptationSchema.js or models/Courses/QuestionAdaptation.js
const mongoose = require("mongoose");

const questionOptionSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
});

const questionSchema = new mongoose.Schema({
  questionId: {
    type: String,
    required: true,
  },
  text: {
    type: String,
    required: [true, "Question text is required"],
  },
  type: {
    type: String,
    enum: ["MCQ", "TrueFalse", "FillInBlanks", "ShortAnswer", "Numerical"],
    default: "MCQ",
  },
  difficulty: {
    type: Number,
    min: 0,
    max: 1,
    required: true,
  },
  difficulty_level: {
    type: String,
    enum: ["easy", "medium", "hard", "very_hard"],
    required: true,
  },
  topic: {
    type: String,
    required: [true, "Topic is required"],
  },
  // subject: {
  //   type: String,
  //   required: [true, "Subject is required"],
  // },
  options: [questionOptionSchema],
  correct_answer: {
    type: String,
    required: true,
  },
  explanation: {
    type: String,
    default: "",
  },
  marks: {
    type: Number,
    default: 1,
  },
  expected_time: {
    type: Number,
    default: 60,
  },
  hints: [String],
  tags: [String],
  isActive: {
    type: Boolean,
    default: true,
  },
});

const courseQuestionBankSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: [true, "Course is required"],
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Teacher is required"],
    },
    subject: {
      type: String,
      required: [true, "Subject is required"],
    },
    topics: [
      {
        name: {
          type: String,
          required: true,
        },
        description: String,
        weightage: {
          type: Number,
          min: 0,
          max: 100,
          default: 0,
        },
        isActive: {
          type: Boolean,
          default: true,
        },
      },
    ],
    questions: [questionSchema],
    totalQuestions: {
      type: Number,
      default: 0,
    },
    metadata: {
      totalMarks: {
        type: Number,
        default: 0,
      },
      averageDifficulty: {
        type: Number,
        default: 0,
      },
      difficultyDistribution: {
        easy: { type: Number, default: 0 },
        medium: { type: Number, default: 0 },
        hard: { type: Number, default: 0 },
        very_hard: { type: Number, default: 0 },
      },
      topicDistribution: {
        type: Map,
        of: Number,
        default: {},
      },
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
courseQuestionBankSchema.index({ course: 1, subject: 1 });
courseQuestionBankSchema.index({ course: 1, teacher: 1 });
courseQuestionBankSchema.index({ "questions.questionId": 1 });
courseQuestionBankSchema.index({
  "questions.topic": 1,
  "questions.difficulty": 1,
});

// Pre-save middleware to update metadata
courseQuestionBankSchema.pre("save", function (next) {
  try {
    if (this.questions && this.questions.length > 0) {
      this.totalQuestions = this.questions.length;

      this.metadata.totalMarks = this.questions.reduce(
        (sum, q) => sum + (q.marks || 0),
        0,
      );

      this.metadata.averageDifficulty =
        this.questions.reduce((sum, q) => sum + (q.difficulty || 0), 0) /
        this.questions.length;

      this.metadata.difficultyDistribution = {
        easy: this.questions.filter((q) => q.difficulty_level === "easy")
          .length,
        medium: this.questions.filter((q) => q.difficulty_level === "medium")
          .length,
        hard: this.questions.filter((q) => q.difficulty_level === "hard")
          .length,
        very_hard: this.questions.filter(
          (q) => q.difficulty_level === "very_hard",
        ).length,
      };

      const topicDist = {};
      this.questions.forEach((q) => {
        topicDist[q.topic] = (topicDist[q.topic] || 0) + 1;
      });
      this.metadata.topicDistribution = topicDist;
    }

    if (typeof next === "function") {
      next();
    }
  } catch (error) {
    console.error("[QuestionAdaptation] Pre-save error:", error);
    if (typeof next === "function") {
      next(error);
    }
  }
});

// Methods
courseQuestionBankSchema.methods.addQuestions = function (newQuestions) {
  newQuestions.forEach((q) => {
    const exists = this.questions.find(
      (existing) => existing.questionId === q.questionId,
    );
    if (!exists) {
      this.questions.push(q);
    }
  });
  return this.save();
};

courseQuestionBankSchema.methods.updateQuestion = function (
  questionId,
  updateData,
) {
  const index = this.questions.findIndex((q) => q.questionId === questionId);
  if (index !== -1) {
    delete updateData.questionId;
    Object.assign(this.questions[index], updateData);
    return this.save();
  }
  throw new Error("Question not found");
};

courseQuestionBankSchema.methods.removeQuestion = function (questionId) {
  this.questions = this.questions.filter((q) => q.questionId !== questionId);
  return this.save();
};

courseQuestionBankSchema.methods.getQuestionsByTopic = function (
  topic,
  difficulty = null,
) {
  let filtered = this.questions.filter((q) => q.topic === topic && q.isActive);
  if (difficulty) {
    filtered = filtered.filter((q) => q.difficulty_level === difficulty);
  }
  return filtered;
};

courseQuestionBankSchema.methods.getAdaptiveQuestions = function (
  topic,
  currentDifficulty,
  count = 5,
) {
  const difficulties = ["easy", "medium", "hard", "very_hard"];
  const currentIndex = difficulties.indexOf(currentDifficulty);

  let selectedQuestions = [];
  let targetDifficulties = [];

  if (currentIndex > 0) targetDifficulties.push(difficulties[currentIndex - 1]);
  targetDifficulties.push(difficulties[currentIndex]);
  if (currentIndex < difficulties.length - 1)
    targetDifficulties.push(difficulties[currentIndex + 1]);

  targetDifficulties.forEach((diff) => {
    const questions = this.getQuestionsByTopic(topic, diff);
    const needed = Math.ceil(count / targetDifficulties.length);
    const shuffled = questions.sort(() => Math.random() - 0.5);
    selectedQuestions = [...selectedQuestions, ...shuffled.slice(0, needed)];
  });

  return selectedQuestions.slice(0, count);
};

const CourseQuestionBank = mongoose.model(
  "CourseQuestionBank",
  courseQuestionBankSchema,
);

module.exports = CourseQuestionBank;
