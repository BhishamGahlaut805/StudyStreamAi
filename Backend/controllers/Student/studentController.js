const Course = require("../../models/Courses/course");
const CourseCurriculum = require("../../models/Courses/curriculum");
const Enrollment = require("../../models/Courses/Enrollment");
const User = require("../../models/user");
const asyncHandler = require("../../middleware/asyncHandler");
const ErrorResponse = require("../../utils/ErrorResponse");

const mongoose = require("mongoose");

// @desc    Enroll in a course
// @route   POST /api/studentLearn/enroll/:courseId
// @access  Private (Student)
exports.enrollInCourse = asyncHandler(async (req, res) => {
  console.log("Enroll in course request received for courseId:", req.params.courseId);

  // Validate courseId format
  if (!mongoose.Types.ObjectId.isValid(req.params.courseId)) {
    return res.status(400).json({
      success: false,
      error: "Invalid course ID format",
    });
  }

  const course = await Course.findById(req.params.courseId);

  if (!course) {
    return res.status(404).json({
      success: false,
      error: `Course not found with id ${req.params.courseId}`,
    });
  }

  // Check if course is published
  if (course.status !== "published") {
    return res.status(400).json({
      success: false,
      error: "Cannot enroll in unpublished course",
    });
  }

  // Check enrollment capacity
  if (course.maxEnrollments && course.totalStudents >= course.maxEnrollments) {
    return res.status(400).json({
      success: false,
      error: "Course enrollment capacity reached",
    });
  }

  // Check if already enrolled - with proper error handling
  try {
    const existingEnrollment = await Enrollment.findOne({
      student: req.user.id,
      course: req.params.courseId,
    });

    if (existingEnrollment) {
      return res.status(400).json({
        success: false,
        error: "Already enrolled in this course",
      });
    }
  } catch (findError) {
    console.error("Error checking existing enrollment:", findError);
    return res.status(500).json({
      success: false,
      error: "Error checking enrollment status",
    });
  }

  console.log("No existing enrollment found, proceeding to enroll student:", req.user.id);

  // Create enrollment with try-catch
  let enrollment;
  try {
    enrollment = await Enrollment.create({
      student: req.user.id,
      course: req.params.courseId,
      paymentDetails: {
        amount: course.discountPrice || course.price || 0,
        currency: "USD",
        paymentMethod: req.body.paymentMethod || "free",
        transactionId: req.body.transactionId || "FREE_COURSE",
        paymentStatus: "completed",
        paidAt: new Date(),
      },
    });
    console.log("Enrollment created with ID:", enrollment._id);
  } catch (createError) {
    console.error("Error creating enrollment:", createError);

    // Handle duplicate key error
    if (createError.code === 11000) {
      return res.status(400).json({
        success: false,
        error: "Already enrolled in this course",
      });
    }

    // Handle validation errors
    if (createError.name === "ValidationError") {
      const messages = Object.values(createError.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: messages.join(", "),
      });
    }

    return res.status(500).json({
      success: false,
      error: "Failed to create enrollment",
    });
  }

  // Update course student count
  try {
    course.addStudent(req.user.id);
    await course.save();
  } catch (courseError) {
    console.error("Error updating course:", courseError);
    // Don't fail the enrollment if course update fails
  }

  // Add course to user's enrolled courses
  try {
    await User.findByIdAndUpdate(req.user.id, {
      $addToSet: { enrolledCourses: course._id },
    });
  } catch (userError) {
    console.error("Error updating user:", userError);
    // Don't fail the enrollment if user update fails
  }

  return res.status(201).json({
    success: true,
    data: enrollment,
  });
});

// @desc    Get student's enrolled courses
// @route   GET /api/student/courses
// @access  Private (Student)
exports.getEnrolledCourses = asyncHandler(async (req, res, next) => {
  const enrollments = await Enrollment.find({
    student: req.user.id,
    enrollmentStatus: { $ne: "dropped" },
  })
    .populate({
      path: "course",
      select:
        "title description shortDescription thumbnail coverImage price discountPrice level language instructor totalChapters totalLessons totalDuration rating status",
      populate: {
        path: "instructor",
        select: "name avatar bio title",
      },
    })
    .sort("-createdAt");

  res.status(200).json({
    success: true,
    count: enrollments.length,
    data: enrollments,
  });
});

// @desc    Get course learning content
// @route   GET /api/student/course/:courseId/learn
// @access  Private (Student)
exports.getCourseLearningContent = asyncHandler(async (req, res, next) => {
  const enrollment = await Enrollment.findOne({
    student: req.user.id,
    course: req.params.courseId,
    enrollmentStatus: { $ne: "dropped" },
  });

  if (!enrollment) {
    return next(new ErrorResponse("Not enrolled in this course", 403));
  }

  const course = await Course.findById(req.params.courseId).populate(
    "instructor",
    "name avatar bio title",
  );

  if (!course) {
    return next(new ErrorResponse("Course not found", 404));
  }

  const curriculum = await CourseCurriculum.findOne({
    course: req.params.courseId,
  });

  res.status(200).json({
    success: true,
    data: {
      enrollment,
      course,
      curriculum,
    },
  });
});

