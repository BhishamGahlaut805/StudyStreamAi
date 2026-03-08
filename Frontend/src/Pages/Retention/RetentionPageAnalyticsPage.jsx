import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FiActivity,
  FiAlertCircle,
  FiArrowLeft,
  FiBarChart2,
  FiCalendar,
  FiClock,
  FiInfo,
  FiMoon,
  FiRefreshCw,
  FiSun,
  FiTarget,
  FiTrendingUp,
} from "react-icons/fi";
import { useAuth } from "../../context/authContext";
import authService from "../../services/authService";
import retentionService from "../../services/RetentionModel/RetentionService";

const RETENTION_ANALYTICS_THEME_KEY = "retention_analytics_theme";

const hasValue = (value) =>
  value !== undefined && value !== null && value !== "";

const firstDefined = (...values) => {
  for (const value of values) {
    if (hasValue(value)) return value;
  }
  return undefined;
};

const clampRatio = (value, fallback = 0) => {
  const n = Number(value);
  if (!Number.isFinite(n))
    return Math.max(0, Math.min(1, Number(fallback) || 0));
  if (n > 1 && n <= 100) return Math.max(0, Math.min(1, n / 100));
  return Math.max(0, Math.min(1, n));
};

const toPercent = (value, fallback = 0) =>
  Math.round(clampRatio(value, fallback) * 100);

const formatTopic = (topic) =>
  String(topic || "General")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());

const explainBand = (ratio) => {
  const score = clampRatio(ratio, 0);
  if (score >= 0.8) return "Excellent";
  if (score >= 0.65) return "Strong";
  if (score >= 0.5) return "Stable";
  if (score >= 0.35) return "Needs Support";
  return "Critical";
};

const StatCard = ({ title, value, helper, color, dark }) => (
  <article
    className={`rounded-2xl border p-4 shadow-sm ${
      dark ? "border-slate-700 bg-slate-900/80" : "border-slate-200 bg-white"
    }`}
  >
    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
      {title}
    </p>
    <p className="mt-2 text-2xl font-black" style={{ color }}>
      {value}
    </p>
    <p className={`mt-1 text-xs ${dark ? "text-slate-400" : "text-slate-600"}`}>
      {helper}
    </p>
  </article>
);

const ScoreBar = ({
  value,
  dark,
  palette = "from-cyan-500 via-blue-500 to-emerald-500",
}) => (
  <div className={`h-2 rounded-full ${dark ? "bg-slate-700" : "bg-slate-200"}`}>
    <div
      className={`h-2 rounded-full bg-gradient-to-r ${palette}`}
      style={{ width: `${Math.max(2, Math.min(100, Number(value) || 0))}%` }}
    />
  </div>
);

const TriMetricGraph = ({ retention, difficulty, probability, dark }) => {
  const points = [
    {
      label: "Retention",
      value: hasValue(retention) ? Number(retention) : null,
    },
    {
      label: "Difficulty",
      value: hasValue(difficulty) ? Number(difficulty) : null,
    },
    {
      label: "P(Correct)",
      value: hasValue(probability) ? Number(probability) : null,
    },
  ];

  const mapX = (i) =>
    points.length === 1 ? 50 : 12 + (i * 76) / (points.length - 1);
  const mapY = (v) =>
    90 - (Math.max(0, Math.min(100, Number(v || 0))) * 80) / 100;

  const available = points.filter((p) => p.value !== null);
  const path = available
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${mapX(i).toFixed(2)} ${mapY(p.value).toFixed(2)}`,
    )
    .join(" ");

  return (
    <div
      className={`rounded-xl border p-3 ${
        dark ? "border-slate-700 bg-slate-950/55" : "border-slate-200 bg-white"
      }`}
    >
      <svg
        viewBox="0 0 100 100"
        className="h-28 w-full"
        role="img"
        aria-label="Question analytics graph"
      >
        <line
          x1="12"
          y1="90"
          x2="88"
          y2="90"
          stroke="#94a3b8"
          strokeWidth="0.45"
        />
        <line
          x1="12"
          y1="62"
          x2="88"
          y2="62"
          stroke="#cbd5e1"
          strokeDasharray="1.4 1.4"
          strokeWidth="0.35"
        />
        <line
          x1="12"
          y1="34"
          x2="88"
          y2="34"
          stroke="#cbd5e1"
          strokeDasharray="1.4 1.4"
          strokeWidth="0.35"
        />
        <line
          x1="12"
          y1="10"
          x2="88"
          y2="10"
          stroke="#cbd5e1"
          strokeDasharray="1.4 1.4"
          strokeWidth="0.35"
        />
        {path && (
          <path
            d={path}
            fill="none"
            stroke="#06b6d4"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        )}
        {available.map((p, i) => (
          <circle
            key={`${p.label}-${i}`}
            cx={mapX(i)}
            cy={mapY(p.value)}
            r="1.4"
            fill="#06b6d4"
          >
            <title>{`${p.label}: ${Math.round(p.value)}%`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
        {points.map((p) => (
          <span
            key={p.label}
            className={`rounded px-2 py-1 text-center font-semibold ${
              dark
                ? "bg-slate-800 text-slate-200"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            {p.label}: {p.value === null ? "N/A" : `${Math.round(p.value)}%`}
          </span>
        ))}
      </div>
    </div>
  );
};

