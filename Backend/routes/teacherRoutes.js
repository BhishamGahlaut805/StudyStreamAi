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

const {
  getTeacherStudents,
  getCourseStudentsPerformance,
  getStudentPerformanceDetail,
  gradeAssignment,
  getTeacherDashboard1,
} = require("../controllers/teacher/teacherPerformanceController");

1
// All routes require authentication and teacher/admin role
router.use(protect);
router.use(authorize("teacher", "admin"));

// Dashboard and overview
router.get("/dashboard", getTeacherDashboard1);
router.get("/students", getTeacherStudents);

// Course-specific student performance
router.get("/course/:courseId/students", getCourseStudentsPerformance);
router.get("/student/:studentId/course/:courseId", getStudentPerformanceDetail);

// Assignment grading
router.put("/assignment/:assignmentId/grade/:enrollmentId", gradeAssignment);
// Add this before module.exports
router.get("/dashboard/students", protect, authorize("teacher", "admin"),getStudentsForAnalytics);

module.exports = router;
