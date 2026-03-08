import React, { createContext, useState, useEffect, useContext } from "react";
import authService from "../services/authService";
import toast from "react-hot-toast";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      setLoading(true);
      const storedUser = authService.getStoredUser();
      const hasToken = authService.isAuthenticated();

      if (hasToken && storedUser) {
        // Verify token with backend
        const response = await authService.getCurrentUser();

        if (response.success && response.user) {
          authService.setUser(response.user);
          setUser(response.user);
          setIsAuthenticated(true);
        } else if (!response.unauthorized && storedUser) {
          // Keep local session during transient refresh failures.
          authService.setUser(storedUser);
          setUser(storedUser);
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      const fallbackUser = authService.getStoredUser();
      if (authService.isAuthenticated() && fallbackUser) {
        setUser(fallbackUser);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    try {
      const response = await authService.register(userData);
      setUser(response.user);
      setIsAuthenticated(true);
      toast.success("Registration successful!");
      return response;
    } catch (error) {
      toast.error(error.message);
      throw error;
    }
  };

  const login = async (credentials) => {
    try {
      const response = await authService.login(credentials);
      setUser(response.user);
      setIsAuthenticated(true);
      toast.success("Login successful!");
      return response;
    } catch (error) {
      toast.error(error.message);
      throw error;
    }
  };

  const googleLogin = async (googleData) => {
    try {
      const response = await authService.googleLogin(googleData);
      setUser(response.user);
      setIsAuthenticated(true);
      toast.success("Google login successful!");
      return response;
    } catch (error) {
      toast.error(error.message);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
      setUser(null);
      setIsAuthenticated(false);
      toast.success("Logged out successfully");
    } catch (error) {
      toast.error("Logout failed");
      throw error;
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    register,
    login,
    googleLogin,
    logout,
    checkAuth,
  };

  return React.createElement(AuthContext.Provider, { value }, children);
};
