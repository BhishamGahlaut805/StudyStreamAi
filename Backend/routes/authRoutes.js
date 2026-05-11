const express = require("express");
const router = express.Router();
const { protect } = require("../middleWares/auth");
const authController = require("../controllers/1_AuthController");

// Register
router.post("/register", authController.register);

// Login
router.post("/login", authController.login);

// Logout
router.post("/logout", authController.logout);

// Get current user
router.get("/me", protect, authController.getMe);

// Add this route to your existing authRoutes.js

/**
 * @route   POST /api/auth/google
 * @desc    Google login/register
 * @access  Public
 */
router.post("/google", async (req, res) => {
  try {
    const { tokenId, role = "student" } = req.body;

    // Forward to controller
    const authController = require("../controllers/1_AuthController");
    await authController.googleLogin(req, res);
  } catch (error) {
    console.error("Google login route error:", error);
    res.status(500).json({
      success: false,
      message: "Google login failed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;
