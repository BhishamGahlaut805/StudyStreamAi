const express = require("express");
const router = express.Router();
const questionRepetitionController = require("../controllers/questionRepetitionController");
const { protect } = require("../middleWares/auth");

// All routes require authentication
router.use(protect);

// Get repetition schedule for a question
router.get(
  "/:studentId/:questionId",
  questionRepetitionController.getQuestionRepetition,
);

// Get all repetitions for a student
router.get(
  "/student/:studentId",
  questionRepetitionController.getStudentRepetitions,
);

// Get due questions
router.get("/due/:studentId", questionRepetitionController.getDueQuestions);

// Update from Flask
router.post(
  "/update-from-flask/:studentId",
  questionRepetitionController.updateFromFlask,
);

// Manually schedule a question
router.post(
  "/schedule/:studentId",
  questionRepetitionController.scheduleQuestion,
);

// Get repetition statistics
router.get(
  "/stats/:studentId",
  questionRepetitionController.getRepetitionStats,
);

module.exports = router;

