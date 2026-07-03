// practice.jsx - Main entry file with all imports

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/authContext";
import { useTheme } from "../../context/ThemeContext";
import testService from "../../services/testService";
import flaskService from "../../services/flaskService";
import authService from "../../services/authService";
import websocketService from "../../services/webSockets";

// ==================== ICONS ====================
import {
  FiClock,
  FiCheckCircle,
  FiXCircle,
  FiHelpCircle,
  FiBarChart2,
  FiActivity,
  FiTarget,
  FiZap,
  FiTrendingUp,
  FiChevronLeft,
  FiChevronRight,
  FiSettings,
  FiSun,
  FiMoon,
  FiMaximize2,
  FiMinimize2,
  FiMenu,
  FiX,
  FiAlertCircle,
  FiInfo,
  FiBookOpen,
  FiAward,
  FiFlag,
  FiSkipForward,
  FiPause,
  FiPlay,
  FiCheck,
  FiList,
  FiGrid,
} from "react-icons/fi";

import {
  FaBrain,
  FaRocket,
  FaChartLine,
  FaMagic,
  FaGraduationCap,
  FaBook,
  FaCertificate,
  FaMedal,
  FaTrophy,
  FaFire,
  FaBolt,
  FaFeather,
  FaLeaf,
  FaSeedling,
  FaTree,
  FaMountain,
  FaSun,
  FaMoon,
  FaCloud,
  FaCloudSun,
  FaCloudMoon,
  FaStar,
  FaChessQueen,
  FaChessBishop,
  FaChessKnight,
  FaChessRook,
  FaChessPawn,
} from "react-icons/fa";

import { usePracticeState } from "./helperFiles/usePracticeState";
import { usePracticeTimers } from "./helperFiles/usePracticeTimers";
import { usePracticeWebSocket } from "./helperFiles/usePracticeWebSockets";
import { usePracticeNavigation } from "./helperFiles/usePracticeNavigation";
import { usePracticeAnswers } from "./helperFiles/usePracticeAnswers";
import { usePracticeFlask } from "./helperFiles/usePracticeFlask";
import { usePracticeAnalytics } from "./helperFiles/usePracticeAnalytics";

import {
  getQuestionId,
  parseDifficulty,
  normalizeQuestion,
  areOptionIdsEqual,
  getElapsedSessionSeconds,
  toPercent,
  getTimePerformanceMetrics,
  formatTime,
  getDifficultyColor,
  getDifficultyBadge,
  getFormattedAnswer,
  getCorrectAnswerText,
  getDisplayedExplanation,
  getDisplayedSolutionSteps,
  getDisplayedHints,
  calculateTrend,
  calculateStdDev,
  calculateSecondHalfDrop,
} from "./helperFiles/practiceHelpers";
import {
  DIFFICULTY_WINDOW_SIZE,
  SESSION_STORAGE_KEY,
  DEFAULT_METRICS,
  DEFAULT_FLASK_PREDICTIONS,
  DEFAULT_DIFFICULTY_TELEMETRY,
  DEFAULT_MODELS_DATA,
  DEFAULT_FEATURES,
} from "./helperFiles/constants";

import { PracticeLayout } from "./helperFiles/practiceLayout";

