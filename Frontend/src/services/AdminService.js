import axios from "axios";
import Cookies from "js-cookie";

const API_URL = import.meta.env.VITE_API_URL;

const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

axiosInstance.interceptors.request.use(
  (config) => {
    const token = Cookies.get("token") || localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      Cookies.remove("token");
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (!window.location.pathname.includes("/auth")) {
        window.location.href = "/auth";
      }
    }
    return Promise.reject(error);
  },
);

const unwrapData = (response) => response?.data || {};

class AdminService {
  async getAllUsers(page = 1, limit = 10, includeInactive = false) {
    try {
      const response = await axiosInstance.get("/admin/users", {
        params: { page, limit, includeInactive },
      });

      const payload = unwrapData(response);
      const users = Array.isArray(payload.users)
        ? payload.users
        : Array.isArray(payload.data?.users)
          ? payload.data.users
          : [];

      return {
        success: true,
        users,
        total:
          Number(payload.total ?? payload.data?.total ?? users.length) || 0,
        page: Number(payload.page ?? payload.data?.page ?? page) || 1,
        pages: Number(payload.pages ?? payload.data?.pages ?? 1) || 1,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async verifyUser(userId) {
    try {
      const response = await axiosInstance.post(`/admin/verify-user/${userId}`);
      return { success: true, message: unwrapData(response).message };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteUser(userId) {
    try {
      const response = await axiosInstance.delete(
        `/admin/delete-user/${userId}`,
      );
      return { success: true, message: unwrapData(response).message };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getCourseSummary() {
    try {
      const response = await axiosInstance.get("/admin/courses/summary");
      return unwrapData(response).data || {};
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getCourses(params = {}) {
    try {
      const response = await axiosInstance.get("/admin/courses", { params });
      const payload = unwrapData(response);
      return {
        success: true,
        courses: Array.isArray(payload.data) ? payload.data : [],
        total: Number(payload.total || 0),
        page: Number(payload.page || 1),
        pages: Number(payload.pages || 1),
        summary: payload.summary || {},
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getCourseAnalytics(courseId) {
    try {
      const response = await axiosInstance.get(`/admin/courses/${courseId}`);
      return unwrapData(response).data || {};
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getCourseStudents(courseId) {
    try {
      const response = await axiosInstance.get(
        `/admin/courses/${courseId}/students`,
      );
      const payload = unwrapData(response);
      return {
        success: true,
        course: payload.course || null,
        students: Array.isArray(payload.data) ? payload.data : [],
        count: Number(payload.count || 0),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  handleError(error) {
    if (error.response) {
      const message =
        error.response.data.message ||
        error.response.data.error ||
        "An error occurred";
      const status = error.response.status;

      switch (status) {
        case 400:
          return new Error(message || "Bad request");
        case 401:
          return new Error("Unauthorized. Admin access required.");
        case 403:
          return new Error("Forbidden. Admin access required.");
        case 404:
          return new Error(message || "Resource not found");
        case 500:
          return new Error("Server error. Please try again later.");
        default:
          return new Error(message || `Error ${status}`);
      }
    }

    if (error.request) {
      return new Error(
        "Unable to connect to server. Please check your internet connection.",
      );
    }

    return new Error(error.message || "An unexpected error occurred");
  }
}

const adminService = new AdminService();
export default adminService;

// import axios from "axios";
// import Cookies from "js-cookie";

// const API_URL = import.meta.env.VITE_API_URL;

// // Create axios instance with default config
// const axiosInstance = axios.create({
//   baseURL: API_URL,
//   headers: {
//     "Content-Type": "application/json",
//   },
//   withCredentials: true,
// });

// // Request interceptor to add token
// axiosInstance.interceptors.request.use(
//   (config) => {
//     const token = Cookies.get("token") || localStorage.getItem("token");
//     if (token) {
//       config.headers.Authorization = `Bearer ${token}`;
//     }
//     return config;
//   },
//   (error) => {
//     return Promise.reject(error);
//   },
// );

// // Response interceptor for error handling
// axiosInstance.interceptors.response.use(
//   (response) => response,
//   (error) => {
//     if (error.response?.status === 401) {
//       Cookies.remove("token");
//       localStorage.removeItem("token");
//       localStorage.removeItem("user");
//       if (!window.location.pathname.includes("/auth")) {
//         window.location.href = "/auth";
//       }
//     }
//     return Promise.reject(error);
//   },
// );

// class AdminService {
//   /**
//    * Get all users (active by default)
//    */
//   async getAllUsers(page = 1, limit = 10, includeInactive = false) {
//     try {
//       const response = await axiosInstance.get("/admin/users", {
//         params: {
//           page,
//           limit,
//           includeInactive,
//         },
//       });

//       const payload = response?.data || {};
//       const users = Array.isArray(payload.users)
//         ? payload.users
//         : Array.isArray(payload.data?.users)
//           ? payload.data.users
//           : [];

//       return {
//         success: true,
//         users,
//         total:
//           Number(payload.total ?? payload.data?.total ?? users.length) || 0,
//         page: Number(payload.page ?? payload.data?.page ?? page) || 1,
//         pages: Number(payload.pages ?? payload.data?.pages ?? 1) || 1,
//       };
//     } catch (error) {
//       throw this.handleError(error);
//     }
//   }

//   /**
//    * Verify a user (send credentials for teachers)
//    */
//   async verifyUser(userId) {
//     try {
//       const response = await axiosInstance.post(`/admin/verify-user/${userId}`);
//       return {
//         success: true,
//         message: response.data.message,
//       };
//     } catch (error) {
//       throw this.handleError(error);
//     }
//   }

//   /**
//    * Delete a user
//    */
//   async deleteUser(userId) {
//     try {
//       const response = await axiosInstance.delete(
//         `/admin/delete-user/${userId}`,
//       );
//       return {
//         success: true,
//         message: response.data.message,
//       };
//     } catch (error) {
//       throw this.handleError(error);
//     }
//   }

//   /**
//    * Handle API errors
//    */
//   handleError(error) {
//     if (error.response) {
//       const message =
//         error.response.data.message ||
//         error.response.data.error ||
//         "An error occurred";
//       const status = error.response.status;

//       switch (status) {
//         case 400:
//           return new Error(message || "Bad request");
//         case 401:
//           return new Error("Unauthorized. Admin access required.");
//         case 403:
//           return new Error("Forbidden. Admin access required.");
//         case 404:
//           return new Error("User not found");
//         case 500:
//           return new Error("Server error. Please try again later.");
//         default:
//           return new Error(message || `Error ${status}`);
//       }
//     } else if (error.request) {
//       return new Error(
//         "Unable to connect to server. Please check your internet connection.",
//       );
//     } else {
//       return new Error(error.message || "An unexpected error occurred");
//     }
//   }
// }

// // Create singleton instance
// const adminService = new AdminService();
// export default adminService;
