// routes/Student/practiceRoutes.js
const express = require("express");
const router = express.Router();

const {
  getPracticeQuestions,
} = require("../../controllers/Course/questionBankController");

const { protect, authorize } = require("../../middleWares/auth");

router.use(protect);
router.use(authorize("student"));

router.get("/course/:courseId/practice", getPracticeQuestions);

module.exports = router;
