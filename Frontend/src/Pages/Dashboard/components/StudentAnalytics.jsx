// components/Teacher/components/StudentAnalytics.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import teacherService from "../../../services/Teacher/teacherService";
import courseService from "../../../services/Course/CourseService";
import enrollmentService from "../../../services/Course/enrollmentService";

// Icons
import {
  FiUsers,
  FiBook,
  FiTrendingUp,
  FiTarget,
  FiClock,
  FiAward,
  FiBarChart2,
  FiPieChart,
  FiActivity,
  FiChevronRight,
  FiSearch,
  FiFilter,
  FiX,
  FiAlertCircle,
  FiCheckCircle,
  FiRefreshCw,
  FiEye,
  FiStar,
  FiCalendar,
} from "react-icons/fi";

import {
  FaBrain,
  FaGraduationCap,
  FaFire,
  FaTrophy,
  FaMedal,
} from "react-icons/fa";

const toArray = (value) => (Array.isArray(value) ? value : []);

const toId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value?._id?.toString?.() || value?.id?.toString?.() || "";
};

const firstDefined = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const normalizeNumber = (value, fallback = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const toTimestamp = (value) => {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

const averageNumbers = (values = []) => {
  const safeValues = values.filter((value) => Number.isFinite(Number(value)));
  if (safeValues.length === 0) return 0;
  return Math.round(
    safeValues.reduce((sum, value) => sum + Number(value), 0) /
      safeValues.length,
  );
};

const sumNumbers = (values = []) =>
  values.reduce((sum, value) => sum + normalizeNumber(value, 0), 0);

const latestValue = (values = []) => {
  const timestamps = values
    .map((value) => ({ value, timestamp: toTimestamp(value) }))
    .filter((entry) => entry.timestamp !== null)
    .sort((left, right) => right.timestamp - left.timestamp);

  return timestamps[0]?.value || null;
};

const earliestValue = (values = []) => {
  const timestamps = values
    .map((value) => ({ value, timestamp: toTimestamp(value) }))
    .filter((entry) => entry.timestamp !== null)
    .sort((left, right) => left.timestamp - right.timestamp);

  return timestamps[0]?.value || null;
};

const uniqueValues = (values = []) =>
  Array.from(new Set(values.filter(Boolean).map((value) => value.toString())));

const formatStudentName = (student) =>
  firstDefined(
    student?.name,
    student?.studentName,
    student?.fullName,
    student?.student?.name,
    student?.student?.studentName,
    student?.student?.fullName,
    student?.profile?.fullName,
    "Unknown Student",
  );

const formatStudentEmail = (student) =>
  firstDefined(
    student?.email,
    student?.studentEmail,
    student?.student?.email,
    student?.student?.studentEmail,
    student?.profile?.email,
    "",
  );

const normalizeStudent = (record = {}) => {
  const nestedStudent =
    record && typeof record.student === "object" ? record.student : {};

  const enrolledCourses = uniqueValues(
    [
      ...toArray(record.enrolledInCourses),
      ...toArray(record.enrolledCourses),
      ...toArray(nestedStudent.enrolledInCourses),
      ...toArray(nestedStudent.enrolledCourses),
    ].map((courseId) => toId(courseId)),
  );

  return {
    ...record,
    _id:
      toId(record._id) ||
      toId(nestedStudent._id) ||
      toId(record.studentId) ||
      toId(nestedStudent.studentId),
    name: formatStudentName({ ...record, student: nestedStudent }),
    email: formatStudentEmail({ ...record, student: nestedStudent }),
    studentId: firstDefined(record.studentId, nestedStudent.studentId, ""),
    enrolledCourses,
    enrolledInCourses: enrolledCourses,
  };
};

const normalizeEnrollmentRow = (record, teacherCoursesMap, enrollment = {}) => {
  const student = normalizeStudent(record);
  const nestedEnrollmentStudent =
    enrollment && typeof enrollment.student === "object"
      ? enrollment.student
      : {};
  const courseId =
    toId(
      enrollment.courseId ||
        enrollment.course?._id ||
        enrollment.course ||
        record.courseId ||
        record.course,
    ) || "";
  const course = teacherCoursesMap.get(courseId);
  const enrollmentStudent =
    Object.keys(nestedEnrollmentStudent).length > 0
      ? { ...student, ...nestedEnrollmentStudent }
      : student;

  return {
    enrollmentId:
      enrollment.enrollmentId ||
      enrollment._id ||
      `${student._id || nestedEnrollmentStudent._id || "student"}_${courseId || "course"}`,
    student: {
      ...enrollmentStudent,
      _id:
        toId(enrollmentStudent._id) ||
        toId(enrollment.studentId) ||
        toId(record.studentId),
      name: formatStudentName(enrollmentStudent),
      email: formatStudentEmail(enrollmentStudent),
    },
    courseId,
    courseTitle:
      enrollment.courseTitle ||
      course?.title ||
      record.courseTitle ||
      "Unknown Course",
    progress: normalizeNumber(
      firstDefined(
        enrollment.progress?.overallProgress,
        enrollment.progress,
        record.progress?.overallProgress,
        record.progress,
      ),
      0,
    ),
    completedLessons: normalizeNumber(
      firstDefined(
        enrollment.completedLessons,
        enrollment.progress?.completedLessons?.length,
        record.progress?.completedLessons?.length,
        record.completedLessons,
      ),
      0,
    ),
    averageQuizScore: normalizeNumber(
      firstDefined(
        enrollment.averageQuizScore,
        enrollment.learningMetrics?.averageQuizScore,
        record.learningMetrics?.averageQuizScore,
        record.averageQuizScore,
      ),
      0,
    ),
    averageAssignmentScore: normalizeNumber(
      firstDefined(
        enrollment.averageAssignmentScore,
        enrollment.learningMetrics?.averageAssignmentScore,
        record.learningMetrics?.averageAssignmentScore,
        record.averageAssignmentScore,
      ),
      0,
    ),
    totalTimeSpent: normalizeNumber(
      firstDefined(
        enrollment.totalTimeSpent,
        enrollment.learningMetrics?.totalTimeSpent,
        record.learningMetrics?.totalTimeSpent,
        record.totalTimeSpent,
      ),
      0,
    ),
    studyStreak: normalizeNumber(
      firstDefined(
        enrollment.studyStreak,
        enrollment.learningMetrics?.studyStreak,
        record.learningMetrics?.studyStreak,
        record.studyStreak,
      ),
      0,
    ),
    longestStreak: normalizeNumber(
      firstDefined(
        enrollment.longestStreak,
        enrollment.learningMetrics?.longestStreak,
        record.learningMetrics?.longestStreak,
        record.longestStreak,
      ),
      0,
    ),
    enrollmentStatus:
      firstDefined(
        enrollment.enrollmentStatus,
        record.enrollmentStatus,
        "active",
      ) || "active",
    enrolledAt:
      firstDefined(
        enrollment.enrolledAt,
        record.enrolledAt,
        course?.createdAt,
      ) || new Date().toISOString(),
    lastActivity:
      firstDefined(
        enrollment.lastActivity,
        enrollment.learningMetrics?.lastActivityAt,
        record.lastActivity,
        record.learningMetrics?.lastActivityAt,
      ) || null,
  };
};

const aggregateStudentRows = (rows = []) => {
  const groupedRows = new Map();

  rows.forEach((row) => {
    const studentKey =
      row.student?._id ||
      row.student?.studentId ||
      row.student?.email ||
      row.student?.name;
    const key = studentKey ? studentKey.toString() : row.enrollmentId;
    const existingRow = groupedRows.get(key);

    if (!existingRow) {
      groupedRows.set(key, {
        ...row,
        courseIds: row.courseId ? [row.courseId] : [],
        courseTitles: row.courseTitle ? [row.courseTitle] : [],
        enrollments: [row],
      });
      return;
    }

    existingRow.enrollments.push(row);
    if (row.courseId) {
      existingRow.courseIds.push(row.courseId);
    }
    if (row.courseTitle) {
      existingRow.courseTitles.push(row.courseTitle);
    }
  });

  return Array.from(groupedRows.values()).map((row) => {
    const enrollments = row.enrollments || [];
    const courseIds = uniqueValues(row.courseIds);
    const courseTitles = uniqueValues(row.courseTitles);

    const progressValues = enrollments.map((enrollment) => enrollment.progress);
    const quizValues = enrollments.map(
      (enrollment) => enrollment.averageQuizScore,
    );
    const assignmentValues = enrollments.map(
      (enrollment) => enrollment.averageAssignmentScore,
    );
    const timeSpentValues = enrollments.map(
      (enrollment) => enrollment.totalTimeSpent,
    );
    const streakValues = enrollments.map(
      (enrollment) => enrollment.studyStreak,
    );
    const longestStreakValues = enrollments.map(
      (enrollment) => enrollment.longestStreak,
    );
    const completedLessonsValues = enrollments.map(
      (enrollment) => enrollment.completedLessons,
    );
    const enrolledAtValues = enrollments.map(
      (enrollment) => enrollment.enrolledAt,
    );
    const lastActivityValues = enrollments.map(
      (enrollment) => enrollment.lastActivity,
    );

    const statuses = enrollments.map(
      (enrollment) => enrollment.enrollmentStatus,
    );
    const enrollmentStatus = statuses.includes("active")
      ? "active"
      : statuses.includes("paused")
        ? "paused"
        : statuses.includes("completed")
          ? "completed"
          : statuses.includes("dropped")
            ? "dropped"
            : row.enrollmentStatus || "active";

    return {
      ...row,
      student: {
        ...row.student,
        enrolledCourses: courseIds,
        enrolledInCourses: courseIds,
      },
      courseId: row.courseId || courseIds[0] || "",
      courseTitle: row.courseTitle || courseTitles[0] || "Unknown Course",
      courseIds,
      courseTitles,
      courseCount: courseTitles.length || courseIds.length,
      progress: averageNumbers(progressValues),
      completedLessons: sumNumbers(completedLessonsValues),
      averageQuizScore: averageNumbers(quizValues),
      averageAssignmentScore: averageNumbers(assignmentValues),
      totalTimeSpent: sumNumbers(timeSpentValues),
      studyStreak: Math.max(
        0,
        ...streakValues.map((value) => normalizeNumber(value, 0)),
      ),
      longestStreak: Math.max(
        0,
        ...longestStreakValues.map((value) => normalizeNumber(value, 0)),
      ),
      enrollmentStatus,
      enrolledAt: earliestValue(enrolledAtValues) || row.enrolledAt,
      lastActivity: latestValue(lastActivityValues) || row.lastActivity,
    };
  });
};

const extractEnrollmentRows = (students = [], teacherCourses = []) => {
  const teacherCoursesMap = new Map(
    teacherCourses
      .map((course) => [toId(course._id || course.id), course])
      .filter(([courseId]) => Boolean(courseId)),
  );

  const rows = [];

  students.forEach((record) => {
    const student = normalizeStudent(record);
    const enrollments = toArray(record.enrollments);

    if (enrollments.length > 0) {
      enrollments.forEach((enrollment) => {
        rows.push(
          normalizeEnrollmentRow(record, teacherCoursesMap, enrollment),
        );
      });
      return;
    }

    if (student.enrolledCourses.length > 0) {
      student.enrolledCourses.forEach((courseId) => {
        rows.push(
          normalizeEnrollmentRow(record, teacherCoursesMap, {
            courseId,
            courseTitle: teacherCoursesMap.get(courseId)?.title,
            enrolledAt: record.enrolledAt,
            progress: record.progress,
            learningMetrics: record.learningMetrics,
            enrollmentStatus: record.enrollmentStatus,
          }),
        );
      });
      return;
    }

    rows.push(normalizeEnrollmentRow(record, teacherCoursesMap));
  });

  return aggregateStudentRows(rows);
};

const StudentAnalytics = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCourse, setFilterCourse] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [enrollments, setEnrollments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentDetail, setStudentDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch teacher's courses using CourseService
      const coursesResponse = await courseService.getTeacherCourses();
      let teacherCourses = [];
      if (Array.isArray(coursesResponse)) {
        teacherCourses = coursesResponse;
      } else if (coursesResponse?.data && Array.isArray(coursesResponse.data)) {
        teacherCourses = coursesResponse.data;
      } else if (
        coursesResponse?.success &&
        Array.isArray(coursesResponse.data)
      ) {
        teacherCourses = coursesResponse.data;
      }
      setCourses(teacherCourses);

      try {
        const analyticsResponse =
          await teacherService.getStudentsForAnalytics();
        const analyticsStudents =
          analyticsResponse?.data || analyticsResponse || [];

        if (Array.isArray(analyticsStudents) && analyticsStudents.length > 0) {
          setEnrollments(
            extractEnrollmentRows(analyticsStudents, teacherCourses),
          );
          return;
        }
      } catch (err) {
        console.warn(
          "Could not fetch aggregated student analytics:",
          err.message,
        );
      }

      // Fetch students in teacher's courses
      const allEnrollments = [];

      // Try to get students via teacher service
      try {
        const studentsResponse = await teacherService.getStudentsInMyCourses();
        const students = studentsResponse?.data || studentsResponse || [];

        if (Array.isArray(students) && students.length > 0) {
          // Map students to enrollment format
          students.forEach((student) => {
            const enrolledCourses = student.enrolledInCourses || [];
            enrolledCourses.forEach((courseId) => {
              const course = teacherCourses.find(
                (c) => (c._id || c.id)?.toString() === courseId?.toString(),
              );
              allEnrollments.push({
                enrollmentId: `${student._id}_${courseId}`,
                student: {
                  _id: student._id,
                  name: student.name,
                  email: student.email,
                  studentId: student.studentId,
                },
                courseId: courseId,
                courseTitle: course?.title || "Unknown Course",
                progress: student.progress?.overallProgress || 0,
                completedLessons:
                  student.progress?.completedLessons?.length || 0,
                averageQuizScore:
                  student.learningMetrics?.averageQuizScore || 0,
                averageAssignmentScore:
                  student.learningMetrics?.averageAssignmentScore || 0,
                totalTimeSpent: student.learningMetrics?.totalTimeSpent || 0,
                studyStreak: student.learningMetrics?.studyStreak || 0,
                longestStreak: student.learningMetrics?.longestStreak || 0,
                enrollmentStatus: student.enrollmentStatus || "active",
                enrolledAt: student.enrolledAt || new Date().toISOString(),
                lastActivity: student.learningMetrics?.lastActivityAt || null,
              });
            });
          });
        }
      } catch (err) {
        console.warn(
          "Could not fetch students via teacher service:",
          err.message,
        );
      }

      // If no students from teacher service, try fetching per course
      if (allEnrollments.length === 0) {
        for (const course of teacherCourses) {
          try {
            const courseId = course._id || course.id;
            const perfResponse =
              await enrollmentService.getCourseStudentsPerformance(courseId);

            if (perfResponse?.data?.students) {
              const courseStudents = perfResponse.data.students.map((s) => ({
                enrollmentId: s.enrollmentId || `${s.student?._id}_${courseId}`,
                student: s.student || {
                  _id: s.studentId,
                  name: s.studentName || "Student",
                },
                courseId: courseId,
                courseTitle: course.title,
                progress: s.progress || 0,
                completedLessons: s.completedLessons || 0,
                averageQuizScore: s.averageQuizScore || 0,
                averageAssignmentScore: s.averageAssignmentScore || 0,
                totalTimeSpent: s.totalTimeSpent || 0,
                studyStreak: s.studyStreak || 0,
                longestStreak: s.longestStreak || 0,
                enrollmentStatus: s.enrollmentStatus || "active",
                enrolledAt: s.enrolledAt || course.createdAt,
                lastActivity: s.lastActivity || null,
              }));
              allEnrollments.push(...courseStudents);
            }
          } catch (err) {
            console.warn(
              `Could not fetch students for course ${course.title}:`,
              err.message,
            );
          }
        }
      }

      // If still no students, try fetching enrollments directly from each course
      if (allEnrollments.length === 0 && teacherCourses.length > 0) {
        for (const course of teacherCourses) {
          try {
            const courseId = course._id || course.id;
            const courseData = await courseService.getCourse(courseId);

            if (courseData?.data?.students || courseData?.students) {
              const students =
                courseData.data?.students || courseData.students || [];
              students.forEach((student) => {
                allEnrollments.push({
                  enrollmentId: `${student._id || student}_${courseId}`,
                  student:
                    typeof student === "object"
                      ? student
                      : { _id: student, name: "Student" },
                  courseId: courseId,
                  courseTitle: course.title,
                  progress: 0,
                  completedLessons: 0,
                  averageQuizScore: 0,
                  totalTimeSpent: 0,
                  studyStreak: 0,
                  enrollmentStatus: "active",
                  enrolledAt: course.createdAt || new Date().toISOString(),
                });
              });
            }
          } catch (err) {
            console.warn(
              `Could not fetch course details for ${course.title}:`,
              err.message,
            );
          }
        }
      }

      setEnrollments(extractEnrollmentRows(allEnrollments, teacherCourses));
    } catch (err) {
      console.error("Error loading student data:", err);
      setError("Failed to load student data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleViewStudentDetail = async (student) => {
    try {
      setDetailLoading(true);
      setSelectedStudent(student);

      const resolvedStudentId =
        student.student?._id ||
        student.studentId ||
        student._id ||
        student.student?.studentId ||
        student.student?.id;
      const resolvedCourseId = student.courseId || student.courseIds?.[0] || "";

      if (!resolvedStudentId || !resolvedCourseId) {
        setStudentDetail({
          enrollment: {
            enrollmentStatus: student.enrollmentStatus || "active",
            enrolledAt: student.enrolledAt,
          },
          progress: {
            overallProgress: student.progress || 0,
            completedLessons: Array(student.completedLessons || 0).fill({}),
            completedQuizzes: [],
            completedAssignments: [],
          },
          learningMetrics: {
            averageQuizScore: student.averageQuizScore || 0,
            averageAssignmentScore: student.averageAssignmentScore || 0,
            totalTimeSpent: student.totalTimeSpent || 0,
            studyStreak: student.studyStreak || 0,
            longestStreak: student.longestStreak || 0,
            lastActivityAt: student.lastActivity,
          },
        });
        return;
      }

      // Try to get detailed performance via enrollment service
      try {
        const response = await enrollmentService.getStudentPerformanceDetail(
          resolvedStudentId,
          resolvedCourseId,
        );

        if (response?.data || response) {
          const detailData = response.data || response;
          setStudentDetail({
            ...detailData,
            student: detailData.student || student.student || student,
            // Ensure required fields exist
            progress: detailData.progress || {
              overallProgress: student.progress || 0,
            },
            learningMetrics: detailData.learningMetrics || {
              averageQuizScore: student.averageQuizScore || 0,
              averageAssignmentScore: student.averageAssignmentScore || 0,
              totalTimeSpent: student.totalTimeSpent || 0,
              studyStreak: student.studyStreak || 0,
              longestStreak: student.longestStreak || 0,
            },
          });
          return;
        }
      } catch (err) {
        console.warn("Could not fetch detailed performance:", err.message);
      }

      // Fallback: use the enrollment data we already have
      setStudentDetail({
        enrollment: {
          enrollmentStatus: student.enrollmentStatus || "active",
          enrolledAt: student.enrolledAt,
        },
        progress: {
          overallProgress: student.progress || 0,
          completedLessons: Array(student.completedLessons || 0).fill({}),
          completedQuizzes: [],
          completedAssignments: [],
        },
        learningMetrics: {
          averageQuizScore: student.averageQuizScore || 0,
          averageAssignmentScore: student.averageAssignmentScore || 0,
          totalTimeSpent: student.totalTimeSpent || 0,
          studyStreak: student.studyStreak || 0,
          longestStreak: student.longestStreak || 0,
          lastActivityAt: student.lastActivity,
        },
      });
    } catch (err) {
      console.error("Error loading student detail:", err);
      setError("Failed to load student details");
    } finally {
      setDetailLoading(false);
    }
  };

  const filteredEnrollments = enrollments.filter((enrollment) => {
    const studentName = formatStudentName(enrollment.student);
    const studentEmail = formatStudentEmail(enrollment.student);
    const courseText = [
      enrollment.courseTitle,
      ...(enrollment.courseTitles || []),
    ]
      .filter(Boolean)
      .join(" ");
    const matchesSearch =
      studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      studentEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      courseText.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCourse =
      filterCourse === "all" ||
      [enrollment.courseId, ...(enrollment.courseIds || [])].some(
        (courseId) => toId(courseId) === toId(filterCourse),
      );
    const matchesStatus =
      filterStatus === "all" || enrollment.enrollmentStatus === filterStatus;
    return matchesSearch && matchesCourse && matchesStatus;
  });

  const getProgressColor = (progress) => {
    if (progress >= 80) return "bg-green-500";
    if (progress >= 60) return "bg-blue-500";
    if (progress >= 40) return "bg-yellow-500";
    if (progress >= 20) return "bg-orange-500";
    return "bg-red-500";
  };

  const getStatusBadge = (status) => {
    const badges = {
      active:
        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
      completed:
        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
      dropped: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
      paused:
        "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    };
    return badges[status] || badges.active;
  };

  const getPerformanceBadge = (avgQuizScore) => {
    if (avgQuizScore >= 80)
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
    if (avgQuizScore >= 60)
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
    if (avgQuizScore >= 40)
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  };

  const formatTime = (seconds) => {
    if (!seconds) return "0h 0m";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Statistics calculations
  const totalStudents = new Set(
    enrollments.map((e) => e.student?._id || e.studentId),
  ).size;
  const activeStudents = new Set(
    enrollments
      .filter((e) => e.enrollmentStatus === "active")
      .map((e) => e.student?._id || e.studentId),
  ).size;
  const completedStudents = new Set(
    enrollments
      .filter((e) => e.enrollmentStatus === "completed")
      .map((e) => e.student?._id || e.studentId),
  ).size;
  const averageProgress =
    enrollments.length > 0
      ? Math.round(
          enrollments.reduce((sum, e) => sum + (e.progress || 0), 0) /
            enrollments.length,
        )
      : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-500 dark:text-gray-400">
            Loading student analytics...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Student Analytics
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Monitor student progress and performance across your courses
          </p>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors flex items-center gap-2"
        >
          <FiRefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-3">
          <FiAlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto">
            <FiX className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            icon: FiUsers,
            label: "Total Students",
            value: totalStudents,
            color: "from-blue-500 to-indigo-600",
          },
          {
            icon: FiActivity,
            label: "Active Students",
            value: activeStudents,
            color: "from-green-500 to-emerald-600",
          },
          {
            icon: FiAward,
            label: "Completed",
            value: completedStudents,
            color: "from-purple-500 to-pink-600",
          },
          {
            icon: FiTrendingUp,
            label: "Avg Progress",
            value: `${averageProgress}%`,
            color: "from-orange-500 to-red-600",
          },
        ].map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm"
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

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student name or email..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterCourse}
            onChange={(e) => setFilterCourse(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            <option value="all">All Courses</option>
            {courses.map((course) => (
              <option key={course._id} value={course._id}>
                {course.title}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="dropped">Dropped</option>
            <option value="paused">Paused</option>
          </select>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50">
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Student
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Course
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Progress
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Quiz Score
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Time Spent
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredEnrollments.length > 0 ? (
                filteredEnrollments.map((enrollment, index) => (
                  <tr
                    key={enrollment.enrollmentId || index}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                          {(
                            formatStudentName(enrollment.student).charAt(0) ||
                            "S"
                          ).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white text-sm">
                            {formatStudentName(enrollment.student)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatStudentEmail(enrollment.student)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900 dark:text-white">
                        {enrollment.courseTitle}
                        {enrollment.courseCount > 1 ? (
                          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                            +{enrollment.courseCount - 1} more
                          </span>
                        ) : null}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${getProgressColor(enrollment.progress || 0)}`}
                            style={{ width: `${enrollment.progress || 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {enrollment.progress || 0}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getPerformanceBadge(enrollment.averageQuizScore || 0)}`}
                      >
                        {Math.round(enrollment.averageQuizScore || 0)}%
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                        <FiClock className="w-3 h-3" />
                        {formatTime(enrollment.totalTimeSpent || 0)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusBadge(enrollment.enrollmentStatus)}`}
                      >
                        {enrollment.enrollmentStatus || "active"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleViewStudentDetail(enrollment)}
                        className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors flex items-center gap-1"
                      >
                        <FiEye className="w-3 h-3" />
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center">
                    <FiUsers className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">
                      No students found matching your criteria
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Detail Modal/Panel */}
      <AnimatePresence>
        {selectedStudent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              setSelectedStudent(null);
              setStudentDetail(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                    {(
                      formatStudentName(selectedStudent.student).charAt(0) ||
                      "S"
                    ).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {formatStudentName(selectedStudent.student)}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {formatStudentEmail(selectedStudent.student)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedStudent(null);
                    setStudentDetail(null);
                  }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6">
                {detailLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-200 border-t-indigo-600"></div>
                  </div>
                ) : studentDetail ? (
                  <div className="space-y-6">
                    {/* Performance Overview Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        {
                          icon: FiTarget,
                          label: "Accuracy",
                          value: `${Math.round(studentDetail.progress?.overallProgress || selectedStudent.progress || 0)}%`,
                          color: "from-blue-500 to-indigo-600",
                        },
                        {
                          icon: FiAward,
                          label: "Quiz Score",
                          value: `${Math.round(studentDetail.learningMetrics?.averageQuizScore || selectedStudent.averageQuizScore || 0)}%`,
                          color: "from-green-500 to-emerald-600",
                        },
                        {
                          icon: FaFire,
                          label: "Study Streak",
                          value: `${studentDetail.learningMetrics?.studyStreak || selectedStudent.studyStreak || 0} days`,
                          color: "from-orange-500 to-red-600",
                        },
                        {
                          icon: FiClock,
                          label: "Total Time",
                          value: formatTime(
                            studentDetail.learningMetrics?.totalTimeSpent ||
                              selectedStudent.totalTimeSpent ||
                              0,
                          ),
                          color: "from-purple-500 to-pink-600",
                        },
                      ].map((stat, idx) => {
                        const Icon = stat.icon;
                        return (
                          <div
                            key={idx}
                            className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-4 border border-gray-200 dark:border-gray-600"
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

                    {/* Course Info */}
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white">
                      <h4 className="text-lg font-semibold mb-2">
                        {selectedStudent.courseCount > 1
                          ? `${selectedStudent.courseTitle} +${selectedStudent.courseCount - 1} more`
                          : selectedStudent.courseTitle}
                      </h4>
                      {selectedStudent.courseTitles?.length > 1 ? (
                        <p className="text-sm text-indigo-100 mb-3">
                          Courses: {selectedStudent.courseTitles.join(", ")}
                        </p>
                      ) : null}
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-indigo-100">
                          Status:{" "}
                          <span className="font-medium capitalize">
                            {selectedStudent.enrollmentStatus}
                          </span>
                        </span>
                        <span className="text-indigo-100">
                          Enrolled: {formatDate(selectedStudent.enrolledAt)}
                        </span>
                        {selectedStudent.lastActivity && (
                          <span className="text-indigo-100">
                            Last Active:{" "}
                            {formatDate(selectedStudent.lastActivity)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Detailed Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Progress Details */}
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-6 border border-gray-200 dark:border-gray-600">
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                          <FiBarChart2 className="w-5 h-5 text-indigo-600" />
                          Progress Details
                        </h4>
                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-600 dark:text-gray-400">
                                Overall Progress
                              </span>
                              <span className="font-medium text-indigo-600">
                                {studentDetail.progress?.overallProgress ||
                                  selectedStudent.progress ||
                                  0}
                                %
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3">
                              <div
                                className={`h-3 rounded-full ${getProgressColor(studentDetail.progress?.overallProgress || selectedStudent.progress || 0)}`}
                                style={{
                                  width: `${studentDetail.progress?.overallProgress || selectedStudent.progress || 0}%`,
                                }}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white dark:bg-gray-800 p-3 rounded-xl text-center">
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Lessons Completed
                              </p>
                              <p className="text-xl font-bold text-gray-900 dark:text-white">
                                {studentDetail.progress?.completedLessons
                                  ?.length ||
                                  selectedStudent.completedLessons ||
                                  0}
                              </p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-3 rounded-xl text-center">
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Avg Quiz Score
                              </p>
                              <p className="text-xl font-bold text-gray-900 dark:text-white">
                                {Math.round(
                                  studentDetail.learningMetrics
                                    ?.averageQuizScore ||
                                    selectedStudent.averageQuizScore ||
                                    0,
                                )}
                                %
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Learning Metrics */}
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-6 border border-gray-200 dark:border-gray-600">
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                          <FiActivity className="w-5 h-5 text-indigo-600" />
                          Learning Metrics
                        </h4>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white dark:bg-gray-800 p-3 rounded-xl text-center">
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Study Streak
                              </p>
                              <p className="text-xl font-bold text-gray-900 dark:text-white">
                                {studentDetail.learningMetrics?.studyStreak ||
                                  selectedStudent.studyStreak ||
                                  0}
                              </p>
                              <p className="text-xs text-gray-400">days</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-3 rounded-xl text-center">
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Longest Streak
                              </p>
                              <p className="text-xl font-bold text-gray-900 dark:text-white">
                                {studentDetail.learningMetrics?.longestStreak ||
                                  selectedStudent.longestStreak ||
                                  0}
                              </p>
                              <p className="text-xs text-gray-400">days</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-3 rounded-xl text-center">
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Total Time
                              </p>
                              <p className="text-xl font-bold text-gray-900 dark:text-white">
                                {formatTime(
                                  studentDetail.learningMetrics
                                    ?.totalTimeSpent ||
                                    selectedStudent.totalTimeSpent ||
                                    0,
                                )}
                              </p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-3 rounded-xl text-center">
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Avg Assignment
                              </p>
                              <p className="text-xl font-bold text-gray-900 dark:text-white">
                                {Math.round(
                                  studentDetail.learningMetrics
                                    ?.averageAssignmentScore ||
                                    selectedStudent.averageAssignmentScore ||
                                    0,
                                )}
                                %
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Completion Stats */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-6 border border-gray-200 dark:border-gray-600">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <FiPieChart className="w-5 h-5 text-indigo-600" />
                        Completion Statistics
                      </h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl text-center">
                          <p className="text-2xl font-bold text-green-600">
                            {studentDetail.progress?.completedLessons?.length ||
                              selectedStudent.completedLessons ||
                              0}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Lessons Done
                          </p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl text-center">
                          <p className="text-2xl font-bold text-blue-600">
                            {studentDetail.progress?.completedQuizzes?.length ||
                              0}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Quizzes Taken
                          </p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl text-center">
                          <p className="text-2xl font-bold text-purple-600">
                            {studentDetail.progress?.completedAssignments
                              ?.length || 0}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Assignments
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FiUsers className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">
                      No detailed data available for this student
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StudentAnalytics;
