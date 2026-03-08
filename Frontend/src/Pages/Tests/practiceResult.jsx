import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FiArrowLeft,
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiTarget,
  FiBarChart2,
  FiTrendingUp,
  FiBookOpen,
  FiAlertCircle,
  FiAward,
  FiActivity,
  FiZap,
  FiInfo,
  FiRefreshCw,
} from "react-icons/fi";
import { FaBrain, FaChartLine, FaFire } from "react-icons/fa";
import { useTheme } from "../../context/ThemeContext";
import authService from "../../services/authService";
import flaskService from "../../services/flaskService";
import testService from "../../services/testService";

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

const getQuestionId = (question) =>
  question?.id || question?._id || question?.questionId || null;

const getOptionId = (option) =>
  option?.id ?? option?._id ?? option?.optionId ?? option?.key ?? option?.value;

const normalizeAnswerValue = (value) => {
  if (value === null || value === undefined) return "N/A";
  if (typeof value === "object") {
    return (
      value?.id ??
      value?._id ??
      value?.optionId ??
      value?.value ??
      value?.key ??
      value?.text ??
      JSON.stringify(value)
    );
  }
  return value;
};

const clamp = (value, min = 0, max = 1) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
};

const toPercent = (value, digits = 0) =>
  `${(clamp(value) * 100).toFixed(digits)}%`;

