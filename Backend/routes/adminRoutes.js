const express = require("express");
const router = express.Router();
const {
  getAllUsers,
  verifyUser,
  deleteUser,
  getAllCourses,
  getCourseSummary,
  getCourseAnalytics,
  getCourseStudents,
} = require("../controllers/adminController");
const { authMiddleware, adminOnly } = require("../middleware/adminMiddleWare");

router.get("/users", authMiddleware, adminOnly, getAllUsers);
router.post("/verify-user/:userId", authMiddleware, adminOnly, verifyUser);
router.delete("/delete-user/:userId", authMiddleware, adminOnly, deleteUser);
router.get("/courses/summary", authMiddleware, adminOnly, getCourseSummary);
router.get("/courses", authMiddleware, adminOnly, getAllCourses);
router.get(
  "/courses/:courseId/students",
  authMiddleware,
  adminOnly,
  getCourseStudents,
);
router.get("/courses/:courseId", authMiddleware, adminOnly, getCourseAnalytics);

module.exports = router;