// ==================== MAIN COMPONENT ====================
const PracticePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  // Session data from navigation
  const sessionData = location.state?.session;
  const sessionConfig = location.state?.config || {};

  // ==================== STATE MANAGEMENT ====================
  const {
    loading,
    setLoading,
    error,
    setError,
    session,
    setSession,
    currentQuestion,
    setCurrentQuestion,
    selectedOption,
    setSelectedOption,
    answerSubmitted,
    setAnswerSubmitted,
    answerResult,
    setAnswerResult,
    showExplanation,
    setShowExplanation,
    showHints,
    setShowHints,
    questionStartTime,
    setQuestionStartTime,
    questionTime,
    setQuestionTime,
    answerChanges,
    setAnswerChanges,
    fullScreen,
    setFullScreen,
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
    setSubmitting,
    difficultySyncing,
    setDifficultySyncing,
    windowTrainingTriggered,
    setWindowTrainingTriggered,
    sessionNotice,
    setSessionNotice,
    requestingNext,
    setRequestingNext,
    noMoreQuestions,
    setNoMoreQuestions,
    metrics,
    setMetrics,
    questionPalette,
    setQuestionPalette,
    currentIndex,
    setCurrentIndex,
    flaskPredictions,
    setFlaskPredictions,
    difficultyTelemetry,
    setDifficultyTelemetry,
    modelsData,
    setModelsData,
    features,
    setFeatures,
    sessionTimerRef,
    questionTimerRef,
    analyticsUpdateRef,
    webSocketInitialized,
    sessionClockBaseRef,
    questionClockStartRef,
    requestingNextRef,
    initializingRef,
  } = usePracticeState();

  // ==================== MOUNTED REF ====================
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // ==================== HELPER FUNCTIONS ====================
  const initializeQuestionPalette = useCallback(
    (questions, activeIndex = 0) => {
      const palette = (questions || []).map((q, index) => ({
        id: getQuestionId(q),
        index: index,
        status: index === activeIndex ? "current" : "unanswered",
        isCorrect: null,
        timeSpent: 0,
        concept: q.conceptArea || q.concept_area || q.topic || "General",
        difficulty: parseDifficulty(q.difficulty ?? q.difficulty_level, 0.5),
        expectedTime: q.expectedTime ?? q.expected_time ?? 90,
        timeStatus: null,
        timeRatioPercent: 0,
      }));
      setQuestionPalette(palette);
    },
    [setQuestionPalette],
  );

  // ==================== TOGGLE FULLSCREEN ====================
  const toggleFullScreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn("Fullscreen request failed:", err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err) => {
          console.warn("Exit fullscreen failed:", err);
        });
      }
    }
  }, []);

  // ==================== REQUEST NEXT QUESTION ====================
  const requestNextQuestion = useCallback(async (options) => {
    try {
      return await testService.requestNextQuestion(options);
    } catch (error) {
      console.error("Error requesting next question:", error);
      throw error;
    }
  }, []);

  // ==================== TIMERS ====================
  const { startSessionTimer, startQuestionTimer } = usePracticeTimers({
    session,
    currentQuestion,
    answerSubmitted,
    metrics,
    setMetrics,
    questionTime,
    setQuestionTime,
    sessionClockBaseRef,
    questionClockStartRef,
    sessionTimerRef,
    questionTimerRef,
  });

  // ==================== WEB SOCKET ====================
  const {
    setupWebSocketListeners,
    teardownWebSocketListeners,
    handleTestJoined,
    handleNextQuestionReceived,
    handleAnswerConfirmed,
    handleAnalyticsUpdate,
    handlePracticeDuration,
    handleQuestionsUpdated,
    handleConnectionChange,
    handleNoMoreQuestions,
  } = usePracticeWebSocket({
    setSession,
    setMetrics,
    setCurrentQuestion,
    setQuestionStartTime,
    setQuestionTime,
    setSelectedOption,
    setAnswerSubmitted,
    setAnswerResult,
    setShowExplanation,
    setShowHints,
    setCurrentIndex,
    setQuestionPalette,
    setSessionNotice,
    setNoMoreQuestions,
    setRequestingNext,
    setDifficultySyncing,
    setError,
    flaskPredictions,
    questionClockStartRef,
    requestingNextRef,
    getQuestionId,
    normalizeQuestion,
    parseDifficulty,
    initializeQuestionPalette,
  });

  // ==================== FLASK ====================
  const {
    updateFlaskPredictions,
    extractAndSendFeatures,
    getPracticeProfile,
    initializeFlaskPredictions,
  } = usePracticeFlask({
    studentId: authService.getStudentId(),
    setFlaskPredictions,
    setFeatures,
    setDifficultySyncing,
    setWindowTrainingTriggered,
    flaskPredictions,
    features,
    questionStartTime,
    answerChanges,
    metrics,
    session,
    testService,
    sessionClockBaseRef,
    questionClockStartRef,
  });

  // ==================== ANALYTICS ====================
  const { calculateModelsData } = usePracticeAnalytics({
    metrics,
    answerChanges,
    features,
    modelsData,
    setModelsData,
    testService,
  });

  // ==================== NAVIGATION ====================
  const {
    handleNextQuestion,
    handleSkipQuestion,
    handlePauseResume,
    handleEndSession,
    initializePractice,
    cleanup,
  } = usePracticeNavigation({
    navigate,
    sessionData,
    sessionConfig,
    session,
    setSession,
    currentQuestion,
    setCurrentQuestion,
    setLoading,
    setError,
    setMetrics,
    setQuestionStartTime,
    setQuestionTime,
    setSelectedOption,
    setAnswerSubmitted,
    setAnswerResult,
    setShowExplanation,
    setShowHints,
    setAnswerChanges,
    setCurrentIndex,
    setQuestionPalette,
    setFlaskPredictions,
    setDifficultyTelemetry,
    setSessionNotice,
    setNoMoreQuestions,
    setRequestingNext,
    setDifficultySyncing,
    setWindowTrainingTriggered,
    submitting,
    setSubmitting,
    requestNextQuestion,
    answerSubmitted,
    selectedOption,
    questionStartTime,
    answerChanges,
    metrics,
    flaskPredictions,
    modelsData,
    questionClockStartRef,
    sessionClockBaseRef,
    requestingNextRef,
    sessionTimerRef,
    questionTimerRef,
    analyticsUpdateRef,
    teardownWebSocketListeners,
    getQuestionId,
    normalizeQuestion,
    parseDifficulty,
    initializeQuestionPalette,
    getElapsedSessionSeconds,
    updateFlaskPredictions,
    extractAndSendFeatures,
    testService,
    flaskService,
    authService,
    websocketService,
    isMounted,
    initializingRef,
  });

  // ==================== ANSWER HANDLING ====================
  const { handleOptionSelect, handleSubmitAnswer } = usePracticeAnswers({
    session,
    setSession,
    currentQuestion,
    setCurrentQuestion,
    selectedOption,
    setSelectedOption,
    answerSubmitted,
    setAnswerSubmitted,
    answerResult,
    setAnswerResult,
    setShowExplanation,
    setShowHints,
    answerChanges,
    setAnswerChanges,
    setMetrics,
    setQuestionPalette,
    setFlaskPredictions,
    setDifficultySyncing,
    setWindowTrainingTriggered,
    setError,
    setSubmitting,
    submitting,
    questionStartTime,
    metrics,
    flaskPredictions,
    currentIndex,
    sessionClockBaseRef,
    questionClockStartRef,
    testService,
    flaskService,
    authService,
    getQuestionId,
    normalizeQuestion,
    getTimePerformanceMetrics,
    extractAndSendFeatures,
    updateFlaskPredictions,
    DIFFICULTY_WINDOW_SIZE,
  });

  // ==================== AUTO-SAVE SESSION ====================
  useEffect(() => {
    // Auto-save session state on changes
    if (session && session.status === "active") {
      // Update session time in testService before persisting
      if (metrics.sessionTime !== undefined) {
        testService.updateSessionTime(metrics.sessionTime);
      }
      testService.persistActiveSession();
    }
  }, [
    session?.sessionId,
    metrics.sessionTime,
    currentQuestion?.id,
    answerSubmitted,
  ]);

  // Save on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (session && session.status === "active") {
        // Final save before page unload
        if (metrics.sessionTime !== undefined) {
          testService.updateSessionTime(metrics.sessionTime);
        }
        testService.persistActiveSession();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [session, metrics.sessionTime]);

  // Debug - log state changes
  useEffect(() => {
    console.log("[PracticePage] State changed:", {
      sessionTime: metrics.sessionTime,
      hasSession: !!session,
      sessionId: session?.sessionId,
      hasCurrentQuestion: !!currentQuestion,
      currentIndex: currentIndex,
    });
  }, [metrics.sessionTime, session, currentQuestion, currentIndex]);
  // ==================== LAYOUT ====================
  if (loading) {
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
        </div>
      </div>
    );
  }

  return (
    <PracticeLayout
      loading={loading}
      error={error}
      setError={setError}
      session={session}
      currentQuestion={currentQuestion}
      selectedOption={selectedOption}
      setSelectedOption={setSelectedOption}
      answerSubmitted={answerSubmitted}
      answerResult={answerResult}
      showExplanation={showExplanation}
      setShowExplanation={setShowExplanation}
      showHints={showHints}
      setShowHints={setShowHints}
      questionTime={questionTime}
      answerChanges={setAnswerChanges}
      fullScreen={fullScreen}
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      showPalette={showPalette}
      setShowPalette={setShowPalette}
      showAnalytics={showAnalytics}
      setShowAnalytics={setShowAnalytics}
      viewMode={viewMode}
      setViewMode={setViewMode}
      analyticsMode={analyticsMode}
      setAnalyticsMode={setAnalyticsMode}
      submitting={submitting}
      difficultySyncing={difficultySyncing}
      windowTrainingTriggered={windowTrainingTriggered}
      sessionNotice={sessionNotice}
      requestingNext={requestingNext}
      noMoreQuestions={noMoreQuestions}
      metrics={metrics}
      questionPalette={questionPalette}
      currentIndex={currentIndex}
      flaskPredictions={flaskPredictions}
      difficultyTelemetry={difficultyTelemetry}
      modelsData={modelsData}
      isDark={isDark}
      toggleTheme={toggleTheme}
      handleOptionSelect={handleOptionSelect}
      handleSubmitAnswer={handleSubmitAnswer}
      handleNextQuestion={handleNextQuestion}
      handleSkipQuestion={handleSkipQuestion}
      handlePauseResume={handlePauseResume}
      handleEndSession={handleEndSession}
      calculateModelsData={calculateModelsData}
      formatTime={formatTime}
      getDifficultyColor={getDifficultyColor}
      getDifficultyBadge={getDifficultyBadge}
      getCorrectAnswerText={getCorrectAnswerText}
      getDisplayedExplanation={getDisplayedExplanation}
      getDisplayedSolutionSteps={getDisplayedSolutionSteps}
      getDisplayedHints={getDisplayedHints}
      toPercent={toPercent}
      toggleFullScreen={toggleFullScreen}
      toggleDarkMode={toggleTheme}
    />
  );
};;;

export default PracticePage;
