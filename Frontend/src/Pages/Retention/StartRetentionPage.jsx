// file: StartRetentionPage.jsx
// Replace the entire file content

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiArrowRight,
  FiBookOpen,
  FiCheckCircle,
  FiLayers,
  FiMoon,
  FiSun,
  FiAlertCircle,
} from "react-icons/fi";
import { useAuth } from "../../context/authContext";
import authService from "../../services/authService";
import retentionService from "../../services/RetentionModel/RetentionService";
import enrollmentService from "../../services/Course/enrollmentService";
import courseService from "../../services/Course/CourseService";

const START_RETENTION_THEME_KEY = "retention_start_theme";

const StartRetentionPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [availableTopics, setAvailableTopics] = useState([]);
  const [courseTopicsMap, setCourseTopicsMap] = useState({});
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const savedTheme = localStorage.getItem(START_RETENTION_THEME_KEY);
      if (savedTheme === "dark") return true;
      if (savedTheme === "light") return false;
      return Boolean(
        window.matchMedia?.("(prefers-color-scheme: dark)")?.matches,
      );
    } catch {
      return false;
    }
  });

  const studentId = useMemo(
    () => user?.studentId || user?.id || authService.getStudentId(),
    [user],
  );

  /**
   * Fetch enrolled courses and their question banks on component mount
   */
  useEffect(() => {
    const fetchCoursesAndTopics = async () => {
      try {
        setCoursesLoading(true);
        setCoursesError("");

        // Fetch enrolled courses
        const enrolledResponse = await enrollmentService.getEnrolledCourses();
        console.log(
          "[StartRetentionPage] Enrolled response:",
          enrolledResponse,
        );

        // Handle multiple possible response structures
        let courses = [];
        if (Array.isArray(enrolledResponse)) {
          courses = enrolledResponse;
        } else if (enrolledResponse?.data?.enrollments) {
          courses = enrolledResponse.data.enrollments;
        } else if (enrolledResponse?.enrollments) {
          courses = enrolledResponse.enrollments;
        } else if (
          enrolledResponse?.data &&
          Array.isArray(enrolledResponse.data)
        ) {
          courses = enrolledResponse.data;
        }

        console.log("[StartRetentionPage] Parsed courses:", courses);
        setEnrolledCourses(courses);

        if (!courses || courses.length === 0) {
          setCoursesError(
            "No courses enrolled. Please enroll in a course first.",
          );
          setCoursesLoading(false);
          return;
        }

        // Fetch question banks and topics for each course
        const coursesTopicsMap = {};

        for (const enrollment of courses) {
          // Handle different enrollment object structures
          const courseId =
            enrollment?.course?._id ||
            enrollment?.course ||
            enrollment?.courseId ||
            enrollment?._id;
          const courseName =
            enrollment?.course?.title ||
            enrollment?.course?.name ||
            enrollment?.courseName ||
            enrollment?.title ||
            enrollment?.name ||
            "Unknown Course";

          if (!courseId) {
            console.warn(
              "[StartRetentionPage] Could not extract courseId from enrollment:",
              enrollment,
            );
            continue;
          }

          console.log(
            `[StartRetentionPage] Processing course ${courseId}: ${courseName}`,
          );

          try {
            // Fetch question bank for this course
            const questionBankResponse =
              await courseService.getQuestionBank(courseId);
            console.log(
              `[StartRetentionPage] Question bank response for ${courseId}:`,
              questionBankResponse,
            );

            // Handle different response structures
            let questionBank = questionBankResponse?.data;
            if (!questionBank && questionBankResponse?.topics) {
              questionBank = questionBankResponse;
            }

            // Extract topics from question bank
            const topics =
              questionBank?.topics?.map((t) =>
                typeof t === "string" ? t : t.name,
              ) || [];

            coursesTopicsMap[courseId] = {
              courseName,
              topics: topics.length > 0 ? topics : ["General"],
              courseData: enrollment.course || enrollment,
            };
          } catch (err) {
            console.warn(
              `[StartRetentionPage] Could not fetch question bank for course ${courseId}:`,
              err,
            );
            // Fallback to empty topics if question bank fetch fails
            coursesTopicsMap[courseId] = {
              courseName,
              topics: ["General"],
              courseData: enrollment.course || enrollment,
            };
          }
        }

        console.log(
          "[StartRetentionPage] Final coursesTopicsMap:",
          coursesTopicsMap,
        );
        setCourseTopicsMap(coursesTopicsMap);
      } catch (err) {
        console.error("[StartRetentionPage] Error fetching courses:", err);
        setCoursesError(
          err?.message ||
            "Failed to load your enrolled courses. Please try again.",
        );
      } finally {
        setCoursesLoading(false);
      }
    };

    if (user?.id) {
      console.log("[StartRetentionPage] Fetching courses for user:", user?.id);
      fetchCoursesAndTopics();
    }
  }, [user?.id]);

  // Update available topics when course selection changes
  useEffect(() => {
    if (selectedCourseId && courseTopicsMap[selectedCourseId]) {
      const topics = courseTopicsMap[selectedCourseId].topics || [];
      setAvailableTopics(topics);
      // Auto-select all topics by default for better retention coverage
      setSelectedTopics([...topics]);
    } else {
      setAvailableTopics([]);
      setSelectedTopics([]);
    }
  }, [selectedCourseId, courseTopicsMap]);

  useEffect(() => {
    try {
      localStorage.setItem(
        START_RETENTION_THEME_KEY,
        isDarkMode ? "dark" : "light",
      );
    } catch {
      // Non-blocking if persistence is unavailable.
    }
  }, [isDarkMode]);

  const toggleTopic = (topic) => {
    setSelectedTopics((prev) => {
      if (prev.includes(topic)) {
        const next = prev.filter((item) => item !== topic);
        return next.length > 0 ? next : prev;
      }
      return [...prev, topic];
    });
  };

  const selectAllTopics = () => {
    setSelectedTopics([...availableTopics]);
  };

  const deselectAllTopics = () => {
    setSelectedTopics([]);
  };

  const startSession = async () => {
    setError("");
    if (!studentId) {
      setError("Student identity is missing. Please login again.");
      return;
    }

    if (!selectedCourseId) {
      setError("Please select a course for retention practice.");
      return;
    }

    if (selectedTopics.length === 0) {
      setError("Please select at least one topic for retention practice.");
      return;
    }

    try {
      setStarting(true);

      const token = authService.getToken();
      retentionService.initialize(studentId);
      if (token) {
        retentionService.setAuthToken(token);
      }

      // Get course name for display
      const courseName =
        courseTopicsMap[selectedCourseId]?.courseName || "Course";

      const response = await retentionService.startSession(
        selectedCourseId, // Use courseId as subject identifier
        selectedTopics,
        "practice", // sessionType
      );

      if (!response.success) {
        throw new Error(response.error || "Unable to start retention session");
      }

      const startedAt = response.startTime || new Date().toISOString();
      localStorage.setItem(
        "retention_active_session",
        JSON.stringify({
          sessionId: response.sessionId,
          studentId,
          subject: selectedCourseId,
          topics: selectedTopics,
          courseName,
          sessionType: "practice",
          startedAt,
        }),
      );

      navigate("/retention/interface", {
        state: {
          session: response,
          config: {
            studentId,
            subject: selectedCourseId,
            topics: selectedTopics,
            sessionType: "practice",
            startedAt,
          },
        },
      });
    } catch (err) {
      setError(err.message || "Failed to start session.");
    } finally {
      setStarting(false);
    }
  };

  const pageShellClass = isDarkMode
    ? "min-h-screen bg-[radial-gradient(circle_at_top,_#1e293b_0%,_#0f172a_40%,_#020617_100%)] px-4 py-8 sm:px-8 text-slate-100"
    : "min-h-screen bg-[radial-gradient(circle_at_top,_#fef3c7_0%,_#fee2e2_25%,_#dbeafe_70%,_#f8fafc_100%)] px-4 py-8 sm:px-8 text-slate-900";

  const cardClass = isDarkMode
    ? "rounded-3xl border border-slate-700/80 bg-slate-900/75 p-6 shadow-2xl shadow-slate-950/50 backdrop-blur sm:p-8"
    : "rounded-3xl border border-white/60 bg-white/80 p-6 shadow-2xl shadow-indigo-100/80 backdrop-blur sm:p-8";

  const sectionClass = isDarkMode
    ? "rounded-2xl border border-slate-700 bg-slate-900/75 p-5"
    : "rounded-2xl border border-slate-200 bg-white/80 p-5";

  return (
    <div className={pageShellClass}>
      <div className="mx-auto max-w-5xl">
        <div className={cardClass}>
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p
                className={`text-xs font-semibold uppercase tracking-[0.2em] ${
                  isDarkMode ? "text-amber-300" : "text-orange-600"
                }`}
              >
                Retention Practice Launcher
              </p>
              <h1
                className={`mt-2 text-3xl font-black sm:text-4xl ${
                  isDarkMode ? "text-slate-100" : "text-slate-900"
                }`}
              >
                Start Dedicated Retention Session
              </h1>
              <p
                className={`mt-2 max-w-2xl text-sm sm:text-base ${
                  isDarkMode ? "text-slate-300" : "text-slate-600"
                }`}
              >
                Select a course and topic set. Questions will be managed by the
                Smart Retention Queue with spaced repetition for long-term
                memory.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsDarkMode((prev) => !prev)}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  isDarkMode
                    ? "border border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {isDarkMode ? (
                  <>
                    <FiSun className="h-4 w-4" />
                    Day Mode
                  </>
                ) : (
                  <>
                    <FiMoon className="h-4 w-4" />
                    Night Mode
                  </>
                )}
              </button>
              <div
                className={`rounded-2xl px-4 py-3 ${
                  isDarkMode
                    ? "bg-slate-950 text-slate-100"
                    : "bg-slate-900 text-white"
                }`}
              >
                <p className="text-xs uppercase tracking-wider text-slate-300">
                  Student
                </p>
                <p className="text-sm font-semibold">
                  {studentId || "Not found"}
                </p>
              </div>
            </div>
          </div>

          {/* Courses Loading State */}
          {coursesLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  Loading your enrolled courses...
                </p>
              </div>
            </div>
          )}

          {/* No Courses Error */}
          {!coursesLoading && coursesError && (
            <div className="mb-6">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start space-x-3">
                <FiAlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    {coursesError}
                  </p>
                  <button
                    onClick={() => navigate("/dashboard")}
                    className="mt-2 text-sm px-3 py-1 bg-amber-500 text-white rounded hover:bg-amber-600 transition-colors"
                  >
                    Go to Dashboard
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Course Selection */}
          {!coursesLoading && !coursesError && (
            <div
              className={`${sectionClass} ${
                isDarkMode
                  ? "bg-gradient-to-br from-slate-900/90 via-slate-900 to-indigo-950/30"
                  : "bg-gradient-to-br from-white via-amber-50/60 to-rose-50/40"
              }`}
            >
              <div className="mb-4 flex items-center gap-2">
                <FiBookOpen
                  className={`text-lg ${isDarkMode ? "text-amber-300" : "text-slate-700"}`}
                />
                <h2
                  className={`text-lg font-bold ${
                    isDarkMode ? "text-slate-100" : "text-slate-900"
                  }`}
                >
                  Select Course
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(courseTopicsMap).map(
                  ([courseId, courseData]) => {
                    const isSelected = selectedCourseId === courseId;
                    const courseName = courseData.courseName;
                    const topicsCount = courseData.topics.length;

                    return (
                      <button
                        key={courseId}
                        onClick={() => setSelectedCourseId(courseId)}
                        className={`text-left p-5 rounded-xl border-2 transition-all ${
                          isSelected
                            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 shadow-md ring-2 ring-indigo-200"
                            : "border-gray-200 dark:border-gray-700 hover:border-indigo-300 hover:shadow-md"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                isSelected
                                  ? "bg-indigo-600 text-white"
                                  : "bg-gray-100 dark:bg-gray-700 text-gray-500"
                              }`}
                            >
                              <FiBookOpen className="w-5 h-5" />
                            </div>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {courseName}
                            </span>
                          </div>
                          {isSelected && (
                            <FiCheckCircle className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                          )}
                        </div>
                        <div className="ml-13 pl-1">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {topicsCount} topics available
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {courseData.topics.slice(0, 4).map((topic) => (
                              <span
                                key={topic}
                                className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full text-xs"
                              >
                                {topic}
                              </span>
                            ))}
                            {courseData.topics.length > 4 && (
                              <span className="text-xs text-gray-400">
                                +{courseData.topics.length - 4} more
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  },
                )}
              </div>
            </div>
          )}

          {/* Topic Selection - shown only when a course is selected */}
          {selectedCourseId && availableTopics.length > 0 && (
            <div
              className={`mt-6 ${sectionClass} ${
                isDarkMode
                  ? "bg-gradient-to-br from-slate-900/90 via-slate-900 to-indigo-950/30"
                  : "bg-gradient-to-br from-white via-amber-50/60 to-rose-50/40"
              }`}
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FiLayers
                    className={`text-lg ${isDarkMode ? "text-amber-300" : "text-slate-700"}`}
                  />
                  <h2
                    className={`text-lg font-bold ${
                      isDarkMode ? "text-slate-100" : "text-slate-900"
                    }`}
                  >
                    Topic Selection
                  </h2>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAllTopics}
                    className={`text-xs px-3 py-1 rounded-lg font-medium transition ${
                      isDarkMode
                        ? "bg-indigo-900/40 text-indigo-200 hover:bg-indigo-800/60"
                        : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                    }`}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={deselectAllTopics}
                    className={`text-xs px-3 py-1 rounded-lg font-medium transition ${
                      isDarkMode
                        ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {availableTopics.map((topic) => {
                  const isChecked = selectedTopics.includes(topic);
                  return (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => toggleTopic(topic)}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                        isChecked
                          ? "border-transparent bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 text-white shadow-md"
                          : isDarkMode
                            ? "border-slate-600 bg-slate-900 text-slate-200 hover:border-slate-400"
                            : "border-slate-300 bg-white text-slate-700 hover:border-slate-500"
                      }`}
                    >
                      {topic.replaceAll("_", " ")}
                    </button>
                  );
                })}
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                Selected: {selectedTopics.length} of {availableTopics.length}{" "}
                topics
              </p>
            </div>
          )}

          {/* Session Info - shown when a course is selected */}
          {selectedCourseId && (
            <div
              className={`mt-6 flex flex-wrap items-center justify-between gap-4 ${sectionClass} ${
                isDarkMode
                  ? "bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/30"
                  : "bg-gradient-to-r from-white via-cyan-50/70 to-blue-50/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <FiBookOpen
                  className={`text-lg ${isDarkMode ? "text-cyan-300" : "text-slate-600"}`}
                />
                <div>
                  <p
                    className={`text-sm font-semibold ${
                      isDarkMode ? "text-slate-100" : "text-slate-900"
                    }`}
                  >
                    Session Mode
                  </p>
                  <p
                    className={`text-xs ${
                      isDarkMode ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    Smart Retention Queue with adaptive spaced repetition.
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Course
                </p>
                <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                  {courseTopicsMap[selectedCourseId]?.courseName}
                </p>
              </div>
            </div>
          )}

          {error && (
            <div
              className={`mt-5 rounded-xl border px-4 py-3 text-sm ${
                isDarkMode
                  ? "border-rose-400/50 bg-rose-950/40 text-rose-200"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {error}
            </div>
          )}

          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className={`rounded-xl px-6 py-3 font-semibold transition ${
                isDarkMode
                  ? "border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Back to Dashboard
            </button>
            <button
              type="button"
              onClick={startSession}
              disabled={
                starting || !selectedCourseId || selectedTopics.length === 0
              }
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 via-pink-500 to-violet-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:from-orange-600 hover:via-pink-600 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {starting ? "Starting Session..." : "Start Retention Session"}
              <FiArrowRight />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StartRetentionPage;
