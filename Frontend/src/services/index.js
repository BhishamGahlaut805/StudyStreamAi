// Main service exports
export { default as authService } from "./authService";
export { default as testService } from "./testService";
export { default as flaskService } from "./flaskService";
export { default as analyticsService } from "./analyticsService";
export { default as studentService } from "./studentService";
export { default as questionService } from "./questionService";
export { default as websocketService } from "./webSockets";

// Utility exports
export { default as apiClient } from "./utils/apiClient";
export { default as errorHandler } from "./utils/errorHandler";
export * as formatters from "./utils/formatters";

// Initialize all services
export const initializeServices = () => {
  // Auth service auto-initializes
  // WebSocket service initializes on demand
  console.log("Services initialized");
};
