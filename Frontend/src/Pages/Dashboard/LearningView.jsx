// components/Student/LearningView.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/authContext";
import { useTheme } from "../../context/ThemeContext";
import enrollmentService from "../../services/Course/enrollmentService";

// Icons
import {
  FiChevronRight,
  FiClock,
  FiPlay,
  FiCheck,
  FiCheckCircle,
  FiAlertCircle,
  FiFileText,
  FiVideo,
  FiTarget,
  FiUpload,
  FiArrowLeft,
  FiLoader,
  FiX,
} from "react-icons/fi";

import { FaBrain } from "react-icons/fa";

const LearningView = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark } = useTheme();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [courseCurriculum, setCourseCurriculum] = useState(null);
  const [courseProgress, setCourseProgress] = useState(null);
  const [learningContent, setLearningContent] = useState(null);
  const [activeLesson, setActiveLesson] = useState(null);
  const [expandedChapters, setExpandedChapters] = useState([]);
  const [timeSpent, setTimeSpent] = useState(0);
  const [lessonTimer, setLessonTimer] = useState(null);

  // Load course content
  useEffect(() => {
    if (courseId) {
      loadCourseContent(courseId);
    } else {
      setError("No course ID provided");
      setLoading(false);
    }
  }, [courseId]);

  // Timer for active lesson
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

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (lessonTimer) clearInterval(lessonTimer);
    };
  }, []);

  const loadCourseContent = async (id) => {
    try {
      setLoading(true);
      setError(null);

      const response = await enrollmentService.getCourseLearningContent(id);

      if (response?.success) {
        const data = response.data;
        setLearningContent(data);
        setSelectedCourse(data.course);
        setCourseCurriculum(data.curriculum);
        setCourseProgress(data.enrollment?.progress);

        // Auto-expand first chapter and select first lesson
        if (data.curriculum?.chapters?.length > 0) {
          const firstChapter = data.curriculum.chapters[0];
          setExpandedChapters([firstChapter._id]);

          if (firstChapter.lessons?.length > 0) {
            setActiveLesson({
              chapterId: firstChapter._id,
              lesson: firstChapter.lessons[0],
            });
          }
        }
      } else {
        setError(response?.message || "Failed to load course content");
      }
    } catch (err) {
      console.error("Error loading course content:", err);
      setError(err.message || "Failed to load course content");
    } finally {
      setLoading(false);
    }
  };

  const toggleChapter = (chapterId) => {
    setExpandedChapters((prev) =>
      prev.includes(chapterId)
        ? prev.filter((id) => id !== chapterId)
        : [...prev, chapterId],
    );
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

        // Update progress
        if (response.data) {
          setCourseProgress((prev) => ({
            ...prev,
            overallProgress: response.data.progress,
            completedLessons: response.data.completedLessons,
          }));
        }

        // Move to next lesson
        moveToNextLesson();
        setTimeSpent(0);
      }
    } catch (err) {
      setError("Failed to mark lesson as complete");
      setTimeout(() => setError(null), 5000);
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
      // Auto-expand the chapter if needed
      if (!expandedChapters.includes(nextLesson.chapterId)) {
        setExpandedChapters((prev) => [...prev, nextLesson.chapterId]);
      }
    } else {
      setSuccess("Chapter completed! Move to next chapter.");
      setTimeout(() => setSuccess(null), 3000);
      setActiveLesson(null);
    }
  };

  const moveToPreviousLesson = () => {
    if (!courseCurriculum?.chapters) return;

    let previousLesson = null;
    let found = false;

    // Iterate in reverse to find previous lesson
    const allLessons = [];
    courseCurriculum.chapters.forEach((chapter) => {
      chapter.lessons.forEach((lesson) => {
        allLessons.push({ chapterId: chapter._id, lesson });
      });
    });

    for (let i = allLessons.length - 1; i >= 0; i--) {
      if (found && !previousLesson) {
        previousLesson = allLessons[i];
        break;
      }
      if (allLessons[i].lesson._id === activeLesson?.lesson._id) {
        found = true;
        if (i > 0) {
          previousLesson = allLessons[i - 1];
        }
        break;
      }
    }

    if (previousLesson) {
      setActiveLesson(previousLesson);
      if (!expandedChapters.includes(previousLesson.chapterId)) {
        setExpandedChapters((prev) => [...prev, previousLesson.chapterId]);
      }
    }
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const getProgressColor = (progress) => {
    if (progress >= 80) return "bg-green-500";
    if (progress >= 60) return "bg-blue-500";
    if (progress >= 40) return "bg-yellow-500";
    if (progress >= 20) return "bg-orange-500";
    return "bg-red-500";
  };

  const isLessonCompleted = (lessonId) => {
    return courseProgress?.completedLessons?.some(
      (l) => l.lessonId === lessonId || l.lessonId?._id === lessonId,
    );
  };

  const handleBackToDashboard = () => {
    navigate("/student/dashboard");
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
            Loading course content...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-950">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 border-b border-indigo-100 dark:border-indigo-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={handleBackToDashboard}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
            >
              <FiArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Back to Dashboard</span>
            </button>
            <div className="flex items-center gap-3">
              <FaBrain className="w-6 h-6 text-indigo-600" />
              <span className="font-bold text-gray-900 dark:text-white hidden sm:block">
                StudyStream
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto">
                <FiX className="w-5 h-5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Course Header */}
        {selectedCourse && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-xl">
              <h1 className="text-2xl font-bold mb-2">
                {selectedCourse.title}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span className="text-indigo-100">
                  {courseCurriculum?.totalChapters || 0} Chapters
                </span>
                <span className="text-indigo-100">•</span>
                <span className="text-indigo-100">
                  {courseCurriculum?.totalLessons || 0} Lessons
                </span>
                <span className="text-indigo-100">•</span>
                <span className="text-indigo-100">
                  {courseCurriculum?.totalDuration || 0} min total
                </span>
              </div>
              {/* Progress Bar */}
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>Overall Progress</span>
                  <span>{courseProgress?.overallProgress || 0}%</span>
                </div>
                <div className="w-full bg-white/30 rounded-full h-2.5">
                  <div
                    className="h-2.5 rounded-full bg-white transition-all duration-500"
                    style={{
                      width: `${courseProgress?.overallProgress || 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Curriculum Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-indigo-100 dark:border-indigo-900 shadow-sm p-4 lg:sticky lg:top-24 max-h-[calc(100vh-120px)] overflow-y-auto">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <FiFileText className="w-5 h-5 text-indigo-600" />
                Course Content
              </h3>

              {courseCurriculum?.chapters?.length > 0 ? (
                <div className="space-y-2">
                  {courseCurriculum.chapters.map((chapter) => (
                    <div
                      key={chapter._id}
                      className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
                    >
                      <button
                        onClick={() => toggleChapter(chapter._id)}
                        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            Chapter {chapter.order}: {chapter.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {chapter.lessons?.length || 0} lessons
                          </span>
                          <FiChevronRight
                            className={`w-4 h-4 text-gray-400 transition-transform ${
                              expandedChapters.includes(chapter._id)
                                ? "rotate-90"
                                : ""
                            }`}
                          />
                        </div>
                      </button>

                      {expandedChapters.includes(chapter._id) && (
                        <div className="border-t border-gray-200 dark:border-gray-700">
                          {chapter.lessons?.map((lesson) => {
                            const completed = isLessonCompleted(lesson._id);
                            const isActive =
                              activeLesson?.lesson?._id === lesson._id;

                            return (
                              <button
                                key={lesson._id}
                                onClick={() =>
                                  setActiveLesson({
                                    chapterId: chapter._id,
                                    lesson,
                                  })
                                }
                                className={`w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                                  isActive
                                    ? "bg-indigo-50 dark:bg-indigo-900/20 border-l-2 border-indigo-600"
                                    : ""
                                }`}
                              >
                                <div className="flex-shrink-0">
                                  {lesson.lessonType === "video" && (
                                    <FiVideo className="w-4 h-4 text-blue-500" />
                                  )}
                                  {lesson.lessonType === "article" && (
                                    <FiFileText className="w-4 h-4 text-green-500" />
                                  )}
                                  {lesson.lessonType === "quiz" && (
                                    <FiTarget className="w-4 h-4 text-orange-500" />
                                  )}
                                  {lesson.lessonType === "assignment" && (
                                    <FiUpload className="w-4 h-4 text-purple-500" />
                                  )}
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                  <p className="text-sm text-gray-900 dark:text-white truncate">
                                    {lesson.title}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {lesson.lessonType} • {lesson.duration || 0}{" "}
                                    min
                                  </p>
                                </div>
                                {completed && (
                                  <FiCheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FiFileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">
                    No curriculum available
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Lesson Content */}
          <div className="lg:col-span-2">
            {activeLesson ? (
              <motion.div
                key={activeLesson.lesson._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-800 rounded-2xl border border-indigo-100 dark:border-indigo-900 shadow-sm p-6"
              >
                {/* Lesson Header */}
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                    {activeLesson.lesson.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <FiClock className="w-4 h-4" />
                      {activeLesson.lesson.duration || 0} min
                    </span>
                    <span className="flex items-center gap-1">
                      <FiPlay className="w-4 h-4" />
                      Time spent: {formatTime(timeSpent)}
                    </span>
                    <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-xs capitalize">
                      {activeLesson.lesson.lessonType}
                    </span>
                  </div>
                </div>

                {/* Video Content */}
                {activeLesson.lesson.lessonType === "video" && (
                  <div className="mb-6">
                    <div className="aspect-video bg-gray-900 rounded-xl flex items-center justify-center overflow-hidden">
                      {activeLesson.lesson.videoUrl ? (
                        <iframe
                          src={activeLesson.lesson.videoUrl}
                          className="w-full h-full rounded-xl"
                          allowFullScreen
                          title={activeLesson.lesson.title}
                        />
                      ) : (
                        <div className="text-center text-gray-400 p-8">
                          <FiVideo className="w-16 h-16 mx-auto mb-2" />
                          <p>Video content will be displayed here</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Article Content */}
                {activeLesson.lesson.lessonType === "article" && (
                  <div className="mb-6 p-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <div className="prose dark:prose-invert max-w-none">
                      <p className="text-gray-700 dark:text-gray-300">
                        {activeLesson.lesson.content ||
                          activeLesson.lesson.description ||
                          "Article content will be displayed here"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Quiz Content */}
                {activeLesson.lesson.lessonType === "quiz" && (
                  <div className="mb-6 p-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-center">
                    <FiTarget className="w-16 h-16 text-orange-500 mx-auto mb-3" />
                    <p className="text-gray-700 dark:text-gray-300">
                      Quiz content will be displayed here
                    </p>
                  </div>
                )}

                {/* Lesson Description */}
                {activeLesson.lesson.description &&
                  activeLesson.lesson.lessonType !== "article" && (
                    <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                        Description
                      </h4>
                      <p className="text-gray-700 dark:text-gray-300">
                        {activeLesson.lesson.description}
                      </p>
                    </div>
                  )}

                {/* Navigation Buttons */}
                <div className="flex justify-between items-center">
                  <button
                    onClick={moveToPreviousLesson}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                  >
                    <FiArrowLeft className="w-4 h-4" />
                    Previous
                  </button>
                  <button
                    onClick={handleCompleteLesson}
                    className="px-6 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
                  >
                    <FiCheck className="w-5 h-5" />
                    Complete & Next
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-indigo-100 dark:border-indigo-900 shadow-sm p-12 text-center">
                <FiPlay className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Select a lesson to start learning
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Choose a lesson from the curriculum on the left to begin
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default LearningView;
