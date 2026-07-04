// src/pages/Authentication.jsx
// Complete rewrite with proper organization and DefaultLogin integration

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/authContext";
import GoogleLoginButton from "../components/Auth/GoogleLogin";
import DefaultLogin from "../components/Auth/defaultLogin";
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
  FiShield,
  FiBriefcase,
  FiStar,
  FiChevronRight,
} from "react-icons/fi";
import { FaGithub, FaGoogle, FaGraduationCap } from "react-icons/fa";

// ============================================================
// CONSTANTS & CONFIGURATION
// ============================================================

const AUTH_FEATURES = [
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
    description: "Wide range of subjects and topics",
    color: "from-purple-500 to-pink-500",
  },
];

const STATS = [
  { label: "Active Users", value: "50K+", icon: FiUsers },
  { label: "Questions", value: "10K+", icon: FiDatabase },
  { label: "Topics", value: "100+", icon: FiLayers },
  { label: "Success Rate", value: "94%", icon: FiAward },
];

const ROLES = {
  student: { path: "/dashboard", label: "Student" },
  teacher: { path: "/teacher-dashboard", label: "Teacher" },
  admin: { path: "/admin/dashboard", label: "Admin" },
};

// ============================================================
// SUB-COMPONENTS
// ============================================================

const FormInput = ({
  icon: Icon,
  label,
  name,
  type,
  value,
  onChange,
  placeholder,
  required,
  rightElement,
}) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
      {label}
    </label>
    <div className="relative group">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Icon className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 dark:group-focus-within:text-indigo-400 transition-colors" />
      </div>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="block w-full pl-10 pr-3 py-2.5 border-2 border-gray-200 dark:border-gray-700 rounded-xl
                 bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400
                 placeholder-gray-400 dark:placeholder-gray-500 transition-all
                 text-sm sm:text-base"
        placeholder={placeholder}
      />
      {rightElement && (
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
          {rightElement}
        </div>
      )}
    </div>
  </div>
);

const RoleSelector = ({ selected, onSelect }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
      I am a
    </label>
    <div className="grid grid-cols-2 gap-2 sm:gap-3">
      {Object.entries(ROLES).map(([key, role]) => (
        <button
          key={key}
          type="button"
          onClick={() => onSelect(key)}
          className={`
            flex items-center justify-center gap-2 p-2.5 sm:p-3 border-2 rounded-xl
            transition-all duration-200 text-sm sm:text-base
            ${
              selected === key
                ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                : "border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 text-gray-600 dark:text-gray-400"
            }
          `}
        >
          {key === "student" && <FiUser className="w-4 h-4" />}
          {key === "teacher" && <FiBookOpen className="w-4 h-4" />}
          {key === "admin" && <FiShield className="w-4 h-4" />}
          <span className="font-medium">{role.label}</span>
        </button>
      ))}
    </div>
  </div>
);

const SocialLoginButton = ({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  className = "",
}) => (
  <motion.button
    whileHover={!disabled ? { scale: 1.02 } : {}}
    whileTap={!disabled ? { scale: 0.98 } : {}}
    onClick={onClick}
    disabled={disabled}
    className={`
      flex items-center justify-center gap-2.5 py-2.5 sm:py-3
      border-2 border-gray-200 dark:border-gray-700 rounded-xl
      text-sm sm:text-base font-medium
      transition-all duration-200
      ${disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:border-gray-300 dark:hover:border-gray-600"}
      ${className}
    `}
  >
    <Icon className="w-5 h-5" />
    <span>{label}</span>
  </motion.button>
);

// ============================================================
// MAIN COMPONENT
// ============================================================

