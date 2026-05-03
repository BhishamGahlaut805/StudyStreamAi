const Course = require("../../models/Courses/course");
const CourseCurriculum = require("../../models/Courses/curriculum");
const User = require("../../models/user");
const asyncHandler = require("../../middleware/asyncHandler");
const ErrorResponse = require("../../utils/ErrorResponse");
const APIFeatures = require("../../utils/apiFeatures");

// @desc    Create a new course (Teacher, Admin)
// @route   POST /api/courses
// @access  Private (Teacher, Admin)
exports.createCourse = asyncHandler(async (req, res, next) => {
  console.log(
    "[createCourse] Request received - user:",
    req.user.id,
    "role:",
    req.user.role,
  );
  console.log(
    "[createCourse] Request body:",
    JSON.stringify(req.body, null, 2),
  );

  // Add instructor to request body
  req.body.instructor = req.user.id;

  // Check if user is teacher or admin
  if (req.user.role !== "teacher" && req.user.role !== "admin") {
    return next(new ErrorResponse("Not authorized to create courses", 403));
  }

  // Create the course
  const course = await Course.create(req.body);
  console.log("[createCourse] Course created successfully:", course._id);

  // Create initial curriculum
  try {
    const curriculum = await CourseCurriculum.create({
      course: course._id,
      chapters: [],
      updatedBy: req.user.id,
    });
    console.log(
      "[createCourse] Curriculum created successfully:",
      curriculum._id,
    );
  } catch (curriculumError) {
    console.error(
      "[createCourse] Failed to create curriculum:",
      curriculumError.message,
    );
    // Don't fail the whole request if curriculum creation fails
  }

  return res.status(201).json({
    success: true,
    data: course,
  });
});

// @desc    Get all courses (Public with filters)
// @route   GET /api/courses
// @access  Public
exports.getCourses = asyncHandler(async (req, res, next) => {
  const features = new APIFeatures(Course.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate()
    .search();

  const courses = await features.query.populate({
    path: "instructor",
    select: "name avatar",
  });

  // Get total count for pagination
  const total = await Course.countDocuments(features.query._conditions || {});

  res.status(200).json({
    success: true,
    count: courses.length,
    total,
    pagination: {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10,
      totalPages: Math.ceil(total / (parseInt(req.query.limit) || 10)),
    },
    data: courses,
  });
});

// @desc    Get single course
// @route   GET /api/courses/:id
// @access  Public
exports.getCourse = asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.id).populate({
    path: "instructor",
    select: "name avatar bio title",
  });

  if (!course) {
    return next(
      new ErrorResponse(`Course not found with id ${req.params.id}`, 404),
    );
  }

  res.status(200).json({
    success: true,
    data: course,
  });
});

// @desc    Update course (Teacher - own courses, Admin - any course)
// @route   PUT /api/courses/:id
// @access  Private (Teacher, Admin)
exports.updateCourse = asyncHandler(async (req, res, next) => {
  let course = await Course.findById(req.params.id);

  if (!course) {
    return next(
      new ErrorResponse(`Course not found with id ${req.params.id}`, 404),
    );
  }

  // Check ownership
  if (
    req.user.role !== "admin" &&
    course.instructor.toString() !== req.user.id
  ) {
    return next(new ErrorResponse("Not authorized to update this course", 403));
  }

  // Prevent status updates by teachers if course is published
  if (
    req.user.role === "teacher" &&
    req.body.status &&
    course.status === "published"
  ) {
    delete req.body.status;
  }

  if (req.body.status) {
    req.body.isPublished = req.body.status === "published";
  }

  course = await Course.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: course,
  });
});

// @desc    Delete course (Admin only)
// @route   DELETE /api/courses/:id
// @access  Private (Admin)
exports.deleteCourse = asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.id);

  if (!course) {
    return next(
      new ErrorResponse(`Course not found with id ${req.params.id}`, 404),
    );
  }

  if (req.user.role !== "admin") {
    return next(new ErrorResponse("Not authorized to delete courses", 403));
  }

  await course.deleteOne();
  await CourseCurriculum.findOneAndDelete({ course: req.params.id });

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc    Enroll in course (Student)
// @route   POST /api/courses/:id/enroll
// @access  Private (Student)
exports.enrollInCourse = asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.id);

  if (!course) {
    return next(
      new ErrorResponse(`Course not found with id ${req.params.id}`, 404),
    );
  }

  if (course.status !== "published") {
    return next(new ErrorResponse("Cannot enroll in unpublished course", 400));
  }

  if (
    course.maxEnrollments &&
    course.students.length >= course.maxEnrollments
  ) {
    return next(new ErrorResponse("Course enrollment capacity reached", 400));
  }

  if (course.isStudentEnrolled(req.user.id)) {
    return next(new ErrorResponse("Already enrolled in this course", 400));
  }

  course.addStudent(req.user.id);
  await course.save();

  await User.findByIdAndUpdate(req.user.id, {
    $addToSet: { enrolledCourses: course._id },
  });

  res.status(200).json({
    success: true,
    data: {
      message: "Successfully enrolled in course",
      courseId: course._id,
    },
  });
});

// @desc    Get teacher's courses
// @route   GET /api/courses/teacher/me
// @access  Private (Teacher)
exports.getTeacherCourses = asyncHandler(async (req, res, next) => {
  const courses = await Course.find({ instructor: req.user.id })
    .populate("instructor", "name avatar")
    .sort("-createdAt");

  res.status(200).json({
    success: true,
    count: courses.length,
    data: courses,
  });
});

// @desc    Get course stats
// @route   GET /api/courses/:id/stats
// @access  Private (Admin, Teacher)
exports.getCourseStats = asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.id);

  if (!course) {
    return next(
      new ErrorResponse(`Course not found with id ${req.params.id}`, 404),
    );
  }

  if (
    req.user.role !== "admin" &&
    course.instructor.toString() !== req.user.id
  ) {
    return next(new ErrorResponse("Not authorized to view course stats", 403));
  }

  const stats = {
    totalEnrolled: course.totalStudents,
    capacity: course.maxEnrollments || "Unlimited",
    averageProgress:
      course.students.length > 0
        ? Math.round(
            course.students.reduce((acc, s) => acc + s.progress, 0) /
              course.students.length,
          )
        : 0,
    completionRate:
      course.students.length > 0
        ? Math.round(
            (course.students.filter((s) => s.progress === 100).length /
              course.students.length) *
              100,
          )
        : 0,
    rating: course.rating,
    totalChapters: course.totalChapters,
    totalLessons: course.totalLessons,
    totalDuration: course.totalDuration,
  };

  res.status(200).json({
    success: true,
    data: stats,
  });
});
