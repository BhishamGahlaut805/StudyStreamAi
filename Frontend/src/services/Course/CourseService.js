// services/courseService.js
import axios from "axios";

const API_URL = `${import.meta.env.VITE_API_URL}/courses`;

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Request Interceptor
api.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem("token") ||
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
  (response) => {
    // Return the full response data structure
    return response.data;
  },
  (error) => {
    const errMsg =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      "Something went wrong";

    console.error("API Error:", {
      status: error.response?.status,
      message: errMsg,
      data: error.response?.data,
    });

    return Promise.reject({
      success: false,
      message: errMsg,
      error: errMsg,
      status: error.response?.status || 500,
      errors: error.response?.data?.errors || [],
    });
  },
);

const courseService = {
  // Course CRUD operations
  createCourse: async (courseData) => {
    const isFormData = courseData instanceof FormData;
    const headers = isFormData
      ? { "Content-Type": "multipart/form-data" }
      : { "Content-Type": "application/json" };

    try {
      const response = await api.post("/", courseData, { headers });
      return response;
    } catch (error) {
      console.error("Course creation error:", error);
      throw error;
    }
  },

  getCourses: async (params = {}) => {
    return await api.get("/", {
      params,
      headers: { "Content-Type": "application/json" },
    });
  },

  getCourse: async (id) => {
    return await api.get(`/${id}`, {
      headers: { "Content-Type": "application/json" },
    });
  },

  updateCourse: async (id, courseData) => {
    const isFormData = courseData instanceof FormData;
    const headers = isFormData
      ? { "Content-Type": "multipart/form-data" }
      : { "Content-Type": "application/json" };

    try {
      return await api.put(`/${id}`, courseData, { headers });
    } catch (error) {
      console.error("Course update error:", error);
      throw error;
    }
  },

  deleteCourse: async (id) => {
    return await api.delete(`/${id}`, {
      headers: { "Content-Type": "application/json" },
    });
  },

  // Teacher specific operations
  getTeacherCourses: async () => {
    return await api.get("/teacher/me", {
      headers: { "Content-Type": "application/json" },
    });
  },

  getCourseStats: async (courseId) => {
    return await api.get(`/${courseId}/stats`, {
      headers: { "Content-Type": "application/json" },
    });
  },

  // Enrollment operations
  enrollInCourse: async (courseId) => {
    return await api.post(
      `/${courseId}/enroll`,
      {},
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  },

  unenrollFromCourse: async (courseId) => {
    return await api.post(
      `/${courseId}/unenroll`,
      {},
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  },

  getEnrollmentStats: async (courseId) => {
    return await api.get(`/${courseId}/enrollment-stats`, {
      headers: { "Content-Type": "application/json" },
    });
  },

  updateEnrollmentCapacity: async (courseId, maxEnrollments) => {
    return await api.put(
      `/${courseId}/enrollment-capacity`,
      { maxEnrollments },
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  },

  // Course search
  searchCourses: async (query) => {
    return await api.get("/search", {
      params: { q: query },
      headers: { "Content-Type": "application/json" },
    });
  },

  // Assignment operations
  getAssignments: async (courseId) => {
    return await api.get(`/${courseId}/assignments`, {
      headers: { "Content-Type": "application/json" },
    });
  },

  createAssignment: async (courseId, assignmentData) => {
    const isFormData = assignmentData instanceof FormData;
    const headers = isFormData
      ? { "Content-Type": "multipart/form-data" }
      : { "Content-Type": "application/json" };

    return await api.post(`/${courseId}/assignments`, assignmentData, {
      headers,
    });
  },

  getAssignment: async (assignmentId) => {
    return await api.get(`/assignments/${assignmentId}`, {
      headers: { "Content-Type": "application/json" },
    });
  },

  updateAssignment: async (assignmentId, assignmentData) => {
    const isFormData = assignmentData instanceof FormData;
    const headers = isFormData
      ? { "Content-Type": "multipart/form-data" }
      : { "Content-Type": "application/json" };

    return await api.put(`/assignments/${assignmentId}`, assignmentData, {
      headers,
    });
  },

  deleteAssignment: async (assignmentId) => {
    return await api.delete(`/assignments/${assignmentId}`, {
      headers: { "Content-Type": "application/json" },
    });
  },

  submitAssignment: async (assignmentId, submissionData) => {
    const isFormData = submissionData instanceof FormData;
    const headers = isFormData
      ? { "Content-Type": "multipart/form-data" }
      : { "Content-Type": "application/json" };

    return await api.post(
      `/assignments/${assignmentId}/submit`,
      submissionData,
      { headers },
    );
  },

  gradeAssignment: async (assignmentId, submissionId, gradeData) => {
    return await api.put(
      `/assignments/${assignmentId}/grade/${submissionId}`,
      gradeData,
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  },

  // Doubt operations
  getDoubts: async (courseId) => {
    return await api.get(`/${courseId}/doubts`, {
      headers: { "Content-Type": "application/json" },
    });
  },

  getDoubt: async (doubtId) => {
    return await api.get(`/doubts/${doubtId}`, {
      headers: { "Content-Type": "application/json" },
    });
  },

  createDoubt: async (courseId, doubtData) => {
    return await api.post(`/${courseId}/doubts`, doubtData, {
      headers: { "Content-Type": "application/json" },
    });
  },

  resolveDoubt: async (doubtId) => {
    return await api.put(
      `/doubts/${doubtId}/resolve`,
      {},
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  },

  addComment: async (doubtId, commentData) => {
    return await api.post(`/doubts/${doubtId}/comments`, commentData, {
      headers: { "Content-Type": "application/json" },
    });
  },

  // Question Bank operations
  getQuestionBank: async (courseId) => {
    return await api.get(`/${courseId}/question-bank`, {
      headers: { "Content-Type": "application/json" },
    });
  },

  getQuestionBankTeacher: async (courseId) => {
    return await api.get(`/${courseId}/question-bank/teacher`, {
      headers: { "Content-Type": "application/json" },
    });
  },
};

export default courseService;
