// services/TeacherService.js
import axios from "axios";
import Cookies from "js-cookie";

const API_URL = `${import.meta.env.VITE_API_URL}/teachers`;

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Request Interceptor
api.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem("token") ||
      Cookies.get("token") ||
      document.cookie
        .split("; ")
        .find((row) => row.startsWith("token="))
        ?.split("=")[1];

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response Interceptor
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      Cookies.remove("token");
      localStorage.removeItem("token");
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      localStorage.removeItem("userId");

      if (!window.location.pathname.includes("/auth")) {
        window.location.href = "/auth";
      }
    }

    const errMsg =
      error.response?.data?.message || error.message || "Something went wrong";
    return Promise.reject({
      success: false,
      message: errMsg,
      status: error.response?.status || 500,
      errors: error.response?.data?.errors || [],
    });
  },
);

const teacherService = {
  // Dashboard operations
  getTeacherDashboard: async () => {
    return await api.get("/dashboard");
  },

  // Advanced analytics overview operations
  getStudentsForAnalytics: async () => {
    return await api.get("/dashboard/students");
  },

  getStudentPerformanceAnalytics: async (studentId) => {
    return await api.get(`/analytics/student-performance/${studentId}`);
  },

  getLearningVelocityAnalytics: async (studentId) => {
    return await api.get(`/analytics/learning-velocity/${studentId}`);
  },

  getRetentionAnalytics: async (studentId) => {
    return await api.get(`/analytics/retention/${studentId}`);
  },

  getBurnoutRiskAnalytics: async (studentId) => {
    return await api.get(`/analytics/burnout-risk/${studentId}`);
  },

  getTopicMasteryAnalytics: async (studentId) => {
    return await api.get(`/analytics/topic-mastery/${studentId}`);
  },

  getClassComparativeAnalytics: async (courseId) => {
    return await api.get(`/analytics/class-comparative/${courseId}`);
  },

  getPerformanceTrendsAnalytics: async (studentId, timeframe = "monthly") => {
    return await api.get(
      `/analytics/performance-trends/${studentId}?timeframe=${timeframe}`,
    );
  },

  getErrorPatternAnalytics: async (studentId) => {
    return await api.get(`/analytics/error-patterns/${studentId}`);
  },

  getTimeSpentAnalytics: async (studentId) => {
    return await api.get(`/analytics/time-spent/${studentId}`);
  },

  getWeakStudentsAnalytics: async (courseId, threshold = 60) => {
    return await api.get(
      `/analytics/weak-students/${courseId}?threshold=${threshold}`,
    );
  },

  getAdvancedStudentsAnalytics: async (courseId, threshold = 85) => {
    return await api.get(
      `/analytics/advanced-students/${courseId}?threshold=${threshold}`,
    );
  },

  getInterventionAlerts: async (courseId) => {
    return await api.get(`/analytics/intervention-alerts/${courseId}`);
  },

  getStudentDeepProfileAnalytics: async (studentId) => {
    return await api.get(`/analytics/student-deep-profile/${studentId}`);
  },

  getClassDashboardAnalytics: async (courseId) => {
    return await api.get(`/analytics/class-dashboard/${courseId}`);
  },

  getPredictiveRecommendations: async (studentId) => {
    return await api.get(`/analytics/recommendations/${studentId}`);
  },

  // Course operations
  getTeacherCourses: async () => {
    return await api.get("/courses");
  },

  // Student operations
  getStudentsInMyCourses: async () => {
    return await api.get("/my-students");
  },

  getStudentsByCourse: async (courseId) => {
    return await api.get(`/courses/${courseId}/students`);
  },

  addStudentsToCourse: async (courseId, studentIds) => {
    return await api.post(`/${courseId}/add-student`, { studentIds });
  },

  removeStudentsFromCourse: async (courseId, studentIds) => {
    return await api.post(`/${courseId}/remove-student`, { studentIds });
  },

  // Enrollment statistics
  getCourseEnrollmentStats: async (courseId) => {
    return await api.get(`/courses/${courseId}/enrollment-stats`);
  },

  // Student performance
  getStudentPerformanceInCourse: async (courseId) => {
    return await api.get(`/courses/${courseId}/student-performance`);
  },

  // Enrollment capacity management
  updateEnrollmentCapacity: async (courseId, maxEnrollments) => {
    return await api.put(`/courses/${courseId}/enrollment-capacity`, {
      maxEnrollments,
    });
  },
};

export default teacherService;
