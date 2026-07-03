// hooks/usePracticeAnswers.jsx

import { useCallback } from "react";

export const usePracticeAnswers = ({
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
}) => {
  const handleOptionSelect = useCallback(
    (optionId) => {
      if (answerSubmitted) return;
      setSelectedOption(optionId);
      setAnswerChanges((prev) => prev + 1);
    },
    [answerSubmitted, setSelectedOption, setAnswerChanges],
  );

  const handleSubmitAnswer = useCallback(async () => {
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

    // ==================== FIX: Convert to seconds ====================
    // Calculate time spent in seconds (not milliseconds)
    const timeSpentOnQuestion = Math.floor(
      (Date.now() - questionStartTime) / 1000
    );
    // ==================== END OF FIX ====================

    const expectedTime = currentQuestion.expectedTime || 90;
    const timeRatio = Math.min(
      2,
      Math.max(0, timeSpentOnQuestion / expectedTime)
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
        0.35 * speedScore + 0.3 * (1 - changePenalty) + 0.25 * recentAccuracy
      )
    );

    const answerData = {
      selectedOptions: selectedOption,
      timeSpent: timeSpentOnQuestion, // Now in seconds
      answerChanges: answerChanges,
      confidence: autoConfidence,
    };

    // Submit answer via test service
    // const result = await testService.submitAnswer(answerData);
      const result = await testService.submitAnswer(answerData);

      // ==================== FIX: Update UI state ====================
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
      setShowHints(false);

      // ==================== FIX: Update metrics ====================
      setMetrics((prev) => {
        const newCorrectCount = prev.correctCount + (result.isCorrect ? 1 : 0);
        const newWrongCount = prev.wrongCount + (result.isCorrect ? 0 : 1);
        const newAnswered = prev.answeredQuestions + 1;
        const newAccuracy = (newCorrectCount / Math.max(1, newAnswered)) * 100;

        const totalTimeSoFar =
          prev.averageTimePerQuestion * prev.answeredQuestions;
        const newAvgTime =
          (totalTimeSoFar + timeSpentOnQuestion) / Math.max(1, newAnswered);

        return {
          ...prev,
          correctCount: newCorrectCount,
          wrongCount: newWrongCount,
          answeredQuestions: newAnswered,
          currentAccuracy: newAccuracy,
          averageTimePerQuestion: newAvgTime,
        };
      });

      // ==================== FIX: Update question palette ====================
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

      // ==================== FIX: Save attempt incrementally ====================
      const studentId = authService.getStudentId();
      const activeSessionId =
        session?.sessionId || testService.currentSession?.sessionId || null;

      if (studentId && activeSessionId) {
        try {
          await flaskService.savePracticeAttempt(
            studentId,
            {
              questionId: currentQuestionId,
              concept:
                currentQuestion.conceptArea ||
                currentQuestion.topic ||
                "general",
              isCorrect: result.isCorrect,
              timeSpent: timeSpentOnQuestion,
              difficulty: currentQuestion.difficulty || 0.5,
              answerChanges: answerChanges,
              confidence: autoConfidence,
              timestamp: new Date().toISOString(),
            },
            activeSessionId,
          );
        } catch (saveError) {
          console.warn(
            "[PracticePage] Could not save incrementally:",
            saveError,
          );
        }
      }

      // ==================== FIX: Extract and send features ====================
      let featureSnapshot = null;
      try {
        featureSnapshot = await extractAndSendFeatures(currentQuestion, result);
      } catch (extractError) {
        console.warn("[PracticePage] Feature extraction failed:", extractError);
        // ==================== FIX: Create fallback feature snapshot ====================
        const concept =
          currentQuestion.conceptArea || currentQuestion.topic || "general";
        const fallbackFeatures = [
          result.isCorrect ? 1 : 0,
          0.5,
          0.5,
          0.5,
          0.5,
          0.5,
          0.5,
          currentQuestion.difficulty || 0.5,
          0,
          0.5,
          0,
          0.5,
        ];
        featureSnapshot = {
          practice: [fallbackFeatures],
          conceptHistory: {
            [concept]: [result.isCorrect ? 1 : 0],
          },
          sessionFeatures: [],
        };
      }

      // ==================== FIX: Update predictions ====================
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
          entriesLeftForRetraining: remainingAfter,
        }));

        if (testService?.practiceMode) {
          testService.practiceMode.difficultyWindowRemaining = remainingAfter;
        }

        if (remainingAfter === 0) {
          setDifficultySyncing(true);
          try {
            if (studentId && activeSessionId) {
              const trainResponse = await flaskService.uploadAttempts(
                studentId,
                [],
                activeSessionId,
                { finalizeSession: true },
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
      console.error("[PracticePage] Submit answer error:", err);
      setError(err.message || "Failed to submit answer");
    } finally {
      setSubmitting(false);
    }
  }, [
    selectedOption,
    answerSubmitted,
    currentQuestion,
    submitting,
    session,
    testService,
    normalizeQuestion,
    flaskPredictions,
    questionStartTime,
    answerChanges,
    metrics,
    currentIndex,
    setSubmitting,
    setAnswerSubmitted,
    setAnswerResult,
    setShowExplanation,
    setShowHints,
    setMetrics,
    setQuestionPalette,
    setFlaskPredictions,
    setDifficultySyncing,
    setWindowTrainingTriggered,
    setError,
    getQuestionId,
    getTimePerformanceMetrics,
    authService,
    flaskService,
    extractAndSendFeatures,
    updateFlaskPredictions,
  ]);

  return {
    handleOptionSelect,
    handleSubmitAnswer,
  };
};