const Authentication = () => {
  // ==================== AUTH STATE ====================
  const { login, register, googleLogin, user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

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

  // ==================== REDIRECT ====================
  useEffect(() => {
    if (isAuthenticated && user) {
      const path = ROLES[user.role]?.path || "/dashboard";
      navigate(path, { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  // ==================== HANDLERS ====================
  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setError("");
  }, []);

  const handleRoleSelect = useCallback((role) => {
    setFormData((prev) => ({ ...prev, role }));
  }, []);

  const handleDefaultLogin = useCallback(
    async (credentials) => {
      setLoading(true);
      setError("");
      setSuccess("");

      try {
        const data = await login({
          email: credentials.email,
          password: credentials.password,
        });

        if (data?.token) {
          const role = data.user?.role || credentials.role || "student";
          const path = ROLES[role]?.path || "/dashboard";
          setSuccess("Login successful! Redirecting...");
          setTimeout(() => navigate(path, { replace: true }), 800);
        } else {
          setError(data.message || "Login failed. Please try again.");
        }
      } catch (err) {
        setError(err.message || "Login failed. Please check your credentials.");
      } finally {
        setLoading(false);
      }
    },
    [login, navigate],
  );

  const handleLogin = useCallback(
    async (e) => {
      e.preventDefault();
      setLoading(true);
      setError("");

      try {
        const data = await login({
          email: formData.email,
          password: formData.password,
        });

        if (data?.token) {
          const role = data.user?.role || formData.role;
          const path = ROLES[role]?.path || "/dashboard";
          setSuccess("✅ Login successful! Redirecting...");
          setTimeout(() => navigate(path, { replace: true }), 800);
        } else {
          setError(data.message || "Login not allowed. Please contact admin.");
        }
      } catch (err) {
        setError(err.message || "Login failed. Please check your credentials.");
      } finally {
        setLoading(false);
      }
    },
    [login, formData.email, formData.password, formData.role, navigate],
  );

  const handleRegister = useCallback(
    async (e) => {
      e.preventDefault();
      setLoading(true);
      setError("");

      // Validations
      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match");
        setLoading(false);
        return;
      }

      if (!formData.agreeTerms) {
        setError("Please agree to the Terms of Service");
        setLoading(false);
        return;
      }

      if (formData.name.trim().length < 2 || formData.name.trim().length > 50) {
        setError("Name must be between 2 and 50 characters");
        setLoading(false);
        return;
      }

      try {
        const data = await register({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
        });

        if (data?.token) {
          const path =
            ROLES[data.user?.role || formData.role]?.path || "/dashboard";
          setSuccess("✅ Registration successful! Redirecting...");
          setTimeout(() => navigate(path, { replace: true }), 800);
        } else {
          setSuccess(
            data.message || "Registration successful. Awaiting verification.",
          );
        }
      } catch (err) {
        setError(err.message || "Registration failed. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [register, formData, navigate],
  );

  const handleGoogleLogin = useCallback(
    async (credential) => {
      setLoading(true);
      setError("");

      try {
        const data = await googleLogin({
          tokenId: credential,
          role: "student",
        });

        if (data?.token) {
          const path =
            ROLES[data.user?.role || "student"]?.path || "/dashboard";
          setSuccess("✅ Google login successful! Redirecting...");
          setTimeout(() => navigate(path, { replace: true }), 800);
        } else {
          setSuccess(
            data.message || "Account created. Awaiting admin verification.",
          );
        }
      } catch (err) {
        setError(err.message || "Google login failed. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [googleLogin, navigate],
  );

  // ==================== UI HELPERS ====================
  const toggleMode = useCallback(() => {
    setIsLogin((prev) => !prev);
    setError("");
    setSuccess("");
  }, []);

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  // ==================== ANIMATION VARIANTS ====================
  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  const stagger = {
    animate: {
      transition: {
        staggerChildren: 0.08,
      },
    },
  };

  // ==================== RENDER ====================
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-950">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-indigo-200/30 dark:bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-80 h-80 bg-purple-200/30 dark:bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-200/20 dark:bg-blue-500/5 rounded-full blur-3xl animate-pulse delay-2000" />
      </div>

      <div className="relative min-h-screen flex">
        {/* ==================== LEFT PANEL ==================== */}
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
            {/* Brand */}
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

            {/* Hero */}
            <motion.div
              variants={stagger}
              initial="initial"
              animate="animate"
              className="flex-1"
            >
              <motion.h1
                variants={fadeInUp}
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

              {/* Features */}
              <motion.div
                variants={stagger}
                className="grid grid-cols-2 gap-4 mb-12"
              >
                {AUTH_FEATURES.map((feature, index) => (
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
            </motion.div>

            {/* Stats */}
            <motion.div
              variants={stagger}
              initial="initial"
              animate="animate"
              className="grid grid-cols-4 gap-4 pt-8 border-t border-white/20"
            >
              {STATS.map((stat, index) => (
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
          </div>
        </motion.div>

        {/* ==================== RIGHT PANEL ==================== */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-6 lg:p-8"
        >
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="lg:hidden text-center mb-6">
              <div className="inline-flex items-center space-x-3">
                <div className="p-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl">
                  <FiCpu className="h-8 w-8 text-white" />
                </div>
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  StudyStream AI
                </span>
              </div>
            </div>

            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-6"
            >
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1.5">
                {isLogin ? "Welcome Back!" : "Create Account"}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isLogin
                  ? "Sign in to continue your learning journey"
                  : "Start your personalized learning experience"}
              </p>
            </motion.div>

            {/* ==================== MAIN CARD ==================== */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 }}
              className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-2xl p-5 sm:p-8 border border-indigo-100 dark:border-indigo-900"
            >
              {/* Tabs */}
              <div className="flex rounded-xl bg-indigo-50 dark:bg-gray-700/50 p-1 mb-5">
                <button
                  onClick={() => {
                    setIsLogin(true);
                    setError("");
                    setSuccess("");
                  }}
                  className={`
                    flex-1 py-2.5 rounded-lg font-medium transition-all text-sm sm:text-base
                    ${
                      isLogin
                        ? "bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                        : "text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                    }
                  `}
                >
                  <div className="flex items-center justify-center gap-2">
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
                  className={`
                    flex-1 py-2.5 rounded-lg font-medium transition-all text-sm sm:text-base
                    ${
                      !isLogin
                        ? "bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                        : "text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                    }
                  `}
                >
                  <div className="flex items-center justify-center gap-2">
                    <FiUserPlus className="w-4 h-4" />
                    <span>Register</span>
                  </div>
                </button>
              </div>

              {/* ==================== MESSAGES ==================== */}
              <AnimatePresence mode="popLayout">
                {success && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, y: -10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -10, height: 0 }}
                    className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-center gap-2.5 text-green-700 dark:text-green-300 text-sm"
                  >
                    <FiCheckCircle className="w-5 h-5 flex-shrink-0" />
                    <span>{success}</span>
                  </motion.div>
                )}
                {error && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, y: -10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -10, height: 0 }}
                    className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2.5 text-red-700 dark:text-red-300 text-sm"
                  >
                    <FiAlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ==================== FORMS ==================== */}
              <AnimatePresence mode="wait">
                {isLogin ? (
                  <motion.form
                    key="login"
                    initial={{ opacity: 0, x: -15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 15 }}
                    onSubmit={handleLogin}
                    className="space-y-4"
                  >
                    <FormInput
                      icon={FiMail}
                      label="Email Address"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="you@example.com"
                      required
                    />

                    <FormInput
                      icon={FiLock}
                      label="Password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="••••••••"
                      required
                      rightElement={
                        <button
                          type="button"
                          onClick={togglePasswordVisibility}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        >
                          {showPassword ? (
                            <FiEyeOff className="h-5 w-5" />
                          ) : (
                            <FiEye className="h-5 w-5" />
                          )}
                        </button>
                      }
                    />

                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        Remember me
                      </label>
                      <button
                        type="button"
                        className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-medium"
                      >
                        Forgot password?
                      </button>
                    </div>

                    <motion.button
                      type="submit"
                      disabled={loading}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl
                               font-semibold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl
                               transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
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
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -15 }}
                    onSubmit={handleRegister}
                    className="space-y-3.5"
                  >
                    <FormInput
                      icon={FiUser}
                      label="Full Name"
                      name="name"
                      type="text"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="John Doe"
                      required
                    />

                    <FormInput
                      icon={FiMail}
                      label="Email Address"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="you@example.com"
                      required
                    />

                    <FormInput
                      icon={FiLock}
                      label="Password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="••••••••"
                      required
                      rightElement={
                        <button
                          type="button"
                          onClick={togglePasswordVisibility}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        >
                          {showPassword ? (
                            <FiEyeOff className="h-5 w-5" />
                          ) : (
                            <FiEye className="h-5 w-5" />
                          )}
                        </button>
                      }
                    />

                    <FormInput
                      icon={FiLock}
                      label="Confirm Password"
                      name="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="••••••••"
                      required
                    />

                    <RoleSelector
                      selected={formData.role}
                      onSelect={handleRoleSelect}
                    />

                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        name="agreeTerms"
                        checked={formData.agreeTerms}
                        onChange={handleChange}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>
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

                    <motion.button
                      type="submit"
                      disabled={loading}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl
                               font-semibold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl
                               transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
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

              {/* ==================== DEFAULT LOGIN ==================== */}
              <div className="mt-5 flex-items-center justify-center">
                <DefaultLogin
                  onLogin={handleDefaultLogin}
                  loading={loading}
                  error={error}
                  compact={true}
                  showFeatures={false}
                  showEmailHint={true}
                  label="Quick Demo Access"
                />
              </div>

              {/* ==================== SOCIAL LOGIN ==================== */}
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-gray-700" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                    Or continue with
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <GoogleLoginButton onSuccessCredential={handleGoogleLogin} />

                <SocialLoginButton
                  icon={FaGithub}
                  label="GitHub"
                  onClick={() => {}}
                  disabled={true}
                />
              </div>

              {/* ==================== MOBILE TOGGLE ==================== */}
              <p className="mt-5 text-center text-sm text-gray-500 dark:text-gray-400 lg:hidden">
                {isLogin
                  ? "Don't have an account? "
                  : "Already have an account? "}
                <button
                  onClick={toggleMode}
                  className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-medium"
                >
                  {isLogin ? "Sign up" : "Sign in"}
                </button>
              </p>
            </motion.div>

            {/* Footer */}
            <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
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

      {/* Floating Help */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        className="fixed bottom-6 right-6 p-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full shadow-2xl hover:shadow-xl transition-all"
        onClick={() => window.open("/help", "_blank")}
      >
        <FiHelpCircle className="w-5 h-5" />
      </motion.button>
    </div>
  );
};

export default Authentication;

