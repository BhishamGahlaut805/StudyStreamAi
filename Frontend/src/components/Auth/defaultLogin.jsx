// src/components/Auth/DefaultLogin.jsx
// Extremely responsive and flexible default login component

import React, { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiLogIn,
  FiCheckCircle,
  FiAlertCircle,
  FiLoader,
  FiUserCheck,
  FiShield,
  FiUsers,
  FiUser,
  FiStar,
  FiBriefcase,
  FiCpu,
  FiZap,
  FiKey,
  FiLock,
  FiMail,
} from "react-icons/fi";
import {
  FaGraduationCap,
  FaChalkboardTeacher,
  FaUserCog,
  FaRocket,
  FaBrain,
  FaChartLine,
} from "react-icons/fa";

// ============================================================
// CONFIGURATION
// ============================================================

const ROLES_CONFIG = {
  student: {
    label: "Student",
    icon: FaGraduationCap,
    iconFallback: FiUser,
    color: "from-blue-500 via-indigo-500 to-cyan-500",
    lightBg: "bg-blue-50",
    darkBg: "dark:bg-blue-950/30",
    lightBorder: "border-blue-200",
    darkBorder: "dark:border-blue-800/50",
    textColor: "text-blue-600",
    darkTextColor: "dark:text-blue-400",
    ringColor: "ring-blue-500",
    badgeColor: "from-blue-500 to-cyan-500",
    description: "Learn, practice, and track progress",
    features: ["Adaptive Learning", "Practice Tests", "Progress Tracking"],
    emailKey: "VITE_DEFAULT_STUDENT_EMAIL",
    passwordKey: "VITE_DEFAULT_STUDENT_PASSWORD",
    gradientFrom: "blue",
  },
  teacher: {
    label: "Teacher",
    icon: FaChalkboardTeacher,
    iconFallback: FiUsers,
    color: "from-purple-500 via-violet-500 to-pink-500",
    lightBg: "bg-purple-50",
    darkBg: "dark:bg-purple-950/30",
    lightBorder: "border-purple-200",
    darkBorder: "dark:border-purple-800/50",
    textColor: "text-purple-600",
    darkTextColor: "dark:text-purple-400",
    ringColor: "ring-purple-500",
    badgeColor: "from-purple-500 to-pink-500",
    description: "Create courses and manage students",
    features: ["Course Creation", "Student Analytics", "Content Management"],
    emailKey: "VITE_DEFAULT_TEACHER_EMAIL",
    passwordKey: "VITE_DEFAULT_TEACHER_PASSWORD",
    gradientFrom: "purple",
  },
  admin: {
    label: "Admin",
    icon: FaUserCog,
    iconFallback: FiShield,
    color: "from-red-500 via-orange-500 to-amber-500",
    lightBg: "bg-red-50",
    darkBg: "dark:bg-red-950/30",
    lightBorder: "border-red-200",
    darkBorder: "dark:border-red-800/50",
    textColor: "text-red-600",
    darkTextColor: "dark:text-red-400",
    ringColor: "ring-red-500",
    badgeColor: "from-red-500 to-orange-500",
    description: "Full system access and control",
    features: ["User Management", "System Analytics", "Platform Control"],
    emailKey: "VITE_DEFAULT_ADMIN_EMAIL",
    passwordKey: "VITE_DEFAULT_ADMIN_PASSWORD",
    gradientFrom: "red",
  },
};

// ============================================================
// SUB-COMPONENTS
// ============================================================

const RoleFeature = ({ text }) => (
  <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
    <span className="w-1 h-1 rounded-full bg-current opacity-50" />
    {text}
  </span>
);

const StatusBadge = ({ type, text }) => {
  const configs = {
    success: {
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      border: "border-emerald-200 dark:border-emerald-800/50",
      text: "text-emerald-700 dark:text-emerald-300",
      icon: FiCheckCircle,
    },
    error: {
      bg: "bg-red-50 dark:bg-red-950/40",
      border: "border-red-200 dark:border-red-800/50",
      text: "text-red-700 dark:text-red-300",
      icon: FiAlertCircle,
    },
  };

  const config = configs[type] || configs.success;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      className={`p-3 rounded-xl border ${config.bg} ${config.border} flex items-center gap-2.5 text-sm ${config.text}`}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span className="flex-1">{text}</span>
    </motion.div>
  );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

