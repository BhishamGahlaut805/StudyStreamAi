import axios from "axios";

const API_URL = `${import.meta.env.VITE_API_URL}`;

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

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

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const errMsg =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      "Something went wrong";
    return Promise.reject({
      success: false,
      message: errMsg,
      error: errMsg,
      status: error.response?.status || 500,
    });
  },
);

const enrollmentService = {
  // Student operations
  enrollInCourse: async (courseId, paymentDetails = {}) => {
    return await api.post(`/studentLearn/enroll/${courseId}`, paymentDetails, {
      headers: { "Content-Type": "application/json" },
    });
  },

  getEnrolledCourses: async () => {
    return await api.get("/studentLearn/courses", {
      headers: { "Content-Type": "application/json" },
    });
  },

  getCourseLearningContent: async (courseId) => {
    return await api.get(`/studentLearn/course/${courseId}/learn`, {
      headers: { "Content-Type": "application/json" },
    });
  },

  completeLesson: async (courseId, lessonId, chapterId, timeSpent = 0) => {
    return await api.post(
      `/studentLearn/course/${courseId}/lesson/${lessonId}/complete`,
      { chapterId, timeSpent },
      { headers: { "Content-Type": "application/json" } },
    );
  },

  submitQuiz: async (courseId, quizId, chapterId, score, answers) => {
    return await api.post(
      `/studentLearn/course/${courseId}/quiz/${quizId}/submit`,
      { chapterId, score, answers },
      { headers: { "Content-Type": "application/json" } },
    );
  },

  submitAssignment: async (
    courseId,
    assignmentId,
    chapterId,
    submissionUrl,
  ) => {
    return await api.post(
      `/studentLearn/course/${courseId}/assignment/${assignmentId}/submit`,
      { chapterId, submissionUrl },
      { headers: { "Content-Type": "application/json" } },
    );
  },

  getCourseProgress: async (courseId) => {
    return await api.get(`/studentLearn/course/${courseId}/progress`, {
      headers: { "Content-Type": "application/json" },
    });
  },

  getLearningStats: async () => {
    return await api.get("/studentLearn/stats", {
      headers: { "Content-Type": "application/json" },
    });
  },

  // Teacher operations
  getTeacherDashboard: async () => {
    return await api.get("/teacher/dashboard", {
      headers: { "Content-Type": "application/json" },
    });
  },

  getTeacherStudents: async () => {
    return await api.get("/teacher/students", {
      headers: { "Content-Type": "application/json" },
    });
  },

  getCourseStudentsPerformance: async (courseId) => {
    return await api.get(`/teacher/course/${courseId}/students`, {
      headers: { "Content-Type": "application/json" },
    });
  },

  getStudentPerformanceDetail: async (studentId, courseId) => {
    return await api.get(`/teacher/student/${studentId}/course/${courseId}`, {
      headers: { "Content-Type": "application/json" },
    });
  },

  gradeAssignment: async (assignmentId, enrollmentId, score, feedback) => {
    return await api.put(
      `/teacher/assignment/${assignmentId}/grade/${enrollmentId}`,
      { score, feedback },
      { headers: { "Content-Type": "application/json" } },
    );
  },
};

export default enrollmentService;
