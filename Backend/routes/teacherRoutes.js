const express = require("express");
const router = express.Router();
const {
  getStudentsInMyCourses,
  getStudentsByCourse,
  addStudentsToCourse,
  removeStudentsFromCourse,
  getCourseEnrollmentStats,
  updateEnrollmentCapacity,
  getTeacherDashboard,
  getTeacherCourses,
  getStudentPerformanceInCourse,
  getStudentsForAnalytics,
  // Advanced Analytics Routes
  getStudentPerformanceAnalytics,
  getLearningVelocityAnalytics,
  getRetentionAnalytics,
  getBurnoutRiskAnalytics,
  getTopicMasteryAnalytics,
  getClassComparativeAnalytics,
  getPerformanceTrendsAnalytics,
  getErrorPatternAnalytics,
  getTimeSpentAnalytics,
  getWeakStudentsAnalytics,
  getAdvancedStudentsAnalytics,
  getInterventionAlerts,
  getStudentDeepProfileAnalytics,
  getClassDashboardAnalytics,
  getPredictiveRecommendations,
} = require("../controllers/teacherController");
const { protect, authorize } = require("../middleWares/auth");

/**
 * Teacher Routes
 * Base URL: /api/teachers
 * All routes require teacher/admin authorization
 */

// Get teacher dashboard data
router.get(
  "/dashboard",
  protect,
  authorize("teacher", "admin"),
  getTeacherDashboard,
);

// Get all courses taught by the teacher
router.get(
  "/courses",
  protect,
  authorize("teacher", "admin"),
  getTeacherCourses,
);

// Get all students in teacher's courses
router.get(
  "/my-students",
  protect,
  authorize("teacher", "admin"),
  getStudentsInMyCourses,
);

// Get students in a specific course
router.get(
  "/courses/:courseId/students",
  protect,
  authorize("teacher", "admin"),
  getStudentsByCourse,
);

// Get students in a specific course (alternative endpoint for frontend compatibility)
router.get(
  "/:courseId/students",
  protect,
  authorize("teacher", "admin"),
  getStudentsByCourse,
);

// Get enrollment statistics for a course
router.get(
  "/courses/:courseId/enrollment-stats",
  protect,
  authorize("teacher", "admin"),
  getCourseEnrollmentStats,
);

// Get student performance in a course
router.get(
  "/courses/:courseId/student-performance",
  protect,
  authorize("teacher", "admin"),
  getStudentPerformanceInCourse,
);

// Add students to a course
router.post(
  "/:courseId/add-student",
  protect,
  authorize("teacher", "admin"),
  addStudentsToCourse,
);

// Remove students from a course
router.post(
  "/:courseId/remove-student",
  protect,
  authorize("teacher", "admin"),
  removeStudentsFromCourse,
);

// Update enrollment capacity for a course
router.put(
  "/courses/:courseId/enrollment-capacity",
  protect,
  authorize("teacher", "admin"),
  updateEnrollmentCapacity,
);

// Alternative endpoint for enrollment capacity update (for frontend compatibility)
router.put(
  "/:courseId/enrollment-capacity",
  protect,
  authorize("teacher", "admin"),
  updateEnrollmentCapacity,
);

/**
 * =========================================
 * ADVANCED ANALYTICS ROUTES (15 routes)
 * =========================================
 */

// 1. Student Performance Analytics - Detailed performance with trends
router.get(
  "/analytics/student-performance/:studentId",
  protect,
  authorize("teacher", "admin"),
  getStudentPerformanceAnalytics,
);

// 2. Learning Velocity Analysis - Progress tracking over time
router.get(
  "/analytics/learning-velocity/:studentId",
  protect,
  authorize("teacher", "admin"),
  getLearningVelocityAnalytics,
);

// 3. Retention Analytics - Retention scores and forgetting patterns
router.get(
  "/analytics/retention/:studentId",
  protect,
  authorize("teacher", "admin"),
  getRetentionAnalytics,
);

// 4. Burnout Risk Assessment - Identify at-risk students
router.get(
  "/analytics/burnout-risk/:studentId",
  protect,
  authorize("teacher", "admin"),
  getBurnoutRiskAnalytics,
);

// 5. Topic Mastery Breakdown - Detailed topic-wise analysis
router.get(
  "/analytics/topic-mastery/:studentId",
  protect,
  authorize("teacher", "admin"),
  getTopicMasteryAnalytics,
);

// 6. Class-wide Comparative Analysis - Compare all students
router.get(
  "/analytics/class-comparative/:courseId",
  protect,
  authorize("teacher", "admin"),
  getClassComparativeAnalytics,
);

// 7. Weekly/Monthly Performance Trends
router.get(
  "/analytics/performance-trends/:studentId",
  protect,
  authorize("teacher", "admin"),
  getPerformanceTrendsAnalytics,
);

// 8. Error Pattern Analysis - Conceptual vs careless mistakes
router.get(
  "/analytics/error-patterns/:studentId",
  protect,
  authorize("teacher", "admin"),
  getErrorPatternAnalytics,
);

// 9. Time Spent Analysis - Engagement and study patterns
router.get(
  "/analytics/time-spent/:studentId",
  protect,
  authorize("teacher", "admin"),
  getTimeSpentAnalytics,
);

// 10. Weak Students Identification - Needs intervention
router.get(
  "/analytics/weak-students/:courseId",
  protect,
  authorize("teacher", "admin"),
  getWeakStudentsAnalytics,
);

// 11. Advanced Students Identification - High performers
router.get(
  "/analytics/advanced-students/:courseId",
  protect,
  authorize("teacher", "admin"),
  getAdvancedStudentsAnalytics,
);

// 12. Intervention Alerts - Real-time alerts for at-risk
router.get(
  "/analytics/intervention-alerts/:courseId",
  protect,
  authorize("teacher", "admin"),
  getInterventionAlerts,
);

// 13. Individual Student Deep Analytics
router.get(
  "/analytics/student-deep-profile/:studentId",
  protect,
  authorize("teacher", "admin"),
  getStudentDeepProfileAnalytics,
);

// 14. Class Performance Dashboard Data
router.get(
  "/analytics/class-dashboard/:courseId",
  protect,
  authorize("teacher", "admin"),
  getClassDashboardAnalytics,
);

// 15. Predictive Recommendations - AI-driven suggestions
router.get(
  "/analytics/recommendations/:studentId",
  protect,
  authorize("teacher", "admin"),
  getPredictiveRecommendations,
);

const {
  getTeacherStudents,
  getCourseStudentsPerformance,
  getStudentPerformanceDetail,
  gradeAssignment,
  getTeacherDashboard1,
} = require("../controllers/teacher/teacherPerformanceController");

// All routes require authentication and teacher/admin role
router.use(protect);
router.use(authorize("teacher", "admin"));

// Dashboard and overview - Use refactored getTeacherDashboard with analytics
// router.get("/dashboard", getTeacherDashboard1); // Old version - replaced
router.get("/students", getTeacherStudents);

// Course-specific student performance
router.get("/course/:courseId/students", getCourseStudentsPerformance);
router.get("/student/:studentId/course/:courseId", getStudentPerformanceDetail);

// Assignment grading
router.put("/assignment/:assignmentId/grade/:enrollmentId", gradeAssignment);

// Add this before module.exports
router.get(
  "/dashboard/students",
  protect,
  authorize("teacher", "admin"),
  getStudentsForAnalytics,
);

module.exports = router;
