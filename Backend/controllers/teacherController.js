const asyncHandler = require("../middleware/asyncHandler");
const ErrorResponse = require("../utils/ErrorResponse");
const Course = require("../models/Courses/course");
const User = require("../models/user");
const Profile = require("../models/profile");

/**
 * Get all students in teacher's courses
 * GET /api/teachers/my-students
 */
exports.getStudentsInMyCourses = asyncHandler(async (req, res, next) => {
  // Get all courses taught by this teacher
  const courses = await Course.find({ instructor: req.user.id })
    .select("students title")
    .populate("students", "name email studentId");

  if (!courses || courses.length === 0) {
    return res.status(200).json({
      success: true,
      message: "No courses found",
      data: [],
    });
  }

  // Aggregate unique students
  const studentsSet = new Map();
  courses.forEach((course) => {
    if (course.students && course.students.length > 0) {
      course.students.forEach((student) => {
        if (!studentsSet.has(student._id.toString())) {
          studentsSet.set(student._id.toString(), {
            ...student.toObject(),
            enrolledInCourses: [course._id],
          });
        } else {
          const existing = studentsSet.get(student._id.toString());
          existing.enrolledInCourses.push(course._id);
        }
      });
    }
  });

  const students = Array.from(studentsSet.values());

  res.status(200).json({
    success: true,
    count: students.length,
    data: students,
  });
});

/**
 * Get students in a specific course
 * GET /api/teachers/courses/:courseId/students
 */
exports.getStudentsByCourse = asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.courseId)
    .select("students instructor title")
    .populate("students", "name email studentId profile.phone enrolledCourses");

  if (!course) {
    return next(new ErrorResponse("Course not found", 404));
  }

  // Verify teacher is instructor of this course
  if (course.instructor.toString() !== req.user.id) {
    return next(
      new ErrorResponse("Not authorized to view students in this course", 403),
    );
  }

  const students = course.students || [];

  res.status(200).json({
    success: true,
    count: students.length,
    courseTitle: course.title,
    data: students,
  });
});

/**
 * Add students to course
 * POST /api/teachers/:courseId/add-student
 */
exports.addStudentsToCourse = asyncHandler(async (req, res, next) => {
  const { studentIds } = req.body;

  if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
    return next(
      new ErrorResponse("Please provide an array of student IDs", 400),
    );
  }

  const course = await Course.findById(req.params.courseId);

  if (!course) {
    return next(new ErrorResponse("Course not found", 404));
  }

  // Verify teacher is instructor
  if (course.instructor.toString() !== req.user.id) {
    return next(new ErrorResponse("Not authorized to modify this course", 403));
  }

  // Check enrollment capacity
  if (
    course.maxEnrollments &&
    course.students.length + studentIds.length > course.maxEnrollments
  ) {
    return next(
      new ErrorResponse(
        `Cannot enroll ${studentIds.length} students. Maximum capacity is ${course.maxEnrollments}. Current enrollments: ${course.students.length}`,
        400,
      ),
    );
  }

  const addedStudents = [];
  const alreadyEnrolled = [];

  for (const studentId of studentIds) {
    const student = await User.findById(studentId);

    if (!student) {
      continue;
    }

    const isAlreadyEnrolled = course.students.some(
      (s) => s.toString() === studentId,
    );

    if (!isAlreadyEnrolled) {
      course.students.push(studentId);
      addedStudents.push(student);

      // Add course to student's enrolledCourses
      if (!student.enrolledCourses.includes(course._id)) {
        student.enrolledCourses.push(course._id);
        await student.save();
      }
    } else {
      alreadyEnrolled.push(student.name);
    }
  }

  await course.save();

  res.status(200).json({
    success: true,
    message: `${addedStudents.length} student(s) added successfully`,
    addedStudents: addedStudents.map((s) => ({
      id: s._id,
      name: s.name,
      email: s.email,
      studentId: s.studentId,
    })),
    alreadyEnrolled,
    data: course,
  });
});

/**
 * Remove students from course
 * POST /api/teachers/:courseId/remove-student
 */
