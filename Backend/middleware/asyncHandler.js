const asyncHandler = (fn) => {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      console.error("[asyncHandler] Caught error:", error);

      // Prevent multiple responses
      if (res.headersSent) {
        return next(error);
      }

      // Mongoose Validation Error
      if (error.name === "ValidationError") {
        const messages = Object.values(error.errors).map((err) => err.message);

        return res.status(400).json({
          success: false,
          error: messages.join(", "),
        });
      }

      // Duplicate Key Error
      if (error.code === 11000) {
        const field = Object.keys(error.keyValue || {})[0];

        return res.status(400).json({
          success: false,
          error: `${field} already exists`,
        });
      }

      // Invalid ObjectId
      if (error.name === "CastError") {
        return res.status(404).json({
          success: false,
          error: "Resource not found",
        });
      }

      // Custom ErrorResponse
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message,
        });
      }

      // JWT Errors
      if (error.name === "JsonWebTokenError") {
        return res.status(401).json({
          success: false,
          error: "Invalid token",
        });
      }

      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          error: "Token expired",
        });
      }

      // Default Server Error
      return res.status(500).json({
        success: false,
        error: error.message || "Server Error",
      });
    }
  };
};

module.exports = asyncHandler;
