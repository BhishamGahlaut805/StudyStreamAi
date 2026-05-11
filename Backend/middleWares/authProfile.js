const jwt = require("jsonwebtoken");
const ErrorResponse = require("../utils/ErrorResponse");
const User = require("../models/user");
const asyncHandler = require("../middleware/asyncHandler");

exports.protect = asyncHandler(async (req, res, next) => {
  let token;

  // Check both cookies and Authorization header
  if (req.cookies?.token) {
    token = req.cookies.token;
  } else if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    throw new ErrorResponse("Not authorized to access this route", 401);
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user still exists
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      throw new ErrorResponse("User no longer exists", 401);
    }

    req.user = user;
    return next();
  } catch (err) {
    console.error("JWT Error:", err.message);
    throw new ErrorResponse("Not authorized to access this route", 401);
  }
});

exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new ErrorResponse(
        `User role ${req.user?.role} is not authorized to access this route`,
        403,
      );
    }
    return next();
  };
};
