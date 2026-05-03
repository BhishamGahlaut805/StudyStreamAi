// services/Course/questionBankService.js
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

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

    console.log(
      `[QuestionBank API] Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`,
    );
    return config;
  },
  (error) => Promise.reject(error),
);

// Response Interceptor
api.interceptors.response.use(
  (response) => {
    console.log(
      `[QuestionBank API] Response: ${response.status} ${response.config?.url}`,
    );
    return response.data;
  },
  (error) => {
    const errMsg =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      "Something went wrong";

    console.error("Question Bank API Error:", {
      status: error.response?.status,
      url: error.config?.url,
      message: errMsg,
      fullError: error.response?.data,
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

const questionBankService = {
  getQuestionBankTeacher: async (courseId) => {
    try {
      console.log(
        `[QuestionBank Service] Getting teacher question bank for course: ${courseId}`,
      );
      return await api.get(`/courses/${courseId}/question-bank/teacher`);
    } catch (error) {
      console.error(
        `[QuestionBank Service] Error getting teacher question bank:`,
        error,
      );
      throw error;
    }
  },

  createQuestionBank: async (courseId) => {
    try {
      console.log(
        `[QuestionBank Service] Creating question bank for course: ${courseId}`,
      );
      return await api.post(`/courses/${courseId}/question-bank`, {
        subject: "General",
        topics: [],
        questions: [],
      });
    } catch (error) {
      console.error(
        `[QuestionBank Service] Error creating question bank:`,
        error,
      );
      throw error;
    }
  },

  addQuestions: async (courseId, questions) => {
    try {
      console.log(
        `[QuestionBank Service] Adding ${questions.length} questions to course: ${courseId}`,
      );
      return await api.post(`/courses/${courseId}/question-bank/questions`, {
        questions,
      });
    } catch (error) {
      console.error(`[QuestionBank Service] Error adding questions:`, error);
      throw error;
    }
  },

  updateQuestion: async (courseId, questionId, questionData) => {
    return await api.put(
      `/courses/${courseId}/question-bank/questions/${questionId}`,
      questionData,
    );
  },

  deleteQuestion: async (courseId, questionId) => {
    return await api.delete(
      `/courses/${courseId}/question-bank/questions/${questionId}`,
    );
  },

  updateTopics: async (courseId, topics) => {
    return await api.put(`/courses/${courseId}/question-bank/topics`, {
      topics,
    });
  },

  getQuestionBank: async (courseId) => {
    return await api.get(`/courses/${courseId}/question-bank`);
  },

  getPracticeQuestions: async (courseId, params = {}) => {
    return await api.get(`/practice/course/${courseId}/practice`, { params });
  },

  submitPracticeAnswers: async (courseId, answers) => {
    return await api.post(`/practice/course/${courseId}/practice/submit`, {
      answers,
    });
  },
};

export default questionBankService;
