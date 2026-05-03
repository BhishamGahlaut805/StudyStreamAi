const express = require("express");
const router = express.Router();
const {
  enrollInCourse,
  getEnrolledCourses,
  getCourseLearningContent,
  completeLesson,
  submitQuiz,
  submitAssignment,
  getCourseProgress,
  getLearningStats,
} = require("../../controllers/Student/studentController");

const { protect, authorize } = require("../../middleWares/auth");

// All routes require authentication and student role
router.use(protect);
router.use(authorize("student"));

// Enrollment routes
router.post("/enroll/:courseId", enrollInCourse);
router.get("/courses", getEnrolledCourses);
router.get("/stats", getLearningStats);

// Learning routes
router.get("/course/:courseId/learn", getCourseLearningContent);
router.get("/course/:courseId/progress", getCourseProgress);
router.post("/course/:courseId/lesson/:lessonId/complete", completeLesson);
router.post("/course/:courseId/quiz/:quizId/submit", submitQuiz);
router.post(
  "/course/:courseId/assignment/:assignmentId/submit",
  submitAssignment,
);

module.exports = router;
