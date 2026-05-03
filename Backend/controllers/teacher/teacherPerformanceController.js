const Course = require("../../models/Courses/course");
const Enrollment = require("../../models/Courses/Enrollment");
const User = require("../../models/user");
const asyncHandler = require("../../middleware/asyncHandler");
const ErrorResponse = require("../../utils/ErrorResponse");

// @desc    Get all students for teacher's courses
// @route   GET /api/teacher/students
// @access  Private (Teacher, Admin)
exports.getTeacherStudents = asyncHandler(async (req, res, next) => {
  // Get all courses by this teacher
  const courses = await Course.find({ instructor: req.user.id }).select(
    "_id title",
  );

  const courseIds = courses.map((c) => c._id);

  // Get all enrollments for teacher's courses
  const enrollments = await Enrollment.find({
    course: { $in: courseIds },
  })
    .populate({
      path: "student",
      select: "name email avatar",
    })
    .populate({
      path: "course",
      select: "title thumbnail",
    })
    .sort("-createdAt");

  res.status(200).json({
    success: true,
    count: enrollments.length,
    data: enrollments,
  });
});

// @desc    Get student performance in a specific course
// @route   GET /api/teacher/course/:courseId/students
// @access  Private (Teacher, Admin)
exports.getCourseStudentsPerformance = asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.courseId);

  if (!course) {
    return next(new ErrorResponse("Course not found", 404));
  }

  // Check if teacher owns this course
  if (
    req.user.role !== "admin" &&
    course.instructor.toString() !== req.user.id
  ) {
    return next(
      new ErrorResponse("Not authorized to view this course's students", 403),
    );
  }

  const enrollments = await Enrollment.find({
    course: req.params.courseId,
  })
    .populate({
      path: "student",
      select: "name email avatar",
    })
    .sort({ "progress.overallProgress": -1 });

  // Calculate course statistics
  const stats = {
    totalEnrolled: enrollments.length,
    activeStudents: enrollments.filter((e) => e.enrollmentStatus === "active")
      .length,
    completedStudents: enrollments.filter(
      (e) => e.enrollmentStatus === "completed",
    ).length,
    droppedStudents: enrollments.filter((e) => e.enrollmentStatus === "dropped")
      .length,
    averageProgress:
      enrollments.length > 0
        ? Math.round(
            enrollments.reduce(
              (sum, e) => sum + e.progress.overallProgress,
              0,
            ) / enrollments.length,
          )
        : 0,
    averageQuizScore:
      enrollments.length > 0
        ? Math.round(
            enrollments.reduce(
              (sum, e) => sum + e.learningMetrics.averageQuizScore,
              0,
            ) / enrollments.length,
          )
        : 0,
    averageTimeSpent:
      enrollments.length > 0
        ? Math.round(
            enrollments.reduce(
              (sum, e) => sum + e.learningMetrics.totalTimeSpent,
              0,
            ) / enrollments.length,
          )
        : 0,
  };

  res.status(200).json({
    success: true,
    data: {
      course: {
        _id: course._id,
        title: course.title,
        totalStudents: course.totalStudents,
        totalChapters: course.totalChapters,
        totalLessons: course.totalLessons,
      },
      stats,
      students: enrollments.map((e) => ({
        enrollmentId: e._id,
        student: e.student,
        progress: e.progress.overallProgress,
        completedLessons: e.progress.completedLessons.length,
        averageQuizScore: e.learningMetrics.averageQuizScore,
        averageAssignmentScore: e.learningMetrics.averageAssignmentScore,
        totalTimeSpent: e.learningMetrics.totalTimeSpent,
        studyStreak: e.learningMetrics.studyStreak,
        enrollmentStatus: e.enrollmentStatus,
        lastActivity: e.learningMetrics.lastActivityAt,
        enrolledAt: e.enrolledAt,
      })),
    },
  });
});

