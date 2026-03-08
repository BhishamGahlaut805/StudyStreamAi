// routes/studentRoutes.js
const express = require("express");
const router = express.Router();
const studentController = require("../controllers/studentController");
const { protect } = require("../middleWares/auth");

// All routes require authentication
router.use(protect);

// ==================== Core Performance Routes ====================

/**
 * Get student performance summary
 * GET /api/students/:studentId/performance
 */
router.get("/:studentId/performance", studentController.getStudentPerformance);

/**
 * Get performance trends
 * GET /api/students/:studentId/trends?period=weekly
 */
router.get("/:studentId/trends", studentController.getPerformanceTrends);

/**
 * Get topic-wise performance
 * GET /api/students/:studentId/topics?sortBy=accuracy&limit=20
 */
router.get("/:studentId/topics", studentController.getTopicPerformance);

/**
 * Get student insights
 * GET /api/students/:studentId/insights
 */
router.get("/:studentId/insights", studentController.getStudentInsights);

/**
 * Get test history
 * GET /api/students/:studentId/history?limit=20&page=1&testType=practice
 */
router.get("/:studentId/history", studentController.getTestHistory);

/**
 * Get specific test details
 * GET /api/students/test/:sessionId
 */
router.get("/test/:sessionId", studentController.getTestDetails);

// ==================== Topic Analysis Routes ====================

/**
 * Get weak topics
 * GET /api/students/:studentId/weak-topics?minQuestions=5&threshold=50
 */
router.get("/:studentId/weak-topics", studentController.getWeakTopics);

/**
 * Get strong topics
 * GET /api/students/:studentId/strong-topics?minQuestions=5&threshold=75
 */
router.get("/:studentId/strong-topics", studentController.getStrongTopics);

// ==================== Learning & Recommendations Routes ====================

/**
 * Get learning recommendations
 * GET /api/students/:studentId/recommendations
 */
router.get("/:studentId/recommendations", studentController.getRecommendations);

/**
 * Get personalized learning path
 * GET /api/students/:studentId/learning-path
 */
router.get("/:studentId/learning-path", studentController.getLearningPath);

// ==================== Comparison Routes ====================

/**
 * Get peer comparison (if data available)
 * GET /api/students/:studentId/compare
 */
router.get("/:studentId/compare", studentController.getPeerComparison);

// ==================== Settings Routes ====================

/**
 * Update student settings
 * PUT /api/students/:studentId/settings
 */
router.put("/:studentId/settings", studentController.updateSettings);

module.exports = router;
