const TestSession = require("../models/TestSession");
const StudentPerformance = require("../models/studentPerformance");
const User = require("../models/user");
const { v4: uuidv4 } = require("uuid");
const mongoose = require("mongoose");
const flaskApiService = require("../Services/flaskAPIService");
const questionBankService = require("../Services/questionBankService");
const analyticsService = require("../Services/analyticsService");
const CourseQuestionBank = require("../models/Question/questionAdaptationSchema");

const createSessionQuestionId = (sourceId = null) => {
  const safeSource = sourceId ? String(sourceId) : "q";
  return `${safeSource}_${uuidv4()}`;
};

/**
 * Fetch questions from MongoDB CourseQuestionBank based on courseIds and topics
 */
const fetchQuestionsFromCourses = async (courseIds, selectedTopics, difficulty, batchSize = 60) => {
  try {
    console.log("[testController.fetchQuestionsFromCourses] START");
    console.log("[testController.fetchQuestionsFromCourses] Input courseIds:", courseIds);
    console.log("[testController.fetchQuestionsFromCourses] Input selectedTopics:", selectedTopics);
    console.log("[testController.fetchQuestionsFromCourses] Input difficulty:", difficulty);

    if (!courseIds || courseIds.length === 0) {
      console.log("[testController.fetchQuestionsFromCourses] No courseIds provided, returning empty");
      return [];
    }

    // Convert courseIds to MongoDB ObjectIds - properly using 'new' keyword
    const objectIds = courseIds.map((id) => {
      try {
        // First, check if it's a string representation of an ObjectId
        if (typeof id === 'string' && id.length === 24) {
          const converted = new mongoose.Types.ObjectId(id);
          console.log(`[testController.fetchQuestionsFromCourses] Converted courseId ${id} to ObjectId: ${converted}`);
          return converted;
        }
        // If it's already an ObjectId
        if (mongoose.Types.ObjectId.isValid(id)) {
          const converted = new mongoose.Types.ObjectId(id);
          console.log(`[testController.fetchQuestionsFromCourses] Converted courseId ${id} to ObjectId: ${converted}`);
          return converted;
        }
        console.warn(`[testController.fetchQuestionsFromCourses] Invalid courseId format: ${id}`);
        return null;
      } catch (e) {
        console.error(`[testController.fetchQuestionsFromCourses] Error converting courseId ${id}:`, e.message);
        return null;
      }
    }).filter(Boolean);

    console.log("[testController.fetchQuestionsFromCourses] Converted ObjectIds:", objectIds.map(id => id.toString()));

    if (objectIds.length === 0) {
      console.log("[testController.fetchQuestionsFromCourses] No valid ObjectIds after conversion, returning empty");
      return [];
    }

    // Query all question banks for the selected courses
    console.log("[testController.fetchQuestionsFromCourses] Querying CourseQuestionBank with courses:", objectIds.map(id => id.toString()));
    const questionBanks = await CourseQuestionBank.find({
      course: { $in: objectIds },
    }).lean();

    console.log("[testController.fetchQuestionsFromCourses] Found", questionBanks.length, "question banks");

    let allQuestions = [];

    for (let i = 0; i < questionBanks.length; i++) {
      const bank = questionBanks[i];
      console.log(`[testController.fetchQuestionsFromCourses] Processing bank ${i + 1}/${questionBanks.length}`);
      console.log(`[testController.fetchQuestionsFromCourses] Bank subject: ${bank.subject}`);
      console.log(`[testController.fetchQuestionsFromCourses] Bank questions count: ${bank.questions?.length || 0}`);

      if (!bank.questions || bank.questions.length === 0) {
        console.log(`[testController.fetchQuestionsFromCourses] Bank has no questions, skipping`);
        continue;
      }

      // Filter questions by selected topics if provided
      let filteredQuestions = bank.questions;
      if (selectedTopics && selectedTopics.length > 0) {
        const topicsBefore = filteredQuestions.length;
        filteredQuestions = bank.questions.filter((q) =>
          selectedTopics.includes(q.topic)
        );
        console.log(`[testController.fetchQuestionsFromCourses] After topic filter (${selectedTopics.join(', ')}): ${topicsBefore} -> ${filteredQuestions.length} questions`);
      }

      // Filter by difficulty if specified
      if (typeof difficulty === "number") {
        const difficultyMargin = 0.2;
        const beforeDifficulty = filteredQuestions.length;
        filteredQuestions = filteredQuestions.filter((q) => {
          const qDifficulty = q.difficulty || 0.5;
          return Math.abs(qDifficulty - difficulty) <= difficultyMargin;
        });
        console.log(`[testController.fetchQuestionsFromCourses] After difficulty filter (${difficulty}±${0.2}): ${beforeDifficulty} -> ${filteredQuestions.length} questions`);
      }

      allQuestions = allQuestions.concat(filteredQuestions);
      console.log(`[testController.fetchQuestionsFromCourses] Total questions so far: ${allQuestions.length}`);
    }

    console.log(`[testController.fetchQuestionsFromCourses] Total questions collected: ${allQuestions.length}`);
    console.log(`[testController.fetchQuestionsFromCourses] Batchsize requested: ${batchSize || 60}`);

    // Shuffle and limit to batchSize or 60
    allQuestions = allQuestions.sort(() => Math.random() - 0.5);
    const finalQuestions = allQuestions.slice(0, batchSize || 60);
    console.log(`[testController.fetchQuestionsFromCourses] Final questions returned: ${finalQuestions.length}`);

    if (finalQuestions.length > 0) {
      console.log(`[testController.fetchQuestionsFromCourses] Sample question: ${finalQuestions[0].text?.substring(0, 50)}...`);
    }

    return finalQuestions;
  } catch (error) {
    console.error("[testController.fetchQuestionsFromCourses] ERROR:", error);
    console.error("[testController.fetchQuestionsFromCourses] Stack:", error.stack);
    return [];
  }
};

