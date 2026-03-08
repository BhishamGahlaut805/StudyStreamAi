import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/authContext";
import GoogleLoginButton from "../components/Auth/GoogleLogin";
import {
  FiLogIn,
  FiUserPlus,
  FiMail,
  FiLock,
  FiUser,
  FiArrowRight,
  FiCheckCircle,
  FiAlertCircle,
  FiEye,
  FiEyeOff,
  FiAward,
  FiTarget,
  FiZap,
  FiBookOpen,
  FiTrendingUp,
  FiCpu,
  FiDatabase,
  FiLayers,
  FiHelpCircle,
  FiUsers,
} from "react-icons/fi";

import { FaGithub } from "react-icons/fa";

const Authentication = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "student",
    agreeTerms: false,
  });

  const navigate = useNavigate();
  const {
    login: contextLogin,
    register: contextRegister,
    googleLogin: contextGoogleLogin,
    user,
    isAuthenticated,
  } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated || user) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, user, navigate]);

  // Handle input change
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    // Clear errors when user types
    setError("");
  };

  // Handle login submit
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await contextLogin({
        email: formData.email,
        password: formData.password,
      });
      setSuccess("Login successful! Redirecting...");
      setTimeout(() => navigate("/dashboard"), 800);
    } catch (err) {
      setError(err.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  // Handle register submit
  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    // Validate terms agreement
    if (!formData.agreeTerms) {
      setError("Please agree to the Terms of Service");
      setLoading(false);
      return;
    }

    try {
      if (formData.name.trim().length < 2 || formData.name.trim().length > 50) {
        setError("Name must be between 2 and 50 characters");
        setLoading(false);
        return;
      }

      await contextRegister({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
      });
      setSuccess("Registration successful! Redirecting...");
      setTimeout(() => navigate("/dashboard"), 800);
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle Google login
  const handleGoogleLogin = async (credential) => {
    setLoading(true);
    setError("");

    try {
      await contextGoogleLogin({
        tokenId: credential,
        role: "student",
      });
      setSuccess("Google login successful! Redirecting...");
      setTimeout(() => navigate("/dashboard"), 800);
    } catch (err) {
      setError(err.message || "Google login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Animation variants
  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  const stagger = {
    animate: {
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  // Features data
  const features = [
    {
      icon: FiZap,
      title: "Adaptive Learning",
      description: "Questions adjust to your skill level in real-time",
      color: "from-yellow-500 to-orange-500",
    },
    {
      icon: FiTarget,
      title: "Personalized Practice",
      description: "Focus on topics that need improvement",
      color: "from-green-500 to-emerald-500",
    },
    {
      icon: FiTrendingUp,
      title: "Progress Tracking",
      description: "Detailed analytics and performance insights",
      color: "from-blue-500 to-indigo-500",
    },
    {
      icon: FiBookOpen,
      title: "Comprehensive Content",
      description: "Mathematics, English, Reasoning, and GK",
      color: "from-purple-500 to-pink-500",
    },
  ];

  // Stats data
  const stats = [
    { label: "Active Users", value: "50K+", icon: FiUsers },
    { label: "Questions", value: "10K+", icon: FiDatabase },
    { label: "Topics", value: "100+", icon: FiLayers },
    { label: "Success Rate", value: "94%", icon: FiAward },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-950">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-indigo-200/30 dark:bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-80 h-80 bg-purple-200/30 dark:bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-200/20 dark:bg-blue-500/5 rounded-full blur-3xl animate-pulse delay-2000" />
      </div>

      <div className="relative min-h-screen flex">
        {/* Left Side - Hero Section (hidden on mobile) */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
          </div>

          <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
            <div>
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5 }}
                className="flex items-center space-x-3 mb-12"
              >
                <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                  <FiCpu className="h-8 w-8" />
                </div>
                <span className="text-2xl font-bold">StudyStream AI</span>
              </motion.div>

              <motion.h1
                variants={fadeInUp}
                initial="initial"
                animate="animate"
                className="text-5xl font-bold leading-tight mb-6"
              >
                Master Your Exams with
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-pink-300">
                  Adaptive AI Learning
                </span>
              </motion.h1>

              <motion.p
                variants={fadeInUp}
                className="text-xl text-white/80 mb-8"
              >
                Join thousands of students who are improving their scores with
                personalized practice sessions and real-time analytics.
              </motion.p>

              {/* Features Grid */}
              <motion.div
                variants={stagger}
                initial="initial"
                animate="animate"
                className="grid grid-cols-2 gap-4 mb-12"
              >
                {features.map((feature, index) => (
                  <motion.div
                    key={index}
                    variants={fadeInUp}
                    className="bg-white/10 backdrop-blur-sm rounded-xl p-4"
                  >
                    <div
                      className={`w-10 h-10 rounded-lg bg-gradient-to-r ${feature.color} flex items-center justify-center mb-3`}
                    >
                      <feature.icon className="h-5 w-5 text-white" />
                    </div>
                    <h3 className="font-semibold mb-1">{feature.title}</h3>
                    <p className="text-sm text-white/70">
                      {feature.description}
                    </p>
                  </motion.div>
                ))}
              </motion.div>
            </div>

            {/* Stats */}
            <motion.div
              variants={stagger}
              initial="initial"
              animate="animate"
              className="grid grid-cols-4 gap-4"
            >
              {stats.map((stat, index) => (
                <motion.div
                  key={index}
                  variants={fadeInUp}
                  className="text-center"
                >
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-sm text-white/70">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>

            {/* Decorative Elements */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/20 to-transparent" />
          </div>
        </motion.div>

        {/* Right Side - Auth Forms */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-6 lg:p-8"
        >
          <div className="w-full max-w-md">
            {/* Logo for mobile */}
            <div className="lg:hidden text-center mb-8">
              <div className="inline-flex items-center space-x-3">
                <div className="p-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl">
                  <FiCpu className="h-8 w-8 text-white" />
                </div>
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  LearnSmart AI
                </span>
              </div>
            </div>

            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-8"
            >
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {isLogin ? "Welcome Back!" : "Create Account"}
              </h2>
              <p className="text-gray-500 dark:text-gray-400">
                {isLogin
                  ? "Sign in to continue your learning journey"
                  : "Start your personalized learning experience"}
              </p>
            </motion.div>

            {/* Main Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-indigo-100 dark:border-indigo-900"
            >
              {/* Toggle Buttons */}
              <div className="flex rounded-xl bg-indigo-50 dark:bg-gray-700/50 p-1 mb-6">
                <button
                  onClick={() => {
                    setIsLogin(true);
                    setError("");
                    setSuccess("");
                  }}
                  className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                    isLogin
                      ? "bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                      : "text-gray-500 dark:text-gray-400 hover:text-indigo-600"
                  }`}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <FiLogIn className="w-4 h-4" />
                    <span>Login</span>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setIsLogin(false);
                    setError("");
                    setSuccess("");
                  }}
                  className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                    !isLogin
                      ? "bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                      : "text-gray-500 dark:text-gray-400 hover:text-indigo-600"
                  }`}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <FiUserPlus className="w-4 h-4" />
                    <span>Register</span>
                  </div>
                </button>
              </div>

              {/* Success Message */}
              <AnimatePresence>
                {success && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-center space-x-2 text-green-700 dark:text-green-300"
                  >
                    <FiCheckCircle className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm">{success}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error Message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center space-x-2 text-red-700 dark:text-red-300"
                  >
                    <FiAlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm">{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Auth Forms */}
              <AnimatePresence mode="wait">
                {isLogin ? (
                  <motion.form
                    key="login"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    onSubmit={handleLogin}
                    className="space-y-4"
                  >
                    {/* Email */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Email Address
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiMail className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                        </div>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          required
                          className="block w-full pl-10 pr-3 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl
                                   bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                                   focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400
                                   placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                          placeholder="you@example.com"
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Password
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiLock className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                        </div>
                        <input
                          type={showPassword ? "text" : "password"}
                          name="password"
                          value={formData.password}
                          onChange={handleChange}
                          required
                          className="block w-full pl-10 pr-10 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl
                                   bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                                   focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400
                                   placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        >
                          {showPassword ? (
                            <FiEyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                          ) : (
                            <FiEye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Remember Me & Forgot Password */}
                    <div className="flex items-center justify-between">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                          Remember me
                        </span>
                      </label>
                      <button
                        type="button"
                        className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-medium"
                      >
                        Forgot password?
                      </button>
                    </div>

                    {/* Submit Button */}
                    <motion.button
                      type="submit"
                      disabled={loading}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl
                               font-semibold flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl
                               transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                          <span>Signing in...</span>
                        </>
                      ) : (
                        <>
                          <span>Sign In</span>
                          <FiArrowRight className="w-5 h-5" />
                        </>
                      )}
                    </motion.button>
                  </motion.form>
                ) : (
                  <motion.form
                    key="register"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    onSubmit={handleRegister}
                    className="space-y-4"
                  >
                    {/* Full Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Full Name
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiUser className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                        </div>
                        <input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          required
                          className="block w-full pl-10 pr-3 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl
                                   bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                                   focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400
                                   placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                          placeholder="John Doe"
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Email Address
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiMail className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                        </div>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          required
                          className="block w-full pl-10 pr-3 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl
                                   bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                                   focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400
                                   placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                          placeholder="you@example.com"
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Password
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiLock className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                        </div>
                        <input
                          type={showPassword ? "text" : "password"}
                          name="password"
                          value={formData.password}
                          onChange={handleChange}
                          required
                          minLength={6}
                          className="block w-full pl-10 pr-10 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl
                                   bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                                   focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400
                                   placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        >
                          {showPassword ? (
                            <FiEyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                          ) : (
                            <FiEye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                          )}
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Minimum 6 characters
                      </p>
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Confirm Password
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiLock className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                        </div>
                        <input
                          type={showPassword ? "text" : "password"}
                          name="confirmPassword"
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          required
                          className="block w-full pl-10 pr-3 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl
                                   bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                                   focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400
                                   placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>

                    {/* Role Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        I am a
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label
                          className={`flex items-center justify-center p-3 border-2 rounded-xl cursor-pointer transition-all ${
                            formData.role === "student"
                              ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30"
                              : "border-gray-200 dark:border-gray-700 hover:border-indigo-300"
                          }`}
                        >
                          <input
                            type="radio"
                            name="role"
                            value="student"
                            checked={formData.role === "student"}
                            onChange={handleChange}
                            className="sr-only"
                          />
                          <FiUser className="w-4 h-4 mr-2" />
                          <span className="text-sm">Student</span>
                        </label>
                        <label
                          className={`flex items-center justify-center p-3 border-2 rounded-xl cursor-pointer transition-all ${
                            formData.role === "teacher"
                              ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30"
                              : "border-gray-200 dark:border-gray-700 hover:border-indigo-300"
                          }`}
                        >
                          <input
                            type="radio"
                            name="role"
                            value="teacher"
                            checked={formData.role === "teacher"}
                            onChange={handleChange}
                            className="sr-only"
                          />
                          <FiBookOpen className="w-4 h-4 mr-2" />
                          <span className="text-sm">Teacher</span>
                        </label>
                      </div>
                    </div>

                    {/* Terms Agreement */}
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        name="agreeTerms"
                        checked={formData.agreeTerms}
                        onChange={handleChange}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        I agree to the{" "}
                        <a
                          href="/terms"
                          className="text-indigo-600 hover:underline"
                        >
                          Terms of Service
                        </a>{" "}
                        and{" "}
                        <a
                          href="/privacy"
                          className="text-indigo-600 hover:underline"
                        >
                          Privacy Policy
                        </a>
                      </span>
                    </label>

                    {/* Submit Button */}
                    <motion.button
                      type="submit"
                      disabled={loading}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl
                               font-semibold flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl
                               transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                          <span>Creating account...</span>
                        </>
                      ) : (
                        <>
                          <span>Create Account</span>
                          <FiUserPlus className="w-5 h-5" />
                        </>
                      )}
                    </motion.button>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                    Or continue with
                  </span>
                </div>
              </div>

              {/* Social Login */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-1">
                  <GoogleLoginButton
                    onSuccessCredential={(credential) =>
                      handleGoogleLogin(credential)
                    }
                  />
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled
                  className="flex items-center justify-center space-x-2 py-3 border-2 border-gray-200 dark:border-gray-700
                           rounded-xl opacity-50 cursor-not-allowed"
                >
                  <FaGithub className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    GitHub
                  </span>
                </motion.button>
              </div>

              {/* Toggle Link for Mobile */}
              <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400 lg:hidden">
                {isLogin
                  ? "Don't have an account? "
                  : "Already have an account? "}
                <button
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError("");
                    setSuccess("");
                  }}
                  className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-medium"
                >
                  {isLogin ? "Sign up" : "Sign in"}
                </button>
              </p>
            </motion.div>

            {/* Footer */}
            <p className="mt-8 text-center text-xs text-gray-400 dark:text-gray-500">
              By continuing, you agree to our{" "}
              <a href="/terms" className="text-indigo-600 hover:underline">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/privacy" className="text-indigo-600 hover:underline">
                Privacy Policy
              </a>
            </p>
          </div>
        </motion.div>
      </div>

      {/* Floating Help Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        className="fixed bottom-8 right-8 p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full shadow-2xl hover:shadow-xl transition-all"
        onClick={() => window.open("/help", "_blank")}
      >
        <FiHelpCircle className="w-6 h-6" />
      </motion.button>
    </div>
  );
};

export default Authentication;
