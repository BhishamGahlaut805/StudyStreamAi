import apiClient from "./utils/apiClient";
import websocketService from "./webSockets";
import flaskService from "./flaskService";
import authService from "./authService";
import analyticsService from "./analyticsService";

class TestService {
  constructor() {
    this.ACTIVE_SESSION_KEY = "activeTestSession";
    this.currentSession = null;
    this.currentQuestion = null;
    this.answers = [];
    this.analytics = {
      currentAccuracy: 0,
      correctCount: 0,
      wrongCount: 0,
      totalQuestions: 0,
      answeredQuestions: 0,
      timePerQuestion: 0,
      conceptPerformance: {},
    };
    this.listeners = new Map();
    this.practiceMode = {
      infinite: true,
      currentDifficulty: 0.5,
      difficultyWindowSize: 5,
      difficultyWindowRemaining: 0,
      questionHistory: [],
      conceptHistory: {},
      sessionFeatures: [],
    };
    this.realExam = {
      timeRemaining: 3600, // 60 minutes in seconds
      totalQuestions: 100,
      sections: {
        mathematics: { total: 25, answered: 0, correct: 0 },
        english: { total: 25, answered: 0, correct: 0 },
        reasoning: { total: 25, answered: 0, correct: 0 },
        general_knowledge: { total: 25, answered: 0, correct: 0 },
      },
    };
  }

  async ensureSocketReady(sessionId) {
    const studentId = authService.getStudentId();
    if (!studentId || !sessionId) return;

    if (!websocketService.isConnected()) {
      websocketService.initialize("/test");

      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          websocketService.off("connection-change", onConnection);
          resolve();
        }, 4000);

        const onConnection = (data) => {
          if (data?.state === "connected") {
            clearTimeout(timeout);
            websocketService.off("connection-change", onConnection);
            resolve();
          }
        };

