const express = require("express");
const router = express.Router();
const questionBankService = require("./questionBankService");
const { protect } = require("../middleWares/auth");

router.use(protect);

// Get all topics
router.get("/topics", (req, res) => {
  const topics = questionBankService.getAllTopics();
  res.json({
    success: true,
    topics,
  });
});

// Get topics by subject
router.get("/topics/:subject", (req, res) => {
  const { subject } = req.params;
  const topics = questionBankService.getTopicsBySubject(subject);
  res.json({
    success: true,
    subject,
    topics,
  });
});

// Get questions by subject
router.get("/:subject", (req, res) => {
  const { subject } = req.params;
  const { topic, minDifficulty = 0, maxDifficulty = 1, count = 10 } = req.query;

  const questions = questionBankService.getQuestions({
    subject,
    topic,
    minDifficulty: parseFloat(minDifficulty),
    maxDifficulty: parseFloat(maxDifficulty),
    count: parseInt(count),
  });

  res.json({
    success: true,
    subject,
    questions: questions.map((q) => ({
      id: q.questionId,
      text: q.text,
      type: q.type,
      difficulty: q.difficulty,
      difficultyLevel: q.difficultyLevel,
      options: q.type !== "NAT" ? q.options : undefined,
      topic: q.topic,
      marks: q.marks,
      expectedTime: q.expectedTime,
    })),
  });
});

// Get question by ID
router.get("/detail/:questionId", (req, res) => {
  const { questionId } = req.params;
  const question = questionBankService.getQuestionById(questionId);

  if (!question) {
    return res.status(404).json({
      success: false,
      error: "Question not found",
    });
  }

  res.json({
    success: true,
    question: {
      id: question.questionId,
      text: question.text,
      type: question.type,
      difficulty: question.difficulty,
      difficultyLevel: question.difficultyLevel,
      options: question.options,
      correctAnswer: question.correct_answer,
      explanation: question.explanation,
      solutionSteps: question.solutionSteps,
      topic: question.topic,
      marks: question.marks,
      expectedTime: question.expectedTime,
    },
  });
});

module.exports = router;