const formatSeconds = (seconds) => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}m ${s}s`;
};

const formatDateTime = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
};

const trendPath = (values, width = 320, height = 96) => {
  if (!Array.isArray(values) || values.length === 0) return "";
  if (values.length === 1) return `M 0 ${height / 2} L ${width} ${height / 2}`;

  return values
    .map((raw, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - clamp(raw) * height;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
};

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

const PracticeResult = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isDark } = useTheme();

  const statePayload = location.state || {};
  const answers = Array.isArray(statePayload.answers)
    ? statePayload.answers
    : [];
  const metrics = statePayload.metrics || {};
  const session = statePayload.session || {};
  const flaskPredictions = statePayload.flaskPredictions || {};
  const modelsData = normalizeModelData(statePayload.modelsData || {});

  const [flaskDashboard, setFlaskDashboard] = useState(null);
  const [flaskLoading, setFlaskLoading] = useState(false);
  const [questionPaper, setQuestionPaper] = useState([]);
  const [paperLoading, setPaperLoading] = useState(false);

  useEffect(() => {
    const studentId = authService.getStudentId();
    if (!studentId) return;

    let mounted = true;
    const loadFlaskData = async () => {
      setFlaskLoading(true);
      try {
        const response = await flaskService.getModelInfo(studentId);
        if (!mounted) return;
        setFlaskDashboard(response?.dashboard_data || null);
      } finally {
        if (mounted) setFlaskLoading(false);
      }
    };

    loadFlaskData();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const sessionId = session?.sessionId;
    if (!sessionId) return;

    let active = true;
    const loadQuestionPaper = async () => {
      setPaperLoading(true);
      try {
        const response = await testService.generateQuestionPaper(sessionId);
        if (!active) return;
        const paper = response?.questionPaper || {};
        const bySubject = paper?.questionsBySubject || {};
        const flattened = Array.isArray(paper?.allQuestions)
          ? paper.allQuestions
          : Object.values(bySubject).flat().filter(Boolean);
        setQuestionPaper(flattened);
      } catch (error) {
        if (active) setQuestionPaper([]);
      } finally {
        if (active) setPaperLoading(false);
      }
    };

    loadQuestionPaper();
    return () => {
      active = false;
    };
  }, [session?.sessionId]);

  const questionPaperLookup = useMemo(() => {
    const map = new Map();
    questionPaper.forEach((question) => {
      const keys = [
        question?.id,
        question?._id,
        question?.questionId,
        question?.number,
      ].filter((key) => key !== null && key !== undefined && key !== "");

      keys.forEach((key) => {
        map.set(String(key), question);
      });
    });
    return map;
  }, [questionPaper]);

  const questionLookup = useMemo(() => {
    const map = new Map();
    (session?.questions || []).forEach((question) => {
      map.set(String(getQuestionId(question)), question);
    });
    return map;
  }, [session?.questions]);

  const attempts = useMemo(() => {
    return answers.map((answer, index) => {
      const questionNumber = index + 1;
      const paperQuestion =
        questionPaperLookup.get(String(answer.questionId)) ||
        questionPaperLookup.get(String(answer.question_id)) ||
        questionPaperLookup.get(String(questionNumber)) ||
        null;
      const sessionQuestion =
        questionLookup.get(String(answer.questionId)) || {};
      const question = paperQuestion || sessionQuestion;

      const expectedTime = Number(
        question?.expectedTime ?? question?.expected_time ?? 90,
      );
      const concept =
        answer.conceptArea ||
        question.conceptArea ||
        question.concept_area ||
        question.topic ||
        "General";

      return {
        ...answer,
        index: index + 1,
        question,
        paperQuestion,
        questionText:
          question.text || answer.questionText || "Question text unavailable",
        concept,
        difficulty: Number(answer.difficulty ?? question.difficulty ?? 0.5),
        expectedTime: Number.isFinite(expectedTime) ? expectedTime : 90,
        timeSpent: Number(answer.timeSpent || 0),
        confidence: clamp(answer.confidence ?? 0.5),
      };
    });
  }, [answers, questionLookup, questionPaperLookup]);

  const topicStats = useMemo(() => {
    const map = new Map();

    attempts.forEach((attempt) => {
      const key = attempt.concept;
      if (!map.has(key)) {
        map.set(key, {
          topic: key,
          attempts: 0,
          correct: 0,
          totalTime: 0,
          totalExpected: 0,
          avgDifficultySum: 0,
          confidenceSum: 0,
        });
      }

      const stat = map.get(key);
      stat.attempts += 1;
      stat.correct += attempt.isCorrect ? 1 : 0;
      stat.totalTime += attempt.timeSpent;
      stat.totalExpected += attempt.expectedTime;
      stat.avgDifficultySum += clamp(attempt.difficulty);
      stat.confidenceSum += clamp(attempt.confidence);
    });

    return Array.from(map.values())
      .map((stat) => {
        const accuracy = stat.correct / Math.max(1, stat.attempts);
        return {
          ...stat,
          accuracy,
          avgTime: stat.totalTime / Math.max(1, stat.attempts),
          avgExpected: stat.totalExpected / Math.max(1, stat.attempts),
          avgDifficulty: stat.avgDifficultySum / Math.max(1, stat.attempts),
          confidence: stat.confidenceSum / Math.max(1, stat.attempts),
          speedRatio: stat.totalTime / Math.max(1, stat.totalExpected),
        };
      })
      .sort((a, b) => b.attempts - a.attempts);
  }, [attempts]);

  const selectedTopics =
    session?.config?.selectedTopics || session?.selectedTopics || [];

  const learnedTopics = useMemo(() => {
    if (!selectedTopics.length) return [];
    return selectedTopics.map((topicName) => {
      const match = topicStats.find(
        (topic) =>
          String(topic.topic).toLowerCase() === String(topicName).toLowerCase(),
      );

      const confidence = match ? match.confidence : 0;
      const mastery = match ? match.accuracy : 0;
      const learnedPercent = Math.round(
        (mastery * 0.7 + confidence * 0.3) * 100,
      );

      return {
        topic: topicName,
        attempts: match?.attempts || 0,
        mastery,
        confidence,
        learnedPercent,
      };
    });
  }, [selectedTopics, topicStats]);

  const strongTopics = useMemo(
    () =>
      topicStats.filter((topic) => topic.attempts > 0 && topic.accuracy >= 0.7),
    [topicStats],
  );

  const weakTopics = useMemo(
    () =>
      topicStats.filter((topic) => topic.attempts > 0 && topic.accuracy < 0.6),
    [topicStats],
  );

  const sessionTotals = useMemo(() => {
    const answeredCount = attempts.length;
    const correct = attempts.filter((item) => item.isCorrect).length;
    const wrong = answeredCount - correct;
    const totalTime = attempts.reduce((sum, item) => sum + item.timeSpent, 0);
    const totalExpected = attempts.reduce(
      (sum, item) => sum + item.expectedTime,
      0,
    );
    const avgConfidence =
      attempts.reduce((sum, item) => sum + item.confidence, 0) /
      Math.max(1, answeredCount);

    return {
      answeredCount,
      correct,
      wrong,
      totalTime,
      totalExpected,
      accuracy: correct / Math.max(1, answeredCount),
      avgConfidence,
      timeEfficiency:
        totalExpected > 0 ? totalExpected / Math.max(1, totalTime) : 0,
    };
  }, [attempts]);

  const localDifficultySeries = attempts.map((attempt) =>
    clamp(attempt.difficulty),
  );
  const localConfidenceSeries = attempts.map((attempt) =>
    clamp(attempt.confidence),
  );
  const localCumulativeAccuracySeries = attempts.map((_, index) => {
    const slice = attempts.slice(0, index + 1);
    const correct = slice.filter((item) => item.isCorrect).length;
    return clamp(correct / Math.max(1, slice.length));
  });

  const flaskDifficultySeries =
    flaskDashboard?.charts?.difficulty_over_time?.map((item) =>
      clamp(item.value),
    ) || [];

  const flaskAccuracySeries =
    flaskDashboard?.charts?.accuracy_over_time?.map((item) =>
      clamp(item.value),
    ) || [];

  const difficultySeriesToShow = flaskDifficultySeries.length
    ? flaskDifficultySeries
    : localDifficultySeries;
  const accuracySeriesToShow = flaskAccuracySeries.length
    ? flaskAccuracySeries
    : localCumulativeAccuracySeries;

  const cardClass =
    "rounded-2xl border p-4 md:p-5 shadow-sm transition-all duration-200";
  const surfaceClass = isDark
    ? "bg-slate-900 border-slate-700 text-slate-100"
    : "bg-white border-slate-200 text-slate-900";
  const mutedClass = isDark ? "text-slate-300" : "text-slate-600";

  const handlePrint = () => {
    window.print();
  };

  const handleExportPdfData = async () => {
    if (!session?.sessionId) return;
    try {
      await testService.exportTestResults(session.sessionId, "pdf");
    } catch (error) {
      console.error("PDF export failed:", error);
    }
  };

  if (!answers.length && !session?.sessionId) {
    return (
      <div
        className={`min-h-screen px-4 py-8 md:px-8 ${
          isDark ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"
        }`}
      >
        <div className={`mx-auto max-w-4xl ${cardClass} ${surfaceClass}`}>
          <div className="mb-3 flex items-center gap-2 text-amber-500">
            <FiAlertCircle className="h-5 w-5" />
            <span className="font-semibold">No practice result data found</span>
          </div>
          <p className={mutedClass}>
            This page needs session result state. Start a practice session and
            end it to view deep analytics.
          </p>
          <button
            type="button"
            onClick={() => navigate("/test/practice")}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            <FiArrowLeft className="h-4 w-4" />
            Go to Practice
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen px-4 py-6 md:px-8 md:py-8 ${
        isDark ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"
      }`}
    >
      <style>
        {`@media print {
          body * { visibility: hidden; }
          #practice-result-print, #practice-result-print * { visibility: visible; }
          #practice-result-print { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }`}
      </style>
      <div
        id="practice-result-print"
        className="mx-auto flex w-full max-w-7xl flex-col gap-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold md:text-3xl">
              Practice Session Results
            </h1>
            <p className={`mt-1 text-sm ${mutedClass}`}>
              Session: {session?.sessionId || "N/A"} • Ended:{" "}
              {formatDateTime(session?.completedAt || new Date())}
            </p>
          </div>
          <div className="no-print flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/test/practice")}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                isDark
                  ? "bg-slate-800 text-slate-100 hover:bg-slate-700"
                  : "bg-white text-slate-800 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <FiArrowLeft className="h-4 w-4" />
              New Practice
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <FiRefreshCw className="h-4 w-4" />
              Refresh Insights
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <FiBookOpen className="h-4 w-4" />
              Print / Save PDF
            </button>
            <button
              type="button"
              onClick={handleExportPdfData}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700"
            >
              <FiBarChart2 className="h-4 w-4" />
              Download PDF Data
            </button>
          </div>
        </div>

        <div
          className={`rounded-2xl border p-4 md:p-5 bg-gradient-to-r ${
            isDark
              ? "from-indigo-900/40 via-cyan-900/30 to-emerald-900/40 border-slate-700"
              : "from-indigo-100 via-cyan-100 to-emerald-100 border-cyan-200"
          }`}
        >
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 backdrop-blur-sm">
              <FiZap className="h-4 w-4" /> Adaptive analytics enabled
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 backdrop-blur-sm">
              <FiTrendingUp className="h-4 w-4" /> Difficulty trend + confidence
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 backdrop-blur-sm">
              <FaBrain className="h-4 w-4" /> 12 model insights
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          {[
            {
              label: "Accuracy",
              value: toPercent(sessionTotals.accuracy),
              icon: <FiTarget className="h-4 w-4" />,
            },
            {
              label: "Correct",
              value: `${sessionTotals.correct}`,
              icon: <FiCheckCircle className="h-4 w-4" />,
            },
            {
              label: "Wrong",
              value: `${sessionTotals.wrong}`,
              icon: <FiXCircle className="h-4 w-4" />,
            },
            {
              label: "Solved",
              value: `${sessionTotals.answeredCount}`,
              icon: <FiBookOpen className="h-4 w-4" />,
            },
            {
              label: "Time Taken",
              value: formatSeconds(sessionTotals.totalTime),
              icon: <FiClock className="h-4 w-4" />,
            },
            {
              label: "Expected Time",
              value: formatSeconds(sessionTotals.totalExpected),
              icon: <FiActivity className="h-4 w-4" />,
            },
            {
              label: "Confidence",
              value: toPercent(sessionTotals.avgConfidence),
              icon: <FaBrain className="h-4 w-4" />,
            },
            {
              label: "Next Difficulty",
              value: toPercent(flaskPredictions?.nextDifficulty || 0.5),
              icon: <FiZap className="h-4 w-4" />,
            },
          ].map((item) => (
            <div key={item.label} className={`${cardClass} ${surfaceClass}`}>
              <div
                className={`mb-2 inline-flex rounded-full p-2 ${isDark ? "bg-slate-800" : "bg-slate-100"}`}
              >
                {item.icon}
              </div>
              <div className="text-lg font-semibold md:text-xl">
                {item.value}
              </div>
              <div className={`text-xs ${mutedClass}`}>{item.label}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className={`${cardClass} ${surfaceClass}`}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <FaChartLine className="h-4 w-4" />
                Difficulty Trend Across Session
              </h2>
              <span className={`text-xs ${mutedClass}`}>
                {flaskDifficultySeries.length
                  ? "Flask CSV trend"
                  : "Live session trend"}
              </span>
            </div>
            <svg viewBox="0 0 320 96" className="h-28 w-full">
              <path
                d={trendPath(difficultySeriesToShow)}
                fill="none"
                stroke={isDark ? "#38bdf8" : "#0284c7"}
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
            <p className={`mt-2 text-xs ${mutedClass}`}>
              Average difficulty:{" "}
              {toPercent(
                difficultySeriesToShow.reduce((sum, value) => sum + value, 0) /
                  Math.max(1, difficultySeriesToShow.length),
              )}
            </p>
          </div>

          <div className={`${cardClass} ${surfaceClass}`}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <FiTrendingUp className="h-4 w-4" />
                Learning & Confidence Graph
              </h2>
              <span className={`text-xs ${mutedClass}`}>
                Accuracy vs confidence
              </span>
            </div>
            <svg viewBox="0 0 320 96" className="h-28 w-full">
              <path
                d={trendPath(accuracySeriesToShow)}
                fill="none"
                stroke={isDark ? "#22c55e" : "#16a34a"}
                strokeWidth="3"
                strokeLinecap="round"
              />
              <path
                d={trendPath(localConfidenceSeries)}
                fill="none"
                stroke={isDark ? "#f59e0b" : "#d97706"}
                strokeWidth="2.5"
                strokeDasharray="6 4"
                strokeLinecap="round"
              />
            </svg>
            <p className={`mt-2 text-xs ${mutedClass}`}>
              Green = learning accuracy, Orange = answer confidence.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className={`${cardClass} ${surfaceClass}`}>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <FiAward className="h-4 w-4" />
              Strong Topics
            </h2>
            {strongTopics.length ? (
              <div className="space-y-3">
                {strongTopics.slice(0, 8).map((topic) => (
                  <div key={topic.topic}>
                    <div className="flex items-center justify-between text-sm">
                      <span>{topic.topic}</span>
                      <span className="font-medium">
                        {toPercent(topic.accuracy)}
                      </span>
                    </div>
                    <div
                      className={`mt-1 h-2 rounded-full ${isDark ? "bg-slate-800" : "bg-slate-200"}`}
                    >
                      <div
                        className="h-2 rounded-full bg-green-500"
                        style={{ width: `${topic.accuracy * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={`text-sm ${mutedClass}`}>
                Strong areas will appear after more solved questions.
              </p>
            )}
          </div>

          <div className={`${cardClass} ${surfaceClass}`}>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <FiAlertCircle className="h-4 w-4" />
              Weak Topics & Work Plan
            </h2>
            {weakTopics.length ? (
              <div className="space-y-3">
                {weakTopics.slice(0, 8).map((topic) => (
                  <div
                    key={topic.topic}
                    className={`rounded-xl p-3 ${isDark ? "bg-slate-800" : "bg-amber-50"}`}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{topic.topic}</span>
                      <span className="text-amber-600">
                        {toPercent(topic.accuracy)}
                      </span>
                    </div>
                    <p className={`mt-1 text-xs ${mutedClass}`}>
                      Work on this topic: revisit core concepts, solve
                      medium-level sets, then retest with timed questions.
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className={`text-sm ${mutedClass}`}>
                No weak topics detected in this session.
              </p>
            )}
          </div>
        </div>

        <div className={`${cardClass} ${surfaceClass}`}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <FiBookOpen className="h-4 w-4" />
              Selected Topics Learning Coverage
            </h2>
            <span className={`text-xs ${mutedClass}`}>
              Mastery-confidence weighted learning percentage
            </span>
          </div>

          {learnedTopics.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {learnedTopics.map((topic) => (
                <div
                  key={topic.topic}
                  className={`rounded-xl border p-3 ${
                    isDark
                      ? "border-slate-700 bg-slate-800"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{topic.topic}</span>
                    <span className="font-semibold">
                      {topic.learnedPercent}%
                    </span>
                  </div>
                  <div
                    className={`mt-2 h-2 rounded-full ${isDark ? "bg-slate-700" : "bg-slate-200"}`}
                  >
                    <div
                      className="h-2 rounded-full bg-blue-500"
                      style={{ width: `${topic.learnedPercent}%` }}
                    />
                  </div>
                  <div className={`mt-2 text-xs ${mutedClass}`}>
                    Attempts: {topic.attempts} • Mastery:{" "}
                    {toPercent(topic.mastery)} • Confidence:{" "}
                    {toPercent(topic.confidence)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className={`text-sm ${mutedClass}`}>
              No selected-topics metadata was found in this session config.
            </p>
          )}
        </div>

        <div className={`${cardClass} ${surfaceClass}`}>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <FaBrain className="h-4 w-4" />
            12 Models Results (Session View)
          </h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {MODEL_TITLES.map((title, index) => {
              const modelIndex = index + 1;
              const content = {
                1: `${Object.keys(modelsData.conceptMastery || {}).length} concepts scored`,
                2: `${Object.keys(modelsData.stabilityIndex || {}).length} concepts stable-tracked`,
                3: `Overall error ${(Number(modelsData.confidenceCalibration?.overall || 0) * 100).toFixed(1)}%`,
                4: `Conceptual ${(Number(modelsData.errorPatterns?.conceptual || 0) * 100).toFixed(0)}%, Careless ${(Number(modelsData.errorPatterns?.careless || 0) * 100).toFixed(0)}%`,
                5: `${modelsData.weaknessPriority?.length || 0} ranked weak areas`,
                6: `${Object.keys(modelsData.forgettingCurve?.retentionScores || {}).length} retention entries`,
                7: `Fatigue ${typeof modelsData.fatigueIndex === "object" ? toPercent(modelsData.fatigueIndex?.current || 0) : toPercent(modelsData.fatigueIndex || 0)}`,
                8: `Profile: ${typeof modelsData.behaviorProfile === "object" ? modelsData.behaviorProfile?.cluster || "balanced" : modelsData.behaviorProfile || "balanced"}`,
                9: `Tolerance ${typeof modelsData.difficultyTolerance === "object" ? toPercent(modelsData.difficultyTolerance?.maxSustainable || 0.5) : toPercent(modelsData.difficultyTolerance || 0.5)}`,
                10: `Efficiency ${typeof modelsData.studyEfficiency === "object" ? toPercent(modelsData.studyEfficiency?.score || 0) : toPercent(modelsData.studyEfficiency || 0)}`,
                11: `Focus loss ${typeof modelsData.focusLoss === "object" ? toPercent(modelsData.focusLoss?.frequency || 0) : toPercent(modelsData.focusLoss || 0)}`,
                12: `${modelsData.timeAllocation?.length || 0} adaptive time slots`,
              };

              return (
                <div
                  key={title}
                  className={`rounded-xl border p-3 ${
                    isDark
                      ? "border-slate-700 bg-slate-800"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="text-sm font-semibold">{title}</div>
                  <p className={`mt-1 text-xs ${mutedClass}`}>
                    {content[modelIndex]}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className={`${cardClass} ${surfaceClass}`}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <FiBarChart2 className="h-4 w-4" />
              Question-wise Deep Review
            </h2>
            <span className={`text-xs ${mutedClass}`}>
              All solved questions with answer and timing
            </span>
          </div>

          <div className="space-y-4">
            {attempts.map((attempt) => {
              const optionMap = new Map(
                (attempt.question?.options || []).map((option) => [
                  String(getOptionId(option)),
                  option.text || option.label || option.value || "",
                ]),
              );
              const selected = Array.isArray(attempt.selectedOptions)
                ? attempt.selectedOptions
                : [attempt.selectedOptions];
              const correctAnswer =
                attempt.paperQuestion?.correctAnswer ??
                attempt.question?.correctAnswer ??
                attempt.question?.correct_answer ??
                attempt.correctAnswer ??
                "N/A";
              const correctAsArray = (
                Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer]
              ).map(normalizeAnswerValue);

              const explanationText =
                attempt.paperQuestion?.explanation ||
                attempt.question?.explanation ||
                attempt.question?.solution ||
                attempt.explanation ||
                "No description available for this question.";

              const solutionSteps =
                attempt.paperQuestion?.solutionSteps ||
                attempt.question?.solutionSteps ||
                attempt.question?.solution_steps ||
                [];

              const ratio =
                attempt.timeSpent / Math.max(1, attempt.expectedTime);
              const ratioLabel =
                ratio > 1.1
                  ? "Over expected"
                  : ratio < 0.9
                    ? "Faster"
                    : "On target";

              return (
                <motion.div
                  key={`${attempt.questionId}-${attempt.index}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-xl border p-4 ${
                    isDark
                      ? "border-slate-700 bg-slate-900"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold">
                      Q{attempt.index}. {attempt.questionText}
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        attempt.isCorrect
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                      }`}
                    >
                      {attempt.isCorrect ? "Correct" : "Wrong"}
                    </span>
                  </div>

                  <div
                    className={`grid gap-2 text-xs md:grid-cols-2 ${mutedClass}`}
                  >
                    <div>Topic: {attempt.concept}</div>
                    <div>Difficulty: {toPercent(attempt.difficulty)}</div>
                    <div>
                      Expected Time: {formatSeconds(attempt.expectedTime)}
                    </div>
                    <div>
                      Time Taken: {formatSeconds(attempt.timeSpent)} (
                      {ratioLabel})
                    </div>
                    <div>Confidence: {toPercent(attempt.confidence)}</div>
                    <div>Submitted: {formatDateTime(attempt.timestamp)}</div>
                  </div>

                  <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                    <div>
                      <div
                        className={`mb-1 text-xs font-semibold uppercase tracking-wide ${mutedClass}`}
                      >
                        Your Answer
                      </div>
                      <div
                        className={`rounded-lg p-2 ${isDark ? "bg-slate-800" : "bg-slate-50"}`}
                      >
                        {selected
                          .map(normalizeAnswerValue)
                          .map(
                            (value) =>
                              `${value}${optionMap.get(String(value)) ? `. ${optionMap.get(String(value))}` : ""}`,
                          )
                          .join(", ") || "N/A"}
                      </div>
                    </div>
                    <div>
                      <div
                        className={`mb-1 text-xs font-semibold uppercase tracking-wide ${mutedClass}`}
                      >
                        Correct Answer
                      </div>
                      <div
                        className={`rounded-lg p-2 ${isDark ? "bg-slate-800" : "bg-emerald-50"}`}
                      >
                        {correctAsArray
                          .map(
                            (value) =>
                              `${value}${optionMap.get(String(value)) ? `. ${optionMap.get(String(value))}` : ""}`,
                          )
                          .join(", ") || "N/A"}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`mt-3 rounded-lg p-3 text-sm ${
                      isDark ? "bg-slate-800" : "bg-blue-50"
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide">
                      <FiInfo className="h-3 w-3" /> Answer Description
                    </div>
                    <p className={mutedClass}>{explanationText}</p>
                    {Array.isArray(solutionSteps) &&
                      solutionSteps.length > 0 && (
                        <ol
                          className={`mt-2 list-decimal space-y-1 pl-5 text-xs ${mutedClass}`}
                        >
                          {solutionSteps.map((step, idx) => (
                            <li key={`${attempt.questionId}-step-${idx}`}>
                              {step}
                            </li>
                          ))}
                        </ol>
                      )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        <div className={`${cardClass} ${surfaceClass}`}>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <FaFire className="h-4 w-4" />
            Flask CSV + Model Backend Insights
          </h2>
          {paperLoading && (
            <p className={`mb-2 text-xs ${mutedClass}`}>
              Syncing official question paper for correct answers and
              explanations...
            </p>
          )}
          {flaskLoading ? (
            <p className={`text-sm ${mutedClass}`}>
              Loading backend trend data...
            </p>
          ) : flaskDashboard ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div
                className={`rounded-xl p-3 ${isDark ? "bg-slate-800" : "bg-slate-50"}`}
              >
                <div className="text-xs uppercase tracking-wide text-cyan-500">
                  Readiness Score
                </div>
                <div className="text-xl font-semibold">
                  {toPercent(flaskDashboard?.summary?.readiness_score || 0.5)}
                </div>
              </div>
              <div
                className={`rounded-xl p-3 ${isDark ? "bg-slate-800" : "bg-slate-50"}`}
              >
                <div className="text-xs uppercase tracking-wide text-rose-500">
                  Burnout Risk
                </div>
                <div className="text-xl font-semibold">
                  {toPercent(flaskDashboard?.summary?.burnout_risk || 0.3)}
                </div>
              </div>
              <div
                className={`rounded-xl p-3 ${isDark ? "bg-slate-800" : "bg-slate-50"}`}
              >
                <div className="text-xs uppercase tracking-wide text-emerald-500">
                  Current Streak
                </div>
                <div className="text-xl font-semibold">
                  {flaskDashboard?.recent_activity?.streak_days || 0} days
                </div>
              </div>
              <div
                className={`rounded-xl p-3 ${isDark ? "bg-slate-800" : "bg-slate-50"}`}
              >
                <div className="text-xs uppercase tracking-wide text-indigo-500">
                  Practice Model
                </div>
                <div className="text-sm font-medium">
                  {flaskDashboard?.predictions?.practice_model?.trained
                    ? "Trained"
                    : "Not trained"}
                </div>
              </div>
              <div
                className={`rounded-xl p-3 ${isDark ? "bg-slate-800" : "bg-slate-50"}`}
              >
                <div className="text-xs uppercase tracking-wide text-amber-500">
                  Exam Model
                </div>
                <div className="text-sm font-medium">
                  {flaskDashboard?.predictions?.exam_model?.trained
                    ? "Trained"
                    : "Not trained"}
                </div>
              </div>
              <div
                className={`rounded-xl p-3 ${isDark ? "bg-slate-800" : "bg-slate-50"}`}
              >
                <div className="text-xs uppercase tracking-wide text-fuchsia-500">
                  Questions Today
                </div>
                <div className="text-xl font-semibold">
                  {flaskDashboard?.recent_activity?.questions_today || 0}
                </div>
              </div>
            </div>
          ) : (
            <p className={`text-sm ${mutedClass}`}>
              Flask dashboard insights are not available currently for this
              student.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PracticeResult;