exports.removeStudentsFromCourse = asyncHandler(async (req, res, next) => {
  const { studentIds } = req.body;

  if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
    return next(
      new ErrorResponse("Please provide an array of student IDs", 400),
    );
  }

  const course = await Course.findById(req.params.courseId);

  if (!course) {
    return next(new ErrorResponse("Course not found", 404));
  }

  // Verify teacher is instructor
  if (course.instructor.toString() !== req.user.id) {
    return next(new ErrorResponse("Not authorized to modify this course", 403));
  }

  const removedStudents = [];
  const notEnrolled = [];

  for (const studentId of studentIds) {
    const isEnrolled = course.students.some((s) => s.toString() === studentId);

    if (isEnrolled) {
      course.students = course.students.filter(
        (s) => s.toString() !== studentId,
      );

      const student = await User.findById(studentId);
      if (student) {
        student.enrolledCourses = student.enrolledCourses.filter(
          (c) => c.toString() !== course._id.toString(),
        );
        await student.save();
        removedStudents.push(student.name);
      }
    } else {
      notEnrolled.push(studentId);
    }
  }

  await course.save();

  res.status(200).json({
    success: true,
    message: `${removedStudents.length} student(s) removed successfully`,
    removedStudents,
    notEnrolled,
    data: course,
  });
});

/**
 * Get enrollment statistics for a course
 * GET /api/teachers/courses/:courseId/enrollment-stats
 */
exports.getCourseEnrollmentStats = asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.courseId)
    .select(
      "students maxEnrollments title status createdAt enrolledStudents progress",
    )
    .populate("students", "name email studentId");

  if (!course) {
    return next(new ErrorResponse("Course not found", 404));
  }

  // Verify teacher is instructor
  if (course.instructor.toString() !== req.user.id) {
    return next(new ErrorResponse("Not authorized to view this data", 403));
  }

  const totalEnrolled = course.students ? course.students.length : 0;
  const capacity = course.maxEnrollments || "Unlimited";
  const capacityPercentage = course.maxEnrollments
    ? Math.round((totalEnrolled / course.maxEnrollments) * 100)
    : 0;

  // Calculate average progress
  let averageProgress = 0;
  if (course.progress && course.progress.length > 0) {
    const totalProgress = course.progress.reduce(
      (sum, p) => sum + (p.percentComplete || 0),
      0,
    );
    averageProgress = Math.round(totalProgress / course.progress.length);
  }

  res.status(200).json({
    success: true,
    data: {
      courseId: course._id,
      courseTitle: course.title,
      status: course.status,
      totalEnrolled,
      maxCapacity: capacity,
      capacityPercentage,
      availableSeats: course.maxEnrollments
        ? Math.max(0, course.maxEnrollments - totalEnrolled)
        : "Unlimited",
      averageProgress,
      createdAt: course.createdAt,
      students: course.students,
    },
  });
});

/**
 * Update enrollment capacity
 * PUT /api/teachers/courses/:courseId/enrollment-capacity
 */
exports.updateEnrollmentCapacity = asyncHandler(async (req, res, next) => {
  const { maxEnrollments } = req.body;

  if (!Number.isInteger(maxEnrollments) || maxEnrollments < 1) {
    return next(
      new ErrorResponse("Max enrollments must be a positive integer", 400),
    );
  }

  const course = await Course.findById(req.params.courseId);

  if (!course) {
    return next(new ErrorResponse("Course not found", 404));
  }

  // Verify teacher is instructor
  if (course.instructor.toString() !== req.user.id) {
    return next(new ErrorResponse("Not authorized to modify this course", 403));
  }

  const currentEnrolled = course.students ? course.students.length : 0;

  if (maxEnrollments < currentEnrolled) {
    return next(
      new ErrorResponse(
        `Cannot set capacity below current enrollments (${currentEnrolled})`,
        400,
      ),
    );
  }

  course.maxEnrollments = maxEnrollments;
  await course.save();

  res.status(200).json({
    success: true,
    message: "Enrollment capacity updated successfully",
    data: {
      courseId: course._id,
      maxEnrollments: course.maxEnrollments,
      currentEnrolled,
      availableSeats: maxEnrollments - currentEnrolled,
    },
  });
});

/**
 * Get teacher dashboard data
 * GET /api/teachers/dashboard
 */
exports.getTeacherDashboard = asyncHandler(async (req, res, next) => {
  // Get all courses taught by this teacher
  const courses = await Course.find({ instructor: req.user.id })
    .select("title students status createdAt rating totalReviews")
    .lean();

  // Get teacher profile
  const profile = await Profile.findOne({ user: req.user.id }).lean();

  // Calculate statistics
  const totalCourses = courses.length;
  const publishedCourses = courses.filter(
    (c) => c.status === "published",
  ).length;
  const totalStudents = courses.reduce(
    (sum, c) => sum + (c.students ? c.students.length : 0),
    0,
  );

  // Calculate average rating
  const totalRatings = courses.reduce((sum, c) => sum + c.totalReviews, 0);
  const sumRating = courses.reduce(
    (sum, c) => sum + (c.rating || 0) * (c.totalReviews || 0),
    0,
  );
  const averageRating =
    totalRatings > 0 ? (sumRating / totalRatings).toFixed(2) : 0;

  res.status(200).json({
    success: true,
    data: {
      teacher: {
        name: req.user.name,
        email: req.user.email,
        profilePhoto: profile?.profilePhoto || null,
        bio: profile?.bio || "",
        specializations: profile?.specializations || [],
      },
      statistics: {
        totalCourses,
        publishedCourses,
        draftCourses: totalCourses - publishedCourses,
        totalStudents,
        averageRating: parseFloat(averageRating),
      },
      recentCourses: courses.slice(0, 5),
    },
  });
});

