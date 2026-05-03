// components/Student/StudentDashboardNew.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/authContext";
import { useTheme } from "../../context/ThemeContext";
import authService from "../../services/authService";
import studentService from "../../services/studentService";
import analyticsService from "../../services/analyticsService";
import flaskService from "../../services/flaskService";
import testService from "../../services/testService";
import websocketService from "../../services/webSockets";
import enrollmentService from "../../services/Course/enrollmentService";
import courseService from "../../services/Course/CourseService";
import curriculumService from "../../services/Course/curriculumService";
import LearningView from "./LearningView";

// Icons
import {
  FiHome,
  FiBook,
  FiBookOpen,
  FiUsers,
  FiStar,
  FiTrendingUp,
  FiTarget,
  FiZap,
  FiChevronRight,
  FiChevronLeft,
  FiBarChart2,
  FiPieChart,
  FiActivity,
  FiClock,
  FiCalendar,
  FiAward,
  FiHeart,
  FiSettings,
  FiInfo,
  FiHelpCircle,
  FiLogOut,
  FiX,
  FiMenu,
  FiEye,
  FiEyeOff,
  FiPlay,
  FiCheck,
  FiCheckCircle,
  FiAlertCircle,
  FiLoader,
  FiSearch,
  FiFilter,
  FiGrid,
  FiList,
  FiSun,
  FiMoon,
  FiRefreshCw,
  FiPlusCircle,
  FiMinusCircle,
  FiUpload,
  FiDownload,
  FiMessageSquare,
  FiFileText,
  FiVideo,
  FiHeadphones,
  FiMonitor,
  FiSmartphone,
  FiMap,
  FiCompass,
  FiNavigation,
  FiFlag,
  FiBookmark,
  FiShare2,
  FiMaximize2,
  FiMinimize2,
  FiGlobe,
  FiCpu,
  FiCode,
  FiDatabase,
  FiServer,
  FiCloud,
  FiLayers,
} from "react-icons/fi";

import {
  FaBrain,
  FaRocket,
  FaChartLine,
  FaGraduationCap,
  FaBook,
  FaCertificate,
  FaMedal,
  FaTrophy,
  FaFire,
  FaBolt,
  FaStar as FaStarIcon,
  FaCode,
  FaLaptopCode,
  FaDatabase,
  FaServer,
  FaCloud,
  FaMagic,
  FaFeather,
  FaLeaf,
  FaSeedling,
  FaTree,
  FaMountain,
  FaSun,
  FaMoon,
  FaCloudSun,
  FaCloudMoon,
  FaStar,
  FaCompass,
  FaBullseye,
  FaCrosshairs,
  FaDiceD6,
  FaDiceD20,
  FaChess,
  FaChessBoard,
  FaChessKing,
  FaChessQueen,
  FaChessBishop,
  FaChessKnight,
  FaChessRook,
  FaChessPawn,
} from "react-icons/fa";

import {
  GiBrain,
  GiTargeted,
  GiAchievement,
  GiGrowth,
  GiStarCycle,
  GiStarProminences,
} from "react-icons/gi";

