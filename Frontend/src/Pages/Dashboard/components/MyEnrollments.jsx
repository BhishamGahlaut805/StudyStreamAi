import React, { useState, useEffect } from "react";
import {
  FiSearch,
  FiFilter,
  FiTrash2,
  FiLoader,
  FiUsers,
  FiAlertCircle,
} from "react-icons/fi";
import teacherService from "../../../services/Teacher/teacherService";

const toId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value?._id?.toString?.() || value?.id?.toString?.() || "";
};

const toArray = (value) => (Array.isArray(value) ? value : []);

const pickFirst = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const deepPick = (source, keys = [], maxDepth = 4) => {
  const visited = new Set();
  const queue = [{ value: source, depth: 0 }];

  while (queue.length > 0) {
    const { value, depth } = queue.shift();

    if (!isPlainObject(value) || visited.has(value) || depth > maxDepth) {
      continue;
    }

    visited.add(value);

    for (const key of keys) {
      if (
        value[key] !== undefined &&
        value[key] !== null &&
        value[key] !== ""
      ) {
        return value[key];
      }
    }

    Object.values(value).forEach((child) => {
      if (isPlainObject(child)) {
        queue.push({ value: child, depth: depth + 1 });
      } else if (Array.isArray(child)) {
        child.forEach((item) => {
          if (isPlainObject(item)) {
            queue.push({ value: item, depth: depth + 1 });
          }
        });
      }
    });
  }

  return "";
};

const normalizeCourse = (course = {}) => ({
  ...course,
  _id:
    toId(course._id) ||
    toId(course.id) ||
    toId(course.courseId) ||
    toId(course.course?._id),
  title: pickFirst(
    course.title,
    course.courseTitle,
    course.name,
    course.courseName,
    course.subject,
    "Unknown Course",
  ),
});

const resolveStudentName = (student = {}) =>
  pickFirst(
    student.name,
    student.studentName,
    student.fullName,
    student.displayName,
    student.username,
    student.userName,
    student.profile?.fullName,
    student.profile?.name,
    student.profile?.displayName,
    student.user?.name,
    student.user?.fullName,
    student.account?.name,
    student.account?.fullName,
    student.enrollment?.student?.name,
    student.enrollment?.student?.fullName,
    deepPick(student, ["name", "studentName", "fullName", "displayName"], 3),
    deepPick(student, ["name", "studentName", "fullName", "displayName"], 3),
    "Unknown Student",
  );

const resolveStudentEmail = (student = {}) =>
  pickFirst(
    student.email,
    student.studentEmail,
    student.additionalEmail,
    student.contactEmail,
    student.profile?.email,
    student.profile?.additionalEmail,
    student.user?.email,
    student.account?.email,
    student.enrollment?.student?.email,
    deepPick(
      student,
      ["email", "studentEmail", "additionalEmail", "contactEmail"],
      3,
    ),
    "",
  );

const resolveStudentDisplayCourses = (
  student = {},
  courseLookup = new Map(),
) => {
  const rawCourseIds = [
    ...toArray(student.enrolledInCourses),
    ...toArray(student.enrolledCourses),
    ...toArray(student.courseIds),
    ...toArray(student.courseId ? [student.courseId] : []),
    ...toArray(student.courses),
    ...toArray(student.enrollment?.courseIds),
    ...toArray(
      student.enrollment?.courseId ? [student.enrollment.courseId] : [],
    ),
    ...toArray(student.student?.enrolledCourses),
    ...toArray(student.student?.enrolledInCourses),
  ]
    .map((courseId) => toId(courseId))
    .filter(Boolean);

  const rawTitles = [
    ...toArray(student.enrolledCourseTitles),
    ...toArray(student.courseTitles),
    ...toArray(student.enrollment?.courseTitles),
    ...toArray(student.courseDisplayNames),
    ...toArray(student.student?.courseTitles),
  ]
    .map((value) => {
      if (typeof value === "string") {
        return value.trim();
      }
      return (
        pickFirst(
          value?.title,
          value?.courseTitle,
          value?.name,
          value?.courseName,
          value?.subject,
          "",
        )?.trim?.() || ""
      );
    })
    .filter(Boolean);

  const resolvedTitles = rawCourseIds
    .map((courseId) => courseLookup.get(courseId)?.title || courseId)
    .filter(Boolean);

  return Array.from(new Set([...resolvedTitles, ...rawTitles]));
};

const buildCourseLookup = (courses = []) =>
  new Map(courses.map((course) => [toId(course._id || course.id), course]));

