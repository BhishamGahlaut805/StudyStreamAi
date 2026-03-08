import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FiArrowLeft,
  FiAward,
  FiActivity,
  FiBarChart2,
  FiBookOpen,
  FiCheckCircle,
  FiClock,
  FiDownload,
  FiInfo,
  FiMaximize2,
  FiMinimize2,
  FiMoon,
  FiSun,
  FiTarget,
  FiTrendingDown,
  FiTrendingUp,
  FiXCircle,
} from "react-icons/fi";
import { FaBrain } from "react-icons/fa";
import testService from "../../services/testService";
import analyticsService from "../../services/analyticsService";
import { useTheme } from "../../context/ThemeContext";

const MODEL_TITLES = [
  "1. Concept Mastery",
  "2. Stability Index",
  "3. Confidence Calibration",
  "4. Error Pattern Classification",
  "5. Weakness Severity Ranking",
  "6. Forgetting Curve",
  "7. Fatigue Sensitivity",
  "8. Cognitive Behavior Profile",
  "9. Difficulty Tolerance",
  "10. Study Efficiency",
  "11. Focus Loss Detection",
  "12. Adaptive Time Allocation",
];

const normalizeModelData = (modelsData = {}) => ({
  conceptMastery: modelsData.conceptMastery || {},
  stabilityIndex: modelsData.stabilityIndex || {},
  confidenceCalibration: modelsData.confidenceCalibration || {},
  errorPatterns: modelsData.errorPatterns || {},
  weaknessPriority: Array.isArray(modelsData.weaknessPriority)
    ? modelsData.weaknessPriority
    : [],
  forgettingCurve: modelsData.forgettingCurve || {},
  fatigueIndex: modelsData.fatigueIndex,
  behaviorProfile: modelsData.behaviorProfile,
  difficultyTolerance: modelsData.difficultyTolerance,
  studyEfficiency: modelsData.studyEfficiency,
  focusLoss: modelsData.focusLoss,
  timeAllocation: Array.isArray(modelsData.timeAllocation)
    ? modelsData.timeAllocation
    : [],
});

const clamp = (value, min = 0, max = 1) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
};

const toPercent = (value, digits = 0) =>
  `${(clamp(value) * 100).toFixed(digits)}%`;

const formatSeconds = (seconds) => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hr = Math.floor(total / 3600);
  const min = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  if (hr > 0) return `${hr}h ${min}m ${sec}s`;
  return `${min}m ${sec}s`;
};

const subjectLabel = (subject = "") => {
  const map = {
    mathematics: "Mathematics",
    english: "English",
    reasoning: "Reasoning",
    general_knowledge: "General Knowledge",
  };
  return map[subject] || "General";
};

const toRatio = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  if (parsed > 1) return clamp(parsed / 100);
  return clamp(parsed);
};

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const extractQuestionsList = (questionPaper) => {
  const bySubject = questionPaper?.questionsBySubject || {};
  const flattened = Object.values(bySubject).flat().filter(Boolean);
  return flattened.sort(
    (a, b) => Number(a?.number || 0) - Number(b?.number || 0),
  );
};

