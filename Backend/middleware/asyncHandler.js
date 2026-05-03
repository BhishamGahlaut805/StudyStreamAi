// middleWare/asyncHandler.js
const asyncHandler = (fn) => {
  return (req, res, next) => {
    // Ensure next is always a function
    const safeNext =
      typeof next === "function"
        ? next
        : (err) => {
            console.error(
              "[asyncHandler] next is not a function, cannot forward error:",
              err?.message,
            );
          };

    Promise.resolve(fn(req, res, safeNext)).catch((error) => {
      console.error("[asyncHandler] Caught error:", error?.message || error);

      // If headers already sent, don't try to send again
      if (res.headersSent) {
        console.error(
          "[asyncHandler] Headers already sent, cannot send error response",
        );
        return;
      }

      // Handle mongoose validation errors
      if (error.name === "ValidationError") {
        const messages = Object.values(error.errors).map((err) => err.message);
        return res.status(400).json({
          success: false,
          error: messages.join(", "),
        });
      }

      // Handle mongoose duplicate key errors
      if (error.code === 11000) {
        const field = Object.keys(error.keyValue || {})[0] || "field";
        return res.status(400).json({
          success: false,
          error: `Duplicate value for ${field}. This ${field} already exists.`,
        });
      }

      // Handle cast errors (invalid ObjectId)
      if (error.name === "CastError") {
        return res.status(404).json({
          success: false,
          error: "Resource not found",
        });
      }

      // Handle ErrorResponse custom errors
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message,
        });
      }

      // Handle "next is not a function" error gracefully
      if (
        error.message === "next is not a function" ||
        error.message?.includes("next is not a function")
      ) {
        return res.status(500).json({
          success: false,
          error: "Internal server error - middleware chain issue",
        });
      }

      // Default error response
      const statusCode = error.statusCode || error.status || 500;
      const message = error.message || "Server Error";

      console.error("[asyncHandler] Sending error response:", {
        statusCode,
        message,
      });

      return res.status(statusCode).json({
        success: false,
        error: message,
      });
    });
  };
};

module.exports = asyncHandler;
