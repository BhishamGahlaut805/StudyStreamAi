const express = require("express");
const router = express.Router();
const retentionScheduleController = require("../controllers/retentionScheduleController");
const { protect } = require("../middleWares/auth");

// All routes require authentication
router.use(protect);

// Generate new schedule
router.post("/generate/:studentId", retentionScheduleController.generateSchedule);

// Get current schedule
router.get("/current/:studentId", retentionScheduleController.getCurrentSchedule);

// Get schedule for specific date
router.get("/date/:studentId", retentionScheduleController.getScheduleForDate);

// Update schedule based on performance
router.put("/update/:studentId", retentionScheduleController.updateSchedule);

// Mark question as completed
router.post("/complete/:studentId", retentionScheduleController.completeQuestion);

// Get next scheduled questions
router.get("/next/:studentId", retentionScheduleController.getNextQuestions);

module.exports = router;
