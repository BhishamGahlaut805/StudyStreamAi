import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/authContext";
import { useTheme } from "../../context/ThemeContext";
import testService from "../../services/testService";
import authService from "../../services/authService";
import flaskService from "../../services/flaskService";

import {
  FiPlay,
  FiClock,
  FiTarget,
  FiZap,
  FiChevronRight,
  FiChevronLeft,
  FiSettings,
  FiBookOpen,
  FiBarChart2,
  FiActivity,
  FiSun,
  FiMoon,
  FiMaximize2,
  FiMinimize2,
  FiHelpCircle,
  FiAlertCircle,
  FiCheckCircle,
  FiX,
  FiMenu,
  FiHome,
  FiLogOut,
  FiRefreshCw,
} from "react-icons/fi";

import {
  FaBrain,
  FaRocket,
  FaChartLine,
  FaMagic,
  FaGraduationCap,
  FaBook,
  FaCertificate,
  FaMedal,
  FaTrophy,
  FaFire,
  FaBolt,
} from "react-icons/fa";

const TestPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const SUBJECT_TOPICS = {
    mathematics: [
      "Number System",
      "Algebra",
      "Geometry",
      "Trigonometry",
      "Mensuration",
      "Statistics",
      "Probability",
      "Average",
      "Percentage",
      "Profit & Loss",
      "Simple Interest",
      "Compound Interest",
      "Time & Work",
      "Time & Distance",
      "Ratio & Proportion",
      "Mixture & Alligation",
    ],
    english: [
      "Grammar",
      "Vocabulary",
      "Reading Comprehension",
      "Synonyms",
      "Antonyms",
      "Idioms & Phrases",
      "One Word Substitution",
      "Sentence Improvement",
      "Spotting Errors",
      "Fill in the Blanks",
      "Cloze Test",
      "Para Jumbles",
    ],
    reasoning: [
      "Analogy",
      "Classification",
      "Series",
      "Coding-Decoding",
      "Blood Relations",
      "Direction Sense",
      "Logical Venn Diagrams",
      "Syllogism",
      "Statement & Conclusions",
      "Statement & Assumptions",
      "Inequality",
      "Order & Ranking",
      "Puzzle",
      "Data Sufficiency",
      "Non-Verbal Reasoning",
    ],
    general_knowledge: [
      "Indian History",
      "Indian Geography",
      "Indian Polity",
      "Indian Economy",
      "General Science",
      "Current Affairs",
      "Sports",
      "Awards & Honors",
      "Books & Authors",
      "Important Days",
      "National Symbols",
      "Constitution of India",
      "Art & Culture",
    ],
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [testMode, setTestMode] = useState(null); // 'practice' or 'real'
  const [config, setConfig] = useState({
    title: "",
    selectedSubjects: [],
    selectedTopics: [],
    initialDifficulty: 0.5,
    adaptiveEnabled: true,
    showSolutions: true,
  });

  const [fullScreen, setFullScreen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [availableTopics, setAvailableTopics] = useState([]);
  const [profileData, setProfileData] = useState({
    loading: false,
    currentDifficulty: 0.5,
    featureRows: 0,
    modelReady: false,
  });
  const [clearingData, setClearingData] = useState(false);

  useEffect(() => {
    // Set default title based on mode
    if (testMode === "practice") {
      setConfig((prev) => ({
        ...prev,
        title: "Practice Session",
      }));
    } else if (testMode === "real") {
      setConfig((prev) => ({
        ...prev,
        title: "Real Exam Simulation",
        adaptiveEnabled: false,
      }));
    }
  }, [testMode]);

  useEffect(() => {
    const syncProfile = async () => {
      if (testMode !== "practice") return;
      const studentId = authService.getStudentId();
      if (!studentId) return;

      setProfileData((prev) => ({ ...prev, loading: true }));
      const profile = await flaskService.getPracticeProfile(studentId);

      setProfileData({
        loading: false,
        currentDifficulty: profile.currentDifficulty ?? 0.5,
        featureRows: profile.featureRows ?? 0,
        modelReady: !!profile.modelTrained,
      });
    };

    syncProfile();
  }, [testMode]);

  useEffect(() => {
    const handleFullScreenChange = () => {
      setFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullScreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullScreenChange);
  }, []);

  // Load available topics from subject clusters
  useEffect(() => {
    const selected = config.selectedSubjects || [];
    if (selected.length === 0) {
      setAvailableTopics(Object.values(SUBJECT_TOPICS).flat());
      return;
    }

    const topics = selected.flatMap((subject) => SUBJECT_TOPICS[subject] || []);
    setAvailableTopics(Array.from(new Set(topics)));
  }, [config.selectedSubjects]);

  const toggleDarkMode = () => toggleTheme();

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const handleTopicToggle = (topic) => {
    setConfig((prev) => ({
      ...prev,
      selectedTopics: prev.selectedTopics.includes(topic)
        ? prev.selectedTopics.filter((t) => t !== topic)
        : [...prev.selectedTopics, topic],
    }));
  };

  const handleSubjectToggle = (subjectKey) => {
    setConfig((prev) => {
      const alreadySelected = prev.selectedSubjects.includes(subjectKey);
      const nextSubjects = alreadySelected
        ? prev.selectedSubjects.filter((s) => s !== subjectKey)
        : [...prev.selectedSubjects, subjectKey];

      const topicsInSubject = SUBJECT_TOPICS[subjectKey] || [];
      let nextTopics = [...prev.selectedTopics];

      if (alreadySelected) {
        nextTopics = nextTopics.filter(
          (topic) => !topicsInSubject.includes(topic),
        );
      } else {
        nextTopics = Array.from(new Set([...nextTopics, ...topicsInSubject]));
      }

      return {
        ...prev,
        selectedSubjects: nextSubjects,
        selectedTopics: nextTopics,
      };
    });
  };

  const handleResetPracticeData = async () => {
    const studentId = authService.getStudentId();
    if (!studentId) return;

    const confirmed = window.confirm(
      "This will clear your saved practice history and start fresh. Continue?",
    );
    if (!confirmed) return;

    setClearingData(true);
    try {
      const resetResult = await flaskService.resetPracticeData(studentId);
      if (!resetResult.success) {
        setError(resetResult.message || "Could not clear practice history");
        return;
      }

      testService.clearSession();
      setConfig((prev) => ({
        ...prev,
        selectedSubjects: [],
        selectedTopics: [],
        initialDifficulty: 0.5,
      }));

      const profile = await flaskService.getPracticeProfile(studentId);
      setProfileData({
        loading: false,
        currentDifficulty: profile.currentDifficulty ?? 0.5,
        featureRows: profile.featureRows ?? 0,
        modelReady: !!profile.modelTrained,
      });
    } catch (err) {
      setError(err?.message || "Could not clear practice history");
    } finally {
      setClearingData(false);
    }
  };

  const handleStartTest = async () => {
    try {
      setLoading(true);
      setError("");

      const studentId = authService.getStudentId();
      if (!studentId) {
        navigate("/auth");
        return;
      }

      // Validate selections
      if (testMode === "practice" && config.selectedTopics.length === 0) {
        setError("Please select at least one topic to practice");
        setLoading(false);
        return;
      }

      let response;
      let examDifficulty = config.initialDifficulty;
      if (testMode === "practice") {
        response = await testService.createPracticeTest({
          studentId,
          title: config.title || "Practice Session",
          selectedTopics: config.selectedTopics,
          initialDifficulty: config.initialDifficulty,
          initialDifficultyLockSize: 5,
          adaptiveEnabled: config.adaptiveEnabled,
          showSolutions: config.showSolutions,
          batchSize: 2,
        });
      } else {
        const practiceProfile =
          await flaskService.getPracticeProfile(studentId);
        const examFeatureVector = [
          practiceProfile?.currentDifficulty ?? config.initialDifficulty,
          config.initialDifficulty,
          practiceProfile?.modelReady ? 0.7 : 0.5,
          0.6,
          0,
          0.6,
          0.6,
          0.7,
        ];

        const examDifficultyResponse = await flaskService.getExamDifficulty(
          studentId,
          examFeatureVector,
          "ssc_real_exam",
        );

        examDifficulty =
          examDifficultyResponse?.recommendedDifficulty ??
          practiceProfile?.currentDifficulty ??
          config.initialDifficulty;

        response = await testService.createRealExam({
          studentId,
          title: config.title || "Real Exam",
          selectedTopics: config.selectedTopics,
          initialDifficulty: examDifficulty,
        });
      }
      if (response.success) {
        // Navigate to test interface with session data
        navigate(
          testMode === "practice" ? "/test/interface" : "/test/real/interface",
          {
            state: {
              session: response.session,
              testMode,
              config,
              examDifficulty,
            },
          },
        );
      }
    } catch (err) {
      setError(err.message || "Failed to start test. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    if (testMode) {
      setTestMode(null);
      setConfig({
        title: "",
        selectedSubjects: [],
        selectedTopics: [],
        initialDifficulty: 0.5,
        adaptiveEnabled: true,
        showSolutions: true,
      });
    } else {
      navigate("/dashboard");
    }
  };

  // Animation variants
  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  const stagger = {
    animate: {
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  return (
    <div className="min-h-screen">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-950 -z-10" />

      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden -z-5">
        <div className="absolute top-20 left-10 w-72 h-72 bg-indigo-200/30 dark:bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-80 h-80 bg-purple-200/30 dark:bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 border-b border-indigo-100 dark:border-indigo-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={goBack}
                className="p-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
              >
                <FiChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  {testMode === "practice"
                    ? "Practice Mode"
                    : testMode === "real"
                      ? "Real Exam Mode"
                      : "Test Setup"}
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {testMode === "practice"
                    ? "Adaptive learning at your pace"
                    : testMode === "real"
                      ? "Simulate real exam conditions"
                      : "Choose your test mode"}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
              >
                {isDark ? (
                  <FiSun className="w-5 h-5 text-yellow-500" />
                ) : (
                  <FiMoon className="w-5 h-5 text-gray-600" />
                )}
              </button>

              <button
                onClick={toggleFullScreen}
                className="p-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
              >
                {fullScreen ? (
                  <FiMinimize2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                ) : (
                  <FiMaximize2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Error Display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-6"
            >
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start space-x-3">
                <FiAlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300">
                  {error}
                </p>
                <button
                  onClick={() => setError("")}
                  className="ml-auto text-red-500 hover:text-red-700"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mode Selection */}
        {!testMode && (
          <motion.div
            variants={stagger}
            initial="initial"
            animate="animate"
            className="space-y-8"
          >
            <motion.h2
              variants={fadeInUp}
              className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-8"
            >
              How would you like to practice?
            </motion.h2>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Practice Mode Card */}
              <motion.div
                variants={fadeInUp}
                whileHover={{ scale: 1.02, y: -5 }}
                className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-8 cursor-pointer border-2 border-transparent hover:border-indigo-600 transition-all"
                onClick={() => setTestMode("practice")}
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="p-4 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl">
                    <FaBrain className="w-8 h-8 text-white" />
                  </div>
                  <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-sm font-medium">
                    Adaptive
                  </span>
                </div>

                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Practice Mode
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  Learn at your own pace with questions that adapt to your skill
                  level. Get instant feedback and explanations.
                </p>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <FiZap className="w-4 h-4 mr-2 text-indigo-600" />
                    Adaptive difficulty
                  </div>
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <FiActivity className="w-4 h-4 mr-2 text-indigo-600" />
                    Real-time analytics
                  </div>
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <FiBookOpen className="w-4 h-4 mr-2 text-indigo-600" />
                    Detailed explanations
                  </div>
                </div>

                <button className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold flex items-center justify-center space-x-2">
                  <span>Choose Practice</span>
                  <FiChevronRight className="w-5 h-5" />
                </button>
              </motion.div>

              {/* Real Exam Mode Card */}
              <motion.div
                variants={fadeInUp}
                whileHover={{ scale: 1.02, y: -5 }}
                className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-8 cursor-pointer border-2 border-transparent hover:border-purple-600 transition-all"
                onClick={() => setTestMode("real")}
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="p-4 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl">
                    <FaRocket className="w-8 h-8 text-white" />
                  </div>
                  <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full text-sm font-medium">
                    Timed
                  </span>
                </div>

                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Real Exam Mode
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  Simulate real exam conditions with 100 questions and a
                  60-minute timer. Get comprehensive performance analysis.
                </p>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <FiClock className="w-4 h-4 mr-2 text-purple-600" />
                    60-minute timer
                  </div>
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <FiTarget className="w-4 h-4 mr-2 text-purple-600" />
                    100 questions (25 per subject)
                  </div>
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <FiBarChart2 className="w-4 h-4 mr-2 text-purple-600" />
                    Detailed performance report
                  </div>
                </div>

                <button className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold flex items-center justify-center space-x-2">
                  <span>Choose Exam</span>
                  <FiChevronRight className="w-5 h-5" />
                </button>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* Topic Selection & Configuration */}
        {testMode && (
          <motion.div
            variants={stagger}
            initial="initial"
            animate="animate"
            className="space-y-8"
          >
            {/* Header */}
            <motion.div variants={fadeInUp} className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {testMode === "practice"
                  ? "Build Your Practice Plan"
                  : "Configure Your Exam"}
              </h2>
              <p className="text-gray-500 dark:text-gray-400">
                {testMode === "practice"
                  ? "Pick subjects and topics you want to focus on"
                  : "Review your exam settings before starting"}
              </p>
            </motion.div>

            {testMode === "practice" && (
              <motion.div
                variants={fadeInUp}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Your Current Level
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Based on your saved practice history
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-indigo-600">
                      {Math.round((profileData.currentDifficulty || 0.5) * 100)}
                      %
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {profileData.loading
                        ? "Checking..."
                        : `${profileData.featureRows} saved entries`}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Topic Selection (for practice mode) */}
            {testMode === "practice" && (
              <motion.div
                variants={fadeInUp}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6"
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Subject Groups
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {Object.entries(SUBJECT_TOPICS).map(([subject, topics]) => {
                    const selected = config.selectedSubjects.includes(subject);
                    const label = subject
                      .replace("_", " ")
                      .replace(/\b\w/g, (ch) => ch.toUpperCase());

                    return (
                      <button
                        key={subject}
                        onClick={() => handleSubjectToggle(subject)}
                        className={`text-left p-4 rounded-xl border-2 transition-all ${
                          selected
                            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30"
                            : "border-gray-200 dark:border-gray-700 hover:border-indigo-300"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {label}
                          </span>
                          {selected && (
                            <FiCheckCircle className="w-4 h-4 text-indigo-600" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {topics.length} topics
                        </p>
                      </button>
                    );
                  })}
                </div>

                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Topics
                </h4>
                <div className="flex flex-wrap gap-2 max-h-80 overflow-y-auto p-2 rounded-xl bg-indigo-50/50 dark:bg-gray-900/30">
                  {availableTopics.map((topic) => (
                    <button
                      key={topic}
                      onClick={() => handleTopicToggle(topic)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        config.selectedTopics.includes(topic)
                          ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow"
                          : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-indigo-300"
                      }`}
                    >
                      {topic}
                    </button>
                  ))}
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                  Selected: {config.selectedSubjects.length} subjects •{" "}
                  {config.selectedTopics.length} topics
                </p>
              </motion.div>
            )}

            {/* Configuration Options */}
            <motion.div
              variants={fadeInUp}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 space-y-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Settings
              </h3>

              {/* Test Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Session Title
                </label>
                <input
                  type="text"
                  value={config.title}
                  onChange={(e) =>
                    setConfig({ ...config, title: e.target.value })
                  }
                  placeholder={
                    testMode === "practice"
                      ? "e.g., Algebra Practice"
                      : "e.g., Full Length Mock Test"
                  }
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Initial Difficulty (practice mode only) */}
              {testMode === "practice" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Starting Level
                  </label>
                  <div className="flex items-center space-x-4">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={config.initialDifficulty}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          initialDifficulty: parseFloat(e.target.value),
                        })
                      }
                      className="flex-1 accent-indigo-600"
                    />
                    <span className="text-lg font-semibold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2 rounded-xl min-w-[96px] text-center">
                      {Math.round(config.initialDifficulty * 100)}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    This starting level is held for the first 5 questions, then
                    adapts
                  </p>
                </div>
              )}

              {testMode === "practice" && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        Fresh Start
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Clear saved practice data and begin from scratch
                      </p>
                    </div>
                    <button
                      onClick={handleResetPracticeData}
                      disabled={clearingData}
                      className="px-4 py-2 rounded-xl bg-amber-500 text-white font-medium hover:bg-amber-600 transition-colors disabled:opacity-60"
                    >
                      {clearingData ? "Clearing..." : "Clear Past Data"}
                    </button>
                  </div>
                </div>
              )}

              {/* Toggle Options */}
              {testMode === "practice" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="flex items-center justify-between p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white flex items-center">
                        <FiZap className="w-4 h-4 mr-2 text-indigo-600" />
                        Adaptive Learning
                      </span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Questions adjust to your performance
                      </p>
                    </div>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={config.adaptiveEnabled}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            adaptiveEnabled: e.target.checked,
                          })
                        }
                        className="sr-only"
                      />
                      <div
                        className={`w-12 h-6 rounded-full transition-colors ${
                          config.adaptiveEnabled
                            ? "bg-indigo-600"
                            : "bg-gray-300 dark:bg-gray-600"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 bg-white rounded-full transform transition-transform ${
                            config.adaptiveEnabled
                              ? "translate-x-7"
                              : "translate-x-1"
                          }`}
                        />
                      </div>
                    </div>
                  </label>

                  <label className="flex items-center justify-between p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white flex items-center">
                        <FiBookOpen className="w-4 h-4 mr-2 text-indigo-600" />
                        Show Solutions
                      </span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        View explanations after each answer
                      </p>
                    </div>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={config.showSolutions}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            showSolutions: e.target.checked,
                          })
                        }
                        className="sr-only"
                      />
                      <div
                        className={`w-12 h-6 rounded-full transition-colors ${
                          config.showSolutions
                            ? "bg-indigo-600"
                            : "bg-gray-300 dark:bg-gray-600"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 bg-white rounded-full transform transition-transform ${
                            config.showSolutions
                              ? "translate-x-7"
                              : "translate-x-1"
                          }`}
                        />
                      </div>
                    </div>
                  </label>
                </div>
              )}

              {/* Summary for Real Exam */}
              {testMode === "real" && (
                <div className="p-4 bg-purple-50 dark:bg-purple-900/30 rounded-xl">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-purple-600">100</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Total Questions
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-purple-600">60</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Minutes
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-purple-600">4</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Sections
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-purple-600">25</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Per Section
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Action Buttons */}
            <motion.div
              variants={fadeInUp}
              className="flex justify-between pt-4"
            >
              <button
                onClick={() => setTestMode(null)}
                className="px-6 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center space-x-2"
              >
                <FiChevronLeft className="w-5 h-5" />
                <span>Back</span>
              </button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleStartTest}
                disabled={
                  loading ||
                  (testMode === "practice" &&
                    config.selectedTopics.length === 0)
                }
                className={`px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold flex items-center space-x-2 shadow-lg hover:shadow-xl transition-all ${
                  loading ||
                  (testMode === "practice" &&
                    config.selectedTopics.length === 0)
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                    <span>Starting...</span>
                  </>
                ) : (
                  <>
                    <FiPlay className="w-5 h-5" />
                    <span>
                      Start {testMode === "practice" ? "Practice" : "Exam"}
                    </span>
                  </>
                )}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </main>

      {/* Floating Help Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        className="fixed bottom-8 right-8 p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full shadow-2xl hover:shadow-xl transition-all"
        onClick={() => window.open("/help", "_blank")}
      >
        <FiHelpCircle className="w-6 h-6" />
      </motion.button>
    </div>
  );
};

export default TestPage;
