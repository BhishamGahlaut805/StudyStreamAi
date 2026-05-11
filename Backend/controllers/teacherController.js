const asyncHandler = require("../middleware/asyncHandler");
const ErrorResponse = require("../utils/ErrorResponse");
const Course = require("../models/Courses/course");
const User = require("../models/user");
const Profile = require("../models/profile");

const toId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  return (
    value?._id?.toString?.() ||
    value?.id?.toString?.() ||
    value?.user?.toString?.() ||
    ""
  );
};

const firstDefined = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const resolveStudentPerformanceUserId = async (studentIdentifier) => {
  const candidate = toId(studentIdentifier);

  if (!candidate) {
    return "";
  }

  if (/^[a-fA-F0-9]{24}$/.test(candidate)) {
    const directUser = await User.findById(candidate).select("_id").lean();
    if (directUser) {
      return toId(directUser._id);
    }
  }

  const matchedUser = await User.findOne({ studentId: candidate })
    .select("_id")
    .lean();

  return toId(matchedUser?._id);
};

const normalizeStudentName = (user = {}, profile = {}) =>
  firstDefined(
    user.name,
    user.fullName,
    user.studentName,
    profile.fullName,
    profile.displayName,
    profile.bio,
    user.userId,
    "Unknown Student",
  );

const normalizeStudentEmail = (user = {}, profile = {}) =>
  firstDefined(user.email, profile.additionalEmail, profile.email, "");

const getCourseStudentUserIds = (course = {}) =>
  (course.students || [])
    .map((student) => toId(student.user || student.student || student))
    .filter(Boolean);

const hydrateCourseStudents = async (courses = []) => {
  const studentIds = Array.from(
    new Set(courses.flatMap((course) => getCourseStudentUserIds(course))),
  );

  if (studentIds.length === 0) {
    return new Map();
  }

  const [users, profiles, enrollments] = await Promise.all([
    User.find({ _id: { $in: studentIds } })
      .select("name email studentId profile enrolledCourses")
      .lean(),
    Profile.find({ userId: { $in: studentIds } })
      .select(
        "userId fullName additionalEmail profilePhoto contactNumber phoneNumber",
      )
      .lean(),
    require("../models/Courses/Enrollment")
      .find({
        student: { $in: studentIds },
        course: { $in: courses.map((course) => course._id) },
      })
      .populate("course", "title")
      .lean(),
  ]);

  const userMap = new Map(users.map((user) => [toId(user._id), user]));
  const profileMap = new Map(
    profiles.map((profile) => [toId(profile.userId), profile]),
  );
  const enrollmentMap = new Map();

  enrollments.forEach((enrollment) => {
    const key = `${toId(enrollment.student)}:${toId(enrollment.course?._id || enrollment.course)}`;
    if (!enrollmentMap.has(key)) {
      enrollmentMap.set(key, enrollment);
    }
  });

  const hydratedStudents = new Map();

  studentIds.forEach((studentId) => {
    const user = userMap.get(studentId) || {};
    const profile = profileMap.get(studentId) || {};

    const studentEnrollments = enrollments.filter(
      (enrollment) => toId(enrollment.student) === studentId,
    );

    hydratedStudents.set(studentId, {
      _id: studentId,
      name: normalizeStudentName(user, profile),
      email: normalizeStudentEmail(user, profile),
      studentId: user.studentId || "",
      profile: {
        fullName: profile.fullName || "",
        additionalEmail: profile.additionalEmail || "",
        profilePhoto: profile.profilePhoto || "",
        contactNumber: profile.contactNumber || profile.phoneNumber || "",
      },
      enrolledCourses: Array.from(
        new Set(
          [
            ...(user.enrolledCourses || []),
            ...studentEnrollments.map(
              (enrollment) => enrollment.course?._id || enrollment.course,
            ),
          ]
            .map((courseId) => toId(courseId))
            .filter(Boolean),
        ),
      ),
      enrollments: studentEnrollments.map((enrollment) => ({
        courseId: toId(enrollment.course?._id || enrollment.course),
        courseTitle: enrollment.course?.title || "Unknown Course",
        progress: enrollment.progress?.overallProgress || 0,
        completedLessons: enrollment.progress?.completedLessons?.length || 0,
        averageQuizScore: enrollment.learningMetrics?.averageQuizScore || 0,
        averageAssignmentScore:
          enrollment.learningMetrics?.averageAssignmentScore || 0,
        totalTimeSpent: enrollment.learningMetrics?.totalTimeSpent || 0,
        studyStreak: enrollment.learningMetrics?.studyStreak || 0,
        longestStreak: enrollment.learningMetrics?.longestStreak || 0,
        enrollmentStatus: enrollment.enrollmentStatus || "active",
        enrolledAt: enrollment.enrolledAt,
        lastActivity: enrollment.learningMetrics?.lastActivityAt,
      })),
    });
  });

  return hydratedStudents;
};

const buildTeacherStudentResponse = (
  courses = [],
  hydratedStudents = new Map(),
) => {
  const studentRows = new Map();

  courses.forEach((course) => {
    const courseId = toId(course._id);
    const courseTitle = course.title || "Unknown Course";

    getCourseStudentUserIds(course).forEach((studentId) => {
      const hydrated = hydratedStudents.get(studentId) || {};
      const existing = studentRows.get(studentId) || {
        _id: studentId,
        name: hydrated.name || "Unknown Student",
        studentName: hydrated.name || "Unknown Student",
        fullName: hydrated.name || "Unknown Student",
        email: hydrated.email || "",
        studentEmail: hydrated.email || "",
        studentId: hydrated.studentId || "",
        profile: hydrated.profile || {},
        enrolledCourses: [],
        enrolledInCourses: [],
        enrolledCourseTitles: [],
        primaryCourseTitle: "",
        enrollments: [],
      };

      const mergedCourseIds = Array.from(
        new Set(
          [
            ...existing.enrolledCourses,
            courseId,
            ...(hydrated.enrolledCourses || []),
          ]
            .flat()
            .filter(Boolean),
        ),
      );
      const mergedCourseTitles = Array.from(
        new Set(
          [
            ...existing.enrolledCourseTitles,
            courseTitle,
            ...(hydrated.enrollments || [])
              .map((enrollment) => enrollment.courseTitle)
              .filter(Boolean),
          ].filter(Boolean),
        ),
      );
      const mergedEnrollments = Array.from(
        new Map(
          [...existing.enrollments, ...(hydrated.enrollments || [])].map(
            (enrollment) => [
              `${enrollment.courseId || ""}:${enrollment.enrollmentStatus || ""}:${enrollment.enrolledAt || ""}`,
              enrollment,
            ],
          ),
        ).values(),
      );

      studentRows.set(studentId, {
        ...existing,
        name: firstDefined(
          hydrated.name,
          hydrated.studentName,
          hydrated.fullName,
          existing.name,
          existing.studentName,
          existing.fullName,
          "Unknown Student",
        ),
        studentName: firstDefined(
          hydrated.studentName,
          hydrated.name,
          hydrated.fullName,
          existing.studentName,
          existing.name,
          existing.fullName,
          "Unknown Student",
        ),
        fullName: firstDefined(
          hydrated.fullName,
          hydrated.name,
          hydrated.studentName,
          existing.fullName,
          existing.name,
          existing.studentName,
          "Unknown Student",
        ),
        email: firstDefined(
          hydrated.email,
          hydrated.studentEmail,
          existing.email,
          existing.studentEmail,
          "",
        ),
        studentEmail: firstDefined(
          hydrated.studentEmail,
          hydrated.email,
          existing.studentEmail,
          existing.email,
          "",
        ),
        studentId: firstDefined(hydrated.studentId, existing.studentId, ""),
        profile: {
          ...(existing.profile || {}),
          ...(hydrated.profile || {}),
        },
        enrolledCourses: mergedCourseIds,
        enrolledInCourses: mergedCourseIds,
        enrolledCourseTitles: mergedCourseTitles,
        primaryCourseTitle: firstDefined(
          mergedCourseTitles[0],
          existing.primaryCourseTitle,
          courseTitle,
          "",
        ),
        enrollments: mergedEnrollments,
      });
    });
  });

  return Array.from(studentRows.values());
};