// @desc    Get individual student performance details
// @route   GET /api/teacher/student/:studentId/course/:courseId
// @access  Private (Teacher, Admin)
exports.getStudentPerformanceDetail = asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.courseId);

  if (!course) {
    return next(new ErrorResponse("Course not found", 404));
  }

  // Check if teacher owns this course
  if (
    req.user.role !== "admin" &&
    course.instructor.toString() !== req.user.id
  ) {
    return next(
      new ErrorResponse(
        "Not authorized to view this student's performance",
        403,
      ),
    );
  }

  const enrollment = await Enrollment.findOne({
    student: req.params.studentId,
    course: req.params.courseId,
  })
    .populate({
      path: "student",
      select: "name email avatar",
    })
    .populate({
      path: "course",
      select: "title totalLessons totalChapters totalDuration",
    });

  if (!enrollment) {
    return next(new ErrorResponse("Student not enrolled in this course", 404));
  }

  res.status(200).json({
    success: true,
    data: enrollment,
  });
});

// @desc    Grade assignment
// @route   PUT /api/teacher/assignment/:assignmentId/grade/:enrollmentId
// @access  Private (Teacher, Admin)
exports.gradeAssignment = asyncHandler(async (req, res, next) => {
  const { score, feedback } = req.body;

  if (score === undefined || score === null) {
    return next(new ErrorResponse("Please provide a score", 400));
  }

  const enrollment = await Enrollment.findById(req.params.enrollmentId);

  if (!enrollment) {
    return next(new ErrorResponse("Enrollment not found", 404));
  }

  const assignment = enrollment.progress.completedAssignments.find(
    (a) => a.assignmentId.toString() === req.params.assignmentId.toString(),
  );

  if (!assignment) {
    return next(new ErrorResponse("Assignment submission not found", 404));
  }

  assignment.score = score;
  assignment.feedback = feedback || "";
  assignment.gradedAt = Date.now();
  assignment.status = "graded";

  await enrollment.save();

  res.status(200).json({
    success: true,
    data: assignment,
  });
});

// @desc    Get teacher dashboard overview
// @route   GET /api/teacher/dashboard
// @access  Private (Teacher, Admin)
exports.getTeacherDashboard1 = asyncHandler(async (req, res, next) => {
  // Get all courses by this teacher
  const courses = await Course.find({ instructor: req.user.id });
  const courseIds = courses.map((c) => c._id);

  // Get all enrollments
  const enrollments = await Enrollment.find({
    course: { $in: courseIds },
  });

  // Calculate dashboard stats
  const dashboard = {
    totalCourses: courses.length,
    publishedCourses: courses.filter((c) => c.status === "published").length,
    draftCourses: courses.filter((c) => c.status === "draft").length,
    totalStudents: courses.reduce((sum, c) => sum + (c.totalStudents || 0), 0),
    totalEnrollments: enrollments.length,
    activeStudents: enrollments.filter((e) => e.enrollmentStatus === "active")
      .length,
    completedStudents: enrollments.filter(
      (e) => e.enrollmentStatus === "completed",
    ).length,
    averageCourseProgress:
      enrollments.length > 0
        ? Math.round(
            enrollments.reduce(
              (sum, e) => sum + e.progress.overallProgress,
              0,
            ) / enrollments.length,
          )
        : 0,
    totalRevenue: courses.reduce(
      (sum, c) => sum + c.totalStudents * (c.discountPrice || c.price),
      0,
    ),
    recentEnrollments: enrollments
      .sort((a, b) => b.enrolledAt - a.enrolledAt)
      .slice(0, 5)
      .map(async (e) => ({
        student: await User.findById(e.student).select("name email avatar"),
        course: courses.find((c) => c._id.toString() === e.course.toString())
          ?.title,
        enrolledAt: e.enrolledAt,
        progress: e.progress.overallProgress,
      })),
    topPerformingCourses: courses
      .sort((a, b) => b.totalStudents - a.totalStudents)
      .slice(0, 5)
      .map((c) => ({
        _id: c._id,
        title: c.title,
        students: c.totalStudents,
        rating: c.rating?.average || 0,
        thumbnail: c.thumbnail,
      })),
  };

  // Resolve promises for recent enrollments
  dashboard.recentEnrollments = await Promise.all(dashboard.recentEnrollments);

  res.status(200).json({
    success: true,
    data: dashboard,
  });
});