const TimelineSnapshotGraph = ({ points, dark }) => {
  if (!Array.isArray(points) || points.length === 0) {
    return (
      <p
        className={`rounded-xl border border-dashed p-4 text-sm ${dark ? "border-slate-600 text-slate-400" : "border-slate-300 text-slate-500"}`}
      >
        Timestamp timeline data is not available yet.
      </p>
    );
  }

  const mapX = (index) =>
    points.length === 1 ? 50 : 8 + (index * 84) / (points.length - 1);
  const mapY = (value) =>
    90 - (Math.max(0, Math.min(100, Number(value || 0))) * 76) / 100;

  const retentionPath = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${mapX(i).toFixed(2)} ${mapY(p.retentionPct).toFixed(2)}`,
    )
    .join(" ");
  const complexityPath = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${mapX(i).toFixed(2)} ${mapY(p.complexityPct).toFixed(2)}`,
    )
    .join(" ");

  return (
    <div
      className={`rounded-xl border p-3 ${dark ? "border-slate-700 bg-slate-950/55" : "border-slate-200 bg-white"}`}
    >
      <svg
        viewBox="0 0 100 100"
        className="h-52 w-full"
        role="img"
        aria-label="Timeline analytics graph"
      >
        <line
          x1="8"
          y1="90"
          x2="92"
          y2="90"
          stroke="#94a3b8"
          strokeWidth="0.45"
        />
        <line
          x1="8"
          y1="66"
          x2="92"
          y2="66"
          stroke="#cbd5e1"
          strokeDasharray="1.4 1.4"
          strokeWidth="0.35"
        />
        <line
          x1="8"
          y1="42"
          x2="92"
          y2="42"
          stroke="#cbd5e1"
          strokeDasharray="1.4 1.4"
          strokeWidth="0.35"
        />
        <line
          x1="8"
          y1="18"
          x2="92"
          y2="18"
          stroke="#cbd5e1"
          strokeDasharray="1.4 1.4"
          strokeWidth="0.35"
        />

        <path
          d={retentionPath}
          fill="none"
          stroke="#06b6d4"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
        <path
          d={complexityPath}
          fill="none"
          stroke="#f97316"
          strokeWidth="1.25"
          strokeLinecap="round"
        />

        {points.map((p, i) => (
          <g key={`timeline-${p.sequence}-${i}`}>
            <circle
              cx={mapX(i)}
              cy={mapY(p.retentionPct)}
              r="1.1"
              fill="#06b6d4"
            >
              <title>{`Q${p.sequence} | ${p.clockLabel} | Retention ${Math.round(p.retentionPct)}% | P(Correct Next) ${Math.round(p.pNextPct)}% | Difficulty ${Math.round(p.difficultyPct)}%`}</title>
            </circle>
            <circle
              cx={mapX(i)}
              cy={mapY(p.complexityPct)}
              r="1.1"
              fill="#f97316"
            >
              <title>{`Q${p.sequence} | Complexity ${Math.round(p.complexityPct)}% | Gap ${Math.round(p.gapSeconds)}s | Response ${Math.round(p.responseTimeMs / 1000)}s | Correct ${p.isCorrect ? "Yes" : "No"}`}</title>
            </circle>
          </g>
        ))}
      </svg>
      <div
        className={`mt-2 flex flex-wrap gap-2 text-[10px] ${dark ? "text-slate-300" : "text-slate-600"}`}
      >
        <span className="rounded-full bg-cyan-600/80 px-2 py-1 font-semibold text-white">
          Retention Line
        </span>
        <span className="rounded-full bg-orange-500/90 px-2 py-1 font-semibold text-white">
          Complexity Line
        </span>
        <span className="rounded-full bg-slate-700/80 px-2 py-1 font-semibold text-white">
          Hover points for snapshot tooltips
        </span>
      </div>
    </div>
  );
};

