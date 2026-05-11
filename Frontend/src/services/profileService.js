import axios from "axios";
import Cookies from "js-cookie";

const BASE_URL = `${import.meta.env.VITE_API_URL}/profile`;

/**
 * ProfileService API contract
 * ---------------------------
 *
 * This client mirrors the active backend profile routes only:
 *
 * 1. GET  /api/profile/me
 *    - Returns the authenticated user's profile.
 *    - Backend controller: getMyProfile / getProfile
 *
 * 2. PUT  /api/profile
 *    - Creates or updates the authenticated user's profile.
 *    - Backend controller: updateProfile
 *
 * Accepted update payload fields
 * -------------------------------
 * The backend controller whitelists the following keys. Unknown keys are ignored.
 *
 * Core identity fields:
 * - fullName: string
 * - dateOfBirth: string | Date | ISO date string
 * - hometown: string
 * - currentLocation: string
 * - bio: string
 * - aboutMe: string
 * - contactNumber: string
 * - phoneNumber: string
 * - additionalEmail: string
 * - gender: string
 * - address: string
 * - city: string
 * - state: string
 * - country: string
 * - pincode: string
 *
 * Professional fields:
 * - qualification: string
 * - experience: number | stringified number (normalized by the backend model)
 * - currentPosition: string
 * - education: string
 * - skills: string[]
 * - hobbies: string[]
 * - interests: string[]
 * - languages: string[]
 * - projects: Array<{ name: string, description?: string, link?: string }>
 * - specializations: string[]
 *
 * Social/link fields:
 * - websiteUrl: string
 * - linkedinUrl: string
 * - twitterUrl: string
 * - socialLinks: {
 *     linkedin?: string,
 *     github?: string,
 *     twitter?: string,
 *     website?: string,
 *   }
 *
 * Availability field:
 * - availability: any JSON-serializable value. The backend schema stores this as Schema.Types.Mixed.
 *   Recommended shape:
 *   {
 *     isAvailable: boolean,
 *     hoursPerWeek: number,
 *     timezone: string
 *   }
 *
 * Backend model enum values
 * -------------------------
 * - verificationStatus: "pending" | "verified" | "rejected"
 *   This is controlled by the backend model and admin verification flow.
 *
 * Backend-generated / read-only fields
 * ------------------------------------
 * - userId
 * - profilePhoto
 * - rating
 * - totalReviews
 * - achievements
 * - certifications
 * - coursesTaught
 * - verificationDate
 * - verificationDocument
 * - createdAt / updatedAt
 *
 * Notes
 * -----
 * - profilePhoto is assigned by the backend if missing; the frontend should not upload files here.
 * - The service intentionally exposes only the routes that exist in Backend/routes/profileRoutes.js.
 */

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = Cookies.get("token") || localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      Cookies.remove("token");
      localStorage.removeItem("token");
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      localStorage.removeItem("userId");

      if (
        typeof window !== "undefined" &&
        !window.location.pathname.includes("/auth")
      ) {
        window.location.href = "/auth";
      }
    }

    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    return Promise.reject(new Error(message));
  },
);

const unwrap = (response) => response.data;

const profileService = {
  /**
   * Fetch the authenticated user's profile.
   * Backend route: GET /api/profile/me
   */
  getMyProfile: async () => {
    const response = await api.get("/me");
    return unwrap(response);
  },

  /**
   * Alias for getMyProfile(). Kept for callers that use the older name.
   */
  getProfile: async () => {
    const response = await api.get("/me");
    return unwrap(response);
  },

  /**
   * Create or update the authenticated user's profile.
   * Backend route: PUT /api/profile
   *
   * The payload should follow the field contract documented above.
   */
  updateProfile: async (profileData = {}) => {
    const response = await api.put("/", profileData);
    return unwrap(response);
  },
};

export default profileService;
