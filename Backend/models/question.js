const mongoose = require("mongoose");

const QuestionSchema = new mongoose.Schema({
  questionId: {
    type: String,
    required: true,
    unique: true,
  },
  subject: {
    type: String,
    enum: ["mathematics", "english", "reasoning", "general_knowledge"],
    required: true,
    index: true,
  },
  text: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ["MCQ", "MSQ", "NAT"],
    default: "MCQ",
  },
  difficulty: {
    type: Number,
    min: 0,
    max: 1,
    required: true,
    index: true,
  },
  difficultyLevel: {
    type: String,
    enum: ["very_easy", "easy", "medium", "hard", "very_hard"],
  },
  topic: {
    type: String,
    required: true,
    index: true,
  },
  subtopic: String,
  options: [
    {
      id: String,
      text: String,
    },
  ],
  correctAnswer: mongoose.Schema.Types.Mixed,
  explanation: String,
  solutionSteps: [String],
  marks: {
    type: Number,
    default: 1,
  },
  expectedTime: {
    type: Number,
    default: 60, // seconds
  },
  tags: [String],
  source: {
    type: String,
    enum: ["json", "generated", "uploaded"],
    default: "json",
  },
  usageCount: {
    type: Number,
    default: 0,
  },
  accuracyRate: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for efficient querying
QuestionSchema.index({ subject: 1, difficulty: 1 });
QuestionSchema.index({ topic: 1, difficulty: 1 });
QuestionSchema.index({ subject: 1, topic: 1 });

module.exports = mongoose.model("Question", QuestionSchema);