        websocketService.on("connection-change", onConnection);
      });
    }

    websocketService.send("join-test", {
      sessionId,
      studentId,
    });
  }

  getQuestionId(question) {
    return question?.id || question?._id || question?.questionId || null;
  }

  normalizeQuestion(question = {}, fallbackDifficulty = 0.5) {
    const rawDifficulty =
      question?.difficulty ?? question?.difficulty_level ?? fallbackDifficulty;
    const parsedDifficulty = Number(rawDifficulty);

    return {
      ...question,
      id: this.getQuestionId(question),
      difficulty: Number.isFinite(parsedDifficulty)
        ? parsedDifficulty
        : fallbackDifficulty,
      difficultyLevel:
        question?.difficultyLevel || question?.difficulty_level || "medium",
      correctAnswer:
        question?.correctAnswer ?? question?.correct_answer ?? null,
      explanation: question?.explanation ?? question?.solution ?? "",
      solutionSteps: Array.isArray(question?.solutionSteps)
        ? question.solutionSteps
        : Array.isArray(question?.solution_steps)
          ? question.solution_steps
          : [],
      expectedTime: question?.expectedTime ?? question?.expected_time ?? 90,
      conceptArea: question?.conceptArea || question?.concept_area || "general",
    };
  }

  /**
   * Initialize test service
   */
  initialize() {
    this.setupWebSocketListeners();
  }

  /**
   * Setup WebSocket listeners
   */
  setupWebSocketListeners() {
    websocketService.on("test-joined", (data) => {
      this.currentSession = {
        ...this.currentSession,
        ...data,
        joinedAt: new Date().toISOString(),
      };

      if (data?.currentQuestion) {
        this.currentQuestion = data.currentQuestion;
      }

      this.persistActiveSession();
      this.emit("test-joined", data);
    });

    websocketService.on("answer-confirmed", (data) => {
      this.handleAnswerConfirmed(data);
    });

    websocketService.on("answer-processed", (data) => {
      this.emit("answer-processed", data);
    });

    websocketService.on("next-question-received", (data) => {
      this.currentQuestion = data.question;
      if (this.currentSession && typeof data?.questionNumber === "number") {
        this.currentSession.currentQuestionIndex = Math.max(
          0,
          data.questionNumber - 1,
        );
        this.persistActiveSession();
      }
      this.emit("next-question", data);
    });

    websocketService.on("analytics-update", (data) => {
      this.analytics = { ...this.analytics, ...data };
      this.emit("analytics-update", data);
    });

    websocketService.on("timer-update", (data) => {
      if (this.currentSession?.testType === "real") {
        this.realExam.timeRemaining = data.timeRemaining;
      }
      this.emit("timer-update", data);
    });

    websocketService.on("practice-duration", (data) => {
      this.emit("practice-duration", data);
    });

    websocketService.on("test-completed", (data) => {
      this.handleTestCompleted(data);
    });

    websocketService.on("test-timeout", (data) => {
      this.emit("test-timeout", data);
    });

    websocketService.on("test-paused", (data) => {
      this.emit("test-paused", data);
    });

    websocketService.on("test-resumed", (data) => {
      this.emit("test-resumed", data);
    });

    websocketService.on("questions-updated", (data) => {
      if (this.currentSession) {
        this.currentSession.totalQuestions = data.totalQuestions;
        this.persistActiveSession();
      }
      this.emit("questions-updated", data);
    });

    websocketService.on("question-skipped", (data) => {
      this.emit("question-skipped", data);
    });

    websocketService.on("no-more-questions", (data) => {
      this.emit("no-more-questions", data);
    });

    websocketService.on("connection-change", (data) => {
      this.emit("connection-change", data);
    });

    websocketService.on("reconnecting", (data) => {
      this.emit("reconnecting", data);
    });

    websocketService.on("reconnected", () => {
      const studentId = authService.getStudentId();
      if (this.currentSession?.sessionId && studentId) {
        websocketService.send("join-test", {
          sessionId: this.currentSession.sessionId,
          studentId,
        });
      }
    });

    websocketService.on("error", (data) => {
      this.emit("socket-error", data || { message: "Socket error" });
    });

    websocketService.on("connection-error", (data) => {
      this.emit("socket-error", data || { message: "Connection error" });
    });
  }

  // ==================== Test Creation ====================

  /**
   * Create a new practice test
   */
  async createPracticeTest(config) {
    try {
      const studentId = authService.getStudentId();
      if (!studentId) throw new Error("No student ID found");

      const testData = {
        studentId,
        testType: "practice",
        testConfig: {
          title: config.title || "Practice Test",
          description: config.description || "",
          selectedTopics: config.selectedTopics || [],
          selectedPdfs: config.selectedPdfs || [],
          adaptiveEnabled: config.adaptiveEnabled !== false,
          batchSize: config.batchSize || 2,
          difficulty: config.initialDifficulty || 0.5,
          showSolutions: config.showSolutions !== false,
        },
        selectedTopics: config.selectedTopics || [],
        selectedPdfs: config.selectedPdfs || [],
      };

      const response = await apiClient.nodePost("/tests", testData);

      if (response.success) {
        this.currentSession = {
          sessionId: response.sessionId,
          flaskSessionId: response.flaskSessionId,
          studentId,
          testType: "practice",
          questions: response.questions,
          totalQuestions: response.totalQuestions,
          startTime: response.startTime,
          config: response.config,
          status: "active",
          currentQuestionIndex: 0,
          answers: [],
        };
        this.currentQuestion = response.questions?.[0] || null;
        this.answers = [];
        this.persistActiveSession();

        this.practiceMode.currentDifficulty = response.config.difficulty || 0.5;

        // Join via WebSocket
        if (websocketService.isConnected()) {
          websocketService.send("join-test", {
            sessionId: response.sessionId,
            studentId,
          });
        } else {
          websocketService.initialize("/test");
          setTimeout(() => {
            websocketService.send("join-test", {
              sessionId: response.sessionId,
              studentId,
            });
          }, 1000);
        }

        // Initialize Flask features
        this.initializeFlaskFeatures();

        return {
          success: true,
          session: this.currentSession,
          firstQuestion: response.questions[0],
        };
      }

      throw new Error("Failed to create test");
    } catch (error) {
      console.error("Create practice test error:", error);
      throw error;
    }
  }

  /**
   * Create a new real exam
   */
  async createRealExam(config) {
    try {
      const studentId = authService.getStudentId();
      if (!studentId) throw new Error("No student ID found");

      const testData = {
        studentId,
        testType: "real",
        testConfig: {
          title: config.title || "Real Exam",
          description: config.description || "SSC Exam Simulation",
          totalDuration: 60, // 60 minutes
          selectedTopics: config.selectedTopics || [],
          adaptiveEnabled: false,
          difficulty: config.initialDifficulty || 0.5,
          showSolutions: false, // Don't show during exam
        },
        selectedTopics: config.selectedTopics || [],
      };

      const response = await apiClient.nodePost("/tests", testData);

      if (response.success) {
        this.currentSession = {
          sessionId: response.sessionId,
          studentId,
          testType: "real",
          questions: response.questions,
          totalQuestions: response.totalQuestions,
          startTime: response.startTime,
          timeRemaining: 3600, // 60 minutes in seconds
          config: response.config,
          status: "active",
          currentQuestionIndex: 0,
          answers: [],
        };
        this.currentQuestion = response.questions?.[0] || null;
        this.answers = [];
        this.persistActiveSession();

        this.realExam.timeRemaining = 3600;
        this.realExam.totalQuestions = response.totalQuestions;

        // Initialize section tracking
        this.initializeRealExamSections(response.questions);

        // Join via WebSocket
        if (websocketService.isConnected()) {
          websocketService.send("join-test", {
            sessionId: response.sessionId,
            studentId,
          });
        } else {
          websocketService.initialize("/test");
          setTimeout(() => {
            websocketService.send("join-test", {
              sessionId: response.sessionId,
              studentId,
            });
          }, 1000);
        }

        return {
          success: true,
          session: this.currentSession,
          firstQuestion: response.questions[0],
          sections: this.realExam.sections,
        };
      }

      throw new Error("Failed to create real exam");
    } catch (error) {
      console.error("Create real exam error:", error);
      throw error;
    }
  }

  /**
   * Initialize real exam sections
   */
  initializeRealExamSections(questions) {
    const sections = {
      mathematics: { total: 0, answered: 0, correct: 0, time: 0 },
      english: { total: 0, answered: 0, correct: 0, time: 0 },
      reasoning: { total: 0, answered: 0, correct: 0, time: 0 },
      general_knowledge: { total: 0, answered: 0, correct: 0, time: 0 },
    };

    questions.forEach((q) => {
      const subject = q.subject || this.getSubjectFromTopic(q.topic);
      if (sections[subject]) {
        sections[subject].total++;
      }
    });

    this.realExam.sections = sections;
  }

  /**
   * Get subject from topic
   */
  getSubjectFromTopic(topic) {
    const mathTopics = [
      "Number System",
      "Algebra",
      "Geometry",
      "Trigonometry",
      "Mensuration",
      "Statistics",
      "Probability",
      "Average",
      "Percentage",
      "Profit & Loss",
    ];
    const englishTopics = [
      "Grammar",
      "Vocabulary",
      "Reading Comprehension",
      "Synonyms",
      "Antonyms",
      "Idioms & Phrases",
    ];
    const reasoningTopics = [
      "Analogy",
      "Classification",
      "Series",
      "Coding-Decoding",
      "Blood Relations",
      "Direction Sense",
      "Syllogism",
    ];

    if (mathTopics.some((t) => topic.includes(t))) return "mathematics";
    if (englishTopics.some((t) => topic.includes(t))) return "english";
    if (reasoningTopics.some((t) => topic.includes(t))) return "reasoning";
    return "general_knowledge";
  }

  /**
   * Initialize Flask ML features
   */
  initializeFlaskFeatures() {
    this.practiceMode.questionHistory = [];
    this.practiceMode.conceptHistory = {};
    this.practiceMode.sessionFeatures = [];
    this.practiceMode.difficultyWindowSize = 5;
    this.practiceMode.difficultyWindowRemaining = 0;
  }

  // ==================== Answer Submission ====================

  /**
   * Submit answer for current question
   */
  async submitAnswer(answerData) {
    if (!this.currentSession) {
      throw new Error("No active test session");
    }

    if (!this.currentQuestion && this.currentSession?.questions?.length) {
      const currentIndex = this.currentSession.currentQuestionIndex || 0;
      this.currentQuestion =
        this.currentSession.questions[currentIndex] ||
        this.currentSession.questions[0] ||
        null;
    }

    if (!this.currentQuestion) {
      throw new Error("No active question available");
    }

    const question = this.normalizeQuestion(this.currentQuestion, 0.5);
    this.currentQuestion = question;
    const questionId = this.getQuestionId(question);

    if (!questionId) {
      throw new Error("Current question id is missing");
    }

    // Prepare answer object
    const answer = {
      questionId,
      questionText: question.text,
      selectedOptions: answerData.selectedOptions,
      isCorrect: null,
      timeSpent: answerData.timeSpent || 0,
      answerChanges: answerData.answerChanges || 0,
      confidence: answerData.confidence || 0.5,
      conceptArea: question.conceptArea || question.topic,
      difficulty: question.difficulty,
      difficultyLevel: question.difficultyLevel,
      subject: question.subject || this.getSubjectFromTopic(question.topic),
      timestamp: new Date().toISOString(),
    };

    // Store answer
    this.answers.push(answer);

    await this.ensureSocketReady(this.currentSession.sessionId);

    // Submit via WebSocket
    websocketService.send("submit-answer", {
      sessionId: this.currentSession.sessionId,
      questionId,
      answerData: {
        selectedOptions: answerData.selectedOptions,
        timeSpent: answerData.timeSpent || 0,
        answerChanges: answerData.answerChanges || 0,
        confidence: answerData.confidence || 0.5,
      },
    });

    let confirmed = null;
    try {
      confirmed = await this.waitForAnswerConfirmation(
        this.currentSession.sessionId,
        questionId,
      );
    } catch (error) {
      confirmed = null;
    }

    const fallbackIsCorrect = this.checkAnswer(
      question,
      answerData.selectedOptions,
    );
    answer.isCorrect = confirmed?.isCorrect ?? fallbackIsCorrect;

    // Update analytics with confirmed correctness
    this.updateAnalytics(answer);

    // Update section tracking for real exam
    if (this.currentSession.testType === "real") {
      this.updateRealExamSection(answer);
    }

    // Update Flask features for practice mode
    if (this.currentSession.testType === "practice") {
      await this.updateFlaskFeatures(answer, question);
    }

    return {
      success: true,
      isCorrect: answer.isCorrect,
      correctAnswer:
        confirmed?.correctAnswer ??
        question.correctAnswer ??
        question.correct_answer,
      explanation:
        confirmed?.explanation ?? question.explanation ?? question.solution,
      solutionSteps:
        confirmed?.solutionSteps ??
        question.solutionSteps ??
        question.solution_steps ??
        [],
      analytics: this.analytics,
    };
  }

  waitForAnswerConfirmation(sessionId, questionId, timeoutMs = 6000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.off("answer-confirmed", handler);
        reject(new Error("Answer confirmation timeout"));
      }, timeoutMs);

      const handler = (data) => {
        if (
          String(data?.sessionId) === String(sessionId) &&
          String(data?.questionId) === String(questionId)
        ) {
          clearTimeout(timeout);
          this.off("answer-confirmed", handler);
          resolve(data);
        }
      };

      this.on("answer-confirmed", handler);
    });
  }

  /**
   * Check if answer is correct
   */
  checkAnswer(question, selectedOptions) {
    if (!question || !selectedOptions) return false;

    switch (question.type) {
      case "MCQ":
        return selectedOptions === question.correctAnswer;
      case "MSQ":
        const selected = Array.isArray(selectedOptions)
          ? [...selectedOptions].sort()
          : [selectedOptions];
        const correct = Array.isArray(question.correctAnswer)
          ? [...question.correctAnswer].sort()
          : [question.correctAnswer];
        return JSON.stringify(selected) === JSON.stringify(correct);
      case "NAT":
        const numSelected = parseFloat(selectedOptions);
        const numCorrect = parseFloat(question.correctAnswer);
        return Math.abs(numSelected - numCorrect) < 0.001;
      default:
        return false;
    }
  }

  /**
   * Update analytics after answer
   */
  updateAnalytics(answer) {
    this.analytics.answeredQuestions++;
    this.analytics.totalQuestions = this.currentSession?.totalQuestions || 0;

    if (answer.isCorrect) {
      this.analytics.correctCount++;
    } else {
      this.analytics.wrongCount++;
    }

    this.analytics.currentAccuracy =
      this.analytics.answeredQuestions > 0
        ? (this.analytics.correctCount / this.analytics.answeredQuestions) * 100
        : 0;

    // Update concept performance
    const concept = answer.conceptArea || "general";
    if (!this.analytics.conceptPerformance[concept]) {
      this.analytics.conceptPerformance[concept] = { correct: 0, total: 0 };
    }
    this.analytics.conceptPerformance[concept].total++;
    if (answer.isCorrect) {
      this.analytics.conceptPerformance[concept].correct++;
    }
  }

  /**
   * Update real exam section tracking
   */
  updateRealExamSection(answer) {
    const subject = answer.subject;
    if (this.realExam.sections[subject]) {
      this.realExam.sections[subject].answered++;
      this.realExam.sections[subject].time += answer.timeSpent || 0;
      if (answer.isCorrect) {
        this.realExam.sections[subject].correct++;
      }
    }
  }

  /**
   * Update Flask ML features for practice mode
   */
  async updateFlaskFeatures(answer, question) {
    // Add to question history
    this.practiceMode.questionHistory.push({
      questionId: question.id,
      correct: answer.isCorrect,
      timeSpent: answer.timeSpent,
      answerChanges: answer.answerChanges,
      confidence: answer.confidence,
      conceptArea: question.conceptArea,
      difficulty: question.difficulty,
    });

    // Update concept history
    const concept = question.conceptArea || "general";
    if (!this.practiceMode.conceptHistory[concept]) {
      this.practiceMode.conceptHistory[concept] = [];
    }
    this.practiceMode.conceptHistory[concept].push(answer.isCorrect ? 1 : 0);

    // Keep last 30
    if (this.practiceMode.conceptHistory[concept].length > 30) {
      this.practiceMode.conceptHistory[concept] =
        this.practiceMode.conceptHistory[concept].slice(-30);
    }

    // Update session features
    this.updateSessionFeatures(answer);

    // Difficulty prediction cadence is orchestrated by practice page
    // to support windowed application (next 5 questions).
  }

  /**
   * Update session features for burnout detection
   */
  updateSessionFeatures(answer) {
    // Simple session simulation - last 14 answers as a session
    const recentAnswers = this.answers.slice(-14);

    if (recentAnswers.length >= 5) {
      const sessionAccuracy = recentAnswers.map((a) => (a.isCorrect ? 1 : 0));
      const sessionTimes = recentAnswers.map((a) => a.timeSpent || 0);

      this.practiceMode.sessionFeatures = [
        sessionAccuracy.reduce((a, b) => a + b, 0) / sessionAccuracy.length,
        this.calculateTrend(sessionAccuracy),
        this.calculateTrend(recentAnswers.map((a) => a.confidence || 0.5)),
        this.calculateTrend(sessionTimes),
        sessionTimes[sessionTimes.length - 1] - sessionTimes[0],
        sessionTimes.reduce((a, b) => a + b, 0) / 60,
        1, // days without break placeholder
        recentAnswers
          .filter((a) => a.difficulty > 0.7)
          .filter((a) => a.isCorrect).length /
          Math.max(1, recentAnswers.filter((a) => a.difficulty > 0.7).length),
        1 - this.calculateStdDev(sessionAccuracy),
        this.calculateTrend(recentAnswers.map((a) => a.confidence || 0.5)),
        recentAnswers.filter((a) => (a.timeSpent || 0) < 5).length /
          recentAnswers.length,
        this.calculateSecondHalfDrop(recentAnswers),
      ];
    }
  }

  /**
   * Calculate trend
   */
  calculateTrend(values) {
    if (values.length < 2) return 0;
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((a, b, i) => a + b * values[i], 0);
    const sumX2 = x.reduce((a, b) => a + b * b, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return isNaN(slope) ? 0 : slope;
  }

  /**
   * Calculate standard deviation
   */
  calculateStdDev(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Calculate second half accuracy drop
   */
  calculateSecondHalfDrop(answers) {
    if (answers.length < 4) return 0;
    const half = Math.floor(answers.length / 2);
    const firstHalf = answers.slice(0, half);
    const secondHalf = answers.slice(half);
    const firstAcc =
      firstHalf.filter((a) => a.isCorrect).length / firstHalf.length;
    const secondAcc =
      secondHalf.filter((a) => a.isCorrect).length / secondHalf.length;
    return firstAcc - secondAcc;
  }

  // ==================== Question Navigation ====================

  /**
   * Request next question
   */
  async requestNextQuestion(options = {}) {
    if (!this.currentSession) return;

    await this.ensureSocketReady(this.currentSession.sessionId);

    const requestedDifficulty = Number.isFinite(
      Number(options?.requestedDifficulty),
    )
      ? Number(options.requestedDifficulty)
      : undefined;
    const difficultyWindowRemaining = Number.isFinite(
      Number(options?.difficultyWindowRemaining),
    )
      ? Number(options.difficultyWindowRemaining)
      : undefined;

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timeoutId);
        this.off("next-question", onNextQuestion);
        this.off("no-more-questions", onNoMoreQuestions);
        this.off("socket-error", onSocketError);
      };

      const onNextQuestion = (data) => {
        if (!data?.question) {
          return;
        }

        this.currentQuestion = this.normalizeQuestion(
          data.question,
          data?.appliedDifficulty ?? requestedDifficulty ?? 0.5,
        );

        if (this.currentSession && typeof data?.questionNumber === "number") {
          this.currentSession.currentQuestionIndex = Math.max(
            0,
            data.questionNumber - 1,
          );
        }

        this.persistActiveSession();
        cleanup();
        resolve({
          status: "ok",
          data: {
            ...data,
            question: this.currentQuestion,
          },
        });
      };

      const onNoMoreQuestions = (data) => {
        cleanup();
        resolve({ status: "no-more", data });
      };

      const onSocketError = (data) => {
        cleanup();
        reject(new Error(data?.message || "Unable to fetch next question"));
      };

      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error("Next question request timed out"));
      }, 25000);

      this.on("next-question", onNextQuestion);
      this.on("no-more-questions", onNoMoreQuestions);
      this.on("socket-error", onSocketError);

      const sent = websocketService.send("next-question", {
        sessionId: this.currentSession.sessionId,
        requestedDifficulty,
        difficultyWindowRemaining,
      });

      if (!sent && !websocketService.isConnected()) {
        cleanup();
        reject(new Error("Connection is unstable. Reconnecting..."));
      }
    });
  }

  /**
   * Skip current question
   */
  async skipQuestion() {
    if (!this.currentSession) return;

    await this.ensureSocketReady(this.currentSession.sessionId);

    websocketService.send("skip-question", {
      sessionId: this.currentSession.sessionId,
    });
  }

  /**
   * Get current question
   */
  getCurrentQuestion() {
    return this.currentQuestion;
  }

  /**
   * Get question by index
   */
  getQuestionByIndex(index) {
    if (!this.currentSession?.questions) return null;
    return this.currentSession.questions[index];
  }

  // ==================== Test Control ====================

  /**
   * Pause test
   */
  pauseTest() {
    if (!this.currentSession) return;

    websocketService.send("pause-test", {
      sessionId: this.currentSession.sessionId,
    });
  }

  /**
   * Resume test
   */
  resumeTest() {
    if (!this.currentSession) return;

    websocketService.send("resume-test", {
      sessionId: this.currentSession.sessionId,
    });
  }

  /**
   * End test manually
   */
  endTest() {
    if (!this.currentSession) return;

    websocketService.send("end-test", {
      sessionId: this.currentSession.sessionId,
    });
  }

  // ==================== Test Results ====================

  /**
   * Handle test completed
   */
  handleTestCompleted(data) {
    this.currentSession = {
      ...this.currentSession,
      status: "completed",
      completedAt: new Date().toISOString(),
      summary: data.summary,
    };

    // Calculate analytics models
    const performance = this.buildPerformanceObject();
    const analytics = analyticsService.calculateAllModels(performance);

    this.emit("test-completed", {
      ...data,
      analytics: analyticsService.formatForDashboard(analytics),
      rawAnalytics: analytics,
    });

    // Clear session data
    setTimeout(() => {
      this.clearSession();
    }, 5000);
  }

  /**
   * Build performance object from test data
   */
  buildPerformanceObject() {
    return {
      topicPerformance: this.buildTopicPerformance(),
      testHistory: this.buildTestHistory(),
      overallStats: {
        totalQuestions: this.answers.length,
        totalCorrect: this.analytics.correctCount,
        accuracy: this.analytics.currentAccuracy,
        totalTimeSpent:
          this.answers.reduce((sum, a) => sum + (a.timeSpent || 0), 0) / 60,
        totalTests: 1,
        averageDifficulty:
          this.answers.reduce((sum, a) => sum + (a.difficulty || 0.5), 0) /
          this.answers.length,
      },
    };
  }

  /**
   * Build topic performance from answers
   */
  buildTopicPerformance() {
    const topicMap = {};

    this.answers.forEach((answer) => {
      const topic = answer.conceptArea || answer.topic || "general";
      if (!topicMap[topic]) {
        topicMap[topic] = {
          topic,
          subject: answer.subject || "general",
          accuracy: 0,
          questionsAttempted: 0,
          correctAnswers: 0,
          lastPracticed: new Date(),
          timeSpent: 0,
          averageDifficulty: 0,
          conceptMasteryHistory: [],
        };
      }

      topicMap[topic].questionsAttempted++;
      topicMap[topic].timeSpent += (answer.timeSpent || 0) / 60;
      if (answer.isCorrect) topicMap[topic].correctAnswers++;

      topicMap[topic].accuracy =
        (topicMap[topic].correctAnswers / topicMap[topic].questionsAttempted) *
        100;
      topicMap[topic].averageDifficulty =
        (topicMap[topic].averageDifficulty *
          (topicMap[topic].questionsAttempted - 1) +
          (answer.difficulty || 0.5)) /
        topicMap[topic].questionsAttempted;
      topicMap[topic].lastPracticed = new Date();

      // Track mastery history
      topicMap[topic].conceptMasteryHistory.push(
        topicMap[topic].accuracy / 100,
      );
      if (topicMap[topic].conceptMasteryHistory.length > 20) {
        topicMap[topic].conceptMasteryHistory =
          topicMap[topic].conceptMasteryHistory.slice(-20);
      }
    });

    return Object.values(topicMap);
  }

  /**
   * Build test history
   */
  buildTestHistory() {
    return [
      {
        sessionId: this.currentSession?.sessionId,
        testType: this.currentSession?.testType,
        date: new Date(),
        accuracy: this.analytics.currentAccuracy,
        totalQuestions: this.answers.length,
        timeSpent:
          this.answers.reduce((sum, a) => sum + (a.timeSpent || 0), 0) / 60,
        averageDifficulty:
          this.answers.reduce((sum, a) => sum + (a.difficulty || 0.5), 0) /
          this.answers.length,
        conceptsTested: [
          ...new Set(this.answers.map((a) => a.conceptArea).filter(Boolean)),
        ],
      },
    ];
  }

  /**
   * Get test summary
   */
  async getTestSummary(sessionId) {
    try {
      const response = await apiClient.nodeGet(`/tests/${sessionId}/summary`);
      return {
        success: true,
        summary: response.summary,
        exportSummary: response.exportSummary,
        testInfo: response.testInfo,
        flaskAnalysis: response.flaskAnalysis,
      };
    } catch (error) {
      console.error("Get test summary error:", error);
      throw error;
    }
  }

  /**
   * Generate question paper
   */
  async generateQuestionPaper(sessionId) {
    try {
      const response = await apiClient.nodeGet(
        `/tests/${sessionId}/question-paper`,
      );
      return {
        success: true,
        questionPaper: response.questionPaper,
      };
    } catch (error) {
      console.error("Generate question paper error:", error);
      throw error;
    }
  }

  /**
   * Get topic time analysis
   */
  async getTopicTimeAnalysis(sessionId) {
    try {
      const response = await apiClient.nodeGet(
        `/tests/${sessionId}/topic-time-analysis`,
      );
      return {
        success: true,
        topicAnalysis: response.topicAnalysis,
        totalTime: response.totalTime,
        averageTimePerQuestion: response.averageTimePerQuestion,
      };
    } catch (error) {
      console.error("Get topic time analysis error:", error);
      throw error;
    }
  }

  /**
   * Export test results
   */
  async exportTestResults(sessionId, format = "csv") {
    try {
      const response = await apiClient.nodeGet(
        `/tests/${sessionId}/export/${format}`,
        {},
        {
          responseType: "blob",
        },
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `test_results_${sessionId}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      return {
        success: true,
      };
    } catch (error) {
      console.error("Export test results error:", error);
      throw error;
    }
  }

  // ==================== Analytics & Insights ====================

  /**
   * Get live analytics
   */
  getLiveAnalytics() {
    return {
      ...this.analytics,
      practiceMode: this.practiceMode,
      realExam: this.realExam,
    };
  }

  /**
   * Get real exam progress
   */
  getRealExamProgress() {
    const answered = Object.values(this.realExam.sections).reduce(
      (sum, s) => sum + s.answered,
      0,
    );
    const total = this.realExam.totalQuestions;

    return {
      answered,
      total,
      percentage: total > 0 ? (answered / total) * 100 : 0,
      timeRemaining: this.realExam.timeRemaining,
      timeFormatted: this.formatTime(this.realExam.timeRemaining),
      sections: this.realExam.sections,
    };
  }

  /**
   * Get practice mode status
   */
  getPracticeModeStatus() {
    return {
      currentDifficulty: this.practiceMode.currentDifficulty,
      questionsAnswered: this.answers.length,
      accuracy: this.analytics.currentAccuracy,
      conceptHistory: this.practiceMode.conceptHistory,
    };
  }

  /**
   * Get performance insights
   */
  getPerformanceInsights() {
    const insights = [];

    // Accuracy insights
    if (this.analytics.currentAccuracy > 80) {
      insights.push({
        type: "success",
        message: "Excellent accuracy! Keep up the great work.",
      });
    } else if (this.analytics.currentAccuracy < 40) {
      insights.push({
        type: "warning",
        message: "Focus on accuracy before speed. Review incorrect answers.",
      });
    }

    // Concept insights
    const weakConcepts = [];
    const strongConcepts = [];

    Object.entries(this.analytics.conceptPerformance).forEach(
      ([concept, data]) => {
        if (data.total >= 3) {
          const accuracy = (data.correct / data.total) * 100;
          if (accuracy >= 70) {
            strongConcepts.push(concept);
          } else if (accuracy < 40) {
            weakConcepts.push(concept);
          }
        }
      },
    );

    if (weakConcepts.length > 0) {
      insights.push({
        type: "weakness",
        message: `Focus on improving: ${weakConcepts.join(", ")}`,
      });
    }

    if (strongConcepts.length > 0) {
      insights.push({
        type: "strength",
        message: `Strong areas: ${strongConcepts.join(", ")}`,
      });
    }

    return insights;
  }

  /**
   * Request analytics update
   */
  requestAnalyticsUpdate() {
    if (!this.currentSession) return;

    websocketService.send("request-analytics", {
      sessionId: this.currentSession.sessionId,
    });
  }

  // ==================== Student Performance ====================

  /**
   * Get student performance
   */
  async getStudentPerformance(studentId) {
    try {
      const response = await apiClient.nodeGet(
        `/students/${studentId}/performance`,
      );

      // Calculate analytics models
      const analytics = analyticsService.calculateAllModels(
        response.performance,
      );

      return {
        success: true,
        performance: response.performance,
        analytics: analyticsService.formatForDashboard(analytics),
        rawAnalytics: analytics,
      };
    } catch (error) {
      console.error("Get student performance error:", error);
      throw error;
    }
  }

  /**
   * Get performance trends
   */
  async getPerformanceTrends(studentId, period = "weekly") {
    try {
      const response = await apiClient.nodeGet(
        `/students/${studentId}/trends`,
        { period },
      );
      return response;
    } catch (error) {
      console.error("Get performance trends error:", error);
      throw error;
    }
  }

  /**
   * Get topic performance
   */
  async getTopicPerformance(studentId, params = {}) {
    try {
      const response = await apiClient.nodeGet(
        `/students/${studentId}/topics`,
        params,
      );
      return response;
    } catch (error) {
      console.error("Get topic performance error:", error);
      throw error;
    }
  }

  /**
   * Get weak topics
   */
  async getWeakTopics(studentId, params = {}) {
    try {
      const response = await apiClient.nodeGet(
        `/students/${studentId}/weak-topics`,
        params,
      );
      return response;
    } catch (error) {
      console.error("Get weak topics error:", error);
      throw error;
    }
  }

  /**
   * Get strong topics
   */
  async getStrongTopics(studentId, params = {}) {
    try {
      const response = await apiClient.nodeGet(
        `/students/${studentId}/strong-topics`,
        params,
      );
      return response;
    } catch (error) {
      console.error("Get strong topics error:", error);
      throw error;
    }
  }

  /**
   * Get student insights
   */
  async getStudentInsights(studentId) {
    try {
      const response = await apiClient.nodeGet(
        `/students/${studentId}/insights`,
      );

      // Enhance with calculated analytics
      if (response.insights?.analytics) {
        response.insights.formattedAnalytics =
          analyticsService.formatForDashboard(response.insights.analytics);
      }

      return response;
    } catch (error) {
      console.error("Get student insights error:", error);
      throw error;
    }
  }

  /**
   * Get recommendations
   */
  async getRecommendations(studentId) {
    try {
      const response = await apiClient.nodeGet(
        `/students/${studentId}/recommendations`,
      );
      return response;
    } catch (error) {
      console.error("Get recommendations error:", error);
      throw error;
    }
  }

  /**
   * Get learning path
   */
  async getLearningPath(studentId) {
    try {
      const response = await apiClient.nodeGet(
        `/students/${studentId}/learning-path`,
      );
      return response;
    } catch (error) {
      console.error("Get learning path error:", error);
      throw error;
    }
  }

  /**
   * Get test history
   */
  async getTestHistory(studentId, params = {}) {
    try {
      const response = await apiClient.nodeGet(
        `/students/${studentId}/history`,
        params,
      );
      return response;
    } catch (error) {
      console.error("Get test history error:", error);
      throw error;
    }
  }

  /**
   * Get test details
   */
  async getTestDetails(sessionId) {
    try {
      const response = await apiClient.nodeGet(`/students/test/${sessionId}`);
      return response;
    } catch (error) {
      console.error("Get test details error:", error);
      throw error;
    }
  }

  /**
   * Update student settings
   */
  async updateSettings(studentId, settings) {
    try {
      const response = await apiClient.nodePut(
        `/students/${studentId}/settings`,
        settings,
      );
      return response;
    } catch (error) {
      console.error("Update settings error:", error);
      throw error;
    }
  }

  // ==================== Utility Methods ====================

  /**
   * Format time in seconds
   */
  formatTime(seconds) {
    if (!seconds || seconds < 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  /**
   * Clear current session
   */
  clearSession() {
    this.currentSession = null;
    this.currentQuestion = null;
    this.answers = [];
    localStorage.removeItem(this.ACTIVE_SESSION_KEY);
    this.analytics = {
      currentAccuracy: 0,
      correctCount: 0,
      wrongCount: 0,
      totalQuestions: 0,
      answeredQuestions: 0,
      timePerQuestion: 0,
      conceptPerformance: {},
    };
    this.practiceMode = {
      infinite: true,
      currentDifficulty: 0.5,
      difficultyWindowSize: 5,
      difficultyWindowRemaining: 0,
      questionHistory: [],
      conceptHistory: {},
      sessionFeatures: [],
    };
    this.realExam = {
      timeRemaining: 3600,
      totalQuestions: 100,
      sections: {
        mathematics: { total: 25, answered: 0, correct: 0 },
        english: { total: 25, answered: 0, correct: 0 },
        reasoning: { total: 25, answered: 0, correct: 0 },
        general_knowledge: { total: 25, answered: 0, correct: 0 },
      },
    };
  }

  /**
   * Check if test is active
   */
  isTestActive() {
    return this.currentSession?.status === "active";
  }

  /**
   * Get current session
   */
  getCurrentSession() {
    return this.currentSession;
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return websocketService.getConnectionState();
  }

  /**
   * Add event listener
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  /**
   * Emit event
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  /**
   * Handle answer confirmed
   */
  handleAnswerConfirmed(data) {
    if (this.currentSession) {
      this.currentSession.currentQuestionIndex = data.currentQuestionIndex;
    }
    this.emit("answer-confirmed", data);

    this.persistActiveSession();
  }

  persistActiveSession() {
    if (!this.currentSession?.sessionId) return;

    if (
      this.currentSession?.status === "completed" ||
      this.currentSession?.status === "abandoned"
    ) {
      localStorage.removeItem(this.ACTIVE_SESSION_KEY);
      return;
    }

    const payload = {
      session: this.currentSession,
      currentQuestion: this.currentQuestion,
      savedAt: new Date().toISOString(),
    };

    localStorage.setItem(this.ACTIVE_SESSION_KEY, JSON.stringify(payload));
  }

  getPersistedSession() {
    const raw = localStorage.getItem(this.ACTIVE_SESSION_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async restoreActiveSession() {
    const persisted = this.getPersistedSession();
    if (!persisted?.session?.sessionId) {
      return null;
    }

    const studentId = authService.getStudentId();
    if (
      persisted.session.studentId &&
      studentId &&
      String(persisted.session.studentId) !== String(studentId)
    ) {
      this.clearSession();
      return null;
    }

    try {
      const sessionResponse = await apiClient.nodeGet(
        `/tests/${persisted.session.sessionId}`,
      );

      if (!sessionResponse?.success || !sessionResponse?.session) {
        this.clearSession();
        return null;
      }

      const serverSession = sessionResponse.session;
      if (
        serverSession.status === "completed" ||
        serverSession.status === "abandoned"
      ) {
        this.clearSession();
        return null;
      }

      const questionsResponse = await apiClient.nodeGet(
        `/tests/${persisted.session.sessionId}/questions`,
        {
          page: 1,
          limit: 500,
        },
      );

      const mergedQuestions =
        questionsResponse?.questions?.length > 0
          ? questionsResponse.questions
          : persisted.session.questions || [];

      this.currentSession = {
        ...persisted.session,
        ...serverSession,
        questions: mergedQuestions,
        totalQuestions: serverSession.totalQuestions || mergedQuestions.length,
        config: serverSession.config || persisted.session.config,
      };

      const currentIndex = Math.max(
        0,
        this.currentSession.currentQuestionIndex || 0,
      );

      this.currentQuestion =
        mergedQuestions[currentIndex] || persisted.currentQuestion || null;

      this.answers = questionsResponse?.answers || [];
      this.persistActiveSession();

      return {
        session: this.currentSession,
        currentQuestion: this.currentQuestion,
      };
    } catch (error) {
      this.clearSession();
      return null;
    }
  }
}

// Create and export singleton instance
const testService = new TestService();
testService.initialize();
export default testService;
