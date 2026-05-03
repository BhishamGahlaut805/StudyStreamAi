import React from "react";
import { FiCheckCircle, FiAlertCircle, FiInfo, FiX } from "react-icons/fi";

const iconMap = {
  success: FiCheckCircle,
  error: FiAlertCircle,
  info: FiInfo,
};

const colorMap = {
  success:
    "border-green-200 bg-green-50 text-green-800 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-300",
  error:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300",
  info: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-300",
};

const AlertMessage = ({ isOpen, title, message, type = "info", onClose }) => {
  if (!isOpen) return null;

  const Icon = iconMap[type] || FiInfo;

  return (
    <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div
        className={`w-full max-w-md rounded-xl border p-4 shadow-xl backdrop-blur ${colorMap[type] || colorMap.info}`}
      >
        <div className="flex items-start gap-3">
          <Icon className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{title}</p>
            <p className="mt-1 text-sm opacity-90">{message}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 transition hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Close alert"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertMessage;