const buildTeacherDashboardAnalytics = async (
  courses = [],
  hydratedStudents = new Map(),
) => {
  const StudentPerformance = require("../models/studentPerformance");

  const studentUserIds = Array.from(hydratedStudents.keys()).filter(Boolean);

  if (studentUserIds.length === 0) {
    return {
      summary: {
        studentsWithData: 0,
        averageAccuracy: 0,
        totalQuestions: 0,
        totalCorrect: 0,
        totalTimeSpent: 0,
        totalTests: 0,
        averageDifficulty: 0,
        averageConfidence: 0,
        averageStudyEfficiency: 0,
        averageFatigue: 0,
      },
      accuracyTrend: [],
      monthlyTrend: [],
      topStudents: [],
      weakStudents: [],
      topTopics: [],
      weakTopics: [],
      subjectPerformance: [],
      conceptMastery: [],
      retentionHighlights: [],
      errorPatterns: {
        conceptual: 0,
        careless: 0,
        guess: 0,
        overconfidence: 0,
      },
      confidenceCalibration: {
        overall: 0,
        byDifficulty: { easy: 0, medium: 0, hard: 0, very_hard: 0 },
      },
      fatigueIndex: { current: 0, trend: "stable", bySession: [] },
      studyEfficiency: { score: 0, improvementPerHour: 0, trend: "stable" },
      behaviorClusters: {},
      recommendations: [],
    };
  }

  const performanceRecords = await StudentPerformance.find({
    userId: { $in: studentUserIds },
  }).lean();

  const studentLookup = new Map();
  hydratedStudents.forEach((student, userId) => {
    studentLookup.set(userId.toString(), student);
  });

  const topicMap = new Map();
  const subjectMap = new Map();
  const conceptMap = new Map();
  const retentionMap = new Map();
  const timelineMap = new Map();
  const monthlyMap = new Map();
  const behaviorClusters = {};
  const errorPatterns = {
    conceptual: 0,
    careless: 0,
    guess: 0,
    overconfidence: 0,
  };
  const confidenceBuckets = {
    easy: [],
    medium: [],
    hard: [],
    very_hard: [],
  };
  const fatigueValues = [];
  const studyEfficiencyValues = [];
  const confidenceValues = [];
  const studentSnapshots = [];

  const getStudentIdentity = (performance) => {
    const byUser = studentLookup.get(performance.userId?.toString?.() || "");
    const hydrated = byUser || {};

    return {
      id: hydrated._id || performance.userId?.toString?.() || "",
      studentId: hydrated.studentId || "",
      name:
        hydrated.name ||
        hydrated.studentName ||
        hydrated.fullName ||
        "Unknown Student",
      email:
        hydrated.email ||
        hydrated.studentEmail ||
        hydrated.profile?.additionalEmail ||
        "",
      profilePhoto: hydrated.profile?.profilePhoto || "",
    };
  };

  const updateAggregates = (targetMap, key, entry) => {
    if (!key) return;
    if (!targetMap.has(key)) {
      targetMap.set(key, {
        ...entry,
        count: 0,
      });
    }

    const current = targetMap.get(key);
    current.count += 1;
    current.totalAccuracy =
      (current.totalAccuracy || 0) + (entry.accuracy || 0);
    current.totalQuestions =
      (current.totalQuestions || 0) + (entry.questionsAttempted || 0);
    current.totalCorrect =
      (current.totalCorrect || 0) + (entry.correctAnswers || 0);
    current.totalTimeSpent =
      (current.totalTimeSpent || 0) + (entry.timeSpent || 0);
    current.totalRetention =
      (current.totalRetention || 0) + (entry.retentionScore || 0);
    current.totalStability =
      (current.totalStability || 0) + (entry.stabilityIndex || 0);
    current.totalDifficulty =
      (current.totalDifficulty || 0) + (entry.averageDifficulty || 0);
    current.students = current.students || new Set();
    if (entry.studentId) current.students.add(entry.studentId);
    targetMap.set(key, current);
  };

  performanceRecords.forEach((performance) => {
    const student = getStudentIdentity(performance);
    const overallStats = performance.overallStats || {};
    const topicPerformance = performance.topicPerformance || [];
    const analytics = performance.analytics || {};

    studentSnapshots.push({
      studentId: student.studentId,
      name: student.name,
      email: student.email,
      accuracy: overallStats.accuracy || 0,
      totalQuestions: overallStats.totalQuestions || 0,
      totalCorrect: overallStats.totalCorrect || 0,
      totalTimeSpent: overallStats.totalTimeSpent || 0,
      totalTests: overallStats.totalTests || 0,
      averageDifficulty: overallStats.averageDifficulty || 0,
      currentStreak: overallStats.currentStreak || 0,
      longestStreak: overallStats.longestStreak || 0,
      lastActive:
        overallStats.lastActive ||
        performance.updatedAt ||
        performance.lastUpdated,
    });

    confidenceValues.push(analytics.confidenceCalibration?.overall || 0);
    if (analytics.confidenceCalibration?.byDifficulty) {
      Object.entries(analytics.confidenceCalibration.byDifficulty).forEach(
        ([difficulty, value]) => {
          if (!confidenceBuckets[difficulty]) {
            confidenceBuckets[difficulty] = [];
          }
          confidenceBuckets[difficulty].push(value || 0);
        },
      );
    }

    if (analytics.behaviorCluster) {
      behaviorClusters[analytics.behaviorCluster] =
        (behaviorClusters[analytics.behaviorCluster] || 0) + 1;
    }

    if (analytics.fatigueIndex?.current !== undefined) {
      fatigueValues.push(analytics.fatigueIndex.current);
    }

    if (analytics.studyEfficiency?.score !== undefined) {
      studyEfficiencyValues.push(analytics.studyEfficiency.score);
    }

    Object.entries(analytics.errorPatterns || {}).forEach(([key, value]) => {
      if (typeof value === "number" && errorPatterns[key] !== undefined) {
        errorPatterns[key] += value;
      }
    });

    Object.entries(analytics.conceptMastery || {}).forEach(([topic, value]) => {
      if (!Number.isFinite(Number(value))) return;
      if (!conceptMap.has(topic)) {
        conceptMap.set(topic, { topic, total: 0, count: 0 });
      }
      const current = conceptMap.get(topic);
      current.total += Number(value);
      current.count += 1;
      conceptMap.set(topic, current);
    });

    Object.entries(analytics.forgettingCurve?.retentionScores || {}).forEach(
      ([topic, value]) => {
        if (!retentionMap.has(topic)) {
          retentionMap.set(topic, { topic, total: 0, count: 0 });
        }
        const current = retentionMap.get(topic);
        current.total += Number(value.current || 0);
        current.count += 1;
        retentionMap.set(topic, current);
      },
    );

    (analytics.weaknessPriority || []).forEach((entry) => {
      if (!entry?.topic) return;
      if (!timelineMap.has(entry.topic)) {
        timelineMap.set(entry.topic, {
          topic: entry.topic,
          score: 0,
          count: 0,
        });
      }
      const current = timelineMap.get(entry.topic);
      current.score += Number(entry.score || 0);
      current.count += 1;
      timelineMap.set(entry.topic, current);
    });

    topicPerformance.forEach((topic) => {
      updateAggregates(topicMap, topic.topic, {
        studentId: student.studentId,
        accuracy: topic.accuracy || 0,
        questionsAttempted: topic.questionsAttempted || 0,
        correctAnswers: topic.correctAnswers || 0,
        timeSpent: topic.timeSpent || 0,
        retentionScore: topic.retentionScore || 0,
        stabilityIndex: topic.stabilityIndex || 0,
        averageDifficulty: topic.averageDifficulty || 0,
        masteryLevel: topic.masteryLevel || "beginner",
        subject: topic.subject || "general",
        lastPracticed: topic.lastPracticed || null,
        errorPatterns: topic.errorPatterns || {},
      });

      updateAggregates(subjectMap, topic.subject || "general", {
        studentId: student.studentId,
        accuracy: topic.accuracy || 0,
        questionsAttempted: topic.questionsAttempted || 0,
        correctAnswers: topic.correctAnswers || 0,
        timeSpent: topic.timeSpent || 0,
        retentionScore: topic.retentionScore || 0,
        stabilityIndex: topic.stabilityIndex || 0,
        averageDifficulty: topic.averageDifficulty || 0,
      });

      Object.entries(topic.errorPatterns || {}).forEach(([key, value]) => {
        if (typeof value === "number" && errorPatterns[key] !== undefined) {
          errorPatterns[key] += value;
        }
      });
    });

    const tests = performance.testHistory || [];
    tests.forEach((test) => {
      const date = test.date ? new Date(test.date) : null;
      if (!date || Number.isNaN(date.getTime())) return;

      const dayKey = date.toISOString().slice(0, 10);
      const monthKey = date.toISOString().slice(0, 7);

      if (!timelineMap.has(dayKey)) {
        timelineMap.set(dayKey, {
          label: dayKey,
          totalAccuracy: 0,
          totalQuestions: 0,
          totalTimeSpent: 0,
          totalDifficulty: 0,
          sessions: 0,
        });
      }

      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, {
          label: monthKey,
          totalAccuracy: 0,
          totalQuestions: 0,
          totalTimeSpent: 0,
          totalDifficulty: 0,
          sessions: 0,
        });
      }

      const dayEntry = timelineMap.get(dayKey);
      dayEntry.totalAccuracy += test.accuracy || 0;
      dayEntry.totalQuestions += test.totalQuestions || 0;
      dayEntry.totalTimeSpent += test.timeSpent || 0;
      dayEntry.totalDifficulty += test.averageDifficulty || 0;
      dayEntry.sessions += 1;
      timelineMap.set(dayKey, dayEntry);

      const monthEntry = monthlyMap.get(monthKey);
      monthEntry.totalAccuracy += test.accuracy || 0;
      monthEntry.totalQuestions += test.totalQuestions || 0;
      monthEntry.totalTimeSpent += test.timeSpent || 0;
      monthEntry.totalDifficulty += test.averageDifficulty || 0;
      monthEntry.sessions += 1;
      monthlyMap.set(monthKey, monthEntry);
    });
  });

  const topStudents = [...studentSnapshots]
    .sort((left, right) => right.accuracy - left.accuracy)
    .slice(0, 5);

  const weakStudents = [...studentSnapshots]
    .sort((left, right) => left.accuracy - right.accuracy)
    .slice(0, 5);

  const sortByAverage = (map, scoreKey = "totalAccuracy") =>
    Array.from(map.values())
      .map((entry) => ({
        ...entry,
        studentCount: entry.students ? entry.students.size : 0,
        averageAccuracy: entry.count ? entry[scoreKey] / entry.count : 0,
        averageQuestions: entry.count ? entry.totalQuestions / entry.count : 0,
        averageCorrect: entry.count ? entry.totalCorrect / entry.count : 0,
        averageTimeSpent: entry.count ? entry.totalTimeSpent / entry.count : 0,
        averageRetention: entry.count ? entry.totalRetention / entry.count : 0,
        averageStability: entry.count ? entry.totalStability / entry.count : 0,
        averageDifficulty: entry.count
          ? entry.totalDifficulty / entry.count
          : 0,
      }))
      .sort((left, right) => right.averageAccuracy - left.averageAccuracy);

  const topicRows = sortByAverage(topicMap);
  const subjectRows = sortByAverage(subjectMap);
  const conceptMastery = Array.from(conceptMap.values())
    .map((entry) => ({
      topic: entry.topic,
      value: entry.count ? entry.total / entry.count : 0,
    }))
    .sort((left, right) => right.value - left.value);
  const retentionHighlights = Array.from(retentionMap.values())
    .map((entry) => ({
      topic: entry.topic,
      value: entry.count ? entry.total / entry.count : 0,
    }))
    .sort((left, right) => right.value - left.value);

  const accuracyTrend = Array.from(timelineMap.values())
    .filter((entry) => entry.sessions)
    .map((entry) => ({
      date: entry.label,
      accuracy: entry.totalAccuracy / entry.sessions,
      questionsAttempted: entry.totalQuestions,
      timeSpent: entry.totalTimeSpent,
      difficulty: entry.totalDifficulty / entry.sessions,
    }))
    .sort((left, right) => new Date(left.date) - new Date(right.date));

  const monthlyTrend = Array.from(monthlyMap.values())
    .filter((entry) => entry.sessions)
    .map((entry) => ({
      date: entry.label,
      accuracy: entry.totalAccuracy / entry.sessions,
      questionsAttempted: entry.totalQuestions,
      timeSpent: entry.totalTimeSpent,
      difficulty: entry.totalDifficulty / entry.sessions,
    }))
    .sort(
      (left, right) =>
        new Date(`${left.date}-01`) - new Date(`${right.date}-01`),
    );

  const totalQuestions = performanceRecords.reduce(
    (sum, record) => sum + (record.overallStats?.totalQuestions || 0),
    0,
  );
  const totalCorrect = performanceRecords.reduce(
    (sum, record) => sum + (record.overallStats?.totalCorrect || 0),
    0,
  );
  const totalTimeSpent = performanceRecords.reduce(
    (sum, record) => sum + (record.overallStats?.totalTimeSpent || 0),
    0,
  );
  const totalTests = performanceRecords.reduce(
    (sum, record) => sum + (record.overallStats?.totalTests || 0),
    0,
  );
  const averageAccuracy =
    studentSnapshots.length > 0
      ? studentSnapshots.reduce((sum, student) => sum + student.accuracy, 0) /
        studentSnapshots.length
      : 0;
  const averageDifficulty =
    performanceRecords.length > 0
      ? performanceRecords.reduce(
          (sum, record) => sum + (record.overallStats?.averageDifficulty || 0),
          0,
        ) / performanceRecords.length
      : 0;
  const averageConfidence =
    confidenceValues.length > 0
      ? confidenceValues.reduce((sum, value) => sum + value, 0) /
        confidenceValues.length
      : 0;
  const averageStudyEfficiency =
    studyEfficiencyValues.length > 0
      ? studyEfficiencyValues.reduce((sum, value) => sum + value, 0) /
        studyEfficiencyValues.length
      : 0;
  const averageFatigue =
    fatigueValues.length > 0
      ? fatigueValues.reduce((sum, value) => sum + value, 0) /
        fatigueValues.length
      : 0;

  const confidenceByDifficulty = Object.fromEntries(
    Object.entries(confidenceBuckets).map(([difficulty, values]) => [
      difficulty,
      values.length > 0
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : 0,
    ]),
  );

  return {
    summary: {
      studentsWithData: studentSnapshots.length,
      averageAccuracy,
      totalQuestions,
      totalCorrect,
      totalTimeSpent,
      totalTests,
      averageDifficulty,
      averageConfidence,
      averageStudyEfficiency,
      averageFatigue,
      activeStudents: studentSnapshots.filter((student) => {
        const lastActive = student.lastActive
          ? new Date(student.lastActive)
          : null;
        if (!lastActive || Number.isNaN(lastActive.getTime())) return false;
        const daysDiff = Math.floor(
          (Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24),
        );
        return daysDiff <= 30;
      }).length,
    },
    accuracyTrend,
    monthlyTrend,
    topStudents,
    weakStudents,
    topTopics: topicRows.slice(0, 10),
    weakTopics: [...topicRows]
      .sort((left, right) => left.averageAccuracy - right.averageAccuracy)
      .slice(0, 10),
    subjectPerformance: subjectRows,
    conceptMastery,
    retentionHighlights,
    errorPatterns,
    confidenceCalibration: {
      overall: averageConfidence,
      byDifficulty: confidenceByDifficulty,
    },
    fatigueIndex: {
      current: averageFatigue,
      trend:
        averageFatigue > 0.7
          ? "high"
          : averageFatigue > 0.4
            ? "moderate"
            : "stable",
      bySession: fatigueValues,
    },
    studyEfficiency: {
      score: averageStudyEfficiency,
      improvementPerHour: averageStudyEfficiency,
      trend:
        averageStudyEfficiency > 0.7
          ? "improving"
          : averageStudyEfficiency > 0.4
            ? "stable"
            : "declining",
    },
    behaviorClusters,
    recommendations: [
      ...topicRows
        .sort((left, right) => left.averageAccuracy - right.averageAccuracy)
        .slice(0, 3)
        .map((topic) => ({
          type: "weak_topic",
          topic: topic.topic,
          score: topic.averageAccuracy,
          reason: "Prioritize this concept in the next revision cycle.",
        })),
      ...weakStudents.slice(0, 3).map((student) => ({
        type: "student_support",
        topic: student.name,
        score: student.accuracy,
        reason: "Student needs immediate academic support.",
      })),
    ],
  };
};

