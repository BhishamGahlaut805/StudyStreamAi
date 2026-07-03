// hooks/usePracticeWebSocket.js

import { useEffect } from "react";
import testService from "../../../services/testService";

export const usePracticeWebSocket = ({
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
}) => {
  // ==================== WEB SOCKET HANDLERS ====================

  const handleTestJoined = (data) => {
    setSession((prev) => ({
      ...(prev || {}),
      ...data,
    }));

    // ==================== FIX: Only update session time if it's a new value ====================
    if (typeof data?.elapsedSessionSeconds === "number") {
      // Only update if the value is not 0 or if we have a valid reason to update
      // This prevents WebSocket from overwriting our 0 value
      if (data.elapsedSessionSeconds > 0) {
        setMetrics((prev) => ({
          ...prev,
          sessionTime: data.elapsedSessionSeconds,
        }));
      }
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
      setShowHints(false);

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

    // Update question palette
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

    if (typeof data.currentQuestionIndex === "number") {
      setCurrentIndex(data.currentQuestionIndex);
    }
  };

  const handleAnalyticsUpdate = (data) => {
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
  // ==================== FIX: Only update if we have a valid non-zero value ====================
  if (typeof data?.elapsedSeconds === "number" && data.elapsedSeconds > 0) {
    // Only update if the session is active and the value is reasonable
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

  // ==================== SETUP & TEARDOWN ====================

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

  return {
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
  };
};