const StudentDashboardNew = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  // State Management
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Dashboard Data
  const [studentStats, setStudentStats] = useState(null);
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [allCourses, setAllCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [courseCurriculum, setCourseCurriculum] = useState(null);
  const [courseProgress, setCourseProgress] = useState(null);
  const [learningContent, setLearningContent] = useState(null);
  const [activeLesson, setActiveLesson] = useState(null);
  const [lessonTimer, setLessonTimer] = useState(null);
  const [timeSpent, setTimeSpent] = useState(0);

  // Search and Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLevel, setFilterLevel] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [viewMode, setViewMode] = useState("grid");

  // Modals
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [enrollingCourseId, setEnrollingCourseId] = useState(null);

  // Student Dashboard Sub Data
  const [student, setStudent] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [insights, setInsights] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [learningPath, setLearningPath] = useState(null);
  const [flaskModels, setFlaskModels] = useState(null);
  const [recentTests, setRecentTests] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState("weekly");
  const [showWelcome, setShowWelcome] = useState(true);
  const [fullScreen, setFullScreen] = useState(false);
  const [rawAnalyticsModels, setRawAnalyticsModels] = useState(null);

  // Performance Data
  const [coursePerformance, setCoursePerformance] = useState({
    totalCourses: 0,
    completedCourses: 0,
    activeCourses: 0,
    totalTimeSpent: 0,
    averageProgress: 0,
    studyStreak: 0,
    longestStreak: 0,
    totalLessonsCompleted: 0,
    totalQuizzesPassed: 0,
    averageQuizScore: 0,
    certificatesEarned: 0,
    recentActivity: [],
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (activeLesson) {
      const timer = setInterval(() => {
        setTimeSpent((prev) => prev + 1);
      }, 1000);
      setLessonTimer(timer);
      return () => clearInterval(timer);
    } else {
      if (lessonTimer) clearInterval(lessonTimer);
      setTimeSpent(0);
    }
  }, [activeLesson]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullScreenChange = () => {
      setFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullScreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullScreenChange);
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const studentId = authService.getStudentId();
      if (!studentId) {
        navigate("/auth");
        return;
      }

      // Get student info from auth
      const currentUser = authService.getCurrentUserSync();
      setStudent(currentUser);

      // Load performance data
      const perfResponse =
        await studentService.getStudentPerformance(studentId);
      if (perfResponse.success) {
        const perfPayload = perfResponse.performance || {};
        const backendAnalytics =
          perfPayload.analytics || perfResponse.analytics || null;
        const computedAnalytics =
          backendAnalytics || analyticsService.calculateAllModels(perfPayload);
        setPerformance(perfPayload);
        setRawAnalyticsModels(computedAnalytics);
        setAnalytics(analyticsService.formatForDashboard(computedAnalytics));
      }

      // Load insights
      const insightsResponse =
        await studentService.getStudentInsights(studentId);
      if (insightsResponse.success) {
        setInsights(insightsResponse.insights);
      }

      // Load recommendations
      const recResponse = await studentService.getRecommendations(studentId);
      if (recResponse.success) {
        setRecommendations(recResponse.recommendations || []);
      }

      // Load learning path
      const pathResponse = await studentService.getLearningPath(studentId);
      if (pathResponse.success) {
        setLearningPath(pathResponse.learningPath);
      }

      // Load Flask model info
      const flaskResponse = await flaskService.getModelInfo(studentId);
      if (flaskResponse) {
        setFlaskModels(flaskResponse.dashboard_data?.predictions || null);
      }

      // Load recent tests
      const testsResponse = await studentService.getTestHistory(studentId, {
        limit: 5,
      });
      if (testsResponse.success) {
        setRecentTests(testsResponse.tests || []);
      }

      // Initialize WebSocket connection
      if (!websocketService.isConnected()) {
        websocketService.initialize("/test");
      }

      // Load learning stats
      const statsResponse = await enrollmentService.getLearningStats();
      if (statsResponse?.success && statsResponse.data) {
        setStudentStats(statsResponse.data);
        setCoursePerformance((prev) => ({
          ...prev,
          ...statsResponse.data,
        }));
      }

      // Load enrolled courses
      const enrolledResponse = await enrollmentService.getEnrolledCourses();
      if (enrolledResponse?.success) {
        const courses = enrolledResponse.data || [];
        setEnrolledCourses(courses);
        setCoursePerformance((prev) => ({
          ...prev,
          totalCourses: courses.length,
          activeCourses: courses.filter((c) => c.enrollmentStatus === "active")
            .length,
          completedCourses: courses.filter(
            (c) => c.enrollmentStatus === "completed",
          ).length,
        }));
      }

      // Load all available courses
      const allCoursesResponse = await courseService.getCourses({
        status: "published",
      });
      if (allCoursesResponse?.success) {
        setAllCourses(allCoursesResponse.data || []);
      }
    } catch (err) {
      console.error("Error loading dashboard:", err);
      setError("Failed to load dashboard data. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
  };

  const handleEnroll = async (courseId) => {
    try {
      setEnrollingCourseId(courseId);
      const response = await enrollmentService.enrollInCourse(courseId, {
        paymentMethod: "free",
        transactionId: "FREE_ENROLLMENT",
      });
      if (response?.success) {
        setSuccess("Successfully enrolled in course!");
        setTimeout(() => setSuccess(null), 3000);
        await loadDashboardData();
        setShowEnrollModal(false);
      }
    } catch (err) {
      setError(err.message || "Failed to enroll in course");
      setTimeout(() => setError(null), 5000);
    } finally {
      setEnrollingCourseId(null);
    }
  };

  const handleStartLearning = async (courseId) => {
    try {
      // Navigate to the dedicated LearningView page
      navigate(`/course/${courseId}/learn`);
    } catch (err) {
      setError("Failed to navigate to course content");
    }
  };
  const handleCompleteLesson = async () => {
    if (!activeLesson || !selectedCourse) return;
    try {
      const response = await enrollmentService.completeLesson(
        selectedCourse._id,
        activeLesson.lesson._id,
        activeLesson.chapterId,
        timeSpent,
      );
      if (response?.success) {
        setSuccess("Lesson completed! 🎉");
        setTimeout(() => setSuccess(null), 3000);
        if (response.data) {
          setCourseProgress((prev) => ({
            ...prev,
            overallProgress: response.data.progress,
            completedLessons: response.data.completedLessons,
          }));
        }
        moveToNextLesson();
        setTimeSpent(0);
      }
    } catch (err) {
      setError("Failed to mark lesson as complete");
    }
  };

  const moveToNextLesson = () => {
    if (!courseCurriculum?.chapters) return;
    let found = false;
    let nextLesson = null;
    for (const chapter of courseCurriculum.chapters) {
      for (let i = 0; i < chapter.lessons.length; i++) {
        if (found && !nextLesson) {
          nextLesson = { chapterId: chapter._id, lesson: chapter.lessons[i] };
          break;
        }
        if (chapter.lessons[i]._id === activeLesson?.lesson._id) {
          found = true;
          if (i + 1 < chapter.lessons.length) {
            nextLesson = {
              chapterId: chapter._id,
              lesson: chapter.lessons[i + 1],
            };
          }
          break;
        }
      }
      if (nextLesson) break;
    }
    if (nextLesson) {
      setActiveLesson(nextLesson);
    } else {
      setSuccess("Chapter completed! Move to next chapter.");
      setActiveLesson(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/auth");
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getProgressColor = (progress) => {
    if (progress >= 80) return "bg-green-500";
    if (progress >= 60) return "bg-blue-500";
    if (progress >= 40) return "bg-yellow-500";
    if (progress >= 20) return "bg-orange-500";
    return "bg-red-500";
  };

  const getMasteryColor = (value) => {
    if (value >= 0.8) return "text-green-500";
    if (value >= 0.6) return "text-blue-500";
    if (value >= 0.4) return "text-yellow-500";
    return "text-red-500";
  };

  const filteredCourses = allCourses.filter((course) => {
    const matchesSearch =
      course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = filterLevel === "all" || course.level === filterLevel;
    const matchesCategory =
      filterCategory === "all" || course.category === filterCategory;
    return matchesSearch && matchesLevel && matchesCategory;
  });

  const isEnrolled = (courseId) => {
    return enrolledCourses.some(
      (e) => e.course?._id === courseId || e.course === courseId,
    );
  };

  // Helper Functions from StudentDashboardSub
  const getSafeNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const clamp = (value, min = 0, max = 1) =>
    Math.min(max, Math.max(min, getSafeNumber(value, min)));

  const getSessionDate = (session) => {
    const timestamp =
      session?.endTime ||
      session?.startTime ||
      session?.submittedAt ||
      session?.createdAt ||
      session?.timestamp;
    if (!timestamp) return null;
    const parsed = new Date(timestamp);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const toDateKey = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  const buildSparklinePath = (points, width = 220, height = 70) => {
    if (!points || points.length === 0) return "";
    const max = Math.max(...points);
    const min = Math.min(...points);
    const range = Math.max(1, max - min);
    const stepX = points.length > 1 ? width / (points.length - 1) : width;
    return points
      .map((point, index) => {
        const x = index * stepX;
        const y = height - ((point - min) / range) * height;
        return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  };

  // Derived Data
  const averageStability =
    rawAnalyticsModels?.stabilityIndex &&
    Object.keys(rawAnalyticsModels.stabilityIndex).length > 0
      ? Object.values(rawAnalyticsModels.stabilityIndex).reduce(
          (sum, val) => sum + getSafeNumber(val, 0),
          0,
        ) / Object.keys(rawAnalyticsModels.stabilityIndex).length
      : 0;

  const recommendedDifficulty = getSafeNumber(
    performance?.insights?.recommendedDifficulty ||
      insights?.recommendedDifficulty ||
      rawAnalyticsModels?.difficultyTolerance?.maxSustainable,
    0.5,
  );

  const subjectMetrics = (performance?.topicPerformance || []).reduce(
    (acc, topic) => {
      const subjectName = topic?.subject || "general";
      if (!acc[subjectName]) {
        acc[subjectName] = {
          subject: subjectName,
          questions: 0,
          correctWeighted: 0,
          avgDifficultyWeighted: 0,
        };
      }
      const questions = getSafeNumber(topic?.questionsAttempted, 0);
      const accuracy = getSafeNumber(topic?.accuracy, 0);
      const avgDifficulty = getSafeNumber(topic?.averageDifficulty, 0.5);
      acc[subjectName].questions += questions;
      acc[subjectName].correctWeighted += (accuracy / 100) * questions;
      acc[subjectName].avgDifficultyWeighted += avgDifficulty * questions;
      return acc;
    },
    {},
  );

  const subjectRows = Object.values(subjectMetrics)
    .map((row) => ({
      ...row,
      accuracy:
        row.questions > 0 ? (row.correctWeighted / row.questions) * 100 : 0,
      avgDifficulty:
        row.questions > 0 ? row.avgDifficultyWeighted / row.questions : 0.5,
    }))
    .sort((a, b) => b.questions - a.questions);

  const timelineSource =
    performance?.testHistory?.length > 0
      ? performance.testHistory
      : recentTests?.length > 0
        ? recentTests
        : [];
  const sessionTimeline = timelineSource
    .map((session, index) => {
      const sessionDate = getSessionDate(session);
      if (!sessionDate) return null;
      return {
        id: session?.sessionId || `session-${index}`,
        date: sessionDate,
        dateKey: toDateKey(sessionDate),
        accuracy: getSafeNumber(
          session?.summary?.accuracy ?? session?.accuracy,
          0,
        ),
        testType: session?.testType || "practice",
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date - b.date);

  const activeDayMap = sessionTimeline.reduce((acc, item) => {
    if (!item?.dateKey) return acc;
    if (!acc[item.dateKey]) {
      acc[item.dateKey] = { attempts: 0, totalAccuracy: 0, date: item.date };
    }
    acc[item.dateKey].attempts += 1;
    acc[item.dateKey].totalAccuracy += item.accuracy;
    return acc;
  }, {});

  const computeCurrentStreak = (dayMap) => {
    const now = new Date();
    let streak = 0;
    for (let delta = 0; delta < 365; delta += 1) {
      const cursor = new Date(now);
      cursor.setHours(0, 0, 0, 0);
      cursor.setDate(cursor.getDate() - delta);
      const key = toDateKey(cursor);
      if (dayMap[key]) {
        streak += 1;
      } else if (delta === 0) {
        continue;
      } else {
        break;
      }
    }
    return streak;
  };

  const streakHeatmap = Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (13 - index));
    const key = toDateKey(date);
    const dayEntry = activeDayMap[key];
    const attempts = getSafeNumber(dayEntry?.attempts, 0);
    const avgAccuracy =
      attempts > 0
        ? Math.round(getSafeNumber(dayEntry?.totalAccuracy, 0) / attempts)
        : 0;
    return {
      key,
      label: date.toLocaleDateString(undefined, { weekday: "short" }),
      day: date.getDate(),
      attempts,
      avgAccuracy,
      intensity: attempts === 0 ? 0 : clamp(avgAccuracy / 100, 0.2, 1),
    };
  });

  const computedCurrentStreak = computeCurrentStreak(activeDayMap);
  const currentStreak =
    getSafeNumber(performance?.overallStats?.currentStreak, -1) >= 0
      ? getSafeNumber(performance?.overallStats?.currentStreak, 0)
      : computedCurrentStreak;
  const longestStreak = Math.max(
    getSafeNumber(performance?.overallStats?.longestStreak, 0),
    currentStreak,
  );
  const streakTarget = 14;
  const streakCompletion = Math.round(
    clamp(currentStreak / streakTarget, 0, 1) * 100,
  );
  const recentAccuracyTrend = sessionTimeline
    .slice(-10)
    .map((item) => Math.round(clamp(item.accuracy / 100, 0, 1) * 100));
  const fatigueTrendPoints = (analytics?.charts?.fatigueTrend || []).map(
    (score) => Math.round(clamp(1 - getSafeNumber(score, 0), 0, 1) * 100),
  );

  const weaknessPriorityDetailed = (
    rawAnalyticsModels?.weaknessPriority || []
  ).map((item) => {
    const allocationMatch = (rawAnalyticsModels?.timeAllocation || []).find(
      (allocation) =>
        (allocation?.topic || "").toLowerCase() ===
        (item?.topic || "").toLowerCase(),
    );
    return {
      topic: item?.topic || "Unknown Topic",
      subject: item?.subject || "General",
      rank: getSafeNumber(item?.rank, 0),
      urgency: Math.round(clamp(item?.score, 0, 1) * 100),
      mastery: Math.round(clamp(item?.mastery, 0, 1) * 100),
      daysSince: getSafeNumber(item?.daysSince, 0),
      recommendation: item?.recommendation || "Practice targeted questions",
      minutes: getSafeNumber(
        allocationMatch?.recommendedMinutes || item?.recommendedMinutes,
        15,
      ),
      priority: allocationMatch?.priority || "medium",
    };
  });

  const modelSampleContext = {
    sampleAccuracy: Math.round(
      getSafeNumber(performance?.overallStats?.accuracy, 68),
    ),
    sampleDifficulty: clamp(
      performance?.overallStats?.averageDifficulty,
      0.3,
      0.85,
    ),
    sampleStreak: currentStreak,
    sampleFatigue: Math.round(
      clamp(rawAnalyticsModels?.fatigueIndex?.current, 0.2, 0.8) * 100,
    ),
    sampleEfficiency: Math.round(
      clamp(rawAnalyticsModels?.studyEfficiency?.score, 0.3, 0.95) * 100,
    ),
  };

  const performanceCards = [
    {
      key: "correct",
      label: "Correct Answers",
      value: getSafeNumber(performance?.overallStats?.totalCorrect, 0),
      hint: `Out of ${getSafeNumber(performance?.overallStats?.totalQuestions, 0)} attempts`,
      icon: FiCheckCircle,
      tone: "from-emerald-500 to-green-600",
    },
    {
      key: "time",
      label: "Study Time",
      value: `${Math.round(getSafeNumber(performance?.overallStats?.totalTimeSpent, 0))} min`,
      hint: "Total focused learning time",
      icon: FiClock,
      tone: "from-sky-500 to-indigo-600",
    },
    {
      key: "difficulty",
      label: "Avg Difficulty",
      value: `${Math.round(getSafeNumber(performance?.overallStats?.averageDifficulty, 0.5) * 100)}%`,
      hint: "Difficulty level handled historically",
      icon: FiZap,
      tone: "from-purple-500 to-fuchsia-600",
    },
    {
      key: "efficiency",
      label: "Study Efficiency",
      value: `${Math.round(getSafeNumber(rawAnalyticsModels?.studyEfficiency?.score, 0) * 100)}%`,
      hint:
        rawAnalyticsModels?.studyEfficiency?.efficiencyRating ||
        "Efficiency model",
      icon: FiTrendingUp,
      tone: "from-amber-500 to-orange-600",
    },
    {
      key: "stability",
      label: "Consistency Index",
      value: `${Math.round(getSafeNumber(averageStability, 0.5) * 100)}%`,
      hint: "Computed from mastery variance + trend",
      icon: FiActivity,
      tone: "from-cyan-500 to-blue-600",
    },
    {
      key: "recommended",
      label: "Recommended Difficulty",
      value: `${Math.round(recommendedDifficulty * 100)}%`,
      hint: "From tolerance + adaptive models",
      icon: FiTarget,
      tone: "from-rose-500 to-pink-600",
    },
    {
      key: "predicted",
      label: "Predicted Score",
      value: `${Math.round(getSafeNumber(insights?.predictedScore, performance?.overallStats?.accuracy || 0))}%`,
      hint: "Projected from recent trend",
      icon: FaChartLine,
      tone: "from-violet-500 to-indigo-600",
    },
    {
      key: "fatigue",
      label: "Fatigue Risk",
      value: `${Math.round(getSafeNumber(rawAnalyticsModels?.fatigueIndex?.current, 0) * 100)}%`,
      hint: rawAnalyticsModels?.fatigueIndex?.trend || "Fatigue trend",
      icon: FiAlertCircle,
      tone: "from-red-500 to-orange-600",
    },
  ];

  const backendModelDocs = [
    {
      id: 1,
      name: "Concept Mastery Update",
      formula: "EMA / BKT: M_new = M_old + α × (signal − M_old)",
      training: "Topic concept history + recent accuracy windows",
      technology: "Node.js analytics pipeline + MongoDB history",
    },
    {
      id: 2,
      name: "Stability Index",
      formula: "Stability = 1 − (weighted variance / 0.25) ± trend boost",
      training: "Last ~10-15 mastery points per topic",
      technology: "Weighted variance + linear trend in JS",
    },
    {
      id: 3,
      name: "Confidence Calibration",
      formula: "Calibration error by difficulty buckets (lower is better)",
      training: "Confidence + correctness grouped by easy/medium/hard",
      technology: "Rule/statistical calibration mapping",
    },
    {
      id: 4,
      name: "Error Pattern Classification",
      formula:
        "Pattern weights from mastery tiers (conceptual/careless/guess/overconfidence)",
      training: "Topic accuracy bands + attempt density",
      technology: "Heuristic classifier in StudentPerformance model",
    },
    {
      id: 5,
      name: "Weakness Severity Ranking",
      formula:
        "score = (1−mastery)×weightage×errorRate×retentionDecay×(1+instability)",
      training: "Topic mastery, recency, exam weight, stability",
      technology: "Priority ranking and recommendation engine",
    },
    {
      id: 6,
      name: "Forgetting Curve",
      formula: "Ebbinghaus: R = mastery × exp(−k × daysSince)",
      training: "Last practiced date + mastery per topic",
      technology: "Exponential decay retention model",
    },
    {
      id: 7,
      name: "Fatigue Sensitivity",
      formula: "Fatigue ≈ weighted inverse-accuracy trend over recent sessions",
      training: "Recent test history and performance drift",
      technology: "Trend model + fatigue rules",
    },
    {
      id: 8,
      name: "Cognitive Behavior Profile",
      formula: "Cluster by speed, answer-change frequency, hard-question rate",
      training: "Behavior metrics aggregated from sessions",
      technology: "Profile clustering (impulsive/overthinker/balanced etc.)",
    },
    {
      id: 9,
      name: "Difficulty Tolerance",
      formula: "Accuracy by difficulty bins ⇒ max sustainable difficulty",
      training: "Performance split by easy/medium/hard/very hard",
      technology: "Tolerance estimator + recommendation logic",
    },
    {
      id: 10,
      name: "Study Efficiency",
      formula: "improvementPerHour = Δaccuracy / studyTime",
      training: "Recent tests with time + accuracy progression",
      technology: "Temporal efficiency scoring model",
    },
    {
      id: 11,
      name: "Focus Loss Detection",
      formula: "Frequency from rapid/low-quality responses + trigger patterns",
      training: "Response-quality proxies and behavior shifts",
      technology: "Signal detection + trigger tracking",
    },
    {
      id: 12,
      name: "Adaptive Time Allocation",
      formula: "Minutes allocated by weakness score, mastery gap, and priority",
      training: "Weakness ranking + retention + behavior profile",
      technology: "Adaptive scheduler outputs actionable study plan",
    },
  ];

  const lstmPipelineSummary = [
    "TensorFlow/Keras LSTM models in Python for practice difficulty, exam difficulty, learning velocity, and burnout risk",
    "Sequence modeling with MinMax scaling, early stopping, LR decay, and model checkpoints",
    "Training service retrains asynchronously from engineered features and stores model metadata per student",
  ];

  const modelCardsWithExamples = backendModelDocs.map((model) => {
    const defaultInput = `accuracy=${modelSampleContext.sampleAccuracy}%, difficulty=${Math.round(modelSampleContext.sampleDifficulty * 100)}%, streak=${modelSampleContext.sampleStreak}`;
    if (model.id === 1) {
      const newMastery = Math.round(
        (0.6 + 0.3 * (modelSampleContext.sampleAccuracy / 100 - 0.6)) * 100,
      );
      return {
        ...model,
        sampleInput: "oldMastery=0.60, recentAccuracy=0.74, α=0.30",
        sampleOutput: `newMastery≈${newMastery}%`,
        howItWorks: [
          "Reads latest concept-level attempt data",
          "Applies EMA/BKT-style update to smooth noise",
          "Stores updated mastery score for next recommendation cycle",
        ],
      };
    }
    if (model.id === 5) {
      const score = Math.round(0.45 * 0.9 * 0.45 * 0.5 * 100 * 100) / 100;
      return {
        ...model,
        sampleInput: "mastery=0.55, weight=0.90, errorRate=0.45, decay=0.50",
        sampleOutput: `weaknessScore≈${score}`,
        howItWorks: [
          "Builds urgency from mastery gap + exam weight",
          "Boosts stale topics using retention decay",
          "Ranks top topics into immediate priority queue",
        ],
      };
    }
    if (model.id === 7) {
      return {
        ...model,
        sampleInput: "recentSessionAccuracy=[78, 74, 71, 68]",
        sampleOutput: `fatigueRisk≈${modelSampleContext.sampleFatigue}%`,
        howItWorks: [
          "Converts recent sessions into inverse-accuracy fatigue scores",
          "Uses weighted trend to detect worsening or recovery",
          "Generates break/session-length recommendations",
        ],
      };
    }
    if (model.id === 10) {
      return {
        ...model,
        sampleInput: "Δaccuracy=+8%, studyTime=2.5 hours",
        sampleOutput: `efficiency≈${modelSampleContext.sampleEfficiency}%`,
        howItWorks: [
          "Computes improvement per hour from recent blocks",
          "Normalizes by time spent and consistency",
          "Maps score to low/medium/high efficiency band",
        ],
      };
    }
    return {
      ...model,
      sampleInput: defaultInput,
      sampleOutput: "Output score/rank generated for dashboard decisions",
      howItWorks: [
        "Collects topic + session-level engineered features",
        "Applies model formula/rules over normalized inputs",
        "Publishes output to recommendations and adaptive planning",
      ],
    };
  });

  // Navigation functions
  const goToPractice = () => navigate("/test/practice");
  const goToRealExam = () => navigate("/test/real");
  const goToTestDetails = (sessionId) => navigate(`/test/results/${sessionId}`);

  // Sidebar Menu Items
  const sidebarItems = [
    { id: "dashboard", label: "Dashboard", icon: FiHome, badge: null },
    {
      id: "my-courses",
      label: "My Courses",
      icon: FiBook,
      badge: enrolledCourses.length,
    },
    {
      id: "learning-modes",
      label: "Learning Modes",
      icon: FiZap,
      badge: null,
    },
    { id: "explore", label: "Explore Courses", icon: FiCompass, badge: null },
    {
      id: "learning",
      label: "Continue Learning",
      icon: FiPlay,
      badge: null,
      disabled: enrolledCourses.length === 0,
    },
    {
      id: "performance",
      label: "My Performance",
      icon: FiTrendingUp,
      badge: null,
    },
    { id: "progress", label: "My Progress", icon: FiBarChart2, badge: null },
    { id: "achievements", label: "Achievements", icon: FiAward, badge: null },
    {
      id: "certificates",
      label: "Certificates",
      icon: FaCertificate,
      badge: coursePerformance.certificatesEarned || 0,
    },
    { id: "information", label: "Information", icon: FiInfo, badge: null },
  ];

  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  const stagger = {
    animate: { transition: { staggerChildren: 0.05 } },
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-950">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-indigo-200 border-t-indigo-600 mx-auto"></div>
            <FaBrain className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-indigo-600 animate-pulse" />
          </div>
          <p className="mt-6 text-lg text-gray-600 dark:text-gray-400">
            Loading your learning dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-950">
      {/* Dynamic Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-950 -z-10" />
      <div className="fixed inset-0 overflow-hidden -z-5">
        <div className="absolute top-20 left-10 w-72 h-72 bg-indigo-200/30 dark:bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-80 h-80 bg-purple-200/30 dark:bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-200/20 dark:bg-blue-500/5 rounded-full blur-3xl animate-pulse delay-2000" />
      </div>

      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-40 backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 border-b border-indigo-100 dark:border-indigo-900/30">
        <div className="flex items-center justify-between px-4 h-16">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="p-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
          >
            <FiMenu className="w-6 h-6 text-gray-700 dark:text-gray-300" />
          </button>
          <div className="flex items-center space-x-2">
            <FaBrain className="w-6 h-6 text-indigo-600" />
            <span className="font-bold text-gray-900 dark:text-white">
              StudyStream
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
            >
              {isDark ? (
                <FiSun className="w-5 h-5" />
              ) : (
                <FiMoon className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={handleRefresh}
              className="p-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
            >
              <FiRefreshCw
                className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", damping: 25 }}
              className="fixed top-0 left-0 bottom-0 w-72 bg-white dark:bg-gray-800 shadow-2xl z-50 lg:hidden overflow-y-auto"
            >
              <SidebarContent
                user={user}
                activeTab={activeTab}
                setActiveTab={(tab) => {
                  setActiveTab(tab);
                  setMobileSidebarOpen(false);
                }}
                sidebarItems={sidebarItems}
                enrolledCourses={enrolledCourses}
                handleLogout={handleLogout}
                isDark={isDark}
                toggleTheme={toggleTheme}
                handleRefresh={handleRefresh}
                refreshing={refreshing}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Layout */}
      <div className="flex">
        {/* Desktop Sidebar */}
        <aside
          className={`hidden lg:block ${sidebarCollapsed ? "w-20" : "w-72"} transition-all duration-300 min-h-screen sticky top-0`}
        >
          <SidebarContent
            user={user}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            sidebarItems={sidebarItems}
            enrolledCourses={enrolledCourses}
            handleLogout={handleLogout}
            isDark={isDark}
            toggleTheme={toggleTheme}
            handleRefresh={handleRefresh}
            refreshing={refreshing}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto">
          {/* Success/Error Messages */}
          <AnimatePresence>
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-4 flex items-center gap-3"
              >
                <FiCheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                <p className="text-sm text-green-700 dark:text-green-300">
                  {success}
                </p>
              </motion.div>
            )}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 flex items-center gap-3"
              >
                <FiAlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700 dark:text-red-300">
                  {error}
                </p>
                <button onClick={() => setError(null)} className="ml-auto">
                  <FiX className="w-5 h-5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Welcome Banner */}
          <AnimatePresence>
            {showWelcome && student && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mb-8"
              >
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32" />
                  <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-24 -translate-x-24" />
                  <div className="relative z-10 flex items-start justify-between">
                    <div>
                      <h2 className="text-2xl font-bold mb-2">
                        Welcome back, {student?.name || "Student"}! 👋
                      </h2>
                      <p className="text-indigo-100 mb-4">
                        {performance?.overallStats?.lastActive
                          ? `Last active ${formatDate(performance.overallStats.lastActive)}`
                          : "Ready to continue your learning journey?"}
                      </p>
                      <div className="flex space-x-3">
                        <button
                          onClick={goToPractice}
                          className="px-4 py-2 bg-white text-indigo-600 rounded-xl font-medium hover:bg-opacity-90 transition-colors"
                        >
                          Start Practice
                        </button>
                        <button
                          onClick={goToRealExam}
                          className="px-4 py-2 bg-white/20 text-white rounded-xl font-medium hover:bg-white/30 transition-colors"
                        >
                          Take Exam
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowWelcome(false)}
                      className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    >
                      <FiX className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Content based on active tab */}
          <AnimatePresence mode="wait">
            {activeTab === "dashboard" && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                {/* Quick Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    {
                      icon: FiBook,
                      label: "Active Courses",
                      value: coursePerformance.activeCourses || 0,
                      color: "from-blue-500 to-indigo-600",
                    },
                    {
                      icon: FiCheckCircle,
                      label: "Completed",
                      value: coursePerformance.completedCourses || 0,
                      color: "from-green-500 to-emerald-600",
                    },
                    {
                      icon: FiTarget,
                      label: "Avg Progress",
                      value: `${coursePerformance.averageProgress || 0}%`,
                      color: "from-orange-500 to-red-600",
                    },
                    {
                      icon: FaFire,
                      label: "Longest Streak",
                      value: `${longestStreak} days`,
                      color: "from-purple-500 to-pink-600",
                    },
                  ].map((stat, idx) => {
                    const Icon = stat.icon;
                    return (
                      <div
                        key={idx}
                        className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-indigo-100 dark:border-indigo-900 shadow-sm"
                      >
                        <div
                          className={`p-2 rounded-xl bg-gradient-to-br ${stat.color} w-fit mb-3`}
                        >
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {stat.value}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {stat.label}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Deep Performance Metrics */}
                <motion.div
                  variants={stagger}
                  initial="initial"
                  animate="animate"
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
                >
                  {performanceCards.map((card) => {
                    const IconComp = card.icon;
                    return (
                      <motion.div
                        key={card.key}
                        variants={fadeInUp}
                        className="bg-white dark:bg-gray-800 rounded-2xl border border-indigo-100 dark:border-indigo-900 p-4 shadow-sm"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div
                            className={`p-2.5 rounded-xl bg-gradient-to-br ${card.tone}`}
                          >
                            <IconComp className="w-4 h-4 text-white" />
                          </div>
                          <span className="text-[11px] px-2 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300">
                            Metric
                          </span>
                        </div>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">
                          {card.value}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {card.label}
                        </p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2">
                          {card.hint}
                        </p>
                      </motion.div>
                    );
                  })}
                </motion.div>

                {/* Daily Streak Manager + Trends */}
                <motion.div
                  variants={fadeInUp}
                  initial="initial"
                  animate="animate"
                  className="grid grid-cols-1 xl:grid-cols-3 gap-6"
                >
                  <div className="xl:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-indigo-100 dark:border-indigo-900">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                          <FiCalendar className="w-5 h-5 mr-2 text-indigo-600" />
                          Daily Streak Manager
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Last 14 days activity, momentum, and consistency
                          tracking
                        </p>
                      </div>
                      <div
                        className="text-right"
                        title="Streak completion = (current streak / 14-day target) × 100"
                      >
                        <p className="text-2xl font-bold text-indigo-600">
                          {streakCompletion}%
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          14-day streak target
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-7 gap-2 mb-4">
                      {streakHeatmap.map((day) => (
                        <div
                          key={day.key}
                          className="rounded-xl border border-indigo-100 dark:border-indigo-900/50 p-2 text-center"
                          style={{
                            backgroundColor:
                              day.attempts > 0
                                ? `rgba(79, 70, 229, ${0.12 + day.intensity * 0.45})`
                                : undefined,
                          }}
                          title={`${day.label} ${day.day}: ${day.attempts} session(s), ${day.avgAccuracy}% avg accuracy`}
                        >
                          <p className="text-[10px] text-gray-500 dark:text-gray-400">
                            {day.label}
                          </p>
                          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                            {day.day}
                          </p>
                          <p className="text-[10px] text-gray-600 dark:text-gray-300">
                            {day.attempts > 0 ? `${day.attempts}x` : "-"}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div
                        className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/30"
                        title="Current streak computed from consecutive active days"
                      >
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Current Streak
                        </p>
                        <p className="text-xl font-bold text-indigo-700 dark:text-indigo-300">
                          {currentStreak} days
                        </p>
                      </div>
                      <div
                        className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20"
                        title="Longest streak observed from profile and timeline data"
                      >
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Best Streak
                        </p>
                        <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                          {longestStreak} days
                        </p>
                      </div>
                      <div
                        className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20"
                        title="Number of active days in the last 14 days"
                      >
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Active Days (14d)
                        </p>
                        <p className="text-xl font-bold text-amber-700 dark:text-amber-300">
                          {streakHeatmap.filter((d) => d.attempts > 0).length}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-indigo-100 dark:border-indigo-900">
                    <h4 className="text-base font-semibold text-gray-900 dark:text-white flex items-center mb-4">
                      <FiTrendingUp className="w-5 h-5 mr-2 text-indigo-600" />
                      Momentum Graphs
                    </h4>
                    <div
                      className="mb-5"
                      title="Line trend of your last 10 session accuracy values"
                    >
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                        Accuracy Trend (last 10 sessions)
                      </p>
                      {recentAccuracyTrend.length > 1 ? (
                        <svg viewBox="0 0 220 70" className="w-full h-20">
                          <path
                            d={buildSparklinePath(recentAccuracyTrend, 220, 70)}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            className="text-indigo-600"
                          />
                        </svg>
                      ) : (
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          More sessions are needed to draw the trend graph.
                        </p>
                      )}
                    </div>
                    <div title="Fatigue readiness is derived from fatigue sensitivity model outputs">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                        Readiness vs Fatigue
                      </p>
                      {fatigueTrendPoints.length > 0 ? (
                        <div className="flex items-end gap-1 h-20">
                          {fatigueTrendPoints.slice(-12).map((value, idx) => (
                            <div
                              key={`fatigue-${idx}`}
                              className="flex-1 rounded-t-md bg-gradient-to-t from-purple-500 to-indigo-500"
                              style={{ height: `${Math.max(6, value)}%` }}
                              title={`Session ${idx + 1}: readiness ${value}%`}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          Fatigue graph will appear after more attempts.
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>

                {/* Subject-wise Performance Table */}
                <motion.div
                  variants={fadeInUp}
                  initial="initial"
                  animate="animate"
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-indigo-100 dark:border-indigo-900"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                      <FiBarChart2 className="w-5 h-5 mr-2 text-indigo-600" />
                      Subject-wise Performance Metrics
                    </h3>
                    <span className="text-xs px-2 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300">
                      Deep View
                    </span>
                  </div>
                  {subjectRows.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left border-b border-indigo-100 dark:border-indigo-900/50">
                            <th className="py-2 pr-3 text-gray-500 dark:text-gray-400">
                              Subject
                            </th>
                            <th className="py-2 pr-3 text-gray-500 dark:text-gray-400">
                              Questions
                            </th>
                            <th className="py-2 pr-3 text-gray-500 dark:text-gray-400">
                              Accuracy
                            </th>
                            <th className="py-2 pr-3 text-gray-500 dark:text-gray-400">
                              Avg Difficulty
                            </th>
                            <th className="py-2 text-gray-500 dark:text-gray-400">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {subjectRows.map((row) => {
                            const accuracy = Math.round(
                              getSafeNumber(row.accuracy, 0),
                            );
                            return (
                              <tr
                                key={row.subject}
                                className="border-b border-gray-100 dark:border-gray-700/40 last:border-0"
                              >
                                <td className="py-3 pr-3 font-medium text-gray-900 dark:text-gray-100 capitalize">
                                  {row.subject.replace(/_/g, " ")}
                                </td>
                                <td className="py-3 pr-3 text-gray-700 dark:text-gray-300">
                                  {row.questions}
                                </td>
                                <td className="py-3 pr-3">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-gray-800 dark:text-gray-200">
                                      {accuracy}%
                                    </span>
                                    <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                      <div
                                        className={`h-1.5 rounded-full ${getProgressColor(accuracy)}`}
                                        style={{
                                          width: `${Math.min(100, Math.max(0, accuracy))}%`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 pr-3 text-gray-700 dark:text-gray-300">
                                  {Math.round(
                                    getSafeNumber(row.avgDifficulty, 0.5) * 100,
                                  )}
                                  %
                                </td>
                                <td className="py-3">
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs font-medium ${accuracy >= 75 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : accuracy >= 55 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"}`}
                                  >
                                    {accuracy >= 75
                                      ? "Strong"
                                      : accuracy >= 55
                                        ? "Improving"
                                        : "Needs Focus"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Subject-level metrics will appear once enough attempts are
                      recorded.
                    </p>
                  )}
                </motion.div>

                {/* Quick Actions */}
                <motion.div
                  variants={stagger}
                  initial="initial"
                  animate="animate"
                  className="grid grid-cols-1 md:grid-cols-2 gap-6"
                >
                  <motion.div
                    variants={fadeInUp}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-xl"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-3 bg-white/20 rounded-xl">
                        <FaBrain className="w-8 h-8" />
                      </div>
                      <span className="px-3 py-1 bg-white/20 rounded-full text-sm">
                        Practice Mode
                      </span>
                    </div>
                    <h3 className="text-xl font-bold mb-2">
                      Adaptive Practice
                    </h3>
                    <p className="text-indigo-100 mb-6">
                      Questions adapt to your skill level in real-time. Get
                      instant feedback and explanations.
                    </p>
                    <div className="grid grid-cols-2 gap-3 mb-6">
                      <div className="bg-white/10 rounded-lg p-3">
                        <FiZap className="w-5 h-5 mb-2" />
                        <p className="text-sm font-semibold">Adaptive</p>
                        <p className="text-xs opacity-80">
                          Difficulty adjusts to you
                        </p>
                      </div>
                      <div className="bg-white/10 rounded-lg p-3">
                        <FiActivity className="w-5 h-5 mb-2" />
                        <p className="text-sm font-semibold">Real-time</p>
                        <p className="text-xs opacity-80">Live analytics</p>
                      </div>
                    </div>
                    <button
                      onClick={goToPractice}
                      className="w-full py-3 bg-white text-indigo-600 rounded-xl font-semibold hover:bg-opacity-90 transition-all flex items-center justify-center space-x-2"
                    >
                      <span>Start Practice</span>
                      <FiChevronRight className="w-5 h-5" />
                    </button>
                  </motion.div>
                  <motion.div
                    variants={fadeInUp}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-6 text-white shadow-xl"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-3 bg-white/20 rounded-xl">
                        <FaRocket className="w-8 h-8" />
                      </div>
                      <span className="px-3 py-1 bg-white/20 rounded-full text-sm">
                        Exam Mode
                      </span>
                    </div>
                    <h3 className="text-xl font-bold mb-2">
                      Real Exam Simulation
                    </h3>
                    <p className="text-purple-100 mb-6">
                      Test your knowledge with timed exams. 100 questions, 60
                      minutes, detailed analysis.
                    </p>
                    <div className="grid grid-cols-2 gap-3 mb-6">
                      <div className="bg-white/10 rounded-lg p-3">
                        <FiClock className="w-5 h-5 mb-2" />
                        <p className="text-sm font-semibold">60 min</p>
                        <p className="text-xs opacity-80">Timed exam</p>
                      </div>
                      <div className="bg-white/10 rounded-lg p-3">
                        <FiBarChart2 className="w-5 h-5 mb-2" />
                        <p className="text-sm font-semibold">100 Qs</p>
                        <p className="text-xs opacity-80">25 per subject</p>
                      </div>
                    </div>
                    <button
                      onClick={goToRealExam}
                      className="w-full py-3 bg-white text-purple-600 rounded-xl font-semibold hover:bg-opacity-90 transition-all flex items-center justify-center space-x-2"
                    >
                      <span>Start Exam</span>
                      <FiChevronRight className="w-5 h-5" />
                    </button>
                  </motion.div>
                </motion.div>

                {/* Analytics Dashboard */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <motion.div
                    variants={fadeInUp}
                    initial="initial"
                    animate="animate"
                    className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-indigo-100 dark:border-indigo-900"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                          <FiPieChart className="w-5 h-5 mr-2 text-indigo-600" />
                          Concept Mastery
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Your proficiency across different topics
                        </p>
                      </div>
                      <select
                        value={selectedPeriod}
                        onChange={(e) => setSelectedPeriod(e.target.value)}
                        className="px-3 py-2 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-lg text-sm text-gray-700 dark:text-gray-300"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    {analytics?.charts?.conceptMastery &&
                    analytics.charts.conceptMastery.length > 0 ? (
                      <div className="space-y-4">
                        {analytics.charts.conceptMastery
                          .slice(0, 8)
                          .map((item, index) => (
                            <div key={index} className="flex items-center">
                              <div className="w-32 truncate text-sm text-gray-700 dark:text-gray-300">
                                {item.topic}
                              </div>
                              <div className="flex-1 mx-4">
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full ${getProgressColor(item.mastery * 100)}`}
                                    style={{ width: `${item.mastery * 100}%` }}
                                  />
                                </div>
                              </div>
                              <div
                                className={`text-sm font-medium ${getMasteryColor(item.mastery)}`}
                              >
                                {Math.round(item.mastery * 100)}%
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <FiPieChart className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-500 dark:text-gray-400">
                          No concept mastery data yet
                        </p>
                        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                          Start practicing to see your progress
                        </p>
                      </div>
                    )}
                  </motion.div>
                  <motion.div
                    variants={fadeInUp}
                    initial="initial"
                    animate="animate"
                    className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-indigo-100 dark:border-indigo-900"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                        <FiTarget className="w-5 h-5 mr-2 text-red-500" />
                        Priority Areas
                      </h3>
                      <span
                        className="text-xs px-2 py-1 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300"
                        title="Urgency is derived from weakness severity ranking and retention decay"
                      >
                        Ranked by urgency
                      </span>
                    </div>
                    {weaknessPriorityDetailed.length > 0 ? (
                      <div className="space-y-4">
                        {weaknessPriorityDetailed.slice(0, 5).map((area) => (
                          <div
                            key={`${area.topic}-${area.rank}`}
                            className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start space-x-3">
                                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                                  <span className="text-xs font-bold text-red-600">
                                    #{area.rank}
                                  </span>
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                    {area.topic}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                                    {area.subject} • {area.minutes} mins planned
                                  </p>
                                </div>
                              </div>
                              <div
                                className="text-right"
                                title="Formula: urgency = (1-mastery) × weight × errorRate × retentionDecay"
                              >
                                <p className="text-sm font-bold text-red-600">
                                  {area.urgency}%
                                </p>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                                  urgency
                                </p>
                              </div>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                              <div
                                className="p-2 rounded-lg bg-white/70 dark:bg-gray-900/30"
                                title="Current estimated mastery for this area"
                              >
                                <p className="text-gray-500 dark:text-gray-400">
                                  Mastery
                                </p>
                                <p className="font-semibold text-gray-800 dark:text-gray-100">
                                  {area.mastery}%
                                </p>
                              </div>
                              <div
                                className="p-2 rounded-lg bg-white/70 dark:bg-gray-900/30"
                                title="Days since topic was actively practiced"
                              >
                                <p className="text-gray-500 dark:text-gray-400">
                                  Last Practice
                                </p>
                                <p className="font-semibold text-gray-800 dark:text-gray-100">
                                  {area.daysSince} days ago
                                </p>
                              </div>
                            </div>
                            <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div
                                className="h-2 rounded-full bg-gradient-to-r from-red-500 to-orange-500"
                                style={{
                                  width: `${Math.max(8, area.urgency)}%`,
                                }}
                              />
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-300 mt-2">
                              {area.recommendation}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : analytics?.recommendations?.immediate &&
                      analytics.recommendations.immediate.length > 0 ? (
                      <div className="space-y-4">
                        {analytics.recommendations.immediate
                          .slice(0, 5)
                          .map((rec, index) => (
                            <div
                              key={index}
                              className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800"
                            >
                              <div className="flex items-start space-x-3">
                                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                                  <FiAlertCircle className="w-4 h-4 text-red-600" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                                    {rec.split(":")[0]}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {rec.split(":")[1] || rec}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <FiTarget className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-500 dark:text-gray-400">
                          No priority areas yet
                        </p>
                        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                          Keep practicing to identify weak areas
                        </p>
                      </div>
                    )}
                    {analytics?.recommendations?.studyPlan &&
                      analytics.recommendations.studyPlan.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-indigo-100 dark:border-indigo-900">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                            Today's Study Plan
                          </h4>
                          <div className="space-y-3">
                            {analytics.recommendations.studyPlan
                              .slice(0, 3)
                              .map((plan, index) => (
                                <div
                                  key={index}
                                  className="flex items-center space-x-3"
                                >
                                  <div
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${plan.priority === "high" ? "bg-red-100 text-red-600" : plan.priority === "medium" ? "bg-yellow-100 text-yellow-600" : "bg-green-100 text-green-600"}`}
                                  >
                                    {plan.order}
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                      {plan.concept}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      {plan.suggestedDuration} min •{" "}
                                      {plan.focus}
                                    </p>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                  </motion.div>
                </div>

                {/* Learning Path & Recent Tests */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <motion.div
                    variants={fadeInUp}
                    initial="initial"
                    animate="animate"
                    className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-indigo-100 dark:border-indigo-900"
                  >
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                      <FiMap className="w-5 h-5 mr-2 text-green-500" />
                      Your Learning Path
                    </h3>
                    {learningPath ? (
                      <div className="space-y-6">
                        <div className="text-center">
                          <div className="inline-block p-4 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl mb-3">
                            <FaGraduationCap className="w-8 h-8 text-white" />
                          </div>
                          <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-1 capitalize">
                            {learningPath.currentLevel}
                          </h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Current Level
                          </p>
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-600 dark:text-gray-400">
                              Progress
                            </span>
                            <span className="font-medium text-indigo-600">
                              {Math.round(learningPath.levelProgress || 0)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                            <div
                              className="h-3 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600"
                              style={{
                                width: `${learningPath.levelProgress || 0}%`,
                              }}
                            />
                          </div>
                        </div>
                        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                          <p className="text-xs text-indigo-600 dark:text-indigo-400 mb-1">
                            Next Level
                          </p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2 capitalize">
                            {learningPath.nextLevel}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Requirements:{" "}
                            {learningPath.requirementsForNext?.accuracy},{" "}
                            {learningPath.requirementsForNext?.questions}
                          </p>
                        </div>
                        {learningPath.focusTopics &&
                          learningPath.focusTopics.length > 0 && (
                            <div>
                              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Focus on:
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {learningPath.focusTopics.map(
                                  (topic, index) => (
                                    <span
                                      key={index}
                                      className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-full text-xs"
                                    >
                                      {topic}
                                    </span>
                                  ),
                                )}
                              </div>
                            </div>
                          )}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <FiMap className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-500 dark:text-gray-400">
                          No learning path yet
                        </p>
                        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                          Take more tests to generate your path
                        </p>
                      </div>
                    )}
                  </motion.div>
                  <motion.div
                    variants={fadeInUp}
                    initial="initial"
                    animate="animate"
                    className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-indigo-100 dark:border-indigo-900"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                          <FiClock className="w-5 h-5 mr-2 text-indigo-600" />
                          Recent Activity
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Your latest practice sessions and exams
                        </p>
                      </div>
                      <button
                        onClick={() => navigate("/test/history")}
                        className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center"
                      >
                        View All
                        <FiChevronRight className="w-4 h-4 ml-1" />
                      </button>
                    </div>
                    {recentTests.length > 0 ? (
                      <div className="space-y-4">
                        {recentTests.map((test, index) => (
                          <motion.div
                            key={test.sessionId}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="flex items-center justify-between p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl hover:shadow-md transition-all cursor-pointer"
                            onClick={() => goToTestDetails(test.sessionId)}
                          >
                            <div className="flex items-center space-x-4">
                              <div
                                className={`p-3 rounded-xl ${test.testType === "practice" ? "bg-blue-100 dark:bg-blue-900/30" : "bg-purple-100 dark:bg-purple-900/30"}`}
                              >
                                {test.testType === "practice" ? (
                                  <FaBrain className="w-5 h-5 text-blue-600" />
                                ) : (
                                  <FaRocket className="w-5 h-5 text-purple-600" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">
                                  {test.testConfig?.title || "Practice Session"}
                                </p>
                                <div className="flex items-center space-x-3 mt-1">
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {formatDate(test.endTime || test.startTime)}
                                  </span>
                                  <span className="text-xs px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-full">
                                    {test.summary?.totalQuestions ||
                                      test.totalQuestions ||
                                      0}{" "}
                                    Qs
                                  </span>
                                  {test.trend && (
                                    <span
                                      className={`text-xs flex items-center ${test.trend === "up" ? "text-green-600" : test.trend === "down" ? "text-red-600" : "text-gray-500"}`}
                                    >
                                      {test.trend === "up" && "↑"}
                                      {test.trend === "down" && "↓"}
                                      {test.trend === "stable" && "→"}
                                      {test.change && ` ${test.change}%`}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xl font-bold text-indigo-600">
                                {Math.round(
                                  test.summary?.accuracy || test.accuracy || 0,
                                )}
                                %
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Accuracy
                              </p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <FiClock className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-500 dark:text-gray-400">
                          No recent activity
                        </p>
                        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                          Start practicing to see your activity
                        </p>
                        <button
                          onClick={goToPractice}
                          className="mt-4 px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium"
                        >
                          Start Now
                        </button>
                      </div>
                    )}
                  </motion.div>
                </div>
              </motion.div>
            )}

            {activeTab === "my-courses" && (
              <MyCoursesView
                key="my-courses"
                enrolledCourses={enrolledCourses}
                handleStartLearning={handleStartLearning}
                formatDate={formatDate}
                getProgressColor={getProgressColor}
              />
            )}

            {activeTab === "explore" && (
              <ExploreCoursesView
                key="explore"
                allCourses={filteredCourses}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                filterLevel={filterLevel}
                setFilterLevel={setFilterLevel}
                filterCategory={filterCategory}
                setFilterCategory={setFilterCategory}
                viewMode={viewMode}
                setViewMode={setViewMode}
                isEnrolled={isEnrolled}
                enrollingCourseId={enrollingCourseId}
                handleEnroll={handleEnroll}
                handleStartLearning={handleStartLearning}
                enrolledCourses={enrolledCourses}
              />
            )}

            {/* {activeTab === "learning" && (
              <LearningView
                key="learning"
                selectedCourse={selectedCourse}
                courseCurriculum={courseCurriculum}
                courseProgress={courseProgress}
                activeLesson={activeLesson}
                setActiveLesson={setActiveLesson}
                learningContent={learningContent}
                timeSpent={timeSpent}
                formatTime={formatTime}
                handleCompleteLesson={handleCompleteLesson}
                getProgressColor={getProgressColor}
              />
            )} */}

            {activeTab === "performance" && (
              <PerformanceView
                key="performance"
                performance={coursePerformance}
                studentStats={studentStats}
                enrolledCourses={enrolledCourses}
                formatDate={formatDate}
                getProgressColor={getProgressColor}
              />
            )}
            {activeTab === "learning-modes" && (
              <LearningModesView key="learning-modes" />
            )}
            {activeTab === "progress" && (
              <ProgressView
                key="progress"
                enrolledCourses={enrolledCourses}
                formatDate={formatDate}
                getProgressColor={getProgressColor}
              />
            )}

            {activeTab === "achievements" && (
              <AchievementsView
                key="achievements"
                performance={coursePerformance}
                enrolledCourses={enrolledCourses}
                currentStreak={currentStreak}
                longestStreak={longestStreak}
              />
            )}

            {activeTab === "certificates" && (
              <CertificatesView
                key="certificates"
                enrolledCourses={enrolledCourses}
                formatDate={formatDate}
              />
            )}

            {activeTab === "information" && (
              <BackendInfoView
                key="information"
                modelSampleContext={modelSampleContext}
                recommendedDifficulty={recommendedDifficulty}
                modelCardsWithExamples={modelCardsWithExamples}
                lstmPipelineSummary={lstmPipelineSummary}
                fadeInUp={fadeInUp}
              />
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-8 right-8 flex flex-col space-y-3">
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.1 }}
          onClick={goToPractice}
          className="p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full shadow-2xl hover:shadow-xl transition-all"
        >
          <FiZap className="w-6 h-6" />
        </motion.button>
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1 }}
          whileHover={{ scale: 1.1 }}
          onClick={() => window.open("/help", "_blank")}
          className="p-4 bg-gray-600 text-white rounded-full shadow-2xl hover:shadow-xl transition-all"
        >
          <FiHelpCircle className="w-6 h-6" />
        </motion.button>
      </div>
    </div>
  );
};

// Sidebar Component
const SidebarContent = ({
  user,
  activeTab,
  setActiveTab,
  sidebarItems,
  enrolledCourses,
  handleLogout,
  isDark,
  toggleTheme,
  handleRefresh,
  refreshing,
  collapsed,
  onToggleCollapse,
}) => {
  return (
    <div className="h-full bg-white dark:bg-gray-800 border-r border-indigo-100 dark:border-indigo-900/30 flex flex-col">
      <div className="p-6 border-b border-indigo-100 dark:border-indigo-900/30">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl">
                <FaBrain className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                StudyStream
              </span>
            </div>
          )}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hidden lg:block"
            >
              {collapsed ? (
                <FiChevronRight className="w-5 h-5" />
              ) : (
                <FiChevronLeft className="w-5 h-5" />
              )}
            </button>
          )}
        </div>
      </div>
      {!collapsed && (
        <div className="p-4 border-b border-indigo-100 dark:border-indigo-900/30">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold">
              {user?.name?.charAt(0) || "S"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {user?.name || "Student"}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {user?.email || "student@email.com"}
              </p>
            </div>
          </div>
        </div>
      )}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {sidebarItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const isDisabled = item.disabled;
          return (
            <button
              key={item.id}
              onClick={() => !isDisabled && setActiveTab(item.id)}
              disabled={isDisabled}
              className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-all ${isActive ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm" : isDisabled ? "text-gray-300 dark:text-gray-600 cursor-not-allowed" : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50"}`}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left text-sm font-medium">
                    {item.label}
                  </span>
                  {item.badge !== null && item.badge > 0 && (
                    <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-medium">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </nav>
      <div className="p-4 border-t border-indigo-100 dark:border-indigo-900/30 space-y-2">
        {!collapsed && (
          <>
            <button
              onClick={toggleTheme}
              className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              {isDark ? (
                <FiSun className="w-5 h-5" />
              ) : (
                <FiMoon className="w-5 h-5" />
              )}
              <span className="text-sm">
                {isDark ? "Light Mode" : "Dark Mode"}
              </span>
            </button>
            <button
              onClick={handleRefresh}
              className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <FiRefreshCw
                className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`}
              />
              <span className="text-sm">Refresh</span>
            </button>
          </>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <FiLogOut className="w-5 h-5" />
          {!collapsed && <span className="text-sm">Logout</span>}
        </button>
      </div>
    </div>
  );
};

// My Courses View
const MyCoursesView = ({
  enrolledCourses,
  handleStartLearning,
  formatDate,
  getProgressColor,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
        My Courses
      </h2>
      {enrolledCourses.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center border border-indigo-100 dark:border-indigo-900">
          <FiBook className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No enrolled courses yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Explore available courses and start learning today!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {enrolledCourses.map((enrollment) => {
            const course = enrollment.course || enrollment;
            const progress = enrollment.progress?.overallProgress || 0;
            return (
              <div
                key={enrollment._id}
                className="bg-white dark:bg-gray-800 rounded-2xl border border-indigo-100 dark:border-indigo-900 shadow-sm overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="h-32 bg-gradient-to-br from-indigo-500 to-purple-600 relative">
                  {course.coverImage?.url && (
                    <img
                      src={course.coverImage.url}
                      alt={course.title}
                      className="w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute top-3 right-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${enrollment.enrollmentStatus === "active" ? "bg-green-500 text-white" : "bg-blue-500 text-white"}`}
                    >
                      {enrollment.enrollmentStatus}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    {course.title}
                  </h3>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 mb-2">
                    <div
                      className={`h-2 rounded-full ${getProgressColor(progress)}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-3">
                    <span>{progress}% complete</span>
                    <span>Enrolled {formatDate(enrollment.enrolledAt)}</span>
                  </div>

                  <button
                    onClick={() => handleStartLearning(course._id)}
                    className="w-full py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <FiPlay className="w-4 h-4" />
                    Continue Learning
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

// Explore Courses View
const ExploreCoursesView = ({
  allCourses,
  searchQuery,
  setSearchQuery,
  filterLevel,
  setFilterLevel,
  filterCategory,
  setFilterCategory,
  viewMode,
  setViewMode,
  isEnrolled,
  enrollingCourseId,
  handleEnroll,
  handleStartLearning,
  enrolledCourses,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
        Explore Courses
      </h2>
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-indigo-100 dark:border-indigo-900">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search courses..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">All Levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2.5 rounded-xl ${viewMode === "grid" ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" : "text-gray-400"}`}
            >
              <FiGrid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2.5 rounded-xl ${viewMode === "list" ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" : "text-gray-400"}`}
            >
              <FiList className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      {allCourses.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center border border-indigo-100 dark:border-indigo-900">
          <FiSearch className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            No courses found matching your criteria
          </p>
        </div>
      ) : (
        <div
          className={
            viewMode === "grid"
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              : "space-y-4"
          }
        >
          {allCourses.map((course) => {
            const enrolled = isEnrolled(course._id);
            return viewMode === "grid" ? (
              <div
                key={course._id}
                className="bg-white dark:bg-gray-800 rounded-2xl border border-indigo-100 dark:border-indigo-900 shadow-sm overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="h-40 bg-gradient-to-br from-indigo-500 to-purple-600 relative">
                  {course.coverImage?.url && (
                    <img
                      src={course.coverImage.url}
                      alt={course.title}
                      className="w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute top-3 left-3 flex gap-2">
                    <span className="px-2 py-1 bg-white/20 rounded-full text-xs text-white backdrop-blur-sm">
                      {course.level}
                    </span>
                    <span className="px-2 py-1 bg-white/20 rounded-full text-xs text-white backdrop-blur-sm">
                      {course.language}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    {course.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
                    {course.shortDescription || course.description}
                  </p>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-lg font-bold text-indigo-600">
                      ${course.discountPrice || course.price}
                    </span>
                    <span className="text-sm text-gray-500">
                      {course.totalStudents || 0} students
                    </span>
                  </div>
                  {enrolled ? (
                    <button
                      onClick={() => handleStartLearning(course._id)}
                      className="w-full py-2 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <FiPlay className="w-4 h-4" />
                      Continue Learning
                    </button>
                  ) : (
                    <button
                      onClick={() => handleEnroll(course._id)}
                      disabled={enrollingCourseId === course._id}
                      className="w-full py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {enrollingCourseId === course._id ? (
                        <FiLoader className="w-4 h-4 animate-spin" />
                      ) : (
                        <FiPlusCircle className="w-4 h-4" />
                      )}
                      Enroll Now
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div
                key={course._id}
                className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-indigo-100 dark:border-indigo-900 flex items-center gap-4"
              >
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex-shrink-0 flex items-center justify-center">
                  <FaGraduationCap className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {course.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {course.level} • {course.language}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-indigo-600">
                    ${course.discountPrice || course.price}
                  </p>
                  {enrolled ? (
                    <button
                      onClick={() => handleStartLearning(course._id)}
                      className="mt-1 px-3 py-1 bg-green-600 text-white rounded-lg text-sm"
                    >
                      Continue
                    </button>
                  ) : (
                    <button
                      onClick={() => handleEnroll(course._id)}
                      className="mt-1 px-3 py-1 bg-indigo-600 text-white rounded-lg text-sm"
                    >
                      Enroll
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};


// Performance View Component
const PerformanceView = ({
  performance,
  studentStats,
  enrolledCourses,
  formatDate,
  getProgressColor,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
        My Performance
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            icon: FiTarget,
            label: "Avg Quiz Score",
            value: `${performance.averageQuizScore || 0}%`,
            color: "from-blue-500 to-indigo-600",
          },
          {
            icon: FaFire,
            label: "Study Streak",
            value: `${performance.studyStreak || 0} days`,
            color: "from-orange-500 to-red-600",
          },
          {
            icon: FiClock,
            label: "Total Time",
            value: `${Math.round((performance.totalTimeSpent || 0) / 3600)}h`,
            color: "from-green-500 to-emerald-600",
          },
          {
            icon: FiBook,
            label: "Lessons Done",
            value: performance.totalLessonsCompleted || 0,
            color: "from-purple-500 to-pink-600",
          },
        ].map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-indigo-100 dark:border-indigo-900 shadow-sm"
            >
              <div
                className={`p-2 rounded-xl bg-gradient-to-br ${stat.color} w-fit mb-3`}
              >
                <Icon className="w-4 h-4 text-white" />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stat.value}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {stat.label}
              </p>
            </div>
          );
        })}
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-indigo-100 dark:border-indigo-900 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Course Progress Details
        </h3>
        <div className="space-y-4">
          {enrolledCourses.map((enrollment) => (
            <div
              key={enrollment._id}
              className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
            >
              <div className="flex justify-between mb-2">
                <h4 className="font-medium text-gray-900 dark:text-white">
                  {enrollment.course?.title || "Course"}
                </h4>
                <span className="text-sm font-medium text-indigo-600">
                  {enrollment.progress?.overallProgress || 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getProgressColor(enrollment.progress?.overallProgress || 0)}`}
                  style={{
                    width: `${enrollment.progress?.overallProgress || 0}%`,
                  }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
                <span>
                  {enrollment.progress?.completedLessons?.length || 0} lessons
                  completed
                </span>
                <span>
                  Quiz avg: {enrollment.learningMetrics?.averageQuizScore || 0}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

// Progress View Component
const ProgressView = ({ enrolledCourses, formatDate, getProgressColor }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
        My Progress
      </h2>
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-indigo-100 dark:border-indigo-900 shadow-sm">
        <div className="space-y-6">
          {enrolledCourses.map((enrollment) => (
            <div
              key={enrollment._id}
              className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">
                    {enrollment.course?.title || "Course"}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Enrolled: {formatDate(enrollment.enrolledAt)}
                  </p>
                </div>
                <span className="text-lg font-bold text-indigo-600">
                  {enrollment.progress?.overallProgress || 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3 mb-3">
                <div
                  className={`h-3 rounded-full transition-all duration-500 ${getProgressColor(enrollment.progress?.overallProgress || 0)}`}
                  style={{
                    width: `${enrollment.progress?.overallProgress || 0}%`,
                  }}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Lessons
                  </p>
                  <p className="font-bold text-gray-900 dark:text-white">
                    {enrollment.progress?.completedLessons?.length || 0}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Quiz Score
                  </p>
                  <p className="font-bold text-gray-900 dark:text-white">
                    {Math.round(
                      enrollment.learningMetrics?.averageQuizScore || 0,
                    )}
                    %
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Time Spent
                  </p>
                  <p className="font-bold text-gray-900 dark:text-white">
                    {Math.round(
                      (enrollment.learningMetrics?.totalTimeSpent || 0) / 3600,
                    )}
                    h
                  </p>
                </div>
              </div>
            </div>
          ))}
          {enrolledCourses.length === 0 && (
            <div className="text-center py-12">
              <FiBarChart2 className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                No progress data available yet
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// Achievements View Component
const AchievementsView = ({
  performance,
  enrolledCourses,
  currentStreak,
  longestStreak,
}) => {
  const achievements = [
    {
      id: 1,
      title: "First Steps",
      description: "Enroll in your first course",
      icon: FaGraduationCap,
      earned: enrolledCourses.length > 0,
      color: "from-blue-500 to-indigo-600",
    },
    {
      id: 2,
      title: "Quick Learner",
      description: "Complete 5 lessons",
      icon: FaBolt,
      earned: (performance.totalLessonsCompleted || 0) >= 5,
      color: "from-yellow-500 to-orange-600",
    },
    {
      id: 3,
      title: "Streak Master",
      description: "Maintain a 7-day study streak",
      icon: FaFire,
      earned: currentStreak >= 7,
      color: "from-red-500 to-pink-600",
    },
    {
      id: 4,
      title: "Quiz Whiz",
      description: "Score 100% on a quiz",
      icon: FaStarIcon,
      earned: performance.averageQuizScore >= 100,
      color: "from-purple-500 to-indigo-600",
    },
    {
      id: 5,
      title: "Halfway There",
      description: "Complete 50% of a course",
      icon: FiTarget,
      earned: enrolledCourses.some(
        (e) => (e.progress?.overallProgress || 0) >= 50,
      ),
      color: "from-green-500 to-emerald-600",
    },
    {
      id: 6,
      title: "Course Champion",
      description: "Complete an entire course",
      icon: FaTrophy,
      earned: enrolledCourses.some((e) => e.enrollmentStatus === "completed"),
      color: "from-amber-500 to-yellow-600",
    },
    {
      id: 7,
      title: "Knowledge Seeker",
      description: "Enroll in 3 courses",
      icon: FaBook,
      earned: enrolledCourses.length >= 3,
      color: "from-cyan-500 to-blue-600",
    },
    {
      id: 8,
      title: "Perfect Attendance",
      description: "Study for 30 consecutive days",
      icon: FaMedal,
      earned: longestStreak >= 30,
      color: "from-pink-500 to-rose-600",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
        Achievements
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {achievements.map((achievement) => {
          const Icon = achievement.icon;
          return (
            <div
              key={achievement.id}
              className={`bg-white dark:bg-gray-800 rounded-2xl p-6 border text-center transition-all ${achievement.earned ? "border-indigo-200 dark:border-indigo-800 shadow-md" : "border-gray-200 dark:border-gray-700 opacity-50"}`}
            >
              <div
                className={`inline-block p-3 rounded-xl bg-gradient-to-br ${achievement.color} mb-3`}
              >
                <Icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                {achievement.title}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                {achievement.description}
              </p>
              {achievement.earned ? (
                <span className="inline-flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                  <FiCheckCircle className="w-4 h-4" />
                  Earned
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-sm text-gray-400">
                  <FiClock className="w-4 h-4" />
                  Locked
                </span>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

// Certificates View Component
const CertificatesView = ({ enrolledCourses, formatDate }) => {
  const completedCourses = enrolledCourses.filter(
    (e) => e.enrollmentStatus === "completed",
  );
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
        My Certificates
      </h2>
      {completedCourses.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center border border-indigo-100 dark:border-indigo-900">
          <FaCertificate className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No certificates yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Complete a course to earn your certificate!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {completedCourses.map((enrollment) => (
            <div
              key={enrollment._id}
              className="bg-white dark:bg-gray-800 rounded-2xl border border-indigo-100 dark:border-indigo-900 p-6 text-center"
            >
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-amber-400 to-yellow-600 rounded-full flex items-center justify-center">
                <FaCertificate className="w-10 h-10 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                {enrollment.course?.title || "Course"}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Completed on{" "}
                {formatDate(enrollment.completedAt || enrollment.updatedAt)}
              </p>
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 mx-auto">
                <FiDownload className="w-4 h-4" />
                Download Certificate
              </button>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

// Backend Info View Component
const BackendInfoView = ({
  modelSampleContext,
  recommendedDifficulty,
  modelCardsWithExamples,
  lstmPipelineSummary,
  fadeInUp,
}) => {
  return (
    <motion.div
      variants={fadeInUp}
      initial="initial"
      animate="animate"
      className="mt-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-indigo-100 dark:border-indigo-900"
    >
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <FaBrain className="w-5 h-5 mr-2 text-indigo-600" />
            Backend Intelligence: 12 Student Models
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Formula, sample inputs, computed output, and operational flow
          </p>
        </div>
        <div
          className="px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-xs text-indigo-700 dark:text-indigo-300"
          title="This block combines Node analytics models and Flask LSTM prediction models"
        >
          Node analytics + Flask LSTM stack
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div
          className="p-4 rounded-xl border border-indigo-100 dark:border-indigo-900 bg-indigo-50/70 dark:bg-indigo-900/20"
          title="Input data consumed by most models"
        >
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Sample Input Snapshot
          </p>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Accuracy: {modelSampleContext.sampleAccuracy}%
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Avg Difficulty:{" "}
            {Math.round(modelSampleContext.sampleDifficulty * 100)}%
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Streak: {modelSampleContext.sampleStreak} days
          </p>
        </div>
        <div
          className="p-4 rounded-xl border border-emerald-100 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-900/20"
          title="Representative derived outputs driving recommendations"
        >
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Sample Output Snapshot
          </p>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Efficiency: {modelSampleContext.sampleEfficiency}%
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Fatigue Risk: {modelSampleContext.sampleFatigue}%
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Recommended Difficulty: {Math.round(recommendedDifficulty * 100)}%
          </p>
        </div>
        <div
          className="p-4 rounded-xl border border-purple-100 dark:border-purple-900 bg-purple-50/70 dark:bg-purple-900/20"
          title="How values move from raw activity to adaptive actions"
        >
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Working Flow
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Activity logs → Feature engineering → Model scoring → Priority +
            schedule actions
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {modelCardsWithExamples.map((model) => (
          <div
            key={model.id}
            className="p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/70 bg-gray-50 dark:bg-gray-900/30"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {model.id}. {model.name}
              </h4>
              <span
                className="text-xs text-indigo-600 dark:text-indigo-300"
                title={model.technology}
              >
                <FiInfo className="w-4 h-4" />
              </span>
            </div>
            <p
              className="text-xs text-gray-600 dark:text-gray-300 mb-2"
              title="Primary formula implemented for this model"
            >
              <span className="font-medium">Formula:</span> {model.formula}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-300 mb-1">
              <span className="font-medium">Sample Input:</span>{" "}
              {model.sampleInput}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
              <span className="font-medium">Sample Output:</span>{" "}
              {model.sampleOutput}
            </p>
            <div className="space-y-1">
              {model.howItWorks.map((step, index) => (
                <p
                  key={`${model.id}-step-${index}`}
                  className="text-[11px] text-gray-500 dark:text-gray-400"
                >
                  {index + 1}. {step}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/70 bg-indigo-50/60 dark:bg-indigo-900/20">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Python LSTM Training Pipeline
        </h4>
        <div className="space-y-1">
          {lstmPipelineSummary.map((line, idx) => (
            <p
              key={`lstm-pipeline-${idx}`}
              className="text-xs text-gray-600 dark:text-gray-300"
            >
              {idx + 1}. {line}
            </p>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
// Learning Modes View Component
const LearningModesView = () => {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="text-center mb-4">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Choose Your Learning Mode
        </h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
          Select from our intelligent learning modes designed to optimize your study experience
          through adaptive algorithms and scientifically-proven retention techniques.
        </p>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
        {/* Adaptive Learning Card */}
        <motion.div
          whileHover={{ scale: 1.02, y: -5 }}
          className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden border border-indigo-100 dark:border-indigo-900 cursor-pointer group"
          onClick={() => navigate("/test/practice")}
        >
          {/* Card Header with Gradient */}
          <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-20 translate-x-20 group-hover:scale-150 transition-transform duration-500" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full translate-y-16 -translate-x-16 group-hover:scale-150 transition-transform duration-500" />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                  <FaBrain className="w-8 h-8" />
                </div>
                <span className="px-3 py-1 bg-white/20 rounded-full text-sm backdrop-blur-sm">
                  AI-Powered
                </span>
              </div>
              <h3 className="text-2xl font-bold mb-2">Adaptive Practice</h3>
              <p className="text-indigo-100 text-sm leading-relaxed">
                Questions dynamically adjust to your skill level in real-time using
                advanced ML models for optimal learning progression.
              </p>
            </div>
          </div>

          {/* Card Body */}
          <div className="p-6">
            <div className="space-y-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg flex-shrink-0">
                  <FiZap className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">
                    Adaptive Difficulty
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Questions match your evolving skill level automatically
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex-shrink-0">
                  <FiActivity className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">
                    Real-time Analytics
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Track your performance with live metrics and insights
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex-shrink-0">
                  <FiTarget className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">
                    Course-Aligned Questions
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Practice from your enrolled course question banks
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex-shrink-0">
                  <FiBarChart2 className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">
                    12 AI Models
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Powered by concept mastery, stability index & more
                  </p>
                </div>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={(e) => {
                e.stopPropagation();
                navigate("/test/practice");
              }}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <FiPlay className="w-5 h-5" />
              Start Adaptive Practice
              <FiChevronRight className="w-4 h-4" />
            </motion.button>
          </div>
        </motion.div>

        {/* Retention Learning Card */}
        <motion.div
          whileHover={{ scale: 1.02, y: -5 }}
          className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden border border-emerald-100 dark:border-emerald-900 cursor-pointer group"
          onClick={() => navigate("/retention/start")}
        >
          {/* Card Header with Gradient */}
          <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-500 p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-20 translate-x-20 group-hover:scale-150 transition-transform duration-500" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full translate-y-16 -translate-x-16 group-hover:scale-150 transition-transform duration-500" />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                  <FaBrain className="w-8 h-8" />
                </div>
                <span className="px-3 py-1 bg-white/20 rounded-full text-sm backdrop-blur-sm">
                  Science-Backed
                </span>
              </div>
              <h3 className="text-2xl font-bold mb-2">Retention Learning</h3>
              <p className="text-emerald-100 text-sm leading-relaxed">
                Master concepts permanently using spaced repetition algorithms
                based on the Ebbinghaus forgetting curve.
              </p>
            </div>
          </div>

          {/* Card Body */}
          <div className="p-6">
            <div className="space-y-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex-shrink-0">
                  <FiRefreshCw className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">
                    Spaced Repetition
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Review concepts at optimal intervals for maximum retention
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg flex-shrink-0">
                  <FiClock className="w-4 h-4 text-teal-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">
                    Scheduled Reviews
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Automated daily review sessions based on your learning patterns
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg flex-shrink-0">
                  <FiTrendingUp className="w-4 h-4 text-cyan-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">
                    Progress Tracking
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Visualize your retention metrics and mastery progression
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg flex-shrink-0">
                  <FiAward className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">
                    Long-term Mastery
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Build lasting knowledge with scientifically proven methods
                  </p>
                </div>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={(e) => {
                e.stopPropagation();
                navigate("/retention/start");
              }}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <FiPlay className="w-5 h-5" />
              Start Retention Learning
              <FiChevronRight className="w-4 h-4" />
            </motion.button>
          </div>
        </motion.div>
      </div>

      {/* Info Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl p-6 border border-indigo-100 dark:border-indigo-900 max-w-5xl mx-auto"
      >
        <div className="flex items-start gap-4">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl flex-shrink-0">
            <FiInfo className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
              How These Modes Work Together
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              <strong className="text-indigo-600 dark:text-indigo-400">Adaptive Practice</strong> helps you
              learn new concepts by dynamically adjusting question difficulty based on your performance.
              <strong className="text-emerald-600 dark:text-emerald-400"> Retention Learning</strong> ensures
              you never forget what you have learned by scheduling reviews at scientifically optimal intervals.
              Use both modes together for a complete learning experience that builds and preserves knowledge.
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default StudentDashboardNew;