/**
 * Get all students in teacher's courses
 * GET /api/teachers/my-students
 */
exports.getStudentsInMyCourses = asyncHandler(async (req, res, next) => {
  // Get all courses taught by this teacher
  const courses = await Course.find({ instructor: req.user.id })
    .select("students title")
    .lean();

  if (!courses || courses.length === 0) {
    return res.status(200).json({
      success: true,
      message: "No courses found",
      data: [],
    });
  }

  const hydratedStudents = await hydrateCourseStudents(courses);
  const students = buildTeacherStudentResponse(courses, hydratedStudents);

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
    .lean();

  if (!course) {
    return next(new ErrorResponse("Course not found", 404));
  }

  // Verify teacher is instructor of this course
  if (course.instructor.toString() !== req.user.id) {
    return next(
      new ErrorResponse("Not authorized to view students in this course", 403),
    );
  }

  const hydratedStudents = await hydrateCourseStudents([course]);
  const students = buildTeacherStudentResponse([course], hydratedStudents);

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
  const hydratedStudents = await hydrateCourseStudents(courses);
  const analytics = await buildTeacherDashboardAnalytics(
    courses,
    hydratedStudents,
  );

  // Calculate statistics
  const totalCourses = courses.length;
  const publishedCourses = courses.filter(
    (c) => c.status === "published",
  ).length;
  const totalStudents = hydratedStudents.size;

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
      analytics,
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
    .lean();

  if (!courses || courses.length === 0) {
    return res.status(200).json({
      success: true,
      data: [],
    });
  }

  const hydratedStudents = await hydrateCourseStudents(courses);
  const students = buildTeacherStudentResponse(courses, hydratedStudents);

  res.status(200).json({
    success: true,
    count: students.length,
    data: students,
  });
});

/**
 * ========================================
 * ADVANCED ANALYTICS ROUTES (15 routes)
 * ========================================
 */

/**
 * 1. Student Performance Analytics - Detailed performance with trends
 * GET /api/teachers/analytics/student-performance/:studentId
 */
exports.getStudentPerformanceAnalytics = asyncHandler(
  async (req, res, next) => {
    const { studentId } = req.params;
    const StudentPerformance = require("../models/studentPerformance");
    const studentUserId = await resolveStudentPerformanceUserId(studentId);

    if (!studentUserId) {
      return next(new ErrorResponse("Student not found", 404));
    }

    // Verify teacher has access to this student
    const course = await Course.findOne({
      instructor: req.user.id,
      students: studentUserId,
    });

    if (!course) {
      return next(
        new ErrorResponse("Not authorized to view this student's data", 403),
      );
    }

    const perfData = await StudentPerformance.findOne({
      userId: studentUserId,
    });

    if (!perfData) {
      return res.status(200).json({
        success: true,
        message: "No performance data available",
        data: null,
      });
    }

    const response = {
      studentId,
      overallAccuracy: perfData.overallStats?.accuracy || 0,
      totalQuestionsAttempted: perfData.overallStats?.totalQuestions || 0,
      correctAnswers: perfData.overallStats?.correctAnswers || 0,
      averageTimePerQuestion:
        perfData.overallStats?.averageTimePerQuestion || 0,
      masteryLevelDistribution: {
        beginner:
          perfData.topicPerformance?.filter(
            (t) => t.masteryLevel === "beginner",
          ).length || 0,
        intermediate:
          perfData.topicPerformance?.filter(
            (t) => t.masteryLevel === "intermediate",
          ).length || 0,
        advanced:
          perfData.topicPerformance?.filter(
            (t) => t.masteryLevel === "advanced",
          ).length || 0,
        expert:
          perfData.topicPerformance?.filter((t) => t.masteryLevel === "expert")
            .length || 0,
      },
      performanceTrends: perfData.performanceTrends || [],
      topicPerformance:
        perfData.topicPerformance?.map((t) => ({
          topic: t.topic,
          subject: t.subject,
          accuracy: t.accuracy,
          questionsAttempted: t.questionsAttempted,
          masteryLevel: t.masteryLevel,
          stabilityIndex: t.stabilityIndex,
          retentionScore: t.retentionScore,
          averageDifficulty: t.averageDifficulty,
          timeSpent: t.timeSpent,
          lastPracticed: t.lastPracticed,
        })) || [],
      graphData: {
        accuracyTrend:
          perfData.performanceTrends?.map((t) => ({
            date: t.date,
            accuracy: t.accuracy,
          })) || [],
        difficultyProgression:
          perfData.performanceTrends?.map((t) => ({
            date: t.date,
            difficulty: t.difficulty,
          })) || [],
        timeSpentPerDay:
          perfData.performanceTrends?.map((t) => ({
            date: t.date,
            timeSpent: t.timeSpent,
          })) || [],
      },
    };

    res.status(200).json({
      success: true,
      data: response,
    });
  },
);

