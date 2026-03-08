const express = require("express");
const router = express.Router();
const retentionMetricsController = require("../controllers/retentionMetricsController");
const { protect } = require("../middleWares/auth");

// All routes require authentication
router.use(protect);

// Get overall metrics
router.get("/overall/:studentId", retentionMetricsController.getOverallMetrics);

// Get topic-wise metrics
router.get("/topics/:studentId", retentionMetricsController.getTopicMetrics);

// Get daily trends
router.get("/trends/:studentId", retentionMetricsController.getDailyTrends);

// Get forgetting curves
router.get(
  "/forgetting-curves/:studentId",
  retentionMetricsController.getForgettingCurves,
);

// Get stress and fatigue patterns
router.get(
  "/stress-fatigue/:studentId",
  retentionMetricsController.getStressFatiguePatterns,
);

// Get learning path
router.get(
  "/learning-path/:studentId",
  retentionMetricsController.getLearningPath,
);

// Get recommendations
router.get(
  "/recommendations/:studentId",
  retentionMetricsController.getRecommendations,
);

module.exports = router;
