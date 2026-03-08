import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/authContext";
import { useTheme } from "../../context/ThemeContext";
import testService from "../../services/testService";
import flaskService from "../../services/flaskService";
import authService from "../../services/authService";
import websocketService from "../../services/webSockets";

// Icons
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

const PracticePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  // Session data from navigation
  const sessionData = location.state?.session;
  const sessionConfig = location.state?.config || {};

  // ==================== CORE STATE ====================
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(sessionData || null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [answerResult, setAnswerResult] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState(null);
  const [questionTime, setQuestionTime] = useState(0);
  const [answerChanges, setAnswerChanges] = useState(0);

  // ==================== UI STATE ====================
  const [fullScreen, setFullScreen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [viewMode, setViewMode] = useState("split"); // 'split', 'full'
  const [analyticsMode, setAnalyticsMode] = useState("basic"); // 'basic', 'detailed'
  const [submitting, setSubmitting] = useState(false);
  const [difficultySyncing, setDifficultySyncing] = useState(false);
  const [windowTrainingTriggered, setWindowTrainingTriggered] = useState(false);
  const [sessionNotice, setSessionNotice] = useState("");
  const [requestingNext, setRequestingNext] = useState(false);
  const [noMoreQuestions, setNoMoreQuestions] = useState(false);

  // ==================== METRICS STATE ====================
  const [metrics, setMetrics] = useState({
    correctCount: 0,
    wrongCount: 0,
    totalQuestions: 0,
    answeredQuestions: 0,
    currentAccuracy: 0,
    sessionTime: 0,
    questionTime: 0,
    averageTimePerQuestion: 0,
  });

  // ==================== QUESTION PALETTE ====================
  const [questionPalette, setQuestionPalette] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // ==================== FLASK PREDICTIONS ====================
  const DIFFICULTY_WINDOW_SIZE = 5;
  const [flaskPredictions, setFlaskPredictions] = useState({
    nextDifficulty: 0.5,
    confidence: 0,
    method: "initial",
    windowSize: DIFFICULTY_WINDOW_SIZE,
    windowRemaining: 0,
    lastUpdatedAt: null,
    learningVelocity: null,
    burnoutRisk: null,
  });
  const [difficultyTelemetry, setDifficultyTelemetry] = useState({
    nodeAppliedDifficulty: 0.5,
    nodeRequestedDifficulty: 0.5,
    lastNodeSyncAt: null,
  });

  // ==================== 12 MODELS DATA (shown on demand) ====================
  const [modelsData, setModelsData] = useState({
    conceptMastery: {},
    stabilityIndex: {},
    confidenceCalibration: null,
    errorPatterns: null,
    weaknessPriority: [],
    forgettingCurve: {},
    fatigueIndex: 0.2,
    behaviorProfile: "balanced",
    difficultyTolerance: 0.5,
    studyEfficiency: 0.5,
    focusLoss: 0.1,
    timeAllocation: [],
  });

  // ==================== FEATURES FOR FLASK ====================
  const [features, setFeatures] = useState({
    practice: [], // 12-feature vectors for each answer
    conceptHistory: {}, // per-concept mastery history
    sessionFeatures: [], // session-level features for burnout
  });

  // ==================== REFS ====================
  const sessionTimerRef = useRef(null);
  const questionTimerRef = useRef(null);
  const analyticsUpdateRef = useRef(null);
  const webSocketInitialized = useRef(false);
  const sessionClockBaseRef = useRef(0);
  const questionClockStartRef = useRef(0);
  const requestingNextRef = useRef(false);

  const getQuestionId = (question) =>
    question?.id || question?._id || question?.questionId || null;

  const parseDifficulty = (value, fallback = 0.5) => {
    const parsed = Number(value);
    return Number.isFinite(parsed)
      ? Math.max(0.1, Math.min(0.95, parsed))
      : fallback;
  };

  const normalizeQuestion = (question, fallbackDifficulty = 0.5) => {
    if (!question) return null;

    return {
      ...question,
      id: getQuestionId(question),
      difficulty: parseDifficulty(
        question?.difficulty ?? question?.difficulty_level,
        fallbackDifficulty,
      ),
      difficultyLevel:
        question?.difficultyLevel || question?.difficulty_level || "medium",
      correctAnswer:
        question?.correctAnswer ?? question?.correct_answer ?? null,
      explanation: question?.explanation ?? question?.solution ?? "",
      solutionSteps: Array.isArray(question?.solutionSteps)
        ? question.solutionSteps
        : Array.isArray(question?.solution_steps)
          ? question.solution_steps
          : [],
      conceptArea:
        question?.conceptArea || question?.concept_area || question?.topic,
      expectedTime: question?.expectedTime ?? question?.expected_time ?? 90,
    };
  };

  const areOptionIdsEqual = (a, b) => String(a) === String(b);

  const getElapsedSessionSeconds = (startTime) => {
    if (!startTime) return 0;
    const startMs = new Date(startTime).getTime();
    if (Number.isNaN(startMs)) return 0;
    return Math.max(0, Math.floor((Date.now() - startMs) / 1000));
  };

  const toPercent = (value, fractionDigits = 0) => {
    const normalized = Math.max(0, Math.min(1, Number(value) || 0));
    return `${(normalized * 100).toFixed(fractionDigits)}%`;
  };

  const getTimePerformanceMetrics = (timeSpent = 0, expectedTime = 90) => {
    const safeExpected = Math.max(1, Number(expectedTime) || 90);
    const ratio = (Number(timeSpent) || 0) / safeExpected;
    const ratioPercent = Math.round(ratio * 100);

    if (ratio > 1.1) {
      return {
        status: "over",
        ratioPercent,
      };
    }

    if (ratio < 0.9) {
      return {
        status: "under",
        ratioPercent,
      };
    }

    return {
      status: "on",
      ratioPercent,
    };
  };

  // ==================== INITIALIZATION ====================
  useEffect(() => {
    initializePractice();
    return () => {
      cleanup();
    };
  }, []);

  // Initialize WebSocket listeners
  useEffect(() => {
    if (!webSocketInitialized.current) {
      setupWebSocketListeners();
      webSocketInitialized.current = true;
    }
  }, []);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullScreenChange = () => {
      setFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullScreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullScreenChange);
  }, []);

  // Session timer
  useEffect(() => {
    if (session?.status !== "active") return;

    if (!sessionClockBaseRef.current) {
      sessionClockBaseRef.current =
        Date.now() - (metrics.sessionTime || 0) * 1000;
    }

    sessionTimerRef.current = setInterval(() => {
      const elapsed = Math.max(
        0,
        Math.floor((Date.now() - sessionClockBaseRef.current) / 1000),
      );
      setMetrics((prev) => ({
        ...prev,
        sessionTime: elapsed,
      }));
    }, 1000);

    return () => {
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
      }
    };
  }, [session?.status]);

  // Question timer
  useEffect(() => {
    if (!currentQuestion || answerSubmitted) return;

    if (!questionClockStartRef.current) {
      questionClockStartRef.current = Date.now();
    }

    questionTimerRef.current = setInterval(() => {
      const elapsed = Math.max(
        0,
        Math.floor((Date.now() - questionClockStartRef.current) / 1000),
      );
      setQuestionTime(elapsed);
      setMetrics((prev) => ({
        ...prev,
        questionTime: elapsed,
      }));
    }, 500);

    return () => {
      if (questionTimerRef.current) {
        clearInterval(questionTimerRef.current);
      }
    };
  }, [currentQuestion, answerSubmitted]);

  // ==================== WEB SOCKET SETUP ====================
  const setupWebSocketListeners = () => {
    testService.on("test-joined", handleTestJoined);
    testService.on("next-question", handleNextQuestionReceived);
    testService.on("answer-confirmed", handleAnswerConfirmed);
    testService.on("analytics-update", handleAnalyticsUpdate);
    testService.on("practice-duration", handlePracticeDuration);
    testService.on("questions-updated", handleQuestionsUpdated);
    testService.on("connection-change", handleConnectionChange);
    testService.on("no-more-questions", handleNoMoreQuestions);
  };

  const teardownWebSocketListeners = () => {
    testService.off("test-joined", handleTestJoined);
    testService.off("next-question", handleNextQuestionReceived);
    testService.off("answer-confirmed", handleAnswerConfirmed);
    testService.off("analytics-update", handleAnalyticsUpdate);
    testService.off("practice-duration", handlePracticeDuration);
    testService.off("questions-updated", handleQuestionsUpdated);
    testService.off("connection-change", handleConnectionChange);
    testService.off("no-more-questions", handleNoMoreQuestions);
  };

  const handleTestJoined = (data) => {
    setSession((prev) => ({
      ...(prev || {}),
      ...data,
    }));

    if (typeof data?.elapsedSessionSeconds === "number") {
      setMetrics((prev) => ({
        ...prev,
        sessionTime: data.elapsedSessionSeconds,
      }));
    }

    if (data?.currentQuestion) {
      setCurrentQuestion(data.currentQuestion);
      setQuestionStartTime(Date.now());
      questionClockStartRef.current = Date.now();
      setQuestionTime(0);
      setSelectedOption(null);
      setAnswerSubmitted(false);
      setAnswerResult(null);
      setShowExplanation(false);

      if (typeof data?.currentQuestionIndex === "number") {
        setCurrentIndex(data.currentQuestionIndex);
      }
    }
  };

  const handleNextQuestionReceived = (data) => {
    requestingNextRef.current = false;
    setRequestingNext(false);
    setNoMoreQuestions(false);
    setSessionNotice("");

    if (!data?.question) {
      setError("Next question payload was empty. Please try again.");
      return;
    }

    const normalizedQuestion = normalizeQuestion(
      data.question,
      parseDifficulty(
        data?.appliedDifficulty ?? data?.requestedDifficulty,
        flaskPredictions.nextDifficulty,
      ),
    );

    const nextQuestionId = getQuestionId(normalizedQuestion);

    // Set current question
    setCurrentQuestion(normalizedQuestion);
    setQuestionStartTime(Date.now());
    questionClockStartRef.current = Date.now();
    setQuestionTime(0);
    setSelectedOption(null);
    setAnswerSubmitted(false);
    setAnswerResult(null);
    setShowExplanation(false);
    setAnswerChanges(0);

    // Update current index
    if (typeof data.questionNumber === "number") {
      setCurrentIndex(data.questionNumber - 1);
    }

    // Update session
    setSession((prev) => ({
      ...(prev || {}),
      totalQuestions: data.totalQuestions || prev?.totalQuestions || 0,
    }));

    if (
      Number.isFinite(Number(data?.appliedDifficulty)) ||
      Number.isFinite(Number(data?.requestedDifficulty))
    ) {
      setDifficultyTelemetry((prev) => ({
        ...prev,
        nodeAppliedDifficulty: Number.isFinite(Number(data?.appliedDifficulty))
          ? Number(data.appliedDifficulty)
          : prev.nodeAppliedDifficulty,
        nodeRequestedDifficulty: Number.isFinite(
          Number(data?.requestedDifficulty),
        )
          ? Number(data.requestedDifficulty)
          : prev.nodeRequestedDifficulty,
        lastNodeSyncAt: new Date().toISOString(),
      }));
    }

    // Update question palette
    setQuestionPalette((prev) => {
      // Check if question already exists
      const existingIndex = prev.findIndex((q) => q.id === nextQuestionId);

      // Reset all "current" statuses
      const resetCurrent = prev.map((q) =>
        q.status === "current" ? { ...q, status: "unanswered" } : q,
      );

      if (existingIndex >= 0) {
        // Update existing question to current
        return resetCurrent.map((q, idx) =>
          idx === existingIndex ? { ...q, status: "current" } : q,
        );
      } else {
        // Add new question as current
        return [
          ...resetCurrent,
          {
            id: nextQuestionId,
            index: resetCurrent.length,
            status: "current",
            isCorrect: null,
            timeSpent: 0,
            concept:
              normalizedQuestion.conceptArea ||
              normalizedQuestion.topic ||
              "General",
            difficulty: normalizedQuestion.difficulty || 0.5,
            expectedTime: normalizedQuestion.expectedTime || 90,
            timeStatus: null,
            timeRatioPercent: 0,
          },
        ];
      }
    });

    // Update total questions in metrics
    setMetrics((prev) => ({
      ...prev,
      totalQuestions: data.totalQuestions || prev.totalQuestions,
    }));
  };

  const handleAnswerConfirmed = (data) => {
    const confirmedQuestionId = data?.questionId;
    const activeQuestionId = getQuestionId(currentQuestion);
    const parsedIsCorrect =
      typeof data?.isCorrect === "boolean"
        ? data.isCorrect
        : String(data?.isCorrect).toLowerCase() === "true";

    if (
      activeQuestionId &&
      confirmedQuestionId &&
      String(activeQuestionId) === String(confirmedQuestionId)
    ) {
      setAnswerSubmitted(true);
      setAnswerResult((prev) => ({
        ...(prev || {}),
        isCorrect: parsedIsCorrect,
        correctAnswer:
          data?.correctAnswer ??
          prev?.correctAnswer ??
          currentQuestion?.correctAnswer,
        explanation:
          data?.explanation ??
          prev?.explanation ??
          currentQuestion?.explanation,
        solutionSteps:
          data?.solutionSteps ??
          prev?.solutionSteps ??
          currentQuestion?.solutionSteps ??
          [],
      }));
    }

    // Find the question in palette and update status
    setQuestionPalette((prev) =>
      prev.map((q) =>
        String(q.id) === String(confirmedQuestionId)
          ? {
              ...q,
              status: "answered",
              isCorrect: parsedIsCorrect,
              timeSpent: data.timeSpent || q.timeSpent,
            }
          : q,
      ),
    );

    // Update current index if provided
    if (typeof data.currentQuestionIndex === "number") {
      setCurrentIndex(data.currentQuestionIndex);
    }
  };

  const handleAnalyticsUpdate = (data) => {
    // Update metrics from analytics
    setMetrics((prev) => ({
      ...prev,
      ...data,
    }));
  };

  const handleQuestionsUpdated = (data) => {
    setSession((prev) => ({
      ...(prev || {}),
      totalQuestions: data.totalQuestions || prev?.totalQuestions || 0,
    }));

    setMetrics((prev) => ({
      ...prev,
      totalQuestions: data.totalQuestions || prev.totalQuestions,
    }));
  };

  const handleConnectionChange = (data) => {
    console.log("Connection state changed:", data);
  };

  const handlePracticeDuration = (data) => {
    if (typeof data?.elapsedSeconds === "number") {
      setMetrics((prev) => ({
        ...prev,
        sessionTime: data.elapsedSeconds,
      }));
    }
  };

  const handleNoMoreQuestions = (data) => {
    requestingNextRef.current = false;
    setRequestingNext(false);
    setDifficultySyncing(false);

    setSessionNotice(
      data?.message || "Questions are over. Submit practice to view results.",
    );
    setNoMoreQuestions(true);

    if (Number.isFinite(Number(data?.totalQuestions))) {
      setMetrics((prev) => ({
        ...prev,
        totalQuestions: Number(data.totalQuestions),
      }));
      setSession((prev) => ({
        ...(prev || {}),
        totalQuestions: Number(data.totalQuestions),
      }));
    }
  };

  // ==================== INITIALIZE PRACTICE ====================
  const initializePractice = async () => {
    try {
      setLoading(true);
      setError(null);

      const configuredInitialDifficulty = Number.isFinite(
        Number(sessionConfig?.initialDifficulty),
      )
        ? Number(sessionConfig.initialDifficulty)
        : Number.isFinite(Number(sessionData?.config?.difficulty))
          ? Number(sessionData.config.difficulty)
          : 0.5;

      const shouldApplyStarterLock =
        Number((sessionData?.answers || []).length || 0) === 0;

      if (shouldApplyStarterLock) {
        setFlaskPredictions((prev) => ({
          ...prev,
          nextDifficulty: configuredInitialDifficulty,
          method: "starter-lock",
          windowSize: DIFFICULTY_WINDOW_SIZE,
          windowRemaining: DIFFICULTY_WINDOW_SIZE,
          lastUpdatedAt: new Date().toISOString(),
        }));

        testService.practiceMode.currentDifficulty =
          configuredInitialDifficulty;
        testService.practiceMode.difficultyWindowSize = DIFFICULTY_WINDOW_SIZE;
        testService.practiceMode.difficultyWindowRemaining =
          DIFFICULTY_WINDOW_SIZE;
      }

      const profileStudentId = authService.getStudentId();
      if (profileStudentId) {
        const profile = await flaskService.getPracticeProfile(profileStudentId);
        if (profile?.success) {
          const profileDifficulty = Number.isFinite(
            Number(profile.currentDifficulty),
          )
            ? Number(profile.currentDifficulty)
            : 0.5;

          setFlaskPredictions((prev) => ({
            ...prev,
            nextDifficulty:
              shouldApplyStarterLock && prev.windowRemaining > 0
                ? prev.nextDifficulty
                : profileDifficulty,
            confidence: profile.modelTrained ? 0.8 : prev.confidence,
            method: profile.modelTrained ? "trained" : "warmup",
            windowSize: DIFFICULTY_WINDOW_SIZE,
            windowRemaining:
              shouldApplyStarterLock && prev.windowRemaining > 0
                ? prev.windowRemaining
                : 0,
            lastUpdatedAt: new Date().toISOString(),
          }));
        }
      }

      // If session exists from navigation, use it
      if (session) {
        const initialQuestion =
          session.questions?.[session.currentQuestionIndex || 0] ||
          session.questions?.[0] ||
          null;

        // Set in test service
        testService.currentSession = {
          ...session,
          status: session.status || "active",
          currentQuestionIndex: session.currentQuestionIndex || 0,
        };
        testService.currentQuestion = normalizeQuestion(
          initialQuestion,
          configuredInitialDifficulty,
        );

        // Initialize WebSocket if needed
        if (!websocketService.isConnected()) {
          websocketService.initialize("/test");
        }

        // Join test session
        const studentId = authService.getStudentId();
        if (session.sessionId && studentId) {
          setTimeout(() => {
            websocketService.send("join-test", {
              sessionId: session.sessionId,
              studentId,
            });
          }, 500);
        }

        // Set current question
        setCurrentQuestion(
          normalizeQuestion(initialQuestion, configuredInitialDifficulty),
        );
        setQuestionStartTime(Date.now());
        questionClockStartRef.current = Date.now();
        sessionClockBaseRef.current =
          Date.now() - getElapsedSessionSeconds(session.startTime) * 1000;
        setMetrics((prev) => ({
          ...prev,
          sessionTime: getElapsedSessionSeconds(session.startTime),
        }));

        // Initialize question palette
        initializeQuestionPalette(
          session.questions || [],
          session.currentQuestionIndex || 0,
        );

        // Update metrics
        setMetrics((prev) => ({
          ...prev,
          totalQuestions:
            session.totalQuestions || session.questions?.length || 0,
        }));

        setLoading(false);
        return;
      }

      // Try restoring previous active session on refresh/reopen
      const restored = await testService.restoreActiveSession();
      if (restored?.session?.testType === "practice") {
        setSession(restored.session);
        setCurrentQuestion(
          normalizeQuestion(
            restored.currentQuestion,
            parseDifficulty(restored.session?.config?.difficulty, 0.5),
          ),
        );
        setQuestionStartTime(Date.now());
        questionClockStartRef.current = Date.now();
        sessionClockBaseRef.current =
          Date.now() -
          getElapsedSessionSeconds(restored.session.startTime) * 1000;
        setMetrics((prev) => ({
          ...prev,
          totalQuestions:
            restored.session.totalQuestions ||
            restored.session.questions?.length ||
            0,
          sessionTime: getElapsedSessionSeconds(restored.session.startTime),
        }));
        initializeQuestionPalette(
          restored.session.questions || [],
          restored.session.currentQuestionIndex || 0,
        );

        if (!websocketService.isConnected()) {
          websocketService.initialize("/test");
        }

        const restoredStudentId = authService.getStudentId();
        if (restored.session.sessionId && restoredStudentId) {
          setTimeout(() => {
            websocketService.send("join-test", {
              sessionId: restored.session.sessionId,
              studentId: restoredStudentId,
            });
          }, 300);
        }

        setLoading(false);
        return;
      }

      // Otherwise create new session
      const studentId = authService.getStudentId();
      if (!studentId) {
        navigate("/auth");
        return;
      }

      // Start with neutral difficulty; learner profile will refine it
      const initialDifficulty = 0.5;

      const config = {
        title: "Adaptive Practice Session",
        selectedTopics: [], // Will be fetched from user preferences
        initialDifficulty: initialDifficulty,
        adaptiveEnabled: true,
        showSolutions: true,
        batchSize: 2,
      };

      const response = await testService.createPracticeTest(config);

      if (response.success) {
        setSession(response.session);
        setCurrentQuestion(
          normalizeQuestion(
            response.firstQuestion,
            parseDifficulty(response.session?.config?.difficulty, 0.5),
          ),
        );
        setQuestionStartTime(Date.now());
        questionClockStartRef.current = Date.now();
        sessionClockBaseRef.current = Date.now();
        initializeQuestionPalette(response.session.questions, 0);

        // Update metrics
        setMetrics((prev) => ({
          ...prev,
          totalQuestions: response.session.totalQuestions,
        }));
      }
    } catch (err) {
      setError(err.message || "Failed to initialize practice session");
    } finally {
      setLoading(false);
    }
  };

  // Initialize question palette
  const initializeQuestionPalette = (questions, activeIndex = 0) => {
    const palette = questions.map((q, index) => ({
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
  };

  // ==================== ANSWER HANDLING ====================
  const handleOptionSelect = (optionId) => {
    if (answerSubmitted) return;
    setSelectedOption(optionId);
    setAnswerChanges((prev) => prev + 1);
  };

  const handleSubmitAnswer = async () => {
    const hasSelection =
      selectedOption !== null &&
      selectedOption !== undefined &&
      selectedOption !== "";

    if (!hasSelection || answerSubmitted || !currentQuestion || submitting)
      return;

    try {
      setSubmitting(true);

      if (!testService.currentSession && session?.sessionId) {
        testService.currentSession = {
          ...session,
          status: session.status || "active",
          currentQuestionIndex:
            session.currentQuestionIndex || currentIndex || 0,
        };
      }
      testService.currentQuestion = normalizeQuestion(
        currentQuestion,
        flaskPredictions.nextDifficulty,
      );

      const timeSpentOnQuestion = Math.floor(
        (Date.now() - questionStartTime) / 1000,
      );

      // Calculate confidence based on behavior (for training)
      const expectedTime = currentQuestion.expectedTime || 90;
      const timeRatio = Math.min(
        2,
        Math.max(0, timeSpentOnQuestion / expectedTime),
      );
      const speedScore = Math.max(0, 1 - Math.abs(1 - timeRatio));
      const changePenalty = Math.min(1, answerChanges / 5);
      const recentAccuracy =
        metrics.answeredQuestions > 0
          ? metrics.correctCount / metrics.answeredQuestions
          : 0.5;

      const autoConfidence = Math.max(
        0.15,
        Math.min(
          0.95,
          0.35 * speedScore + 0.3 * (1 - changePenalty) + 0.25 * recentAccuracy,
        ),
      );

      const answerData = {
        selectedOptions: selectedOption,
        timeSpent: timeSpentOnQuestion,
        answerChanges: answerChanges,
        confidence: autoConfidence,
      };

      // Submit answer via test service
      const result = await testService.submitAnswer(answerData);

      // Update local state
      setAnswerSubmitted(true);
      setAnswerResult({
        ...result,
        correctAnswer:
          result?.correctAnswer ??
          currentQuestion?.correctAnswer ??
          currentQuestion?.correct_answer,
        explanation:
          result?.explanation ??
          currentQuestion?.explanation ??
          currentQuestion?.solution ??
          "",
        solutionSteps:
          result?.solutionSteps ??
          currentQuestion?.solutionSteps ??
          currentQuestion?.solution_steps ??
          [],
      });
      setShowExplanation(false);

      // Update metrics
      setMetrics((prev) => {
        const newCorrectCount = prev.correctCount + (result.isCorrect ? 1 : 0);
        const newWrongCount = prev.wrongCount + (result.isCorrect ? 0 : 1);
        const newAnswered = prev.answeredQuestions + 1;
        const newAccuracy = (newCorrectCount / newAnswered) * 100;

        // Calculate new average time
        const totalTimeSoFar =
          prev.averageTimePerQuestion * prev.answeredQuestions;
        const newAvgTime = (totalTimeSoFar + timeSpentOnQuestion) / newAnswered;

        return {
          ...prev,
          correctCount: newCorrectCount,
          wrongCount: newWrongCount,
          answeredQuestions: newAnswered,
          currentAccuracy: newAccuracy,
          averageTimePerQuestion: newAvgTime,
        };
      });

      // Update question palette
      const currentQuestionId = getQuestionId(currentQuestion);
      const timePerf = getTimePerformanceMetrics(
        timeSpentOnQuestion,
        currentQuestion.expectedTime || 90,
      );
      setQuestionPalette((prev) =>
        prev.map((q) =>
          String(q.id) === String(currentQuestionId)
            ? {
                ...q,
                status: "answered",
                isCorrect: result.isCorrect,
                timeSpent: timeSpentOnQuestion,
                expectedTime:
                  currentQuestion.expectedTime || q.expectedTime || 90,
                timeStatus: timePerf.status,
                timeRatioPercent: timePerf.ratioPercent,
              }
            : q,
        ),
      );

      // Extract features for Flask
      const featureSnapshot = await extractAndSendFeatures(
        currentQuestion,
        result,
      );

      const concept =
        currentQuestion.conceptArea || currentQuestion.topic || "general";
      const remainingBefore = Number.isFinite(
        Number(flaskPredictions.windowRemaining),
      )
        ? Number(flaskPredictions.windowRemaining)
        : 0;

      if (remainingBefore > 0) {
        const remainingAfter = Math.max(0, remainingBefore - 1);

        setFlaskPredictions((prev) => ({
          ...prev,
          windowRemaining: remainingAfter,
        }));
        testService.practiceMode.difficultyWindowRemaining = remainingAfter;

        if (remainingAfter === 0) {
          setDifficultySyncing(true);
          try {
            const studentId = authService.getStudentId();
            const activeSessionId =
              session?.sessionId ||
              testService.currentSession?.sessionId ||
              null;

            if (studentId && activeSessionId) {
              const trainResponse = await flaskService.uploadAttempts(
                studentId,
                [],
                activeSessionId,
                {
                  finalizeSession: true,
                },
              );
              setWindowTrainingTriggered(!!trainResponse?.training_triggered);
            }

            await updateFlaskPredictions(concept, featureSnapshot);
          } finally {
            setDifficultySyncing(false);
          }
        }
      } else {
        setDifficultySyncing(true);
        try {
          await updateFlaskPredictions(concept, featureSnapshot);
        } finally {
          setDifficultySyncing(false);
        }
      }
    } catch (err) {
      setError(err.message || "Failed to submit answer");
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== FEATURE EXTRACTION FOR FLASK ====================
  const extractAndSendFeatures = async (question, result) => {
    try {
      const studentId = authService.getStudentId();
      const concept = question.conceptArea || question.topic || "general";
      const answers = testService.answers || [];

      const accuracy = result.isCorrect ? 1 : 0;
      const responseTime = Math.floor((Date.now() - questionStartTime) / 1000);

      const avgTime =
        answers
          .filter((a) => a.isCorrect)
          .reduce((sum, a) => sum + (a.timeSpent || 0), 0) /
        Math.max(1, answers.filter((a) => a.isCorrect).length);
      const normalizedTime = avgTime > 0 ? responseTime / avgTime : 1;

      const last5Times = answers.slice(-5).map((a) => a.timeSpent || 0);
      const mean5 =
        last5Times.length > 0
          ? last5Times.reduce((a, b) => a + b, 0) / last5Times.length
          : 0;
      const variance5 =
        last5Times.length > 0
          ? last5Times.reduce((a, b) => a + Math.pow(b - mean5, 2), 0) /
            last5Times.length
          : 0;

      const conceptAnswers = answers.filter((a) => a.conceptArea === concept);
      const conceptAccuracy =
        conceptAnswers.length > 0
          ? conceptAnswers.filter((a) => a.isCorrect).length /
            conceptAnswers.length
          : 0.5;

      let streak = 0;
      for (let i = answers.length - 1; i >= 0; i--) {
        if (answers[i].isCorrect) streak++;
        else break;
      }

      const newFeatures = [
        accuracy,
        normalizedTime,
        variance5,
        answerChanges,
        1 - Math.min(1, normalizedTime / 2),
        result.confidence || 0.5,
        conceptAccuracy,
        question.difficulty || 0.5,
        streak,
        answers.length / 20,
        answerChanges > 2 ? 1 : 0,
        (question.difficulty || 0.5) - conceptAccuracy,
      ];

      const recentAnswers = answers.slice(-14);
      let updatedSessionFeatures = features.sessionFeatures;
      if (recentAnswers.length >= 5) {
        const sessionAccuracy = recentAnswers.map((a) => (a.isCorrect ? 1 : 0));
        const sessionTimes = recentAnswers.map((a) => a.timeSpent || 0);

        updatedSessionFeatures = [
          sessionAccuracy.reduce((a, b) => a + b, 0) / sessionAccuracy.length,
          calculateTrend(sessionAccuracy),
          calculateTrend(recentAnswers.map((a) => a.confidence || 0.5)),
          calculateTrend(sessionTimes),
          sessionTimes[sessionTimes.length - 1] - sessionTimes[0],
          sessionTimes.reduce((a, b) => a + b, 0) / 60,
          1,
          recentAnswers
            .filter((a) => a.difficulty > 0.7)
            .filter((a) => a.isCorrect).length /
            Math.max(1, recentAnswers.filter((a) => a.difficulty > 0.7).length),
          1 - calculateStdDev(sessionAccuracy),
          calculateTrend(recentAnswers.map((a) => a.confidence || 0.5)),
          recentAnswers.filter((a) => (a.timeSpent || 0) < 5).length /
            recentAnswers.length,
          calculateSecondHalfDrop(recentAnswers),
        ];
      }

      const updatedConceptHistory = { ...features.conceptHistory };
      const currentHistory = updatedConceptHistory[concept] || [];
      updatedConceptHistory[concept] = [...currentHistory, accuracy].slice(-30);

      const snapshot = {
        practice: [...features.practice, newFeatures],
        conceptHistory: updatedConceptHistory,
        sessionFeatures: updatedSessionFeatures,
      };

      setFeatures(snapshot);

      if (answers.length >= 1) {
        const latestAttempt = answers[answers.length - 1];
        await flaskService.uploadAttempts(
          studentId,
          latestAttempt ? [latestAttempt] : [],
          session?.sessionId || testService.currentSession?.sessionId || null,
        );
      }

      return snapshot;
    } catch (err) {
      console.error("Error extracting features:", err);
      return null;
    }
  };

  // Helper: Calculate trend
  const calculateTrend = (values) => {
    if (values.length < 2) return 0;
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((a, b, i) => a + b * values[i], 0);
    const sumX2 = x.reduce((a, b) => a + b * b, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return isNaN(slope) ? 0 : slope;
  };

  // Helper: Calculate standard deviation
  const calculateStdDev = (values) => {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  };

  // Helper: Calculate second half drop
  const calculateSecondHalfDrop = (answers) => {
    if (answers.length < 4) return 0;
    const half = Math.floor(answers.length / 2);
    const firstHalf = answers.slice(0, half);
    const secondHalf = answers.slice(half);
    const firstAcc =
      firstHalf.filter((a) => a.isCorrect).length / firstHalf.length;
    const secondAcc =
      secondHalf.filter((a) => a.isCorrect).length / secondHalf.length;
    return firstAcc - secondAcc;
  };

  // ==================== FLASK PREDICTIONS ====================
  const updateFlaskPredictions = async (
    concept = "general",
    featureSnapshot = null,
  ) => {
    try {
      const studentId = authService.getStudentId();
      const sourceFeatures = featureSnapshot || features;

      // Get latest features
      const lastFeatures =
        sourceFeatures.practice.length > 0
          ? sourceFeatures.practice[sourceFeatures.practice.length - 1]
          : [];

      if (lastFeatures.length === 12) {
        const conceptHistory = sourceFeatures.conceptHistory[concept] || [];

        const [difficultyResponse, velocityResponse, burnoutResponse] =
          await Promise.all([
            flaskService.getPracticeDifficulty(
              studentId,
              lastFeatures,
              concept,
            ),
            flaskService.getLearningVelocity(
              studentId,
              concept,
              conceptHistory,
            ),
            flaskService.getBurnoutRisk(
              studentId,
              sourceFeatures.sessionFeatures,
            ),
          ]);

        setFlaskPredictions((prev) => ({
          ...prev,
          nextDifficulty: difficultyResponse.nextDifficulty || 0.5,
          confidence: difficultyResponse.confidence || 0,
          method: difficultyResponse.method || "unknown",
          windowSize: DIFFICULTY_WINDOW_SIZE,
          windowRemaining: DIFFICULTY_WINDOW_SIZE,
          lastUpdatedAt: new Date().toISOString(),
          learningVelocity: velocityResponse,
          burnoutRisk: burnoutResponse,
        }));

        // Update test service's current difficulty
        testService.practiceMode.currentDifficulty =
          difficultyResponse.nextDifficulty || 0.5;
        testService.practiceMode.difficultyWindowSize = DIFFICULTY_WINDOW_SIZE;
        testService.practiceMode.difficultyWindowRemaining =
          DIFFICULTY_WINDOW_SIZE;
      }
    } catch (err) {
      console.error("Error updating Flask predictions:", err);
      // Use fallback difficulty
      setFlaskPredictions((prev) => ({
        ...prev,
        nextDifficulty: 0.5,
        confidence: 0.5,
      }));
    }
  };

  // ==================== UPDATE 12 MODELS (on demand) ====================
  const calculateModelsData = useCallback(() => {
    // This would be called when user clicks "Show Detailed Analytics"
    // It calculates the 12 models from the current session data

    const answers = testService.answers;
    if (answers.length === 0) return;

    // 1. Concept Mastery (per concept)
    const conceptMastery = {};
    const conceptMap = {};

    answers.forEach((answer) => {
      const concept = answer.conceptArea || "general";
      if (!conceptMap[concept]) {
        conceptMap[concept] = [];
      }
      conceptMap[concept].push(answer.isCorrect ? 1 : 0);
    });

    Object.entries(conceptMap).forEach(([concept, history]) => {
      const oldMastery = modelsData.conceptMastery[concept] || 0.5;
      const recentAccuracy = history.slice(-5).reduce((a, b) => a + b, 0) / 5;
      const learningRate = 0.3;
      conceptMastery[concept] =
        oldMastery + learningRate * (recentAccuracy - oldMastery);
    });

    // 2. Stability Index
    const stabilityIndex = {};
    Object.entries(conceptMap).forEach(([concept, history]) => {
      if (history.length >= 3) {
        const recent = history.slice(-10);
        const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
        const variance =
          recent.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recent.length;
        stabilityIndex[concept] = Math.max(0, Math.min(1, 1 - variance / 0.25));
      } else {
        stabilityIndex[concept] = 0.5;
      }
    });

    // 3. Confidence Calibration
    const confidenceCalibration = {
      overall: 0.15,
      byDifficulty: {
        easy: 0.08,
        medium: 0.12,
        hard: 0.18,
      },
    };

    // 4. Error Patterns
    const errorPatterns = {
      conceptual: 0.3,
      careless: 0.3,
      guess: 0.2,
      overconfidence: 0.2,
    };

    // 5. Weakness Priority
    const weaknessPriority = Object.entries(conceptMap)
      .map(([concept, history]) => {
        const mastery = history.reduce((a, b) => a + b, 0) / history.length;
        const errorRate = 1 - mastery;
        const daysSince = 1; // Placeholder
        const retentionDecay = Math.min(1, daysSince / 14);
        const weaknessScore = (1 - mastery) * errorRate * retentionDecay;

        return {
          topic: concept,
          score: weaknessScore,
          mastery,
          rank: 0,
          recommendation:
            mastery < 0.4
              ? "Critical: Review fundamental concepts"
              : mastery < 0.6
                ? "Focus: Practice more"
                : "Maintain: Regular review",
        };
      })
      .sort((a, b) => b.score - a.score)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    // 6. Forgetting Curve
    const forgettingCurve = {
      decayConstant: 0.1,
      retentionScores: {},
    };

    // 7. Fatigue Index
    const fatigueIndex = Math.min(
      1,
      0.2 +
        metrics.sessionTime / 3600 +
        (1 - metrics.currentAccuracy / 100) * 0.3,
    );

    // 8. Behavior Profile
    const avgTime = metrics.averageTimePerQuestion || 60;
    let behaviorProfile = "balanced";
    if (avgTime < 30 && answerChanges < 1) {
      behaviorProfile = "impulsive";
    } else if (avgTime > 90 && answerChanges > 2) {
      behaviorProfile = "overthinker";
    }

    // 9. Difficulty Tolerance
    const difficultyTolerance = Math.min(
      1,
      0.3 + (metrics.currentAccuracy / 100) * 0.5,
    );

    // 10. Study Efficiency
    const studyEfficiency = Math.min(
      1,
      metrics.correctCount / Math.max(1, metrics.sessionTime / 60),
    );

    // 11. Focus Loss
    const focusLoss = answerChanges / Math.max(1, answers.length) / 5;

    // 12. Time Allocation
    const timeAllocation = weaknessPriority.slice(0, 5).map((item) => ({
      topic: item.topic,
      recommendedMinutes: Math.round(30 * (1 - item.mastery)),
      priority: item.rank <= 2 ? "high" : item.rank <= 4 ? "medium" : "low",
      reason: item.recommendation,
    }));

    setModelsData({
      conceptMastery,
      stabilityIndex,
      confidenceCalibration,
      errorPatterns,
      weaknessPriority,
      forgettingCurve,
      fatigueIndex,
      behaviorProfile,
      difficultyTolerance,
      studyEfficiency,
      focusLoss,
      timeAllocation,
    });
  }, [metrics, answerChanges, features.conceptHistory]);

  // ==================== NAVIGATION ====================
  const handleNextQuestion = async () => {
    if (!answerSubmitted) {
      // If answer not submitted, skip
      handleSkipQuestion();
    } else {
      if (requestingNextRef.current) return;

      const lockedDifficulty = Number.isFinite(
        Number(flaskPredictions.nextDifficulty),
      )
        ? Number(flaskPredictions.nextDifficulty)
        : 0.5;

      setSessionNotice("");
      setRequestingNext(true);
      requestingNextRef.current = true;

      testService.practiceMode.currentDifficulty = lockedDifficulty;
      testService.practiceMode.difficultyWindowRemaining =
        flaskPredictions.windowRemaining;

      try {
        const watchdog = setTimeout(() => {
          if (requestingNextRef.current) {
            requestingNextRef.current = false;
            setRequestingNext(false);
            setError("Next question is taking too long. Please retry.");
          }
        }, 15000);

        const nextResponse = await testService.requestNextQuestion({
          requestedDifficulty: lockedDifficulty,
          difficultyWindowRemaining: flaskPredictions.windowRemaining,
        });

        if (nextResponse?.status === "no-more") {
          handleNoMoreQuestions(nextResponse.data || {});
        } else if (nextResponse?.status === "ok") {
          handleNextQuestionReceived(nextResponse.data || {});
        }

        clearTimeout(watchdog);
      } catch (error) {
        requestingNextRef.current = false;
        setError(
          error?.message ||
            "Could not load next question. Please check connection and try again.",
        );
        setRequestingNext(false);
      }
    }
  };

  const handleSkipQuestion = () => {
    if (!answerSubmitted) {
      testService.skipQuestion();
    }
  };

  const handlePauseResume = () => {
    if (session?.status === "active") {
      testService.pauseTest();
      setSession((prev) => ({ ...prev, status: "paused" }));
    } else {
      testService.resumeTest();
      setSession((prev) => ({ ...prev, status: "active" }));
    }
  };

  const handleEndSession = async () => {
    try {
      const finalAnswers = [...(testService.answers || [])];
      const finalMetrics = { ...metrics };
      const finalPredictions = { ...flaskPredictions };
      const finalModelsData = { ...modelsData };
      const finalSession = { ...(session || {}) };

      const studentId = authService.getStudentId();
      const activeSessionId =
        session?.sessionId || testService.currentSession?.sessionId || null;

      if (studentId && activeSessionId) {
        await flaskService.uploadAttempts(studentId, [], activeSessionId, {
          finalizeSession: true,
        });
      }

      testService.endTest();
      testService.clearSession();

      // Navigate to results page with data
      navigate("/practice/results", {
        replace: true,
        state: {
          answers: finalAnswers,
          metrics: finalMetrics,
          flaskPredictions: finalPredictions,
          modelsData: finalModelsData,
          session: finalSession,
        },
      });
    } catch (err) {
      setError(err.message || "Failed to end session");
    }
  };

  // ==================== CLEANUP ====================
  const cleanup = () => {
    teardownWebSocketListeners();

    if (sessionTimerRef.current) {
      clearInterval(sessionTimerRef.current);
    }
    if (questionTimerRef.current) {
      clearInterval(questionTimerRef.current);
    }
    if (analyticsUpdateRef.current) {
      clearInterval(analyticsUpdateRef.current);
    }

    requestingNextRef.current = false;
  };

  // ==================== UTILITY FUNCTIONS ====================
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getDifficultyColor = (difficulty) => {
    if (difficulty < 0.3) return "text-green-500";
    if (difficulty < 0.5) return "text-blue-500";
    if (difficulty < 0.7) return "text-yellow-500";
    if (difficulty < 0.9) return "text-orange-500";
    return "text-red-500";
  };

  const getDifficultyBadge = (difficulty) => {
    if (difficulty < 0.3) return "Easy";
    if (difficulty < 0.5) return "Medium-Easy";
    if (difficulty < 0.7) return "Medium";
    if (difficulty < 0.9) return "Hard";
    return "Very Hard";
  };

  const getFormattedAnswer = (value) => {
    if (Array.isArray(value)) return value.join(", ");
    return value ?? "N/A";
  };

  const getCorrectAnswerText = () => {
    const correctAnswer =
      answerResult?.correctAnswer ?? currentQuestion?.correctAnswer;

    if (!currentQuestion) return "N/A";

    if (currentQuestion.type === "NAT") {
      return `${getFormattedAnswer(correctAnswer)}`;
    }

    if (Array.isArray(correctAnswer)) {
      return correctAnswer
        .map((id) => {
          const option = currentQuestion.options?.find((o) =>
            areOptionIdsEqual(o.id, id),
          );
          return option ? `${id}. ${option.text}` : id;
        })
        .join(", ");
    }

    const option = currentQuestion.options?.find((o) =>
      areOptionIdsEqual(o.id, correctAnswer),
    );
    return option ? `${correctAnswer}. ${option.text}` : `${correctAnswer}`;
  };

  const getDisplayedExplanation = () => {
    if (answerResult?.explanation) return answerResult.explanation;
    if (currentQuestion?.explanation) return currentQuestion.explanation;
    return "";
  };

  const getDisplayedSolutionSteps = () => {
    if (Array.isArray(answerResult?.solutionSteps)) {
      return answerResult.solutionSteps;
    }
    if (Array.isArray(currentQuestion?.solutionSteps)) {
      return currentQuestion.solutionSteps;
    }
    return [];
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const toggleDarkMode = () => toggleTheme();

  // ==================== RENDER ====================
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
    <div className="min-h-screen">
      {/* Background with animated gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-sky-50 via-indigo-50 to-fuchsia-100 dark:from-slate-950 dark:via-indigo-950 dark:to-purple-950 -z-10" />

      {/* Animated background elements */}
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
              {/* Session Timer */}
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-full">
                <FiClock className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-medium text-indigo-600">
                  {formatTime(metrics.sessionTime)}
                </span>
              </div>

              {/* Correct/Wrong */}
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

              {/* Accuracy */}
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/30 rounded-full">
                <FiTarget className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-600">
                  {Math.round(metrics.currentAccuracy || 0)}%
                </span>
              </div>

              {/* Next Difficulty */}
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/30 rounded-full">
                <FiZap className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-600">
                  Level: {toPercent(flaskPredictions.nextDifficulty)} ·{" "}
                  {flaskPredictions.windowRemaining}/
                  {flaskPredictions.windowSize}
                </span>
              </div>
            </div>

            {/* Right Section */}
            <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-3">
              {/* View Mode Toggle */}
              <button
                onClick={() =>
                  setViewMode(viewMode === "split" ? "full" : "split")
                }
                className="hidden sm:inline-flex p-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                title="Toggle view mode"
              >
                {viewMode === "split" ? (
                  <FiMaximize2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                ) : (
                  <FiMinimize2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                )}
              </button>

              {/* Palette Toggle */}
              <button
                onClick={() => setShowPalette(!showPalette)}
                className="p-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                title="Toggle question tracker"
              >
                <FiGrid className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>

              {/* Analytics Toggle */}
              <button
                onClick={() => {
                  setShowAnalytics(!showAnalytics);
                  if (!showAnalytics) {
                    calculateModelsData();
                  }
                }}
                className="hidden sm:inline-flex p-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                title="Toggle analytics"
              >
                <FiBarChart2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>

              {/* Pause/Resume */}
              <button
                onClick={handlePauseResume}
                className="hidden md:inline-flex p-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                title={session?.status === "active" ? "Pause" : "Resume"}
              >
                {session?.status === "active" ? (
                  <FiPause className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                ) : (
                  <FiPlay className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                )}
              </button>

              {/* Dark Mode Toggle */}
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
              >
                {isDark ? (
                  <FiSun className="w-5 h-5 text-yellow-500" />
                ) : (
                  <FiMoon className="w-5 h-5 text-gray-600" />
                )}
              </button>

              {/* Fullscreen Toggle */}
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

              {/* End Session */}
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
                {toPercent(flaskPredictions.nextDifficulty)}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex min-h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)] flex-col lg:flex-row">
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

        {/* Left Sidebar - Learning Parameters (collapsible) */}
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

                {/* Basic Metrics */}
                <div className="space-y-4">
                  {/* Session Timer */}
                  <div className="p-4 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl text-white">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm opacity-90">Session Time</span>
                      <FiClock className="w-5 h-5 opacity-90" />
                    </div>
                    <p className="text-3xl font-bold">
                      {formatTime(metrics.sessionTime)}
                    </p>
                  </div>

                  {/* Question Timer */}
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

                  {/* Current Difficulty */}
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Current Difficulty
                      </span>
                      <FiTarget className="w-4 h-4 text-indigo-600" />
                    </div>
                    <p
                      className={`text-2xl font-bold ${getDifficultyColor(
                        currentQuestion?.difficulty || 0.5,
                      )}`}
                    >
                      {getDifficultyBadge(currentQuestion?.difficulty || 0.5)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Level: {toPercent(currentQuestion?.difficulty || 0.5)}
                    </p>
                  </div>

                  {/* Next Difficulty */}
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
                      Confidence:{" "}
                      {(flaskPredictions.confidence * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs opacity-80 mt-1">
                      Applies for next {flaskPredictions.windowRemaining}/
                      {flaskPredictions.windowSize} questions
                    </p>
                    <p className="text-xs opacity-80 mt-1">
                      Status:{" "}
                      {difficultySyncing ? "Updating next level..." : "Ready"}
                    </p>
                    {windowTrainingTriggered && (
                      <p className="text-xs opacity-90 mt-1 text-emerald-100">
                        Learning model update started for new window
                      </p>
                    )}
                  </div>

                  {/* Quick Stats */}
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

                  <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Avg Time/Question
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {Math.round(metrics.averageTimePerQuestion || 0)}s
                    </p>
                  </div>

                  {/* View Detailed Analytics Button */}
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
              {/* Question Card */}
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
                      className={`px-3 py-1 rounded-full text-sm font-medium ${getDifficultyColor(
                        currentQuestion.difficulty,
                      )} bg-opacity-10 border`}
                      style={{
                        backgroundColor: `${
                          currentQuestion.difficulty < 0.3
                            ? "rgba(34, 197, 94, 0.1)"
                            : currentQuestion.difficulty < 0.5
                              ? "rgba(59, 130, 246, 0.1)"
                              : currentQuestion.difficulty < 0.7
                                ? "rgba(234, 179, 8, 0.1)"
                                : currentQuestion.difficulty < 0.9
                                  ? "rgba(249, 115, 22, 0.1)"
                                  : "rgba(239, 68, 68, 0.1)"
                        }`,
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
                    <p className="text-xs text-emerald-500">Questions Left</p>
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

                      {(getDisplayedExplanation() ||
                        getDisplayedSolutionSteps()?.length > 0) && (
                        <button
                          onClick={() => setShowExplanation((prev) => !prev)}
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
                        Correct answer: {getCorrectAnswerText()}
                      </p>
                    )}

                    {showExplanation && (
                      <div className="mt-3 rounded-lg bg-white/70 dark:bg-gray-800/60 p-3">
                        {getDisplayedExplanation() && (
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            {getDisplayedExplanation()}
                          </p>
                        )}
                        {getDisplayedSolutionSteps()?.length > 0 && (
                          <ol className="mt-2 list-decimal list-inside space-y-1">
                            {getDisplayedSolutionSteps().map((step, idx) => (
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

                {/* Palette Grid */}
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2.5 mb-6">
                  {questionPalette.map((q) => (
                    <div
                      className={`relative aspect-square rounded-xl flex items-center justify-center text-sm font-bold transition-all border ${
                        q.status === "current"
                          ? "bg-gradient-to-r from-fuchsia-500 via-purple-600 to-indigo-600 text-white shadow-lg scale-105 ring-2 ring-purple-200 border-purple-200"
                          : q.status === "answered"
                            ? q.isCorrect
                              ? "bg-gradient-to-br from-emerald-200 to-lime-200 dark:from-emerald-900/40 dark:to-lime-900/40 text-emerald-800 dark:text-emerald-200 border-emerald-400"
                              : "bg-gradient-to-br from-rose-200 to-orange-200 dark:from-rose-900/40 dark:to-orange-900/40 text-rose-800 dark:text-rose-200 border-rose-400"
                            : "bg-gradient-to-br from-slate-100 to-indigo-50 dark:from-gray-700 dark:to-gray-800 text-gray-500 dark:text-gray-300 border-slate-300 dark:border-gray-600"
                      }`}
                      title={`Q${q.index + 1} - ${q.concept} (${Math.round(
                        q.difficulty * 100,
                      )}% difficulty) - ${q.timeSpent}s / ${q.expectedTime || 90}s`}
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

                {/* Legend */}
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
                    <span className="text-xs text-gray-400 ml-auto">
                      with time
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

                {/* Session Summary */}
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
                    <div className="flex justify-between">
                      <span className="text-xs opacity-80">Avg Time</span>
                      <span className="text-sm font-bold">
                        {Math.round(metrics.averageTimePerQuestion || 0)}s
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Analytics Sidebar (Detailed 12 Models) */}
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

                {/* Analytics Mode Toggle */}
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
                  // Basic Analytics View
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

                    {/* Concept Performance */}
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

                    {/* Flask Predictions */}
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
                  // Detailed 12 Models View
                  <div className="space-y-4">
                    {/* 1. Concept Mastery */}
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

                    {/* 2. Stability Index */}
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

                    {/* 3. Confidence Calibration */}
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

                    {/* 4. Error Patterns */}
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

                    {/* 5. Weakness Priority */}
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

                    {/* 6. Forgetting Curve */}
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

                    {/* 7. Fatigue Index */}
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

                    {/* 8. Behavior Profile */}
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

                    {/* 9. Difficulty Tolerance */}
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

                    {/* 10. Study Efficiency */}
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

                    {/* 11. Focus Loss */}
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

                    {/* 12. Time Allocation */}
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

                    {/* Recommendation Summary */}
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

export default PracticePage;
