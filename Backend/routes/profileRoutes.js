const express = require("express");
const router = express.Router();
const {
  getMyProfile,
  getProfileByUserId,
  updateProfile,
  uploadProfilePhoto,
  deleteProfilePhoto,
  getPublicProfile,
  updateVerificationStatus,
  getAllTeachers,
  addAchievement,
  deleteAchievement,
  addCertification,
  deleteCertification,
  updateRating,
} = require("../controllers/profileController");
const { protect, authorize } = require("../middleWares/auth");

/**
 * Profile Routes
 * Base URL: /api/profile
 */

// Get current user profile
router.get("/me", protect, getMyProfile);

// Update current user profile
router.put("/", protect, updateProfile);

// Upload profile photo
router.post("/photo", protect, uploadProfilePhoto);

// Delete profile photo
router.delete("/delete/photo", protect, deleteProfilePhoto);

// Get all teachers (public route for browsing)
router.get("/teachers/browse", getAllTeachers);

// Get public profile by user ID
router.get("/public/:userId", getPublicProfile);

// Get profile by user ID (admin or self)
router.get("/user/:userId", protect, getProfileByUserId);

// Add achievement
router.post(
  "/achievement",
  protect,
  authorize("teacher", "admin"),
  addAchievement,
);

// Delete achievement
router.delete(
  "/achievement/:achievementId",
  protect,
  authorize("teacher", "admin"),
  deleteAchievement,
);

// Add certification
router.post(
  "/certification",
  protect,
  authorize("teacher", "admin"),
  addCertification,
);

// Delete certification
router.delete(
  "/certification/:certId",
  protect,
  authorize("teacher", "admin"),
  deleteCertification,
);

// Update verification status (admin only)
router.put("/verify", protect, authorize("admin"), updateVerificationStatus);

// Update rating (internal/admin route)
router.put("/rating", protect, authorize("admin"), updateRating);

module.exports = router;