/**
 * 2. Learning Velocity Analysis - Progress tracking over time
 * GET /api/teachers/analytics/learning-velocity/:studentId
 */
exports.getLearningVelocityAnalytics = asyncHandler(async (req, res, next) => {
  const { studentId } = req.params;
  const StudentPerformance = require("../models/studentPerformance");
  const studentUserId = await resolveStudentPerformanceUserId(studentId);

  if (!studentUserId) {
    return next(new ErrorResponse("Student not found", 404));
  }

  const course = await Course.findOne({
    instructor: req.user.id,
    students: studentUserId,
  });

  if (!course) {
    return next(new ErrorResponse("Not authorized to view this data", 403));
  }

  const perfData = await StudentPerformance.findOne({ userId: studentUserId });

  if (
    !perfData ||
    !perfData.performanceTrends ||
    perfData.performanceTrends.length === 0
  ) {
    return res.status(200).json({
      success: true,
      message: "Insufficient data for velocity analysis",
      data: null,
    });
  }

  const trends = perfData.performanceTrends.sort(
    (a, b) => new Date(a.date) - new Date(b.date),
  );

  // Calculate weekly averages
  const weeklyData = {};
  trends.forEach((trend) => {
    const date = new Date(trend.date);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split("T")[0];

    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = {
        accuracies: [],
        difficulties: [],
        timeSpent: [],
        questionsAttempted: [],
      };
    }
    weeklyData[weekKey].accuracies.push(trend.accuracy);
    weeklyData[weekKey].difficulties.push(trend.difficulty);
    weeklyData[weekKey].timeSpent.push(trend.timeSpentMinutes || 0);
    weeklyData[weekKey].questionsAttempted.push(trend.questionsAttempted);
  });

  const weeklyChart = Object.entries(weeklyData).map(([week, data]) => ({
    week,
    avgAccuracy:
      data.accuracies.reduce((a, b) => a + b, 0) / data.accuracies.length,
    avgDifficulty:
      data.difficulties.reduce((a, b) => a + b, 0) / data.difficulties.length,
    totalTimeSpent: data.timeSpent.reduce((a, b) => a + b, 0),
    totalQuestions: data.questionsAttempted.reduce((a, b) => a + b, 0),
  }));

  // Calculate velocity (improvement rate)
  const firstWeek = weeklyChart[0];
  const lastWeek = weeklyChart[weeklyChart.length - 1];
  const velocityChange = {
    accuracyImprovement: (lastWeek.avgAccuracy - firstWeek.avgAccuracy).toFixed(
      2,
    ),
    difficultyProgression: (
      lastWeek.avgDifficulty - firstWeek.avgDifficulty
    ).toFixed(2),
    engagementTrend:
      lastWeek.totalQuestions > firstWeek.totalQuestions
        ? "increasing"
        : "decreasing",
  };

  res.status(200).json({
    success: true,
    data: {
      weeklyChart,
      velocityChange,
      totalWeeksActive: weeklyChart.length,
      latestMetrics: {
        currentAccuracy: lastWeek.avgAccuracy.toFixed(2),
        currentDifficulty: lastWeek.avgDifficulty.toFixed(2),
        weeklyEngagement: lastWeek.totalQuestions,
      },
    },
  });
});

/**
 * 3. Retention Analytics - Retention scores and forgetting patterns
 * GET /api/teachers/analytics/retention/:studentId
 */
exports.getRetentionAnalytics = asyncHandler(async (req, res, next) => {
  const { studentId } = req.params;
  const RetentionMetrics = require("../models/retentionMetrics");
  const studentUserId = await resolveStudentPerformanceUserId(studentId);

  if (!studentUserId) {
    return next(new ErrorResponse("Student not found", 404));
  }

  const course = await Course.findOne({
    instructor: req.user.id,
    students: studentUserId,
  });

  if (!course) {
    return next(new ErrorResponse("Not authorized to view this data", 403));
  }

  const retentionData = await RetentionMetrics.findOne({
    studentId: studentUserId,
  });

  if (!retentionData) {
    return res.status(200).json({
      success: true,
      message: "No retention data available",
      data: null,
    });
  }

  // Analyze topic retention
  const topicRetention = (retentionData.topicMetrics || []).map((topic) => ({
    topic: topic.topicId,
    subject: topic.subject,
    retentionScore: (topic.retentionScore * 100).toFixed(2),
    forgettingRate: (topic.forgettingRate * 100).toFixed(2),
    masteryLevel: topic.masteryLevel,
    stabilityIndex: topic.stabilityIndex?.toFixed(2) || 0,
    nextReviewDate: topic.nextReview,
    reviewInterval: topic.reviewInterval,
    lastPracticed: topic.lastPracticed,
  }));

  // Calculate average retention
  const avgRetention =
    topicRetention.length > 0
      ? (
          topicRetention.reduce(
            (sum, t) => sum + parseFloat(t.retentionScore),
            0,
          ) / topicRetention.length
        ).toFixed(2)
      : 0;

  // Get daily metrics
  const dailyMetrics = (retentionData.dailyMetrics || [])
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-30);

  res.status(200).json({
    success: true,
    data: {
      overallRetentionScore: avgRetention,
      totalTopicsTracked: topicRetention.length,
      topicsNeedingReview: topicRetention.filter(
        (t) => parseFloat(t.retentionScore) < 60,
      ).length,
      topicRetention,
      dailyMetricsChart: dailyMetrics.map((d) => ({
        date: d.date,
        accuracy: d.accuracy,
        focusLevel: d.averageFocus,
        stressLevel: d.averageStress,
        fatigueLevel: d.averageFatigue,
      })),
      retentionTrend: {
        improving: avgRetention > 70 ? "yes" : "no",
        riskAreas: topicRetention
          .filter((t) => parseFloat(t.retentionScore) < 50)
          .map((t) => t.topic),
      },
    },
  });
});

/**
 * 4. Burnout Risk Assessment - Identify at-risk students
 * GET /api/teachers/analytics/burnout-risk/:studentId
 */
exports.getBurnoutRiskAnalytics = asyncHandler(async (req, res, next) => {
  const { studentId } = req.params;
  const StudentPerformance = require("../models/studentPerformance");
  const studentUserId = await resolveStudentPerformanceUserId(studentId);

  if (!studentUserId) {
    return next(new ErrorResponse("Student not found", 404));
  }

  const course = await Course.findOne({
    instructor: req.user.id,
    students: studentUserId,
  });

  if (!course) {
    return next(new ErrorResponse("Not authorized to view this data", 403));
  }

  const perfData = await StudentPerformance.findOne({ userId: studentUserId });

  if (!perfData) {
    return res.status(200).json({ success: true, data: null });
  }

  const trends = perfData.performanceTrends || [];
  const recentTrends = trends.slice(-14);

  let burnoutScore = 0;
  const riskFactors = [];

  // Check for declining accuracy
  if (recentTrends.length > 7) {
    const firstHalf =
      recentTrends.slice(0, 7).reduce((sum, t) => sum + t.accuracy, 0) / 7;
    const secondHalf =
      recentTrends.slice(7).reduce((sum, t) => sum + t.accuracy, 0) / 7;

    if (secondHalf < firstHalf - 5) {
      burnoutScore += 30;
      riskFactors.push("Declining accuracy trend");
    }
  }

  // Check for excessive study hours followed by drop
  const avgTimeSpent =
    recentTrends.reduce((sum, t) => sum + (t.timeSpentMinutes || 0), 0) /
    recentTrends.length;
  const overworkedDays = recentTrends.filter(
    (t) => (t.timeSpentMinutes || 0) > avgTimeSpent * 1.5,
  ).length;

  if (overworkedDays > 5) {
    burnoutScore += 25;
    riskFactors.push("High study hours exceeding healthy average");
  }

  // Check for consistency (high variance = potential burnout)
  const accuracyVariance =
    recentTrends.length > 0
      ? Math.sqrt(
          recentTrends.reduce(
            (sum, t) =>
              sum +
              Math.pow(
                t.accuracy -
                  recentTrends.reduce((s, x) => s + x.accuracy, 0) /
                    recentTrends.length,
                2,
              ),
            0,
          ) / recentTrends.length,
        )
      : 0;

  if (accuracyVariance > 15) {
    burnoutScore += 20;
    riskFactors.push("Inconsistent performance patterns");
  }

  // Check difficulty progression (jumping too fast)
  const avgDifficulty =
    recentTrends.reduce((sum, t) => sum + t.difficulty, 0) /
    recentTrends.length;
  const maxDifficulty = Math.max(...recentTrends.map((t) => t.difficulty));

  if (maxDifficulty - avgDifficulty > 0.5) {
    burnoutScore += 15;
    riskFactors.push("Rapid difficulty increase");
  }

  // Check low engagement recently
  const recentEngagement =
    recentTrends.slice(-3).reduce((sum, t) => sum + t.questionsAttempted, 0) /
    3;
  if (recentEngagement < 5) {
    burnoutScore += 10;
    riskFactors.push("Recent low engagement");
  }

  const riskLevel =
    burnoutScore >= 70 ? "High" : burnoutScore >= 40 ? "Medium" : "Low";

  res.status(200).json({
    success: true,
    data: {
      burnoutRiskScore: burnoutScore,
      riskLevel,
      riskFactors,
      recommendations: {
        High: [
          "Reduce learning load temporarily",
          "Encourage breaks between study sessions",
          "Consider adjusting course difficulty",
          "Schedule one-on-one check-in with student",
        ],
        Medium: [
          "Monitor progress closely",
          "Encourage balanced study schedule",
          "Provide additional support if needed",
        ],
        Low: [
          "Student is maintaining healthy pace",
          "Continue current support level",
        ],
      }[riskLevel],
      metrics: {
        averageTimePerDay: (avgTimeSpent / 60).toFixed(2),
        accuracyVariance: accuracyVariance.toFixed(2),
        overworkedDaysCount: overworkedDays,
        recentDaysTracked: recentTrends.length,
      },
    },
  });
});

