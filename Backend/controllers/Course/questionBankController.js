// controllers/Course/questionBankController.js
const Course = require("../../models/Courses/course");
const CourseQuestionBank = require("../../models/Question/questionAdaptationSchema");
const asyncHandler = require("../../middleware/asyncHandler");
const ErrorResponse = require("../../utils/ErrorResponse");

// Helper function to check course ownership
const checkCourseOwnership = (course, user) => {
  const instructorId = course.instructor.toString();
  const userId = user.id.toString();
  const isAdmin = user.role === "admin";
  const isOwner = instructorId === userId;

  console.log("[QuestionBank] Ownership check:", {
    instructorId,
    userId,
    userRole: user.role,
    isAdmin,
    isOwner,
  });

  return isAdmin || isOwner;
};

// @desc    Create question bank for a course
// @route   POST /api/courses/:courseId/question-bank
// @access  Private (Teacher, Admin)
exports.createQuestionBank = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.courseId);

  if (!course) {
    return res.status(404).json({
      success: false,
      error: "Course not found",
    });
  }

  // Check ownership
  if (!checkCourseOwnership(course, req.user)) {
    return res.status(403).json({
      success: false,
      error: `Not authorized. You are not the instructor of this course. Your ID: ${req.user.id}, Instructor ID: ${course.instructor}`,
    });
  }

  // Check if question bank already exists
  let questionBank = await CourseQuestionBank.findOne({
    course: req.params.courseId,
    subject: req.body.subject,
  });

  if (questionBank) {
    return res.status(400).json({
      success: false,
      error: "Question bank already exists for this subject in this course",
    });
  }

  questionBank = await CourseQuestionBank.create({
    course: req.params.courseId,
    teacher: req.user.id,
    subject: req.body.subject || "General",
    topics: req.body.topics || [],
    questions: req.body.questions || [],
  });

  res.status(201).json({
    success: true,
    data: questionBank,
  });
});

// @desc    Get question bank for a course
// @route   GET /api/courses/:courseId/question-bank
// @access  Private (Teacher, Admin, Enrolled Students)
exports.getQuestionBank = asyncHandler(async (req, res) => {
  const { subject } = req.query;

  const query = { course: req.params.courseId };
  if (subject) {
    query.subject = subject;
  }

  const questionBank = await CourseQuestionBank.findOne(query)
    .select("-questions.correct_answer")
    .populate("teacher", "name email");

  if (!questionBank) {
    return res.status(404).json({
      success: false,
      error: "Question bank not found",
    });
  }

  res.status(200).json({
    success: true,
    data: questionBank,
  });
});

// @desc    Get question bank with answers (Teacher only)
// @route   GET /api/courses/:courseId/question-bank/teacher
// @access  Private (Teacher, Admin)
exports.getQuestionBankTeacher = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.courseId);

  if (!course) {
    return res.status(404).json({
      success: false,
      error: "Course not found",
    });
  }

  if (!checkCourseOwnership(course, req.user)) {
    return res.status(403).json({
      success: false,
      error: "Not authorized",
    });
  }

  const questionBank = await CourseQuestionBank.findOne({
    course: req.params.courseId,
  }).populate("teacher", "name email");

  res.status(200).json({
    success: true,
    data: questionBank,
  });
});

// @desc    Add questions to question bank
// @route   POST /api/courses/:courseId/question-bank/questions
// @access  Private (Teacher, Admin)
exports.addQuestions = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.courseId);

  if (!course) {
    return res.status(404).json({
      success: false,
      error: "Course not found",
    });
  }

  if (!checkCourseOwnership(course, req.user)) {
    return res.status(403).json({
      success: false,
      error: "Not authorized",
    });
  }

  let questionBank = await CourseQuestionBank.findOne({
    course: req.params.courseId,
  });

  if (!questionBank) {
    return res.status(404).json({
      success: false,
      error: "Question bank not found. Create one first.",
    });
  }

  const { questions } = req.body;

  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({
      success: false,
      error: "Please provide questions array",
    });
  }

  await questionBank.addQuestions(questions);

  res.status(200).json({
    success: true,
    data: questionBank,
    message: `${questions.length} questions added successfully`,
  });
});

// @desc    Update a question
// @route   PUT /api/courses/:courseId/question-bank/questions/:questionId
// @access  Private (Teacher, Admin)
exports.updateQuestion = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.courseId);

  if (!course) {
    return res.status(404).json({
      success: false,
      error: "Course not found",
    });
  }

  if (!checkCourseOwnership(course, req.user)) {
    return res.status(403).json({
      success: false,
      error: "Not authorized",
    });
  }

  const questionBank = await CourseQuestionBank.findOne({
    course: req.params.courseId,
  });

  if (!questionBank) {
    return res.status(404).json({
      success: false,
      error: "Question bank not found",
    });
  }

  await questionBank.updateQuestion(req.params.questionId, req.body);

  res.status(200).json({
    success: true,
    data: questionBank,
  });
});

