import axios from "axios";
import Cookies from "js-cookie";

class ApiClient {
  constructor() {
    this.apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
    this.flaskUrl =
      import.meta.env.VITE_FLASK_URL || "http://localhost:5500/api";

    // Node.js API client
    this.nodeClient = axios.create({
      baseURL: this.apiUrl,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
      withCredentials: true,
    });

    // Flask API client
    this.flaskClient = axios.create({
      baseURL: this.flaskUrl,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.setupInterceptors();
  }

  setupInterceptors() {
    // Request interceptor for Node.js client
    this.nodeClient.interceptors.request.use(
      (config) => {
        const token = this.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add request tracking for debugging
        config.metadata = { startTime: Date.now() };

        return config;
      },
      (error) => Promise.reject(error),
    );

    // Response interceptor for Node.js client
    this.nodeClient.interceptors.response.use(
      (response) => {
        // Log slow requests in development
        if (import.meta.env.DEV && response.config.metadata) {
          const duration = Date.now() - response.config.metadata.startTime;
          if (duration > 1000) {
            console.warn(`Slow API call (${duration}ms):`, response.config.url);
          }
        }
        return response;
      },
      async (error) => {
        const originalRequest = error.config;

        // Handle 401 Unauthorized
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          // Clear auth and redirect to login
          this.clearAuth();
          window.location.href = "/auth";
        }

        return Promise.reject(this.normalizeError(error));
      },
    );

    // Request interceptor for Flask client (add student ID if available)
    this.flaskClient.interceptors.request.use(
      (config) => {
        const studentId = localStorage.getItem("studentId");
        if (studentId && config.method === "post") {
          // Add student_id to POST requests if not already present
          if (config.data && !config.data.student_id) {
            config.data.student_id = studentId;
          }
        }
        return config;
      },
      (error) => Promise.reject(error),
    );
  }

  getToken() {
    return (
      Cookies.get("token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("authToken")
    );
  }

  clearAuth() {
    Cookies.remove("token");
    localStorage.removeItem("token");
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    localStorage.removeItem("userId");
    localStorage.removeItem("studentId");
    localStorage.removeItem("student");
  }

  normalizeError(error) {
    if (error.response) {
      // Server responded with error
      return {
        message:
          error.response.data?.error ||
          error.response.data?.message ||
          "Server error",
        status: error.response.status,
        data: error.response.data,
        original: error,
      };
    } else if (error.request) {
      // Request made but no response
      return {
        message: "Network error. Please check your connection.",
        status: 0,
        original: error,
      };
    } else {
      // Something else happened
      return {
        message: error.message || "An unexpected error occurred",
        status: -1,
        original: error,
      };
    }
  }

  // Node.js API methods
  async nodeGet(url, params = {}) {
    const response = await this.nodeClient.get(url, { params });
    return response.data;
  }

  async nodePost(url, data = {}) {
    const response = await this.nodeClient.post(url, data);
    return response.data;
  }

  async nodePut(url, data = {}) {
    const response = await this.nodeClient.put(url, data);
    return response.data;
  }

  async nodeDelete(url) {
    const response = await this.nodeClient.delete(url);
    return response.data;
  }

  // Flask API methods
  async flaskGet(url, params = {}) {
    const response = await this.flaskClient.get(url, { params });
    return response.data;
  }

  async flaskPost(url, data = {}) {
    const response = await this.flaskClient.post(url, data);
    return response.data;
  }
}

export default new ApiClient();