/**
 * 5. Topic Mastery Breakdown - Detailed topic-wise analysis
 * GET /api/teachers/analytics/topic-mastery/:studentId
 */
exports.getTopicMasteryAnalytics = asyncHandler(async (req, res, next) => {
  const { studentId } = req.params;
  const StudentPerformance = require("../models/studentPerformance");
  const studentUserId = await resolveStudentPerformanceUserId(studentId);

  if (!studentUserId) {
    return next(new ErrorResponse("Student not found", 404));
  }

  const course = await Course.findOne({
    instructor: req.user.id,
    students: studentUserId,
  });

  if (!course) {
    return next(new ErrorResponse("Not authorized to view this data", 403));
  }

  const perfData = await StudentPerformance.findOne({ userId: studentUserId });

  if (!perfData || !perfData.topicPerformance) {
    return res.status(200).json({ success: true, data: null });
  }

  // Group by subject and mastery level
  const bySubject = {};
  const masteryBreakdown = {
    beginner: [],
    intermediate: [],
    advanced: [],
    expert: [],
  };

  perfData.topicPerformance.forEach((topic) => {
    // Group by subject
    if (!bySubject[topic.subject]) {
      bySubject[topic.subject] = [];
    }
    bySubject[topic.subject].push(topic);

    // Group by mastery
    if (masteryBreakdown[topic.masteryLevel]) {
      masteryBreakdown[topic.masteryLevel].push(topic.topic);
    }
  });

  // Calculate subject-wise statistics
  const subjectStats = Object.entries(bySubject).map(([subject, topics]) => {
    const avgAccuracy =
      topics.reduce((sum, t) => sum + t.accuracy, 0) / topics.length;
    const avgRetention =
      topics.reduce((sum, t) => sum + (t.retentionScore || 0), 0) /
      topics.length;

    return {
      subject,
      topicCount: topics.length,
      averageAccuracy: avgAccuracy.toFixed(2),
      averageRetention: (avgRetention * 100).toFixed(2),
      masteryDistribution: {
        beginner: topics.filter((t) => t.masteryLevel === "beginner").length,
        intermediate: topics.filter((t) => t.masteryLevel === "intermediate")
          .length,
        advanced: topics.filter((t) => t.masteryLevel === "advanced").length,
        expert: topics.filter((t) => t.masteryLevel === "expert").length,
      },
      weakTopics: topics
        .filter((t) => t.accuracy < 60)
        .sort((a, b) => a.accuracy - b.accuracy)
        .slice(0, 3)
        .map((t) => ({ topic: t.topic, accuracy: t.accuracy })),
      strongTopics: topics
        .filter((t) => t.accuracy >= 85)
        .map((t) => ({ topic: t.topic, accuracy: t.accuracy }))
        .slice(0, 3),
    };
  });

  res.status(200).json({
    success: true,
    data: {
      totalTopicsLearned: perfData.topicPerformance.length,
      masteryDistribution: {
        beginner: masteryBreakdown.beginner.length,
        intermediate: masteryBreakdown.intermediate.length,
        advanced: masteryBreakdown.advanced.length,
        expert: masteryBreakdown.expert.length,
      },
      subjectWiseAnalysis: subjectStats,
      overallMasteryChart: perfData.topicPerformance.slice(0, 20).map((t) => ({
        topic: t.topic,
        accuracy: t.accuracy,
        mastery: t.masteryLevel,
        retention: (t.retentionScore * 100).toFixed(0),
      })),
    },
  });
});

/**
 * 6. Class-wide Comparative Analysis - Compare all students
 * GET /api/teachers/analytics/class-comparative/:courseId
 */
exports.getClassComparativeAnalytics = asyncHandler(async (req, res, next) => {
  const { courseId } = req.params;
  const StudentPerformance = require("../models/studentPerformance");

  const course = await Course.findById(courseId).populate(
    "students",
    "name email",
  );

  if (!course) {
    return next(new ErrorResponse("Course not found", 404));
  }

  if (course.instructor.toString() !== req.user.id) {
    return next(new ErrorResponse("Not authorized", 403));
  }

  const studentIds = course.students.map((s) => s._id.toString());
  const performanceDataList = await StudentPerformance.find({
    userId: { $in: studentIds },
  });

  // Calculate class statistics
  const classStats = performanceDataList.map((perfData) => {
    const student = course.students.find(
      (s) => s._id.toString() === perfData.userId?.toString?.(),
    );
    const accuracy = perfData.overallStats?.accuracy || 0;
    const avgTime = perfData.overallStats?.averageTimePerQuestion || 0;

    return {
      studentId: perfData.studentId,
      studentName: student?.name || "Unknown",
      accuracy,
      totalQuestions: perfData.overallStats?.totalQuestions || 0,
      correctAnswers: perfData.overallStats?.correctAnswers || 0,
      averageTimePerQuestion: avgTime,
      topicsLearned: perfData.topicPerformance?.length || 0,
      masteriesAchieved: {
        beginner:
          perfData.topicPerformance?.filter(
            (t) => t.masteryLevel === "beginner",
          ).length || 0,
        intermediate:
          perfData.topicPerformance?.filter(
            (t) => t.masteryLevel === "intermediate",
          ).length || 0,
        advanced:
          perfData.topicPerformance?.filter(
            (t) => t.masteryLevel === "advanced",
          ).length || 0,
        expert:
          perfData.topicPerformance?.filter((t) => t.masteryLevel === "expert")
            .length || 0,
      },
    };
  });

  // Calculate averages and rankings
  const avgAccuracy =
    classStats.length > 0
      ? classStats.reduce((sum, s) => sum + s.accuracy, 0) / classStats.length
      : 0;
  const avgTime =
    classStats.length > 0
      ? classStats.reduce((sum, s) => sum + s.averageTimePerQuestion, 0) /
        classStats.length
      : 0;

  const rankedByAccuracy = [...classStats]
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 5);
  const rankedByEfficiency = [...classStats]
    .sort((a, b) => a.averageTimePerQuestion - b.averageTimePerQuestion)
    .slice(0, 5);

  res.status(200).json({
    success: true,
    data: {
      courseTitle: course.title,
      totalStudents: classStats.length,
      classAverages: {
        accuracy: avgAccuracy.toFixed(2),
        timePerQuestion: avgTime.toFixed(2),
      },
      allStudentStats: classStats,
      topPerformers: rankedByAccuracy,
      mostEfficientLearners: rankedByEfficiency,
      performanceDistribution: {
        excellent: classStats.filter((s) => s.accuracy >= 85).length,
        good: classStats.filter((s) => s.accuracy >= 70 && s.accuracy < 85)
          .length,
        average: classStats.filter((s) => s.accuracy >= 50 && s.accuracy < 70)
          .length,
        needsSupport: classStats.filter((s) => s.accuracy < 50).length,
      },
    },
  });
});

/**
 * 7. Weekly/Monthly Performance Trends
 * GET /api/teachers/analytics/performance-trends/:studentId
 */
exports.getPerformanceTrendsAnalytics = asyncHandler(async (req, res, next) => {
  const { studentId } = req.params;
  const { timeframe = "monthly" } = req.query; // monthly or weekly
  const StudentPerformance = require("../models/studentPerformance");
  const studentUserId = await resolveStudentPerformanceUserId(studentId);

  if (!studentUserId) {
    return next(new ErrorResponse("Student not found", 404));
  }

  const course = await Course.findOne({
    instructor: req.user.id,
    students: studentUserId,
  });

  if (!course) {
    return next(new ErrorResponse("Not authorized", 403));
  }

  const perfData = await StudentPerformance.findOne({ userId: studentUserId });

  if (!perfData || !perfData.performanceTrends) {
    return res.status(200).json({ success: true, data: null });
  }

  const trends = perfData.performanceTrends.sort(
    (a, b) => new Date(a.date) - new Date(b.date),
  );

  let groupedData = {};
  const dateFormatter =
    timeframe === "weekly"
      ? (date) => {
          const d = new Date(date);
          d.setDate(d.getDate() - d.getDay());
          return d.toISOString().split("T")[0];
        }
      : (date) => new Date(date).toISOString().slice(0, 7);

  trends.forEach((trend) => {
    const key = dateFormatter(trend.date);
    if (!groupedData[key]) {
      groupedData[key] = {
        accuracies: [],
        difficulties: [],
        timesSpent: [],
        questionsAttempted: [],
        dates: [],
      };
    }
    groupedData[key].accuracies.push(trend.accuracy);
    groupedData[key].difficulties.push(trend.difficulty);
    groupedData[key].timesSpent.push(trend.timeSpentMinutes || 0);
    groupedData[key].questionsAttempted.push(trend.questionsAttempted);
    groupedData[key].dates.push(trend.date);
  });

  const chartData = Object.entries(groupedData).map(([period, data]) => ({
    period,
    avgAccuracy: (
      data.accuracies.reduce((a, b) => a + b, 0) / data.accuracies.length
    ).toFixed(2),
    avgDifficulty: (
      data.difficulties.reduce((a, b) => a + b, 0) / data.difficulties.length
    ).toFixed(2),
    totalTimeSpent: data.timesSpent.reduce((a, b) => a + b, 0),
    totalQuestions: data.questionsAttempted.reduce((a, b) => a + b, 0),
    sessionCount: data.accuracies.length,
  }));

  res.status(200).json({
    success: true,
    data: {
      timeframe,
      totalPeriods: chartData.length,
      chartData,
      summary: {
        averageAccuracyAllTime: (
          trends.reduce((sum, t) => sum + t.accuracy, 0) / trends.length
        ).toFixed(2),
        bestPeriod: chartData.sort((a, b) => b.avgAccuracy - a.avgAccuracy)[0],
        worstPeriod: chartData.sort((a, b) => a.avgAccuracy - b.avgAccuracy)[0],
        totalTimeSpentAllTime: trends.reduce(
          (sum, t) => sum + (t.timeSpentMinutes || 0),
          0,
        ),
        totalQuestionsAnswered: trends.reduce(
          (sum, t) => sum + t.questionsAttempted,
          0,
        ),
      },
    },
  });
});

