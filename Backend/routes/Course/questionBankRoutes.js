// routes/Course/questionBankRoutes.js
const express = require("express");
const router = express.Router({ mergeParams: true });

const {
  createQuestionBank,
  getQuestionBank,
  getQuestionBankTeacher,
  addQuestions,
  updateQuestion,
  deleteQuestion,
  updateTopics,
} = require("../../controllers/Course/questionBankController");

const { protect, authorize } = require("../../middleWares/auth");

// All routes require authentication
router.use(protect);

// Teacher routes - use the courseId from the parent route params
router.post("/", authorize("teacher", "admin"), createQuestionBank);
router.get("/teacher", authorize("teacher", "admin"), getQuestionBankTeacher);
router.post("/questions", authorize("teacher", "admin"), addQuestions);
router.put(
  "/questions/:questionId",
  authorize("teacher", "admin"),
  updateQuestion,
);
router.delete(
  "/questions/:questionId",
  authorize("teacher", "admin"),
  deleteQuestion,
);
router.put("/topics", authorize("teacher", "admin"), updateTopics);

// Student routes
router.get("/", authorize("student"), getQuestionBank);

module.exports = router;
