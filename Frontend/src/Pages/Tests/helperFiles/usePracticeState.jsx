// hooks/usePracticeState.js
import { useState, useRef, useEffect, useCallback } from "react";
import {
  DEFAULT_METRICS,
  DEFAULT_FLASK_PREDICTIONS,
  DEFAULT_DIFFICULTY_TELEMETRY,
  DEFAULT_MODELS_DATA,
  DEFAULT_FEATURES,
  DIFFICULTY_WINDOW_SIZE,
} from "./constants";

export const usePracticeState = () => {
  // ==================== CORE STATE ====================
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [answerResult, setAnswerResult] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState(null);
  const [questionTime, setQuestionTime] = useState(0);
  const [answerChanges, setAnswerChanges] = useState(0);

  // ==================== UI STATE ====================
  const [fullScreen, setFullScreen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [viewMode, setViewMode] = useState("split");
  const [analyticsMode, setAnalyticsMode] = useState("basic");
  const [submitting, setSubmitting] = useState(false);
  const [difficultySyncing, setDifficultySyncing] = useState(false);
  const [windowTrainingTriggered, setWindowTrainingTriggered] = useState(false);
  const [sessionNotice, setSessionNotice] = useState("");
  const [requestingNext, setRequestingNext] = useState(false);
  const [noMoreQuestions, setNoMoreQuestions] = useState(false);

  // ==================== METRICS STATE ====================
  // ==================== FIX: Initialize sessionTime to 0 ====================
  const [metrics, setMetrics] = useState({
    ...DEFAULT_METRICS,
    sessionTime: 0, // Explicitly set to 0
  });

  // ==================== QUESTION PALETTE ====================
  const [questionPalette, setQuestionPalette] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // ==================== FLASK PREDICTIONS ====================
  const [flaskPredictions, setFlaskPredictions] = useState({
    ...DEFAULT_FLASK_PREDICTIONS,
    windowSize: DIFFICULTY_WINDOW_SIZE,
  });
  const [difficultyTelemetry, setDifficultyTelemetry] = useState(
    DEFAULT_DIFFICULTY_TELEMETRY,
  );

  // ==================== 12 MODELS DATA ====================
  const [modelsData, setModelsData] = useState(DEFAULT_MODELS_DATA);

  // ==================== FEATURES FOR FLASK ====================
  const [features, setFeatures] = useState(DEFAULT_FEATURES);

  // ==================== REFS ====================
  const sessionTimerRef = useRef(null);
  const questionTimerRef = useRef(null);
  const analyticsUpdateRef = useRef(null);
  const webSocketInitialized = useRef(false);
  const sessionClockBaseRef = useRef(0);
  const questionClockStartRef = useRef(0);
  const requestingNextRef = useRef(false);
  const initializingRef = useRef(false);

  // ==================== FIX: Track session start time ====================
  const sessionStartTimeRef = useRef(null);
  const isSessionActiveRef = useRef(false);
  const sessionTimeAccumulatorRef = useRef(0);
  const lastSessionTickRef = useRef(0);

  // ==================== FIX: Reset session time on session start ====================
  const resetSessionTime = useCallback(() => {
    // Clear any existing timer
    if (sessionTimerRef.current) {
      clearInterval(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }

    // Reset all session time tracking
    sessionStartTimeRef.current = null;
    isSessionActiveRef.current = false;
    sessionTimeAccumulatorRef.current = 0;
    lastSessionTickRef.current = 0;
    sessionClockBaseRef.current = 0;

    // Reset metrics sessionTime to 0
    setMetrics((prev) => ({
      ...prev,
      sessionTime: 0,
    }));

    console.log("🔄 Session time reset to 0");
  }, [setMetrics]);

  // ==================== FIX: Start session timer ====================
  const startSessionTimer = useCallback(() => {
    // Don't start if already active
    if (isSessionActiveRef.current) {
      console.log("⏱️ Session timer already active");
      return;
    }

    // Clear any existing timer first
    if (sessionTimerRef.current) {
      clearInterval(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }

    // Set start time
    const now = Date.now();
    sessionStartTimeRef.current = now;
    isSessionActiveRef.current = true;
    lastSessionTickRef.current = now;

    // Start the interval timer
    sessionTimerRef.current = setInterval(() => {
      if (isSessionActiveRef.current && sessionStartTimeRef.current) {
        const currentTime = Date.now();
        const elapsedSeconds =
          (currentTime - sessionStartTimeRef.current) / 1000;

        // Update metrics with current elapsed time
        setMetrics((prev) => ({
          ...prev,
          sessionTime: Math.round(elapsedSeconds),
        }));

        // Store the current session time for persistence
        sessionTimeAccumulatorRef.current = elapsedSeconds;
      }
    }, 1000); // Update every second

    console.log("⏱️ Session timer started at 0");
  }, [setMetrics]);

  // ==================== FIX: Stop session timer ====================
  const stopSessionTimer = useCallback(() => {
    if (sessionTimerRef.current) {
      clearInterval(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
    isSessionActiveRef.current = false;

    // Capture the final session time
    const finalTime = sessionTimeAccumulatorRef.current || 0;
    console.log(`⏱️ Session timer stopped at ${Math.round(finalTime)}s`);

    return finalTime;
  }, []);

  // ==================== FIX: Pause session timer ====================
  const pauseSessionTimer = useCallback(() => {
    if (sessionTimerRef.current && isSessionActiveRef.current) {
      // Clear the interval but keep the accumulated time
      clearInterval(sessionTimerRef.current);
      sessionTimerRef.current = null;
      isSessionActiveRef.current = false;

      // Store the current accumulated time
      const currentTime = Date.now();
      const elapsedSeconds = (currentTime - sessionStartTimeRef.current) / 1000;
      sessionTimeAccumulatorRef.current = Math.round(elapsedSeconds);

      console.log(
        `⏱️ Session timer paused at ${Math.round(sessionTimeAccumulatorRef.current)}s`,
      );
    }
  }, []);

  // ==================== FIX: Resume session timer ====================
  const resumeSessionTimer = useCallback(() => {
    if (!isSessionActiveRef.current && sessionStartTimeRef.current) {
      // Resume from where we left off
      // We need to adjust the start time to account for the paused duration
      const now = Date.now();
      const pausedDuration = (now - lastSessionTickRef.current) / 1000;
      // Adjust start time forward to skip the paused duration
      sessionStartTimeRef.current =
        now - sessionTimeAccumulatorRef.current * 1000;
      lastSessionTickRef.current = now;
      isSessionActiveRef.current = true;

      // Restart the interval
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
      }

      sessionTimerRef.current = setInterval(() => {
        if (isSessionActiveRef.current && sessionStartTimeRef.current) {
          const currentTime = Date.now();
          const elapsedSeconds =
            (currentTime - sessionStartTimeRef.current) / 1000;

          setMetrics((prev) => ({
            ...prev,
            sessionTime: Math.round(elapsedSeconds),
          }));

          sessionTimeAccumulatorRef.current = elapsedSeconds;
        }
      }, 1000);

      console.log(
        `⏱️ Session timer resumed from ${Math.round(sessionTimeAccumulatorRef.current)}s`,
      );
    }
  }, [setMetrics]);

  // ==================== FIX: Cleanup on unmount ====================
  useEffect(() => {
    return () => {
      // Clean up timers when component unmounts
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
        sessionTimerRef.current = null;
      }
      if (questionTimerRef.current) {
        clearInterval(questionTimerRef.current);
        questionTimerRef.current = null;
      }
      isSessionActiveRef.current = false;
    };
  }, []);

  // ==================== FIX: Update session time from existing data ====================
  const updateSessionTimeFromData = useCallback(
    (sessionData) => {
      if (sessionData?.elapsedTime !== undefined) {
        const timeInSeconds =
          typeof sessionData.elapsedTime === "number"
            ? sessionData.elapsedTime
            : parseInt(sessionData.elapsedTime) || 0;

        setMetrics((prev) => ({
          ...prev,
          sessionTime: timeInSeconds,
        }));

        // Also set the accumulator
        sessionTimeAccumulatorRef.current = timeInSeconds;

        // If session is active and we have a start time, adjust it
        if (isSessionActiveRef.current && sessionStartTimeRef.current) {
          const now = Date.now();
          sessionStartTimeRef.current = now - timeInSeconds * 1000;
        }
      }
    },
    [setMetrics],
  );

  const loadFromPersistedSession = useCallback(
    (persistedData) => {
      if (!persistedData) return false;

      try {
        const {
          session,
          currentQuestion,
          answers,
          analytics,
          currentIndex,
          flaskPredictions,
          difficultyTelemetry,
        } = persistedData;

        if (session && currentQuestion) {
          // Set session
          setSession(session);

          // Set current question
          setCurrentQuestion(currentQuestion);

          // Set metrics from analytics - PRESERVE SESSION TIME
          const sessionTime =
            analytics?.sessionTime || session?.sessionTime || 0;

          setMetrics({
            correctCount: analytics?.correctCount || 0,
            wrongCount: analytics?.wrongCount || 0,
            totalQuestions:
              analytics?.totalQuestions || session.totalQuestions || 0,
            answeredQuestions: analytics?.answeredQuestions || 0,
            currentAccuracy: analytics?.currentAccuracy || 0,
            sessionTime: sessionTime, // Use persisted session time
            questionTime: 0,
            averageTimePerQuestion: analytics?.timePerQuestion || 0,
          });

          // Set current index
          if (currentIndex !== undefined) {
            setCurrentIndex(currentIndex);
          }

          // Set flask predictions
          if (flaskPredictions) {
            setFlaskPredictions(flaskPredictions);
          }

          // Set difficulty telemetry
          if (difficultyTelemetry) {
            setDifficultyTelemetry(difficultyTelemetry);
          }

          // Set question palette from session questions
          if (session.questions && session.questions.length > 0) {
            const palette = session.questions.map((q, idx) => ({
              id: q.id || q._id || q.questionId,
              index: idx,
              status:
                idx === currentIndex
                  ? "current"
                  : answers?.find((a) => a.questionId === q.id)
                    ? "answered"
                    : "unanswered",
              isCorrect:
                answers?.find((a) => a.questionId === q.id)?.isCorrect || null,
              timeSpent:
                answers?.find((a) => a.questionId === q.id)?.timeSpent || 0,
              concept: q.conceptArea || q.concept_area || q.topic || "General",
              difficulty: q.difficulty || 0.5,
              expectedTime: q.expectedTime || 90,
              timeStatus: null,
              timeRatioPercent: 0,
            }));
            setQuestionPalette(palette);
          }

          // Set question start time
          setQuestionStartTime(Date.now());

          console.log(
            "[usePracticeState] Loaded from persisted session at",
            sessionTime,
            "seconds",
          );
          return true;
        }

        return false;
      } catch (error) {
        console.error(
          "[usePracticeState] Error loading from persisted session:",
          error,
        );
        return false;
      }
    },
    [
      setSession,
      setCurrentQuestion,
      setMetrics,
      setCurrentIndex,
      setFlaskPredictions,
      setDifficultyTelemetry,
      setQuestionPalette,
      setQuestionStartTime,
    ],
  );
  return {
    // Core State
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
    // UI State
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
    // Metrics
    metrics,
    setMetrics,
    // Palette
    questionPalette,
    setQuestionPalette,
    currentIndex,
    setCurrentIndex,
    // Flask Predictions
    flaskPredictions,
    setFlaskPredictions,
    difficultyTelemetry,
    setDifficultyTelemetry,
    // Models Data
    modelsData,
    setModelsData,
    // Features
    features,
    setFeatures,
    // Refs
    sessionTimerRef,
    questionTimerRef,
    analyticsUpdateRef,
    webSocketInitialized,
    sessionClockBaseRef,
    questionClockStartRef,
    requestingNextRef,
    initializingRef,
    // ==================== NEW: Session time management functions ====================
    resetSessionTime,
    startSessionTimer,
    stopSessionTimer,
    pauseSessionTimer,
    resumeSessionTimer,
    updateSessionTimeFromData,
    sessionStartTimeRef,
    isSessionActiveRef,
    sessionTimeAccumulatorRef,
    loadFromPersistedSession,
  };
};;