/**
 * 8. Error Pattern Analysis - Conceptual vs careless mistakes
 * GET /api/teachers/analytics/error-patterns/:studentId
 */
exports.getErrorPatternAnalytics = asyncHandler(async (req, res, next) => {
  const { studentId } = req.params;
  const StudentPerformance = require("../models/studentPerformance");
  const studentUserId = await resolveStudentPerformanceUserId(studentId);

  if (!studentUserId) {
    return next(new ErrorResponse("Student not found", 404));
  }

  const course = await Course.findOne({
    instructor: req.user.id,
    students: studentUserId,
  });

  if (!course) {
    return next(new ErrorResponse("Not authorized", 403));
  }

  const perfData = await StudentPerformance.findOne({ userId: studentUserId });

  if (!perfData || !perfData.topicPerformance) {
    return res.status(200).json({ success: true, data: null });
  }

  // Analyze error patterns
  let totalConceptual = 0,
    totalCareless = 0,
    totalGuess = 0,
    totalOverconfidence = 0;

  const errorsByTopic = perfData.topicPerformance
    .filter((t) => t.errorPatterns)
    .map((topic) => {
      const errors = topic.errorPatterns;
      totalConceptual += errors.conceptual || 0;
      totalCareless += errors.careless || 0;
      totalGuess += errors.guess || 0;
      totalOverconfidence += errors.overconfidence || 0;

      return {
        topic: topic.topic,
        conceptualErrors: errors.conceptual || 0,
        carelessErrors: errors.careless || 0,
        guessErrors: errors.guess || 0,
        overconfidenceErrors: errors.overconfidence || 0,
        totalErrors:
          (errors.conceptual || 0) +
          (errors.careless || 0) +
          (errors.guess || 0) +
          (errors.overconfidence || 0),
      };
    });

  const totalErrors =
    totalConceptual + totalCareless + totalGuess + totalOverconfidence;

  res.status(200).json({
    success: true,
    data: {
      errorDistribution: {
        conceptual: totalConceptual,
        careless: totalCareless,
        guess: totalGuess,
        overconfidence: totalOverconfidence,
        total: totalErrors,
      },
      errorPercentages: {
        conceptual:
          totalErrors > 0
            ? ((totalConceptual / totalErrors) * 100).toFixed(2)
            : 0,
        careless:
          totalErrors > 0
            ? ((totalCareless / totalErrors) * 100).toFixed(2)
            : 0,
        guess:
          totalErrors > 0 ? ((totalGuess / totalErrors) * 100).toFixed(2) : 0,
        overconfidence:
          totalErrors > 0
            ? ((totalOverconfidence / totalErrors) * 100).toFixed(2)
            : 0,
      },
      errorsByTopic: errorsByTopic.sort(
        (a, b) => b.totalErrors - a.totalErrors,
      ),
      recommendations: {
        high_conceptual: [
          "Focus on core concept mastery",
          "Use guided practice with explanations",
          "Increase time on foundational topics",
        ],
        high_careless: [
          "Encourage slower, careful reading",
          "Practice with time pressure removed",
          "Review answer checking techniques",
        ],
        high_guess: [
          "Reduce difficulty level temporarily",
          "Increase confidence through practice",
          "Focus on eliminating distractor options",
        ],
        high_overconfidence: [
          "Provide challenging questions to calibrate",
          "Use detailed feedback mechanisms",
          "Encourage self-assessment practices",
        ],
      },
      primaryErrorType:
        [
          { type: "conceptual", count: totalConceptual },
          { type: "careless", count: totalCareless },
          { type: "guess", count: totalGuess },
          { type: "overconfidence", count: totalOverconfidence },
        ].sort((a, b) => b.count - a.count)[0]?.type || "unknown",
    },
  });
});

/**
 * 9. Time Spent Analysis - Engagement and study patterns
 * GET /api/teachers/analytics/time-spent/:studentId
 */
exports.getTimeSpentAnalytics = asyncHandler(async (req, res, next) => {
  const { studentId } = req.params;
  const StudentPerformance = require("../models/studentPerformance");
  const studentUserId = await resolveStudentPerformanceUserId(studentId);

  if (!studentUserId) {
    return next(new ErrorResponse("Student not found", 404));
  }

  const course = await Course.findOne({
    instructor: req.user.id,
    students: studentUserId,
  });

  if (!course) {
    return next(new ErrorResponse("Not authorized", 403));
  }

  const perfData = await StudentPerformance.findOne({ userId: studentUserId });

  if (!perfData) {
    return res.status(200).json({ success: true, data: null });
  }

  const trends = perfData.performanceTrends || [];
  const topicTimes = perfData.topicPerformance || [];

  // Calculate time statistics
  const totalTime = trends.reduce(
    (sum, t) => sum + (t.timeSpentMinutes || 0),
    0,
  );
  const avgTimePerSession =
    trends.length > 0 ? (totalTime / trends.length).toFixed(2) : 0;
  const maxTime = Math.max(...trends.map((t) => t.timeSpentMinutes || 0), 0);
  const minTime = Math.min(
    ...trends
      .filter((t) => (t.timeSpentMinutes || 0) > 0)
      .map((t) => t.timeSpentMinutes || 0),
    Infinity,
  );

  // Daily study pattern
  const dayPatterns = {};
  trends.forEach((trend) => {
    const dayOfWeek = new Date(trend.date).toLocaleString("en-US", {
      weekday: "short",
    });
    if (!dayPatterns[dayOfWeek]) {
      dayPatterns[dayOfWeek] = [];
    }
    dayPatterns[dayOfWeek].push(trend.timeSpentMinutes || 0);
  });

  const studyDayDistribution = Object.entries(dayPatterns).map(
    ([day, times]) => ({
      day,
      averageTimeMinutes: (
        times.reduce((a, b) => a + b, 0) / times.length
      ).toFixed(2),
      sessionsCount: times.length,
    }),
  );

  // Time per topic
  const topicTimeAnalysis = topicTimes
    .sort((a, b) => (b.timeSpent || 0) - (a.timeSpent || 0))
    .slice(0, 15)
    .map((t) => ({
      topic: t.topic,
      timeSpent: t.timeSpent,
      accuracy: t.accuracy,
      efficiency: ((t.accuracy || 0) / (t.timeSpent || 1)).toFixed(4),
    }));

  res.status(200).json({
    success: true,
    data: {
      totalTimeSpent: totalTime,
      totalTimeSpentHours: (totalTime / 60).toFixed(2),
      averageSessionDuration: avgTimePerSession,
      maxSessionTime: maxTime,
      minSessionTime: minTime === Infinity ? 0 : minTime,
      totalSessions: trends.length,
      studyDayDistribution,
      topicTimeAnalysis,
      engagementSummary: {
        category:
          totalTime > 1800
            ? "High Engagement"
            : totalTime > 900
              ? "Medium Engagement"
              : "Low Engagement",
        suggestion:
          totalTime < 300 ? "Encourage more practice" : "Maintain current pace",
      },
    },
  });
});

/**
 * 10. Weak Students Identification - Needs intervention
 * GET /api/teachers/analytics/weak-students/:courseId
 */
exports.getWeakStudentsAnalytics = asyncHandler(async (req, res, next) => {
  const { courseId } = req.params;
  const { threshold = 60 } = req.query; // Performance threshold
  const StudentPerformance = require("../models/studentPerformance");

  const course = await Course.findById(courseId).populate(
    "students",
    "name email studentId",
  );

  if (!course) {
    return next(new ErrorResponse("Course not found", 404));
  }

  if (course.instructor.toString() !== req.user.id) {
    return next(new ErrorResponse("Not authorized", 403));
  }

  const studentIds = course.students.map((s) => s._id.toString());
  const performanceDataList = await StudentPerformance.find({
    userId: { $in: studentIds },
  });

  const weakStudents = performanceDataList
    .filter((p) => (p.overallStats?.accuracy || 0) < threshold)
    .map((perfData) => {
      const student = course.students.find(
        (s) => s._id.toString() === perfData.userId?.toString?.(),
      );
      const topicPerf = perfData.topicPerformance || [];
      const weakTopics = topicPerf
        .filter((t) => t.accuracy < threshold)
        .sort((a, b) => a.accuracy - b.accuracy)
        .slice(0, 3);

      return {
        studentId: perfData.studentId,
        studentName: student?.name || "Unknown",
        studentEmail: student?.email || "",
        overallAccuracy: (perfData.overallStats?.accuracy || 0).toFixed(2),
        performanceGap: (
          threshold - (perfData.overallStats?.accuracy || 0)
        ).toFixed(2),
        weakTopics: weakTopics.map((t) => ({
          topic: t.topic,
          accuracy: t.accuracy,
          questionsAttempted: t.questionsAttempted,
        })),
        averageTimePerQuestion:
          perfData.overallStats?.averageTimePerQuestion || 0,
        totalQuestionsAttempted: perfData.overallStats?.totalQuestions || 0,
      };
    })
    .sort(
      (a, b) => parseFloat(a.overallAccuracy) - parseFloat(b.overallAccuracy),
    );

  const interventionStrategies = {
    severe: [
      "One-on-one tutoring sessions",
      "Assign foundational learning materials",
      "Reduce learning load",
      "Frequent check-ins with progress tracking",
    ],
    moderate: [
      "Small group study sessions",
      "Additional practice problems",
      "Peer tutoring assistance",
      "Regular feedback and guidance",
    ],
  };

  res.status(200).json({
    success: true,
    data: {
      courseTitle: course.title,
      performanceThreshold: threshold,
      totalWeakStudents: weakStudents.length,
      totalStudents: studentIds.length,
      percentageNeedingSupport: (
        (weakStudents.length / studentIds.length) *
        100
      ).toFixed(2),
      weakStudents,
      interventionStrategies,
      priorityList: weakStudents
        .map((s) => ({
          ...s,
          priority: parseFloat(s.overallAccuracy) < 40 ? "High" : "Medium",
        }))
        .sort((a, b) => {
          if (a.priority !== b.priority) return a.priority === "High" ? -1 : 1;
          return parseFloat(a.overallAccuracy) - parseFloat(b.overallAccuracy);
        }),
    },
  });
});

