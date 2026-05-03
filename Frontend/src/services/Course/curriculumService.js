import axios from "axios";

const API_URL = `${import.meta.env.VITE_API_URL}/courses`;

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

    console.error("Curriculum API Error:", {
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

const curriculumService = {
  getCurriculum: async (courseId) => {
    try {
      const response = await api.get(`/${courseId}/curriculum`, {
        headers: { "Content-Type": "application/json" },
      });
      return response;
    } catch (error) {
      console.error("Error fetching curriculum:", error);
      // Return empty curriculum if not found
      if (error.status === 404) {
        return { success: true, data: { chapters: [] } };
      }
      throw error;
    }
  },

  createCurriculum: async (courseId, curriculumData) => {
    return await api.post(`/${courseId}/curriculum`, curriculumData, {
      headers: { "Content-Type": "application/json" },
    });
  },

  updateCurriculum: async (courseId, curriculumData) => {
    return await api.put(`/${courseId}/curriculum`, curriculumData, {
      headers: { "Content-Type": "application/json" },
    });
  },

  addChapter: async (courseId, chapterData) => {
    try {
      const response = await api.post(
        `/${courseId}/curriculum/chapters`,
        chapterData,
        {
          headers: { "Content-Type": "application/json" },
        },
      );
      return response;
    } catch (error) {
      console.error("Error adding chapter:", error);
      throw error;
    }
  },

  reorderChapters: async (courseId, chapterOrders) => {
    return await api.put(
      `/${courseId}/curriculum/chapters/reorder`,
      { chapterOrders },
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  },

  updateChapter: async (courseId, chapterId, chapterData) => {
    return await api.put(
      `/${courseId}/curriculum/chapters/${chapterId}`,
      chapterData,
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  },

  deleteChapter: async (courseId, chapterId) => {
    return await api.delete(`/${courseId}/curriculum/chapters/${chapterId}`, {
      headers: { "Content-Type": "application/json" },
    });
  },

  addLesson: async (courseId, chapterId, lessonData) => {
    try {
      const response = await api.post(
        `/${courseId}/curriculum/chapters/${chapterId}/lessons`,
        lessonData,
        {
          headers: { "Content-Type": "application/json" },
        },
      );
      return response;
    } catch (error) {
      console.error("Error adding lesson:", error);
      throw error;
    }
  },

  updateLesson: async (courseId, chapterId, lessonId, lessonData) => {
    return await api.put(
      `/${courseId}/curriculum/chapters/${chapterId}/lessons/${lessonId}`,
      lessonData,
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  },

  deleteLesson: async (courseId, chapterId, lessonId) => {
    return await api.delete(
      `/${courseId}/curriculum/chapters/${chapterId}/lessons/${lessonId}`,
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  },
};

export default curriculumService;
