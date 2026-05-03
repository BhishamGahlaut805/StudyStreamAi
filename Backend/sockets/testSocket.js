const flaskApiService = require("../Services/flaskAPIService");
const questionBankService = require("../Services/questionBankService");
const { v4: uuidv4 } = require("uuid");
const mongoose = require("mongoose");
const CourseQuestionBank = require("../models/Question/questionAdaptationSchema");

const SOCKET_EVENTS = {
  JOIN_TEST: "join-test",
  TEST_JOINED: "test-joined",
  SUBMIT_ANSWER: "submit-answer",
  ANSWER_CONFIRMED: "answer-confirmed",
  ANSWER_PROCESSED: "answer-processed",
  NEXT_QUESTION: "next-question",
  NEXT_QUESTION_RECEIVED: "next-question-received",
  NO_MORE_QUESTIONS: "no-more-questions",
  PAUSE_TEST: "pause-test",
  TEST_PAUSED: "test-paused",
  RESUME_TEST: "resume-test",
  TEST_RESUMED: "test-resumed",
  SKIP_QUESTION: "skip-question",
  QUESTION_SKIPPED: "question-skipped",
  END_TEST: "end-test",
  TEST_ENDED: "test-ended",
  TEST_COMPLETED: "test-completed",
  TEST_TIMEOUT: "test-timeout",
  REQUEST_ANALYTICS: "request-analytics",
  ANALYTICS_UPDATE: "analytics-update",
  ERROR: "error",
  QUESTIONS_UPDATED: "questions-updated",
  ADD_QUESTIONS: "add-questions",
  QUESTIONS_ADDED: "questions-added",
};

const createSessionQuestionId = (sourceId = null) => {
  const safeSource = sourceId ? String(sourceId) : "q";
  return `${safeSource}_${uuidv4()}`;
};

/**
 * Fetch a single question from MongoDB CourseQuestionBank based on difficulty and topics
 */
