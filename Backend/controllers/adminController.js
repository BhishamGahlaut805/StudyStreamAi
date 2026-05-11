const User = require("../models/user");
const Course = require("../models/Courses/course");
const Enrollment = require("../models/Courses/Enrollment");
const CourseCurriculum = require("../models/Courses/curriculum");
const sendPasswordEmail = require("../utils/sendPasswordEmail");
const generateSecurePassword = require("../utils/PasswordGen");

const buildStudentSnapshot = (enrollment) => {
  const student = enrollment.student || {};
  const completedLessons = enrollment.progress?.completedLessons || [];
  const completedQuizzes = enrollment.progress?.completedQuizzes || [];
  const completedAssignments = enrollment.progress?.completedAssignments || [];

  return {
    enrollmentId: enrollment._id,
    student: {
      id: student._id,
      name: student.name,
      email: student.email,
      role: student.role,
      studentId: student.studentId,
      avatar: student.avatar || student.profilePhoto,
    },
    enrollmentStatus: enrollment.enrollmentStatus,
    enrolledAt: enrollment.enrolledAt,
    progress: {
      overallProgress: enrollment.progress?.overallProgress || 0,
      completedLessons: completedLessons.length,
      completedQuizzes: completedQuizzes.length,
      completedAssignments: completedAssignments.length,
      completedLessonDetails: completedLessons,
      completedQuizDetails: completedQuizzes,
      completedAssignmentDetails: completedAssignments,
    },
    learningMetrics: enrollment.learningMetrics || {},
    paymentDetails: enrollment.paymentDetails || {},
    certificate: enrollment.certificate || {},
    notes: enrollment.notes || "",
    completedAt: enrollment.completedAt || null,
    droppedAt: enrollment.droppedAt || null,
    lastActivityAt: enrollment.learningMetrics?.lastActivityAt || null,
  };
};

const buildCourseSummary = (course, enrollments = [], curriculum = null) => {
  const instructor = course.instructor || {};
  const totalEnrolled = enrollments.length || course.totalStudents || 0;
  const maxEnrollments = course.maxEnrollments || null;
  const capacityUsage = maxEnrollments
    ? Math.min(100, Math.round((totalEnrolled / maxEnrollments) * 100))
    : null;

  const statusCounts = enrollments.reduce(
    (accumulator, enrollment) => {
      const status = enrollment.enrollmentStatus || "active";
      accumulator[status] = (accumulator[status] || 0) + 1;
      return accumulator;
    },
    { active: 0, completed: 0, dropped: 0, paused: 0 },
  );

  const totalProgress = enrollments.reduce(
    (sum, enrollment) => sum + (enrollment.progress?.overallProgress || 0),
    0,
  );
  const averageProgress = totalEnrolled
    ? Math.round(totalProgress / totalEnrolled)
    : 0;

  const completedCount = statusCounts.completed || 0;
  const completionRate = totalEnrolled
    ? Math.round((completedCount / totalEnrolled) * 100)
    : 0;

  const sortedStudents = [...enrollments]
    .sort((left, right) => {
      const rightProgress = right.progress?.overallProgress || 0;
      const leftProgress = left.progress?.overallProgress || 0;
      if (rightProgress !== leftProgress) {
        return rightProgress - leftProgress;
      }
      return new Date(right.enrolledAt || 0) - new Date(left.enrolledAt || 0);
    })
    .map(buildStudentSnapshot);

  const latestEnrollmentAt = enrollments.reduce((latest, enrollment) => {
    const enrolledAt = enrollment.enrolledAt
      ? new Date(enrollment.enrolledAt)
      : null;
    if (!enrolledAt) return latest;
    if (!latest || enrolledAt > latest) return enrolledAt;
    return latest;
  }, null);

  return {
    id: course._id,
    title: course.title,
    slug: course.slug,
    description: course.description,
    shortDescription: course.shortDescription,
    category: course.category,
    tags: course.tags || [],
    level: course.level,
    language: course.language,
    price: course.price,
    discountPrice: course.discountPrice,
    discountPercentage:
      course.price && course.discountPrice
        ? Math.round(
            ((course.price - course.discountPrice) / course.price) * 100,
          )
        : 0,
    status: course.status,
    isPublished: course.isPublished,
    isApproved: course.isApproved,
    approvalNote: course.approvalNote || "",
    instructor: instructor
      ? {
          id: instructor._id,
          name: instructor.name,
          email: instructor.email,
          role: instructor.role,
          avatar: instructor.avatar,
          studentId: instructor.studentId,
        }
      : null,
    totals: {
      totalStudents: course.totalStudents || totalEnrolled,
      totalChapters: course.totalChapters || curriculum?.totalChapters || 0,
      totalLessons: course.totalLessons || curriculum?.totalLessons || 0,
      totalDuration: course.totalDuration || curriculum?.totalDuration || 0,
      ratingAverage: course.rating?.average || 0,
      ratingCount: course.rating?.count || 0,
      maxEnrollments,
      capacityUsage,
    },
    enrollmentSummary: {
      totalEnrolled,
      active: statusCounts.active,
      completed: statusCounts.completed,
      dropped: statusCounts.dropped,
      paused: statusCounts.paused,
      averageProgress,
      completionRate,
      latestEnrollmentAt,
    },
    curriculum: curriculum
      ? {
          id: curriculum._id,
          totalChapters: curriculum.totalChapters || 0,
          totalLessons: curriculum.totalLessons || 0,
          totalDuration: curriculum.totalDuration || 0,
          updatedAt: curriculum.updatedAt,
          chapters: curriculum.chapters || [],
        }
      : null,
    students: sortedStudents,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
    publishedAt: course.publishedAt || null,
  };
};

