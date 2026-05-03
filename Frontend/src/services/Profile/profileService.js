import axios from "axios";
import Cookies from "js-cookie";

const API_URL = `${import.meta.env.VITE_API_URL}/profile`;

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// Request interceptor to add token
api.interceptors.request.use(
  (config) => {
    const token = Cookies.get("token") || localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor for error handling
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

const profileService = {
  // Get current user profile
  getMyProfile: async () => {
    return await api.get("/me");
  },

  // Get profile by user ID
  getProfileByUserId: async (userId) => {
    return await api.get(`/user/${userId}`);
  },

  // Get public profile
  getPublicProfile: async (userId) => {
    return await api.get(`/public/${userId}`);
  },

  // Update current user profile
  updateProfile: async (profileData) => {
    return await api.put("/", profileData);
  },

  // Upload profile photo
  uploadProfilePhoto: async (photoFile) => {
    const formData = new FormData();
    formData.append("profilePhoto", photoFile);

    return await api.post("/photo", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },

  // Delete profile photo
  deleteProfilePhoto: async () => {
    return await api.delete("/delete/photo");
  },

  // Get all teachers (public route)
  getAllTeachers: async (params = {}) => {
    return await api.get("/teachers/browse", { params });
  },

  // Add achievement
  addAchievement: async (achievementData) => {
    return await api.post("/achievement", achievementData);
  },

  // Delete achievement
  deleteAchievement: async (achievementId) => {
    return await api.delete(`/achievement/${achievementId}`);
  },

  // Add certification
  addCertification: async (certificationData) => {
    return await api.post("/certification", certificationData);
  },

  // Delete certification
  deleteCertification: async (certId) => {
    return await api.delete(`/certification/${certId}`);
  },

  // Update verification status (admin only)
  updateVerificationStatus: async (userId, status, document) => {
    return await api.put("/verify", { userId, status, document });
  },

  // Update rating (admin only)
  updateRating: async (userId, newRating) => {
    return await api.put("/rating", { userId, newRating });
  },
};

export default profileService;
