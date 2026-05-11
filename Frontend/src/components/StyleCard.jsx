// StyledCard.jsx
import React from "react";

const colorConfig = {
  blue: {
    bg: "bg-blue-50 dark:bg-blue-950",
    text: "text-blue-900 dark:text-blue-100",
    border: "border-blue-100 dark:border-blue-700",
    progressBg: "bg-blue-200 dark:bg-blue-700",
    progressFill: "bg-blue-600 dark:bg-blue-400",
    activeText: "text-blue-700 dark:text-blue-300",
    totalText: "text-blue-800 dark:text-blue-200",
  },
  green: {
    bg: "bg-green-50 dark:bg-green-950",
    text: "text-green-900 dark:text-green-100",
    border: "border-green-100 dark:border-green-700",
    progressBg: "bg-green-200 dark:bg-green-700",
    progressFill: "bg-green-600 dark:bg-green-400",
    activeText: "text-green-700 dark:text-green-300",
    totalText: "text-green-800 dark:text-green-200",
  },
  purple: {
    bg: "bg-purple-50 dark:bg-purple-950",
    text: "text-purple-900 dark:text-purple-100",
    border: "border-purple-100 dark:border-purple-700",
    progressBg: "bg-purple-200 dark:bg-purple-700",
    progressFill: "bg-purple-600 dark:bg-purple-400",
    activeText: "text-purple-700 dark:text-purple-300",
    totalText: "text-purple-800 dark:text-purple-200",
  },
  orange: {
    bg: "bg-orange-50 dark:bg-orange-950",
    text: "text-orange-900 dark:text-orange-100",
    border: "border-orange-100 dark:border-orange-700",
    progressBg: "bg-orange-200 dark:bg-orange-700",
    progressFill: "bg-orange-600 dark:bg-orange-400",
    activeText: "text-orange-700 dark:text-orange-300",
    totalText: "text-orange-800 dark:text-orange-200",
  },
  red: {
    bg: "bg-red-50 dark:bg-red-950",
    text: "text-red-900 dark:text-red-100",
    border: "border-red-100 dark:border-red-700",
    progressBg: "bg-red-200 dark:bg-red-700",
    progressFill: "bg-red-600 dark:bg-red-400",
    activeText: "text-red-700 dark:text-red-300",
    totalText: "text-red-800 dark:text-red-200",
  },
  yellow: {
    bg: "bg-yellow-50 dark:bg-yellow-950",
    text: "text-yellow-900 dark:text-yellow-100",
    border: "border-yellow-100 dark:border-yellow-700",
    progressBg: "bg-yellow-200 dark:bg-yellow-700",
    progressFill: "bg-yellow-500 dark:bg-yellow-300",
    activeText: "text-yellow-700 dark:text-yellow-300",
    totalText: "text-yellow-800 dark:text-yellow-200",
  },
  indigo: {
    bg: "bg-indigo-50 dark:bg-indigo-950",
    text: "text-indigo-900 dark:text-indigo-100",
    border: "border-indigo-100 dark:border-indigo-700",
    progressBg: "bg-indigo-200 dark:bg-indigo-700",
    progressFill: "bg-indigo-600 dark:bg-indigo-400",
    activeText: "text-indigo-700 dark:text-indigo-300",
    totalText: "text-indigo-800 dark:text-indigo-200",
  },
  pink: {
    bg: "bg-pink-50 dark:bg-pink-950",
    text: "text-pink-900 dark:text-pink-100",
    border: "border-pink-100 dark:border-pink-700",
    progressBg: "bg-pink-200 dark:bg-pink-700",
    progressFill: "bg-pink-600 dark:bg-pink-400",
    activeText: "text-pink-700 dark:text-pink-300",
    totalText: "text-pink-800 dark:text-pink-200",
  },
};

const StyledCard = ({
  color = "blue",
  title = "",
  icon: Icon,
  value,
  note,
  subtitle,
  valueClassName = "",
  children,
  className = "",
  shadow = "shadow-md",
  hover = true,
  rounded = "rounded-xl",
}) => {
  const colorTheme = colorConfig[color] || colorConfig.blue;

  return (
    <div
      className={`
        ${colorTheme.bg} ${colorTheme.border} ${colorTheme.text}
        p-6 ${rounded} border ${shadow}
        transition-transform duration-200 ease-in-out
        ${hover ? "hover:scale-[1.02] hover:ring-2 hover:ring-opacity-50" : ""}
        ${className}
      `}
    >
      {(title || Icon) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && (
              <h3 className={`text-lg font-semibold ${colorTheme.activeText}`}>
                {title}
              </h3>
            )}
            {typeof value !== "undefined" && value !== null && (
              <p
                className={`mt-2 text-3xl font-black leading-none ${valueClassName || colorTheme.totalText}`}
              >
                {value}
              </p>
            )}
          </div>
          {Icon ? (
            <div className={`rounded-2xl p-3 ${colorTheme.progressBg}`}>
              <Icon className={colorTheme.activeText} size={22} />
            </div>
          ) : null}
        </div>
      )}

      {note || subtitle ? (
        <p className="mb-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {note || subtitle}
        </p>
      ) : null}

      <div className="text-sm">{children}</div>
    </div>
  );
};

export default StyledCard;
