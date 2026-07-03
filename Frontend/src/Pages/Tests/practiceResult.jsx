// practiceResult.jsx - Complete rewrite with accurate backend data display

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
  FiHelpCircle,
  FiRefreshCw,
  FiDownload,
  FiPrinter,
  FiSun,
  FiMoon,
  FiGrid,
  FiList,
  FiPieChart,
  FiTrendingDown,
  FiUsers,
  FiCalendar,
  FiStar,
  FiFlag,
  FiBattery,
  FiCpu,
  FiDatabase,
  FiServer,
  FiCloud,
  FiLayers,
  FiUser,
  FiBriefcase,
  FiEye,
} from "react-icons/fi";
import {
  FaBrain,
  FaChartLine,
  FaFire,
  FaBolt,
  FaSeedling,
  FaTree,
  FaStar,
  FaGraduationCap,
  FaMedal,
  FaTrophy,
} from "react-icons/fa";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
  ComposedChart,
} from "recharts";
import { useTheme } from "../../context/ThemeContext";
import authService from "../../services/authService";
import flaskService from "../../services/flaskService";

// ==================== CONSTANTS ====================
const COLORS = [
  "#818cf8", "#34d399", "#f472b6", "#fbbf24", "#60a5fa",
  "#a78bfa", "#f87171", "#fb923c", "#22d3ee", "#e879f9"
];

const CHART_COLORS = {
  accuracy: "#22d3ee",
  difficulty: "#f472b6",
  stress: "#fb923c",
  fatigue: "#f87171",
  confidence: "#34d399",
  retention: "#818cf8",
};

// ==================== HELPER FUNCTIONS ====================
const toPercent = (value, digits = 0) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0%";
  return `${Math.min(100, Math.max(0, num * 100)).toFixed(digits)}%`;
};

const formatSeconds = (seconds) => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const formatDateTime = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
};

const getMasteryLevel = (accuracy) => {
  if (accuracy >= 0.85) return { label: "Excellent", color: "#34d399", icon: "🏆" };
  if (accuracy >= 0.7) return { label: "Good", color: "#60a5fa", icon: "⭐" };
  if (accuracy >= 0.5) return { label: "Moderate", color: "#fbbf24", icon: "📚" };
  if (accuracy >= 0.3) return { label: "Poor", color: "#fb923c", icon: "⚠️" };
  return { label: "Critical", color: "#f87171", icon: "🚨" };
};

const getRiskLevel = (value) => {
  if (value >= 0.7) return { label: "High", color: "#f87171" };
  if (value >= 0.4) return { label: "Moderate", color: "#fbbf24" };
  return { label: "Low", color: "#34d399" };
};

// ==================== COMPONENTS ====================
const MetricCard = ({ label, value, icon, color, subtitle, trend, trendLabel }) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    className={`rounded-2xl border p-4 transition-all duration-200 ${
      color
        ? `border-${color}-200 bg-${color}-50 dark:bg-${color}-900/20 dark:border-${color}-800`
        : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
    }`}
  >
    <div className="flex items-center justify-between mb-2">
      <div className={`p-2 rounded-xl ${color ? `bg-${color}-100 dark:bg-${color}-900/40` : "bg-slate-100 dark:bg-slate-700"}`}>
        {icon}
      </div>
      {trend !== undefined && (
        <span className={`text-xs font-medium ${trend > 0 ? "text-emerald-500" : trend < 0 ? "text-rose-500" : "text-gray-400"}`}>
          {trend > 0 ? "↑" : trend < 0 ? "↓" : "→"} {trendLabel || ""}
        </span>
      )}
    </div>
    <div className="text-2xl font-bold">{value}</div>
    <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
    {subtitle && (
      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitle}</div>
    )}
  </motion.div>
);

