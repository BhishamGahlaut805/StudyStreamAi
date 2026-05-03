import React, { useState, useEffect } from "react";
import {
  FiBook,
  FiUsers,
  FiStar,
  FiLoader,
  FiEye,
  FiCamera,
  FiClock,
  FiBarChart2,
  FiDollarSign,
  FiTag,
} from "react-icons/fi";
import courseService from "../../../services/Course/CourseService";

const CourseStatsCard = ({ course, onViewDetails }) => (
  <div className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl dark:border-gray-700 dark:bg-gray-800">
    <div className="relative h-44 overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900">
      {course.coverImage?.url ? (
        <img
          src={course.coverImage.url}
          alt={course.title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          onError={(e) => {
            e.target.style.display = "none";
          }}
        />
      ) : (
        <div className="flex h-full items-end justify-between p-5 text-white">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/75">
              My Course
            </p>
            <h3 className="mt-2 text-2xl font-bold leading-tight">
              {course.title}
            </h3>
          </div>
          <div className="rounded-full border border-white/20 bg-white/10 p-3 backdrop-blur">
            <FiBook />
          </div>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
      <div className="absolute left-4 top-4 flex items-center gap-2">
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
            course.status === "published"
              ? "bg-green-500/90 text-white"
              : course.status === "pending"
                ? "bg-amber-500/90 text-white"
                : "bg-slate-900/80 text-white"
          }`}
        >
          {course.status}
        </span>
      </div>
    </div>

    <div className="p-5">
      <div className="mb-4 flex items-start gap-4">
        {course.thumbnail?.url ? (
          <img
            src={course.thumbnail.url}
            alt={`${course.title} thumbnail`}
            className="h-14 w-14 shrink-0 rounded-xl border border-gray-200 object-cover dark:border-gray-700"
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-gray-400 dark:border-gray-600 dark:bg-gray-700/50">
            <FiCamera />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold text-gray-900 dark:text-white mb-1">
            {course.title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {course.shortDescription || course.description || "No description"}
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
        <div>
          <p className="text-xs text-gray-600 dark:text-gray-400">Students</p>
          <div className="flex items-center gap-2 mt-1">
            <FiUsers size={18} className="text-blue-500" />
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {course.totalStudents || 0}
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-600 dark:text-gray-400">Rating</p>
          <div className="flex items-center gap-2 mt-1">
            <FiStar size={18} className="text-yellow-500" />
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {typeof course.rating === "object"
                ? course.rating?.average?.toFixed(1) || "0.0"
                : Number(course.rating)?.toFixed(1) || "0.0"}
            </p>
          </div>
        </div>
      </div>

      {/* Additional Info */}
      <div className="space-y-2 mb-4 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Price:</span>
          <span className="font-medium text-gray-900 dark:text-white">
            ${course.price || 0}
            {course.discountPrice > 0 && (
              <span className="ml-2 text-green-600 dark:text-green-400">
                ${course.discountPrice}
              </span>
            )}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Chapters:</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {course.totalChapters || 0}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Lessons:</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {course.totalLessons || 0}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Duration:</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {course.totalDuration || 0} min
          </span>
        </div>
      </div>

      {/* Tags */}
      {course.tags?.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs text-gray-500 dark:text-gray-400 mb-4">
          {course.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="whitespace-nowrap rounded-full bg-indigo-50 px-3 py-1 font-medium text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={() => onViewDetails(course)}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
      >
        <FiEye size={16} />
        View Details
      </button>
    </div>
  </div>
);

const MyCourses = () => {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [courseStats, setCourseStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await courseService.getTeacherCourses();
      console.log("Fetched courses:", response);

      const coursesData = response.data || response;
      setCourses(Array.isArray(coursesData) ? coursesData : []);
    } catch (error) {
      console.error("Error fetching courses:", error);
      setError("Failed to load courses. Please try again.");
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (course) => {
    setSelectedCourse(course);
    setShowDetailsModal(true);
    await fetchCourseStats(course._id);
  };

  const fetchCourseStats = async (courseId) => {
    try {
      setLoadingStats(true);
      const response = await courseService.getCourseStats(courseId);
      console.log("Course stats:", response);

      const statsData = response.data || response;
      setCourseStats(statsData);
    } catch (error) {
      console.error("Error fetching course stats:", error);
      setCourseStats(null);
    } finally {
      setLoadingStats(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <FiLoader className="text-4xl text-indigo-600 dark:text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">
          <p className="flex items-center gap-2">
            <span>⚠️</span> {error}
          </p>
          <button
            onClick={fetchCourses}
            className="mt-2 text-sm underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          My Courses
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Overview of all courses you are teaching
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl p-4 border border-indigo-200 dark:border-indigo-800">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Total Courses
          </p>
          <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
            {courses.length}
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl p-4 border border-green-200 dark:border-green-800">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Published
          </p>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">
            {courses.filter((c) => c.status === "published").length}
          </p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-2xl p-4 border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Total Students
          </p>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
            {courses.reduce(
              (sum, course) => sum + (course.totalStudents || 0),
              0,
            )}
          </p>
        </div>
      </div>

      {/* Courses Grid */}
      {courses.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
          <FiBook className="text-4xl text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            No courses yet
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Create your first course to start teaching
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <CourseStatsCard
              key={course._id}
              course={course}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
      )}

      {/* Course Details Modal */}
      {showDetailsModal && selectedCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {selectedCourse.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {selectedCourse.shortDescription ||
                    selectedCourse.description}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setCourseStats(null);
                }}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <span className="text-gray-400 text-xl">✕</span>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Course Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Status
                  </p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white capitalize">
                    {selectedCourse.status}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Level
                  </p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white capitalize">
                    {selectedCourse.level}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Price
                  </p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    ${selectedCourse.price || 0}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Language
                  </p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white capitalize">
                    {selectedCourse.language || "english"}
                  </p>
                </div>
              </div>

              {/* Course Stats */}
              {loadingStats ? (
                <div className="flex items-center justify-center py-8">
                  <FiLoader className="text-2xl text-indigo-600 dark:text-indigo-400 animate-spin" />
                </div>
              ) : courseStats ? (
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <FiBarChart2 className="text-indigo-600 dark:text-indigo-400" />
                    Course Statistics
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Total Enrolled
                      </p>
                      <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                        {courseStats.totalEnrolled || 0}
                      </p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Completion Rate
                      </p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {courseStats.completionRate || 0}%
                      </p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Avg Progress
                      </p>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {courseStats.averageProgress || 0}%
                      </p>
                    </div>
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Rating
                      </p>
                      <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                        {courseStats.rating?.average?.toFixed(1) || "0.0"}/5
                      </p>
                    </div>
                  </div>

                  {/* Additional Stats */}
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Content Overview
                      </p>
                      <div className="mt-2 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            Chapters:
                          </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {courseStats.totalChapters || 0}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            Lessons:
                          </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {courseStats.totalLessons || 0}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            Duration:
                          </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {courseStats.totalDuration || 0} min
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Course Details
                      </p>
                      <div className="mt-2 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            Category:
                          </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {selectedCourse.category || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            Created:
                          </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {selectedCourse.createdAt
                              ? new Date(
                                  selectedCourse.createdAt,
                                ).toLocaleDateString()
                              : "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            Last Updated:
                          </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {selectedCourse.updatedAt
                              ? new Date(
                                  selectedCourse.updatedAt,
                                ).toLocaleDateString()
                              : "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <FiBarChart2 className="text-4xl text-gray-400 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-600 dark:text-gray-400">
                    No statistics available yet
                  </p>
                </div>
              )}

              {/* What You'll Learn */}
              {selectedCourse.whatYouWillLearn?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                    What Students Will Learn
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {selectedCourse.whatYouWillLearn.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="text-green-500 mt-1">✓</span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {item}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Requirements */}
              {selectedCourse.requirements?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                    Requirements
                  </h4>
                  <ul className="list-disc list-inside space-y-1">
                    {selectedCourse.requirements.map((item, idx) => (
                      <li
                        key={idx}
                        className="text-sm text-gray-600 dark:text-gray-400"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Target Audience */}
              {selectedCourse.targetAudience?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                    Target Audience
                  </h4>
                  <ul className="list-disc list-inside space-y-1">
                    {selectedCourse.targetAudience.map((item, idx) => (
                      <li
                        key={idx}
                        className="text-sm text-gray-600 dark:text-gray-400"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyCourses;