/**
 * 11. Advanced Students Identification - High performers
 * GET /api/teachers/analytics/advanced-students/:courseId
 */
exports.getAdvancedStudentsAnalytics = asyncHandler(async (req, res, next) => {
  const { courseId } = req.params;
  const { threshold = 85 } = req.query;
  const StudentPerformance = require("../models/studentPerformance");

  const course = await Course.findById(courseId).populate(
    "students",
    "name email studentId",
  );

  if (!course) {
    return next(new ErrorResponse("Course not found", 404));
  }

  if (course.instructor.toString() !== req.user.id) {
    return next(new ErrorResponse("Not authorized", 403));
  }

  const studentIds = course.students.map((s) => s._id.toString());
  const performanceDataList = await StudentPerformance.find({
    userId: { $in: studentIds },
  });

  const advancedStudents = performanceDataList
    .filter((p) => (p.overallStats?.accuracy || 0) >= threshold)
    .map((perfData) => {
      const student = course.students.find(
        (s) => s._id.toString() === perfData.userId?.toString?.(),
      );
      const topicPerf = perfData.topicPerformance || [];
      const expertTopics = topicPerf
        .filter((t) => t.masteryLevel === "expert")
        .map((t) => t.topic);

      return {
        studentId: perfData.studentId,
        studentName: student?.name || "Unknown",
        studentEmail: student?.email || "",
        overallAccuracy: (perfData.overallStats?.accuracy || 0).toFixed(2),
        expertTopics,
        masteryCount: {
          expert: topicPerf.filter((t) => t.masteryLevel === "expert").length,
          advanced: topicPerf.filter((t) => t.masteryLevel === "advanced")
            .length,
        },
        learningSpeed: perfData.performanceTrends?.length || 0,
      };
    })
    .sort(
      (a, b) => parseFloat(b.overallAccuracy) - parseFloat(a.overallAccuracy),
    );

  const enrichmentOpportunities = [
    "Advanced problem-solving challenges",
    "Peer mentoring roles",
    "Independent research projects",
    "Competition preparation",
    "Content creation tasks",
  ];

  res.status(200).json({
    success: true,
    data: {
      courseTitle: course.title,
      performanceThreshold: threshold,
      totalAdvancedStudents: advancedStudents.length,
      totalStudents: studentIds.length,
      percentageAdvanced: (
        (advancedStudents.length / studentIds.length) *
        100
      ).toFixed(2),
      advancedStudents,
      enrichmentOpportunities,
      topPerformers: advancedStudents.slice(0, 5),
    },
  });
});

/**
 * 12. Intervention Alerts - Real-time alerts for at-risk
 * GET /api/teachers/analytics/intervention-alerts/:courseId
 */
exports.getInterventionAlerts = asyncHandler(async (req, res, next) => {
  const { courseId } = req.params;
  const StudentPerformance = require("../models/studentPerformance");
  const RetentionMetrics = require("../models/retentionMetrics");

  const course = await Course.findById(courseId).populate(
    "students",
    "name email studentId",
  );

  if (!course) {
    return next(new ErrorResponse("Course not found", 404));
  }

  if (course.instructor.toString() !== req.user.id) {
    return next(new ErrorResponse("Not authorized", 403));
  }

  const studentIds = course.students.map((s) => s._id.toString());
  const alerts = [];

  // Check performance data
  const perfDataList = await StudentPerformance.find({
    userId: { $in: studentIds },
  });

  perfDataList.forEach((perfData) => {
    const student = course.students.find(
      (s) => s._id.toString() === perfData.userId?.toString?.(),
    );

    const accuracy = perfData.overallStats?.accuracy || 0;

    // Alert: Declining performance
    if (perfData.performanceTrends && perfData.performanceTrends.length > 7) {
      const recent = perfData.performanceTrends.slice(-7);
      const recentAvg =
        recent.reduce((sum, t) => sum + t.accuracy, 0) / recent.length;
      const overall = perfData.overallStats?.accuracy || 0;

      if (recentAvg < overall - 10) {
        alerts.push({
          type: "declining_performance",
          severity: "high",
          studentId: perfData.studentId,
          studentName: student?.name || "Unknown",
          message: `${student?.name}'s accuracy has declined from ${overall.toFixed(2)}% to ${recentAvg.toFixed(2)}%`,
          actionRequired: "Check in with student about challenges",
        });
      }
    }

    // Alert: Very low accuracy
    if (accuracy < 40) {
      alerts.push({
        type: "very_low_accuracy",
        severity: "critical",
        studentId: perfData.studentId,
        studentName: student?.name || "Unknown",
        message: `${student?.name} has very low accuracy (${accuracy.toFixed(2)}%)`,
        actionRequired: "Recommend tutoring or course review",
      });
    }

    // Alert: Low engagement
    const daysSinceLastActivity = Math.floor(
      (new Date() -
        new Date(
          perfData.performanceTrends?.[perfData.performanceTrends.length - 1]
            ?.date || 0,
        )) /
        (1000 * 60 * 60 * 24),
    );

    if (daysSinceLastActivity > 7) {
      alerts.push({
        type: "low_engagement",
        severity: "medium",
        studentId: perfData.studentId,
        studentName: student?.name || "Unknown",
        message: `${student?.name} has not been active for ${daysSinceLastActivity} days`,
        actionRequired: "Send reminder and offer support",
      });
    }
  });

  // Check retention metrics
  const retentionDataList = await RetentionMetrics.find({
    studentId: { $in: studentIds },
  });

  retentionDataList.forEach((retData) => {
    const student = course.students.find(
      (s) => s._id.toString() === retData.studentId,
    );
    const topicsNeedingReview = (retData.topicMetrics || []).filter(
      (t) => (t.retentionScore || 0) < 0.5,
    );

    if (topicsNeedingReview.length > 3) {
      alerts.push({
        type: "high_forgetting_rate",
        severity: "medium",
        studentId: retData.studentId,
        studentName: student?.name || "Unknown",
        message: `${student?.name} has ${topicsNeedingReview.length} topics with low retention scores`,
        actionRequired: "Recommend spaced repetition practice",
      });
    }
  });

  // Sort alerts by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  res.status(200).json({
    success: true,
    data: {
      courseTitle: course.title,
      totalAlerts: alerts.length,
      alertsBySeverity: {
        critical: alerts.filter((a) => a.severity === "critical").length,
        high: alerts.filter((a) => a.severity === "high").length,
        medium: alerts.filter((a) => a.severity === "medium").length,
        low: alerts.filter((a) => a.severity === "low").length,
      },
      alerts,
      immediateActions: alerts
        .filter((a) => a.severity === "critical" || a.severity === "high")
        .map((a) => a.actionRequired),
    },
  });
});

/**
 * 13. Individual Student Deep Analytics
 * GET /api/teachers/analytics/student-deep-profile/:studentId
 */
exports.getStudentDeepProfileAnalytics = asyncHandler(
  async (req, res, next) => {
    const { studentId } = req.params;
    const StudentPerformance = require("../models/studentPerformance");
    const RetentionMetrics = require("../models/retentionMetrics");
    const studentUserId = await resolveStudentPerformanceUserId(studentId);

    if (!studentUserId) {
      return next(new ErrorResponse("Student not found", 404));
    }

    const course = await Course.findOne({
      instructor: req.user.id,
      students: studentUserId,
    });

    if (!course) {
      return next(new ErrorResponse("Not authorized", 403));
    }

    const student = await User.findById(studentUserId).select(
      "name email studentId",
    );
    const perfData = await StudentPerformance.findOne({
      userId: studentUserId,
    });
    const retentionData = await RetentionMetrics.findOne({
      studentId: studentUserId,
    });

    if (!perfData) {
      return res.status(200).json({ success: true, data: null });
    }

    // Compile comprehensive profile
    const profile = {
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        studentId: student.studentId,
      },
      performanceOverview: {
        overallAccuracy: (perfData.overallStats?.accuracy || 0).toFixed(2),
        totalQuestionsAttempted: perfData.overallStats?.totalQuestions || 0,
        correctAnswers: perfData.overallStats?.correctAnswers || 0,
        accuracy: perfData.overallStats?.accuracy || 0,
        topicsLearned: perfData.topicPerformance?.length || 0,
      },
      learningPattern: {
        totalSessions: perfData.performanceTrends?.length || 0,
        averageSessionDuration: (
          perfData.performanceTrends?.reduce(
            (sum, t) => sum + (t.timeSpentMinutes || 0),
            0,
          ) / (perfData.performanceTrends?.length || 1)
        ).toFixed(2),
        lastActivityDate:
          perfData.performanceTrends?.[perfData.performanceTrends.length - 1]
            ?.date,
      },
      masteryDistribution: {
        beginner:
          perfData.topicPerformance?.filter(
            (t) => t.masteryLevel === "beginner",
          ).length || 0,
        intermediate:
          perfData.topicPerformance?.filter(
            (t) => t.masteryLevel === "intermediate",
          ).length || 0,
        advanced:
          perfData.topicPerformance?.filter(
            (t) => t.masteryLevel === "advanced",
          ).length || 0,
        expert:
          perfData.topicPerformance?.filter((t) => t.masteryLevel === "expert")
            .length || 0,
      },
      retentionProfile: retentionData
        ? {
            averageRetentionScore: retentionData.topicMetrics
              ? (
                  retentionData.topicMetrics.reduce(
                    (sum, t) => sum + (t.retentionScore || 0),
                    0,
                  ) / retentionData.topicMetrics.length
                ).toFixed(2)
              : 0,
            topicsNeedingReview: retentionData.topicMetrics
              ? retentionData.topicMetrics.filter(
                  (t) => (t.retentionScore || 0) < 0.6,
                ).length
              : 0,
          }
        : null,
      strengths: (perfData.topicPerformance || [])
        .filter((t) => t.accuracy >= 85)
        .sort((a, b) => b.accuracy - a.accuracy)
        .slice(0, 5)
        .map((t) => ({ topic: t.topic, accuracy: t.accuracy })),
      areasForImprovement: (perfData.topicPerformance || [])
        .filter((t) => t.accuracy < 70)
        .sort((a, b) => a.accuracy - b.accuracy)
        .slice(0, 5)
        .map((t) => ({ topic: t.topic, accuracy: t.accuracy })),
    };

    res.status(200).json({
      success: true,
      data: profile,
    });
  },
);

