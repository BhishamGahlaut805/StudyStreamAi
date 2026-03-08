const flaskApiService = require("../Services/flaskAPIService");
const questionBankService = require("../Services/questionBankService");
const { v4: uuidv4 } = require("uuid");

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
            const remainingQuestions =
              testSession.questions.length - testSession.currentQuestionIndex;

            // Always ensure we have at least 3 questions ahead
            if (remainingQuestions < 3) {
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
                let nextDifficulty = testSession.testConfig.difficulty || 0.5;
                if (hasRequestedDifficulty) {
                  nextDifficulty = requestedDifficultyValue;
                }

                // Try Flask first
                if (testSession.flaskSessionId) {
                  try {
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
                        conceptArea: q.concept_area || "general",
                        topic: q.topic || "general",
                        marks: q.marks || 4,
                        expectedTime: q.expected_time || 120,
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
                    console.error("Error fetching from Flask:", error.message);
                  }
                }

                // Fallback to local questions
                if (newQuestions.length === 0) {
                  const excludeIds = testSession.questions.map(
                    (q) => q?.metadata?.sourceQuestionId || q._id,
                  );

                  // Get last answer correctness to adjust difficulty
                  const lastAnswer =
                    testSession.answers[testSession.answers.length - 1];
                  const lastCorrect = lastAnswer ? lastAnswer.isCorrect : null;

                  const result = questionBankService.getNextPracticeQuestion(
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
                        metadata: {
                          sourceQuestionId: q.questionId || null,
                        },
                      },
                    ];
                    nextDifficulty = result.nextDifficulty;
                  } else {
                    // Ultra fallback - get any random question
                    const topicFilteredPool =
                      Array.isArray(selectedTopics) && selectedTopics.length > 0
                        ? questionBankService
                            .getAllQuestions()
                            .filter((q) =>
                              questionBankService.matchesSelectedTopics(
                                q.topic,
                                selectedTopics,
                              ),
                            )
                        : questionBankService.getAllQuestions();

                    const randomQ = questionBankService.getRandomItems(
                      topicFilteredPool,
                      1,
                    )[0];
                    if (randomQ) {
                      newQuestions = [
                        {
                          _id: createSessionQuestionId(randomQ.questionId),
                          text: randomQ.text,
                          type: randomQ.type,
                          difficulty: randomQ.difficulty,
                          difficultyLevel: randomQ.difficultyLevel,
                          options: randomQ.options,
                          correctAnswer: randomQ.correct_answer,
                          explanation: randomQ.explanation,
                          solutionSteps: randomQ.solutionSteps || [],
                          conceptArea: randomQ.conceptArea || randomQ.topic,
                          topic: randomQ.topic,
                          marks: randomQ.marks,
                          expectedTime: randomQ.expectedTime,
                          metadata: {
                            sourceQuestionId: randomQ.questionId || null,
                          },
                        },
                      ];
                    }
                  }
                }

                if (newQuestions.length > 0) {
                  testSession.questions.push(...newQuestions);
                  testSession.testConfig.difficulty = nextDifficulty;
                  appliedDifficulty = nextDifficulty;
                  await testSession.save();

                  socket.emit(SOCKET_EVENTS.QUESTIONS_UPDATED, {
                    sessionId,
                    totalQuestions: testSession.questions.length,
                    newQuestionsCount: newQuestions.length,
                    nextDifficulty,
                  });
                }
              } catch (error) {
                console.error("Error fetching next questions:", error);
              }
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