const fetchQuestionFromCourses = async (
  courseIds,
  selectedTopics,
  difficulty,
  excludeIds = [],
) => {
  try {
    if (!courseIds || courseIds.length === 0) {
      return null;
    }

    // Convert courseIds to MongoDB ObjectIds
    const objectIds = courseIds
      .map((id) => {
        try {
          return mongoose.Types.ObjectId.isValid(id)
            ? mongoose.Types.ObjectId(id)
            : null;
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean);

    if (objectIds.length === 0) {
      return null;
    }

    // Query question banks for selected courses
    const questionBanks = await CourseQuestionBank.find({
      course: { $in: objectIds },
    }).lean();

    if (!questionBanks || questionBanks.length === 0) {
      return null;
    }

    let candidateQuestions = [];

    for (const bank of questionBanks) {
      if (!bank.questions || bank.questions.length === 0) continue;

      // Filter by excluded IDs
      let filtered = bank.questions.filter(
        (q) =>
          !excludeIds.includes(String(q._id)) &&
          !excludeIds.includes(String(q.questionId)),
      );

      // Filter by selected topics if provided
      if (selectedTopics && selectedTopics.length > 0) {
        filtered = filtered.filter((q) => selectedTopics.includes(q.topic));
      }

      // Filter by difficulty range (±0.2 tolerance)
      if (typeof difficulty === "number") {
        const difficultyMargin = 0.2;
        filtered = filtered.filter((q) => {
          const qDifficulty = q.difficulty || 0.5;
          return Math.abs(qDifficulty - difficulty) <= difficultyMargin;
        });
      }

      candidateQuestions = candidateQuestions.concat(filtered);
    }

    if (candidateQuestions.length === 0) {
      return null;
    }

    // Get random question from candidates
    const randomIndex = Math.floor(Math.random() * candidateQuestions.length);
    return candidateQuestions[randomIndex];
  } catch (error) {
    console.error("Error fetching question from courses:", error);
    return null;
  }
};

/**
 * Fetch multiple questions from MongoDB CourseQuestionBank based on difficulty and topics
 * Robust implementation with multiple fallback strategies for infinite practice
 */
const fetchQuestionsFromCourses = async (
  courseIds,
  selectedTopics,
  difficulty,
  batchSize = 10,
  excludeIds = [],
) => {
  try {
    console.log(
      "\n========== [testSocket.fetchQuestionsFromCourses] START ==========",
    );
    console.log("[testSocket.fetchQuestionsFromCourses] Input params:");
    console.log("  - courseIds:", courseIds);
    console.log("  - selectedTopics:", selectedTopics);
    console.log("  - difficulty:", difficulty);
    console.log("  - batchSize:", batchSize);
    console.log("  - excludeIds count:", excludeIds.length);

    if (!courseIds || courseIds.length === 0) {
      console.log(
        "[testSocket.fetchQuestionsFromCourses] RETURN: No courseIds provided",
      );
      return [];
    }

    // Convert courseIds to MongoDB ObjectIds with detailed logging
    console.log(
      "[testSocket.fetchQuestionsFromCourses] Converting courseIds to ObjectIds...",
    );
    const objectIds = courseIds
      .map((id) => {
        try {
          if (mongoose.Types.ObjectId.isValid(id)) {
            const objId = new mongoose.Types.ObjectId(id);
            console.log(`  ✓ Converted ${id} -> ${objId}`);
            return objId;
          }
          console.warn(`  ✗ Invalid courseId format: ${id}`);
          return null;
        } catch (e) {
          console.error(`  ✗ Error converting courseId ${id}:`, e.message);
          return null;
        }
      })
      .filter(Boolean);

    if (objectIds.length === 0) {
      console.log(
        "[testSocket.fetchQuestionsFromCourses] RETURN: No valid ObjectIds after conversion",
      );
      return [];
    }

    console.log(
      `[testSocket.fetchQuestionsFromCourses] Successfully converted ${objectIds.length} courseIds`,
    );

    // Query all question banks for the selected courses
    console.log(
      "[testSocket.fetchQuestionsFromCourses] Querying MongoDB CourseQuestionBank...",
    );
    const questionBanks = await CourseQuestionBank.find({
      course: { $in: objectIds },
    }).lean();

    console.log(
      `[testSocket.fetchQuestionsFromCourses] Found ${questionBanks.length} question bank(s)`,
    );

    let allQuestions = [];
    let totalQuestionsInBanks = 0;

    // Process each question bank
    for (let i = 0; i < questionBanks.length; i++) {
      const bank = questionBanks[i];
      console.log(
        `\n[testSocket.fetchQuestionsFromCourses] Processing bank ${i + 1}/${questionBanks.length}`,
      );
      console.log(`  - Subject: ${bank.subject}`);
      console.log(
        `  - Total questions in bank: ${bank.questions?.length || 0}`,
      );

      if (!bank.questions || bank.questions.length === 0) {
        console.log(`  ⚠ Bank has no questions, skipping`);
        continue;
      }

      totalQuestionsInBanks += bank.questions.length;

      // STEP 1: Filter by excluded IDs (already asked)
      let filtered = bank.questions.filter((q) => {
        const qId = String(q._id || q.questionId);
        const isExcluded = excludeIds.includes(qId);
        return !isExcluded;
      });

      console.log(
        `  Step 1 (exclude already asked): ${bank.questions.length} → ${filtered.length}`,
      );

      // STEP 2: Filter by selected topics (if provided)
      if (selectedTopics && selectedTopics.length > 0) {
        const beforeTopic = filtered.length;
        filtered = filtered.filter((q) => {
          const qTopic = q.topic || q.concept_area || "General";
          return selectedTopics.some(
            (t) => t && qTopic.toLowerCase().includes(t.toLowerCase()),
          );
        });
        console.log(
          `  Step 2 (filter by topics [${selectedTopics.join(", ")}]): ${beforeTopic} → ${filtered.length}`,
        );
      }

      // STEP 3: Filter by difficulty level - MULTI-STRATEGY APPROACH
      if (typeof difficulty === "number") {
        const beforeDifficulty = filtered.length;
        let difficultyFiltered = [];

        // Strategy 1: Strict range (±0.15)
        const strictMargin = 0.15;
        difficultyFiltered = filtered.filter((q) => {
          const qDifficulty = q.difficulty || 0.5;
          return Math.abs(qDifficulty - difficulty) <= strictMargin;
        });

        console.log(
          `  Step 3a (difficulty ${difficulty}±${strictMargin}): ${beforeDifficulty} → ${difficultyFiltered.length}`,
        );

        // Strategy 2: If strict failed, use medium range (±0.3)
        if (difficultyFiltered.length < batchSize / 2) {
          const mediumMargin = 0.3;
          difficultyFiltered = filtered.filter((q) => {
            const qDifficulty = q.difficulty || 0.5;
            return Math.abs(qDifficulty - difficulty) <= mediumMargin;
          });
          console.log(
            `  Step 3b (difficulty ${difficulty}±${mediumMargin} fallback): ${beforeDifficulty} → ${difficultyFiltered.length}`,
          );
        }

        // Strategy 3: If still not enough, use all questions from this bank
        if (difficultyFiltered.length < batchSize / 4) {
          console.log(
            `  Step 3c (returning all available): ${difficultyFiltered.length} → ${filtered.length} questions`,
          );
          difficultyFiltered = filtered;
        }

        filtered = difficultyFiltered;
      }

      allQuestions = allQuestions.concat(filtered);
      console.log(
        `  ✓ Added ${filtered.length} questions from this bank (total so far: ${allQuestions.length})`,
      );
    }

    console.log(
      `\n[testSocket.fetchQuestionsFromCourses] Aggregation complete:`,
    );
    console.log(`  - Total questions in all banks: ${totalQuestionsInBanks}`);
    console.log(`  - After filtering: ${allQuestions.length}`);
    console.log(`  - Excluded IDs: ${excludeIds.length}`);
    console.log(`  - Requested batch size: ${batchSize}`);

    // If we got some questions, shuffle and return the requested batch
    if (allQuestions.length > 0) {
      // Shuffle using Fisher-Yates algorithm for better randomization
      for (let i = allQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
      }

      // Sort by difficulty level for organized presentation
      allQuestions.sort((a, b) => {
        const aDiff = a.difficulty || 0.5;
        const bDiff = b.difficulty || 0.5;
        return aDiff - bDiff;
      });

      const finalQuestions = allQuestions.slice(0, batchSize);
      console.log(
        `[testSocket.fetchQuestionsFromCourses] ✓ RETURNING ${finalQuestions.length} questions (sorted by difficulty)`,
      );

      if (finalQuestions.length > 0) {
        console.log(
          `  - First question: "${finalQuestions[0].text?.substring(0, 60)}..."`,
        );
        console.log(
          `  - Difficulty range: ${(finalQuestions[0].difficulty || 0.5).toFixed(2)} to ${(finalQuestions[finalQuestions.length - 1].difficulty || 0.5).toFixed(2)}`,
        );
      }

      console.log(
        "========== [testSocket.fetchQuestionsFromCourses] END (SUCCESS) ==========\n",
      );
      return finalQuestions;
    } else {
      console.log(
        "[testSocket.fetchQuestionsFromCourses] ✗ RETURN: No questions available after filtering",
      );
      console.log(
        "========== [testSocket.fetchQuestionsFromCourses] END (EMPTY) ==========\n",
      );
      return [];
    }
  } catch (error) {
    console.error(
      "[testSocket.fetchQuestionsFromCourses] ✗✗✗ CRITICAL ERROR:",
      error.message,
    );
    console.error(
      "[testSocket.fetchQuestionsFromCourses] Stack trace:",
      error.stack,
    );
    console.log(
      "========== [testSocket.fetchQuestionsFromCourses] END (ERROR) ==========\n",
    );
    return [];
  }
};

/**
 * Fetch questions from ALL CourseQuestionBanks by selected topics
 * Used when courseIds are not available but topics are selected
 */
const fetchQuestionsByTopics = async (
  selectedTopics,
  difficulty,
  batchSize = 60,
  excludeIds = [],
) => {
  try {
    console.log(
      "\n========== [testSocket.fetchQuestionsByTopics] START ==========",
    );
    console.log("[testSocket.fetchQuestionsByTopics] Input params:");
    console.log("  - selectedTopics:", selectedTopics);
    console.log("  - difficulty:", difficulty);
    console.log("  - batchSize:", batchSize);
    console.log("  - excludeIds count:", excludeIds.length);

    if (!selectedTopics || selectedTopics.length === 0) {
      console.log(
        "[testSocket.fetchQuestionsByTopics] RETURN: No topics provided",
      );
      return [];
    }

    // Query ALL question banks (no course filter)
    console.log(
      "[testSocket.fetchQuestionsByTopics] Querying ALL CourseQuestionBanks...",
    );
    const questionBanks = await CourseQuestionBank.find({}).lean();

    console.log(
      `[testSocket.fetchQuestionsByTopics] Found ${questionBanks.length} total question bank(s)`,
    );

    let allQuestions = [];
    let totalQuestionsInBanks = 0;

    // Process each question bank
    for (let i = 0; i < questionBanks.length; i++) {
      const bank = questionBanks[i];

      if (!bank.questions || bank.questions.length === 0) {
        continue;
      }

      totalQuestionsInBanks += bank.questions.length;
      console.log(
        `Processing bank ${i + 1}/${questionBanks.length}: ${bank.subject} (${bank.questions.length} questions)`,
      );

      // STEP 1: Filter by excluded IDs
      let filtered = bank.questions.filter((q) => {
        const qId = String(q._id || q.questionId);
        return !excludeIds.includes(qId);
      });

      // STEP 2: Filter by selected topics (REQUIRED)
      const beforeTopic = filtered.length;
      filtered = filtered.filter((q) => {
        const qTopic = q.topic || q.concept_area || "General";
        return selectedTopics.some(
          (t) => t && qTopic.toLowerCase().includes(t.toLowerCase()),
        );
      });

      if (filtered.length > 0) {
        console.log(
          `  ✓ After topic filter: ${beforeTopic} → ${filtered.length} questions`,
        );
      }

      // STEP 3: Filter by difficulty level - MULTI-STRATEGY
      if (typeof difficulty === "number" && filtered.length > 0) {
        let difficultyFiltered = [];

        // Strategy 1: Strict range (±0.15)
        const strictMargin = 0.15;
        difficultyFiltered = filtered.filter((q) => {
          const qDifficulty = q.difficulty || 0.5;
          return Math.abs(qDifficulty - difficulty) <= strictMargin;
        });

        // Strategy 2: Medium range (±0.3) if strict insufficient
        if (difficultyFiltered.length < batchSize / 2) {
          const mediumMargin = 0.3;
          difficultyFiltered = filtered.filter((q) => {
            const qDifficulty = q.difficulty || 0.5;
            return Math.abs(qDifficulty - difficulty) <= mediumMargin;
          });
        }

        // Strategy 3: All questions if still insufficient
        if (difficultyFiltered.length < batchSize / 4) {
          difficultyFiltered = filtered;
        }

        filtered = difficultyFiltered;
      }

      allQuestions = allQuestions.concat(filtered);
    }

    console.log(`\n[testSocket.fetchQuestionsByTopics] Aggregation complete:`);
    console.log(`  - Total questions in all banks: ${totalQuestionsInBanks}`);
    console.log(`  - After filtering: ${allQuestions.length}`);
    console.log(`  - Requested batch size: ${batchSize}`);

    // Shuffle and return
    if (allQuestions.length > 0) {
      // Fisher-Yates shuffle
      for (let i = allQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
      }

      // Sort by difficulty
      allQuestions.sort((a, b) => {
        const aDiff = a.difficulty || 0.5;
        const bDiff = b.difficulty || 0.5;
        return aDiff - bDiff;
      });

      const finalQuestions = allQuestions.slice(0, batchSize);
      console.log(
        `✓ RETURNING ${finalQuestions.length} questions (sorted by difficulty)`,
      );
      console.log(
        "========== [testSocket.fetchQuestionsByTopics] END (SUCCESS) ==========\n",
      );
      return finalQuestions;
    } else {
      console.log("✗ RETURN: No questions available");
      console.log(
        "========== [testSocket.fetchQuestionsByTopics] END (EMPTY) ==========\n",
      );
      return [];
    }
  } catch (error) {
    console.error(
      "[testSocket.fetchQuestionsByTopics] ✗✗✗ CRITICAL ERROR:",
      error.message,
    );
    console.error("[testSocket.fetchQuestionsByTopics] Stack:", error.stack);
    console.log(
      "========== [testSocket.fetchQuestionsByTopics] END (ERROR) ==========\n",
    );
    return [];
  }
};

const initializeTestSocket = (io, timerService, analyticsService) => {
  const testNamespace = io.of("/test");

  testNamespace.on("connection", (socket) => {
    console.log(`Test client connected: ${socket.id}`);

    // Join test session
    socket.on(SOCKET_EVENTS.JOIN_TEST, async ({ sessionId, studentId }) => {
      try {
        socket.join(`test:${sessionId}`);
        socket.data.sessionId = sessionId;
        socket.data.studentId = studentId;

        const TestSession = require("../models/TestSession");
        const session = await TestSession.findOne({ sessionId });

        if (session) {
          const elapsedSessionSeconds = Math.max(
            0,
            Math.floor(
              (Date.now() - new Date(session.startTime).getTime()) / 1000,
            ),
          );
          const activeQuestion =
            session.questions?.[session.currentQuestionIndex] || null;

          let flaskStatus = null;
          if (session.flaskSessionId) {
            try {
              flaskStatus = await flaskApiService.getSessionStatus(
                session.flaskSessionId,
              );
            } catch (error) {
              console.error("Error getting Flask status:", error.message);
            }
          }

          socket.emit(SOCKET_EVENTS.TEST_JOINED, {
            sessionId,
            testType: session.testType,
            status: session.status,
            currentQuestionIndex: session.currentQuestionIndex,
            timeRemaining: session.timeRemaining,
            totalQuestions: session.questions.length,
            config: session.testConfig,
            flaskEnabled: !!session.flaskSessionId,
            flaskStatus,
            elapsedSessionSeconds,
            currentQuestion: activeQuestion
              ? {
                  id: activeQuestion._id,
                  text: activeQuestion.text,
                  type: activeQuestion.type,
                  difficulty: activeQuestion.difficulty,
                  difficultyLevel: activeQuestion.difficultyLevel,
                  options:
                    activeQuestion.type !== "NAT"
                      ? activeQuestion.options
                      : undefined,
                  conceptArea: activeQuestion.conceptArea,
                  topic: activeQuestion.topic,
                  marks: activeQuestion.marks,
                  expectedTime: activeQuestion.expectedTime,
                }
              : null,
          });

          const analytics =
            analyticsService.calculateRealtimeAnalytics(session);
          socket.emit(SOCKET_EVENTS.ANALYTICS_UPDATE, analytics);

          // Start timer for real exam
          if (
            session.testType === "real" &&
            session.status === "active" &&
            session.timeRemaining > 0
          ) {
            timerService.startSessionTimer(
              sessionId,
              session.timeRemaining,
              async (sid) => {
                const testSession = await TestSession.findOne({
                  sessionId: sid,
                });
                if (testSession && testSession.status === "active") {
                  testSession.status = "completed";
                  testSession.endTime = new Date();
                  testSession.calculateSummary();
                  await testSession.save();

                  if (testSession.flaskSessionId) {
                    try {
                      await flaskApiService.completeTestSession(
                        testSession.flaskSessionId,
                      );
                    } catch (error) {
                      console.error(
                        "Error completing Flask session:",
                        error.message,
                      );
                    }
                  }

                  testNamespace
                    .to(`test:${sid}`)
                    .emit(SOCKET_EVENTS.TEST_TIMEOUT, {
                      sessionId: sid,
                      message: "Test time is up!",
                    });

                  const finalAnalytics =
                    analyticsService.calculateRealtimeAnalytics(testSession);
                  testNamespace
                    .to(`test:${sid}`)
                    .emit(SOCKET_EVENTS.TEST_COMPLETED, {
                      sessionId: sid,
                      summary: testSession.summary,
                      analytics: finalAnalytics,
                    });
                }
              },
            );
          } else if (session.testType === "practice") {
            timerService.startPracticeMode(sessionId, session.startTime);
          }
        }

        console.log(`Student ${studentId} joined test ${sessionId}`);
      } catch (error) {
        console.error("Error joining test:", error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: error.message });
      }
    });

    // Submit answer
    socket.on(
      SOCKET_EVENTS.SUBMIT_ANSWER,
      async ({ sessionId, questionId, answerData }) => {
        try {
          const TestSession = require("../models/TestSession");
          const StudentPerformance = require("../models/studentPerformance");

          const testSession = await TestSession.findOne({ sessionId });

          if (!testSession) {
            socket.emit(SOCKET_EVENTS.ERROR, {
              message: "Test session not found",
            });
            return;
          }

          const question =
            testSession.questions.id(questionId) ||
            testSession.questions.find(
              (q) => String(q._id) === String(questionId),
            );

          if (!question) {
            socket.emit(SOCKET_EVENTS.ERROR, { message: "Question not found" });
            return;
          }

          const isCorrect = analyticsService.checkAnswer(
            question,
            answerData.selectedOptions,
          );
          const marksObtained = isCorrect ? question.marks || 1 : 0;

          const answer = {
            questionId,
            questionText: question.text,
            selectedOptions: answerData.selectedOptions,
            isCorrect,
            marksObtained,
            timeSpent: answerData.timeSpent || 0,
            answerChanges: answerData.answerChanges || 0,
            confidence: answerData.confidence || 0.5,
            conceptArea: question.conceptArea,
            difficulty: question.difficulty,
            difficultyLevel: question.difficultyLevel,
            submittedAt: new Date(),
          };

          testSession.addAnswer(answer);

          // Check if test is complete
          if (testSession.testType === "real" && testSession.isComplete()) {
            testSession.endTest();

            let performance = await StudentPerformance.findOne({
              studentId: testSession.studentId,
            });
            if (!performance) {
              performance = new StudentPerformance({
                studentId: testSession.studentId,
              });
            }
            performance.updateWithTestSession(testSession);
            performance.calculateAnalytics();
            await performance.save();

            if (testSession.flaskSessionId) {
              try {
                await flaskApiService.completeTestSession(
                  testSession.flaskSessionId,
                );

                // Upload attempts to Flask for model training
                const features = analyticsService.extractFeaturesFromAnswers(
                  testSession.answers,
                  testSession.questions,
                );
                await flaskApiService.uploadAttempts(
                  testSession.studentId,
                  features,
                );
              } catch (error) {
                console.error("Error completing Flask session:", error.message);
              }
            }

            timerService.clearSessionTimer(sessionId);
          }

          await testSession.save();

          const analytics =
            analyticsService.calculateRealtimeAnalytics(testSession);

          socket.emit(SOCKET_EVENTS.ANSWER_CONFIRMED, {
            sessionId,
            questionId,
            isCorrect,
            marksObtained,
            correctAnswer: question.correctAnswer,
            explanation: question.explanation,
            solutionSteps: question.solutionSteps,
            currentQuestionIndex: testSession.currentQuestionIndex,
            analytics,
          });

          testNamespace
            .to(`test:${sessionId}`)
            .emit(SOCKET_EVENTS.ANSWER_PROCESSED, {
              sessionId,
              questionId,
              isCorrect,
              currentQuestionIndex: testSession.currentQuestionIndex,
              analytics,
            });

          if (testSession.status === "completed") {
            testNamespace
              .to(`test:${sessionId}`)
              .emit(SOCKET_EVENTS.TEST_COMPLETED, {
                sessionId,
                summary: testSession.summary,
                analytics,
              });
          }
        } catch (error) {
          console.error("Error processing answer:", error);
          socket.emit(SOCKET_EVENTS.ERROR, { message: error.message });
        }
      },
    );

    // Request next question
    socket.on(
      SOCKET_EVENTS.NEXT_QUESTION,
      async ({ sessionId, requestedDifficulty, difficultyWindowRemaining }) => {
        try {
          const TestSession = require("../models/TestSession");
          const testSession = await TestSession.findOne({ sessionId });

          if (!testSession) {
            socket.emit(SOCKET_EVENTS.ERROR, {
              message: "Test session not found",
            });
            return;
          }

          // For practice mode, check if we need more questions
          let appliedDifficulty = null;
          const hasRequestedDifficulty = Number.isFinite(
            Number(requestedDifficulty),
          );
          const requestedDifficultyValue = hasRequestedDifficulty
            ? clampDifficulty(Number(requestedDifficulty))
            : null;

          if (testSession.testType === "practice" && hasRequestedDifficulty) {
            appliedDifficulty = requestedDifficultyValue;
            testSession.testConfig = testSession.testConfig || {};
            testSession.testConfig.difficulty = requestedDifficultyValue;
          }

          if (testSession.testType === "practice") {
            const selectedTopics = testSession.testConfig?.selectedTopics || [];
            const selectedCourseIds =
              testSession.testConfig?.selectedCourseIds || [];
            const remainingQuestions =
              testSession.questions.length - testSession.currentQuestionIndex;

            // Define nextDifficulty BEFORE diagnostics logging
            let nextDifficulty = testSession.testConfig.difficulty || 0.5;
            if (hasRequestedDifficulty) {
              nextDifficulty = requestedDifficultyValue;
            }

            console.log(
              "\n========== [testSocket REFILL DIAGNOSTICS] ==========",
            );
            console.log(`Session ID: ${sessionId}`);
            console.log(
              `Current Question Index: ${testSession.currentQuestionIndex}`,
            );
            console.log(
              `Total Questions Loaded: ${testSession.questions.length}`,
            );
            console.log(`Remaining Questions: ${remainingQuestions}`);
            console.log(
              `Selected Topics: ${selectedTopics.join(", ") || "(none)"}`,
            );
            console.log(
              `Selected Course IDs: ${selectedCourseIds.join(", ") || "(none)"}`,
            );
            console.log(`Current Difficulty: ${nextDifficulty}`);
            console.log(
              `Will Refill: ${remainingQuestions < 15 ? "YES (< 15)" : "NO"}`,
            );
            console.log("================================================\n");

            // Always ensure we have at least 15 questions ahead for smooth infinite practice
            // This is more aggressive to prevent running out of questions
            if (remainingQuestions < 15) {
              try {
                const recentResponses = testSession.answers
                  .slice(-5)
                  .map((a) => ({
                    question_id: a.questionId,
                    correct: a.isCorrect,
                    time_spent: a.timeSpent,
                    answer_changes: a.answerChanges || 0,
                    confidence: a.confidence || 0.5,
                    concept_area: a.conceptArea,
                    difficulty: a.difficulty,
                  }));

                let newQuestions = [];

                // Get exclude IDs from already loaded questions - using sourceQuestionId for uniqueness
                const excludeIds = testSession.questions
                  .map((q) => {
                    // Priority: use sourceQuestionId from metadata, fallback to _id
                    const sourceId = q?.metadata?.sourceQuestionId;
                    const qId = q?._id;
                    return sourceId || qId;
                  })
                  .filter(Boolean);

                console.log(
                  `[testSocket REFILL] Attempting to fetch more questions...`,
                );
                console.log(
                  `[testSocket REFILL] Exclude IDs count: ${excludeIds.length}`,
                );

                // Try to fetch from MongoDB CourseQuestionBank first
                if (selectedCourseIds && selectedCourseIds.length > 0) {
                  try {
                    console.log(
                      `[testSocket REFILL] Fetching ${Math.max(15, Math.ceil(remainingQuestions * 2))} questions from MongoDB...`,
                    );

                    // Fetch more questions than needed to have buffer
                    const courseQuestions = await fetchQuestionsFromCourses(
                      selectedCourseIds,
                      selectedTopics,
                      nextDifficulty,
                      Math.max(15, Math.ceil(remainingQuestions * 2)), // Fetch 2x what we need
                      excludeIds,
                    );

                    if (courseQuestions && courseQuestions.length > 0) {
                      console.log(
                        `[testSocket REFILL] ✓ Successfully fetched ${courseQuestions.length} questions from MongoDB`,
                      );

                      newQuestions = courseQuestions.map((courseQuestion) => ({
                        _id: createSessionQuestionId(
                          courseQuestion._id || courseQuestion.questionId,
                        ),
                        text: courseQuestion.text,
                        type: courseQuestion.type || "MCQ",
                        difficulty: courseQuestion.difficulty || 0.5,
                        difficultyLevel:
                          courseQuestion.difficulty_level ||
                          mapDifficultyLevel(courseQuestion.difficulty || 0.5),
                        options: courseQuestion.options || [],
                        correctAnswer: courseQuestion.correct_answer,
                        explanation: courseQuestion.explanation || "",
                        solutionSteps: courseQuestion.solution_steps || [],
                        conceptArea: courseQuestion.topic || "general",
                        topic: courseQuestion.topic || "general",
                        marks: courseQuestion.marks || 4,
                        expectedTime: courseQuestion.expected_time || 120,
                        metadata: {
                          sourceQuestionId:
                            courseQuestion._id || courseQuestion.questionId,
                          fromCourseQuestionBank: true,
                          fetchedAt: new Date().toISOString(),
                        },
                      }));
                    } else {
                      console.log(
                        `[testSocket REFILL] ⚠ No questions from MongoDB, will try Flask...`,
                      );
                    }
                  } catch (error) {
                    console.error(
                      "[testSocket REFILL] ✗ Error fetching from MongoDB:",
                      error.message,
                    );
                  }
                } else {
                  console.log(
                    `[testSocket REFILL] ⚠ No selectedCourseIds available, skipping MongoDB fetch`,
                  );
                }

                // Try Flask if no questions from courses
                if (newQuestions.length === 0 && testSession.flaskSessionId) {
                  try {
                    console.log("[testSocket] Fetching from Flask...");
                    const flaskResponse = await Promise.race([
                      flaskApiService.getNextQuestions(
                        testSession.flaskSessionId,
                        recentResponses,
                      ),
                      new Promise((_, reject) =>
                        setTimeout(
                          () =>
                            reject(new Error("Flask next-question timeout")),
                          3500,
                        ),
                      ),
                    ]);

                    if (
                      flaskResponse.success &&
                      flaskResponse.questions?.questions
                    ) {
                      const flaskQuestions = flaskResponse.questions.questions;
                      const filteredFlaskQuestions =
                        Array.isArray(selectedTopics) &&
                        selectedTopics.length > 0
                          ? flaskQuestions.filter((q) =>
                              questionBankService.matchesSelectedTopics(
                                q.topic || q.concept_area,
                                selectedTopics,
                              ),
                            )
                          : flaskQuestions;

                      newQuestions = (
                        filteredFlaskQuestions.length
                          ? filteredFlaskQuestions
                          : flaskQuestions
                      ).map((q) => ({
                        _id: createSessionQuestionId(q.id),
                        text: q.text,
                        type: q.type,
                        difficulty: q.difficulty || 0.5,
                        difficultyLevel: mapDifficultyLevel(
                          q.difficulty || 0.5,
                        ),
                        options: q.options || [],
                        correctAnswer: q.correct_answer,
                        explanation: q.explanation || "",
                        solutionSteps: q.solution_steps || [],
                        hints: q.hints || [],
                        conceptArea: q.concept_area || "general",
                        topic: q.topic || "general",
                        marks: q.marks || 4,
                        expectedTime: q.expected_time || 120,
                        tags: q.tags || [],
                        metadata: {
                          sourceQuestionId: q.id || null,
                        },
                      }));

                      if (!hasRequestedDifficulty) {
                        nextDifficulty =
                          flaskResponse.metadata?.next_difficulty ||
                          nextDifficulty;
                      }
                    }
                  } catch (error) {
                    console.error(
                      "[testSocket] Error fetching from Flask:",
                      error.message,
                    );
                  }
                }

                // Fallback to local questions
                // If no questions from Flask, try by topics (search ALL MongoDB question banks)
                if (newQuestions.length === 0 && selectedTopics.length > 0) {
                  try {
                    console.log(
                      `[testSocket REFILL] Attempting fetchQuestionsByTopics with ${selectedTopics.length} topics...`,
                    );
                    const topicQuestions = await fetchQuestionsByTopics(
                      selectedTopics,
                      nextDifficulty,
                      Math.max(15, Math.ceil(remainingQuestions * 2)),
                      excludeIds,
                    );

                    if (topicQuestions && topicQuestions.length > 0) {
                      console.log(
                        `[testSocket REFILL] ✓ Got ${topicQuestions.length} questions from topics search`,
                      );
                      newQuestions = topicQuestions.map((q) => ({
                        _id: createSessionQuestionId(q._id || q.questionId),
                        text: q.text,
                        type: q.type || "MCQ",
                        difficulty: q.difficulty || 0.5,
                        difficultyLevel:
                          q.difficulty_level ||
                          mapDifficultyLevel(q.difficulty || 0.5),
                        options: q.options || [],
                        correctAnswer: q.correct_answer,
                        explanation: q.explanation || "",
                        solutionSteps: q.solution_steps || [],
                        conceptArea: q.topic || "general",
                        topic: q.topic || "general",
                        marks: q.marks || 4,
                        expectedTime: q.expected_time || 120,
                        metadata: {
                          sourceQuestionId: q._id || q.questionId,
                          fromCourseQuestionBank: true,
                          fetchedAt: new Date().toISOString(),
                        },
                      }));
                    }
                  } catch (error) {
                    console.error(
                      "[testSocket REFILL] Topic fetch error:",
                      error.message,
                    );
                  }
                }

                // Last resort: questionBankService async call
                if (newQuestions.length === 0) {
                  console.log(
                    "[testSocket] Last resort: questionBankService.getNextPracticeQuestion",
                  );
                  const lastAnswer =
                    testSession.answers[testSession.answers.length - 1];
                  const lastCorrect = lastAnswer ? lastAnswer.isCorrect : null;

                  try {
                    const result =
                      await questionBankService.getNextPracticeQuestion(
                        nextDifficulty,
                        lastCorrect,
                        excludeIds,
                        selectedTopics,
                      );

                    if (result.question) {
                      const q = result.question;
                      newQuestions = [
                        {
                          _id: createSessionQuestionId(q.questionId),
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
                          metadata: { sourceQuestionId: q.questionId || null },
                        },
                      ];
                      if (result.nextDifficulty)
                        nextDifficulty = result.nextDifficulty;
                    }
                  } catch (err) {
                    console.error(
                      "[testSocket] questionBankService error:",
                      err.message,
                    );
                  }
                }

                // Log refill attempt summary
                console.log(`\n[testSocket REFILL SUMMARY]`);
                console.log(`Questions fetched: ${newQuestions.length}`);

                if (newQuestions.length > 0) {
                  try {
                    console.log(
                      `[testSocket REFILL] ✓ Adding ${newQuestions.length} questions to session...`,
                    );

                    // Validate all questions before adding
                    const validQuestions = newQuestions.filter((q) => {
                      const isValid = q._id && q.text && q.type;
                      if (!isValid) {
                        console.warn(
                          `[testSocket REFILL] ⚠ Invalid question structure:`,
                          {
                            id: q._id,
                            hasText: !!q.text,
                            type: q.type,
                          },
                        );
                      }
                      return isValid;
                    });

                    console.log(
                      `[testSocket REFILL] Valid questions after validation: ${validQuestions.length}/${newQuestions.length}`,
                    );

                    if (validQuestions.length > 0) {
                      testSession.questions.push(...validQuestions);
                      testSession.testConfig.difficulty = nextDifficulty;
                      appliedDifficulty = nextDifficulty;
                      await testSession.save();

                      console.log(
                        `[testSocket REFILL] ✓✓ Session updated successfully`,
                      );
                      console.log(
                        `[testSocket REFILL] Total questions now: ${testSession.questions.length}`,
                      );
                      console.log(
                        `[testSocket REFILL] Remaining questions: ${testSession.questions.length - testSession.currentQuestionIndex}`,
                      );

                      socket.emit(SOCKET_EVENTS.QUESTIONS_UPDATED, {
                        sessionId,
                        totalQuestions: testSession.questions.length,
                        newQuestionsCount: validQuestions.length,
                        nextDifficulty,
                        currentQuestionIndex: testSession.currentQuestionIndex,
                      });
                    } else {
                      console.warn(
                        `[testSocket REFILL] ⚠ No valid questions to add after validation`,
                      );
                    }
                  } catch (saveError) {
                    console.error(
                      `[testSocket REFILL] ✗✗ Error saving session:`,
                      saveError.message,
                    );
                    console.error(
                      `[testSocket REFILL] Stack:`,
                      saveError.stack,
                    );
                  }
                } else {
                  console.log(
                    `[testSocket REFILL] ⚠ No new questions available from any source`,
                  );
                }
                console.log(
                  `===============================================\n`,
                );
              } catch (error) {
                console.error(
                  "[testSocket REFILL] ✗ Critical error:",
                  error.message,
                );
                console.error("[testSocket REFILL] Stack:", error.stack);
              }
            } else {
              console.log(
                `[testSocket] Practice mode but remainingQuestions >= 15 (${remainingQuestions}), no refill needed`,
              );
            }
          }

          // For practice mode, before declaring no more, try to fetch more questions
          if (
            testSession.testType === "practice" &&
            testSession.currentQuestionIndex >= testSession.questions.length
          ) {
            console.log(
              `\n========== [testSocket END_OF_QUEUE CHECK] ==========`,
            );
            console.log(
              `At question index ${testSession.currentQuestionIndex}, total questions ${testSession.questions.length}`,
            );
            console.log(`Attempting to fetch more...`);

            const selectedTopics = testSession.testConfig?.selectedTopics || [];
            const selectedCourseIds =
              testSession.selectedCourseIds ||
              testSession.testConfig?.selectedCourseIds ||
              [];
            let fetchedMore = false;

            // Try to fetch more questions from MongoDB
            if (selectedCourseIds && selectedCourseIds.length > 0) {
              try {
                const excludeIds = testSession.questions.map(
                  (q) => q?.metadata?.sourceQuestionId || q._id,
                );

                console.log(
                  `[testSocket] Attempting to fetch more questions from MongoDB (currently at index ${testSession.currentQuestionIndex} of ${testSession.questions.length})`,
                );
                const moreQuestions = await fetchQuestionsFromCourses(
                  selectedCourseIds,
                  selectedTopics,
                  testSession.testConfig.difficulty || 0.5,
                  10, // Fetch 10 more questions (increased from 5 for better robustness)
                  excludeIds,
                );

                if (moreQuestions && moreQuestions.length > 0) {
                  // Map and add questions
                  const mappedQuestions = moreQuestions.map((q) => ({
                    _id: createSessionQuestionId(q._id || q.questionId),
                    text: q.text,
                    type: q.type || "MCQ",
                    difficulty: q.difficulty || 0.5,
                    difficultyLevel:
                      q.difficulty_level ||
                      mapDifficultyLevel(q.difficulty || 0.5),
                    options: q.options || [],
                    correctAnswer: q.correct_answer,
                    explanation: q.explanation || "",
                    solutionSteps: q.solution_steps || [],
                    conceptArea: q.topic || "general",
                    topic: q.topic || "general",
                    marks: q.marks || 4,
                    expectedTime: q.expected_time || 120,
                    metadata: {
                      sourceQuestionId: q._id || q.questionId,
                      fromCourseQuestionBank: true,
                    },
                  }));

                  testSession.questions.push(...mappedQuestions);
                  await testSession.save();
                  console.log(
                    `[testSocket] SUCCESS: Fetched ${mappedQuestions.length} more questions from MongoDB. Total questions now: ${testSession.questions.length}`,
                  );
                  fetchedMore = true;
                } else {
                  console.log(
                    `[testSocket] WARNING: MongoDB returned no more questions (may have exhausted available pool)`,
                  );
                }
              } catch (error) {
                console.error(
                  "[testSocket] ERROR fetching more questions from MongoDB:",
                  error.message,
                );
              }
            }

            // If still no more questions after fetch, then declare end
            // If no questions from courses, try by topics
            if (!fetchedMore && selectedTopics.length > 0) {
              try {
                const excludeIds = testSession.questions.map(
                  (q) => q?.metadata?.sourceQuestionId || q._id,
                );
                const moreQuestions = await fetchQuestionsByTopics(
                  selectedTopics,
                  testSession.testConfig.difficulty || 0.5,
                  10,
                  excludeIds,
                );
                if (moreQuestions && moreQuestions.length > 0) {
                  const mappedQuestions = moreQuestions.map((q) => ({
                    _id: createSessionQuestionId(q._id || q.questionId),
                    text: q.text,
                    type: q.type || "MCQ",
                    difficulty: q.difficulty || 0.5,
                    difficultyLevel:
                      q.difficulty_level ||
                      mapDifficultyLevel(q.difficulty || 0.5),
                    options: q.options || [],
                    correctAnswer: q.correct_answer,
                    explanation: q.explanation || "",
                    solutionSteps: q.solution_steps || [],
                    conceptArea: q.topic || "general",
                    topic: q.topic || "general",
                    marks: q.marks || 4,
                    expectedTime: q.expected_time || 120,
                    metadata: {
                      sourceQuestionId: q._id || q.questionId,
                      fromCourseQuestionBank: true,
                    },
                  }));
                  testSession.questions.push(...mappedQuestions);
                  await testSession.save();
                  console.log(
                    `[testSocket] SUCCESS: Got ${mappedQuestions.length} from topics. Total: ${testSession.questions.length}`,
                  );
                  fetchedMore = true;
                }
              } catch (error) {
                console.error("[testSocket] Topic fetch error:", error.message);
              }
            }

            // If still no more questions after fetch, then declare end
            if (
              !fetchedMore &&
              testSession.currentQuestionIndex >= testSession.questions.length
            ) {
              socket.emit(SOCKET_EVENTS.NO_MORE_QUESTIONS, {
                sessionId,
                message: "Practice session complete. Excellent practice!",
                totalQuestions: testSession.questions.length,
              });
              return;
            }
          }

          // Check if all available questions are consumed
          if (
            testSession.currentQuestionIndex >= testSession.questions.length
          ) {
            socket.emit(SOCKET_EVENTS.NO_MORE_QUESTIONS, {
              sessionId,
              message: "No more questions available for this session",
              totalQuestions: testSession.questions.length,
            });
            return;
          }

          if (
            testSession.testType === "practice" &&
            hasRequestedDifficulty &&
            testSession.currentQuestionIndex < testSession.questions.length
          ) {
            const fromIndex = testSession.currentQuestionIndex;
            let bestIndex = fromIndex;
            let bestDelta = Number.POSITIVE_INFINITY;

            for (
              let idx = fromIndex;
              idx < testSession.questions.length;
              idx++
            ) {
              const candidate = testSession.questions[idx];
              const candidateDifficulty = Number(candidate?.difficulty ?? 0.5);
              const delta = Math.abs(
                candidateDifficulty - requestedDifficultyValue,
              );
              if (delta < bestDelta) {
                bestDelta = delta;
                bestIndex = idx;
              }
            }

            if (bestIndex !== fromIndex) {
              const temp = testSession.questions[fromIndex];
              testSession.questions[fromIndex] =
                testSession.questions[bestIndex];
              testSession.questions[bestIndex] = temp;
              await testSession.save();
            }
          }

          const nextQuestion =
            testSession.questions[testSession.currentQuestionIndex];

          if (nextQuestion) {
            const emittedQuestionDifficulty = Number(
              nextQuestion.difficulty ??
                testSession.testConfig?.difficulty ??
                0.5,
            );

            socket.emit(SOCKET_EVENTS.NEXT_QUESTION_RECEIVED, {
              sessionId,
              question: {
                id: nextQuestion._id,
                text: nextQuestion.text,
                type: nextQuestion.type,
                difficulty: nextQuestion.difficulty,
                difficultyLevel: nextQuestion.difficultyLevel,
                options:
                  nextQuestion.type !== "NAT"
                    ? nextQuestion.options
                    : undefined,
                conceptArea: nextQuestion.conceptArea,
                topic: nextQuestion.topic,
                marks: nextQuestion.marks,
                expectedTime: nextQuestion.expectedTime,
                explanation: nextQuestion.explanation || "",
                hints: nextQuestion.hints || [],
                correctAnswer:
                  nextQuestion.correctAnswer || nextQuestion.correct_answer,
                solutionSteps: nextQuestion.solutionSteps || [],
                tags: nextQuestion.tags || [],
              },
              questionNumber: testSession.currentQuestionIndex + 1,
              totalQuestions: testSession.questions.length,
              remainingQuestions:
                testSession.questions.length - testSession.currentQuestionIndex,
              requestedDifficulty:
                hasRequestedDifficulty && requestedDifficultyValue !== null
                  ? requestedDifficultyValue
                  : undefined,
              appliedDifficulty: emittedQuestionDifficulty,
              difficultyWindowRemaining: Number.isFinite(
                Number(difficultyWindowRemaining),
              )
                ? Number(difficultyWindowRemaining)
                : undefined,
            });
          }
        } catch (error) {
          console.error("Error getting next question:", error);
          socket.emit(SOCKET_EVENTS.ERROR, { message: error.message });
        }
      },
    );

    // Pause test
    socket.on(SOCKET_EVENTS.PAUSE_TEST, async ({ sessionId }) => {
      try {
        const TestSession = require("../models/TestSession");
        const testSession = await TestSession.findOne({ sessionId });

        if (testSession && testSession.status === "active") {
          testSession.status = "paused";
          testSession.pauses.push({ startTime: new Date() });
          await testSession.save();

          if (testSession.testType === "real") {
            timerService.pauseSessionTimer(sessionId);
          }

          testNamespace
            .to(`test:${sessionId}`)
            .emit(SOCKET_EVENTS.TEST_PAUSED, {
              sessionId,
              pausedAt: new Date(),
            });
        }
      } catch (error) {
        console.error("Error pausing test:", error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: error.message });
      }
    });

    // Resume test
    socket.on(SOCKET_EVENTS.RESUME_TEST, async ({ sessionId }) => {
      try {
        const TestSession = require("../models/TestSession");
        const testSession = await TestSession.findOne({ sessionId });

        if (testSession && testSession.status === "paused") {
          const lastPause = testSession.pauses[testSession.pauses.length - 1];
          if (lastPause && !lastPause.endTime) {
            lastPause.endTime = new Date();
            lastPause.duration =
              (lastPause.endTime - lastPause.startTime) / 1000;
          }

          testSession.status = "active";
          await testSession.save();

          if (testSession.testType === "real") {
            timerService.resumeSessionTimer(sessionId);
          }

          testNamespace
            .to(`test:${sessionId}`)
            .emit(SOCKET_EVENTS.TEST_RESUMED, {
              sessionId,
              resumedAt: new Date(),
            });
        }
      } catch (error) {
        console.error("Error resuming test:", error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: error.message });
      }
    });

    // Skip question
    socket.on(SOCKET_EVENTS.SKIP_QUESTION, async ({ sessionId }) => {
      try {
        const TestSession = require("../models/TestSession");
        const testSession = await TestSession.findOne({ sessionId });

        if (testSession) {
          testSession.currentQuestionIndex++;
          await testSession.save();

          const analytics =
            analyticsService.calculateRealtimeAnalytics(testSession);

          testNamespace
            .to(`test:${sessionId}`)
            .emit(SOCKET_EVENTS.QUESTION_SKIPPED, {
              sessionId,
              currentQuestionIndex: testSession.currentQuestionIndex,
              analytics,
            });
        }
      } catch (error) {
        console.error("Error skipping question:", error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: error.message });
      }
    });

    // Request analytics
    socket.on(SOCKET_EVENTS.REQUEST_ANALYTICS, async ({ sessionId }) => {
      try {
        const TestSession = require("../models/TestSession");
        const testSession = await TestSession.findOne({ sessionId });

        if (testSession) {
          const analytics =
            analyticsService.calculateRealtimeAnalytics(testSession);
          socket.emit(SOCKET_EVENTS.ANALYTICS_UPDATE, analytics);
        }
      } catch (error) {
        console.error("Error getting analytics:", error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: error.message });
      }
    });

    // End test manually
    socket.on(SOCKET_EVENTS.END_TEST, async ({ sessionId }) => {
      try {
        const TestSession = require("../models/TestSession");
        const StudentPerformance = require("../models/studentPerformance");

        const testSession = await TestSession.findOne({ sessionId });

        if (testSession && testSession.status !== "completed") {
          testSession.endTest();

          let performance = await StudentPerformance.findOne({
            studentId: testSession.studentId,
          });
          if (!performance) {
            performance = new StudentPerformance({
              studentId: testSession.studentId,
            });
          }
          performance.updateWithTestSession(testSession);
          performance.calculateAnalytics();
          await performance.save();

          if (testSession.flaskSessionId) {
            try {
              await flaskApiService.completeTestSession(
                testSession.flaskSessionId,
              );
            } catch (error) {
              console.error("Error completing Flask session:", error.message);
            }
          }

          timerService.clearSessionTimer(sessionId);
          await testSession.save();

          const analytics =
            analyticsService.calculateRealtimeAnalytics(testSession);

          testNamespace.to(`test:${sessionId}`).emit(SOCKET_EVENTS.TEST_ENDED, {
            sessionId,
            summary: testSession.summary,
            analytics,
          });
        }
      } catch (error) {
        console.error("Error ending test:", error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: error.message });
      }
    });

    // Disconnect
    socket.on("disconnect", () => {
      console.log(`Test client disconnected: ${socket.id}`);
    });
  });
};

const mapDifficultyLevel = (difficulty) => {
  if (difficulty < 0.2) return "very_easy";
  if (difficulty < 0.4) return "easy";
  if (difficulty < 0.6) return "medium";
  if (difficulty < 0.8) return "hard";
  return "very_hard";
};

const clampDifficulty = (value) => Math.max(0.1, Math.min(0.95, value));

module.exports = { initializeTestSocket, SOCKET_EVENTS };
