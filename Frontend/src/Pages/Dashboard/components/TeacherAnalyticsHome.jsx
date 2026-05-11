import React, { useEffect, useState } from "react";
import {
  FiArrowRight,
  FiBarChart2,
  FiClock,
  FiPieChart,
  FiRefreshCw,
  FiTarget,
  FiTrendingUp,
  FiUsers,
  FiBook,
  FiAlertCircle,
  FiAward,
  FiTrendingDown,
  FiZap,
  FiCheckCircle,
  FiMap,
} from "react-icons/fi";
import teacherService from "../../../services/Teacher/teacherService";
import StyledCard from "../../../components/StyleCard";
import EnhancedBarChart from "./EnhancedBarChart";
import MasteryPieChart from "./MasteryPieChart";

const getServiceData = (response) => {
  if (!response) return null;
  if (response.data !== undefined && response.success !== undefined) {
    return response.data;
  }
  return response.data !== undefined ? response.data : response;
};

const asArray = (value) => (Array.isArray(value) ? value : []);

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value?._id?.toString?.() || value?.id?.toString?.() || "";
};

const formatStudentName = (student) =>
  student?.name ||
  student?.studentName ||
  student?.fullName ||
  "Unknown Student";

const formatStudentEmail = (student) =>
  student?.email || student?.studentEmail || "";

// NEW: Normalize to 1 decimal point
// Normalize dashboard numbers to one decimal point.
const formatOneDecimal = (value) => toNumber(value, 0).toFixed(1);

const formatPercent = (value) => `${formatOneDecimal(value)}%`;

const formatDecimal = (value, digits = 1) => toNumber(value, 0).toFixed(digits);

const formatMetric = (value, decimals = 1) =>
  toNumber(value, 0).toFixed(decimals);

// NEW: Tooltip component
const Tooltip = ({ children }) => <>{children}</>;

const toChartPoints = (rows = [], valueKey = "value", labelKey = "label") =>
  rows.map((row) => ({
    label: row?.[labelKey] || row?.topic || row?.name || row?.subject || "Item",
    value: toNumber(row?.[valueKey], 0),
  }));

const toBarRows = (rows = [], valueKey = "value", labelKey = "label") =>
  rows.slice(0, 8).map((row, index) => ({
    label:
      row?.[labelKey] ||
      row?.topic ||
      row?.name ||
      row?.subject ||
      `Item ${index + 1}`,
    value: toNumber(row?.[valueKey], 0),
    color: ["bg-indigo-500", "bg-fuchsia-500", "bg-cyan-500", "bg-emerald-500"][
      index % 4
    ],
  }));

const MetricCard = ({ icon: Icon, label, value, subtext, accent }) => (
  <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/80">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
          {value}
        </p>
        {subtext ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {subtext}
          </p>
        ) : null}
      </div>
      <div className={`rounded-2xl p-3 ${accent || "bg-indigo-500"}`}>
        <Icon className="text-white" size={22} />
      </div>
    </div>
  </div>
);

const SectionCard = ({ title, subtitle, children, action }) => (
  <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          {title}
        </h3>
        {subtitle ? (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        ) : null}
      </div>
      {action}
    </div>
    {children}
  </div>
);