const normalizeStudent = (student = {}, courseLookup = new Map()) => {
  const nestedStudent =
    student && typeof student.student === "object" ? student.student : {};
  const enrolledCourses = [
    ...toArray(student.enrolledInCourses),
    ...toArray(student.enrolledCourses),
    ...toArray(student.courseIds),
    ...toArray(student.courseId ? [student.courseId] : []),
    ...toArray(student.courses),
    ...toArray(nestedStudent.enrolledInCourses),
    ...toArray(nestedStudent.enrolledCourses),
    ...toArray(nestedStudent.courseIds),
    ...toArray(nestedStudent.courseId ? [nestedStudent.courseId] : []),
    ...toArray(nestedStudent.courses),
    ...toArray(student.enrollment?.courseIds),
    ...toArray(
      student.enrollment?.courseId ? [student.enrollment.courseId] : [],
    ),
  ]
    .map((courseId) => toId(courseId))
    .filter(Boolean);

  const allCourseTitles = resolveStudentDisplayCourses(student, courseLookup);
  const displayName = resolveStudentName({
    ...student,
    student: nestedStudent,
  });
  const displayEmail = resolveStudentEmail({
    ...student,
    student: nestedStudent,
  });

  return {
    ...student,
    _id:
      toId(student._id) ||
      toId(nestedStudent._id) ||
      toId(student.studentId) ||
      toId(nestedStudent.studentId) ||
      toId(displayEmail) ||
      toId(displayName),
    name: displayName,
    studentName: displayName,
    fullName: displayName,
    email: displayEmail,
    studentEmail: displayEmail,
    enrolledCourses,
    enrolledInCourses: enrolledCourses,
    enrolledCourseTitles: allCourseTitles,
    primaryCourseTitle: allCourseTitles[0] || "",
    displayName,
    displayEmail,
  };
};

const unwrapResponseList = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  if (Array.isArray(response?.students)) return response.students;
  if (Array.isArray(response?.data?.students)) return response.data.students;
  if (Array.isArray(response?.data?.courses)) return response.data.courses;
  return [];
};

const mergeStudentRecords = (records = [], courseLookup = new Map()) => {
  const mergedStudents = new Map();

  records.forEach((record) => {
    const normalized = normalizeStudent(record, courseLookup);
    const identity =
      normalized._id ||
      normalized.studentId ||
      normalized.email ||
      normalized.name ||
      normalized.primaryCourseTitle ||
      JSON.stringify(normalized.enrolledCourses || []);

    const existing = mergedStudents.get(identity);

    if (!existing) {
      mergedStudents.set(identity, normalized);
      return;
    }

    const mergedCourseIds = Array.from(
      new Set([
        ...toArray(existing.enrolledCourses),
        ...toArray(normalized.enrolledCourses),
      ]),
    );
    const mergedCourseTitles = Array.from(
      new Set([
        ...toArray(existing.enrolledCourseTitles),
        ...toArray(normalized.enrolledCourseTitles),
      ]),
    );

    mergedStudents.set(identity, {
      ...existing,
      ...normalized,
      name: pickFirst(
        existing.name,
        normalized.name,
        existing.displayName,
        normalized.displayName,
        "Unknown Student",
      ),
      studentName: pickFirst(
        existing.studentName,
        normalized.studentName,
        existing.name,
        normalized.name,
        "Unknown Student",
      ),
      fullName: pickFirst(
        existing.fullName,
        normalized.fullName,
        existing.name,
        normalized.name,
        "Unknown Student",
      ),
      email: pickFirst(
        existing.email,
        normalized.email,
        existing.studentEmail,
        normalized.studentEmail,
        "",
      ),
      studentEmail: pickFirst(
        existing.studentEmail,
        normalized.studentEmail,
        existing.email,
        normalized.email,
        "",
      ),
      displayName: pickFirst(
        existing.displayName,
        normalized.displayName,
        existing.name,
        normalized.name,
        "Unknown Student",
      ),
      displayEmail: pickFirst(
        existing.displayEmail,
        normalized.displayEmail,
        existing.email,
        normalized.email,
        "",
      ),
      enrolledCourses: mergedCourseIds,
      enrolledInCourses: mergedCourseIds,
      enrolledCourseTitles: mergedCourseTitles,
      primaryCourseTitle:
        mergedCourseTitles[0] ||
        existing.primaryCourseTitle ||
        normalized.primaryCourseTitle ||
        "",
    });
  });

  return Array.from(mergedStudents.values());
};