/**
 * Create a new test session
 *//**
 * Create a new test session
 */
exports.createTest = async (req, res) => {
  try {
    const {
      studentId,
      testType,
      testConfig,
      selectedTopics = [],
      selectedPdfs = [],
      selectedCourseIds = [],
    } = req.body;

    if (!studentId || !testType) {
      return res.status(400).json({
        success: false,
        error: "studentId and testType are required",
      });
    }

    // Generate session ID
    const sessionId = uuidv4();

    let questions = [];
    let flaskSessionId = null;
    let flaskMetadata = {};

    console.log("[testController.createTest] START - TestType:", testType);
    console.log(
      "[testController.createTest] selectedCourseIds:",
      selectedCourseIds,
    );
    console.log("[testController.createTest] selectedTopics:", selectedTopics);
    console.log(
      "[testController.createTest] testConfig difficulty:",
      testConfig?.difficulty,
    );

    if (testType === "practice") {
      // First try to get questions from MongoDB CourseQuestionBank if courseIds are provided
      if (selectedCourseIds && selectedCourseIds.length > 0) {
        try {
          console.log(
            "[testController.createTest] Attempting to fetch questions from MongoDB CourseQuestionBank",
          );
          questions = await fetchQuestionsFromCourses(
            selectedCourseIds,
            selectedTopics,
            testConfig?.difficulty || 0.5,
            testConfig?.batchSize || 60,
          );
          console.log(
            "[testController.createTest] MongoDB returned",
            questions.length,
            "questions",
          );

          // Map questions to session format
          questions = questions.map((q) => {
            const mapped = {
              _id: createSessionQuestionId(q._id || q.questionId),
              text: q.text,
              type: q.type || "MCQ",
              difficulty: q.difficulty || 0.5,
              difficultyLevel: q.difficulty_level || "medium",
              options: q.options || [],
              correctAnswer: q.correct_answer,
              explanation: q.explanation || "",
              solutionSteps: q.solution_steps || [],
              conceptArea: q.topic || selectedTopics[0] || "general",
              topic: q.topic || selectedTopics[0] || "general",
              marks: q.marks || 4,
              expectedTime: q.expected_time || 120,
              metadata: {
                generatedAt: new Date(),
                tags: q.tags || [],
                sourceQuestionId: q._id || q.questionId,
                fromCourseQuestionBank: true,
              },
            };
            return mapped;
          });
          console.log(
            "[testController.createTest] Mapped",
            questions.length,
            "questions for session",
          );
        } catch (courseError) {
          console.error(
            "[testController.createTest] Error fetching from course question bank:",
            courseError,
          );
          questions = [];
        }
      } else {
        console.log(
          "[testController.createTest] No selectedCourseIds provided, skipping MongoDB lookup",
        );
      }

      // Log if no questions found and trying fallback
      if (questions.length === 0) {
        console.log(
          "[testController.createTest] No questions from MongoDB, attempting Flask fallback",
        );
      }

      // If no questions from courses, try Flask
      if (questions.length === 0 && selectedTopics.length > 0) {
        try {
          const flaskResponse = await flaskApiService.startTestSession(
            studentId,
            testType,
            selectedTopics,
            selectedPdfs,
            testConfig?.difficulty || 0.5,
          );

          flaskSessionId = flaskResponse.session_id || null;
          flaskMetadata = flaskResponse.metadata || {};

          if (flaskResponse.questions && flaskResponse.questions.questions) {
            const normalizedSelectedTopics = (selectedTopics || []).map(
              (topic) =>
                String(topic)
                  .toLowerCase()
                  .replace(/&/g, " and ")
                  .replace(/[^a-z0-9]+/g, " ")
                  .trim(),
            );

            const flaskQuestions = flaskResponse.questions.questions.filter(
              (q) => {
                if (!normalizedSelectedTopics.length) return true;
                const normalizedQuestionTopic = String(
                  q.topic || q.concept_area || "general",
                )
                  .toLowerCase()
                  .replace(/&/g, " and ")
                  .replace(/[^a-z0-9]+/g, " ")
                  .trim();
                return normalizedSelectedTopics.includes(
                  normalizedQuestionTopic,
                );
              },
            );

            const mappedSource = flaskQuestions.length
              ? flaskQuestions
              : flaskResponse.questions.questions;

            questions = mappedSource.map((q) => ({
              _id: createSessionQuestionId(q.id),
              text: q.text,
              type: q.type,
              difficulty: q.difficulty || 0.5,
              difficultyLevel: exports.mapDifficultyLevel(q.difficulty || 0.5),
              options: q.options || [],
              correctAnswer: q.correct_answer,
              explanation: q.explanation || "",
              solutionSteps: q.solution_steps || [],
              conceptArea: q.concept_area || selectedTopics[0] || "general",
              topic: q.topic || selectedTopics[0] || "general",
              marks: q.marks || 4,
              expectedTime: q.expected_time || 120,
              metadata: {
                generatedAt: new Date(),
                sourcePdf: q.metadata?.sourcePdf,
                tags: q.metadata?.tags || [],
                lstmOutput: flaskResponse.metadata?.lstm_input,
                sourceQuestionId: q.id || null,
              },
            }));
          }

          // If Flask session starts but no questions are generated, use local fallback.
          if (!questions.length) {
            flaskSessionId = null;
            const fallbackQuestions = await questionBankService.getPracticeQuestions(
              testConfig?.difficulty || 0.5,
              testConfig?.batchSize || 60,
              [],
              selectedTopics,
            );
            questions = fallbackQuestions.map((q) => ({
              ...q,
              _id: createSessionQuestionId(q.questionId),
              correctAnswer: q.correct_answer,
              metadata: {
                ...(q.metadata || {}),
                sourceQuestionId: q.questionId || null,
              },
            }));
          }
        } catch (flaskError) {
          console.error(
            "Flask API error, falling back to local questions:",
            flaskError.message,
          );
          const fallbackQuestions = await questionBankService.getPracticeQuestions(
            testConfig.difficulty || 0.5,
            testConfig.batchSize || 60,
            [],
            selectedTopics,
          );
          questions = fallbackQuestions.map((q) => ({
            ...q,
            _id: createSessionQuestionId(q.questionId),
            correctAnswer: q.correct_answer,
            metadata: {
              ...(q.metadata || {}),
              sourceQuestionId: q.questionId || null,
            },
          }));
        }
      }

      // Last resort: use random practice questions
      if (questions.length === 0) {
        const randomQuestions = await questionBankService.getPracticeQuestions(
          testConfig.difficulty || 0.5,
          testConfig.batchSize || 60,
        );
        questions = randomQuestions.map((q) => ({
          ...q,
          _id: q.questionId,
          correctAnswer: q.correct_answer,
        }));
      }
    } else {
      // ==================== REAL EXAM MODE ====================
      console.log("[testController.createTest] REAL EXAM MODE - Fetching 100 questions");

      if (selectedCourseIds && selectedCourseIds.length > 0) {
        try {
          console.log("[testController.createTest] REAL EXAM: Fetching questions from MongoDB CourseQuestionBank");

          // Fetch up to 200 questions to ensure enough variety
          const allCourseQuestions = await fetchQuestionsFromCourses(
            selectedCourseIds,
            selectedTopics,
            testConfig?.difficulty || 0.5,
            200,
          );

          console.log(`[testController.createTest] REAL EXAM: Got ${allCourseQuestions.length} questions from courses`);

          if (allCourseQuestions.length >= 100) {
            // Categorize by difficulty for balanced selection
            const easy = allCourseQuestions.filter(q => (q.difficulty || 0.5) < 0.4);
            const medium = allCourseQuestions.filter(q => (q.difficulty || 0.5) >= 0.4 && (q.difficulty || 0.5) < 0.7);
            const hard = allCourseQuestions.filter(q => (q.difficulty || 0.5) >= 0.7);

            console.log(`[testController.createTest] REAL EXAM: Difficulty distribution - Easy: ${easy.length}, Medium: ${medium.length}, Hard: ${hard.length}`);

            // Determine desired mix based on target difficulty
            const targetDifficulty = testConfig?.difficulty || 0.5;
            let desiredMix = { easy: 30, medium: 40, hard: 30 };
            if (targetDifficulty < 0.4) {
              desiredMix = { easy: 45, medium: 35, hard: 20 };
            } else if (targetDifficulty > 0.7) {
              desiredMix = { easy: 15, medium: 35, hard: 50 };
            }

            // Select questions from each category
            const selectedEasy = easy.sort(() => Math.random() - 0.5).slice(0, desiredMix.easy);
            const selectedMedium = medium.sort(() => Math.random() - 0.5).slice(0, desiredMix.medium);
            const selectedHard = hard.sort(() => Math.random() - 0.5).slice(0, desiredMix.hard);

            questions = [...selectedEasy, ...selectedMedium, ...selectedHard];

            // Fill remaining to reach 100 if needed
            if (questions.length < 100) {
              const usedIds = new Set(questions.map(q => String(q._id || q.questionId)));
              const remaining = allCourseQuestions.filter(q => !usedIds.has(String(q._id || q.questionId)));
              const additional = remaining.sort(() => Math.random() - 0.5).slice(0, 100 - questions.length);
              questions = [...questions, ...additional];
            }

            // Ensure exactly 100 questions
            questions = questions.slice(0, 100);

            // Final shuffle
            questions = questions.sort(() => Math.random() - 0.5);

            console.log(`[testController.createTest] REAL EXAM: Final selection - ${questions.length} questions (Easy: ${selectedEasy.length}, Medium: ${selectedMedium.length}, Hard: ${selectedHard.length})`);
          } else {
            // Less than 100 questions available from course
            console.log(`[testController.createTest] REAL EXAM: Only ${allCourseQuestions.length} available, filling with additional questions`);
            questions = [...allCourseQuestions];

            try {
              const excludeIds = questions.map(q => String(q._id || q.questionId));
              const additionalQuestions = await questionBankService.getPracticeQuestions(
                testConfig?.difficulty || 0.5,
                100 - questions.length,
                excludeIds,
                selectedTopics,
              );
              questions = [...questions, ...additionalQuestions];
              console.log(`[testController.createTest] REAL EXAM: Added ${additionalQuestions.length} additional questions, total: ${questions.length}`);
            } catch (err) {
              console.warn("[testController.createTest] Could not fetch additional questions:", err.message);
            }
          }

          // Map questions to session format
          questions = questions.map((q) => ({
            _id: createSessionQuestionId(q._id || q.questionId),
            text: q.text,
            type: q.type || "MCQ",
            difficulty: q.difficulty || 0.5,
            difficultyLevel: q.difficulty_level || "medium",
            options: q.options || [],
            correctAnswer: q.correct_answer,
            explanation: q.explanation || "",
            solutionSteps: q.solution_steps || [],
            conceptArea: q.topic || "general",
            topic: q.topic || "general",
            marks: q.marks || 4,
            expectedTime: q.expected_time || 120,
            metadata: {
              generatedAt: new Date(),
              tags: q.tags || [],
              sourceQuestionId: q._id || q.questionId,
              fromCourseQuestionBank: true,
            },
          }));

          console.log(`[testController.createTest] REAL EXAM: Mapped ${questions.length} questions for session`);
        } catch (courseError) {
          console.error("Error fetching exam questions from courses:", courseError);
          // Fall back to questionBankService
          const examQuestions = await questionBankService.getRealExamQuestions(testConfig?.difficulty || 0.5);
          questions = examQuestions.map((q) => ({
            ...q,
            _id: createSessionQuestionId(q.questionId || q._id),
            correctAnswer: q.correct_answer || q.correctAnswer,
            difficultyLevel: q.difficultyLevel || q.difficulty_level || "medium",
            metadata: {
              ...(q.metadata || {}),
              sourceQuestionId: q.questionId || q._id || null,
              fromCourseQuestionBank: false,
            },
          }));
          console.log(`[testController.createTest] REAL EXAM: Fallback - ${questions.length} questions from questionBankService`);
        }
      } else {
        // No courseIds provided - use questionBankService
        console.log("[testController.createTest] REAL EXAM: No courseIds provided, using questionBankService");
        const examQuestions = await questionBankService.getRealExamQuestions(testConfig?.difficulty || 0.5);
        questions = examQuestions.map((q) => ({
          ...q,
          _id: createSessionQuestionId(q.questionId || q._id),
          correctAnswer: q.correct_answer || q.correctAnswer,
          difficultyLevel: q.difficultyLevel || q.difficulty_level || "medium",
          metadata: {
            sourceQuestionId: q.questionId || q._id || null,
            fromCourseQuestionBank: false,
          },
        }));
        console.log(`[testController.createTest] REAL EXAM: ${questions.length} questions from questionBankService`);
      }
    }

    // Create test session
    const testSession = new TestSession({
      sessionId,
      flaskSessionId,
      studentId,
      userId: req.user?.id,
      testType,
      selectedCourseIds: selectedCourseIds || [],
      testConfig: {
        selectedCourseIds: selectedCourseIds || [],
        title:
          testConfig?.title ||
          `${testType === "real" ? "Real Exam" : "Practice Test"}`,
        description: testConfig?.description || "",
        totalDuration: testType === "real" ? 60 : null,
        totalQuestions: questions.length,
        selectedTopics,
        selectedPdfs,
        questionTypes: testConfig?.questionTypes || ["MCQ", "MSQ", "NAT"],
        adaptiveEnabled: testConfig?.adaptiveEnabled !== false,
        batchSize: testConfig?.batchSize || (testType === "real" ? 100 : 60),
        difficulty: testConfig?.difficulty || 0.5,
        allowReview: testConfig?.allowReview !== false,
        showSolutions: testConfig?.showSolutions || false,
        flaskEnabled: !!flaskSessionId,
        sections:
          testType === "real"
            ? [
                {
                  name: "Section A",
                  subject: "mathematics",
                  questionCount: 25,
                  marksPerQuestion: 2,
                },
                {
                  name: "Section B",
                  subject: "english",
                  questionCount: 25,
                  marksPerQuestion: 1,
                },
                {
                  name: "Section C",
                  subject: "reasoning",
                  questionCount: 25,
                  marksPerQuestion: 2,
                },
                {
                  name: "Section D",
                  subject: "general_knowledge",
                  questionCount: 25,
                  marksPerQuestion: 1,
                },
              ]
            : [],
      },
      questions,
      timeRemaining: testType === "real" ? 60 * 60 : null,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        flaskSessionId,
        flaskMetadata,
      },
    });

    await testSession.save();

    // Sanitize questions
    const sanitizedQuestions = testSession.questions.map((q) => ({
      id: q._id,
      text: q.text,
      type: q.type,
      difficulty: q.difficulty,
      difficultyLevel: q.difficultyLevel,
      options: q.type !== "NAT" ? q.options : undefined,
      conceptArea: q.conceptArea,
      topic: q.topic,
      marks: q.marks,
      expectedTime: q.expectedTime,
      explanation: q.explanation || "",
      hints: q.hints || [],
      correctAnswer: q.correctAnswer || q.correct_answer,
      solutionSteps: q.solutionSteps || [],
      tags: q.tags || [],
    }));

    console.log("[testController.createTest] RESPONSE SUMMARY:");
    console.log(
      "[testController.createTest] Total questions in response:",
      sanitizedQuestions.length,
    );
    console.log(
      "[testController.createTest] selectedCourseIds in config:",
      testSession.testConfig.selectedCourseIds,
    );
    console.log(
      "[testController.createTest] selectedTopics in config:",
      testSession.testConfig.selectedTopics,
    );
    console.log(
      "[testController.createTest] First question sample:",
      sanitizedQuestions[0]?.text?.substring(0, 50) || "(no questions)",
    );

    res.status(201).json({
      success: true,
      sessionId: testSession.sessionId,
      flaskSessionId: testSession.flaskSessionId,
      testType: testSession.testType,
      questions: sanitizedQuestions,
      totalQuestions: testSession.questions.length,
      startTime: testSession.startTime,
      timeRemaining: testSession.timeRemaining,
      config: testSession.testConfig,
      metadata: flaskMetadata,
    });
  } catch (error) {
    console.error("Error creating test:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get test session by ID
 */
exports.getTestSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const testSession = await TestSession.findOne({ sessionId });

    if (!testSession) {
      return res.status(404).json({
        success: false,
        error: "Test session not found",
      });
    }

    res.json({
      success: true,
      session: {
        sessionId: testSession.sessionId,
        flaskSessionId: testSession.flaskSessionId,
        studentId: testSession.studentId,
        testType: testSession.testType,
        status: testSession.status,
        startTime: testSession.startTime,
        endTime: testSession.endTime,
        timeRemaining: testSession.timeRemaining,
        currentQuestionIndex: testSession.currentQuestionIndex,
        totalQuestions: testSession.questions.length,
        answeredCount: testSession.answers.length,
        config: testSession.testConfig,
        summary: testSession.summary,
      },
    });
  } catch (error) {
    console.error("Error getting test session:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get all test sessions for a student
 */
exports.getStudentTests = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { testType, limit = 20, page = 1 } = req.query;

    const query = { studentId };
    if (testType) query.testType = testType;

    const skip = (page - 1) * limit;

    const tests = await TestSession.find(query)
      .sort({ startTime: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select("sessionId testType status startTime endTime summary testConfig");

    const total = await TestSession.countDocuments(query);

    res.json({
      success: true,
      tests,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalTests: total,
        hasNext: skip + tests.length < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Error getting student tests:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get test questions with pagination
 */
exports.getQuestions = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { page = 1, limit = 10, includeAnswers = false } = req.query;

    const testSession = await TestSession.findOne({ sessionId });

    if (!testSession) {
      return res.status(404).json({
        success: false,
        error: "Test session not found",
      });
    }

    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    let questions = testSession.questions.slice(startIndex, endIndex);

    // Sanitize if needed
    if (!includeAnswers && testSession.status === "active") {
      questions = questions.map((q) => ({
        id: q._id,
        text: q.text,
        type: q.type,
        difficulty: q.difficulty,
        difficultyLevel: q.difficultyLevel,
        options: q.type !== "NAT" ? q.options : undefined,
        conceptArea: q.conceptArea,
        topic: q.topic,
        marks: q.marks,
        expectedTime: q.expectedTime,
      }));
    } else {
      questions = questions.map((q) => ({
        ...q.toObject(),
        id: q._id,
      }));
    }

    const answers = testSession.answers.filter((a) =>
      questions.some((q) => q.id === a.questionId),
    );

    res.json({
      success: true,
      questions,
      answers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(testSession.questions.length / limit),
        totalQuestions: testSession.questions.length,
        hasNext: endIndex < testSession.questions.length,
        hasPrev: startIndex > 0,
      },
    });
  } catch (error) {
    console.error("Error fetching questions:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get next batch of questions (for practice mode)
 */
exports.getNextQuestionBatch = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { responses = [] } = req.body;

    const testSession = await TestSession.findOne({ sessionId });

    if (!testSession) {
      return res.status(404).json({
        success: false,
        error: "Test session not found",
      });
    }

    if (testSession.testType !== "practice") {
      return res.status(400).json({
        success: false,
        error: "This endpoint is only for practice mode",
      });
    }

    let newQuestions = [];
    let nextDifficulty = testSession.testConfig.difficulty || 0.5;

    if (testSession.flaskSessionId) {
      // Get next questions from Flask
      try {
        const flaskResponse = await flaskApiService.getNextQuestions(
          testSession.flaskSessionId,
          responses,
        );

        if (flaskResponse.success && flaskResponse.questions?.questions) {
          newQuestions = flaskResponse.questions.questions.map((q) => ({
            _id: q.id || uuidv4(),
            text: q.text,
            type: q.type,
            difficulty: q.difficulty || 0.5,
            difficultyLevel: this.mapDifficultyLevel(q.difficulty || 0.5),
            options: q.options || [],
            correctAnswer: q.correct_answer,
            explanation: q.explanation || "",
            solutionSteps: q.solution_steps || [],
            conceptArea: q.concept_area || "general",
            topic: q.topic || "general",
            marks: q.marks || 4,
            expectedTime: q.expected_time || 120,
            metadata: {
              generatedAt: new Date(),
              tags: q.metadata?.tags || [],
              lstmOutput: flaskResponse.metadata?.lstm_output,
            },
          }));

          nextDifficulty =
            flaskResponse.metadata?.next_difficulty || nextDifficulty;
        }
      } catch (error) {
        console.error("Error getting questions from Flask:", error);
      }
    }

    // If no questions from Flask, use local question bank
    if (newQuestions.length === 0) {
      const excludeIds = testSession.questions.map((q) => q._id);
      const localQuestions = questionBankService.getPracticeQuestions(
        nextDifficulty,
        testSession.testConfig.batchSize || 60,
        excludeIds,
      );

      newQuestions = localQuestions.map((q) => ({
        _id: q.questionId,
        text: q.text,
        type: q.type,
        difficulty: q.difficulty,
        difficultyLevel: q.difficultyLevel,
        options: q.options,
        correctAnswer: q.correct_answer,
        explanation: q.explanation,
        solutionSteps: q.solutionSteps || [],
        conceptArea: q.conceptArea || q.topic,
        topic: q.topic,
        marks: q.marks,
        expectedTime: q.expectedTime,
        metadata: {
          generatedAt: new Date(),
          tags: q.tags || [],
        },
      }));
    }

    // Add new questions to session
    if (newQuestions.length > 0) {
      testSession.questions.push(...newQuestions);
      testSession.testConfig.difficulty = nextDifficulty;
      await testSession.save();
    }

    // Sanitize for response
    const sanitizedQuestions = newQuestions.map((q) => ({
      id: q._id,
      text: q.text,
      type: q.type,
      difficulty: q.difficulty,
      difficultyLevel: q.difficultyLevel,
      options: q.type !== "NAT" ? q.options : undefined,
      conceptArea: q.conceptArea,
      topic: q.topic,
      marks: q.marks,
      expectedTime: q.expectedTime,
    }));

    res.json({
      success: true,
      questions: sanitizedQuestions,
      nextDifficulty,
      totalQuestions: testSession.questions.length,
    });
  } catch (error) {
    console.error("Error getting next question batch:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get test summary
 */
exports.getTestSummary = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const testSession = await TestSession.findOne({ sessionId });

    if (!testSession) {
      return res.status(404).json({
        success: false,
        error: "Test session not found",
      });
    }

    // Ensure summary is calculated
    if (!testSession.summary || Object.keys(testSession.summary).length === 0) {
      testSession.calculateSummary();
      await testSession.save();
    }

    const exportSummary = analyticsService.generateExportSummary(testSession);

    // Get Flask analysis if available
    let flaskAnalysis = null;
    if (testSession.flaskSessionId && testSession.status === "completed") {
      try {
        flaskAnalysis = await flaskApiService.completeTestSession(
          testSession.flaskSessionId,
        );
      } catch (error) {
        console.error("Error getting Flask analysis:", error);
      }
    }

    res.json({
      success: true,
      summary: testSession.summary,
      exportSummary,
      flaskAnalysis,
      testInfo: {
        sessionId: testSession.sessionId,
        testType: testSession.testType,
        title: testSession.testConfig.title,
        startTime: testSession.startTime,
        endTime: testSession.endTime,
        duration: testSession.testType === "real" ? 60 : "Unlimited",
        totalQuestions: testSession.questions.length,
      },
    });
  } catch (error) {
    console.error("Error getting test summary:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Delete test session
 */
exports.deleteTest = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const testSession = await TestSession.findOneAndDelete({ sessionId });

    if (!testSession) {
      return res.status(404).json({
        success: false,
        error: "Test session not found",
      });
    }

    res.json({
      success: true,
      message: "Test session deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting test:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Map difficulty value to level
 */
exports.mapDifficultyLevel = (difficulty) => {
  if (difficulty < 0.2) return "very_easy";
  if (difficulty < 0.4) return "easy";
  if (difficulty < 0.6) return "medium";
  if (difficulty < 0.8) return "hard";
  return "very_hard";
};

// Add these methods to testController.js

/**
 * Generate complete question paper with solutions
 */
exports.generateQuestionPaper = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const testSession = await TestSession.findOne({ sessionId });

    if (!testSession) {
      return res.status(404).json({
        success: false,
        error: "Test session not found",
      });
    }

    // Ensure summary is calculated
    if (!testSession.summary || Object.keys(testSession.summary).length === 0) {
      testSession.calculateSummary();
      await testSession.save();
    }

    // Group questions by concept/subject
    const questionsBySubject = {};
    const questionsByConcept = {};

    testSession.questions.forEach((q, index) => {
      const subject = q.subject || "general";
      const concept = q.conceptArea || q.topic || "general";

      if (!questionsBySubject[subject]) {
        questionsBySubject[subject] = [];
      }

      if (!questionsByConcept[concept]) {
        questionsByConcept[concept] = [];
      }

      const answer = testSession.answers.find((a) => a.questionId === q._id);

      const questionData = {
        number: index + 1,
        id: q._id,
        text: q.text,
        type: q.type,
        difficulty: q.difficulty,
        difficultyLevel: q.difficultyLevel,
        marks: q.marks,
        expectedTime: q.expectedTime,
        topic: q.topic,
        conceptArea: q.conceptArea,
        options: q.type !== "NAT" ? q.options : undefined,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        solutionSteps: q.solutionSteps,
        studentAnswer: answer
          ? {
              selected: answer.selectedOptions,
              isCorrect: answer.isCorrect,
              timeSpent: answer.timeSpent,
              marksObtained: answer.marksObtained,
              confidence: answer.confidence,
            }
          : {
              selected: null,
              isCorrect: false,
              timeSpent: 0,
              marksObtained: 0,
            },
      };

      questionsBySubject[subject].push(questionData);
      questionsByConcept[concept].push(questionData);
    });

    // Calculate subject-wise performance
    const subjectPerformance = {};
    Object.keys(questionsBySubject).forEach((subject) => {
      const questions = questionsBySubject[subject];
      const total = questions.length;
      const answered = questions.filter((q) => q.studentAnswer.selected).length;
      const correct = questions.filter((q) => q.studentAnswer.isCorrect).length;
      const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);
      const obtainedMarks = questions.reduce(
        (sum, q) => sum + (q.studentAnswer.marksObtained || 0),
        0,
      );
      const totalTime = questions.reduce(
        (sum, q) => sum + (q.studentAnswer.timeSpent || 0),
        0,
      );

      subjectPerformance[subject] = {
        totalQuestions: total,
        answered,
        correct,
        accuracy: answered > 0 ? (correct / answered) * 100 : 0,
        totalMarks,
        obtainedMarks,
        percentage: totalMarks > 0 ? (obtainedMarks / totalMarks) * 100 : 0,
        averageTime: answered > 0 ? totalTime / answered : 0,
      };
    });

    // Identify strong and weak topics
    const strongTopics = [];
    const weakTopics = [];

    Object.keys(questionsByConcept).forEach((concept) => {
      const questions = questionsByConcept[concept];
      const answered = questions.filter((q) => q.studentAnswer.selected).length;
      const correct = questions.filter((q) => q.studentAnswer.isCorrect).length;
      const accuracy = answered > 0 ? (correct / answered) * 100 : 0;

      if (answered >= 3) {
        if (accuracy >= 70) {
          strongTopics.push({
            concept,
            accuracy,
            questionsAttempted: answered,
          });
        } else if (accuracy < 40) {
          weakTopics.push({ concept, accuracy, questionsAttempted: answered });
        }
      }
    });

    // Sort and limit
    strongTopics.sort((a, b) => b.accuracy - a.accuracy);
    weakTopics.sort((a, b) => a.accuracy - b.accuracy);

    const questionPaper = {
      metadata: {
        title: testSession.testConfig.title,
        testType: testSession.testType,
        date: testSession.endTime || testSession.startTime,
        duration: testSession.testType === "real" ? "60 minutes" : "Unlimited",
        totalQuestions: testSession.questions.length,
        answeredQuestions: testSession.summary.answeredQuestions,
        correctAnswers: testSession.summary.correctAnswers,
        incorrectAnswers: testSession.summary.incorrectAnswers,
        accuracy: testSession.summary.accuracy,
        totalMarks: testSession.summary.totalMarks,
        marksObtained: testSession.summary.marksObtained,
        percentage: testSession.summary.percentageScore,
        totalTimeSpent: testSession.summary.totalTimeSpent,
        averageTimePerQuestion: testSession.summary.averageTimePerQuestion,
      },
      subjectWise: subjectPerformance,
      conceptWise: testSession.summary.conceptWisePerformance || {},
      difficultyWise: testSession.summary.difficultyWisePerformance || {},
      strongTopics: strongTopics.slice(0, 5),
      weakTopics: weakTopics.slice(0, 5),
      questionsBySubject,
      timeAnalysis: {
        totalTime: testSession.summary.totalTimeSpent,
        averagePerQuestion: testSession.summary.averageTimePerQuestion,
        bySubject: Object.fromEntries(
          Object.keys(questionsBySubject).map((subject) => {
            const subjectQuestions = questionsBySubject[subject];
            const totalTime = subjectQuestions.reduce(
              (sum, q) => sum + (q.studentAnswer.timeSpent || 0),
              0,
            );
            const avgTime =
              subjectQuestions.filter((q) => q.studentAnswer.timeSpent).length >
              0
                ? totalTime /
                  subjectQuestions.filter((q) => q.studentAnswer.timeSpent)
                    .length
                : 0;
            return [subject, { total: totalTime, average: avgTime }];
          }),
        ),
      },
      recommendations: this.generatePaperRecommendations(
        testSession,
        strongTopics,
        weakTopics,
      ),
    };

    res.json({
      success: true,
      questionPaper,
    });
  } catch (error) {
    console.error("Error generating question paper:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Generate recommendations based on paper analysis
 */
exports.generatePaperRecommendations = (
  testSession,
  strongTopics,
  weakTopics,
) => {
  const recommendations = [];

  // Topic-based recommendations
  weakTopics.slice(0, 3).forEach((topic) => {
    recommendations.push({
      type: "weakness",
      priority: "high",
      topic: topic.concept,
      message: `Focus on improving ${topic.concept} (${Math.round(topic.accuracy)}% accuracy)`,
      action: `Practice more questions in ${topic.concept} and review fundamental concepts`,
    });
  });

  strongTopics.slice(0, 2).forEach((topic) => {
    recommendations.push({
      type: "strength",
      priority: "low",
      topic: topic.concept,
      message: `Strong performance in ${topic.concept} (${Math.round(topic.accuracy)}% accuracy)`,
      action: `Ready for advanced topics in ${topic.concept}`,
    });
  });

  // Time management recommendations
  if (testSession.summary.averageTimePerQuestion > 90) {
    recommendations.push({
      type: "speed",
      priority: "medium",
      message: "Work on improving your speed",
      action:
        "Practice timed sessions and focus on quicker problem-solving techniques",
    });
  }

  // Accuracy recommendations
  if (testSession.summary.accuracy < 40) {
    recommendations.push({
      type: "accuracy",
      priority: "high",
      message: "Focus on accuracy before speed",
      action: "Take untimed practice tests and review explanations carefully",
    });
  } else if (testSession.summary.accuracy > 80) {
    recommendations.push({
      type: "challenge",
      priority: "medium",
      message: "Great accuracy! Time to increase difficulty",
      action: "Try more challenging questions in your weak areas",
    });
  }

  // Difficulty-based recommendations
  if (
    testSession.testConfig.difficulty < 0.4 &&
    testSession.summary.accuracy > 70
  ) {
    recommendations.push({
      type: "progression",
      priority: "medium",
      message: "You're ready for harder questions",
      action: "Increase difficulty level in your next practice session",
    });
  }

  return recommendations;
};

/**
 * Export test as PDF (simplified - returns JSON that frontend can format)
 */
exports.exportTestPDF = async (req, res) => {
  try {
    const { sessionId } = req.params;

    // First generate the question paper
    const questionPaper = await this.generateQuestionPaper(
      { params: { sessionId } },
      {
        json: (data) => data,
      },
    );

    res.json({
      success: true,
      exportData: questionPaper.questionPaper,
      format: "pdf-ready",
    });
  } catch (error) {
    console.error("Error exporting PDF:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get detailed topic-wise time analysis
 */
exports.getTopicTimeAnalysis = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const testSession = await TestSession.findOne({ sessionId });

    if (!testSession) {
      return res.status(404).json({
        success: false,
        error: "Test session not found",
      });
    }

    const topicTimeMap = {};

    testSession.answers.forEach((answer) => {
      const topic = answer.topic || answer.conceptArea || "general";

      if (!topicTimeMap[topic]) {
        topicTimeMap[topic] = {
          totalTime: 0,
          count: 0,
          correctCount: 0,
          totalMarks: 0,
          obtainedMarks: 0,
        };
      }

      topicTimeMap[topic].totalTime += answer.timeSpent || 0;
      topicTimeMap[topic].count += 1;
      if (answer.isCorrect) topicTimeMap[topic].correctCount += 1;
      topicTimeMap[topic].obtainedMarks += answer.marksObtained || 0;

      const question = testSession.questions.find(
        (q) => q._id === answer.questionId,
      );
      if (question) {
        topicTimeMap[topic].totalMarks += question.marks || 0;
      }
    });

    const topicAnalysis = Object.entries(topicTimeMap).map(([topic, data]) => ({
      topic,
      totalTime: data.totalTime,
      averageTime: data.totalTime / data.count,
      questionsAttempted: data.count,
      correctCount: data.correctCount,
      accuracy: (data.correctCount / data.count) * 100,
      marksObtained: data.obtainedMarks,
      totalMarks: data.totalMarks,
      percentage:
        data.totalMarks > 0 ? (data.obtainedMarks / data.totalMarks) * 100 : 0,
      status:
        data.correctCount / data.count > 0.7
          ? "strong"
          : data.correctCount / data.count < 0.4
            ? "weak"
            : "average",
    }));

    // Sort by time spent (most time first)
    topicAnalysis.sort((a, b) => b.totalTime - a.totalTime);

    res.json({
      success: true,
      topicAnalysis,
      totalTime: testSession.summary.totalTimeSpent,
      averageTimePerQuestion: testSession.summary.averageTimePerQuestion,
    });
  } catch (error) {
    console.error("Error getting topic time analysis:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
/**
 * Refill questions for practice mode - called by socket when running low
 */
exports.refillQuestions = async (sessionId, excludeIds = [], selectedTopics = [], selectedCourseIds = [], difficulty = 0.5) => {
  try {
    console.log("[testController.refillQuestions] Refilling questions...");
    console.log("[testController.refillQuestions] selectedCourseIds:", selectedCourseIds);
    console.log("[testController.refillQuestions] selectedTopics:", selectedTopics);
    console.log("[testController.refillQuestions] difficulty:", difficulty);
    console.log("[testController.refillQuestions] excludeIds count:", excludeIds.length);

    let newQuestions = [];

    // Try MongoDB first if courseIds are provided
    if (selectedCourseIds && selectedCourseIds.length > 0) {
      try {
        const allQuestions = await fetchQuestionsFromCourses(
          selectedCourseIds,
          selectedTopics,
          difficulty,
          30 // Fetch 30 at a time
        );

        // Filter out excluded questions
        const excludeSet = new Set(excludeIds.map(id => String(id)));
        const filteredQuestions = allQuestions.filter(q => {
          const qId = String(q._id || q.questionId);
          return !excludeSet.has(qId);
        });

        newQuestions = filteredQuestions.map((q) => ({
          _id: createSessionQuestionId(q._id || q.questionId),
          text: q.text,
          type: q.type || "MCQ",
          difficulty: q.difficulty || 0.5,
          difficultyLevel: q.difficulty_level || "medium",
          options: q.options || [],
          correctAnswer: q.correct_answer,
          explanation: q.explanation || "",
          solutionSteps: q.solution_steps || [],
          conceptArea: q.topic || selectedTopics[0] || "general",
          topic: q.topic || selectedTopics[0] || "general",
          marks: q.marks || 4,
          expectedTime: q.expected_time || 120,
          metadata: {
            generatedAt: new Date(),
            tags: q.tags || [],
            sourceQuestionId: q._id || q.questionId,
            fromCourseQuestionBank: true,
          },
        }));

        console.log("[testController.refillQuestions] MongoDB returned", newQuestions.length, "new questions");
      } catch (err) {
        console.error("[testController.refillQuestions] MongoDB fetch error:", err);
      }
    }

    // Fallback to questionBankService if no MongoDB questions
    if (newQuestions.length === 0) {
      console.log("[testController.refillQuestions] Falling back to questionBankService");
      newQuestions = questionBankService
        .getPracticeQuestions(difficulty, 30, excludeIds, selectedTopics)
        .map((q) => ({
          _id: createSessionQuestionId(q.questionId),
          text: q.text,
          type: q.type || "MCQ",
          difficulty: q.difficulty || 0.5,
          difficultyLevel: q.difficultyLevel || "medium",
          options: q.options || [],
          correctAnswer: q.correct_answer || q.correctAnswer,
          explanation: q.explanation || "",
          solutionSteps: q.solutionSteps || [],
          conceptArea: q.conceptArea || q.topic || "general",
          topic: q.topic || "general",
          marks: q.marks || 4,
          expectedTime: q.expectedTime || 120,
          metadata: {
            generatedAt: new Date(),
            sourceQuestionId: q.questionId || null,
          },
        }));
    }

    console.log("[testController.refillQuestions] Total new questions:", newQuestions.length);
    return newQuestions;
  } catch (error) {
    console.error("[testController.refillQuestions] Error:", error);
    return [];
  }
};