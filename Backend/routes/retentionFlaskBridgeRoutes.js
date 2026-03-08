const express = require("express");
const router = express.Router();
const bridge = require("../controllers/retentionFlaskBridgeController");

router.get("/health", bridge.health);
router.post("/initial-predictions", bridge.initialPredictions);
router.post("/retention-update", bridge.retentionUpdate);
router.post("/batch-complete", bridge.batchComplete);
router.post("/performance-metrics", bridge.performanceMetrics);
router.post("/schedule-update", bridge.scheduleUpdate);
router.post("/question-sequence", bridge.questionSequence);
router.post("/stress-fatigue-update", bridge.stressFatigueUpdate);

module.exports = router;