const MyEnrollments = () => {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    fetchEnrollmentData();
  }, []);

  useEffect(() => {
    filterStudents();
  }, [students, searchTerm, selectedCourse]);

  const fetchEnrollmentData = async () => {
    try {
      setLoading(true);
      // Fetch students and courses
      const [analyticsRes, studentsRes, coursesRes] = await Promise.allSettled([
        teacherService.getStudentsForAnalytics(),
        teacherService.getStudentsInMyCourses(),
        teacherService.getTeacherCourses(),
      ]);

      const normalizedCourses = unwrapResponseList(
        coursesRes.status === "fulfilled" ? coursesRes.value : null,
      )
        .map(normalizeCourse)
        .filter((course) => course._id || course.title);

      const courseLookup = buildCourseLookup(normalizedCourses);

      const analyticsStudents = unwrapResponseList(
        analyticsRes.status === "fulfilled" ? analyticsRes.value : null,
      );
      const fallbackStudents = unwrapResponseList(
        studentsRes.status === "fulfilled" ? studentsRes.value : null,
      );

      const normalizedStudents = mergeStudentRecords(
        [...analyticsStudents, ...fallbackStudents],
        courseLookup,
      ).map((student) => ({
        ...student,
        enrolledCourseTitles:
          student.enrolledCourseTitles.length > 0
            ? student.enrolledCourseTitles
            : student.enrolledCourses
                .map(
                  (courseId) => courseLookup.get(courseId)?.title || courseId,
                )
                .filter(Boolean),
      }));

      setStudents(normalizedStudents);
      setCourses(normalizedCourses);
    } catch (error) {
      console.error("Error fetching enrollment data:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterStudents = () => {
    let filtered = students;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (student) =>
          (student.displayName || student.name || student.studentName || "")
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          (student.displayEmail || student.email || student.studentEmail || "")
            .toLowerCase()
            .includes(searchTerm.toLowerCase()),
      );
    }

    // Filter by course
    if (selectedCourse !== "all") {
      filtered = filtered.filter((student) =>
        toArray(student.enrolledCourses).some(
          (courseId) => toId(courseId) === toId(selectedCourse),
        ),
      );
    }

    setFilteredStudents(filtered);
  };

  const handleRemoveStudent = async (studentId, courseId) => {
    if (window.confirm("Remove this student from the course?")) {
      try {
        await teacherService.removeStudentsFromCourse(courseId, [studentId]);
        setStudents(students.filter((s) => s._id !== studentId));
      } catch (error) {
        console.error("Error removing student:", error);
      }
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
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          My Enrollments
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Manage students enrolled in your courses
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg p-4 border border-indigo-200 dark:border-indigo-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Total Students
              </p>
              <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                {students.length}
              </p>
            </div>
            <FiUsers className="text-4xl text-indigo-200 dark:text-indigo-900" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Active Courses
              </p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">
                {courses.length}
              </p>
            </div>
            <FiFilter className="text-4xl text-green-200 dark:text-green-900" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search */}
          <div className="relative">
            <FiSearch className="absolute left-3 top-3 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search students by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* Course Filter */}
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="all">All Courses</option>
            {courses.map((course) => (
              <option
                key={course._id || course.id}
                value={course._id || course.id}
              >
                {course.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Students List */}
      {filteredStudents.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
          <FiAlertCircle className="text-4xl text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-1">
            No students found
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            {searchTerm || selectedCourse !== "all"
              ? "Try adjusting your filters"
              : "No students enrolled yet"}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Name
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Email
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Enrolled Courses
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 dark:text-white">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredStudents.map((student) => (
                  <tr
                    key={student._id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                          {(
                            student.displayName ||
                            student.name ||
                            student.studentName ||
                            "S"
                          )
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {student.displayName ||
                            student.name ||
                            student.studentName ||
                            student.fullName ||
                            "Unknown Student"}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                      {student.displayEmail ||
                        student.email ||
                        student.studentEmail ||
                        student.profile?.email ||
                        "No email available"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {student.enrolledCourseTitles?.length > 0 ||
                        student.enrolledCourses?.length > 0 ? (
                          (student.enrolledCourseTitles?.length > 0
                            ? student.enrolledCourseTitles
                            : student.enrolledCourses.map((courseId) => {
                                const course = courses.find(
                                  (c) => toId(c._id || c.id) === toId(courseId),
                                );
                                return course?.title || "Unknown Course";
                              })
                          ).map((courseTitle, index) => (
                            <span
                              key={`${student._id || student.email || student.name}-${courseTitle}-${index}`}
                              className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 rounded-full text-xs font-medium"
                            >
                              {courseTitle}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400 text-sm">
                            No courses assigned
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() =>
                          handleRemoveStudent(
                            student._id || student.studentId || student.email,
                            student.enrolledCourses?.[0],
                          )
                        }
                        className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors inline-flex"
                      >
                        <FiTrash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyEnrollments;