// @desc    Mark lesson as complete
// @route   POST /api/student/course/:courseId/lesson/:lessonId/complete
// @access  Private (Student)
exports.completeLesson = asyncHandler(async (req, res, next) => {
  const { chapterId } = req.body;
  const { timeSpent = 0, score = null } = req.body;

  const enrollment = await Enrollment.findOne({
    student: req.user.id,
    course: req.params.courseId,
    enrollmentStatus: "active",
  });

  if (!enrollment) {
    return next(new ErrorResponse("Not enrolled in this course", 403));
  }

  // Mark lesson as complete
  enrollment.markLessonComplete(
    req.params.lessonId,
    chapterId,
    score,
    timeSpent,
  );

  // Update study streak
  enrollment.updateStudyStreak();

  await enrollment.save();

  // Update course progress
  const curriculum = await CourseCurriculum.findOne({
    course: req.params.courseId,
  });
  if (curriculum) {
    const totalLessons = curriculum.totalLessons;
    const completedLessons = enrollment.progress.completedLessons.length;
    const progress =
      totalLessons > 0
        ? Math.round((completedLessons / totalLessons) * 100)
        : 0;

    // Update in course model
    const course = await Course.findById(req.params.courseId);
    if (course) {
      course.updateStudentProgress(req.user.id, progress);
      await course.save();
    }

    enrollment.progress.overallProgress = progress;
    await enrollment.save();
  }

  res.status(200).json({
    success: true,
    data: {
      progress: enrollment.progress.overallProgress,
      completedLessons: enrollment.progress.completedLessons.length,
      studyStreak: enrollment.learningMetrics.studyStreak,
    },
  });
});

// @desc    Submit quiz answers
// @route   POST /api/student/course/:courseId/quiz/:quizId/submit
// @access  Private (Student)
exports.submitQuiz = asyncHandler(async (req, res, next) => {
  const { chapterId, score, answers } = req.body;

  const enrollment = await Enrollment.findOne({
    student: req.user.id,
    course: req.params.courseId,
    enrollmentStatus: "active",
  });

  if (!enrollment) {
    return next(new ErrorResponse("Not enrolled in this course", 403));
  }

  const passed = score >= 60; // 60% passing criteria

  enrollment.completeQuiz(req.params.quizId, chapterId, score, passed);

  enrollment.learningMetrics.lastActivityAt = Date.now();
  await enrollment.save();

  res.status(200).json({
    success: true,
    data: {
      score,
      passed,
      message: passed
        ? "Congratulations! You passed the quiz."
        : "Keep trying! You need 60% to pass.",
    },
  });
});

// @desc    Submit assignment
// @route   POST /api/student/course/:courseId/assignment/:assignmentId/submit
// @access  Private (Student)
exports.submitAssignment = asyncHandler(async (req, res, next) => {
  const { chapterId, submissionUrl } = req.body;

  if (!submissionUrl) {
    return next(new ErrorResponse("Please provide submission URL", 400));
  }

  const enrollment = await Enrollment.findOne({
    student: req.user.id,
    course: req.params.courseId,
    enrollmentStatus: "active",
  });

  if (!enrollment) {
    return next(new ErrorResponse("Not enrolled in this course", 403));
  }

  enrollment.submitAssignment(
    req.params.assignmentId,
    chapterId,
    submissionUrl,
  );

  enrollment.learningMetrics.lastActivityAt = Date.now();
  await enrollment.save();

  res.status(200).json({
    success: true,
    data: {
      message: "Assignment submitted successfully",
      submissionUrl,
    },
  });
});

// @desc    Get student progress for a course
// @route   GET /api/student/course/:courseId/progress
// @access  Private (Student)
exports.getCourseProgress = asyncHandler(async (req, res, next) => {
  const enrollment = await Enrollment.findOne({
    student: req.user.id,
    course: req.params.courseId,
  });

  if (!enrollment) {
    return next(new ErrorResponse("Not enrolled in this course", 403));
  }

  const curriculum = await CourseCurriculum.findOne({
    course: req.params.courseId,
  });

  res.status(200).json({
    success: true,
    data: {
      enrollment: enrollment.progress,
      learningMetrics: enrollment.learningMetrics,
      curriculum: curriculum
        ? {
            totalChapters: curriculum.totalChapters,
            totalLessons: curriculum.totalLessons,
            totalDuration: curriculum.totalDuration,
          }
        : null,
    },
  });
});

// @desc    Get learning statistics
// @route   GET /api/student/stats
// @access  Private (Student)
exports.getLearningStats = asyncHandler(async (req, res, next) => {
  const enrollments = await Enrollment.find({
    student: req.user.id,
  }).populate("course", "title totalLessons totalDuration");

  const stats = {
    totalCourses: enrollments.length,
    activeCourses: enrollments.filter((e) => e.enrollmentStatus === "active")
      .length,
    completedCourses: enrollments.filter(
      (e) => e.enrollmentStatus === "completed",
    ).length,
    totalTimeSpent: enrollments.reduce(
      (sum, e) => sum + e.learningMetrics.totalTimeSpent,
      0,
    ),
    averageProgress:
      enrollments.length > 0
        ? Math.round(
            enrollments.reduce(
              (sum, e) => sum + e.progress.overallProgress,
              0,
            ) / enrollments.length,
          )
        : 0,
    studyStreak:
      enrollments.length > 0 ? enrollments[0].learningMetrics.studyStreak : 0,
    longestStreak:
      enrollments.length > 0 ? enrollments[0].learningMetrics.longestStreak : 0,
    coursesDetail: enrollments.map((e) => ({
      courseId: e.course?._id,
      courseTitle: e.course?.title,
      progress: e.progress.overallProgress,
      timeSpent: e.learningMetrics.totalTimeSpent,
      status: e.enrollmentStatus,
      averageQuizScore: e.learningMetrics.averageQuizScore,
    })),
  };

  res.status(200).json({
    success: true,
    data: stats,
  });
});