// ==================== MAIN COMPONENT ====================
const PracticeResult = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();

  // ==================== STATE ====================
  const statePayload = location.state || {};
  const answers = Array.isArray(statePayload.answers) ? statePayload.answers : [];
  const sessionData = statePayload.session || {};

  const [flaskDashboard, setFlaskDashboard] = useState(null);
  const [flaskLoading, setFlaskLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [viewMode, setViewMode] = useState("grid");
  const [error, setError] = useState(null);

  // ==================== LOAD FLASK DATA ====================
  useEffect(() => {
    const studentId = authService.getStudentId();
    if (!studentId) return;

    let mounted = true;
    const loadFlaskData = async () => {
      setFlaskLoading(true);
      try {
        const response = await flaskService.getModelInfo(studentId);
        if (!mounted) return;
        if (response?.success && response?.dashboard_data) {
          setFlaskDashboard(response.dashboard_data);
        } else {
          setFlaskDashboard(null);
        }
      } catch (err) {
        console.error("Error loading Flask data:", err);
        setError("Could not load analytics data");
      } finally {
        if (mounted) setFlaskLoading(false);
      }
    };

    loadFlaskData();
    return () => { mounted = false; };
  }, []);

  // ==================== EXTRACT DATA FROM BACKEND ====================
  const data = useMemo(() => {
    if (!flaskDashboard) return null;

    const {
      summary = {},
      topic_analysis = {},
      concept_mastery = {},
      stability_index = {},
      confidence_calibration = {},
      error_patterns = {},
      weakness_priority = [],
      forgetting_curve = {},
      fatigue_index = {},
      behavior_profile = {},
      difficulty_tolerance = {},
      study_efficiency = {},
      focus_loss = {},
      time_allocation = [],
      stress_patterns = {},
      burnout_risk = {},
      learning_velocity = {},
      trend_data = {},
      session_analysis = {},
      predictions_summary = {},
      recommendations = [],
      charts = {},
      recent_activity = {},
    } = flaskDashboard;

    // Calculate derived values
    const conceptCount = Object.keys(concept_mastery).length;
    const masteryValues = Object.values(concept_mastery);
    const avgMastery = masteryValues.length > 0
      ? masteryValues.reduce((a, b) => a + b, 0) / masteryValues.length
      : 0;

    const strongTopics = topic_analysis?.strong_topics || [];
    const weakTopics = topic_analysis?.weak_topics || [];

    // Get fatigue level
    const fatigueLevel = fatigue_index?.risk_level || "low";
    const fatigueValue = fatigue_index?.current || 0.3;

    // Get burnout level
    const burnoutLevel = burnout_risk?.risk_level || "low";
    const burnoutValue = burnout_risk?.current_risk || 0.3;

    // Get behavior profile
    const behaviorCluster = behavior_profile?.cluster || "balanced";
    const avgTimePerQuestion = behavior_profile?.average_time_per_question/21600000 || 60;

    // Get efficiency
    const efficiencyScore = study_efficiency?.score || 0.5;
    const efficiencyTrend = study_efficiency?.trend || "stable";

    // Get focus loss
    const focusLossValue = focus_loss?.frequency || 0.1;

    // Get retention summary
    const avgRetention = predictions_summary?.average_retention || 0.5;
    const lowRetentionTopics = predictions_summary?.topics_with_low_retention || [];
    const highRetentionTopics = predictions_summary?.topics_with_high_retention || [];

    // Get forgetting curve review priority
    const reviewPriority = forgetting_curve?.review_priority || [];

    // Build concept mastery chart data
    const conceptMasteryData = Object.entries(concept_mastery)
      .map(([name, value]) => ({
        name: name.length > 15 ? name.substring(0, 15) + "..." : name,
        mastery: Math.min(1, Math.max(0, value)),
        fullName: name,
      }))
      .sort((a, b) => b.mastery - a.mastery)
      .slice(0, 10);

    // Build weak topics chart data
    const weakTopicsData = weakTopics.map(t => ({
      name: t.topic?.length > 15 ? t.topic.substring(0, 15) + "..." : t.topic || "Unknown",
      accuracy: t.accuracy || 0,
      attempts: t.attempts || 0,
    })).slice(0, 10);

    // Build strong topics chart data
    const strongTopicsData = strongTopics.map(t => ({
      name: t.topic?.length > 15 ? t.topic.substring(0, 15) + "..." : t.topic || "Unknown",
      accuracy: t.accuracy || 0,
      attempts: t.attempts || 0,
    })).slice(0, 10);

    // Build time allocation data
    const timeAllocationData = time_allocation.slice(0, 8);

    // Build error patterns data
    const errorPatternsData = error_patterns ? Object.entries(error_patterns)
      .filter(([key]) => key !== 'by_topic')
      .map(([key, value]) => ({
        name: key.charAt(0).toUpperCase() + key.slice(1),
        value: Math.min(1, Math.max(0, value * 100)),
      })) : [];

    // Build stress patterns data
    const stressData = stress_patterns?.by_topic ? Object.entries(stress_patterns.by_topic)
      .map(([name, value]) => ({
        name: name.length > 12 ? name.substring(0, 12) + "..." : name,
        stress: Math.min(1, Math.max(0, value)),
      }))
      .sort((a, b) => b.stress - a.stress)
      .slice(0, 8) : [];

    // Build chart data from backend charts
    const accuracyTrend = charts?.accuracy_over_time || [];
    const difficultyTrend = charts?.difficulty_over_time || [];
    const weeklyProgress = charts?.weekly_progress || [];
    const conceptRadar = charts?.concept_radar || [];

    // Build concept radar data
    const radarData = conceptRadar.slice(0, 8).map(item => ({
      subject: item.concept?.length > 12 ? item.concept.substring(0, 12) + "..." : item.concept || "Unknown",
      mastery: Math.min(1, Math.max(0, item.mastery || 0)),
      fullName: item.concept,
    }));

    return {
      summary,
      topic_analysis,
      concept_mastery,
      conceptMasteryData,
      stability_index,
      confidence_calibration,
      error_patterns,
      errorPatternsData,
      weakness_priority,
      forgetting_curve,
      reviewPriority,
      fatigue_index: { ...fatigue_index, level: fatigueLevel, value: fatigueValue },
      behavior_profile: { ...behavior_profile, cluster: behaviorCluster, avgTime: avgTimePerQuestion },
      difficulty_tolerance,
      study_efficiency: { ...study_efficiency, score: efficiencyScore, trend: efficiencyTrend },
      focus_loss: { ...focus_loss, frequency: focusLossValue },
      time_allocation: timeAllocationData,
      stress_patterns: { ...stress_patterns, byTopicData: stressData },
      burnout_risk: { ...burnout_risk, level: burnoutLevel, value: burnoutValue },
      learning_velocity,
      trend_data,
      session_analysis,
      predictions_summary: {
        ...predictions_summary,
        avgRetention,
        lowRetentionTopics,
        highRetentionTopics,
      },
      recommendations,
      charts,
      recent_activity,
      // Computed
      conceptCount,
      avgMastery,
      strongTopics,
      weakTopics,
      strongTopicsData,
      weakTopicsData,
      accuracyTrend,
      difficultyTrend,
      weeklyProgress,
      radarData,
    };
  }, [flaskDashboard]);

  // ==================== RENDER FUNCTIONS ====================

  const renderOverviewTab = () => {
    if (!data) {
      return (
        <div className="text-center py-16">
          <FaBrain className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No analytics data available</p>
          {flaskLoading && <p className="text-sm text-indigo-500 mt-2">Loading data...</p>}
        </div>
      );
    }

    const { summary, recent_activity, conceptMasteryData, avgMastery, conceptCount,
            strongTopicsData, weakTopicsData, radarData, accuracyTrend, fatigue_index,
            burnout_risk, study_efficiency, predictions_summary } = data;

    return (
      <div className="space-y-6">
        {/* Quick Stats Grid - Only show if data exists */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {summary?.overall_accuracy !== undefined && (
            <MetricCard
              label="Overall Accuracy"
              value={toPercent(summary.overall_accuracy)}
              icon={<FiTarget className="w-5 h-5 text-cyan-500" />}
              color="cyan"
              subtitle={`${summary.total_practice_questions || 0} questions`}
            />
          )}
          {conceptCount > 0 && (
            <MetricCard
              label="Concept Mastery"
              value={toPercent(avgMastery)}
              icon={<FaStar className="w-5 h-5 text-indigo-500" />}
              color="indigo"
              subtitle={`${conceptCount} concepts tracked`}
            />
          )}
          {summary?.readiness_score !== undefined && (
            <MetricCard
              label="Readiness Score"
              value={toPercent(summary.readiness_score)}
              icon={<FiZap className="w-5 h-5 text-emerald-500" />}
              color="emerald"
            />
          )}
          {burnout_risk?.value !== undefined && (
            <MetricCard
              label="Burnout Risk"
              value={burnout_risk.level.charAt(0).toUpperCase() + burnout_risk.level.slice(1)}
              icon={<FiAlertCircle className={`w-5 h-5 ${burnout_risk.level === 'high' ? 'text-rose-500' : burnout_risk.level === 'moderate' ? 'text-amber-500' : 'text-emerald-500'}`} />}
              color={burnout_risk.level === 'high' ? 'rose' : burnout_risk.level === 'moderate' ? 'amber' : 'emerald'}
              subtitle={toPercent(burnout_risk.value)}
            />
          )}
          {fatigue_index?.value !== undefined && (
            <MetricCard
              label="Fatigue"
              value={fatigue_index.level.charAt(0).toUpperCase() + fatigue_index.level.slice(1)}
              icon={<FiBattery className={`w-5 h-5 ${fatigue_index.level === 'high' ? 'text-rose-500' : fatigue_index.level === 'moderate' ? 'text-amber-500' : 'text-emerald-500'}`} />}
              color={fatigue_index.level === 'high' ? 'rose' : fatigue_index.level === 'moderate' ? 'amber' : 'emerald'}
              subtitle={toPercent(fatigue_index.value)}
            />
          )}
          {predictions_summary?.avgRetention !== undefined && (
            <MetricCard
              label="Avg Retention"
              value={toPercent(predictions_summary.avgRetention)}
              icon={<FiTrendingUp className="w-5 h-5 text-purple-500" />}
              color="purple"
            />
          )}
          {study_efficiency?.score !== undefined && (
            <MetricCard
              label="Study Efficiency"
              value={toPercent(study_efficiency.score)}
              icon={<FiZap className="w-5 h-5 text-yellow-500" />}
              color="yellow"
              trend={study_efficiency.trend === 'improving' ? 1 : study_efficiency.trend === 'declining' ? -1 : 0}
              trendLabel={study_efficiency.trend}
            />
          )}
          {recent_activity?.streak_days !== undefined && recent_activity.streak_days > 0 && (
            <MetricCard
              label="Study Streak"
              value={`${recent_activity.streak_days}d`}
              icon={<FiAward className="w-5 h-5 text-amber-500" />}
              color="amber"
              subtitle={`${recent_activity.questions_today || 0} today`}
            />
          )}
        </div>

        {/* Concept Mastery Chart */}
        {conceptMasteryData.length > 0 && (
          <div className={`rounded-2xl border p-4 ${isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FaChartLine className="w-5 h-5 text-indigo-500" />
              Concept Mastery
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
                ({conceptMasteryData.length} concepts shown)
              </span>
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={conceptMasteryData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 1]} tickFormatter={(v) => `${v * 100}%`} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => toPercent(value)} labelFormatter={(label, items) => {
                    const item = items?.[0]?.payload;
                    return item?.fullName || label;
                  }} />
                  <Bar dataKey="mastery" fill="#818cf8" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Strong & Weak Topics */}
        {(strongTopicsData.length > 0 || weakTopicsData.length > 0) && (
          <div className="grid md:grid-cols-2 gap-4">
            {strongTopicsData.length > 0 && (
              <div className={`rounded-2xl border p-4 ${isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-emerald-500">
                  <FiAward className="w-5 h-5" /> Strong Topics
                </h3>
                <div className="space-y-3">
                  {strongTopicsData.slice(0, 5).map((topic, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm capitalize">{topic.name}</span>
                      <div className="flex items-center gap-2 flex-1 ml-4">
                        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                          <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${topic.accuracy * 100}%` }} />
                        </div>
                        <span className="text-sm font-medium text-emerald-500 min-w-[48px]">
                          {toPercent(topic.accuracy)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {weakTopicsData.length > 0 && (
              <div className={`rounded-2xl border p-4 ${isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-rose-500">
                  <FiAlertCircle className="w-5 h-5" /> Areas for Improvement
                </h3>
                <div className="space-y-3">
                  {weakTopicsData.slice(0, 5).map((topic, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm capitalize">{topic.name}</span>
                      <div className="flex items-center gap-2 flex-1 ml-4">
                        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                          <div className="h-2 rounded-full bg-rose-500" style={{ width: `${topic.accuracy * 100}%` }} />
                        </div>
                        <span className="text-sm font-medium text-rose-500 min-w-[48px]">
                          {toPercent(topic.accuracy)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Radar Chart */}
        {radarData.length > 0 && (
          <div className={`rounded-2xl border p-4 ${isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FiTarget className="w-5 h-5 text-indigo-500" />
              Concept Mastery Radar
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis domain={[0, 1]} tickFormatter={(v) => `${v * 100}%`} />
                  <Radar name="Mastery" dataKey="mastery" stroke="#818cf8" fill="#818cf8" fillOpacity={0.3} />
                  <Tooltip formatter={(value) => toPercent(value)} labelFormatter={(label, items) => {
                    const item = items?.[0]?.payload;
                    return item?.fullName || label;
                  }} />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Time & Confidence Analysis */}
        {data.confidence_calibration && (
          <div className="grid md:grid-cols-2 gap-4">
            <div className={`rounded-2xl border p-4 ${isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FiClock className="w-5 h-5 text-amber-500" />
                Confidence Calibration
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Calibration Error</span>
                  <span className="font-medium">{toPercent(data.confidence_calibration.calibration_error || 0.15)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Overconfidence Bias</span>
                  <span className="font-medium">{toPercent(data.confidence_calibration.overconfidence_bias || 0.08)}</span>
                </div>
                {data.confidence_calibration.by_difficulty && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span>Easy Questions</span>
                      <span className="font-medium">{toPercent(1 - (data.confidence_calibration.by_difficulty.easy || 0.08))}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Hard Questions</span>
                      <span className="font-medium">{toPercent(1 - (data.confidence_calibration.by_difficulty.hard || 0.18))}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className={`rounded-2xl border p-4 ${isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FaBrain className="w-5 h-5 text-purple-500" />
                Behavior Profile
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Learning Style</span>
                  <span className="font-medium capitalize">{data.behavior_profile.cluster || "Balanced"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Avg Time per Question</span>
                  <span className="font-medium">{formatSeconds(data.behavior_profile.avgTime || 60)}</span>
                </div>
                {data.behavior_profile.difficulty_preference !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span>Difficulty Preference</span>
                    <span className="font-medium">{toPercent(data.behavior_profile.difficulty_preference)}</span>
                  </div>
                )}
                {data.behavior_profile.persistence_score !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span>Persistence</span>
                    <span className="font-medium">{toPercent(data.behavior_profile.persistence_score)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTrendsTab = () => {
    if (!data) {
      return (
        <div className="text-center py-16">
          <p className="text-gray-500 dark:text-gray-400">No trend data available</p>
        </div>
      );
    }

    const { accuracyTrend, difficultyTrend, weeklyProgress, stress_patterns, fatigue_index } = data;

    // Process stress data for chart
    const stressChartData = stress_patterns?.byTopicData || [];
    const hasStressData = stressChartData.length > 0;

    return (
      <div className="space-y-6">
        {/* Accuracy Trend */}
        {accuracyTrend.length > 0 && (
          <div className={`rounded-2xl border p-4 ${isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FiTrendingUp className="w-5 h-5 text-cyan-500" />
              Accuracy Trend
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={accuracyTrend.slice(-30)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 1]} tickFormatter={(v) => `${v * 100}%`} />
                  <Tooltip formatter={(value) => toPercent(value)} />
                  <Line type="monotone" dataKey="value" stroke="#22d3ee" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Difficulty Trend */}
        {difficultyTrend.length > 0 && (
          <div className={`rounded-2xl border p-4 ${isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FiTrendingDown className="w-5 h-5 text-pink-500" />
              Difficulty Trend
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={difficultyTrend.slice(-30)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 1]} tickFormatter={(v) => `${v * 100}%`} />
                  <Tooltip formatter={(value) => toPercent(value)} />
                  <Line type="monotone" dataKey="value" stroke="#f472b6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Weekly Progress */}
        {weeklyProgress.length > 0 && (
          <div className={`rounded-2xl border p-4 ${isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FiCalendar className="w-5 h-5 text-emerald-500" />
              Weekly Progress
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyProgress}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis domain={[0, 1]} tickFormatter={(v) => `${v * 100}%`} />
                  <Tooltip formatter={(value) => toPercent(value)} />
                  <Bar dataKey="value" fill="#34d399" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Stress by Topic */}
        {hasStressData && (
          <div className={`rounded-2xl border p-4 ${isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FiActivity className="w-5 h-5 text-orange-500" />
              Stress by Topic
            </h3>
            <div className="space-y-3">
              {stressChartData.slice(0, 8).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{item.name}</span>
                  <div className="flex items-center gap-2 flex-1 ml-4">
                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                      <div className="h-2 rounded-full bg-orange-500" style={{ width: `${item.stress * 100}%` }} />
                    </div>
                    <span className="text-sm font-medium text-orange-500 min-w-[48px]">
                      {toPercent(item.stress)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fatigue & Burnout Summary */}
        {(fatigue_index?.value !== undefined || data.burnout_risk?.value !== undefined) && (
          <div className="grid md:grid-cols-2 gap-4">
            {fatigue_index?.value !== undefined && (
              <div className={`rounded-2xl border p-4 ${isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FiBattery className="w-5 h-5 text-amber-500" />
                  Fatigue Analysis
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Current Fatigue</span>
                    <span className={`font-medium ${fatigue_index.level === 'high' ? 'text-rose-500' : fatigue_index.level === 'moderate' ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {toPercent(fatigue_index.value)} - {fatigue_index.level}
                    </span>
                  </div>
                  {fatigue_index.trend && (
                    <div className="flex justify-between text-sm">
                      <span>Trend</span>
                      <span className="font-medium capitalize">{fatigue_index.trend}</span>
                    </div>
                  )}
                  {fatigue_index.recommendation && (
                    <div className="mt-2 p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-xs">
                      💡 {fatigue_index.recommendation}
                    </div>
                  )}
                </div>
              </div>
            )}

            {data.burnout_risk?.value !== undefined && (
              <div className={`rounded-2xl border p-4 ${isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FiAlertCircle className={`w-5 h-5 ${data.burnout_risk.level === 'high' ? 'text-rose-500' : 'text-amber-500'}`} />
                  Burnout Risk
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Risk Level</span>
                    <span className={`font-medium ${data.burnout_risk.level === 'high' ? 'text-rose-500' : data.burnout_risk.level === 'moderate' ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {data.burnout_risk.level.toUpperCase()} ({toPercent(data.burnout_risk.value)})
                    </span>
                  </div>
                  {data.burnout_risk.warning_signs?.length > 0 && (
                    <div className="mt-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Warning Signs:</span>
                      <ul className="mt-1 space-y-1">
                        {data.burnout_risk.warning_signs.slice(0, 3).map((sign, idx) => (
                          <li key={idx} className="text-xs text-gray-600 dark:text-gray-300">• {sign}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {data.burnout_risk.recommendations?.length > 0 && (
                    <div className="mt-2 p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-xs">
                      💡 {data.burnout_risk.recommendations[0]}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderModelsTab = () => {
    if (!data) {
      return (
        <div className="text-center py-16">
          <p className="text-gray-500 dark:text-gray-400">No model data available</p>
        </div>
      );
    }

    const {
      conceptCount,
      avgMastery,
      weakness_priority,
      reviewPriority,
      time_allocation,
      errorPatternsData,
      predictions_summary,
      stability_index,
      difficulty_tolerance,
      focus_loss,
    } = data;

    return (
      <div className="space-y-6">
        {/* Model Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {conceptCount > 0 && (
            <div className={`rounded-2xl border p-4 ${isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
              <div className="p-2 rounded-xl inline-block bg-indigo-50 dark:bg-indigo-900/20 mb-2">
                <FaStar className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="text-lg font-bold">{toPercent(avgMastery)}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Concept Mastery</div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{conceptCount} concepts</div>
            </div>
          )}

          {predictions_summary?.avgRetention !== undefined && (
            <div className={`rounded-2xl border p-4 ${isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
              <div className="p-2 rounded-xl inline-block bg-purple-50 dark:bg-purple-900/20 mb-2">
                <FiTrendingUp className="w-5 h-5 text-purple-500" />
              </div>
              <div className="text-lg font-bold">{toPercent(predictions_summary.avgRetention)}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Avg Retention</div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                {predictions_summary.lowRetentionTopics?.length || 0} low, {predictions_summary.highRetentionTopics?.length || 0} high
              </div>
            </div>
          )}

          {weakness_priority?.length > 0 && (
            <div className={`rounded-2xl border p-4 ${isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
              <div className="p-2 rounded-xl inline-block bg-amber-50 dark:bg-amber-900/20 mb-2">
                <FiFlag className="w-5 h-5 text-amber-500" />
              </div>
              <div className="text-lg font-bold">{weakness_priority.length}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Weakness Areas</div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 truncate">
                {weakness_priority[0]?.topic || "None identified"}
              </div>
            </div>
          )}

          {reviewPriority?.length > 0 && (
            <div className={`rounded-2xl border p-4 ${isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
              <div className="p-2 rounded-xl inline-block bg-sky-50 dark:bg-sky-900/20 mb-2">
                <FiRefreshCw className="w-5 h-5 text-sky-500" />
              </div>
              <div className="text-lg font-bold">{reviewPriority.length}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Need Review</div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                {reviewPriority.filter(r => r.priority === 'high').length} high priority
              </div>
            </div>
          )}

          {time_allocation?.length > 0 && (
            <div className={`rounded-2xl border p-4 ${isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
              <div className="p-2 rounded-xl inline-block bg-teal-50 dark:bg-teal-900/20 mb-2">
                <FiClock className="w-5 h-5 text-teal-500" />
              </div>
              <div className="text-lg font-bold">{time_allocation.length}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Time Allocation</div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                {time_allocation.reduce((sum, t) => sum + (t.recommended_minutes || 0), 0)} min total
              </div>
            </div>
          )}

          {errorPatternsData.length > 0 && (
            <div className={`rounded-2xl border p-4 ${isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
              <div className="p-2 rounded-xl inline-block bg-rose-50 dark:bg-rose-900/20 mb-2">
                <FiAlertCircle className="w-5 h-5 text-rose-500" />
              </div>
              <div className="text-lg font-bold">{errorPatternsData.length}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Error Patterns</div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                {errorPatternsData[0]?.name || ""}: {errorPatternsData[0]?.value?.toFixed(0) || 0}%
              </div>
            </div>
          )}

          {stability_index && Object.keys(stability_index).length > 0 && (
            <div className={`rounded-2xl border p-4 ${isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
              <div className="p-2 rounded-xl inline-block bg-cyan-50 dark:bg-cyan-900/20 mb-2">
                <FiTrendingUp className="w-5 h-5 text-cyan-500" />
              </div>
              <div className="text-lg font-bold">{Object.keys(stability_index).length}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Stable Concepts</div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                {Object.values(stability_index).filter(v => v > 0.6).length} high stability
              </div>
            </div>
          )}

          {difficulty_tolerance?.max_sustainable !== undefined && (
            <div className={`rounded-2xl border p-4 ${isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
              <div className="p-2 rounded-xl inline-block bg-blue-50 dark:bg-blue-900/20 mb-2">
                <FiTarget className="w-5 h-5 text-blue-500" />
              </div>
              <div className="text-lg font-bold">{toPercent(difficulty_tolerance.max_sustainable)}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Difficulty Tolerance</div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">Max sustainable</div>
            </div>
          )}

          {focus_loss?.frequency !== undefined && (
            <div className={`rounded-2xl border p-4 ${isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
              <div className="p-2 rounded-xl inline-block bg-orange-50 dark:bg-orange-900/20 mb-2">
                <FiActivity className="w-5 h-5 text-orange-500" />
              </div>
              <div className="text-lg font-bold">{toPercent(focus_loss.frequency)}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Focus Loss</div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                {focus_loss.triggers?.length || 0} triggers
              </div>
            </div>
          )}
        </div>

        {/* Weakness Priority Detail */}
        {weakness_priority?.length > 0 && (
          <div className={`rounded-2xl border p-4 ${isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-rose-500">
              <FiFlag className="w-5 h-5" />
              Weakness Priority Rankings
            </h3>
            <div className="space-y-3">
              {weakness_priority.slice(0, 6).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-400">#{idx + 1}</span>
                    <span className="text-sm capitalize">{item.topic}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      item.urgency === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                      item.urgency === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                    }`}>
                      {item.urgency}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                      <div className="h-2 rounded-full bg-rose-500" style={{ width: `${(1 - (item.accuracy || 0)) * 100}%` }} />
                    </div>
                    <span className="text-sm font-medium text-rose-500 min-w-[48px]">
                      {toPercent(1 - (item.accuracy || 0))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Time Allocation Detail */}
        {time_allocation?.length > 0 && (
          <div className={`rounded-2xl border p-4 ${isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-teal-500">
              <FiClock className="w-5 h-5" />
              Recommended Time Allocation
            </h3>
            <div className="space-y-3">
              {time_allocation.slice(0, 6).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-400">#{item.order || idx + 1}</span>
                    <span className="text-sm capitalize">{item.topic}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      item.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                      item.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                    }`}>
                      {item.priority}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-teal-500">
                      {item.recommended_minutes || 0}m
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Patterns Pie Chart */}
        {errorPatternsData.length > 0 && (
          <div className={`rounded-2xl border p-4 ${isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-rose-500">
              <FiPieChart className="w-5 h-5" />
              Error Pattern Distribution
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={errorPatternsData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value.toFixed(0)}%`}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {errorPatternsData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value.toFixed(0)}%`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Review Priority Detail */}
        {reviewPriority?.length > 0 && (
          <div className={`rounded-2xl border p-4 ${isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-sky-500">
              <FiRefreshCw className="w-5 h-5" />
              Review Priority
            </h3>
            <div className="space-y-3">
              {reviewPriority.slice(0, 6).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-700/30">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-400">#{idx + 1}</span>
                    <span className="text-sm capitalize">{item.topic}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      item.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                      item.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                    }`}>
                      {item.priority}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {item.reason}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderQuestionsTab = () => {
    if (!answers.length) {
      return (
        <div className="text-center py-16">
          <FiBookOpen className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No questions to review</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {answers.map((answer, index) => {
          const isCorrect = answer.isCorrect;
          const timeSpent = answer.timeSpent || 0;
          const expectedTime = answer.expectedTime || 90;
          const ratio = timeSpent / Math.max(1, expectedTime);
          const ratioLabel = ratio > 1.1 ? "Slow" : ratio < 0.7 ? "Fast" : "On Target";
          const concept = answer.conceptArea || answer.topic || "General";

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`rounded-2xl border p-4 ${isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-medium">Q{index + 1}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    isCorrect ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" :
                    "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                  }`}>
                    {isCorrect ? <FiCheckCircle className="inline mr-1 w-3 h-3" /> :
                               <FiXCircle className="inline mr-1 w-3 h-3" />}
                    {isCorrect ? "Correct" : "Wrong"}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{concept}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Difficulty: {toPercent(answer.difficulty || 0.5)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <FiClock className="w-3 h-3" />
                  <span>{formatSeconds(timeSpent)} / {formatSeconds(expectedTime)}</span>
                  <span className={`px-2 py-0.5 rounded-full ${
                    ratioLabel === "Slow" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" :
                    ratioLabel === "Fast" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" :
                    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                  }`}>
                    {ratioLabel}
                  </span>
                </div>
              </div>

              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                {answer.questionText || "Question text unavailable"}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <div className={`p-2 rounded-lg ${isDark ? "bg-slate-700" : "bg-slate-50"}`}>
                  <span className="text-gray-500 dark:text-gray-400">Your Answer: </span>
                  <span className="font-medium">
                    {answer.selectedOptions ? JSON.stringify(answer.selectedOptions) : "N/A"}
                  </span>
                </div>
                <div className={`p-2 rounded-lg ${isDark ? "bg-slate-700" : "bg-emerald-50"}`}>
                  <span className="text-gray-500 dark:text-gray-400">Correct Answer: </span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {answer.correctAnswer ? JSON.stringify(answer.correctAnswer) : "N/A"}
                  </span>
                </div>
              </div>

              {!isCorrect && (answer.explanation || answer.solution) && (
                <div className={`mt-3 p-3 rounded-lg text-xs ${isDark ? "bg-slate-700" : "bg-blue-50"}`}>
                  <span className="font-medium text-blue-600 dark:text-blue-400">Explanation: </span>
                  <span className="text-gray-600 dark:text-gray-300">
                    {answer.explanation || answer.solution}
                  </span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    );
  };

  // ==================== RECOMMENDATIONS TAB ====================
  const renderRecommendationsTab = () => {
    if (!data?.recommendations?.length) {
      return (
        <div className="text-center py-16">
          <FiAward className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No recommendations available</p>
        </div>
      );
    }

    const { recommendations } = data;

    return (
      <div className="space-y-4">
        {recommendations.map((rec, idx) => (
          <div
            key={idx}
            className={`rounded-2xl border p-4 ${
              isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-xl ${
                rec.priority === 'high' ? 'bg-rose-100 dark:bg-rose-900/30' :
                rec.priority === 'medium' ? 'bg-amber-100 dark:bg-amber-900/30' :
                'bg-emerald-100 dark:bg-emerald-900/30'
              }`}>
                {rec.category === 'weakness_focus' && <FiFlag className="w-5 h-5 text-rose-500" />}
                {rec.category === 'wellness' && <FiHeart className="w-5 h-5 text-rose-500" />}
                {rec.category === 'fatigue_management' && <FiBattery className="w-5 h-5 text-amber-500" />}
                {rec.category === 'concept_review' && <FiBookOpen className="w-5 h-5 text-blue-500" />}
                {rec.category === 'efficiency' && <FiZap className="w-5 h-5 text-yellow-500" />}
                {!['weakness_focus', 'wellness', 'fatigue_management', 'concept_review', 'efficiency'].includes(rec.category) &&
                  <FiAlertCircle className="w-5 h-5 text-indigo-500" />
                }
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    rec.priority === 'high' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' :
                    rec.priority === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                  }`}>
                    {rec.priority?.toUpperCase() || 'NORMAL'}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">{rec.category}</span>
                </div>
                <h4 className="font-semibold">{rec.message}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{rec.detail}</p>
                {rec.action_items?.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {rec.action_items.slice(0, 4).map((action, i) => (
                      <li key={i} className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                        <span className="text-emerald-500">•</span>
                        {action}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ==================== MAIN RENDER ====================
  if (!answers.length && !sessionData?.sessionId) {
    return (
      <div className={`min-h-screen px-4 py-8 md:px-8 ${isDark ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"}`}>
        <div className="mx-auto max-w-4xl rounded-2xl border p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <div className="mb-3 flex items-center gap-2 text-amber-500">
            <FiAlertCircle className="h-5 w-5" />
            <span className="font-semibold">No practice result data found</span>
          </div>
          <p className="text-gray-500 dark:text-gray-400">
            This page needs session result state. Start a practice session and end it to view deep analytics.
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
    <div className={`min-h-screen px-4 py-6 md:px-8 ${isDark ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"}`}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #practice-result-print, #practice-result-print * { visibility: visible; }
          #practice-result-print { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div id="practice-result-print" className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 no-print">
          <div>
            <h1 className="text-2xl font-bold md:text-3xl flex items-center gap-2">
              <FaBrain className="w-6 h-6 text-indigo-500" />
              Practice Session Analysis
            </h1>
            <p className={`mt-1 text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
              Session: {sessionData?.sessionId || "N/A"} • {formatDateTime(sessionData?.completedAt || new Date())}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
              className={`p-2 rounded-lg ${isDark ? "bg-slate-800 hover:bg-slate-700" : "bg-white hover:bg-slate-100 border border-slate-200"}`}
            >
              {viewMode === "grid" ? <FiGrid className="w-4 h-4" /> : <FiList className="w-4 h-4" />}
            </button>
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg ${isDark ? "bg-slate-800 hover:bg-slate-700" : "bg-white hover:bg-slate-100 border border-slate-200"}`}
            >
              {isDark ? <FiSun className="w-4 h-4" /> : <FiMoon className="w-4 h-4" />}
            </button>
            <button
              onClick={() => window.print()}
              className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm flex items-center gap-1"
            >
              <FiPrinter className="w-4 h-4" /> Print
            </button>
            <button
              onClick={() => navigate("/test/practice")}
              className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm flex items-center gap-1"
            >
              <FiArrowLeft className="w-4 h-4" /> New Practice
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="no-print flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
          {["overview", "trends", "models", "questions", "recommendations"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                activeTab === tab
                  ? "bg-indigo-600 text-white"
                  : isDark ? "hover:bg-slate-800 text-gray-400" : "hover:bg-slate-100 text-gray-600"
              }`}
            >
              {tab === "overview" && <FiTarget className="inline mr-1 w-3 h-3" />}
              {tab === "trends" && <FiTrendingUp className="inline mr-1 w-3 h-3" />}
              {tab === "models" && <FaBrain className="inline mr-1 w-3 h-3" />}
              {tab === "questions" && <FiBookOpen className="inline mr-1 w-3 h-3" />}
              {tab === "recommendations" && <FiAward className="inline mr-1 w-3 h-3" />}
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "overview" && renderOverviewTab()}
            {activeTab === "trends" && renderTrendsTab()}
            {activeTab === "models" && renderModelsTab()}
            {activeTab === "questions" && renderQuestionsTab()}
            {activeTab === "recommendations" && renderRecommendationsTab()}
          </motion.div>
        </AnimatePresence>

        {/* Footer */}
        <div className={`text-center text-xs ${isDark ? "text-gray-600" : "text-gray-400"} border-t border-slate-200 dark:border-slate-700 pt-4`}>
          <p>Powered by Adaptive Learning Engine • {new Date().toLocaleDateString()}</p>
          {flaskLoading && <p className="text-indigo-500 mt-1">🔄 Syncing backend analytics...</p>}
        </div>
      </div>
    </div>
  );
};

export default PracticeResult;
