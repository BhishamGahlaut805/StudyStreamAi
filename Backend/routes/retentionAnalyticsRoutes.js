const express = require("express");
const router = express.Router();
const retentionAnalyticsController = require("../controllers/retentionAnalyticsController");
const { protect } = require("../middleWares/auth");

router.use(protect);

router.get(
  "/session/:sessionId",
  retentionAnalyticsController.getSessionAnalytics,
);
router.post(
  "/session/:sessionId/sync",
  retentionAnalyticsController.syncSessionAnalytics,
);

module.exports = router;
