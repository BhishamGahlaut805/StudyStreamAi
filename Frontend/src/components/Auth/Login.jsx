import React from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "../../context/authContext";
import { FiMail, FiLock, FiAlertCircle } from "react-icons/fi";
import { motion } from "framer-motion";

const Login = () => {
  const { login } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm();

  const onSubmit = async (data) => {
    try {
      await login(data);
    } catch (error) {
      // Error is handled in auth context
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
            type="password"
            {...register("password", {
              required: "Password is required",
              minLength: {
                value: 6,
                message: "Password must be at least 6 characters",
              },
            })}
            className={`block w-full pl-10 pr-3 py-2 border ${
              errors.password
                ? "border-red-500"
                : "border-slate-300 dark:border-slate-600"
            } rounded-lg bg-white dark:bg-dark-300 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors`}
            placeholder="••••••••"
          />
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

      {/* Role selection */}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
          Login as
        </label>
        <select
          {...register("role")}
          className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-dark-300 px-3 py-2 text-slate-900 dark:text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="student">Student</option>
          <option value="teacher">Teacher</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {/* Remember me and forgot password */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <input
            type="checkbox"
            {...register("rememberMe")}
            className="h-4 w-4 rounded border-slate-400 dark:border-slate-500 bg-white dark:bg-dark-300 text-primary-500 focus:ring-primary-500"
          />
          <label className="ml-2 block text-sm text-slate-600 dark:text-slate-300">
            Remember me
          </label>
        </div>
        <div className="text-sm">
          <a
            href="/forgot-password"
            className="text-primary-300 hover:underline"
          >
            Forgot password?
          </a>
        </div>
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="flex w-full justify-center rounded-lg border border-transparent bg-gradient-to-r from-primary-600 to-primary-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:from-primary-500 hover:to-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        ) : (
          "Sign In"
        )}
      </button>
    </form>
  );
};

export default Login;
