// components/PracticeLayout.jsx

import React from "react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiClock,
  FiCheckCircle,
  FiXCircle,
  FiHelpCircle,
  FiBarChart2,
  FiActivity,
  FiTarget,
  FiZap,
  FiMenu,
  FiX,
  FiAlertCircle,
  FiSkipForward,
  FiPause,
  FiPlay,
  FiCheck,
  FiChevronRight,
  FiGrid,
  FiSun,
  FiMoon,
  FiMaximize2,
  FiMinimize2,
} from "react-icons/fi";
import { FaBrain,FaStar } from "react-icons/fa";

export const PracticeLayout = ({
  loading,
  error,
  setError,
  session,
  currentQuestion,
  selectedOption,
  setSelectedOption,
  answerSubmitted,
  answerResult,
  showExplanation,
  setShowExplanation,
  showHints,
  setShowHints,
  questionTime,
  answerChanges,
  fullScreen,
  sidebarOpen,
  setSidebarOpen,
  showPalette,
  setShowPalette,
  showAnalytics,
  setShowAnalytics,
  viewMode,
  setViewMode,
  analyticsMode,
  setAnalyticsMode,
  submitting,
  difficultySyncing,
  windowTrainingTriggered,
  sessionNotice,
  requestingNext,
  noMoreQuestions,
  metrics,
  questionPalette,
  currentIndex,
  flaskPredictions,
  difficultyTelemetry,
  modelsData,
  isDark,
  toggleTheme,
  handleOptionSelect,
  handleSubmitAnswer,
  handleNextQuestion,
  handleSkipQuestion,
  handlePauseResume,
  handleEndSession,
  calculateModelsData,
  formatTime,
  getDifficultyColor,
  getDifficultyBadge,
  getCorrectAnswerText,
  getDisplayedExplanation,
  getDisplayedSolutionSteps,
  getDisplayedHints,
  toPercent,
  toggleFullScreen,
}) => {
  // Helper functions
  const areOptionIdsEqual = (a, b) => String(a) === String(b);

  if (loading) {
    // If loading takes more than 10 seconds, show retry option
    const [showRetry, setShowRetry] = useState(false);

    useEffect(() => {
      const timeout = setTimeout(() => {
        setShowRetry(true);
      }, 10000);
      return () => clearTimeout(timeout);
    }, []);

    return (
      <div className="min-h-screen">
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-950">
          <div className="text-center">
            <div className="relative">
              <div className="animate-spin rounded-full h-20 w-20 border-4 border-indigo-200 border-t-indigo-600 mx-auto"></div>
              <FaBrain className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-indigo-600 animate-pulse" />
            </div>
            <p className="mt-6 text-lg text-gray-600 dark:text-gray-400">
              Loading your adaptive practice session...
            </p>
          </div>
          {showRetry && (
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-sky-50 via-indigo-50 to-fuchsia-100 dark:from-slate-950 dark:via-indigo-950 dark:to-purple-950 -z-10" />
      <div className="fixed inset-0 overflow-hidden -z-5">
        <div className="absolute -top-12 -left-10 w-64 sm:w-72 h-64 sm:h-72 bg-cyan-200/35 dark:bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-12 right-0 sm:right-10 w-72 sm:w-80 h-72 sm:h-80 bg-fuchsia-200/35 dark:bg-fuchsia-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 sm:w-96 h-80 sm:h-96 bg-indigo-200/25 dark:bg-indigo-500/10 rounded-full blur-3xl animate-pulse delay-2000" />
      </div>

      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 w-[92vw] sm:w-auto"
          >
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center space-x-3 shadow-xl">
              <FiAlertCircle className="w-5 h-5 text-red-500" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-red-500 hover:text-red-700"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sessionNotice && (
          <motion.div
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            className="fixed top-36 left-1/2 transform -translate-x-1/2 z-40 w-[92vw] sm:w-auto"
          >
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 shadow-lg">
              <div className="flex items-center gap-3">
                <p className="text-sm text-blue-700 dark:text-blue-300 font-medium flex-1">
                  {sessionNotice}
                </p>
                {noMoreQuestions && (
                  <button
                    onClick={handleEndSession}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition-colors"
                  >
                    Submit Practice
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 border-b border-indigo-100 dark:border-indigo-900/30">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 gap-2">
            {/* Left Section */}
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
              >
                <FiMenu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent truncate">
                  Adaptive Practice
                </h1>
                <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">
                  {session?.config?.title || "Personalized Learning Session"}
                </p>
              </div>
            </div>

            {/* Center Metrics */}
            <div className="hidden md:flex items-center space-x-6">
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-full">
                <FiClock className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-medium text-indigo-600">
                  {formatTime(metrics.sessionTime)}
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-1">
                  <FiCheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {metrics.correctCount}
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <FiXCircle className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {metrics.wrongCount}
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/30 rounded-full">
                <FiTarget className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-600">
                  {Math.round(metrics.currentAccuracy || 0)}%
                </span>
              </div>
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/30 rounded-full">
                <FiZap className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-600">
                  {String(
                    flaskPredictions.difficultyLevel || "medium-hard",
                  ).toUpperCase()}{" "}
                  · Level: {toPercent(flaskPredictions.nextDifficulty)} ·{" "}
                  {flaskPredictions.windowRemaining}/
                  {flaskPredictions.windowSize}
                </span>
              </div>
            </div>

            {/* Right Section */}
            <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-3">
              <button
                onClick={() =>
                  setViewMode(viewMode === "split" ? "full" : "split")
                }
                className="hidden sm:inline-flex p-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
              >
                {viewMode === "split" ? (
                  <FiMaximize2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                ) : (
                  <FiMinimize2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                )}
              </button>
              <button
                onClick={() => setShowPalette(!showPalette)}
                className="p-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
              >
                <FiGrid className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <button
                onClick={() => {
                  setShowAnalytics(!showAnalytics);
                  if (!showAnalytics) calculateModelsData();
                }}
                className="hidden sm:inline-flex p-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
              >
                <FiBarChart2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <button
                onClick={handlePauseResume}
                className="hidden md:inline-flex p-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
              >
                {session?.status === "active" ? (
                  <FiPause className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                ) : (
                  <FiPlay className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                )}
              </button>
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
              >
                {isDark ? (
                  <FiSun className="w-5 h-5 text-yellow-500" />
                ) : (
                  <FiMoon className="w-5 h-5 text-gray-600" />
                )}
              </button>
              <button
                onClick={toggleFullScreen}
                className="hidden md:inline-flex p-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
              >
                {fullScreen ? (
                  <FiMinimize2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                ) : (
                  <FiMaximize2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                )}
              </button>
              <button
                onClick={handleEndSession}
                className="px-2.5 sm:px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-xs sm:text-sm font-medium hover:shadow-lg transition-all"
              >
                <span className="hidden sm:inline">End Session</span>
                <span className="sm:hidden">End</span>
              </button>
            </div>
          </div>
          <div className="md:hidden pb-3 grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1.5 text-center">
              <p className="text-[10px] text-indigo-500">Time</p>
              <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                {formatTime(metrics.sessionTime)}
              </p>
            </div>
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1.5 text-center">
              <p className="text-[10px] text-emerald-500">Accuracy</p>
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                {Math.round(metrics.currentAccuracy || 0)}%
              </p>
            </div>
            <div className="rounded-lg bg-purple-50 dark:bg-purple-900/30 px-2 py-1.5 text-center">
              <p className="text-[10px] text-purple-500">Level</p>
              <p className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                {String(
                  flaskPredictions.difficultyLevel || "medium-hard",
                ).toUpperCase()}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex min-h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)] flex-col lg:flex-row">
        {/* Sidebar Toggle Overlay */}
        {(sidebarOpen || showPalette || showAnalytics) && (
          <button
            type="button"
            className="fixed inset-0 z-30 mt-16 bg-black/25 backdrop-blur-[1px] lg:hidden"
            onClick={() => {
              setSidebarOpen(false);
              setShowPalette(false);
              setShowAnalytics(false);
            }}
            aria-label="Close side panels"
          />
        )}

        {/* Left Sidebar - Session Overview */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", damping: 25 }}
              className="fixed lg:relative z-40 lg:z-auto inset-y-0 left-0 mt-16 lg:mt-0 w-[90vw] max-w-sm lg:w-96 bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border-r border-indigo-100 dark:border-indigo-900/30 overflow-y-auto shadow-2xl lg:shadow-none"
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900 dark:text-white flex items-center">
                    <FiActivity className="w-4 h-4 mr-2 text-indigo-600" />
                    Session Overview
                  </h2>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="p-1 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg"
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="p-4 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl text-white">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm opacity-90">Session Time</span>
                      <FiClock className="w-5 h-5 opacity-90" />
                    </div>
                    <p className="text-3xl font-bold">
                      {formatTime(metrics.sessionTime)}
                    </p>
                  </div>
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Question Time
                      </span>
                      <FiClock className="w-4 h-4 text-indigo-600" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatTime(questionTime)}
                    </p>
                  </div>
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Current Difficulty
                      </span>
                      <FiTarget className="w-4 h-4 text-indigo-600" />
                    </div>
                    <p
                      className={`text-2xl font-bold ${getDifficultyColor(currentQuestion?.difficulty || 0.5)}`}
                    >
                      {getDifficultyBadge(currentQuestion?.difficulty || 0.5)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Level: {toPercent(currentQuestion?.difficulty || 0.5)}
                    </p>
                  </div>
                  <div className="p-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl text-white">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm opacity-90">
                        Difficulty Lock
                      </span>
                      <FiZap className="w-4 h-4 opacity-90" />
                    </div>
                    <p className="text-2xl font-bold">
                      {toPercent(flaskPredictions.nextDifficulty)}
                    </p>
                    <p className="text-xs opacity-80 mt-1">
                      Difficulty:{" "}
                      {String(
                        flaskPredictions.difficultyLevel || "medium-hard",
                      ).toUpperCase()}
                    </p>
                    <p className="text-xs opacity-80 mt-1">
                      Confidence:{" "}
                      {(flaskPredictions.confidence * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs opacity-80 mt-1">
                      Model retrain in {flaskPredictions.windowRemaining}/
                      {flaskPredictions.windowSize} feature rows
                    </p>
                    <p className="text-xs opacity-80 mt-1">
                      Last trained:{" "}
                      {flaskPredictions.lastTrainedAt
                        ? new Date(
                            flaskPredictions.lastTrainedAt,
                          ).toLocaleString()
                        : "Not trained yet"}
                    </p>
                    {windowTrainingTriggered && (
                      <p className="text-xs opacity-90 mt-1 text-emerald-100">
                        Learning model update started
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-xl">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Correct
                      </p>
                      <p className="text-xl font-bold text-green-600">
                        {metrics.correctCount}
                      </p>
                    </div>
                    <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-xl">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Wrong
                      </p>
                      <p className="text-xl font-bold text-red-600">
                        {metrics.wrongCount}
                      </p>
                    </div>
                  </div>
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Accuracy
                    </p>
                    <p className="text-2xl font-bold text-indigo-600">
                      {Math.round(metrics.currentAccuracy || 0)}%
                    </p>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                      <div
                        className="h-2 rounded-full bg-indigo-600"
                        style={{ width: `${metrics.currentAccuracy || 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs opacity-80">
                      Avg Time/Question
                    </span>
                    <span className="text-sm font-bold">
                      {(() => {
                        const avgTime = metrics.averageTimePerQuestion || 0;

                        // ==================== FIX: Convert milliseconds to seconds ====================
                        // avgTime is in milliseconds (e.g., 5943532000)
                        // Convert to seconds by dividing by 1000
                        let avgTimeInSeconds = avgTime / 1000;

                        // If still too large (> 3600 seconds = 1 hour), it's still in milliseconds
                        // This handles cases where the value was already divided but still huge
                        if (avgTimeInSeconds > 3600) {
                          avgTimeInSeconds = avgTimeInSeconds / 1000;
                        }

                        // Ensure we have a reasonable number (cap at 600 seconds = 10 minutes)
                        // If it's still > 600 seconds, there's a data issue
                        if (avgTimeInSeconds > 600) {
                          avgTimeInSeconds = 600; // Cap at 10 minutes for display
                        }

                        const mins = Math.floor(avgTimeInSeconds / 60);
                        const secs = Math.round(avgTimeInSeconds % 60);

                        if (mins > 0) {
                          return `${mins}m ${secs}s`;
                        }
                        return `${secs}s`;
                      })()}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setShowAnalytics(true);
                      setAnalyticsMode("detailed");
                      calculateModelsData();
                    }}
                    className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg transition-all flex items-center justify-center space-x-2"
                  >
                    <FiBarChart2 className="w-4 h-4" />
                    <span>View Detailed Analytics</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Question Area */}
        <div
          className={`flex-1 overflow-y-auto p-4 sm:p-6 ${
            viewMode === "full"
              ? "max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-14"
              : ""
          }`}
        >
          {currentQuestion ? (
            <div className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/95 dark:bg-gray-800/95 rounded-2xl shadow-xl p-4 sm:p-6 lg:p-10 border border-indigo-100 dark:border-indigo-900 min-h-[70vh]"
              >
                {/* Question Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <span className="px-3 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full text-sm font-medium">
                      Question {currentIndex + 1}
                    </span>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${getDifficultyColor(currentQuestion.difficulty)} bg-opacity-10 border`}
                      style={{
                        backgroundColor: `${currentQuestion.difficulty < 0.3 ? "rgba(34, 197, 94, 0.1)" : currentQuestion.difficulty < 0.5 ? "rgba(59, 130, 246, 0.1)" : currentQuestion.difficulty < 0.7 ? "rgba(234, 179, 8, 0.1)" : currentQuestion.difficulty < 0.9 ? "rgba(249, 115, 22, 0.1)" : "rgba(239, 68, 68, 0.1)"}`,
                      }}
                    >
                      {getDifficultyBadge(currentQuestion.difficulty)}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {currentQuestion.conceptArea ||
                        currentQuestion.topic ||
                        "General"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center space-x-1">
                      <FiClock className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                        {formatTime(questionTime)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <FiActivity className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {answerChanges} changes
                      </span>
                    </div>
                  </div>
                </div>

                {/* Question Text */}
                <div className="mb-8 sm:mb-12">
                  <p className="text-lg sm:text-xl text-gray-900 dark:text-white leading-relaxed">
                    {currentQuestion.text}
                  </p>
                </div>

                <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-xl px-3 py-2 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800">
                    <p className="text-xs text-indigo-500">Applied Level</p>
                    <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                      {toPercent(difficultyTelemetry.nodeAppliedDifficulty)}
                    </p>
                  </div>
                  <div className="rounded-xl px-3 py-2 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800">
                    <p className="text-xs text-purple-500">Recommended Level</p>
                    <p className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                      {toPercent(flaskPredictions.nextDifficulty)}
                    </p>
                  </div>
                  <div className="rounded-xl px-3 py-2 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800">
                    <p className="text-xs text-emerald-500">Rows to Retrain</p>
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                      {flaskPredictions.windowRemaining}/
                      {flaskPredictions.windowSize}
                    </p>
                  </div>
                </div>

                {/* Options */}
                {currentQuestion.type !== "NAT" ? (
                  <div className="space-y-4">
                    {currentQuestion.options?.map((option, idx) => {
                      const isSelected = selectedOption === option.id;
                      const isCorrect =
                        answerResult?.isCorrect &&
                        areOptionIdsEqual(
                          option.id,
                          currentQuestion.correctAnswer,
                        );
                      const isWrong =
                        answerSubmitted &&
                        isSelected &&
                        !answerResult?.isCorrect;

                      return (
                        <button
                          key={option.id}
                          onClick={() => handleOptionSelect(option.id)}
                          disabled={answerSubmitted}
                          className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                            isSelected
                              ? answerSubmitted
                                ? answerResult?.isCorrect
                                  ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                                  : "border-red-500 bg-red-50 dark:bg-red-900/20"
                                : "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 shadow-lg"
                              : answerSubmitted &&
                                  areOptionIdsEqual(
                                    option.id,
                                    currentQuestion.correctAnswer,
                                  )
                                ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                                : "border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md"
                          } ${answerSubmitted ? "cursor-default" : "cursor-pointer"}`}
                        >
                          <div className="flex items-center">
                            <span
                              className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold mr-3 ${
                                isSelected
                                  ? answerSubmitted
                                    ? answerResult?.isCorrect
                                      ? "bg-green-600 text-white"
                                      : "bg-red-600 text-white"
                                    : "bg-indigo-600 text-white"
                                  : answerSubmitted &&
                                      areOptionIdsEqual(
                                        option.id,
                                        currentQuestion.correctAnswer,
                                      )
                                    ? "bg-green-600 text-white"
                                    : "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                              }`}
                            >
                              {String.fromCharCode(65 + idx)}
                            </span>
                            <span className="text-sm sm:text-base text-gray-900 dark:text-white flex-1">
                              {option.text}
                            </span>
                            {answerSubmitted &&
                              areOptionIdsEqual(
                                option.id,
                                currentQuestion.correctAnswer,
                              ) && (
                                <FiCheckCircle className="ml-3 w-5 h-5 text-green-500" />
                              )}
                            {isWrong && (
                              <FiXCircle className="ml-3 w-5 h-5 text-red-500" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <input
                      type="number"
                      step="any"
                      placeholder="Enter your numerical answer"
                      value={selectedOption || ""}
                      onChange={(e) => setSelectedOption(e.target.value)}
                      disabled={answerSubmitted}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                )}

                {answerSubmitted && answerResult && (
                  <div
                    className={`mt-6 rounded-xl border p-4 ${
                      answerResult.isCorrect
                        ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                        : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {answerResult.isCorrect ? (
                          <FiCheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <FiXCircle className="w-5 h-5 text-red-600" />
                        )}
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {answerResult.isCorrect
                            ? "Correct answer submitted"
                            : "Incorrect answer submitted"}
                        </p>
                      </div>
                      {(getDisplayedExplanation(
                        answerResult,
                        currentQuestion,
                      ) ||
                        getDisplayedSolutionSteps(answerResult, currentQuestion)
                          ?.length > 0) && (
                        <button
                          onClick={() => setShowExplanation(!showExplanation)}
                          className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                        >
                          {showExplanation
                            ? "Hide Explanation"
                            : "Show Explanation"}
                        </button>
                      )}
                    </div>

                    {!answerResult.isCorrect && (
                      <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                        Correct answer:{" "}
                        {getCorrectAnswerText(answerResult, currentQuestion)}
                      </p>
                    )}

                    {showExplanation && (
                      <div className="mt-3 rounded-lg bg-white/70 dark:bg-gray-800/60 p-3">
                        {getDisplayedExplanation(
                          answerResult,
                          currentQuestion,
                        ) && (
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            {getDisplayedExplanation(
                              answerResult,
                              currentQuestion,
                            )}
                          </p>
                        )}
                        {getDisplayedSolutionSteps(
                          answerResult,
                          currentQuestion,
                        )?.length > 0 && (
                          <ol className="mt-2 list-decimal list-inside space-y-1">
                            {getDisplayedSolutionSteps(
                              answerResult,
                              currentQuestion,
                            ).map((step, idx) => (
                              <li
                                key={idx}
                                className="text-sm text-gray-600 dark:text-gray-400"
                              >
                                {step}
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    )}

                    {getDisplayedHints(answerResult, currentQuestion)?.length >
                      0 && (
                      <div className="mt-4">
                        <button
                          onClick={() => setShowHints(!showHints)}
                          className="text-sm font-medium text-amber-600 hover:text-amber-500 flex items-center gap-1"
                        >
                          <FiHelpCircle className="w-4 h-4" />
                          {showHints ? "Hide Hints" : "Show Hints"}
                        </button>
                        {showHints && (
                          <div className="mt-2 rounded-lg bg-amber-50/70 dark:bg-amber-900/30 p-3 border border-amber-200 dark:border-amber-800">
                            <ul className="space-y-2">
                              {getDisplayedHints(
                                answerResult,
                                currentQuestion,
                              ).map((hint, idx) => (
                                <li
                                  key={idx}
                                  className="text-sm text-amber-900 dark:text-amber-100 flex gap-2"
                                >
                                  <span className="font-semibold">•</span>
                                  <span>{hint}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row sm:justify-between gap-3 mt-10 sm:mt-14">
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={handleSkipQuestion}
                      disabled={answerSubmitted}
                      className="px-4 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center space-x-2 disabled:opacity-50"
                    >
                      <FiSkipForward className="w-4 h-4" />
                      <span>Skip</span>
                    </button>
                    <button
                      onClick={handlePauseResume}
                      className="px-4 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center space-x-2"
                    >
                      {session?.status === "active" ? (
                        <>
                          <FiPause className="w-4 h-4" />
                          <span>Pause</span>
                        </>
                      ) : (
                        <>
                          <FiPlay className="w-4 h-4" />
                          <span>Resume</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="sm:ml-auto">
                    {noMoreQuestions ? (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleEndSession}
                        className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg transition-all flex items-center justify-center space-x-2"
                      >
                        <span>Submit Practice</span>
                        <FiChevronRight className="w-4 h-4" />
                      </motion.button>
                    ) : !answerSubmitted ? (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleSubmitAnswer}
                        disabled={
                          submitting ||
                          selectedOption === null ||
                          selectedOption === undefined ||
                          selectedOption === ""
                        }
                        className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
                      >
                        <FiCheck className="w-4 h-4" />
                        <span>
                          {submitting ? "Submitting..." : "Submit Answer"}
                        </span>
                      </motion.button>
                    ) : (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleNextQuestion}
                        disabled={requestingNext}
                        className="w-full sm:w-auto px-6 py-2 text-white rounded-xl font-medium hover:shadow-lg transition-all flex items-center justify-center space-x-2 bg-gradient-to-r from-green-600 to-indigo-600"
                      >
                        <span>
                          {requestingNext
                            ? "Loading Next Question..."
                            : difficultySyncing
                              ? "Preparing Next Level..."
                              : "Next Question"}
                        </span>
                        <FiChevronRight className="w-4 h-4" />
                      </motion.button>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <FaBrain className="w-16 h-16 text-indigo-300 mx-auto mb-4" />
                {noMoreQuestions ? (
                  <>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                      No more questions in this practice session.
                    </p>
                    <button
                      onClick={handleEndSession}
                      className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium"
                    >
                      Submit Practice
                    </button>
                  </>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400">
                    Loading question...
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Question Palette */}
        <AnimatePresence>
          {showPalette && (
            <motion.div
              initial={{ x: 300 }}
              animate={{ x: 0 }}
              exit={{ x: 300 }}
              transition={{ type: "spring", damping: 25 }}
              className="fixed lg:relative z-40 lg:z-auto inset-y-0 right-0 mt-16 lg:mt-0 w-[92vw] max-w-lg lg:w-[30rem] bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border-l border-indigo-100 dark:border-indigo-900/30 overflow-y-auto shadow-2xl lg:shadow-none"
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900 dark:text-white flex items-center">
                    <FiGrid className="w-4 h-4 mr-2 text-indigo-600" />
                    Question Tracker
                  </h2>
                  <div className="px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200 text-xs font-semibold">
                    {Number.isFinite(Number(metrics.totalQuestions)) &&
                    Number(metrics.totalQuestions) > 0
                      ? Number(metrics.totalQuestions)
                      : Number.isFinite(Number(session?.totalQuestions)) &&
                          Number(session?.totalQuestions) > 0
                        ? Number(session.totalQuestions)
                        : questionPalette.length}
                  </div>
                  <button
                    onClick={() => setShowPalette(false)}
                    className="p-1 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg"
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2.5 mb-6">
                  {questionPalette.map((q) => (
                    <div
                      key={q.id}
                      className={`relative aspect-square rounded-xl flex items-center justify-center text-sm font-bold transition-all border ${
                        q.status === "current"
                          ? "bg-gradient-to-r from-fuchsia-500 via-purple-600 to-indigo-600 text-white shadow-lg scale-105 ring-2 ring-purple-200 border-purple-200"
                          : q.status === "answered"
                            ? q.isCorrect
                              ? "bg-gradient-to-br from-emerald-200 to-lime-200 dark:from-emerald-900/40 dark:to-lime-900/40 text-emerald-800 dark:text-emerald-200 border-emerald-400"
                              : "bg-gradient-to-br from-rose-200 to-orange-200 dark:from-rose-900/40 dark:to-orange-900/40 text-rose-800 dark:text-rose-200 border-rose-400"
                            : "bg-gradient-to-br from-slate-100 to-indigo-50 dark:from-gray-700 dark:to-gray-800 text-gray-500 dark:text-gray-300 border-slate-300 dark:border-gray-600"
                      }`}
                      title={`Q${q.index + 1} - ${q.concept} (${Math.round(q.difficulty * 100)}% difficulty) - ${q.timeSpent}s / ${q.expectedTime || 90}s`}
                    >
                      {q.index + 1}
                      {q.timeSpent > 0 && (
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-white dark:bg-gray-800 rounded-full text-[8px] flex items-center justify-center border">
                          {Math.floor(q.timeSpent / 10)}
                        </span>
                      )}
                      {q.status === "answered" && q.timeStatus && (
                        <span
                          className={`absolute -top-1 -left-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${
                            q.timeStatus === "over"
                              ? "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-200 dark:border-red-600"
                              : q.timeStatus === "under"
                                ? "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-600"
                                : "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-600"
                          }`}
                        >
                          {q.timeRatioPercent}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-6">
                  <div className="rounded-xl p-3 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
                    <p className="text-xs text-red-600 dark:text-red-300 mb-1">
                      Over Time
                    </p>
                    <p className="text-lg font-bold text-red-700 dark:text-red-200">
                      {
                        questionPalette.filter(
                          (q) =>
                            q.status === "answered" && q.timeStatus === "over",
                        ).length
                      }
                    </p>
                  </div>
                  <div className="rounded-xl p-3 border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
                    <p className="text-xs text-amber-600 dark:text-amber-300 mb-1">
                      On Time
                    </p>
                    <p className="text-lg font-bold text-amber-700 dark:text-amber-200">
                      {
                        questionPalette.filter(
                          (q) =>
                            q.status === "answered" && q.timeStatus === "on",
                        ).length
                      }
                    </p>
                  </div>
                  <div className="rounded-xl p-3 border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
                    <p className="text-xs text-emerald-600 dark:text-emerald-300 mb-1">
                      Under Time
                    </p>
                    <p className="text-lg font-bold text-emerald-700 dark:text-emerald-200">
                      {
                        questionPalette.filter(
                          (q) =>
                            q.status === "answered" && q.timeStatus === "under",
                        ).length
                      }
                    </p>
                  </div>
                </div>

                <div className="space-y-2 mb-6">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-gradient-to-r from-indigo-600 to-purple-600 rounded"></div>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      Current Question
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-green-100 dark:bg-green-900/30 border border-green-300 rounded"></div>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      Correct
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-red-100 dark:bg-red-900/30 border border-red-300 rounded"></div>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      Incorrect
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-gray-100 dark:bg-gray-700 rounded"></div>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      Unanswered
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200">
                      &gt;110% = Over Time
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                      &lt;90% = Under Time
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl text-white">
                  <h3 className="text-sm font-semibold mb-3">
                    Session Summary
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs opacity-80">
                        Total Questions
                      </span>
                      <span className="text-sm font-bold">
                        {Number.isFinite(Number(metrics.totalQuestions)) &&
                        Number(metrics.totalQuestions) > 0
                          ? Number(metrics.totalQuestions)
                          : Number.isFinite(Number(session?.totalQuestions)) &&
                              Number(session?.totalQuestions) > 0
                            ? Number(session.totalQuestions)
                            : questionPalette.length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs opacity-80">Answered</span>
                      <span className="text-sm font-bold">
                        {
                          questionPalette.filter((q) => q.status === "answered")
                            .length
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs opacity-80">Correct</span>
                      <span className="text-sm font-bold text-green-300">
                        {
                          questionPalette.filter((q) => q.isCorrect === true)
                            .length
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs opacity-80">Accuracy</span>
                      <span className="text-sm font-bold">
                        {Math.round(metrics.currentAccuracy || 0)}%
                      </span>
                    </div>
                    Summary
                    <div className="flex justify-between">
                      <span className="text-xs opacity-80">Avg Time</span>
                      <span className="text-sm font-bold">
                        {(() => {
                          const avgTime = metrics.averageTimePerQuestion || 0;
                          // ==================== FIX: Convert milliseconds to seconds ====================
                          // If avgTime > 1000, it's in milliseconds, convert to seconds
                          let avgTimeInSeconds = avgTime;
                          if (avgTime > 1000) {
                            avgTimeInSeconds = avgTime / 1000;
                          }
                          // If still too large (> 3600 seconds), it's still in milliseconds
                          if (avgTimeInSeconds > 3600) {
                            avgTimeInSeconds = avgTimeInSeconds / 1000;
                          }
                          // Format as minutes and seconds
                          const mins = Math.floor(avgTimeInSeconds / 60);
                          const secs = Math.round(avgTimeInSeconds % 60);
                          if (mins > 0) {
                            return `${mins}m ${secs}s`;
                          }
                          return `${secs}s`;
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Analytics Sidebar */}
        <AnimatePresence>
          {showAnalytics && (
            <motion.div
              initial={{ x: 300 }}
              animate={{ x: 0 }}
              exit={{ x: 300 }}
              transition={{ type: "spring", damping: 25 }}
              className="fixed lg:relative z-40 lg:z-auto inset-y-0 right-0 mt-16 lg:mt-0 w-[92vw] max-w-lg lg:w-[30rem] bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border-l border-indigo-100 dark:border-indigo-900/30 overflow-y-auto shadow-2xl lg:shadow-none"
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900 dark:text-white flex items-center">
                    <FiBarChart2 className="w-4 h-4 mr-2 text-indigo-600" />
                    Analytics Dashboard
                  </h2>
                  <button
                    onClick={() => setShowAnalytics(false)}
                    className="p-1 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg"
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex rounded-xl bg-indigo-50 dark:bg-gray-700/50 p-1 mb-6">
                  <button
                    onClick={() => setAnalyticsMode("basic")}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      analyticsMode === "basic"
                        ? "bg-white dark:bg-gray-800 text-indigo-600 shadow-sm"
                        : "text-gray-500 hover:text-indigo-600"
                    }`}
                  >
                    Basic
                  </button>
                  <button
                    onClick={() => {
                      setAnalyticsMode("detailed");
                      calculateModelsData();
                    }}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      analyticsMode === "detailed"
                        ? "bg-white dark:bg-gray-800 text-indigo-600 shadow-sm"
                        : "text-gray-500 hover:text-indigo-600"
                    }`}
                  >
                    12 Models
                  </button>
                </div>

                {analyticsMode === "basic" ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                        Performance Overview
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-600 dark:text-gray-400">
                              Accuracy
                            </span>
                            <span className="font-medium text-indigo-600">
                              {Math.round(metrics.currentAccuracy)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="h-2 rounded-full bg-indigo-600"
                              style={{ width: `${metrics.currentAccuracy}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">
                            Correct
                          </span>
                          <span className="font-medium text-green-600">
                            {metrics.correctCount}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">
                            Incorrect
                          </span>
                          <span className="font-medium text-red-600">
                            {metrics.wrongCount}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">
                            Total Time
                          </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {formatTime(metrics.sessionTime)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                        Concept Performance
                      </h3>
                      <div className="space-y-2">
                        {Object.entries(modelsData.conceptMastery).length >
                        0 ? (
                          Object.entries(modelsData.conceptMastery)
                            .slice(0, 5)
                            .map(([concept, value]) => (
                              <div key={concept} className="flex items-center">
                                <span className="text-xs text-gray-600 dark:text-gray-400 w-20 truncate">
                                  {concept}
                                </span>
                                <div className="flex-1 mx-2">
                                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                    <div
                                      className={`h-1.5 rounded-full ${
                                        value > 0.7
                                          ? "bg-green-500"
                                          : value > 0.4
                                            ? "bg-yellow-500"
                                            : "bg-red-500"
                                      }`}
                                      style={{ width: `${value * 100}%` }}
                                    />
                                  </div>
                                </div>
                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                  {Math.round(value * 100)}%
                                </span>
                              </div>
                            ))
                        ) : (
                          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                            No concept data yet. Answer more questions.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="p-4 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl text-white">
                      <h3 className="text-sm font-semibold mb-3">
                        AI Predictions
                      </h3>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-xs opacity-80">
                            Next Difficulty
                          </span>
                          <span className="text-sm font-bold">
                            {toPercent(flaskPredictions.nextDifficulty)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs opacity-80">Confidence</span>
                          <span className="text-sm font-bold">
                            {(flaskPredictions.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        {flaskPredictions.learningVelocity && (
                          <div className="flex justify-between">
                            <span className="text-xs opacity-80">
                              Learning Velocity
                            </span>
                            <span className="text-sm font-bold">
                              {flaskPredictions.learningVelocity
                                .masterySlopeNext7Days > 0
                                ? "↑"
                                : "↓"}{" "}
                              {Math.abs(
                                flaskPredictions.learningVelocity
                                  .masterySlopeNext7Days * 100,
                              ).toFixed(1)}
                              %
                            </span>
                          </div>
                        )}
                        {flaskPredictions.burnoutRisk && (
                          <div className="flex justify-between">
                            <span className="text-xs opacity-80">
                              Burnout Risk
                            </span>
                            <span
                              className={`text-sm font-bold ${
                                flaskPredictions.burnoutRisk.burnoutRisk > 0.6
                                  ? "text-red-300"
                                  : flaskPredictions.burnoutRisk.burnoutRisk >
                                      0.3
                                    ? "text-yellow-300"
                                    : "text-green-300"
                              }`}
                            >
                              {(
                                flaskPredictions.burnoutRisk.burnoutRisk * 100
                              ).toFixed(0)}
                              %
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center">
                        <FaStar className="w-3 h-3 mr-1 text-yellow-500" />
                        1. Concept Mastery
                      </h3>
                      <div className="space-y-2">
                        {Object.entries(modelsData.conceptMastery).length >
                        0 ? (
                          Object.entries(modelsData.conceptMastery)
                            .slice(0, 4)
                            .map(([concept, value]) => (
                              <div key={concept} className="flex items-center">
                                <span className="text-xs text-gray-600 dark:text-gray-400 w-16 truncate">
                                  {concept}
                                </span>
                                <div className="flex-1 mx-2">
                                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                    <div
                                      className="h-1.5 rounded-full bg-indigo-600"
                                      style={{ width: `${value * 100}%` }}
                                    />
                                  </div>
                                </div>
                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                  {Math.round(value * 100)}%
                                </span>
                              </div>
                            ))
                        ) : (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            No data yet
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                        2. Stability Index
                      </h3>
                      <div className="space-y-2">
                        {Object.entries(modelsData.stabilityIndex).length >
                        0 ? (
                          Object.entries(modelsData.stabilityIndex)
                            .slice(0, 4)
                            .map(([concept, value]) => (
                              <div key={concept} className="flex items-center">
                                <span className="text-xs text-gray-600 dark:text-gray-400 w-16 truncate">
                                  {concept}
                                </span>
                                <div className="flex-1 mx-2">
                                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                    <div
                                      className="h-1.5 rounded-full bg-green-500"
                                      style={{ width: `${value * 100}%` }}
                                    />
                                  </div>
                                </div>
                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                  {Math.round(value * 100)}%
                                </span>
                              </div>
                            ))
                        ) : (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            No data yet
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                        3. Confidence Calibration
                      </h3>
                      <p className="text-2xl font-bold text-indigo-600">
                        {(
                          modelsData.confidenceCalibration?.overall * 100
                        ).toFixed(1)}
                        %
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Calibration error (lower is better)
                      </p>
                    </div>

                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                        4. Error Patterns
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Conceptual
                          </p>
                          <p className="text-lg font-bold text-purple-600">
                            {Math.round(
                              (modelsData.errorPatterns?.conceptual || 0) * 100,
                            )}
                            %
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Careless
                          </p>
                          <p className="text-lg font-bold text-yellow-600">
                            {Math.round(
                              (modelsData.errorPatterns?.careless || 0) * 100,
                            )}
                            %
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Guess
                          </p>
                          <p className="text-lg font-bold text-orange-600">
                            {Math.round(
                              (modelsData.errorPatterns?.guess || 0) * 100,
                            )}
                            %
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Overconfidence
                          </p>
                          <p className="text-lg font-bold text-red-600">
                            {Math.round(
                              (modelsData.errorPatterns?.overconfidence || 0) *
                                100,
                            )}
                            %
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                        5. Weakness Priority
                      </h3>
                      <div className="space-y-2">
                        {modelsData.weaknessPriority.slice(0, 4).map((item) => (
                          <div key={item.topic} className="flex items-center">
                            <span className="text-xs font-medium w-6 text-red-500">
                              #{item.rank}
                            </span>
                            <span className="text-xs text-gray-600 dark:text-gray-400 w-20 truncate">
                              {item.topic}
                            </span>
                            <div className="flex-1 mx-2">
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                <div
                                  className="h-1.5 rounded-full bg-red-500"
                                  style={{ width: `${item.score * 100}%` }}
                                />
                              </div>
                            </div>
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                              {Math.round(item.score * 100)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                        6. Forgetting Curve
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                        Decay Constant:{" "}
                        {modelsData.forgettingCurve?.decayConstant?.toFixed(2)}
                      </p>
                      <div className="space-y-2">
                        {modelsData.forgettingCurve?.reviewRecommendations?.map(
                          (rec, idx) => (
                            <div
                              key={idx}
                              className="p-2 bg-white dark:bg-gray-900 rounded-lg text-xs"
                            >
                              <span className="font-medium text-gray-900 dark:text-white">
                                {rec.topic}
                              </span>
                              <span
                                className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                                  rec.priority === "high"
                                    ? "bg-red-100 text-red-600"
                                    : "bg-yellow-100 text-yellow-600"
                                }`}
                              >
                                {rec.priority}
                              </span>
                              <p className="text-gray-500 dark:text-gray-400 mt-1">
                                {rec.reason}
                              </p>
                            </div>
                          ),
                        )}
                      </div>
                    </div>

                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                        7. Fatigue Index
                      </h3>
                      <div className="flex items-center space-x-3">
                        <div className="flex-1">
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                            <div
                              className={`h-3 rounded-full ${
                                modelsData.fatigueIndex > 0.6
                                  ? "bg-red-500"
                                  : modelsData.fatigueIndex > 0.3
                                    ? "bg-yellow-500"
                                    : "bg-green-500"
                              }`}
                              style={{
                                width: `${modelsData.fatigueIndex * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                        <span className="text-xl font-bold text-indigo-600">
                          {Math.round(modelsData.fatigueIndex * 100)}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        {modelsData.fatigueIndex > 0.6
                          ? "High fatigue - take a break"
                          : modelsData.fatigueIndex > 0.3
                            ? "Moderate fatigue"
                            : "Feeling fresh"}
                      </p>
                    </div>

                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                        8. Behavior Profile
                      </h3>
                      <p className="text-lg font-bold text-purple-600 capitalize">
                        {modelsData.behaviorProfile}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {modelsData.behaviorProfile === "impulsive"
                          ? "Quick answers, may miss details"
                          : modelsData.behaviorProfile === "overthinker"
                            ? "Takes time, may second-guess"
                            : "Balanced approach"}
                      </p>
                    </div>

                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                        9. Difficulty Tolerance
                      </h3>
                      <p className="text-2xl font-bold text-indigo-600">
                        {Math.round(modelsData.difficultyTolerance * 100)}%
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Max sustainable difficulty
                      </p>
                    </div>

                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                        10. Study Efficiency
                      </h3>
                      <p className="text-2xl font-bold text-green-600">
                        {Math.round(modelsData.studyEfficiency * 100)}%
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Correct answers per minute
                      </p>
                    </div>

                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                        11. Focus Loss
                      </h3>
                      <p className="text-2xl font-bold text-orange-600">
                        {Math.round(modelsData.focusLoss * 100)}%
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Frequency of focus disruptions
                      </p>
                    </div>

                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                        12. Recommended Time
                      </h3>
                      <div className="space-y-2">
                        {modelsData.timeAllocation
                          .slice(0, 4)
                          .map((item, idx) => (
                            <div key={idx} className="flex items-center">
                              <span
                                className={`w-2 h-2 rounded-full mr-2 ${
                                  item.priority === "high"
                                    ? "bg-red-500"
                                    : item.priority === "medium"
                                      ? "bg-yellow-500"
                                      : "bg-green-500"
                                }`}
                              />
                              <span className="text-xs text-gray-600 dark:text-gray-400 flex-1">
                                {item.topic}
                              </span>
                              <span className="text-xs font-medium text-indigo-600">
                                {item.recommendedMinutes}m
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>

                    <div className="p-4 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl text-white">
                      <h3 className="text-sm font-semibold mb-2">
                        Recommendations
                      </h3>
                      <ul className="space-y-2 text-xs">
                        {modelsData.weaknessPriority.slice(0, 3).map((item) => (
                          <li
                            key={item.topic}
                            className="flex items-start space-x-2"
                          >
                            <span className="text-yellow-300">•</span>
                            <span>{item.recommendation}</span>
                          </li>
                        ))}
                        {modelsData.fatigueIndex > 0.6 && (
                          <li className="flex items-start space-x-2">
                            <span className="text-yellow-300">•</span>
                            <span>Take a short break to reduce fatigue</span>
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