/**
 * Get teacher courses list with details
 * GET /api/teachers/courses
 */
exports.getTeacherCourses = asyncHandler(async (req, res, next) => {
  const courses = await Course.find({ instructor: req.user.id })
    .select("title description students status createdAt rating totalReviews")
    .populate("students", "name email studentId")
    .sort({ createdAt: -1 });

  const coursesWithStats = courses.map((course) => ({
    id: course._id,
    title: course.title,
    description: course.description,
    status: course.status,
    totalStudents: course.students ? course.students.length : 0,
    students: course.students,
    rating: course.rating || 0,
    totalReviews: course.totalReviews || 0,
    createdAt: course.createdAt,
  }));

  res.status(200).json({
    success: true,
    count: coursesWithStats.length,
    data: coursesWithStats,
  });
});

/**
 * Get student performance in a specific course
 * GET /api/teachers/courses/:courseId/student-performance
 */
exports.getStudentPerformanceInCourse = asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.courseId)
    .select("students progress title instructor")
    .populate("students", "name email studentId");

  if (!course) {
    return next(new ErrorResponse("Course not found", 404));
  }

  // Verify teacher is instructor
  if (course.instructor.toString() !== req.user.id) {
    return next(new ErrorResponse("Not authorized to view this data", 403));
  }

  const performanceData = course.progress || [];
  const studentPerformance = performanceData.map((perf) => {
    const student = course.students.find(
      (s) => s._id.toString() === perf.studentId.toString(),
    );
    return {
      studentId: perf.studentId,
      studentName: student?.name || "Unknown",
      studentEmail: student?.email || "",
      percentComplete: perf.percentComplete || 0,
      completedLessons: perf.completedLessons || [],
      lastAccessed: perf.lastAccessed,
      totalTimeSpent: perf.totalTimeSpent || 0,
    };
  });

  res.status(200).json({
    success: true,
    courseTitle: course.title,
    count: studentPerformance.length,
    data: studentPerformance,
  });
});
// controllers/teacherController.js - Add this function

/**
 * Get all students with their performance data for analytics
 * GET /api/teachers/dashboard/students
 */
exports.getStudentsForAnalytics = asyncHandler(async (req, res) => {
  // Get all courses taught by this teacher
  const courses = await Course.find({ instructor: req.user.id })
    .select("title students")
    .populate({
      path: "students",
      select: "name email studentId enrolledCourses",
    });

  if (!courses || courses.length === 0) {
    return res.status(200).json({
      success: true,
      data: [],
    });
  }

  // Get all unique students with their enrollment data
  const studentsMap = new Map();

  for (const course of courses) {
    if (course.students && course.students.length > 0) {
      for (const student of course.students) {
        const studentId = student._id.toString();

        if (!studentsMap.has(studentId)) {
          // Fetch enrollment data for this student
          const Enrollment = require("../models/Courses/Enrollment");
          const enrollments = await Enrollment.find({
            student: student._id,
            course: { $in: courses.map(c => c._id) },
          }).populate("course", "title");

          studentsMap.set(studentId, {
            ...student.toObject(),
            enrolledInCourses: courses
              .filter(c => c.students.some(s => s._id.toString() === studentId))
              .map(c => c._id),
            enrollments: enrollments.map(e => ({
              courseId: e.course?._id,
              courseTitle: e.course?.title,
              progress: e.progress?.overallProgress || 0,
              completedLessons: e.progress?.completedLessons?.length || 0,
              averageQuizScore: e.learningMetrics?.averageQuizScore || 0,
              averageAssignmentScore: e.learningMetrics?.averageAssignmentScore || 0,
              totalTimeSpent: e.learningMetrics?.totalTimeSpent || 0,
              studyStreak: e.learningMetrics?.studyStreak || 0,
              longestStreak: e.learningMetrics?.longestStreak || 0,
              enrollmentStatus: e.enrollmentStatus || "active",
              enrolledAt: e.enrolledAt,
              lastActivity: e.learningMetrics?.lastActivityAt,
            })),
          });
        }
      }
    }
  }

  const students = Array.from(studentsMap.values());

  res.status(200).json({
    success: true,
    count: students.length,
    data: students,
  });
});