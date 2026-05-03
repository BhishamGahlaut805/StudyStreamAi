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

const normalizeStudent = (student = {}) => {
  const nestedStudent =
    student && typeof student.student === "object" ? student.student : {};

  const enrolledCourses = [
    ...toArray(student.enrolledInCourses),
    ...toArray(student.enrolledCourses),
    ...toArray(nestedStudent.enrolledInCourses),
    ...toArray(nestedStudent.enrolledCourses),
  ]
    .map((courseId) => toId(courseId))
    .filter(Boolean);

  return {
    ...student,
    _id:
      toId(student._id) ||
      toId(nestedStudent._id) ||
      toId(student.studentId) ||
      toId(nestedStudent.studentId) ||
      toId(student.email) ||
      toId(nestedStudent.email),
    name: pickFirst(
      student.name,
      nestedStudent.name,
      student.studentName,
      nestedStudent.studentName,
      student.fullName,
      nestedStudent.fullName,
      student.profile?.fullName,
      nestedStudent.profile?.fullName,
      "Unknown Student",
    ),
    email: pickFirst(
      student.email,
      nestedStudent.email,
      student.studentEmail,
      nestedStudent.studentEmail,
      student.profile?.email,
      nestedStudent.profile?.email,
      "",
    ),
    enrolledCourses,
    enrolledInCourses: enrolledCourses,
  };
};

const unwrapResponseList = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  if (Array.isArray(response?.students)) return response.students;
  if (Array.isArray(response?.data?.students)) return response.data.students;
  return [];
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
      const [studentsRes, coursesRes] = await Promise.all([
        teacherService.getStudentsInMyCourses(),
        teacherService.getTeacherCourses(),
      ]);

      const normalizedStudents =
        unwrapResponseList(studentsRes).map(normalizeStudent);
      setStudents(normalizedStudents);
      setCourses(unwrapResponseList(coursesRes));
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
          (student.name || "")
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          (student.email || "")
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
              <option key={course._id} value={course._id}>
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
                          {(student.name || "S").charAt(0).toUpperCase()}
                        </div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {student.name || "Unknown"}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                      {student.email || "N/A"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {student.enrolledCourses?.length > 0 ? (
                          student.enrolledCourses.map((courseId) => {
                            const course = courses.find(
                              (c) => toId(c._id) === toId(courseId),
                            );
                            return (
                              <span
                                key={courseId}
                                className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 rounded-full text-xs font-medium"
                              >
                                {course?.title || "Unknown"}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400 text-sm">
                            No courses
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() =>
                          handleRemoveStudent(
                            student._id,
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