// @desc    Delete a question
// @route   DELETE /api/courses/:courseId/question-bank/questions/:questionId
// @access  Private (Teacher, Admin)
exports.deleteQuestion = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.courseId);

  if (!course) {
    return res.status(404).json({
      success: false,
      error: "Course not found",
    });
  }

  if (!checkCourseOwnership(course, req.user)) {
    return res.status(403).json({
      success: false,
      error: "Not authorized",
    });
  }

  const questionBank = await CourseQuestionBank.findOne({
    course: req.params.courseId,
  });

  if (!questionBank) {
    return res.status(404).json({
      success: false,
      error: "Question bank not found",
    });
  }

  await questionBank.removeQuestion(req.params.questionId);

  res.status(200).json({
    success: true,
    data: {},
    message: "Question deleted successfully",
  });
});

// @desc    Update topics for question bank
// @route   PUT /api/courses/:courseId/question-bank/topics
// @access  Private (Teacher, Admin)
exports.updateTopics = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.courseId);

  if (!course) {
    return res.status(404).json({
      success: false,
      error: "Course not found",
    });
  }

  if (!checkCourseOwnership(course, req.user)) {
    return res.status(403).json({
      success: false,
      error: "Not authorized",
    });
  }

  const questionBank = await CourseQuestionBank.findOne({
    course: req.params.courseId,
  });

  if (!questionBank) {
    return res.status(404).json({
      success: false,
      error: "Question bank not found",
    });
  }

  const { topics } = req.body;

  if (!topics || !Array.isArray(topics)) {
    return res.status(400).json({
      success: false,
      error: "Please provide topics array",
    });
  }

  questionBank.topics = topics;
  await questionBank.save();

  res.status(200).json({
    success: true,
    data: questionBank,
  });
});

// @desc    Get practice questions for students
// @route   GET /api/practice/course/:courseId/practice
// @access  Private (Student)
exports.getPracticeQuestions = asyncHandler(async (req, res) => {
  const { topic, difficulty, count = 10, mode = "adaptive" } = req.query;

  const questionBank = await CourseQuestionBank.findOne({
    course: req.params.courseId,
    isPublished: true,
  });

  if (!questionBank) {
    return res.status(404).json({
      success: false,
      error: "No practice questions available for this course",
    });
  }

  let questions = [];

  if (mode === "adaptive" && topic && difficulty) {
    questions = questionBank.getAdaptiveQuestions(
      topic,
      difficulty,
      parseInt(count),
    );
  } else if (topic) {
    questions = questionBank.getQuestionsByTopic(topic, difficulty);
    questions = questions
      .sort(() => Math.random() - 0.5)
      .slice(0, parseInt(count));
  } else {
    questions = questionBank.questions
      .filter((q) => q.isActive)
      .sort(() => Math.random() - 0.5)
      .slice(0, parseInt(count));
  }

  const practiceQuestions = questions.map((q) => {
    const { correct_answer, ...rest } = q.toObject();
    return rest;
  });

  res.status(200).json({
    success: true,
    count: practiceQuestions.length,
    data: {
      questions: practiceQuestions,
      metadata: {
        mode,
        topic: topic || "all",
        difficulty: difficulty || "mixed",
      },
    },
  });
});

// @desc    Submit practice answers and get results
// @route   POST /api/practice/course/:courseId/practice/submit
// @access  Private (Student)
exports.submitPracticeAnswers = asyncHandler(async (req, res) => {
  const { answers } = req.body;

  if (!answers || !Array.isArray(answers)) {
    return res.status(400).json({
      success: false,
      error: "Please provide answers array",
    });
  }

  const questionBank = await CourseQuestionBank.findOne({
    course: req.params.courseId,
  });

  if (!questionBank) {
    return res.status(404).json({
      success: false,
      error: "Question bank not found",
    });
  }

  const results = answers.map((answer) => {
    const question = questionBank.questions.find(
      (q) => q.questionId === answer.questionId,
    );

    if (!question) {
      return {
        questionId: answer.questionId,
        status: "invalid",
        message: "Question not found",
      };
    }

    const isCorrect = question.correct_answer === answer.selectedAnswer;

    return {
      questionId: answer.questionId,
      status: isCorrect ? "correct" : "incorrect",
      selectedAnswer: answer.selectedAnswer,
      correctAnswer: question.correct_answer,
      explanation: question.explanation,
      topic: question.topic,
      difficulty: question.difficulty_level,
      marks: isCorrect ? question.marks : 0,
    };
  });

  const totalMarks = results.reduce((sum, r) => sum + (r.marks || 0), 0);
  const totalQuestions = results.length;
  const correctCount = results.filter((r) => r.status === "correct").length;
  const accuracy = Math.round((correctCount / totalQuestions) * 100);

  const topicAnalysis = {};
  results.forEach((r) => {
    if (!topicAnalysis[r.topic]) {
      topicAnalysis[r.topic] = { total: 0, correct: 0 };
    }
    topicAnalysis[r.topic].total++;
    if (r.status === "correct") {
      topicAnalysis[r.topic].correct++;
    }
  });

  Object.keys(topicAnalysis).forEach((topic) => {
    topicAnalysis[topic].accuracy = Math.round(
      (topicAnalysis[topic].correct / topicAnalysis[topic].total) * 100,
    );
  });

  res.status(200).json({
    success: true,
    data: {
      results,
      summary: {
        totalQuestions,
        correctCount,
        accuracy,
        totalMarks,
        topicAnalysis,
      },
    },
  });
});
