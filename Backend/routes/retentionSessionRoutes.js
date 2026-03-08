const express = require("express");
const router = express.Router();
const retentionSessionController = require("../controllers/retentionSessionController");
const { protect } = require("../middleWares/auth");

// All routes require authentication
router.use(protect);

// Create new retention session
router.post("/", retentionSessionController.createSession);

// Get all sessions for a student
router.get(
  "/student/:studentId",
  retentionSessionController.getStudentSessions,
);

// Get session by ID
router.get("/:sessionId", retentionSessionController.getSession);

// Persist UI/session snapshot for refresh-safe recovery
router.put("/:sessionId/state", retentionSessionController.saveSessionUiState);

// Get next question
router.get("/:sessionId/next", retentionSessionController.getNextQuestion);

// Submit answer
router.post("/:sessionId/submit", retentionSessionController.submitAnswer);

// Complete session
router.post("/:sessionId/complete", retentionSessionController.completeSession);

// Get session summary
router.get("/:sessionId/summary", retentionSessionController.getSessionSummary);

module.exports = router;