/**
 * 14. Class Performance Dashboard Data
 * GET /api/teachers/analytics/class-dashboard/:courseId
 */
exports.getClassDashboardAnalytics = asyncHandler(async (req, res, next) => {
  const { courseId } = req.params;
  const StudentPerformance = require("../models/studentPerformance");

  const course = await Course.findById(courseId).populate(
    "students",
    "name email",
  );

  if (!course) {
    return next(new ErrorResponse("Course not found", 404));
  }

  if (course.instructor.toString() !== req.user.id) {
    return next(new ErrorResponse("Not authorized", 403));
  }

  const studentIds = course.students.map((s) => s._id.toString());
  const perfDataList = await StudentPerformance.find({
    userId: { $in: studentIds },
  });

  // Calculate class-wide metrics
  const accuracies = perfDataList.map((p) => p.overallStats?.accuracy || 0);
  const avgAccuracy =
    accuracies.length > 0
      ? accuracies.reduce((a, b) => a + b) / accuracies.length
      : 0;
  const maxAccuracy = Math.max(...accuracies, 0);
  const minAccuracy =
    Math.min(...accuracies, Infinity) === Infinity
      ? 0
      : Math.min(...accuracies, Infinity);

  const timeSpents = perfDataList.flatMap(
    (p) => p.performanceTrends?.map((t) => t.timeSpentMinutes || 0) || [],
  );
  const avgTimePerSession =
    timeSpents.length > 0
      ? (timeSpents.reduce((a, b) => a + b) / timeSpents.length).toFixed(2)
      : 0;

  const allTopics = perfDataList.flatMap((p) => p.topicPerformance || []);
  const avgTopicsPerStudent = (allTopics.length / perfDataList.length).toFixed(
    2,
  );

  // Performance distribution
  const distribution = {
    excellent: perfDataList.filter((p) => (p.overallStats?.accuracy || 0) >= 85)
      .length,
    good: perfDataList.filter(
      (p) =>
        (p.overallStats?.accuracy || 0) >= 70 &&
        (p.overallStats?.accuracy || 0) < 85,
    ).length,
    average: perfDataList.filter(
      (p) =>
        (p.overallStats?.accuracy || 0) >= 50 &&
        (p.overallStats?.accuracy || 0) < 70,
    ).length,
    needsSupport: perfDataList.filter(
      (p) => (p.overallStats?.accuracy || 0) < 50,
    ).length,
  };

  res.status(200).json({
    success: true,
    data: {
      courseTitle: course.title,
      totalStudents: perfDataList.length,
      classMetrics: {
        averageAccuracy: avgAccuracy.toFixed(2),
        highestAccuracy: maxAccuracy.toFixed(2),
        lowestAccuracy: minAccuracy.toFixed(2),
        averageSessionTime: avgTimePerSession,
        averageTopicsPerStudent: avgTopicsPerStudent,
      },
      performanceDistribution: distribution,
      engagementLevel: {
        highlyEngaged: perfDataList.filter(
          (p) => p.performanceTrends?.length > 20,
        ).length,
        moderatelyEngaged: perfDataList.filter(
          (p) =>
            (p.performanceTrends?.length || 0) > 5 &&
            (p.performanceTrends?.length || 0) <= 20,
        ).length,
        lowEngagement: perfDataList.filter(
          (p) => (p.performanceTrends?.length || 0) <= 5,
        ).length,
      },
      quickStats: {
        studentsAboveAverage: perfDataList.filter(
          (p) => (p.overallStats?.accuracy || 0) >= avgAccuracy,
        ).length,
        studentsNeedingHelp: distribution.needsSupport + distribution.average,
        topPerformerCount: distribution.excellent,
      },
    },
  });
});

/**
 * 15. Predictive Recommendations - AI-driven suggestions
 * GET /api/teachers/analytics/recommendations/:studentId
 */
exports.getPredictiveRecommendations = asyncHandler(async (req, res, next) => {
  const { studentId } = req.params;
  const StudentPerformance = require("../models/studentPerformance");
  const studentUserId = await resolveStudentPerformanceUserId(studentId);

  if (!studentUserId) {
    return next(new ErrorResponse("Student not found", 404));
  }

  const course = await Course.findOne({
    instructor: req.user.id,
    students: studentUserId,
  });

  if (!course) {
    return next(new ErrorResponse("Not authorized", 403));
  }

  const perfData = await StudentPerformance.findOne({ userId: studentUserId });

  if (!perfData) {
    return res.status(200).json({ success: true, data: null });
  }

  const recommendations = [];
  const accuracy = perfData.overallStats?.accuracy || 0;

  // Recommendation 1: Study strategy
  if (accuracy < 60) {
    recommendations.push({
      id: 1,
      category: "Study Strategy",
      priority: "high",
      title: "Focus on Fundamentals",
      description:
        "Your accuracy is below 60%. Focus on mastering fundamental concepts before moving to advanced topics.",
      action:
        "Review foundational materials and take concept-specific practice tests",
      estimatedTimeRequired: "4-6 hours",
    });
  }

  // Recommendation 2: Topic focus
  const weakTopics = (perfData.topicPerformance || [])
    .filter((t) => t.accuracy < 70)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3);

  if (weakTopics.length > 0) {
    recommendations.push({
      id: 2,
      category: "Topic Focus",
      priority: "high",
      title: `Master ${weakTopics[0].topic}`,
      description: `You're struggling with ${weakTopics.map((t) => t.topic).join(", ")}. Consider focusing here.`,
      action: `Practice ${weakTopics[0].topic} with targeted exercises`,
      estimatedTimeRequired: "2-3 hours",
    });
  }

  // Recommendation 3: Retention review
  if (perfData.performanceTrends && perfData.performanceTrends.length > 1) {
    const recent = perfData.performanceTrends.slice(-3);
    const avgRecent =
      recent.reduce((sum, t) => sum + t.accuracy, 0) / recent.length;
    const avgPrevious =
      perfData.performanceTrends
        .slice(0, -3)
        .reduce((sum, t) => sum + t.accuracy, 0) /
      (perfData.performanceTrends.length - 3);

    if (avgRecent < avgPrevious - 5) {
      recommendations.push({
        id: 3,
        category: "Retention",
        priority: "medium",
        title: "Spaced Repetition Practice",
        description:
          "Your recent performance shows declining retention. Practice spaced repetition on previously learned topics.",
        action: "Review topics learned 1-2 weeks ago using spaced repetition",
        estimatedTimeRequired: "1-2 hours",
      });
    }
  }

  // Recommendation 4: Pacing adjustment
  const avgTimePerQuestion = perfData.overallStats?.averageTimePerQuestion || 0;
  if (avgTimePerQuestion < 1) {
    recommendations.push({
      id: 4,
      category: "Pacing",
      priority: "medium",
      title: "Slow Down and Reflect",
      description:
        "You're answering questions very quickly (< 1 min). Take more time to think through answers.",
      action:
        "Practice deliberate problem-solving with increased reflection time",
      estimatedTimeRequired: "ongoing",
    });
  } else if (avgTimePerQuestion > 5) {
    recommendations.push({
      id: 5,
      category: "Pacing",
      priority: "low",
      title: "Improve Speed",
      description:
        "You're spending significant time per question. Try timed practice to improve speed.",
      action: "Practice with time constraints to build speed",
      estimatedTimeRequired: "2-3 hours",
    });
  }

  // Recommendation 5: Topic progression
  const expertTopics = (perfData.topicPerformance || []).filter(
    (t) => t.masteryLevel === "expert",
  );
  if (expertTopics.length > 5 && weakTopics.length === 0) {
    recommendations.push({
      id: 6,
      category: "Advancement",
      priority: "low",
      title: "Explore Advanced Topics",
      description:
        "You've mastered many topics. Consider exploring advanced or specialized topics.",
      action: "Enroll in advanced courses or specialized modules",
      estimatedTimeRequired: "varies",
    });
  }

  res.status(200).json({
    success: true,
    data: {
      studentId,
      totalRecommendations: recommendations.length,
      recommendations: recommendations.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }),
    },
  });
});
