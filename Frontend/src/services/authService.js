import axios from "axios";
import Cookies from "js-cookie";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Create axios instance with default config
const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Important for cookies
});

// Request interceptor to add token
axiosInstance.interceptors.request.use(
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
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login
      Cookies.remove("token");
      localStorage.removeItem("token");
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      localStorage.removeItem("userId");
      localStorage.removeItem("student");
      localStorage.removeItem("studentId");

      // Only redirect if not already on auth page
      if (!window.location.pathname.includes("/auth")) {
        window.location.href = "/auth";
      }
    }
    return Promise.reject(error);
  },
);

class AuthService {
  constructor() {
    this.user = null;
    this.listeners = new Set();
  }

  /**
   * Register user
   */
  async register(userData) {
    try {
      const response = await axiosInstance.post("/auth/register", userData);

      if (response.data.token) {
        this.setSession(response.data.token, response.data.user);
      }

      return {
        success: true,
        user: response.data.user,
        message: response.data.message || "Registration successful",
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Login user
   */
  async login(credentials) {
    try {
      const response = await axiosInstance.post("/auth/login", credentials);

      if (response.data.token) {
        this.setSession(response.data.token, response.data.user);
      }

      return {
        success: true,
        user: response.data.user,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Google Login
   */
  async googleLogin(googleData) {
    try {
      const response = await axiosInstance.post("/auth/google", googleData);

      if (response.data.token) {
        this.setSession(response.data.token, response.data.user);
      }

      return {
        success: true,
        user: response.data.user,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Logout user
   */
  async logout() {
    try {
      await axiosInstance.post("/auth/logout");
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      this.clearSession();
      this.notifyListeners(null);

      // Redirect to auth page
      window.location.href = "/auth";
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser() {
    try {
      const response = await axiosInstance.get("/auth/me");
      this.user = response.data.user;
      this.notifyListeners(this.user);
      return {
        success: true,
        user: response.data.user,
        status: 200,
        unauthorized: false,
      };
    } catch (error) {
      const status = Number(error?.response?.status || 0);
      if (status === 401) {
        this.clearSession();
      }

      const fallbackUser = this.getCurrentUserSync();
      return {
        success: false,
        user: fallbackUser,
        status,
        unauthorized: status === 401,
      };
    }
  }

  /**
   * Backward-compatible alias used by authContext
   */
  getStoredUser() {
    return this.getCurrentUserSync();
  }

  /**
   * Backward-compatible setter used by authContext
   */
  setUser(user) {
    this.user = user || null;

    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
    } else {
      localStorage.removeItem("user");
    }

    this.notifyListeners(this.user);
  }

  /**
   * Set session data
   */
  setSession(token, user) {
    // Store token in both cookie and localStorage for redundancy
    Cookies.set("token", token, {
      expires: 7,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    localStorage.setItem("token", token);
    localStorage.setItem("authToken", token);

    // Store user data
    localStorage.setItem("user", JSON.stringify(user));
    if (user?.id) {
      localStorage.setItem("userId", user.id);
      localStorage.setItem("studentId", user.id);
      localStorage.setItem(
        "student",
        JSON.stringify({
          id: user.id,
          name: user.name || "Student",
          role: user.role,
        }),
      );
    }

    this.user = user;
    this.notifyListeners(user);
  }

  /**
   * Clear session data
   */
  clearSession() {
    Cookies.remove("token");
    localStorage.removeItem("token");
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    localStorage.removeItem("userId");
    localStorage.removeItem("student");
    localStorage.removeItem("studentId");

    this.user = null;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.getToken();
  }

  /**
   * Get stored token
   */
  getToken() {
    return (
      Cookies.get("token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("authToken")
    );
  }

  /**
   * Get current user from storage
   */
  getCurrentUserSync() {
    if (this.user) return this.user;

    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        this.user = JSON.parse(userStr);
        return this.user;
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Get student ID
   */
  getStudentId() {
    const user = this.getCurrentUserSync();
    return user?.studentId || user?.id || localStorage.getItem("studentId");
  }

  /**
   * Get user role
   */
  getUserRole() {
    const user = this.getCurrentUserSync();
    return user?.role || "student";
  }

  /**
   * Check if user has required role
   */
  hasRole(requiredRole) {
    const userRole = this.getUserRole();
    if (requiredRole === "admin") return userRole === "admin";
    if (requiredRole === "teacher")
      return userRole === "teacher" || userRole === "admin";
    return true; // student can access student routes
  }

  /**
   * Add auth change listener
   */
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify listeners of auth change
   */
  notifyListeners(user) {
    this.listeners.forEach((callback) => {
      try {
        callback(user);
      } catch (error) {
        console.error("Auth listener error:", error);
      }
    });
  }

  /**
   * Handle API errors
   */
  handleError(error) {
    if (error.response) {
      // Server responded with error
      const message =
        error.response.data.message ||
        error.response.data.error ||
        "An error occurred";
      const status = error.response.status;

      // Handle specific status codes
      switch (status) {
        case 400:
          return new Error(message || "Bad request");
        case 401:
          this.clearSession();
          return new Error("Invalid credentials");
        case 403:
          return new Error(message || "Access forbidden");
        case 404:
          return new Error("Resource not found");
        case 409:
          return new Error(message || "Email already registered");
        case 422:
          return new Error(message || "Validation error");
        case 500:
          return new Error("Server error. Please try again later.");
        default:
          return new Error(message || `Error ${status}`);
      }
    } else if (error.request) {
      // Request made but no response
      return new Error(
        "Unable to connect to server. Please check your internet connection.",
      );
    } else {
      // Something else happened
      return new Error(error.message || "An unexpected error occurred");
    }
  }
}

// Create singleton instance
const authService = new AuthService();
export default authService;
