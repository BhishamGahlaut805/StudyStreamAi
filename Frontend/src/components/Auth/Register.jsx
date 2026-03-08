import React from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "../../context/authContext";
import {
  FiUser,
  FiMail,
  FiLock,
  FiAlertCircle,
  FiEye,
  FiEyeOff,
} from "react-icons/fi";
import { motion } from "framer-motion";
import { useState } from "react";

const Register = () => {
  const { register: registerUser } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm();

  const password = watch("password", "");

  const onSubmit = async (data) => {
    try {
      await registerUser(data);
    } catch (error) {
      // Error is handled in auth context
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Name field */}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
          Full Name
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiUser className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            {...register("name", {
              required: "Name is required",
              minLength: {
                value: 2,
                message: "Name must be at least 2 characters",
              },
            })}
            className={`block w-full pl-10 pr-3 py-2 border ${
              errors.name
                ? "border-red-500"
                : "border-slate-300 dark:border-slate-600"
            } rounded-lg bg-white dark:bg-dark-300 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors`}
            placeholder="John Doe"
          />
        </div>
        {errors.name && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-1 text-sm text-red-500 flex items-center"
          >
            <FiAlertCircle className="w-4 h-4 mr-1" />
            {errors.name.message}
          </motion.p>
        )}
      </div>

      {/* Email field */}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
          Email Address
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiMail className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="email"
            {...register("email", {
              required: "Email is required",
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: "Invalid email address",
              },
            })}
            className={`block w-full pl-10 pr-3 py-2 border ${
              errors.email
                ? "border-red-500"
                : "border-slate-300 dark:border-slate-600"
            } rounded-lg bg-white dark:bg-dark-300 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors`}
            placeholder="you@example.com"
          />
        </div>
        {errors.email && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-1 text-sm text-red-500 flex items-center"
          >
            <FiAlertCircle className="w-4 h-4 mr-1" />
            {errors.email.message}
          </motion.p>
        )}
      </div>

      {/* Password field */}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
          Password
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiLock className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type={showPassword ? "text" : "password"}
            {...register("password", {
              required: "Password is required",
              minLength: {
                value: 6,
                message: "Password must be at least 6 characters",
              },
              pattern: {
                value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                message:
                  "Password must contain at least one uppercase, one lowercase, and one number",
              },
            })}
            className={`block w-full pl-10 pr-10 py-2 border ${
              errors.password
                ? "border-red-500"
                : "border-slate-300 dark:border-slate-600"
            } rounded-lg bg-white dark:bg-dark-300 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors`}
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            {showPassword ? (
              <FiEyeOff className="h-5 w-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" />
            ) : (
              <FiEye className="h-5 w-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" />
            )}
          </button>
        </div>
        {errors.password && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-1 text-sm text-red-500 flex items-center"
          >
            <FiAlertCircle className="w-4 h-4 mr-1" />
            {errors.password.message}
          </motion.p>
        )}
      </div>

      {/* Confirm Password field */}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
          Confirm Password
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiLock className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="password"
            {...register("confirmPassword", {
              required: "Please confirm your password",
              validate: (value) =>
                value === password || "Passwords do not match",
            })}
            className={`block w-full pl-10 pr-3 py-2 border ${
              errors.confirmPassword
                ? "border-red-500"
                : "border-slate-300 dark:border-slate-600"
            } rounded-lg bg-white dark:bg-dark-300 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors`}
            placeholder="••••••••"
          />
        </div>
        {errors.confirmPassword && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-1 text-sm text-red-500 flex items-center"
          >
            <FiAlertCircle className="w-4 h-4 mr-1" />
            {errors.confirmPassword.message}
          </motion.p>
        )}
      </div>

      {/* Role selection */}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
          Register as
        </label>
        <select
          {...register("role")}
          className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-dark-300 px-3 py-2 text-slate-900 dark:text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="student">Student</option>
          <option value="teacher">Teacher</option>
        </select>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Teachers require admin verification after registration
        </p>
      </div>

      {/* Terms and conditions */}
      <div className="flex items-start">
        <input
          type="checkbox"
          {...register("terms", {
            required: "You must accept the terms and conditions",
          })}
          className="mt-1 h-4 w-4 rounded border-slate-400 dark:border-slate-500 bg-white dark:bg-dark-300 text-primary-500 focus:ring-primary-500"
        />
        <label className="ml-2 block text-sm text-slate-600 dark:text-slate-300">
          I agree to the{" "}
          <a href="/terms" className="text-primary-300 hover:underline">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="/privacy" className="text-primary-300 hover:underline">
            Privacy Policy
          </a>
        </label>
      </div>
      {errors.terms && (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-red-500 flex items-center"
        >
          <FiAlertCircle className="w-4 h-4 mr-1" />
          {errors.terms.message}
        </motion.p>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="flex w-full justify-center rounded-lg border border-transparent bg-gradient-to-r from-primary-600 to-primary-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:from-primary-500 hover:to-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        ) : (
          "Create Account"
        )}
      </button>
    </form>
  );
};

export default Register;