const LineChart = ({ points = [], color = "#6366f1" }) => {
  if (!points.length) {
    return (
      <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
        No chart data available yet.
      </div>
    );
  }

  const paddedPoints = points.map((point) => toNumber(point.value, 0));
  const maxValue = Math.max(...paddedPoints, 1);
  const minValue = Math.min(...paddedPoints, 0);
  const width = 100;
  const height = 100;
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const polylinePoints = points
    .map((point, index) => {
      const x = index * step;
      const y =
        height -
        ((toNumber(point.value, 0) - minValue) /
          Math.max(maxValue - minValue, 1)) *
          72 -
        14;
      return `${x},${Math.max(8, Math.min(92, y))}`;
    })
    .join(" ");

  return (
    <div>
      <svg viewBox="0 0 100 100" className="h-56 w-full overflow-visible">
        <defs>
          <linearGradient
            id="analyticsLineGradient"
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path
          d={`M 0 92 ${polylinePoints} L 100 92 Z`}
          fill="url(#analyticsLineGradient)"
        />
        <polyline
          points={polylinePoints}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point, index) => {
          const x = points.length > 1 ? index * step : 50;
          const y =
            height -
            ((toNumber(point.value, 0) - minValue) /
              Math.max(maxValue - minValue, 1)) *
              72 -
            14;
          const safeY = Math.max(8, Math.min(92, y));
          return (
            <g key={`${point.label}-${index}`}>
              <circle cx={x} cy={safeY} r="1.9" fill={color} />
            </g>
          );
        })}
      </svg>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {points.slice(0, 8).map((point) => (
          <div
            key={point.label}
            className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-950/50"
          >
            <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {point.label}
            </p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {formatPercent(point.value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

const BarChart = ({ bars = [] }) => {
  if (!bars.length) {
    return (
      <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
        No distribution data available.
      </div>
    );
  }

  const maxValue = Math.max(...bars.map((bar) => toNumber(bar.value, 0)), 1);

  return (
    <div className="grid h-56 grid-cols-4 gap-3 sm:grid-cols-4">
      {bars.map((bar) => {
        const height = Math.max(10, (toNumber(bar.value, 0) / maxValue) * 100);
        return (
          <div key={bar.label} className="flex flex-col justify-end gap-3">
            <div className="flex h-40 items-end overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-950/60">
              <div
                className={`w-full rounded-2xl ${bar.color || "bg-indigo-500"}`}
                style={{ height: `${height}%` }}
              />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {toNumber(bar.value, 0)}
                {formatMetric(bar.value)}
              </p>
              <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {bar.label}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const DonutChart = ({ segments = [], totalLabel = "Students" }) => {
  const total = segments.reduce(
    (sum, segment) => sum + toNumber(segment.value, 0),
    0,
  );
  const safeTotal = Math.max(total, 1);

  let accumulated = 0;
  const gradient = segments
    .map((segment) => {
      const start = accumulated;
      const end = accumulated + (toNumber(segment.value, 0) / safeTotal) * 100;
      accumulated = end;
      return `${segment.color || "#6366f1"} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div
        className="relative flex h-48 w-48 items-center justify-center rounded-full"
        style={{ background: `conic-gradient(${gradient})` }}
      >
        <div className="absolute inset-10 flex flex-col items-center justify-center rounded-full bg-white text-center shadow-inner dark:bg-slate-900">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {totalLabel}
          </p>
          <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">
            {total}
            {formatMetric(total)}
          </p>
        </div>
      </div>
      <div className="grid w-full gap-2">
        {segments.map((segment) => (
          <div
            key={segment.label}
            className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-950/50"
          >
            <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: segment.color || "#6366f1" }}
              />
              {segment.label}
            </span>
            <span className="font-semibold text-slate-900 dark:text-white">
              {toNumber(segment.value, 0)}
              {formatMetric(segment.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const TeacherAnalyticsHome = ({
  selectedCourseId,
  setSelectedCourseId,
  onNavigate,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [analytics, setAnalytics] = useState({
    dashboard: null,
    courses: [],
    students: [],
    classDashboard: null,
    classComparative: null,
    weakStudents: null,
    advancedStudents: null,
    alerts: null,
  });

  useEffect(() => {
    let cancelled = false;

    const loadAnalytics = async () => {
      try {
        setLoading(true);
        setError("");

        const [dashboardResult, coursesResult, studentsResult] =
          await Promise.allSettled([
            teacherService.getTeacherDashboard(),
            teacherService.getTeacherCourses(),
            teacherService.getStudentsForAnalytics(),
          ]);

        if (cancelled) return;

        const dashboardData =
          getServiceData(
            dashboardResult.status === "fulfilled"
              ? dashboardResult.value
              : null,
          ) || {};
        const teacherCourses = asArray(
          getServiceData(
            coursesResult.status === "fulfilled" ? coursesResult.value : null,
          ),
        );
        const studentRows = asArray(
          getServiceData(
            studentsResult.status === "fulfilled" ? studentsResult.value : null,
          ),
        );

        const focusCourseId =
          selectedCourseId ||
          toId(teacherCourses[0]?._id) ||
          toId(teacherCourses[0]?.id) ||
          "";

        let classDashboard = null;
        let classComparative = null;
        let weakStudents = null;
        let advancedStudents = null;
        let alerts = null;

        if (focusCourseId) {
          const [
            classDashboardResult,
            comparativeResult,
            weakResult,
            advancedResult,
            alertsResult,
          ] = await Promise.allSettled([
            teacherService.getClassDashboardAnalytics(focusCourseId),
            teacherService.getClassComparativeAnalytics(focusCourseId),
            teacherService.getWeakStudentsAnalytics(focusCourseId),
            teacherService.getAdvancedStudentsAnalytics(focusCourseId),
            teacherService.getInterventionAlerts(focusCourseId),
          ]);

          if (cancelled) return;

          classDashboard = getServiceData(
            classDashboardResult.status === "fulfilled"
              ? classDashboardResult.value
              : null,
          );
          classComparative = getServiceData(
            comparativeResult.status === "fulfilled"
              ? comparativeResult.value
              : null,
          );
          weakStudents = getServiceData(
            weakResult.status === "fulfilled" ? weakResult.value : null,
          );
          advancedStudents = getServiceData(
            advancedResult.status === "fulfilled" ? advancedResult.value : null,
          );
          alerts = getServiceData(
            alertsResult.status === "fulfilled" ? alertsResult.value : null,
          );
        }

        setAnalytics({
          dashboard: dashboardData,
          courses: teacherCourses,
          students: studentRows,
          classDashboard,
          classComparative,
          weakStudents,
          advancedStudents,
          alerts,
        });
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError?.message || "Failed to load teacher analytics.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, [selectedCourseId, refreshTick]);

  const dashboardStats =
    analytics.dashboard?.statistics || analytics.dashboard || {};
  const dashboardAnalytics = analytics.dashboard?.analytics || {};
  const recentCourses = asArray(
    analytics.dashboard?.recentCourses ||
      analytics.dashboard?.data?.recentCourses,
  );
  const courses = analytics.courses;
  const students = analytics.students;
  const classDashboard = analytics.classDashboard || {};
  const classComparative = analytics.classComparative || {};
  const weakStudents = analytics.weakStudents || {};
  const advancedStudents = analytics.advancedStudents || {};
  const alerts = analytics.alerts || {};
  const dashboardSummary = dashboardAnalytics.summary || {};
  const accuracyTrend = asArray(dashboardAnalytics.accuracyTrend);
  const monthlyTrend = asArray(dashboardAnalytics.monthlyTrend);
  const topTopics = asArray(dashboardAnalytics.topTopics);
  const weakTopics = asArray(dashboardAnalytics.weakTopics);
  const subjectPerformance = asArray(dashboardAnalytics.subjectPerformance);
  const conceptMastery = asArray(dashboardAnalytics.conceptMastery);
  const retentionHighlights = asArray(
    dashboardAnalytics.retentionHighlights,
  ).map((item) => ({
    ...item,
    value: Number(Number(item.value || 0).toFixed(1)),
  }));
  const recommendations = asArray(dashboardAnalytics.recommendations);
  const confidenceCalibration = dashboardAnalytics.confidenceCalibration || {};
  const fatigueIndex = dashboardAnalytics.fatigueIndex || {};
  const studyEfficiency = dashboardAnalytics.studyEfficiency || {};

  const accuracyPoints = accuracyTrend.length
    ? toChartPoints(accuracyTrend, "accuracy", "date")
    : toChartPoints(monthlyTrend, "accuracy", "date");
  const subjectBars = toBarRows(
    subjectPerformance,
    "averageAccuracy",
    "subject",
  );
 const masterySegments = conceptMastery.slice(0, 5).map((topic, index) => ({
   label: topic.topic || `Topic ${index + 1}`,
   value: Number(toNumber(topic.value, 0).toFixed(1)),
   color: ["#6366f1", "#ec4899", "#06b6d4", "#10b981", "#f59e0b"][index % 5],
 }));
  const retentionBars = toBarRows(retentionHighlights, "value", "topic");
  const weakTopicBars = toBarRows(weakTopics, "averageAccuracy", "topic");

  const totalCourses = toNumber(dashboardStats.totalCourses, courses.length);
  const publishedCourses = toNumber(dashboardStats.publishedCourses, 0);
  const totalStudents = toNumber(dashboardStats.totalStudents, students.length);
  const classMetrics = classDashboard.classMetrics || {};
  const averageRating = toNumber(dashboardStats.averageRating, 0);
  const analyticsAverageAccuracy = toNumber(
    dashboardSummary.averageAccuracy,
    toNumber(classMetrics.averageAccuracy, 0),
  );
  const analyticsStudentsWithData = toNumber(
    dashboardSummary.studentsWithData,
    students.length,
  );
  const analyticsActiveStudents = toNumber(dashboardSummary.activeStudents, 0);
  const analyticsTotalTests = toNumber(dashboardSummary.totalTests, 0);
  const analyticsConfidence = toNumber(dashboardSummary.averageConfidence, 0);
  const analyticsFatigue = toNumber(dashboardSummary.averageFatigue, 0);
  const analyticsEfficiency = toNumber(
    dashboardSummary.averageStudyEfficiency,
    0,
  );

  const performanceDistribution = classDashboard.performanceDistribution || {};
  const engagementLevel = classDashboard.engagementLevel || {};
  const quickStats = classDashboard.quickStats || {};

  const studentRankings = (
    classComparative.allStudentStats ||
    classDashboard.allStudentStats ||
    students
  )
    .map((student) => {
      if (student.accuracy !== undefined) {
        return {
          name: student.studentName || formatStudentName(student),
          value: toNumber(student.accuracy, 0),
          extra: `${toNumber(student.totalQuestions, 0)} questions`,
        };
      }

      return {
        name: formatStudentName(student),
        value: toNumber(student.averageQuizScore || student.accuracy || 0, 0),
        extra: `${toNumber(student.totalTimeSpent, 0)} mins`,
      };
    })
    .filter((student) => student.name)
    .sort((left, right) => right.value - left.value)
    .slice(0, 8);

  const topStudents = students
    .map((student) => ({
      name: formatStudentName(student),
      email: formatStudentEmail(student),
      score: toNumber(student.averageQuizScore, 0),
      assignment: toNumber(student.averageAssignmentScore, 0),
      streak: toNumber(student.studyStreak, 0),
      courseCount: toNumber(
        student.courseCount,
        (student.enrolledCourses || []).length,
      ),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);

  const supportStudents = asArray(weakStudents.weakStudents)
    .map((student) => ({
      name: student.studentName || student.name || "Unknown",
      accuracy: toNumber(student.overallAccuracy, 0),
      gap: toNumber(student.performanceGap, 0),
      topicCount: asArray(student.weakTopics).length,
    }))
    .slice(0, 5);

  const advancedList = asArray(advancedStudents.advancedStudents)
    .map((student) => ({
      name: student.studentName || student.name || "Unknown",
      accuracy: toNumber(student.overallAccuracy, 0),
      expertTopics: asArray(student.expertTopics).length,
      mastery: student.masteryCount || {},
    }))
    .slice(0, 5);

  const alertList = asArray(alerts.alerts).slice(0, 6);
  const selectedCourse = courses.find(
    (course) =>
      toId(course._id || course.id) ===
      toId(selectedCourseId || courses[0]?._id || courses[0]?.id),
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/80"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="h-80 animate-pulse rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/80" />
          <div className="h-80 animate-pulse rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/80" />
          <div className="h-80 animate-pulse rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/80" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold">
              Teacher analytics could not load
            </h3>
            <p className="mt-1 text-sm">{error}</p>
          </div>
          <button
            onClick={() => setRefreshTick((tick) => tick + 1)}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
          >
            <FiRefreshCw />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const distributionBars = [
    {
      label: "Excellent",
      value: performanceDistribution.excellent || 0,
      color: "bg-emerald-500",
    },
    {
      label: "Good",
      value: performanceDistribution.good || 0,
      color: "bg-blue-500",
    },
    {
      label: "Average",
      value: performanceDistribution.average || 0,
      color: "bg-amber-500",
    },
    {
      label: "Needs Support",
      value: performanceDistribution.needsSupport || 0,
      color: "bg-rose-500",
    },
  ];

  const engagementSegments = [
    {
      label: "Highly engaged",
      value: engagementLevel.highlyEngaged || 0,
      color: "#10b981",
    },
    {
      label: "Moderately engaged",
      value: engagementLevel.moderatelyEngaged || 0,
      color: "#3b82f6",
    },
    {
      label: "Low engagement",
      value: engagementLevel.lowEngagement || 0,
      color: "#f59e0b",
    },
  ];

  return (
    <div className="space-y-8 pb-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-white via-indigo-50 to-blue-50 p-8 shadow-lg transition-colors dark:border-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
        {/* Decorative glow */}
        <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-indigo-300/30 blur-3xl dark:bg-indigo-500/20" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-blue-300/30 blur-3xl dark:bg-blue-500/10" />

        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          {/* Text Section */}
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-500 dark:text-indigo-300">
              Teacher Intelligence Center
            </p>

            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
              Learning analytics for every student you teach
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600 sm:text-base dark:text-slate-300">
              Monitor retention, learning velocity, burnout risk, weak topics,
              top performers, and class-level performance trends — all in one
              beautiful dashboard.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-6">
            <button
              onClick={() => setRefreshTick((tick) => tick + 1)}
              className="inline-flex items-center gap-2 rounded-2xl border border-indigo-200 bg-white/70 px-4 py-3 text-sm font-semibold text-indigo-600 shadow-sm backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-md dark:border-slate-700 dark:bg-white/5 dark:text-indigo-300 dark:hover:bg-white/10"
            >
              <FiRefreshCw className="text-indigo-500 dark:text-indigo-300" />
              Refresh analytics
            </button>

            <button
              onClick={() => onNavigate("student-analytics")}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg dark:from-indigo-600 dark:to-fuchsia-600"
            >
              <FiBarChart2 />
              Open student analytics
            </button>
          </div>
        </div>

        {/* Course Filters */}
        <div className="mt-6 flex flex-wrap gap-4">
          {/* All Courses */}
          <button
            onClick={() => setSelectedCourseId("")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200
        ${
          !selectedCourseId
            ? "bg-indigo-600 text-white shadow-md"
            : "bg-slate-800 text-slate-200 hover:bg-slate-700"
        }
        dark:${
          !selectedCourseId
            ? "bg-indigo-600 text-white"
            : "bg-slate-800 text-slate-200 hover:bg-slate-700"
        }
      `}
          >
            All courses
          </button>

          {/* Individual Courses (FIXED active logic) */}
          {courses.slice(0, 6).map((course) => {
            const courseId = toId(course._id || course.id);
            const isActive = selectedCourseId === courseId;

            return (
              <button
                key={courseId}
                onClick={() => setSelectedCourseId(courseId)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200
            ${
              isActive
                ? "bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white shadow-md"
                : "bg-slate-800 text-slate-200 hover:bg-slate-700"
            }
            dark:${
              isActive
                ? "bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white"
                : "bg-slate-800 text-slate-200 hover:bg-slate-700"
            }
          `}
              >
                {course.title || course.name || "Course"}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StyledCard
          color="indigo"
          title="Total Courses"
          value={formatMetric(totalCourses)}
          icon={FiBook}
          note="These are the courses currently linked to your teacher workspace."
        >
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {formatMetric(publishedCourses)} published ·{" "}
            {formatMetric(Math.max(totalCourses - publishedCourses, 0))} draft
          </p>
        </StyledCard>

        <StyledCard
          color="blue"
          title="Total Students"
          value={formatMetric(totalStudents)}
          icon={FiUsers}
          note="This is the total enrolled student count across all of your courses."
        >
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Average of all enrolled students in your teaching load.
          </p>
        </StyledCard>

        <StyledCard
          color="green"
          title="Avg. Accuracy"
          value={formatPercent(analyticsAverageAccuracy)}
          icon={FiTarget}
          note="This is the average performance of all your enrolled students."
        >
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {selectedCourse?.title || "All courses"} together, shown as one
            classroom average.
          </p>
        </StyledCard>

        <StyledCard
          color="purple"
          title="Avg. Rating"
          value={formatMetric(averageRating)}
          icon={FiAward}
          note="This is your average teacher rating from the students who reviewed you."
        >
          <p className="text-sm text-slate-600 dark:text-slate-400">
            A quick view of how learners rate your teaching experience.
          </p>
        </StyledCard>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-5">
        <StyledCard
          color="violet"
          title="Students w/ Data"
          value={formatMetric(analyticsStudentsWithData)}
          icon={FiZap}
          note="Students with at least one performance record in StudentPerformance."
        >
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {formatMetric(analyticsActiveStudents)} active students are
            currently contributing to the averages.
          </p>
        </StyledCard>

        <StyledCard
          color="cyan"
          title="Total Tests"
          value={formatMetric(analyticsTotalTests)}
          icon={FiBarChart2}
          note="All completed tests combined across your enrolled students."
        >
          <p className="text-sm text-slate-600 dark:text-slate-400">
            More tests give a clearer picture of class-level performance.
          </p>
        </StyledCard>

        <StyledCard
          color="emerald"
          title="Confidence"
          value={formatPercent(analyticsConfidence)}
          icon={FiCheckCircle}
          note="Average confidence shown by students when answering questions."
        >
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Healthy confidence usually means students feel steady and prepared.
          </p>
        </StyledCard>

        <StyledCard
          color="amber"
          title="Fatigue Index"
          value={formatPercent(analyticsFatigue)}
          icon={FiClock}
          note="Average tiredness and burnout signal across your enrolled students."
        >
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {dashboardAnalytics.fatigueIndex?.trend || "Stable"} learning energy
            across the class.
          </p>
        </StyledCard>

        <StyledCard
          color="rose"
          title="Active Alerts"
          value={formatMetric(alerts.totalAlerts)}
          icon={FiAlertCircle}
          note="Students who may need a quick check-in or intervention."
        >
          <p className="text-sm text-slate-600 dark:text-slate-400">
            These alerts help you catch support needs early.
          </p>
        </StyledCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <StyledCard
          color="indigo"
          title="Learning Trend"
          subtitle="How the class average changes over time."
          note="The line below shows whether the average is moving up, down, or staying steady."
          fullHeight
        >
          <div className="mt-4">
            <LineChart points={accuracyPoints} color="#6366f1" />
          </div>
        </StyledCard>

        <StyledCard
          color="blue"
          title="Subject Performance"
          subtitle="Average accuracy by subject for your enrolled students."
          note="This makes it easy to see which subject areas are strongest overall."
          fullHeight
        >
          <div className="mt-4">
            <EnhancedBarChart bars={subjectBars} />
          </div>
        </StyledCard>

        <StyledCard
          color="purple"
          title="Concept Mastery"
          subtitle="Topics your students have mastered most often."
          note="The center total is the combined mastery count across the class."
          fullHeight
        >
          <div className="mt-4">
            <MasteryPieChart  data={masterySegments} />
          </div>
        </StyledCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <StyledCard
          color="emerald"
          title="Retention Highlights"
          subtitle="Topics with the strongest retention signal."
          note="High retention means students are remembering and reusing those concepts well."
          fullHeight
        >
          <div className="mt-4">
            <BarChart bars={retentionBars} />
          </div>
        </StyledCard>

        <StyledCard
          color="rose"
          title="Areas Needing Support"
          subtitle="Topics where the class average is still low."
          note="These are the areas that may benefit from revision, practice, or reteaching."
          fullHeight
        >
          <div className="mt-4 space-y-2">
            {weakTopicBars.length > 0 ? (
              weakTopicBars.map((topic, index) => (
                <div
                  key={`${topic.label}-${index}`}
                  className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-900/40 dark:bg-rose-950/30"
                >
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {topic.label}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Averages below the class comfort zone.
                    </p>
                  </div>
                  <p className="text-sm font-bold text-rose-600 dark:text-rose-400">
                    {formatPercent(topic.value)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No weakness data available.
              </p>
            )}
          </div>
        </StyledCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <StyledCard
          color="indigo"
          title="Actionable Recommendations"
          subtitle="Simple next steps based on class averages and weaker spots."
          note="These suggestions are meant to be quick, practical, and easy to act on."
          fullHeight
        >
          <div className="mt-4 space-y-3">
            {recommendations.length > 0 ? (
              recommendations.map((item, index) => (
                <div
                  key={`${item.type}-${index}`}
                  className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-900/40 dark:bg-indigo-950/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {item.topic}
                      </p>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                        {item.reason}
                      </p>
                    </div>
                    <span className="rounded-lg bg-indigo-200 px-2 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                      {formatPercent(item.score)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No recommendations yet.
              </p>
            )}
          </div>
        </StyledCard>

        <StyledCard
          color="blue"
          title="Confidence Calibration"
          subtitle="How confident students feel versus how they actually perform."
          note="This helps you see where confidence and mastery are in sync or out of balance."
          fullHeight
        >
          <div className="mt-4 space-y-3">
            {Object.entries(confidenceCalibration.byDifficulty || {}).length >
            0 ? (
              <div>
                {Object.entries(confidenceCalibration.byDifficulty || {}).map(
                  ([difficulty, value]) => (
                    <div
                      key={difficulty}
                      className="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/40 dark:bg-blue-950/30"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-300">
                          {difficulty.replace(/_/g, " ")}
                        </p>
                        <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                          {formatPercent(value)}
                        </p>
                      </div>
                    </div>
                  ),
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No calibration data yet.
              </p>
            )}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/30">
              <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-300">
                Study Efficiency
              </p>
              <p className="mt-1 text-sm font-bold text-amber-600 dark:text-amber-400">
                {formatPercent(studyEfficiency.score || 0)} •{" "}
                {studyEfficiency.trend || "Stable"}
              </p>
            </div>
          </div>
        </StyledCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <StyledCard
          color="emerald"
          title="Performance Spread"
          subtitle="How many students fall into each performance band."
          note="This gives a quick snapshot of the class shape without reading every record."
          fullHeight
        >
          <div className="mt-4">
            <BarChart bars={distributionBars} />
          </div>
        </StyledCard>

        <StyledCard
          color="indigo"
          title="Learner Accuracy Curve"
          subtitle="The overall accuracy curve of your enrolled students."
          note="A simple curve makes it easy to spot momentum, plateaus, or dips."
          fullHeight
        >
          <div className="mt-4">
            <LineChart
              points={studentRankings.map((s) => ({
                label: s.name.split(" ")[0],
                value: s.value,
              }))}
              color="#8b5cf6"
            />
          </div>
        </StyledCard>

        <StyledCard
          color="cyan"
          title="Engagement Mix"
          subtitle="How active your enrolled students are in practice."
          note="This shows whether the class is consistently engaged, mixed, or drifting low."
          fullHeight
        >
          <div className="mt-4">
            <DonutChart segments={engagementSegments} totalLabel="Engagement" />
          </div>
        </StyledCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <StyledCard
          color="green"
          title="Top Performers"
          subtitle="Students with the strongest average performance."
          note="These students are currently leading the class average."
          fullHeight
        >
          <div className="mt-4 space-y-2">
            {topStudents.length > 0 ? (
              topStudents.map((student, index) => (
                <div
                  key={`${student.name}-${index}`}
                  className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/30"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {student.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatMetric(student.courseCount)} course
                      {student.courseCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {formatPercent(student.score)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatMetric(student.streak)}d streak
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No student data yet.
              </p>
            )}
          </div>
        </StyledCard>

        <StyledCard
          color="rose"
          title="Students Needing Support"
          subtitle="Students whose averages suggest they need help soon."
          note="These students may benefit from a short check-in or targeted revision."
          fullHeight
        >
          <div className="mt-4 space-y-2">
            {supportStudents.length > 0 ? (
              supportStudents.map((student, index) => (
                <div
                  key={`${student.name}-${index}`}
                  className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-900/40 dark:bg-rose-950/30"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {student.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatMetric(student.topicCount)} weak topic
                      {student.topicCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-rose-600 dark:text-rose-400">
                      {formatPercent(student.accuracy)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatMetric(student.gap)}% gap
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No weak students detected.
              </p>
            )}
          </div>
        </StyledCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <StyledCard
          color="purple"
          title="Course Spotlight"
          subtitle="The active course average and supporting details."
          note="This panel focuses on the selected course so you can drill into one class at a time."
          fullHeight
        >
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-900/40 dark:bg-purple-950/30">
              <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-300">
                Highest Accuracy
              </p>
              <p className="mt-2 text-2xl font-bold text-purple-600 dark:text-purple-400">
                {formatPercent(classMetrics.highestAccuracy || 0)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Best enrolled student average in this course.
              </p>
            </div>
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-900/40 dark:bg-purple-950/30">
              <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-300">
                Lowest Accuracy
              </p>
              <p className="mt-2 text-2xl font-bold text-purple-600 dark:text-purple-400">
                {formatPercent(classMetrics.lowestAccuracy || 0)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Lowest enrolled student average in this course.
              </p>
            </div>
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-900/40 dark:bg-purple-950/30">
              <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-300">
                Above Average
              </p>
              <p className="mt-2 text-2xl font-bold text-purple-600 dark:text-purple-400">
                {formatMetric(quickStats.studentsAboveAverage, 1)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Students performing better than the class average.
              </p>
            </div>
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-900/40 dark:bg-purple-950/30">
              <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-300">
                Needs Support
              </p>
              <p className="mt-2 text-2xl font-bold text-purple-600 dark:text-purple-400">
                {formatMetric(quickStats.studentsNeedingHelp, 1)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Students below the support threshold.
              </p>
            </div>
          </div>
        </StyledCard>

        <StyledCard
          color="orange"
          title="Intervention Alerts"
          subtitle="Students who may need a quick follow-up."
          note="These alerts are sorted by urgency so you can act fast if needed."
          fullHeight
        >
          <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
            {alertList.length > 0 ? (
              alertList.map((alert, index) => (
                <div
                  key={`${alert.type}-${index}`}
                  className="rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-900/40 dark:bg-orange-950/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {alert.studentName || "Unknown"}
                      </p>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                        {alert.message}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-bold whitespace-nowrap ${
                        alert.severity === "critical"
                          ? "bg-rose-200 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"
                          : alert.severity === "high"
                            ? "bg-orange-200 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300"
                            : "bg-blue-200 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                      }`}
                    >
                      {alert.severity}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No active alerts.
              </p>
            )}
          </div>
        </StyledCard>
      </div>

      <StyledCard
        color="indigo"
        title="Course Performance Insight"
        subtitle="Recent course averages and current status."
        note="This summary shows the courses most recently updated in your workspace."
      >
        <div className="mt-4 space-y-2 max-h-72 overflow-y-auto">
          {recentCourses.length > 0 ? (
            recentCourses.slice(0, 8).map((course) => (
              <div
                key={toId(course._id || course.id)}
                className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-900/40 dark:bg-indigo-950/30"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {course.title || course.name || "Untitled"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatMetric(
                      course.totalStudents || course.students?.length || 0,
                    )}{" "}
                    students on average
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    course.status === "published"
                      ? "bg-emerald-200 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                      : "bg-amber-200 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                  }`}
                >
                  {course.status || "draft"}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No courses yet.
            </p>
          )}
        </div>
      </StyledCard>
    </div>
  );
};

export default TeacherAnalyticsHome;