const getChartPath = (values = [], width = 360, height = 120) => {
  if (!values.length) return "";
  if (values.length === 1) return `M 0 ${height / 2} L ${width} ${height / 2}`;

  return values
    .map((point, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - clamp(point) * height;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
};

const RealResult = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();

  const payload = location.state || {};
  const session = payload.session || {};
  const metrics = payload.metrics || {};
  const answers = Array.isArray(payload.answers) ? payload.answers : [];
  const modelsData = normalizeModelData(payload.modelsData || {});

  const [paperLoading, setPaperLoading] = useState(false);
  const [questionPaper, setQuestionPaper] = useState(null);
  const [paperError, setPaperError] = useState("");
  const [fullScreen, setFullScreen] = useState(false);

  useEffect(() => {
    const onFullScreenChange = () => {
      setFullScreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", onFullScreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullScreenChange);
    };
  }, []);

  const handleToggleFullScreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // ignore browser fullscreen errors
    }
  };

  useEffect(() => {
    const sessionId = session?.sessionId;
    if (!sessionId) return;

    let active = true;
    const loadPaper = async () => {
      setPaperLoading(true);
      setPaperError("");
      try {
        const response = await testService.generateQuestionPaper(sessionId);
        if (!active) return;
        setQuestionPaper(response?.questionPaper || null);
      } catch (error) {
        if (!active) return;
        setPaperError(error?.message || "Could not load full question paper");
      } finally {
        if (active) setPaperLoading(false);
      }
    };

    loadPaper();
    return () => {
      active = false;
    };
  }, [session?.sessionId]);

  const questionsList = useMemo(
    () => extractQuestionsList(questionPaper),
    [questionPaper],
  );

  const computedSummary = useMemo(() => {
    const EXAM_TOTAL_QUESTIONS = 100;
    const EXAM_DURATION_SECONDS = 60 * 60;
    const CORRECT_MARKS = 2;
    const WRONG_MARKS = -0.5;

    if (!questionsList.length) {
      const correct = safeNumber(metrics.correctCount, 0);
      const incorrect = safeNumber(metrics.wrongCount, 0);
      const answered = Math.max(
        correct + incorrect,
        safeNumber(metrics.answeredQuestions, answers.length || 0),
      );
      const score = correct * CORRECT_MARKS + incorrect * WRONG_MARKS;

      return {
        totalQuestions: EXAM_TOTAL_QUESTIONS,
        answeredQuestions: answered,
        correctAnswers: correct,
        incorrectAnswers: incorrect,
        unansweredQuestions: Math.max(0, EXAM_TOTAL_QUESTIONS - answered),
        totalMarks: EXAM_TOTAL_QUESTIONS * CORRECT_MARKS,
        marksObtained: score,
        scoringFormula: "+2 / -0.5",
        accuracy: Number(metrics.currentAccuracy || 0),
        percentage: (score / (EXAM_TOTAL_QUESTIONS * CORRECT_MARKS)) * 100,
        totalTimeSpent: Math.min(
          Number(metrics.sessionTime || 0),
          EXAM_DURATION_SECONDS,
        ),
        examDuration: EXAM_DURATION_SECONDS,
        averageTimePerQuestion: Number(metrics.averageTimePerQuestion || 0),
      };
    }

    const totalQuestions = EXAM_TOTAL_QUESTIONS;
    const answered = questionsList.filter(
      (question) =>
        question?.studentAnswer?.selected !== null &&
        question?.studentAnswer?.selected !== undefined,
    ).length;
    const correct = questionsList.filter(
      (question) => !!question?.studentAnswer?.isCorrect,
    ).length;
    const incorrect = Math.max(0, answered - correct);
    const unanswered = Math.max(0, totalQuestions - answered);
    const totalMarks = EXAM_TOTAL_QUESTIONS * CORRECT_MARKS;
    const marksObtained = correct * CORRECT_MARKS + incorrect * WRONG_MARKS;
    const totalTimeSpent = questionsList.reduce(
      (sum, question) => sum + Number(question?.studentAnswer?.timeSpent || 0),
      0,
    );

    const accuracy = answered > 0 ? (correct / answered) * 100 : 0;
    const percentage = totalMarks > 0 ? (marksObtained / totalMarks) * 100 : 0;

    return {
      totalQuestions,
      answeredQuestions: answered,
      correctAnswers: correct,
      incorrectAnswers: incorrect,
      unansweredQuestions: unanswered,
      totalMarks,
      marksObtained,
      scoringFormula: "+2 / -0.5",
      accuracy,
      percentage,
      totalTimeSpent,
      examDuration: EXAM_DURATION_SECONDS,
      averageTimePerQuestion: answered > 0 ? totalTimeSpent / answered : 0,
    };
  }, [answers.length, metrics, questionsList]);

  const chapterAccuracy = useMemo(() => {
    const chapterMap = new Map();

    questionsList.forEach((question) => {
      const chapter = question?.conceptArea || question?.topic || "General";
      const key = String(chapter).trim() || "General";

      if (!chapterMap.has(key)) {
        chapterMap.set(key, {
          chapter: key,
          attempted: 0,
          correct: 0,
          totalQuestions: 0,
        });
      }

      const item = chapterMap.get(key);
      item.totalQuestions += 1;
      const isAnswered =
        question?.studentAnswer?.selected !== null &&
        question?.studentAnswer?.selected !== undefined;
      if (isAnswered) item.attempted += 1;
      if (question?.studentAnswer?.isCorrect) item.correct += 1;
    });

    return Array.from(chapterMap.values())
      .map((item) => ({
        ...item,
        accuracy:
          item.attempted > 0 ? (item.correct / item.attempted) * 100 : 0,
      }))
      .sort((a, b) => b.accuracy - a.accuracy);
  }, [questionsList]);

  const subjectAccuracy = useMemo(() => {
    const CORRECT_MARKS = 2;
    const WRONG_MARKS = -0.5;

    const subjectMap = new Map();

    questionsList.forEach((question) => {
      const subject = question?.subject || "general_knowledge";
      if (!subjectMap.has(subject)) {
        subjectMap.set(subject, {
          subject,
          totalQuestions: 0,
          attempted: 0,
          correct: 0,
          totalMarks: 0,
          obtainedMarks: 0,
        });
      }

      const item = subjectMap.get(subject);
      item.totalQuestions += 1;
      item.totalMarks += CORRECT_MARKS;

      const isAnswered =
        question?.studentAnswer?.selected !== null &&
        question?.studentAnswer?.selected !== undefined;
      if (isAnswered) item.attempted += 1;
      if (question?.studentAnswer?.isCorrect) {
        item.correct += 1;
        item.obtainedMarks += CORRECT_MARKS;
      } else {
        item.obtainedMarks += isAnswered ? WRONG_MARKS : 0;
      }
    });

    return Array.from(subjectMap.values())
      .map((item) => ({
        ...item,
        accuracy:
          item.attempted > 0 ? (item.correct / item.attempted) * 100 : 0,
        percentage:
          item.totalMarks > 0
            ? (item.obtainedMarks / item.totalMarks) * 100
            : 0,
      }))
      .sort((a, b) => b.accuracy - a.accuracy);
  }, [questionsList]);

  const strongSubjects = subjectAccuracy.filter((item) => item.accuracy >= 70);
  const weakSubjects = subjectAccuracy.filter((item) => item.accuracy < 50);

  const strongChapters = useMemo(
    () =>
      chapterAccuracy
        .filter((item) => item.attempted > 0 && item.accuracy >= 70)
        .slice(0, 8),
    [chapterAccuracy],
  );

  const weakChapters = useMemo(
    () =>
      chapterAccuracy
        .filter((item) => item.attempted > 0 && item.accuracy < 50)
        .slice(0, 8),
    [chapterAccuracy],
  );

  const derivedModelsData = useMemo(() => {
    if (Object.keys(modelsData?.conceptMastery || {}).length > 0) {
      return modelsData;
    }

    if (!questionsList.length) {
      return modelsData;
    }

    const topicPerformance = chapterAccuracy.map((chapter) => ({
      topic: chapter.chapter,
      subject: "general",
      accuracy: chapter.accuracy,
      questionsAttempted: chapter.attempted,
      correctAnswers: chapter.correct,
      lastPracticed: new Date(),
      timeSpent:
        questionsList
          .filter(
            (question) =>
              (question?.conceptArea || question?.topic || "General") ===
              chapter.chapter,
          )
          .reduce(
            (sum, question) =>
              sum + Number(question?.studentAnswer?.timeSpent || 0),
            0,
          ) / 60,
      averageDifficulty: questionsList
        .filter(
          (question) =>
            (question?.conceptArea || question?.topic || "General") ===
            chapter.chapter,
        )
        .reduce(
          (sum, question, _, array) =>
            sum +
            Number(question?.difficulty || 0.5) / Math.max(1, array.length),
          0,
        ),
      conceptMasteryHistory: [chapter.accuracy / 100],
    }));

    const performance = {
      topicPerformance,
      testHistory: [
        {
          date: new Date(),
          accuracy: computedSummary.accuracy,
          totalQuestions: computedSummary.answeredQuestions,
          timeSpent: computedSummary.totalTimeSpent / 60,
          averageDifficulty:
            questionsList.reduce(
              (sum, question) => sum + Number(question?.difficulty || 0.5),
              0,
            ) / Math.max(1, questionsList.length),
          conceptsTested: topicPerformance.map((item) => item.topic),
        },
      ],
      overallStats: {
        totalQuestions: computedSummary.totalQuestions,
        totalCorrect: computedSummary.correctAnswers,
        accuracy: computedSummary.accuracy,
        totalTimeSpent: computedSummary.totalTimeSpent / 60,
        totalTests: 1,
        averageDifficulty:
          questionsList.reduce(
            (sum, question) => sum + Number(question?.difficulty || 0.5),
            0,
          ) / Math.max(1, questionsList.length),
      },
    };

    return analyticsService.calculateAllModels(performance) || modelsData;
  }, [chapterAccuracy, computedSummary, modelsData, questionsList]);

  const enhancedModelsData = useMemo(() => {
    const data = { ...derivedModelsData };

    const half = Math.floor(questionsList.length / 2);
    const firstHalf = questionsList.slice(0, half);
    const secondHalf = questionsList.slice(half);

    const accuracyFor = (list) => {
      const attempted = list.filter(
        (q) =>
          q?.studentAnswer?.selected !== null &&
          q?.studentAnswer?.selected !== undefined,
      );
      const correct = attempted.filter(
        (q) => q?.studentAnswer?.isCorrect,
      ).length;
      return attempted.length > 0 ? correct / attempted.length : 0;
    };

    const firstAcc = accuracyFor(firstHalf);
    const secondAcc = accuracyFor(secondHalf);

    const avgDifficultyCorrect = (() => {
      const correctQuestions = questionsList.filter(
        (q) => q?.studentAnswer?.isCorrect,
      );
      if (!correctQuestions.length) return 0.5;
      return (
        correctQuestions.reduce(
          (sum, q) => sum + safeNumber(q?.difficulty, 0.5),
          0,
        ) / correctQuestions.length
      );
    })();

    const timeSpentMinutes = Math.max(
      1,
      safeNumber(computedSummary.totalTimeSpent, 0) / 60,
    );
    const correctAnswers = safeNumber(computedSummary.correctAnswers, 0);

    if (!Number.isFinite(Number(data.fatigueIndex))) {
      data.fatigueIndex = clamp(Math.max(0, firstAcc - secondAcc) + 0.2);
    }

    if (!Number.isFinite(Number(data.focusLoss))) {
      data.focusLoss = clamp(Math.max(0, firstAcc - secondAcc));
    }

    if (!Number.isFinite(Number(data.difficultyTolerance))) {
      data.difficultyTolerance = clamp(avgDifficultyCorrect);
    }

    if (!Number.isFinite(Number(data.studyEfficiency))) {
      data.studyEfficiency = clamp(correctAnswers / timeSpentMinutes / 4);
    }

    return data;
  }, [computedSummary, derivedModelsData, questionsList]);

  const modelCards = useMemo(
    () => [
      {
        title: MODEL_TITLES[0],
        value: `${Object.keys(enhancedModelsData.conceptMastery || {}).length} chapters tracked`,
        ratio: clamp(
          Object.values(enhancedModelsData.conceptMastery || {}).reduce(
            (sum, value) => sum + Number(value || 0),
            0,
          ) /
            Math.max(
              1,
              Object.values(enhancedModelsData.conceptMastery || {}).length,
            ),
        ),
        tooltip: "EMA mastery score across all chapters.",
      },
      {
        title: MODEL_TITLES[1],
        value: `${Object.keys(enhancedModelsData.stabilityIndex || {}).length} stability scores`,
        ratio: clamp(
          Object.values(enhancedModelsData.stabilityIndex || {}).reduce(
            (sum, value) => sum + Number(value || 0),
            0,
          ) /
            Math.max(
              1,
              Object.values(enhancedModelsData.stabilityIndex || {}).length,
            ),
        ),
        tooltip: "Consistency of chapter-level performance over the session.",
      },
      {
        title: MODEL_TITLES[2],
        value: `${toPercent(1 - Number(enhancedModelsData.confidenceCalibration?.overall || 0), 1)} confidence alignment`,
        ratio: clamp(
          1 - Number(enhancedModelsData.confidenceCalibration?.overall || 0),
        ),
        tooltip: "How close confidence is to actual correctness.",
      },
      {
        title: MODEL_TITLES[3],
        value:
          Object.entries(enhancedModelsData.errorPatterns || {})
            .filter(([key]) => key !== "byTopic")
            .map(([key, val]) => `${key}: ${toPercent(val, 0)}`)
            .join(" | ") || "No pattern data",
        ratio: clamp(
          Object.entries(enhancedModelsData.errorPatterns || {})
            .filter(([key]) => key !== "byTopic")
            .reduce((sum, [, value]) => sum + Number(value || 0), 0),
        ),
        tooltip: "Distribution of conceptual/careless/guess errors.",
      },
      {
        title: MODEL_TITLES[4],
        value: `${(enhancedModelsData.weaknessPriority || []).length} prioritized weak chapters`,
        ratio: clamp((enhancedModelsData.weaknessPriority || []).length / 10),
        tooltip: "Ranked weak chapters by urgency.",
      },
      {
        title: MODEL_TITLES[5],
        value: `${Object.keys(enhancedModelsData.forgettingCurve?.retentionScores || {}).length} retention items`,
        ratio: clamp(
          Object.values(
            enhancedModelsData.forgettingCurve?.retentionScores || {},
          ).reduce((sum, item) => sum + Number(item?.current || 0), 0) /
            Math.max(
              1,
              Object.values(
                enhancedModelsData.forgettingCurve?.retentionScores || {},
              ).length,
            ),
        ),
        tooltip: "Retention estimates from forgetting-curve model.",
      },
      {
        title: MODEL_TITLES[6],
        value: `${toPercent(enhancedModelsData.fatigueIndex || 0, 1)} fatigue sensitivity`,
        ratio: clamp(enhancedModelsData.fatigueIndex || 0),
        tooltip: "Higher means stronger performance drop due to fatigue.",
      },
      {
        title: MODEL_TITLES[7],
        value: String(enhancedModelsData.behaviorProfile || "balanced"),
        ratio: 0.65,
        tooltip: "Behavior style inferred from pace and answer patterns.",
      },
      {
        title: MODEL_TITLES[8],
        value: `${toPercent(enhancedModelsData.difficultyTolerance || 0, 1)} tolerance`,
        ratio: clamp(enhancedModelsData.difficultyTolerance || 0),
        tooltip: "Ability to sustain accuracy on harder questions.",
      },
      {
        title: MODEL_TITLES[9],
        value: `${toPercent(enhancedModelsData.studyEfficiency || 0, 1)} efficiency`,
        ratio: clamp(enhancedModelsData.studyEfficiency || 0),
        tooltip: "Correct answers per time unit, normalized.",
      },
      {
        title: MODEL_TITLES[10],
        value: `${toPercent(enhancedModelsData.focusLoss || 0, 1)} focus-loss risk`,
        ratio: clamp(1 - Number(enhancedModelsData.focusLoss || 0)),
        tooltip: "Focus sensitivity measured from late-session drop.",
      },
      {
        title: MODEL_TITLES[11],
        value: `${(enhancedModelsData.timeAllocation || []).length} adaptive time allocations`,
        ratio: clamp((enhancedModelsData.timeAllocation || []).length / 5),
        tooltip: "Suggested chapter-wise time split for next revision cycle.",
      },
    ],
    [enhancedModelsData],
  );

  const downloadDetailedPaper = () => {
    if (!questionPaper) return;

    const metadata = questionPaper.metadata || {};
    const subjectBlocks = questionPaper.questionsBySubject || {};

    let content = "";
    content += "StudyStream AI - Real Exam Detailed Result\n";
    content += "============================================================\n";
    content += `Title: ${metadata.title || "Real Exam"}\n`;
    content += `Date: ${metadata.date || new Date().toISOString()}\n`;
    content += `Duration: ${metadata.duration || "60 minutes"}\n`;
    content += `Total Questions: ${summary.totalQuestions || 100}\n`;
    content += `Total Time: 60 minutes\n`;
    content += `Scoring: +2 correct, -0.5 wrong\n`;
    content += `Total Marks: ${summary.totalMarks || 200}\n`;
    content += `Marks Obtained: ${Number(summary.marksObtained || 0).toFixed(2)}\n`;
    content += `Accuracy: ${Number(summary.accuracy || 0).toFixed(2)}%\n`;
    content += `Answered: ${summary.answeredQuestions || 0}\n`;
    content += `Average Time / Question: ${Number(summary.averageTimePerQuestion || 0).toFixed(2)} sec\n`;
    content +=
      "============================================================\n\n";

    Object.entries(subjectBlocks).forEach(([subject, questions]) => {
      content += `${subjectLabel(subject).toUpperCase()} (${questions.length} Questions)\n`;
      content +=
        "------------------------------------------------------------\n";

      questions.forEach((question) => {
        content += `Q${question.number}. ${question.text}\n`;
        content += `Type: ${question.type} | Marks: ${question.marks} | Difficulty: ${question.difficultyLevel}\n`;
        content += `Topic: ${question.topic || "General"}\n`;

        if (Array.isArray(question.options) && question.options.length > 0) {
          question.options.forEach((option, index) => {
            const text = option?.text || option?.value || String(option);
            content += `  ${String.fromCharCode(65 + index)}. ${text}\n`;
          });
        }

        content += `Correct Answer: ${JSON.stringify(question.correctAnswer)}\n`;
        content += `Student Answer: ${JSON.stringify(question.studentAnswer?.selected)}\n`;
        content += `Result: ${question.studentAnswer?.isCorrect ? "Correct" : "Incorrect/Unanswered"}\n`;
        content += `Explanation: ${question.explanation || "N/A"}\n`;

        if (
          Array.isArray(question.solutionSteps) &&
          question.solutionSteps.length > 0
        ) {
          content += "Solution Steps:\n";
          question.solutionSteps.forEach((step, idx) => {
            content += `  ${idx + 1}. ${step}\n`;
          });
        }

        content += "\n";
      });
      content += "\n";
    });

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `real_exam_detailed_paper_${session?.sessionId || Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const summary = useMemo(() => {
    const metadata = questionPaper?.metadata || {};
    const merged = {
      ...metadata,
      totalQuestions: 100,
      answeredQuestions:
        Number(metadata.answeredQuestions || 0) ||
        Number(computedSummary.answeredQuestions || 0),
      correctAnswers:
        Number(metadata.correctAnswers || 0) ||
        Number(computedSummary.correctAnswers || 0),
      incorrectAnswers:
        Number(metadata.incorrectAnswers || 0) ||
        Number(computedSummary.incorrectAnswers || 0),
      totalMarks: Number(computedSummary.totalMarks || 200),
      marksObtained: Number(computedSummary.marksObtained || 0),
      accuracy:
        Number(metadata.accuracy || 0) ||
        Number(computedSummary.accuracy || metrics.currentAccuracy || 0),
      percentage: Number(
        computedSummary.percentage || metrics.currentAccuracy || 0,
      ),
      totalTimeSpent:
        Number(metadata.totalTimeSpent || 0) ||
        Number(computedSummary.totalTimeSpent || metrics.sessionTime || 0),
      averageTimePerQuestion:
        Number(metadata.averageTimePerQuestion || 0) ||
        Number(
          computedSummary.averageTimePerQuestion ||
            metrics.averageTimePerQuestion ||
            0,
        ),
      examDuration: 60 * 60,
      scoringFormula: "+2 / -0.5",
    };
    return merged;
  }, [computedSummary, metrics, questionPaper?.metadata]);

  const trendPoints = useMemo(() => {
    if (!questionsList.length) return [];

    let cumulativeCorrect = 0;
    return questionsList.map((question, index) => {
      if (question?.studentAnswer?.isCorrect) {
        cumulativeCorrect += 1;
      }

      const attempted = index + 1;
      return clamp(cumulativeCorrect / attempted);
    });
  }, [questionsList]);

  const trendPath = useMemo(() => getChartPath(trendPoints), [trendPoints]);

  const scoreBreakdown = useMemo(() => {
    const total = Number(summary.totalQuestions || 100);
    const correct = Number(summary.correctAnswers || 0);
    const incorrect = Number(summary.incorrectAnswers || 0);
    const unanswered = Math.max(0, total - correct - incorrect);

    const correctRatio = total > 0 ? (correct / total) * 100 : 0;
    const incorrectRatio = total > 0 ? (incorrect / total) * 100 : 0;
    const unansweredRatio = total > 0 ? (unanswered / total) * 100 : 0;

    return {
      correct,
      incorrect,
      unanswered,
      correctRatio,
      incorrectRatio,
      unansweredRatio,
      pieStyle: {
        background: `conic-gradient(#22c55e 0% ${correctRatio}%, #ef4444 ${correctRatio}% ${correctRatio + incorrectRatio}%, #94a3b8 ${correctRatio + incorrectRatio}% 100%)`,
      },
    };
  }, [summary]);

  const timeHistogramData = useMemo(() => {
    const bins = [
      { min: 0, max: 30, label: "0-30s" },
      { min: 31, max: 60, label: "31-60s" },
      { min: 61, max: 90, label: "61-90s" },
      { min: 91, max: 120, label: "91-120s" },
      { min: 121, max: 180, label: "121-180s" },
      { min: 181, max: Number.POSITIVE_INFINITY, label: ">180s" },
    ];

    const histogram = bins.map((bin) => ({
      ...bin,
      expectedCount: 0,
      actualCount: 0,
    }));

    questionsList.forEach((question) => {
      const expected = safeNumber(question?.expectedTime, 90);
      const actual = safeNumber(question?.studentAnswer?.timeSpent, 0);

      const expectedBin = histogram.find(
        (bin) => expected >= bin.min && expected <= bin.max,
      );
      if (expectedBin) expectedBin.expectedCount += 1;

      const actualBin = histogram.find(
        (bin) => actual >= bin.min && actual <= bin.max,
      );
      if (actualBin) actualBin.actualCount += 1;
    });

    const maxCount = histogram.reduce(
      (max, bin) => Math.max(max, bin.expectedCount, bin.actualCount),
      1,
    );

    return {
      bins: histogram,
      maxCount,
    };
  }, [questionsList]);

  const candidateTimeTaken = Number(summary.totalTimeSpent || 0);
  const examTotalTime = Number(summary.examDuration || 3600);
  const timeTakenPercent =
    examTotalTime > 0 ? (candidateTimeTaken / examTotalTime) * 100 : 0;
  const recommendations = Array.isArray(questionPaper?.recommendations)
    ? questionPaper.recommendations
    : [];
  const sectionMeta = Array.isArray(session?.config?.sections)
    ? session.config.sections
    : [];

  if (!session?.sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 p-6 text-red-700 dark:text-red-300 max-w-xl w-full">
          <p className="font-semibold">No real exam result payload found.</p>
          <button
            onClick={() => navigate("/test/practice")}
            className="mt-4 bg-indigo-600 text-white rounded-lg px-4 py-2 hover:bg-indigo-700 transition-colors"
          >
            Go To Test Setup
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-fuchsia-50/40 dark:from-dark-100 dark:via-dark-100 dark:to-dark-100 p-3 md:p-5">
      <div className="max-w-[1920px] mx-auto space-y-6">
        <div className="relative overflow-hidden rounded-3xl border border-indigo-100/70 dark:border-indigo-900/40 bg-white/90 dark:bg-dark-200/95 backdrop-blur-xl p-5 md:p-7 shadow-xl shadow-indigo-100/40 dark:shadow-none">
          <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-fuchsia-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-16 h-52 w-52 rounded-full bg-indigo-400/20 blur-3xl" />
          <div className="relative flex flex-wrap gap-3 items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-indigo-600 to-fuchsia-600 bg-clip-text text-transparent">
                Real Exam Detailed Result
              </h1>
              <p className="text-sm md:text-base text-slate-700 dark:text-slate-300 mt-1">
                100 Questions • 100 Marks • 60 Minutes • 4 Sections
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={toggleTheme}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white/80 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Toggle light/dark mode"
              >
                {isDark ? (
                  <FiSun className="inline mr-1" />
                ) : (
                  <FiMoon className="inline mr-1" />
                )}
                {isDark ? "Light" : "Dark"}
              </button>
              <button
                onClick={handleToggleFullScreen}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white/80 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Toggle fullscreen"
              >
                {fullScreen ? (
                  <>
                    <FiMinimize2 className="inline mr-1" /> Exit Fullscreen
                  </>
                ) : (
                  <>
                    <FiMaximize2 className="inline mr-1" /> Fullscreen
                  </>
                )}
              </button>
              <button
                onClick={() => navigate("/dashboard")}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white/80 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <FiArrowLeft className="inline mr-1" /> Dashboard
              </button>
              <button
                onClick={downloadDetailedPaper}
                disabled={!questionPaper}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white disabled:opacity-60 shadow-lg hover:shadow-xl transition-all"
              >
                <FiDownload className="inline mr-1" /> Download 100Q Detailed
                Paper
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
          <SummaryCard
            icon={<FiTarget />}
            label="Score"
            value={`${(summary.percentage || metrics.currentAccuracy || 0).toFixed(2)}%`}
            tone="indigo"
            tooltip="Percentage is normalized from +2/-0.5 scoring over 100 questions."
          />
          <SummaryCard
            icon={<FiAward />}
            label="Marks (+2/-0.5)"
            value={`${Number(summary.marksObtained || 0).toFixed(2)}/${summary.totalMarks || 200}`}
            tone="fuchsia"
            tooltip="+2 for each correct answer and -0.5 for each wrong answer."
          />
          <SummaryCard
            icon={<FiCheckCircle />}
            label="Correct"
            value={String(summary.correctAnswers || metrics.correctCount || 0)}
            tone="emerald"
          />
          <SummaryCard
            icon={<FiXCircle />}
            label="Incorrect"
            value={String(summary.incorrectAnswers || metrics.wrongCount || 0)}
            tone="rose"
          />
          <SummaryCard
            icon={<FiBookOpen />}
            label="Total Questions"
            value="100"
            tone="amber"
            tooltip="Real exam is fixed at 100 questions."
          />
          <SummaryCard
            icon={<FiClock />}
            label="Exam Time"
            value="60m"
            tone="sky"
            tooltip="Real exam is fixed to 60 minutes."
          />
        </div>

        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white/90 dark:bg-dark-200 p-5">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <FiClock /> Candidate Time Taken
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-gradient-to-br from-white to-sky-50/60 dark:from-slate-900 dark:to-slate-800">
              <p className="text-xs text-slate-500">Time Taken</p>
              <p className="text-2xl font-bold text-sky-600 dark:text-sky-300 mt-1">
                {formatSeconds(candidateTimeTaken)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-gradient-to-br from-white to-indigo-50/60 dark:from-slate-900 dark:to-slate-800">
              <p className="text-xs text-slate-500">Allowed Time</p>
              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-300 mt-1">
                {formatSeconds(examTotalTime)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-gradient-to-br from-white to-fuchsia-50/60 dark:from-slate-900 dark:to-slate-800">
              <p className="text-xs text-slate-500">Utilization</p>
              <p className="text-2xl font-bold text-fuchsia-600 dark:text-fuchsia-300 mt-1">
                {timeTakenPercent.toFixed(1)}%
              </p>
            </div>
          </div>
          <div className="mt-3 h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-500 via-indigo-500 to-fuchsia-500"
              style={{
                width: `${Math.max(0, Math.min(100, timeTakenPercent))}%`,
              }}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white/90 dark:bg-dark-200 p-5">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <FiActivity /> Visual Performance Analytics
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800">
              <p className="font-semibold text-sm mb-3">
                Answer Distribution (Pie)
              </p>
              <div className="flex items-center gap-4">
                <div
                  className="h-28 w-28 rounded-full border border-slate-200 dark:border-slate-700"
                  style={scoreBreakdown.pieStyle}
                />
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="inline-block h-2 w-2 rounded-full bg-green-500 mr-2" />
                    Correct: {scoreBreakdown.correct} (
                    {scoreBreakdown.correctRatio.toFixed(1)}%)
                  </p>
                  <p>
                    <span className="inline-block h-2 w-2 rounded-full bg-red-500 mr-2" />
                    Incorrect: {scoreBreakdown.incorrect} (
                    {scoreBreakdown.incorrectRatio.toFixed(1)}%)
                  </p>
                  <p>
                    <span className="inline-block h-2 w-2 rounded-full bg-slate-400 mr-2" />
                    Unanswered: {scoreBreakdown.unanswered} (
                    {scoreBreakdown.unansweredRatio.toFixed(1)}%)
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-gradient-to-br from-white to-indigo-50/40 dark:from-slate-900 dark:to-slate-800 lg:col-span-2">
              <p className="font-semibold text-sm mb-3">
                Accuracy Over Time (Question-by-Question Trend)
              </p>
              {trendPoints.length ? (
                <svg viewBox="0 0 360 120" className="w-full h-32">
                  <defs>
                    <linearGradient
                      id="accuracyLine"
                      x1="0"
                      y1="0"
                      x2="1"
                      y2="0"
                    >
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#d946ef" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M 0 120 L 360 120"
                    stroke="#cbd5e1"
                    strokeWidth="1"
                    fill="none"
                  />
                  <path
                    d="M 0 80 L 360 80"
                    stroke="#e2e8f0"
                    strokeWidth="1"
                    fill="none"
                  />
                  <path
                    d="M 0 40 L 360 40"
                    stroke="#e2e8f0"
                    strokeWidth="1"
                    fill="none"
                  />
                  <path
                    d={trendPath}
                    stroke="url(#accuracyLine)"
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <p className="text-sm text-slate-500">
                  Trend will appear once question paper data is available.
                </p>
              )}
              <p className="text-xs text-slate-500 mt-1">
                Start to End Accuracy:{" "}
                {(trendPoints[0] || 0) * 100 > 0
                  ? `${((trendPoints[0] || 0) * 100).toFixed(1)}%`
                  : "0.0%"}{" "}
                →{" "}
                {((trendPoints[trendPoints.length - 1] || 0) * 100).toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-gradient-to-br from-white to-amber-50/50 dark:from-slate-900 dark:to-slate-800">
            <p className="font-semibold text-sm mb-3">
              Histogram: Expected Time vs Student Time (Per Question)
            </p>

            <div className="space-y-3">
              {timeHistogramData.bins.map((bin) => {
                const expectedWidth =
                  (bin.expectedCount / timeHistogramData.maxCount) * 100;
                const actualWidth =
                  (bin.actualCount / timeHistogramData.maxCount) * 100;

                return (
                  <div
                    key={bin.label}
                    className="grid grid-cols-12 gap-2 items-center"
                  >
                    <p className="col-span-2 text-xs text-slate-600 dark:text-slate-300">
                      {bin.label}
                    </p>
                    <div className="col-span-5">
                      <p className="text-[11px] text-slate-500 mb-1">
                        Expected ({bin.expectedCount})
                      </p>
                      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-violet-500"
                          style={{
                            width: `${Math.max(0, Math.min(100, expectedWidth))}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="col-span-5">
                      <p className="text-[11px] text-slate-500 mb-1">
                        Student ({bin.actualCount})
                      </p>
                      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                          style={{
                            width: `${Math.max(0, Math.min(100, actualWidth))}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {!!sectionMeta.length && (
          <section className="rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white/90 dark:bg-dark-200 p-5">
            <h2 className="text-lg font-bold mb-3">Exam Sections</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {sectionMeta.map((section) => (
                <div
                  key={section.subject}
                  className="rounded-xl border border-indigo-100 dark:border-slate-700 bg-gradient-to-br from-indigo-50 to-white dark:from-slate-900 dark:to-slate-800 p-3"
                >
                  <p className="font-semibold text-sm">{section.name}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                    {section.questionCount} Questions
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {section.marksPerQuestion} Mark each
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white/90 dark:bg-dark-200 p-5">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <FiBarChart2 /> Subject-wise Accuracy
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {subjectAccuracy.map((item) => (
              <div
                key={item.subject}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-white to-indigo-50/60 dark:from-slate-900 dark:to-slate-800 p-3"
              >
                <p className="font-semibold text-sm">
                  {subjectLabel(item.subject)}
                </p>
                <p className="text-lg font-bold text-indigo-600 dark:text-indigo-300 mt-1">
                  {item.accuracy.toFixed(2)}%
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  Correct: {item.correct}/{item.totalQuestions}
                </p>
                <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500"
                    style={{
                      width: `${Math.max(0, Math.min(100, item.accuracy))}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            <div className="rounded-xl border border-emerald-300 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-emerald-900/10 p-3">
              <p className="font-semibold mb-2 flex items-center gap-1">
                <FiTrendingUp /> Strong Subjects
              </p>
              {strongSubjects.length ? (
                strongSubjects.map((item) => (
                  <p key={item.subject} className="text-sm">
                    {subjectLabel(item.subject)} ({item.accuracy.toFixed(1)}%)
                  </p>
                ))
              ) : (
                <p className="text-sm">No strong subjects identified yet.</p>
              )}
            </div>
            <div className="rounded-xl border border-rose-300 bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-900/20 dark:to-rose-900/10 p-3">
              <p className="font-semibold mb-2 flex items-center gap-1">
                <FiTrendingDown /> Weak Subjects
              </p>
              {weakSubjects.length ? (
                weakSubjects.map((item) => (
                  <p key={item.subject} className="text-sm">
                    {subjectLabel(item.subject)} ({item.accuracy.toFixed(1)}%)
                  </p>
                ))
              ) : (
                <p className="text-sm">No weak subjects identified.</p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white/90 dark:bg-dark-200 p-5">
          <h2 className="text-lg font-bold mb-3">
            Chapter-wise Accuracy (Graphs)
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {chapterAccuracy.slice(0, 20).map((row) => (
              <div
                key={row.chapter}
                className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-gradient-to-br from-white to-indigo-50/40 dark:from-slate-900 dark:to-slate-800"
              >
                <div className="flex justify-between items-center gap-3">
                  <p className="text-sm font-semibold truncate">
                    {row.chapter}
                  </p>
                  <p className="text-xs font-bold text-indigo-600 dark:text-indigo-300 whitespace-nowrap">
                    {row.accuracy.toFixed(1)}%
                  </p>
                </div>
                <div className="mt-2 h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500"
                    style={{
                      width: `${Math.max(0, Math.min(100, row.accuracy))}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Correct {row.correct} / Attempted {row.attempted}
                </p>
              </div>
            ))}
            {!chapterAccuracy.length && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-sm text-slate-500">
                Chapter analytics are being computed. Attempted question
                metadata may be incomplete.
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            <div className="rounded-xl border border-emerald-300 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-emerald-900/10 p-3">
              <p className="font-semibold mb-2">Strong Chapters</p>
              {strongChapters.length ? (
                strongChapters.map((item) => (
                  <p key={item.chapter} className="text-sm">
                    {item.chapter} ({item.accuracy.toFixed(1)}%)
                  </p>
                ))
              ) : (
                <p className="text-sm">No strong chapter identified.</p>
              )}
            </div>
            <div className="rounded-xl border border-rose-300 bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-900/20 dark:to-rose-900/10 p-3">
              <p className="font-semibold mb-2">Weak Chapters</p>
              {weakChapters.length ? (
                weakChapters.map((item) => (
                  <p key={item.chapter} className="text-sm">
                    {item.chapter} ({item.accuracy.toFixed(1)}%)
                  </p>
                ))
              ) : (
                <p className="text-sm">No weak chapter identified.</p>
              )}
            </div>
          </div>
        </section>

        {!!recommendations.length && (
          <section className="rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white/90 dark:bg-dark-200 p-5">
            <h2 className="text-lg font-bold mb-3">
              Actionable Recommendations
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {recommendations.map((recommendation, index) => (
                <div
                  key={`${recommendation.type}-${index}`}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-indigo-50/70 to-fuchsia-50/70 dark:from-slate-900 dark:to-slate-800 p-3"
                >
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    {recommendation.priority} priority • {recommendation.type}
                  </p>
                  <p className="font-semibold mt-1">{recommendation.message}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                    {recommendation.action}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white/90 dark:bg-dark-200 p-5">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <FaBrain /> 12 AI Models Analysis
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {modelCards.map((model) => (
              <motion.div
                key={model.title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-white to-indigo-50/60 dark:from-slate-900 dark:to-slate-800 p-3"
              >
                <p className="font-semibold text-sm flex items-center gap-1">
                  {model.title}
                  <Tooltip text={model.tooltip || model.title} />
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                  {model.value}
                </p>
                <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-indigo-500 to-fuchsia-500"
                    style={{
                      width: `${Math.max(0, Math.min(100, (model.ratio || 0) * 100))}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {((model.ratio || 0) * 100).toFixed(1)}%
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white/90 dark:bg-dark-200 p-5">
          <h2 className="text-lg font-bold mb-3">
            Complete 100 Questions Paper (with Answers & Explanations)
          </h2>
          {paperLoading && (
            <p className="text-sm">Loading full question paper...</p>
          )}
          {paperError && <p className="text-sm text-red-600">{paperError}</p>}

          {!paperLoading && !paperError && !questionPaper && (
            <p className="text-sm">Question paper not available.</p>
          )}

          {!paperLoading && questionPaper && (
            <div className="space-y-4">
              {Object.entries(questionPaper.questionsBySubject || {}).map(
                ([subject, questions]) => (
                  <details
                    key={subject}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 p-3"
                    open
                  >
                    <summary className="cursor-pointer font-semibold text-indigo-700 dark:text-indigo-300">
                      {subjectLabel(subject)} ({questions.length} questions)
                    </summary>
                    <div className="mt-3 space-y-3">
                      {questions.map((question) => (
                        <div
                          key={String(question.id)}
                          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 p-3 text-sm"
                        >
                          <p className="font-semibold text-slate-800 dark:text-slate-100">
                            Q{question.number}. {question.text}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Topic: {question.topic || "General"} | Difficulty:{" "}
                            {question.difficultyLevel} | Marks: {question.marks}
                          </p>
                          {Array.isArray(question.options) &&
                            question.options.length > 0 && (
                              <div className="mt-2 space-y-1 rounded-lg bg-slate-50 dark:bg-slate-900/60 p-2">
                                {question.options.map((option, index) => (
                                  <p key={String(index)}>
                                    {String.fromCharCode(65 + index)}.{" "}
                                    {option?.text ||
                                      option?.value ||
                                      String(option)}
                                  </p>
                                ))}
                              </div>
                            )}
                          <p className="mt-2">
                            <span className="font-semibold text-emerald-600 dark:text-emerald-300">
                              Correct:
                            </span>{" "}
                            {JSON.stringify(question.correctAnswer)}
                          </p>
                          <p>
                            <span className="font-semibold text-indigo-600 dark:text-indigo-300">
                              Your Answer:
                            </span>{" "}
                            {JSON.stringify(question.studentAnswer?.selected)}
                          </p>
                          <p className="mt-1">
                            <span className="font-semibold">Status:</span>{" "}
                            {question.studentAnswer?.isCorrect
                              ? "Correct"
                              : "Incorrect/Unanswered"}
                          </p>
                          <p className="mt-1">
                            <span className="font-semibold">Explanation:</span>{" "}
                            {question.explanation || "N/A"}
                          </p>
                          {Array.isArray(question.solutionSteps) &&
                            question.solutionSteps.length > 0 && (
                              <div className="mt-2">
                                <p className="font-semibold">Solution Steps:</p>
                                {question.solutionSteps.map((step, idx) => (
                                  <p key={String(idx)}>
                                    {idx + 1}. {step}
                                  </p>
                                ))}
                              </div>
                            )}
                        </div>
                      ))}
                    </div>
                  </details>
                ),
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

const Tooltip = ({ text }) => {
  return (
    <span className="relative inline-flex items-center group">
      <FiInfo className="text-slate-400 hover:text-indigo-500 transition-colors" />
      <span className="pointer-events-none absolute z-30 -top-2 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:bg-slate-700">
        {text}
      </span>
    </span>
  );
};

const SummaryCard = ({ icon, label, value, tone = "indigo", tooltip }) => {
  const tones = {
    indigo:
      "from-indigo-50 to-white border-indigo-100 text-indigo-700 dark:from-indigo-900/20 dark:to-slate-900 dark:border-indigo-800/50",
    fuchsia:
      "from-fuchsia-50 to-white border-fuchsia-100 text-fuchsia-700 dark:from-fuchsia-900/20 dark:to-slate-900 dark:border-fuchsia-800/50",
    emerald:
      "from-emerald-50 to-white border-emerald-100 text-emerald-700 dark:from-emerald-900/20 dark:to-slate-900 dark:border-emerald-800/50",
    rose: "from-rose-50 to-white border-rose-100 text-rose-700 dark:from-rose-900/20 dark:to-slate-900 dark:border-rose-800/50",
    amber:
      "from-amber-50 to-white border-amber-100 text-amber-700 dark:from-amber-900/20 dark:to-slate-900 dark:border-amber-800/50",
    sky: "from-sky-50 to-white border-sky-100 text-sky-700 dark:from-sky-900/20 dark:to-slate-900 dark:border-sky-800/50",
  };

  return (
    <div
      className={`rounded-xl border bg-gradient-to-br p-3 shadow-sm ${tones[tone] || tones.indigo}`}
    >
      <p className="text-xs flex items-center gap-1 font-medium">
        {icon} {label}
        {tooltip ? <Tooltip text={tooltip} /> : null}
      </p>
      <p className="text-lg font-bold mt-1 text-slate-900 dark:text-white">
        {value}
      </p>
    </div>
  );
};

export default RealResult;