const courseBaseSelect =
  "title slug description shortDescription price discountPrice category tags level language instructor students maxEnrollments totalStudents totalDuration totalChapters totalLessons rating status isPublished isApproved approvalNote publishedAt createdAt updatedAt";

// GET all users
exports.getAllUsers = async (req, res) => {
  try {
    // Add pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // By default return only active/verified users; allow includeInactive=true to return all
    const includeInactive = req.query.includeInactive === "true";
    const filter = includeInactive ? {} : { isVerified: true };

    const users = await User.find(filter)
      .select("-password -__v -refreshToken")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const totalUsers = await User.countDocuments(filter);

    res.status(200).json({
      success: true,
      users,
      total: totalUsers,
      page,
      pages: Math.ceil(totalUsers / limit),
    });
  } catch (err) {
    console.error("Get Users Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: err.message,
    });
  }
};

// POST verify user
exports.verifyUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "User already verified",
      });
    }

    // Only teachers should receive generated credentials via email on verification
    if (user.role === "teacher") {
      const generatedPassword = generateSecurePassword();
      user.password = generatedPassword;
      user.isVerified = true;

      await user.save();

      await sendPasswordEmail(user.email, generatedPassword);

      return res.status(200).json({
        success: true,
        message: "Teacher verified and credentials sent via email",
      });
    }

    // For admins or students, just mark verified without sending credentials
    user.isVerified = true;
    await user.save();

    res.status(200).json({
      success: true,
      message: "User verified",
    });
  } catch (err) {
    console.error("Verify User Error:", err);
    res.status(500).json({
      success: false,
      message: "Verification failed",
      error: err.message,
    });
  }
};

// DELETE user by admin
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate user ID format
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format",
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prevent admin from deleting themselves
    if (user._id.toString() === req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Cannot delete your own admin account",
      });
    }

    // Delete the user
    await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (err) {
    console.error("Delete User Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete user",
      error: err.message,
    });
  }
};

// GET admin course overview
exports.getAllCourses = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 10, 1),
      100,
    );
    const skip = (page - 1) * limit;
    const { search, status, instructorId, category } = req.query;

    const query = {};

    if (status) {
      query.status = status;
    }

    if (instructorId) {
      query.instructor = instructorId;
    }

    if (category) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { shortDescription: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    }

    const [courses, total] = await Promise.all([
      Course.find(query)
        .select(courseBaseSelect)
        .populate("instructor", "name email role avatar studentId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Course.countDocuments(query),
    ]);

    const courseIds = courses.map((course) => course._id);
    const [enrollments, curricula] = await Promise.all([
      Enrollment.find({ course: { $in: courseIds } })
        .populate("student", "name email role avatar studentId")
        .sort({ enrolledAt: -1 }),
      CourseCurriculum.find({ course: { $in: courseIds } }),
    ]);

    const enrollmentsByCourse = enrollments.reduce(
      (accumulator, enrollment) => {
        const key = enrollment.course.toString();
        if (!accumulator[key]) {
          accumulator[key] = [];
        }
        accumulator[key].push(enrollment);
        return accumulator;
      },
      {},
    );

    const curriculumByCourse = curricula.reduce((accumulator, curriculum) => {
      accumulator[curriculum.course.toString()] = curriculum;
      return accumulator;
    }, {});

    const data = courses.map((course) =>
      buildCourseSummary(
        course,
        enrollmentsByCourse[course._id.toString()] || [],
        curriculumByCourse[course._id.toString()] || null,
      ),
    );

    const totalEnrollments = enrollments.length;
    const uniqueStudentIds = new Set(
      enrollments.map((enrollment) => enrollment.student?._id?.toString()),
    );

    res.status(200).json({
      success: true,
      count: data.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      summary: {
        totalCourses: total,
        totalEnrollments,
        uniqueStudents: uniqueStudentIds.size,
        publishedCourses: await Course.countDocuments({
          ...query,
          status: "published",
        }),
        pendingCourses: await Course.countDocuments({
          ...query,
          status: "pending",
        }),
      },
      data,
    });
  } catch (err) {
    console.error("Get Courses Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch courses",
      error: err.message,
    });
  }
};

