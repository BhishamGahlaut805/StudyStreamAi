const Course = require("../../models/Courses/course");
const CourseCurriculum = require("../../models/Courses/curriculum");
const asyncHandler = require("../../middleware/asyncHandler");
const ErrorResponse = require("../../utils/ErrorResponse");

// Helper functions
const canManageCourse = (course, user) => {
  if (!course || !user) return false;
  return (
    user.role === "admin" || course.instructor.toString() === user.id.toString()
  );
};

// @desc    Get course curriculum
// @route   GET /api/courses/:id/curriculum
// @access  Private
exports.getCourseCurriculum = asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.id);

  if (!course) {
    return next(
      new ErrorResponse(`Course not found with id ${req.params.id}`, 404),
    );
  }

  // Check access - allow teacher, admin, or enrolled students
  const isOwner =
    req.user.role === "admin" || course.instructor.toString() === req.user.id;
  const isEnrolled = course.isStudentEnrolled(req.user.id);

  if (!isOwner && !isEnrolled) {
    return next(new ErrorResponse("Not authorized to view curriculum", 403));
  }

  const curriculum = await CourseCurriculum.findOne({ course: req.params.id });

  res.status(200).json({
    success: true,
    data: curriculum || { chapters: [] },
  });
});

// @desc    Add chapter to curriculum
// @route   POST /api/courses/:id/curriculum/chapters
// @access  Private (Teacher, Admin)
exports.addCurriculumChapter = asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.id);

  if (!course) {
    return next(
      new ErrorResponse(`Course not found with id ${req.params.id}`, 404),
    );
  }

  if (!canManageCourse(course, req.user)) {
    return next(new ErrorResponse("Not authorized to edit curriculum", 403));
  }

  let curriculum = await CourseCurriculum.findOne({ course: req.params.id });

  if (!curriculum) {
    curriculum = await CourseCurriculum.create({
      course: req.params.id,
      chapters: [],
      updatedBy: req.user.id,
    });
  }

  curriculum.addChapter(req.body);
  curriculum.updatedBy = req.user.id;
  await curriculum.save();

  res.status(201).json({
    success: true,
    data: curriculum,
  });
});

// @desc    Add lesson to chapter
// @route   POST /api/courses/:id/curriculum/chapters/:chapterId/lessons
// @access  Private (Teacher, Admin)
exports.addCurriculumLesson = asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.id);

  if (!course) {
    return next(
      new ErrorResponse(`Course not found with id ${req.params.id}`, 404),
    );
  }

  if (!canManageCourse(course, req.user)) {
    return next(new ErrorResponse("Not authorized to edit curriculum", 403));
  }

  const curriculum = await CourseCurriculum.findOne({ course: req.params.id });

  if (!curriculum) {
    return next(
      new ErrorResponse("Curriculum not found. Add a chapter first.", 404),
    );
  }

  try {
    curriculum.addLessonToChapter(req.params.chapterId, req.body);
    curriculum.updatedBy = req.user.id;
    await curriculum.save();
  } catch (error) {
    return next(new ErrorResponse(error.message, 400));
  }

  res.status(201).json({
    success: true,
    data: curriculum,
  });
});