const DefaultLogin = ({
  onLogin,
  loading: parentLoading,
  error: parentError,
  className = "",
  compact = false,
  showFeatures = true,
  showEmailHint = true,
  showDivider = true,
  label = "Quick Demo Access",
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedRole, setSelectedRole] = useState(null);

  // Memoize role order for consistent rendering
  const roleOrder = useMemo(() => ["student", "teacher", "admin"], []);

  // Get credentials from environment variables
  const getCredentials = useCallback((role) => {
    const config = ROLES_CONFIG[role];
    if (!config) return null;

    return {
      email: import.meta.env[config.emailKey] || "",
      password: import.meta.env[config.passwordKey] || "",
      ...config,
    };
  }, []);

  // Handle default login
  const handleDefaultLogin = useCallback(
    async (role) => {
      const creds = getCredentials(role);
      if (!creds) {
        setError(`Invalid role: ${role}`);
        return;
      }

      // Validate credentials exist
      if (!creds.email || !creds.password) {
        setError(
          `Default ${creds.label} credentials not configured in environment variables.\nPlease set ${creds.emailKey} and ${creds.passwordKey}`,
        );
        return;
      }

      setSelectedRole(role);
      setLoading(true);
      setError("");
      setSuccess("");

      try {
        // Small delay for better UX
        await new Promise((resolve) => setTimeout(resolve, 600));

        await onLogin({
          email: creds.email,
          password: creds.password,
          role: role,
        });

        setSuccess(`✅ Logged in as ${creds.label}! Redirecting...`);
      } catch (err) {
        setError(err.message || `❌ Failed to login as ${creds.label}`);
      } finally {
        setLoading(false);
      }
    },
    [onLogin, getCredentials],
  );

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className={`w-full ${className}`}>
      {/* Divider */}
      {showDivider && (
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200 dark:border-gray-700/50" />
          </div>
          <div className="relative flex justify-center text-xs sm:text-sm">
            <span className="px-4 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <FiUserCheck className="w-4 h-4" />
              {label}
            </span>
          </div>
        </div>
      )}

      {/* Messages */}
      <AnimatePresence mode="popLayout">
        {(error || parentError) && (
          <StatusBadge type="error" text={error || parentError} />
        )}
        {success && <StatusBadge type="success" text={success} />}
      </AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="
    flex
    gap-5
    overflow-x-auto
    pb-4
    snap-x
    snap-mandatory
    scrollbar-thin
    scrollbar-thumb-gray-300
    scrollbar-track-transparent
    scroll-smooth
  "
      >
        {roleOrder.map((role) => {
          const creds = getCredentials(role);
          if (!creds) return null;

          const Icon = creds.icon || creds.iconFallback || FiUser;

          const isSelected = selectedRole === role;
          const isLoading = loading && isSelected;
          const isDisabled = loading || parentLoading;
          const isConfigured = creds.email && creds.password;

          return (
            <motion.div
              key={role}
              whileHover={!isDisabled ? { y: -5, scale: 1.02 } : {}}
              whileTap={!isDisabled ? { scale: 0.98 } : {}}
              className={`
          relative
          shrink-0
          snap-center

          w-[300px]
          sm:w-[330px]
          lg:flex-1
          lg:min-w-0

          rounded-3xl
          border
          p-6

          ${creds.lightBg}
          ${creds.darkBg}
          ${creds.lightBorder}
          ${creds.darkBorder}

          ${
            isSelected
              ? `ring-2 ${creds.ringColor} shadow-xl`
              : "hover:shadow-xl"
          }

          transition-all
          duration-300
        `}
            >
              {isLoading && (
                <div className="absolute inset-0 rounded-3xl bg-white/70 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-20">
                  <FiLoader className="animate-spin text-4xl text-indigo-500" />
                </div>
              )}

              {/* Icon */}
              <div
                className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${creds.color}
          flex items-center justify-center text-white shadow-lg`}
              >
                <Icon className="text-3xl" />
              </div>

              {/* Role */}
              <div className="mt-5">
                <div className="flex items-center gap-2">
                  <h2
                    className={`text-xl font-bold ${creds.textColor} ${creds.darkTextColor}`}
                  >
                    {creds.label}
                  </h2>

                  {isSelected && <FiCheckCircle className="text-green-500" />}
                </div>
              </div>


              {/* Email */}
              {showEmailHint && (
                <div className="mt-5 flex items-center gap-2 text-xs text-gray-500">
                  <FiMail />
                  <span className="truncate">
                    {creds.email || "Not Configured"}
                  </span>
                </div>
              )}

              {/* Button */}
              <button
                onClick={() => handleDefaultLogin(role)}
                disabled={isDisabled || !isConfigured}
                className={`
            mt-6
            w-full
            py-3
            rounded-xl
            font-semibold
            text-white
            bg-gradient-to-r
            ${creds.color}
            hover:shadow-lg
            disabled:opacity-50
            disabled:cursor-not-allowed
            flex
            items-center
            justify-center
            gap-2
          `}
              >
                <FiLogIn />

                {isLoading ? "Logging in..." : `Login as ${creds.label}`}
              </button>
            </motion.div>
          );
        })}
      </motion.div>
      {/* Info Note */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-4 text-center text-[11px] sm:text-xs text-gray-400 dark:text-gray-500 flex items-center justify-center gap-1.5 flex-wrap"
      >
        <FiKey className="w-3 h-3" />
        {/* </span> */}
        <span className="hidden sm:inline text-gray-300 dark:text-gray-600">
          •
        </span>
        <span className="text-[10px] sm:text-xs">
          <span className="text-indigo-500 dark:text-indigo-400">Student</span>
          <span className="text-gray-300 dark:text-gray-600 mx-1">/</span>
          <span className="text-purple-500 dark:text-purple-400">Teacher</span>
          <span className="text-gray-300 dark:text-gray-600 mx-1">/</span>
          <span className="text-red-500 dark:text-red-400">Admin</span>
        </span>
      </motion.p>
    </div>
  );
};

// ============================================================
// EXPORTS
// ============================================================

export default DefaultLogin;

// Also export the configuration for external use
export { ROLES_CONFIG };