// GET admin course summary
exports.getCourseSummary = async (req, res) => {
  try {
    const [
      totalCourses,
      publishedCourses,
      pendingCourses,
      rejectedCourses,
      archivedCourses,
    ] = await Promise.all([
      Course.countDocuments({}),
      Course.countDocuments({ status: "published" }),
      Course.countDocuments({ status: "pending" }),
      Course.countDocuments({ status: "rejected" }),
      Course.countDocuments({ status: "archived" }),
    ]);

    const enrollments = await Enrollment.find({}).select("student course");
    const uniqueStudents = new Set(
      enrollments.map((enrollment) => enrollment.student?.toString()),
    );

    const topCourses = await Course.find({})
      .select(courseBaseSelect)
      .populate("instructor", "name email role avatar studentId")
      .sort({ totalStudents: -1, createdAt: -1 })
      .limit(10);

    const topCoursesData = topCourses.map((course) =>
      buildCourseSummary(course, [], null),
    );

    res.status(200).json({
      success: true,
      data: {
        totalCourses,
        publishedCourses,
        pendingCourses,
        rejectedCourses,
        archivedCourses,
        totalEnrollments: enrollments.length,
        uniqueStudents: uniqueStudents.size,
        topCourses: topCoursesData,
      },
    });
  } catch (err) {
    console.error("Get Course Summary Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch course summary",
      error: err.message,
    });
  }
};

// GET deep course analytics for one course
exports.getCourseAnalytics = async (req, res) => {
  try {
    const { courseId } = req.params;

    if (!courseId || !courseId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course ID format",
      });
    }

    const course = await Course.findById(courseId)
      .select(courseBaseSelect)
      .populate("instructor", "name email role avatar studentId");

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    const [enrollments, curriculum] = await Promise.all([
      Enrollment.find({ course: courseId })
        .populate(
          "student",
          "name email role avatar studentId createdAt lastLogin",
        )
        .sort({ enrolledAt: -1 }),
      CourseCurriculum.findOne({ course: courseId }),
    ]);

    const analytics = buildCourseSummary(course, enrollments, curriculum);

    const progressBands = enrollments.reduce(
      (accumulator, enrollment) => {
        const progress = enrollment.progress?.overallProgress || 0;
        if (progress >= 80) {
          accumulator.excellent += 1;
        } else if (progress >= 50) {
          accumulator.good += 1;
        } else if (progress > 0) {
          accumulator.needsHelp += 1;
        } else {
          accumulator.notStarted += 1;
        }
        return accumulator;
      },
      { excellent: 0, good: 0, needsHelp: 0, notStarted: 0 },
    );

    const averageTimeSpent = enrollments.length
      ? Math.round(
          enrollments.reduce(
            (sum, enrollment) =>
              sum + (enrollment.learningMetrics?.totalTimeSpent || 0),
            0,
          ) / enrollments.length,
        )
      : 0;

    res.status(200).json({
      success: true,
      data: {
        ...analytics,
        analysis: {
          progressBands,
          averageTimeSpent,
          latestEnrollments: analytics.students.slice(0, 10),
        },
      },
    });
  } catch (err) {
    console.error("Get Course Analytics Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch course analytics",
      error: err.message,
    });
  }
};

// GET students enrolled in a course for admin review
exports.getCourseStudents = async (req, res) => {
  try {
    const { courseId } = req.params;

    if (!courseId || !courseId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course ID format",
      });
    }

    const course = await Course.findById(courseId)
      .select("title instructor students totalStudents maxEnrollments status")
      .populate("instructor", "name email role avatar studentId");

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    let enrollments = await Enrollment.find({ course: courseId })
      .populate(
        "student",
        "name email role avatar studentId createdAt lastLogin",
      )
      .sort({ enrolledAt: -1 });

    if (
      enrollments.length === 0 &&
      Array.isArray(course.students) &&
      course.students.length > 0
    ) {
      const populatedCourse = await Course.findById(courseId)
        .populate(
          "students",
          "name email role avatar studentId createdAt lastLogin",
        )
        .populate("instructor", "name email role avatar studentId");

      enrollments = (populatedCourse?.students || []).map((student) => ({
        _id: student._id,
        student,
        course: populatedCourse._id,
        enrolledAt: null,
        enrollmentStatus: "active",
        progress: {
          overallProgress: 0,
          completedLessons: [],
          completedQuizzes: [],
          completedAssignments: [],
        },
        learningMetrics: {},
        paymentDetails: {},
        certificate: {},
      }));
    }

    const students = enrollments.map(buildStudentSnapshot);

    res.status(200).json({
      success: true,
      count: students.length,
      course: {
        id: course._id,
        title: course.title,
        status: course.status,
        instructor: course.instructor,
        totalStudents: course.totalStudents || students.length,
        maxEnrollments: course.maxEnrollments,
      },
      data: students,
    });
  } catch (err) {
    console.error("Get Course Students Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch course students",
      error: err.message,
    });
  }
};
