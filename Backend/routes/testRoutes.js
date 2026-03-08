const express = require("express");
const router = express.Router();
const testController = require("../controllers/testController");
const { protect } = require("../middleWares/auth");

router.use(protect);

// Test creation & management
router.post("/", testController.createTest);
router.get("/:sessionId", testController.getTestSession);
router.delete("/:sessionId", testController.deleteTest);

// Student's tests
router.get("/student/:studentId", testController.getStudentTests);

// Questions management
router.get("/:sessionId/questions", testController.getQuestions);
router.post("/:sessionId/next-batch", testController.getNextQuestionBatch);

// Test results & analysis
router.get("/:sessionId/summary", testController.getTestSummary);

// Add these routes to testRoutes.js

// Generate question paper
router.get('/:sessionId/question-paper', testController.generateQuestionPaper);

// Export as PDF (JSON format)
router.get('/:sessionId/export/pdf', testController.exportTestPDF);

// Get topic-wise time analysis
router.get('/:sessionId/topic-time-analysis', testController.getTopicTimeAnalysis);

module.exports = router;
