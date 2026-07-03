// hooks/usePracticeNavigation.js

import { useCallback, useEffect } from "react";

export const usePracticeNavigation = ({
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
}) => {
  // ==================== HANDLERS ====================

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

    setCurrentQuestion(normalizedQuestion);
    setQuestionStartTime(Date.now());
    questionClockStartRef.current = Date.now();
    setQuestionTime(0);
    setSelectedOption(null);
    setAnswerSubmitted(false);
    setAnswerResult(null);
    setShowExplanation(false);
    setShowHints(false);
    setAnswerChanges(0);

    if (typeof data.questionNumber === "number") {
      setCurrentIndex(data.questionNumber - 1);
    }

    setSession((prev) => ({
      ...(prev || {}),
      totalQuestions: data.totalQuestions || prev?.totalQuestions || 0,
    }));

    setQuestionPalette((prev) => {
      const existingIndex = prev.findIndex((q) => q.id === nextQuestionId);
      const resetCurrent = prev.map((q) =>
        q.status === "current" ? { ...q, status: "unanswered" } : q,
      );

      if (existingIndex >= 0) {
        return resetCurrent.map((q, idx) =>
          idx === existingIndex ? { ...q, status: "current" } : q,
        );
      } else {
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

    setMetrics((prev) => ({
      ...prev,
      totalQuestions: data.totalQuestions || prev.totalQuestions,
    }));
  };

  // ==================== NAVIGATION HANDLERS ====================

  const handleNextQuestion = useCallback(async () => {
    if (!answerSubmitted) {
      handleSkipQuestion();
      return;
    }

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

      const nextResponse = await requestNextQuestion({
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
  }, [
    answerSubmitted,
    flaskPredictions,
    requestingNextRef,
    setError,
    setRequestingNext,
    setSessionNotice,
    requestNextQuestion,
  ]);

  const handleSkipQuestion = useCallback(() => {
    if (!answerSubmitted) {
      testService.skipQuestion();
    }
  }, [answerSubmitted]);

  const handlePauseResume = useCallback(() => {
    if (session?.status === "active") {
      testService.pauseTest();
      setSession((prev) => ({ ...prev, status: "paused" }));
    } else {
      testService.resumeTest();
      setSession((prev) => ({ ...prev, status: "active" }));
    }
  }, [session, setSession]);

  const handleEndSession = useCallback(async () => {
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
  }, [metrics, flaskPredictions, modelsData, session, navigate, setError]);

  // ==================== INITIALIZATION ====================

  // usePracticeNavigation.jsx - Fix initializePractice
  // usePracticeNavigation.jsx - Replace initializePractice with this

  const initializePractice = useCallback(async () => {
    if (initializingRef.current) {
      console.log("[PracticePage] Initialization already in progress");
      return;
    }

    // Check if we already have a session and question loaded
    if (session && currentQuestion && session.status === "active") {
      console.log(
        "[PracticePage] Session already active, skipping initialization",
      );
      setLoading(false);
      return;
    }

    initializingRef.current = true;

    try {
      setLoading(true);
      setError(null);

      // ==================== STEP 1: Check for persisted session in localStorage ====================
      const persisted = testService.getPersistedSession();

      // Debug what we found
      console.log(
        "[PracticePage] Persisted session check:",
        persisted ? "FOUND" : "NOT FOUND",
      );
      if (persisted) {
        console.log(
          "[PracticePage] Persisted sessionId:",
          persisted.session?.sessionId,
        );
        console.log(
          "[PracticePage] Persisted sessionTime:",
          persisted.session?.sessionTime,
        );
        console.log(
          "[PracticePage] Persisted questions count:",
          persisted.session?.questions?.length,
        );
        console.log(
          "[PracticePage] Persisted currentQuestion:",
          !!persisted.currentQuestion,
        );
      }

      // If we have a valid persisted session with a current question, restore it
      if (persisted?.session?.sessionId && persisted?.currentQuestion) {
        console.log(
          "[PracticePage] Found valid persisted session, restoring...",
        );

        try {
          // First restore from localStorage directly
          const sessionTime =
            persisted.analytics?.sessionTime ||
            persisted.session?.sessionTime ||
            0;
          const currentIndex =
            persisted.session.currentQuestionIndex !== undefined
              ? persisted.session.currentQuestionIndex
              : persisted.currentIndex || 0;

          console.log(
            "[PracticePage] Restoring session at time:",
            sessionTime,
            "seconds",
          );
          console.log("[PracticePage] Restoring at index:", currentIndex);

          // Set session
          setSession({
            ...persisted.session,
            status: persisted.session.status || "active",
            sessionTime: sessionTime,
            currentQuestionIndex: currentIndex,
          });

          // Set current question
          setCurrentQuestion(persisted.currentQuestion);

          // Set metrics with preserved session time
          setMetrics({
            correctCount: persisted.analytics?.correctCount || 0,
            wrongCount: persisted.analytics?.wrongCount || 0,
            totalQuestions:
              persisted.analytics?.totalQuestions ||
              persisted.session?.totalQuestions ||
              0,
            answeredQuestions: persisted.analytics?.answeredQuestions || 0,
            currentAccuracy: persisted.analytics?.currentAccuracy || 0,
            sessionTime: sessionTime,
            questionTime: 0,
            averageTimePerQuestion: persisted.analytics?.timePerQuestion || 0,
          });

          // Set current index
          setCurrentIndex(currentIndex);

          // Set flask predictions if available
          if (persisted.flaskPredictions) {
            setFlaskPredictions(persisted.flaskPredictions);
          }

          // Set difficulty telemetry if available
          if (persisted.difficultyTelemetry) {
            setDifficultyTelemetry(persisted.difficultyTelemetry);
          }

          // Build question palette from persisted questions
          if (
            persisted.session?.questions &&
            persisted.session.questions.length > 0
          ) {
            const palette = persisted.session.questions.map((q, idx) => ({
              id: q.id || q._id || q.questionId,
              index: idx,
              status: idx === currentIndex ? "current" : "unanswered",
              isCorrect: null,
              timeSpent: 0,
              concept: q.conceptArea || q.concept_area || q.topic || "General",
              difficulty: parseDifficulty(q.difficulty, 0.5),
              expectedTime: q.expectedTime || 90,
              timeStatus: null,
              timeRatioPercent: 0,
            }));
            setQuestionPalette(palette);
          }

          // Set question start time
          const now = Date.now();
          setQuestionStartTime(now);
          questionClockStartRef.current = now;

          // Set session base time for timer - CRITICAL for timer to start from correct time
          sessionClockBaseRef.current = now - sessionTime * 1000;
          console.log(
            "[PracticePage] Session base time set to:",
            sessionClockBaseRef.current,
            "from time:",
            sessionTime,
          );

          // Also try to restore via testService for consistency
          await testService.restoreActiveSession();

          setLoading(false);
          initializingRef.current = false;
          return;
        } catch (restoreError) {
          console.error(
            "[PracticePage] Failed to restore session:",
            restoreError,
          );
          // Continue to create new session if restore fails
        }
      }

      // ==================== STEP 2: Check navigation state ====================
      if (sessionData?.sessionId && sessionData?.questions?.length > 0) {
        console.log("[PracticePage] Using session from navigation state");
        const initialQuestion =
          sessionData.questions?.[sessionData.currentQuestionIndex || 0] ||
          sessionData.questions?.[0];
        if (initialQuestion) {
          setSession(sessionData);
          setCurrentQuestion(normalizeQuestion(initialQuestion, 0.5));
          initializeQuestionPalette(
            sessionData.questions,
            sessionData.currentQuestionIndex || 0,
          );
          setMetrics((prev) => ({
            ...prev,
            totalQuestions:
              sessionData.totalQuestions || sessionData.questions?.length || 0,
            sessionTime: 0,
          }));
          const now = Date.now();
          setQuestionStartTime(now);
          questionClockStartRef.current = now;
          sessionClockBaseRef.current = now;
          setLoading(false);
          initializingRef.current = false;
          return;
        }
      }

      // ==================== STEP 3: Create a new session ====================
      console.log("[PracticePage] Creating new practice session");

      const studentId = authService.getStudentId();
      if (!studentId) {
        navigate("/auth");
        setLoading(false);
        initializingRef.current = false;
        return;
      }

      const config = {
        title: "Adaptive Practice Session",
        selectedTopics: sessionConfig?.selectedTopics || [],
        initialDifficulty: 0.5,
        adaptiveEnabled: true,
        showSolutions: true,
        batchSize: 60,
      };

      // Clear any existing persisted data before creating new session
      testService.clearPersistedSession();

      const response = await testService.createPracticeTest(config);

      if (response?.success && isMounted.current) {
        console.log("[PracticePage] New session created successfully");
        setSession(response.session);
        setCurrentQuestion(normalizeQuestion(response.firstQuestion, 0.5));

        const now = Date.now();
        setQuestionStartTime(now);
        questionClockStartRef.current = now;
        sessionClockBaseRef.current = now;

        setMetrics((prev) => ({
          ...prev,
          sessionTime: 0,
          questionTime: 0,
          totalQuestions: response.session.totalQuestions || 0,
        }));

        initializeQuestionPalette(response.session.questions || [], 0);
      } else {
        console.error("[PracticePage] Failed to create new session");
        setError("Failed to initialize practice session. Please try again.");
      }
    } catch (err) {
      console.error("[PracticePage] Initialization error:", err);
      if (isMounted.current) {
        setError(err.message || "Failed to initialize practice session");
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
      initializingRef.current = false;
    }
  }, [
    session,
    currentQuestion,
    sessionData,
    sessionConfig,
    initializingRef,
    isMounted,
    setLoading,
    setError,
    setSession,
    setCurrentQuestion,
    setQuestionStartTime,
    setMetrics,
    setCurrentIndex,
    setQuestionPalette,
    setFlaskPredictions,
    setDifficultyTelemetry,
    initializeQuestionPalette,
    navigate,
    testService,
    authService,
    parseDifficulty,
    normalizeQuestion,
    questionClockStartRef,
    sessionClockBaseRef,
  ]);

  
  const cleanup = useCallback(() => {
    teardownWebSocketListeners();

    if (sessionTimerRef.current) {
      clearInterval(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
    if (questionTimerRef.current) {
      clearInterval(questionTimerRef.current);
      questionTimerRef.current = null;
    }
    if (analyticsUpdateRef.current) {
      clearInterval(analyticsUpdateRef.current);
      analyticsUpdateRef.current = null;
    }

    requestingNextRef.current = false;
  }, [
    teardownWebSocketListeners,
    sessionTimerRef,
    questionTimerRef,
    analyticsUpdateRef,
    requestingNextRef,
  ]);

  // ==================== EFFECTS ====================

  // Single initialization effect
  useEffect(() => {
    if (!initializingRef.current) {
      initializePractice();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    handleNextQuestion,
    handleSkipQuestion,
    handlePauseResume,
    handleEndSession,
    initializePractice,
    initializeQuestionPalette,
    cleanup,
  };
};;;
