const User = require("../models/user");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { OAuth2Client } = require("google-auth-library");

// Initialize Google OAuth client
const googleClient = new OAuth2Client();

const getGoogleAudiences = () => {
  const audienceSet = new Set();

  if (process.env.GOOGLE_CLIENT_ID) {
    audienceSet.add(process.env.GOOGLE_CLIENT_ID.trim());
  }

  if (process.env.GOOGLE_CLIENT_IDS) {
    process.env.GOOGLE_CLIENT_IDS.split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .forEach((id) => audienceSet.add(id));
  }

  return Array.from(audienceSet);
};

// Helper function to send token in cookie
const sendTokenResponse = (user, statusCode, res) => {
  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE || "7d",
    },
  );

  const options = {
    httpOnly: true,
    expires: new Date(
      Date.now() + (process.env.JWT_COOKIE_EXPIRE || 7) * 24 * 60 * 60 * 1000,
    ),
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  };

  res.status(statusCode).cookie("token", token, options).json({
    success: true,
    token,
    user: user.getPublicProfile(),
  });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const finalRole = role?.toLowerCase() || "student";

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: "Name and email are required",
      });
    }

    // Validate role
    if (!["student", "teacher", "admin"].includes(finalRole)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Must be student, teacher, or admin",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    // Create user
    const userData = {
      name,
      email,
      role: finalRole,
      isVerified: finalRole === "student", // Students auto-verified, teachers need approval
    };

    // Add password only for students
    if (finalRole === "student") {
      if (!password) {
        return res.status(400).json({
          success: false,
          message: "Password is required for student registration",
        });
      }
      userData.password = password;
    }

    const user = await User.create(userData);

    res.status(201).json({
      success: true,
      message:
        finalRole === "student"
          ? "Registration successful"
          : "Registration successful. Please wait for admin verification.",
      user: user.getPublicProfile(),
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Error registering user",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // Find user and include password field
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check if user is verified (for teachers/admins)
    if (!user.isVerified && user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Account pending verification. Please contact admin.",
      });
    }

    // Check role if provided
    if (role && user.role !== role.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: `Invalid login portal. Please use ${user.role} login.`,
      });
    }

    // Verify password
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Send token response
    sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Error logging in",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Google login/register
// @route   POST /api/auth/google
// @access  Public
exports.googleLogin = async (req, res) => {
  try {
    const { tokenId, role = "student" } = req.body;
    const audiences = getGoogleAudiences();

    if (!tokenId) {
      return res.status(400).json({
        success: false,
        message: "Google token is required",
      });
    }

    if (typeof tokenId !== "string" || tokenId.split(".").length !== 3) {
      return res.status(400).json({
        success: false,
        message: "Invalid Google token format",
      });
    }

    if (!audiences.length) {
      return res.status(500).json({
        success: false,
        message: "Google auth is not configured on server",
      });
    }

    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: tokenId,
      audience: audiences,
    });

    const { email_verified, name, email, sub: googleId } = ticket.getPayload();

    if (!email_verified) {
      return res.status(400).json({
        success: false,
        message: "Google email not verified",
      });
    }

    // Check if user exists
    let user = await User.findOne({ $or: [{ email }, { googleId }] });

    if (user) {
      // Update Google ID if not present
      if (!user.googleId) {
        user.googleId = googleId;
        await user.save();
      }
    } else {
      // Create new user
      user = await User.create({
        name,
        email,
        googleId,
        role: role.toLowerCase(),
        isVerified: true, // Google accounts are pre-verified
        password: Math.random().toString(36).slice(-12),
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Send token response
    sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error("Google login error:", error);

    if (
      error.message?.includes("Wrong recipient") ||
      error.message?.includes("audience")
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid Google token audience. Ensure frontend and backend use the same Google Client ID.",
      });
    }

    if (error.message?.includes("Wrong number of segments in token")) {
      return res.status(400).json({
        success: false,
        message: "Invalid Google token format",
      });
    }

    res.status(500).json({
      success: false,
      message: "Error authenticating with Google",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
exports.logout = (req, res) => {
  res.cookie("token", "", {
    httpOnly: true,
    expires: new Date(0),
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      user: user.getPublicProfile(),
    });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user data",
    });
  }
};

// @desc    Update user role (Admin only)
// @route   PUT /api/auth/role
// @access  Private/Admin
exports.updateRole = async (req, res) => {
  try {
    const { role, userId } = req.body;

    if (!role || !userId) {
      return res.status(400).json({
        success: false,
        message: "Please provide role and userId",
      });
    }

    if (!["student", "teacher", "admin"].includes(role.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.role = role.toLowerCase();
    await user.save();

    res.json({
      success: true,
      message: "User role updated successfully",
      user: user.getPublicProfile(),
    });
  } catch (error) {
    console.error("Role update error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating user role",
    });
  }
};
