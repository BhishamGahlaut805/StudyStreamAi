// utils/practiceHelpers.js

export const getQuestionId = (question) =>
  question?.id || question?._id || question?.questionId || null;

export const parseDifficulty = (value, fallback = 0.5) => {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.max(0.1, Math.min(0.95, parsed))
    : fallback;
};

export const normalizeQuestion = (question, fallbackDifficulty = 0.5) => {
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
    correctAnswer: question?.correctAnswer ?? question?.correct_answer ?? null,
    explanation: question?.explanation ?? question?.solution ?? "",
    hints: Array.isArray(question?.hints) ? question.hints : [],
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

export const areOptionIdsEqual = (a, b) => String(a) === String(b);

export const getElapsedSessionSeconds = (startTime) => {
  if (!startTime) return 0;
  const startMs = new Date(startTime).getTime();
  if (Number.isNaN(startMs)) return 0;
  return Math.max(0, Math.floor((Date.now() - startMs) / 1000));
};

export const toPercent = (value, fractionDigits = 0) => {
  const normalized = Math.max(0, Math.min(1, Number(value) || 0));
  return `${(normalized * 100).toFixed(fractionDigits)}%`;
};

export const getTimePerformanceMetrics = (timeSpent = 0, expectedTime = 90) => {
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

export const formatTime = (seconds) => {
  // ==================== FIX: Handle milliseconds detection ====================
  let totalSeconds = seconds;
  // If seconds > 10000 (2.7 hours), it's likely in milliseconds
  if (totalSeconds > 10000) {
    totalSeconds = Math.floor(totalSeconds / 1000);
  }
  // ==================== END OF FIX ====================

  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};
// practiceHelpers.js - Ensure formatSeconds handles milliseconds

export const formatSeconds = (seconds) => {
  // ==================== FIX: Handle milliseconds detection ====================
  let totalSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  // If totalSeconds > 10000, it's likely in milliseconds
  if (totalSeconds > 10000) {
    totalSeconds = Math.floor(totalSeconds / 1000);
  }
  // ==================== END OF FIX ====================

  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}m ${s}s`;
};

export const getDifficultyColor = (difficulty) => {
  if (difficulty < 0.3) return "text-green-500";
  if (difficulty < 0.5) return "text-blue-500";
  if (difficulty < 0.7) return "text-yellow-500";
  if (difficulty < 0.9) return "text-orange-500";
  return "text-red-500";
};

export const getDifficultyBadge = (difficulty) => {
  if (difficulty < 0.3) return "Easy";
  if (difficulty < 0.5) return "Medium-Easy";
  if (difficulty < 0.7) return "Medium";
  if (difficulty < 0.9) return "Hard";
  return "Very Hard";
};

export const getFormattedAnswer = (value) => {
  if (Array.isArray(value)) return value.join(", ");
  return value ?? "N/A";
};

export const getCorrectAnswerText = (answerResult, currentQuestion) => {
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

export const getDisplayedExplanation = (answerResult, currentQuestion) => {
  if (answerResult?.explanation) return answerResult.explanation;
  if (currentQuestion?.explanation) return currentQuestion.explanation;
  return "";
};

export const getDisplayedSolutionSteps = (answerResult, currentQuestion) => {
  if (Array.isArray(answerResult?.solutionSteps)) {
    return answerResult.solutionSteps;
  }
  if (Array.isArray(currentQuestion?.solutionSteps)) {
    return currentQuestion.solutionSteps;
  }
  return [];
};

export const getDisplayedHints = (answerResult, currentQuestion) => {
  if (Array.isArray(answerResult?.hints)) {
    return answerResult.hints;
  }
  if (Array.isArray(currentQuestion?.hints)) {
    return currentQuestion.hints;
  }
  return [];
};

export const calculateTrend = (values) => {
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

export const calculateStdDev = (values) => {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
};

export const calculateSecondHalfDrop = (answers) => {
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