const HourlyComplexityBars = ({ points, dark }) => {
  if (!Array.isArray(points) || points.length === 0) {
    return (
      <p
        className={`rounded-xl border border-dashed p-4 text-sm ${dark ? "border-slate-600 text-slate-400" : "border-slate-300 text-slate-500"}`}
      >
        Hourly complexity distribution is not available yet.
      </p>
    );
  }

  const maxAttempts = Math.max(
    1,
    ...points.map((p) => Number(p.attempts || 0)),
  );
  return (
    <div className="space-y-2">
      {points.map((p) => {
        const width = Math.max(
          5,
          (Number(p.attempts || 0) / maxAttempts) * 100,
        );
        const complexityPct = toPercent(p.averageComplexityIndex, 0);
        return (
          <div key={`hour-${p.hour}`}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span
                className={dark ? "text-slate-300" : "text-slate-700"}
              >{`${String(p.hour).padStart(2, "0")}:00`}</span>
              <span
                className={dark ? "text-slate-400" : "text-slate-500"}
              >{`${p.attempts} attempts | complexity ${complexityPct}%`}</span>
            </div>
            <div
              className={`h-2 rounded-full ${dark ? "bg-slate-700" : "bg-slate-200"}`}
            >
              <div
                className="h-2 rounded-full bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-rose-500"
                style={{ width: `${width}%` }}
                title={`Hour ${p.hour}: attempts ${p.attempts}, avg complexity ${complexityPct}%, avg retention ${toPercent(p.averageRetentionProbability, 0)}%`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const RetentionPageAnalyticsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const routeSessionId = location.state?.sessionId || null;
  const routeConfig = location.state?.config || {};

  const studentId = useMemo(
    () =>
      routeConfig.studentId ||
      user?.studentId ||
      user?.id ||
      authService.getStudentId(),
    [routeConfig.studentId, user],
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [analytics, setAnalytics] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const savedTheme = localStorage.getItem(RETENTION_ANALYTICS_THEME_KEY);
      if (savedTheme === "dark") return true;
      if (savedTheme === "light") return false;
      return Boolean(
        window.matchMedia?.("(prefers-color-scheme: dark)")?.matches,
      );
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        RETENTION_ANALYTICS_THEME_KEY,
        isDarkMode ? "dark" : "light",
      );
    } catch {
      // Ignore localStorage write failures.
    }
  }, [isDarkMode]);

  const fetchAnalytics = async (refresh = false) => {
    if (!studentId) {
      setError("Student id not found. Please login again.");
      setLoading(false);
      return;
    }

    if (!routeSessionId) {
      setError(
        "Session id not found. Open analytics from an active retention session.",
      );
      setLoading(false);
      return;
    }

    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError("");

      const token = authService.getToken();
      retentionService.initialize(studentId);
      if (token) retentionService.setAuthToken(token);

      const response = await retentionService.getSessionAnalyticsSnapshot(
        routeSessionId,
        refresh,
      );

      if (!response?.success || !response.analytics) {
        setError(response?.error || "Failed to load session analytics.");
        return;
      }

      setAnalytics(response.analytics);
    } catch (err) {
      setError(String(err?.message || "Failed to load session analytics."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeSessionId, studentId]);

  const topMetrics = useMemo(() => {
    if (!analytics) return null;

    return {
      subjectRetentionScore: clampRatio(analytics.subjectRetentionScore, 0),
      optimalRevisionIntervalDays: Number(
        firstDefined(analytics.optimalRevisionIntervalDays, 0),
      ),
      predictedLongTermRetentionScore: clampRatio(
        analytics.predictedLongTermRetentionScore,
        0,
      ),
      fatigueRiskProbability: clampRatio(analytics.fatigueRiskProbability, 0),
      nextQuestionDifficultyOverall: clampRatio(
        analytics.nextQuestionDifficultyOverall,
        0,
      ),
      probabilityCorrectNextAttemptOverall: clampRatio(
        analytics.probabilityCorrectNextAttemptOverall,
        0,
      ),
    };
  }, [analytics]);

  const topicPriority = useMemo(() => {
    const list = Array.isArray(analytics?.nextTopicRevisionPriority)
      ? analytics.nextTopicRevisionPriority
      : [];

    return list
      .map((row, index) => ({
        rank: index + 1,
        topic: formatTopic(row?.topic),
        priorityScore: Math.max(
          0,
          Math.min(100, Number(row?.priorityScore || 0)),
        ),
        retentionScore: toPercent(row?.retentionScore, 0),
        questionsAttempted: Math.max(0, Number(row?.questionsAttempted || 0)),
      }))
      .slice(0, 10);
  }, [analytics?.nextTopicRevisionPriority]);

  const scheduleRows = useMemo(() => {
    const list = Array.isArray(analytics?.optimalDailyStudySchedule)
      ? analytics.optimalDailyStudySchedule
      : [];

    return list
      .slice(0, 8)
      .map((row, index) => {
        const label = String(row?.label || "").trim();
        const startTime = String(row?.startTime || "").trim();
        const endTime = String(row?.endTime || "").trim();
        const focus = String(row?.focus || "").trim();
        const source = String(row?.source || "").trim();
        const plannedQuestions = Number(row?.plannedQuestions);

        const hasAnyValue =
          Boolean(label) ||
          Boolean(startTime) ||
          Boolean(endTime) ||
          Boolean(focus) ||
          Number.isFinite(plannedQuestions);

        if (!hasAnyValue) return null;

        return {
          id: `${label || "schedule"}-${index}`,
          label: label || "Study Slot",
          startTime,
          endTime,
          focus,
          source,
          plannedQuestions: Math.max(
            0,
            Number.isFinite(plannedQuestions) ? plannedQuestions : 0,
          ),
        };
      })
      .filter(Boolean);
  }, [analytics?.optimalDailyStudySchedule]);

  const subjectPriority = useMemo(() => {
    const list = Array.isArray(analytics?.subjectPriorityOrder)
      ? analytics.subjectPriorityOrder
      : [];

    return list
      .map((row, index) => ({
        rank: Number(row?.rank || index + 1),
        subject: formatTopic(row?.subject),
        score: Math.max(0, Math.min(100, Number(row?.score || 0))),
      }))
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 8);
  }, [analytics?.subjectPriorityOrder]);

  const questionAnalytics = useMemo(() => {
    const list = Array.isArray(analytics?.questionAnalytics)
      ? analytics.questionAnalytics
      : [];
    return list.slice(0, 30).map((row, index) => ({
      id: String(row?.questionId || `q-${index}`),
      label: `Q${index + 1}`,
      questionText: String(row?.questionText || `Question ${index + 1}`),
      topic: formatTopic(row?.topic),
      retentionProbability: hasValue(row?.retentionProbability)
        ? toPercent(row?.retentionProbability, 0)
        : null,
      nextQuestionDifficulty: hasValue(row?.nextQuestionDifficulty)
        ? toPercent(row?.nextQuestionDifficulty, 0)
        : null,
      probabilityCorrectNextAttempt: hasValue(
        row?.probabilityCorrectNextAttempt,
      )
        ? toPercent(row?.probabilityCorrectNextAttempt, 0)
        : null,
      optimalRevisionIntervalDays: hasValue(row?.optimalRevisionIntervalDays)
        ? Number(row?.optimalRevisionIntervalDays)
        : null,
      reviewStage: String(row?.reviewStage || "Scheduled"),
      isCorrect: Boolean(row?.isCorrect),
      responseTimeMs: Math.max(0, Number(row?.responseTimeMs || 0)),
      attemptNumber: Math.max(1, Number(row?.attemptNumber || 1)),
    }));
  }, [analytics?.questionAnalytics]);

  const timelinePoints = useMemo(() => {
    const raw = Array.isArray(analytics?.timelineAnalytics)
      ? analytics.timelineAnalytics
      : Array.isArray(analytics?.graphSnapshots?.timelineSeries)
        ? analytics.graphSnapshots.timelineSeries
        : [];

    return raw.slice(0, 120).map((row, index) => {
      const timestamp = row?.timestamp ? new Date(row.timestamp) : null;
      const clockLabel =
        timestamp && !Number.isNaN(timestamp.getTime())
          ? timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
          : "N/A";

      return {
        sequence: Number(row?.sequence || index + 1),
        questionId: String(row?.questionId || ""),
        clockLabel,
        elapsedSeconds: Math.max(0, Number(row?.elapsedSeconds || 0)),
        gapSeconds: Math.max(0, Number(row?.gapSeconds || 0)),
        retentionPct: toPercent(row?.retentionProbability, 0),
        difficultyPct: toPercent(row?.nextQuestionDifficulty, 0),
        pNextPct: toPercent(row?.probabilityCorrectNextAttempt, 0),
        complexityPct: toPercent(row?.complexityIndex, 0),
        responseTimeMs: Math.max(0, Number(row?.responseTimeMs || 0)),
        isCorrect: Boolean(row?.isCorrect),
      };
    });
  }, [analytics?.graphSnapshots?.timelineSeries, analytics?.timelineAnalytics]);

  const hourlyComplexity = useMemo(() => {
    const raw = Array.isArray(analytics?.graphSnapshots?.hourlySeries)
      ? analytics.graphSnapshots.hourlySeries
      : [];
    return raw
      .map((row) => ({
        hour: Number(row?.hour),
        attempts: Math.max(0, Number(row?.attempts || 0)),
        averageComplexityIndex: clampRatio(row?.averageComplexityIndex, 0),
        averageRetentionProbability: clampRatio(
          row?.averageRetentionProbability,
          0,
        ),
      }))
      .filter((row) => Number.isFinite(row.hour))
      .sort((a, b) => a.hour - b.hour);
  }, [analytics?.graphSnapshots?.hourlySeries]);

  const timestampSummary = useMemo(() => {
    const summary = analytics?.timestampSummary || {};
    const durationMinutes = Math.max(
      0,
      Number(
        summary?.durationMinutes || analytics?.sessionDurationMinutes || 0,
      ),
    );
    return {
      durationMinutes,
      attemptsPerMinute: Math.max(0, Number(summary?.attemptsPerMinute || 0)),
      averageGapSeconds: Math.max(0, Number(summary?.averageGapSeconds || 0)),
      minGapSeconds: Math.max(0, Number(summary?.minGapSeconds || 0)),
      maxGapSeconds: Math.max(0, Number(summary?.maxGapSeconds || 0)),
      peakActivityHour: Number.isFinite(Number(summary?.peakActivityHour))
        ? Number(summary.peakActivityHour)
        : null,
    };
  }, [analytics?.sessionDurationMinutes, analytics?.timestampSummary]);

  const complexitySummary = useMemo(() => {
    const summary = analytics?.complexityAnalytics || {};
    return {
      averageComplexityIndex: clampRatio(summary?.averageComplexityIndex, 0),
      peakComplexityIndex: clampRatio(summary?.peakComplexityIndex, 0),
      complexityVolatility: clampRatio(summary?.complexityVolatility, 0),
      retentionStabilityIndex: clampRatio(summary?.retentionStabilityIndex, 0),
      predictionStabilityIndex: clampRatio(
        summary?.predictionStabilityIndex,
        0,
      ),
      averageResponseTimeMs: Math.max(
        0,
        Number(summary?.averageResponseTimeMs || 0),
      ),
      responseTimeVolatilityMs: Math.max(
        0,
        Number(summary?.responseTimeVolatilityMs || 0),
      ),
    };
  }, [analytics?.complexityAnalytics]);

  const pageShellClass = isDarkMode
    ? "min-h-screen bg-[radial-gradient(circle_at_10%_10%,_#1e293b_0%,_#0b1120_48%,_#020617_100%)] px-4 py-8 text-slate-100 sm:px-8"
    : "min-h-screen bg-[radial-gradient(circle_at_8%_10%,_#cffafe_0%,_#f8fafc_38%,_#fefce8_100%)] px-4 py-8 text-slate-900 sm:px-8";

  const panelClass = isDarkMode
    ? "rounded-3xl border border-slate-700 bg-slate-900/80 p-5 shadow-sm"
    : "rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm";

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 px-6 py-12">
        <div className="mx-auto max-w-5xl rounded-3xl bg-white p-10 text-center shadow">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
            Retention Analytics
          </p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">
            Preparing Session Metrics...
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Loading session-backed analytics from your latest retention run.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={pageShellClass}>
      <div className="mx-auto max-w-7xl space-y-6">
        <section className={panelClass}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-500">
                Retention Analytics
              </p>
              <h1 className="mt-2 text-3xl font-black sm:text-4xl">
                Session Performance Dashboard
              </h1>
              <p
                className={`mt-2 max-w-3xl text-sm ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}
              >
                This report shows only session-driven retention outputs: subject
                retention score, topic revision priority, revision interval,
                retention probability, next difficulty, probability of correct
                next attempt, daily study schedule, subject priority, predicted
                long-term retention, fatigue risk, and per-question analytics.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 print:hidden">
              <button
                type="button"
                onClick={() => fetchAnalytics(true)}
                disabled={refreshing}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
                  isDarkMode
                    ? "border border-cyan-400/40 bg-cyan-900/35 text-cyan-100 hover:bg-cyan-900/60"
                    : "border border-cyan-300 bg-cyan-50 text-cyan-800 hover:bg-cyan-100"
                }`}
              >
                <FiRefreshCw
                  className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                />
                {refreshing ? "Refreshing" : "Refresh Metrics"}
              </button>
              <button
                type="button"
                onClick={() => setIsDarkMode((prev) => !prev)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
                  isDarkMode
                    ? "border border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700"
                    : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                }`}
              >
                {isDarkMode ? (
                  <FiSun className="h-4 w-4" />
                ) : (
                  <FiMoon className="h-4 w-4" />
                )}
                {isDarkMode ? "Day" : "Night"}
              </button>
              <button
                type="button"
                onClick={() => navigate("/retention/start")}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
                  isDarkMode
                    ? "border border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700"
                    : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                }`}
              >
                <FiArrowLeft /> New Session
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <FiAlertCircle className="mr-2 inline h-4 w-4" />
              {error}
            </div>
          )}
        </section>

        {topMetrics && (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              dark={isDarkMode}
              title="Subject Retention Score [0,1]"
              value={topMetrics.subjectRetentionScore.toFixed(3)}
              helper={`Long-term mastery level: ${explainBand(topMetrics.subjectRetentionScore)}`}
              color="#06b6d4"
            />
            <StatCard
              dark={isDarkMode}
              title="Optimal Revision Interval"
              value={`${Math.max(0, Math.round(topMetrics.optimalRevisionIntervalDays))} day(s)`}
              helper="Days until next revision"
              color="#22c55e"
            />
            <StatCard
              dark={isDarkMode}
              title="Retention Probability"
              value={`${toPercent(analytics?.retentionProbabilityOverall, 0)}%`}
              helper="Probability of remembering on future attempt"
              color="#14b8a6"
            />
            <StatCard
              dark={isDarkMode}
              title="Next Question Difficulty"
              value={`${toPercent(topMetrics.nextQuestionDifficultyOverall, 0)}%`}
              helper="Optimal difficulty level for next question"
              color="#f97316"
            />
            <StatCard
              dark={isDarkMode}
              title="Probability Of Correct Next Attempt"
              value={`${toPercent(topMetrics.probabilityCorrectNextAttemptOverall, 0)}%`}
              helper="P(correct next) = sigma(Wx + b)"
              color="#6366f1"
            />
            <StatCard
              dark={isDarkMode}
              title="Predicted Long-Term Retention Score"
              value={`${toPercent(topMetrics.predictedLongTermRetentionScore, 0)}%`}
              helper="Expected stability over coming weeks"
              color="#ec4899"
            />
            <StatCard
              dark={isDarkMode}
              title="Fatigue Risk Probability"
              value={`${toPercent(topMetrics.fatigueRiskProbability, 0)}%`}
              helper="Risk of cognitive fatigue during continued study"
              color="#ef4444"
            />
            <StatCard
              dark={isDarkMode}
              title="Questions Attempted"
              value={questionAnalytics.length}
              helper="Each attempted question includes analytics graph"
              color="#0f172a"
            />
            <StatCard
              dark={isDarkMode}
              title="Session Duration"
              value={`${timestampSummary.durationMinutes.toFixed(1)} min`}
              helper="Calculated from session time and timestamps"
              color="#0891b2"
            />
            <StatCard
              dark={isDarkMode}
              title="Average Complexity Index"
              value={`${toPercent(complexitySummary.averageComplexityIndex, 0)}%`}
              helper="Composite complexity from time, focus, stress, and fatigue"
              color="#b45309"
            />
            <StatCard
              dark={isDarkMode}
              title="Retention Stability Index"
              value={`${toPercent(complexitySummary.retentionStabilityIndex, 0)}%`}
              helper="Higher values indicate more stable retention trajectory"
              color="#7c3aed"
            />
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-2">
          <article className={panelClass}>
            <div className="flex items-center gap-2">
              <FiTrendingUp className="text-cyan-500" />
              <h2 className="text-xl font-black">
                Timestamp Progression Graph
              </h2>
            </div>
            <p
              className={`mt-1 text-sm ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}
            >
              Timeline chart of retention and complexity across session
              timestamps. Each point has snapshot tooltips with clock time,
              correctness, response speed, next probability, and difficulty.
            </p>
            <div className="mt-4">
              <TimelineSnapshotGraph
                points={timelinePoints}
                dark={isDarkMode}
              />
            </div>
            <div
              className={`mt-3 grid grid-cols-2 gap-2 text-xs ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}
            >
              <p>
                Attempts/Minute: {timestampSummary.attemptsPerMinute.toFixed(3)}
              </p>
              <p>Avg Gap: {timestampSummary.averageGapSeconds.toFixed(1)}s</p>
              <p>Min Gap: {timestampSummary.minGapSeconds.toFixed(1)}s</p>
              <p>Max Gap: {timestampSummary.maxGapSeconds.toFixed(1)}s</p>
              <p>
                Peak Hour:{" "}
                {timestampSummary.peakActivityHour === null
                  ? "N/A"
                  : `${String(timestampSummary.peakActivityHour).padStart(2, "0")}:00`}
              </p>
              <p>Timeline Points: {timelinePoints.length}</p>
            </div>
          </article>

          <article className={panelClass}>
            <div className="flex items-center gap-2">
              <FiBarChart2 className="text-violet-500" />
              <h2 className="text-xl font-black">Complexity Distribution</h2>
            </div>
            <p
              className={`mt-1 text-sm ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}
            >
              Hour-wise attempt load and complexity profile based on real
              timestamp buckets.
            </p>
            <div className="mt-4">
              <HourlyComplexityBars
                points={hourlyComplexity}
                dark={isDarkMode}
              />
            </div>
            <div
              className={`mt-3 grid grid-cols-2 gap-2 text-xs ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}
            >
              <p>
                Avg Complexity:{" "}
                {toPercent(complexitySummary.averageComplexityIndex, 0)}%
              </p>
              <p>
                Peak Complexity:{" "}
                {toPercent(complexitySummary.peakComplexityIndex, 0)}%
              </p>
              <p>
                Complexity Volatility:{" "}
                {toPercent(complexitySummary.complexityVolatility, 0)}%
              </p>
              <p>
                Prediction Stability:{" "}
                {toPercent(complexitySummary.predictionStabilityIndex, 0)}%
              </p>
              <p>
                Avg Response Time:{" "}
                {(complexitySummary.averageResponseTimeMs / 1000).toFixed(1)}s
              </p>
              <p>
                Response Volatility:{" "}
                {(complexitySummary.responseTimeVolatilityMs / 1000).toFixed(1)}
                s
              </p>
            </div>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className={panelClass}>
            <div className="flex items-center gap-2">
              <FiTarget className="text-fuchsia-500" />
              <h2 className="text-xl font-black">
                Next Topic Revision Priority
              </h2>
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                  isDarkMode
                    ? "border-slate-500 bg-slate-800 text-slate-200"
                    : "border-slate-300 bg-slate-50 text-slate-600"
                }`}
                title="Higher score means this topic should be revised sooner."
              >
                <FiInfo className="h-3 w-3" />
              </span>
            </div>
            <div className="mt-4 space-y-2">
              {topicPriority.length === 0 ? (
                <p
                  className={`rounded-xl border border-dashed p-4 text-sm ${isDarkMode ? "border-slate-600 text-slate-400" : "border-slate-300 text-slate-500"}`}
                >
                  Topic priority appears once session question analytics are
                  available.
                </p>
              ) : (
                topicPriority.map((row) => (
                  <div
                    key={`${row.topic}-${row.rank}`}
                    className={`rounded-xl border p-3 ${isDarkMode ? "border-slate-700 bg-slate-950/45" : "border-slate-200 bg-slate-50"}`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                      <p className="font-semibold">
                        #{row.rank} {row.topic}
                      </p>
                      <p className="font-black">{row.priorityScore}/100</p>
                    </div>
                    <ScoreBar
                      value={row.priorityScore}
                      dark={isDarkMode}
                      palette="from-rose-500 via-orange-500 to-amber-500"
                    />
                    <p
                      className={`mt-2 text-xs ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}
                    >
                      Retention: {row.retentionScore}% | Attempts:{" "}
                      {row.questionsAttempted}
                    </p>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className={panelClass}>
            <div className="flex items-center gap-2">
              <FiCalendar className="text-cyan-500" />
              <h2 className="text-xl font-black">
                Optimal Daily Study Schedule
              </h2>
            </div>
            <div className="mt-4 space-y-2">
              {scheduleRows.length === 0 ? (
                <p
                  className={`rounded-xl border border-dashed p-4 text-sm ${isDarkMode ? "border-slate-600 text-slate-400" : "border-slate-300 text-slate-500"}`}
                >
                  No schedule blocks were returned by session analytics for this
                  run.
                </p>
              ) : (
                scheduleRows.map((row) => (
                  <div
                    key={row.id}
                    className={`rounded-xl border p-3 ${isDarkMode ? "border-slate-700 bg-slate-950/45" : "border-slate-200 bg-slate-50"}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <p className="font-semibold">{row.label}</p>
                      <p className="font-bold">
                        {row.plannedQuestions} Questions
                      </p>
                    </div>
                    <p
                      className={`mt-1 text-xs ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}
                    >
                      <FiClock className="mr-1 inline h-3 w-3" />
                      {row.startTime && row.endTime
                        ? `${row.startTime} - ${row.endTime}`
                        : "Timing not provided"}
                      {row.focus ? ` | Focus: ${row.focus}` : ""}
                      {row.source ? ` | Source: ${row.source}` : ""}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center gap-2">
                <FiBarChart2 className="text-violet-500" />
                <h3 className="text-base font-black">Subject Priority Order</h3>
              </div>
              <div className="space-y-2">
                {subjectPriority.length === 0 ? (
                  <p
                    className={`rounded-xl border border-dashed p-4 text-sm ${isDarkMode ? "border-slate-600 text-slate-400" : "border-slate-300 text-slate-500"}`}
                  >
                    Subject priority data is not available for this session yet.
                  </p>
                ) : (
                  subjectPriority.map((row) => (
                    <div
                      key={`${row.subject}-${row.rank}`}
                      className={`rounded-lg border px-3 py-2 ${isDarkMode ? "border-slate-700 bg-slate-950/45" : "border-slate-200 bg-slate-50"}`}
                    >
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <p className="font-semibold">
                          {row.rank}. {row.subject}
                        </p>
                        <p className="font-black">{row.score}%</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </article>
        </section>

        <section className={panelClass}>
          <div className="flex items-center gap-2">
            <FiActivity className="text-emerald-500" />
            <h2 className="text-xl font-black">
              Each Question Attempted With Analytics
            </h2>
          </div>
          <p
            className={`mt-1 text-sm ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}
          >
            Every question shows retention probability, next question
            difficulty, and probability of correct next attempt. Formula
            display: P(correct next) = sigma(Wx + b).
          </p>

          {questionAnalytics.length === 0 ? (
            <p
              className={`mt-4 rounded-xl border border-dashed p-4 text-sm ${isDarkMode ? "border-slate-600 text-slate-400" : "border-slate-300 text-slate-500"}`}
            >
              No attempted-question analytics found for this session.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {questionAnalytics.map((row) => (
                <article
                  key={row.id}
                  className={`rounded-xl border p-3 ${isDarkMode ? "border-slate-700 bg-slate-950/35" : "border-slate-200 bg-slate-50"}`}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-sm font-semibold">
                      {row.questionText}
                    </p>
                    <span className="rounded-full bg-cyan-600 px-2 py-0.5 text-[10px] font-bold text-white">
                      {row.label}
                    </span>
                  </div>

                  <p
                    className={`text-xs ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}
                  >
                    Topic: {row.topic}
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div
                      className={`rounded-md p-2 ${isDarkMode ? "bg-slate-900/60" : "bg-white/80"}`}
                    >
                      <p className="text-slate-500">Retention Probability</p>
                      <p className="text-base font-bold">
                        {row.retentionProbability === null
                          ? "N/A"
                          : `${row.retentionProbability}%`}
                      </p>
                    </div>
                    <div
                      className={`rounded-md p-2 ${isDarkMode ? "bg-slate-900/60" : "bg-white/80"}`}
                    >
                      <p className="text-slate-500">Next Question Difficulty</p>
                      <p className="text-base font-bold">
                        {row.nextQuestionDifficulty === null
                          ? "N/A"
                          : `${row.nextQuestionDifficulty}%`}
                      </p>
                    </div>
                    <div
                      className={`rounded-md p-2 ${isDarkMode ? "bg-slate-900/60" : "bg-white/80"}`}
                    >
                      <p className="text-slate-500">P(correct next)</p>
                      <p className="text-base font-bold">
                        {row.probabilityCorrectNextAttempt === null
                          ? "N/A"
                          : `${row.probabilityCorrectNextAttempt}%`}
                      </p>
                    </div>
                    <div
                      className={`rounded-md p-2 ${isDarkMode ? "bg-slate-900/60" : "bg-white/80"}`}
                    >
                      <p className="text-slate-500">Revision Interval</p>
                      <p className="text-base font-bold">
                        {row.optimalRevisionIntervalDays === null
                          ? "N/A"
                          : `${Math.max(0, Math.round(row.optimalRevisionIntervalDays))} day(s)`}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <TriMetricGraph
                      retention={row.retentionProbability}
                      difficulty={row.nextQuestionDifficulty}
                      probability={row.probabilityCorrectNextAttempt}
                      dark={isDarkMode}
                    />
                  </div>

                  <div
                    className={`mt-2 grid grid-cols-2 gap-2 text-[11px] ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}
                  >
                    <p>Attempt: {row.attemptNumber}</p>
                    <p>Response: {Math.round(row.responseTimeMs / 1000)}s</p>
                    <p>Status: {row.isCorrect ? "Correct" : "Incorrect"}</p>
                    <p>Review Stage: {formatTopic(row.reviewStage)}</p>
                  </div>

                  <p
                    className={`mt-2 text-[11px] ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}
                  >
                    Probability of Correct Next Attempt: sigma(Wx + b) ={" "}
                    {row.probabilityCorrectNextAttempt === null
                      ? "N/A"
                      : `${row.probabilityCorrectNextAttempt}%`}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>

        {Array.isArray(analytics?.insights) &&
          analytics.insights.length > 0 && (
            <section className={panelClass}>
              <div className="flex items-center gap-2">
                <FiTrendingUp className="text-sky-500" />
                <h2 className="text-xl font-black">Session Insights</h2>
              </div>
              <ul className="mt-3 grid gap-2">
                {analytics.insights.slice(0, 6).map((line, idx) => (
                  <li
                    key={`insight-${idx}`}
                    className={`rounded-xl border px-3 py-2 text-sm ${
                      isDarkMode
                        ? "border-slate-700 bg-slate-950/45 text-slate-200"
                        : "border-slate-200 bg-slate-50 text-slate-700"
                    }`}
                  >
                    {line}
                  </li>
                ))}
              </ul>
            </section>
          )}
      </div>
    </div>
  );
};

export default RetentionPageAnalyticsPage;
