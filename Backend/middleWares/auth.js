const jwt = require("jsonwebtoken");
const User = require("../models/user");

const protectAsync = async (req, res, next) => {
  try {
    let token;

    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route",
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found",
        });
      }

      req.user = {
        id: user._id,
        role: user.role,
        studentId: user.studentId,
      };

      if (typeof next === "function") {
        next();
      } else {
        console.error("[Auth] next is not a function");
        return res.status(500).json({
          success: false,
          message: "Internal server error",
        });
      }
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }
  } catch (error) {
    console.error("[Auth] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error in authentication",
    });
  }
};

exports.protect = (req, res, next) => {
  try {
    return protectAsync(req, res, next).catch((err) => {
      console.error("[protect] Caught error:", err);
      if (typeof next === "function") {
        return next(err);
      }
      // Fallback response when next is not available
      try {
        return res.status(err && err.statusCode ? err.statusCode : 500).json({
          success: false,
          message: err && err.message ? err.message : "Authentication error",
        });
      } catch (resErr) {
        console.error("[protect] Cannot send fallback response:", resErr);
      }
    });
  } catch (err) {
    console.error("[protect] Sync error:", err);
    if (typeof next === "function") return next(err);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (typeof next !== "function") {
      console.error("[authorize] next is not a function:", typeof next);
      // Still perform checks and send responses directly
      if (!req.user || !req.user.role) {
        return res
          .status(401)
          .json({ success: false, message: "Not authorized" });
      }
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: `User role ${req.user.role} is not authorized to access this route`,
        });
      }
      return; // nothing further to call
    }

    if (!req.user || !req.user.role) {
      return res
        .status(401)
        .json({ success: false, message: "Not authorized" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`,
      });
    }

    try {
      next();
    } catch (err) {
      console.error("[authorize] Error when calling next():", err);
      try {
        return res
          .status(500)
          .json({ success: false, message: "Internal server error" });
      } catch (resErr) {
        console.error("[authorize] Cannot send fallback response:", resErr);
      }
    }
  };
};
