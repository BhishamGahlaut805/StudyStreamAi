const express = require("express");
const router = express.Router();

const {
  createCourse,
  getCourses,
  getCourse,
  updateCourse,
  deleteCourse,
  // enrollInCourse,
  getTeacherCourses,
  getCourseStats,
} = require("../../controllers/Course/courseController");

const {
  getCourseCurriculum,
  addCurriculumChapter,
  addCurriculumLesson,
} = require("../../controllers/Course/curriculumController");

const { protect, authorize } = require("../../middleWares/auth");

// Public routes
router.get("/", getCourses);
router.get("/:id", getCourse);

// Protected routes
router.use(protect);

// Student routes
// router.post("/:id/enroll", authorize("student"), enrollInCourse);

// Teacher routes
router.get("/teacher/me", authorize("teacher", "admin"), getTeacherCourses);
router.post("/", authorize("teacher", "admin"), createCourse);
router.put("/:id", authorize("teacher", "admin"), updateCourse);
router.get("/:id/stats", authorize("teacher", "admin"), getCourseStats);

// Curriculum routes
router.get("/:id/curriculum", getCourseCurriculum);
router.post(
  "/:id/curriculum/chapters",
  authorize("teacher", "admin"),
  addCurriculumChapter,
);
router.post(
  "/:id/curriculum/chapters/:chapterId/lessons",
  authorize("teacher", "admin"),
  addCurriculumLesson,
);

// Admin only routes
router.delete("/:id", authorize("admin"), deleteCourse);

module.exports = router;
