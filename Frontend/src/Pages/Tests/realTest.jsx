import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FiAlertCircle,
  FiBookmark,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiFlag,
  FiList,
  FiMaximize2,
  FiMinimize2,
  FiSend,
} from "react-icons/fi";
import { useTheme } from "../../context/ThemeContext";
import testService from "../../services/testService";
import analyticsService from "../../services/analyticsService";
import apiClient from "../../services/utils/apiClient";

const EXAM_DURATION_SECONDS = 60 * 60;
const RUNTIME_KEY_PREFIX = "realExamRuntime:";

const getQuestionId = (question) =>
  question?.id || question?._id || question?.questionId || null;

const formatTime = (seconds) => {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

const subjectLabel = (subject = "") => {
  const map = {
    mathematics: "Mathematics",
    english: "English",
    reasoning: "Reasoning",
    general_knowledge: "General Knowledge",
  };
  return map[subject] || "General";
};

const difficultyLabel = (difficulty = 0.5) => {
  const value = Number(difficulty) || 0.5;
  if (value < 0.3) return "Easy";
  if (value < 0.5) return "Medium-Easy";
  if (value < 0.7) return "Medium";
  if (value < 0.85) return "Medium-Hard";
  return "Hard";
};

const inferSubjectKey = (question, index = 0, total = 100) => {
  if (question?.subject) return question.subject;

  const topic = String(
    question?.topic || question?.conceptArea || "",
  ).toLowerCase();

  const mathKeywords = [
    "algebra",
    "geometry",
    "trigonometry",
    "percentage",
    "ratio",
    "probability",
    "mensuration",
    "interest",
    "number",
    "statistics",
  ];
  const englishKeywords = [
    "grammar",
    "vocabulary",
    "synonym",
    "antonym",
    "sentence",
    "reading",
    "cloze",
    "idiom",
    "phrase",
  ];
  const reasoningKeywords = [
    "analogy",
    "series",
    "coding",
    "blood",
    "direction",
    "syllogism",
    "ranking",
    "puzzle",
    "logical",
  ];

  if (mathKeywords.some((keyword) => topic.includes(keyword))) {
    return "mathematics";
  }
  if (englishKeywords.some((keyword) => topic.includes(keyword))) {
    return "english";
  }
  if (reasoningKeywords.some((keyword) => topic.includes(keyword))) {
    return "reasoning";
  }

  if (total >= 100) {
    if (index < 25) return "mathematics";
    if (index < 50) return "english";
    if (index < 75) return "reasoning";
    return "general_knowledge";
  }

  return "general_knowledge";
};

const RealTest = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark } = useTheme();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [session, setSession] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [globalRemaining, setGlobalRemaining] = useState(EXAM_DURATION_SECONDS);
  const [questionElapsed, setQuestionElapsed] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [answerChanges, setAnswerChanges] = useState({});
  const [submittedMap, setSubmittedMap] = useState({});
  const [reviewMap, setReviewMap] = useState({});
  const [visitedMap, setVisitedMap] = useState({});
  const [timeByQuestion, setTimeByQuestion] = useState({});
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [finalSubmitting, setFinalSubmitting] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const questionStartRef = useRef(0);
  const examEndAtRef = useRef(0);
  const finalizeCalledRef = useRef(false);
  const finalSubmitHandlerRef = useRef(() => {});

  const currentQuestion = questions[currentIndex] || null;
  const currentQuestionId = getQuestionId(currentQuestion);
  const runtimeStorageKey = session?.sessionId
    ? `${RUNTIME_KEY_PREFIX}${session.sessionId}`
    : null;

  useEffect(() => {
    const initialize = async () => {
      try {
        let activeSession =
          location.state?.session || testService.currentSession;

        if (!activeSession?.sessionId) {
          const restored = await testService.restoreActiveSession();
          activeSession = restored?.session || null;
        }

        if (!activeSession?.sessionId || activeSession?.testType !== "real") {
          navigate("/test/practice", { replace: true });
          return;
        }

        let examQuestions = Array.isArray(activeSession.questions)
          ? activeSession.questions
          : [];

        try {
          const response = await apiClient.nodeGet(
            `/tests/${activeSession.sessionId}/questions`,
            { page: 1, limit: 500 },
          );
          if (
            Array.isArray(response?.questions) &&
            response.questions.length > 0
          ) {
            examQuestions = response.questions;
          }
        } catch {
          // keep currently available questions
        }
        const startIndex = Math.max(0, activeSession.currentQuestionIndex || 0);

        const startMs = new Date(activeSession.startTime).getTime();
        const baseEndAt = Number.isFinite(startMs)
          ? startMs + EXAM_DURATION_SECONDS * 1000
          : Date.now() + EXAM_DURATION_SECONDS * 1000;

        let persistedRuntime = null;
        try {
          const raw = localStorage.getItem(
            `${RUNTIME_KEY_PREFIX}${activeSession.sessionId}`,
          );
          persistedRuntime = raw ? JSON.parse(raw) : null;
        } catch {
          persistedRuntime = null;
        }

        const persistedEndAt = Number(persistedRuntime?.examEndAt || 0);
        examEndAtRef.current =
          persistedEndAt > Date.now() - EXAM_DURATION_SECONDS * 1000
            ? persistedEndAt
            : baseEndAt;

        const runtimeRemaining = Math.max(
          0,
          Math.floor((examEndAtRef.current - Date.now()) / 1000),
        );

        const runtimeSubmitted =
          persistedRuntime && typeof persistedRuntime.submittedMap === "object"
            ? persistedRuntime.submittedMap
            : {};
        const runtimeSelected =
          persistedRuntime &&
          typeof persistedRuntime.selectedAnswers === "object"
            ? persistedRuntime.selectedAnswers
            : {};
        const runtimeVisited =
          persistedRuntime && typeof persistedRuntime.visitedMap === "object"
            ? persistedRuntime.visitedMap
            : {};
        const runtimeReview =
          persistedRuntime && typeof persistedRuntime.reviewMap === "object"
            ? persistedRuntime.reviewMap
            : {};
        const runtimeChanges =
          persistedRuntime && typeof persistedRuntime.answerChanges === "object"
            ? persistedRuntime.answerChanges
            : {};
        const runtimeTimes =
          persistedRuntime &&
          typeof persistedRuntime.timeByQuestion === "object"
            ? { ...persistedRuntime.timeByQuestion }
            : {};

        if (
          persistedRuntime?.activeQuestionId &&
          !runtimeSubmitted[persistedRuntime.activeQuestionId] &&
          persistedRuntime?.lastHeartbeatAt
        ) {
          const extra = Math.max(
            0,
            Math.floor(
              (Date.now() - Number(persistedRuntime.lastHeartbeatAt)) / 1000,
            ),
          );
          runtimeTimes[persistedRuntime.activeQuestionId] =
            Number(runtimeTimes[persistedRuntime.activeQuestionId] || 0) +
            extra;
        }

        const answersFromService = Array.isArray(testService.answers)
          ? testService.answers
          : [];
        const submittedFromService = {};
        const selectedFromService = {};
        const visitedFromService = {};
        const timesFromService = {};
        const changesFromService = {};

        answersFromService.forEach((answer) => {
          const qid = String(answer?.questionId || answer?.question_id || "");
          if (!qid) return;
          submittedFromService[qid] = true;
          visitedFromService[qid] = true;
          selectedFromService[qid] = answer?.selectedOptions;
          timesFromService[qid] = Number(answer?.timeSpent || 0);
          changesFromService[qid] = Number(answer?.answerChanges || 0);
        });

        const restoredIndex = Math.min(
          Math.max(
            0,
            Number.isFinite(Number(persistedRuntime?.currentIndex))
              ? Number(persistedRuntime.currentIndex)
              : startIndex,
          ),
          Math.max(0, examQuestions.length - 1),
        );

        setSession(activeSession);
        setQuestions(examQuestions);
        setCurrentIndex(restoredIndex);
        setGlobalRemaining(runtimeRemaining);
        setSelectedAnswers({ ...runtimeSelected, ...selectedFromService });
        setAnswerChanges({ ...runtimeChanges, ...changesFromService });
        setSubmittedMap({ ...runtimeSubmitted, ...submittedFromService });
        setReviewMap({ ...runtimeReview });
        setVisitedMap({ ...runtimeVisited, ...visitedFromService });
        setTimeByQuestion({ ...runtimeTimes, ...timesFromService });

        const firstQuestion = examQuestions[restoredIndex] || examQuestions[0];
        const firstQuestionId = getQuestionId(firstQuestion);
        if (firstQuestionId) {
          setVisitedMap((prev) => ({ ...prev, [firstQuestionId]: true }));
          const isAlreadySubmitted =
            runtimeSubmitted[firstQuestionId] ||
            submittedFromService[firstQuestionId];
          questionStartRef.current = isAlreadySubmitted ? 0 : Date.now();
        }

        testService.currentSession = {
          ...activeSession,
          questions: examQuestions,
          totalQuestions: examQuestions.length,
          currentQuestionIndex: restoredIndex,
        };
        testService.currentQuestion = firstQuestion || null;
        testService.persistActiveSession();
      } catch (err) {
        setError(err?.message || "Could not initialize real exam session");
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, [location.state?.session, navigate]);

  useEffect(() => {
    const onFullScreenChange = () => {
      setIsFullScreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", onFullScreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullScreenChange);
    };
  }, []);

  const toggleFullScreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // no-op
    }
  };

  useEffect(() => {
    if (!session?.sessionId) return;

    const timerId = setInterval(() => {
      const next = Math.max(
        0,
        Math.floor((examEndAtRef.current - Date.now()) / 1000),
      );

      setGlobalRemaining(next);

      if (next === 0 && !finalizeCalledRef.current) {
        setTimeout(() => {
          if (!finalizeCalledRef.current) {
            finalSubmitHandlerRef.current(true);
          }
        }, 0);
      }
    }, 1000);

    return () => clearInterval(timerId);
  }, [session?.sessionId]);

  useEffect(() => {
    if (!currentQuestionId) {
      setQuestionElapsed(0);
      return;
    }

    const elapsedId = setInterval(() => {
      const base = Number(timeByQuestion[currentQuestionId] || 0);
      const running = questionStartRef.current
        ? Math.floor((Date.now() - questionStartRef.current) / 1000)
        : 0;
      setQuestionElapsed(Math.max(0, base + running));
    }, 1000);

    return () => clearInterval(elapsedId);
  }, [currentQuestionId, timeByQuestion]);

  const persistCurrentQuestionTime = useCallback(() => {
    if (!currentQuestionId) return 0;

    const elapsedSinceStart = questionStartRef.current
      ? Math.max(0, Math.floor((Date.now() - questionStartRef.current) / 1000))
      : 0;

    const previous = Number(timeByQuestion[currentQuestionId] || 0);
    const total = previous + elapsedSinceStart;

    setTimeByQuestion((prev) => ({
      ...prev,
      [currentQuestionId]: total,
    }));

    questionStartRef.current = Date.now();
    setQuestionElapsed(total);
    return total;
  }, [currentQuestionId, timeByQuestion]);

  const syncServiceQuestionPointer = useCallback(
    (index) => {
      const question = questions[index] || null;
      if (!question) return;

      if (testService.currentSession) {
        testService.currentSession.currentQuestionIndex = index;
      } else if (session) {
        testService.currentSession = {
          ...session,
          currentQuestionIndex: index,
        };
      }

      testService.currentQuestion = question;
      testService.persistActiveSession();
    },
    [questions, session],
  );

  const goToQuestion = useCallback(
    (targetIndex) => {
      if (targetIndex < 0 || targetIndex >= questions.length) return;

      persistCurrentQuestionTime();
      setCurrentIndex(targetIndex);

      const targetQuestion = questions[targetIndex];
      const targetQuestionId = getQuestionId(targetQuestion);
      if (targetQuestionId) {
        setVisitedMap((prev) => ({ ...prev, [targetQuestionId]: true }));
      }

      questionStartRef.current = submittedMap[targetQuestionId]
        ? 0
        : Date.now();
      syncServiceQuestionPointer(targetIndex);
    },
    [
      persistCurrentQuestionTime,
      questions,
      submittedMap,
      syncServiceQuestionPointer,
    ],
  );

  const handleSelectOption = (value) => {
    if (!currentQuestionId || submittedMap[currentQuestionId]) return;

    setSelectedAnswers((prev) => {
      const previousValue = prev[currentQuestionId];
      if (
        previousValue !== undefined &&
        String(previousValue) !== String(value)
      ) {
        setAnswerChanges((changes) => ({
          ...changes,
          [currentQuestionId]: (changes[currentQuestionId] || 0) + 1,
        }));
      }
      return {
        ...prev,
        [currentQuestionId]: value,
      };
    });
  };

  const submitQuestionByIndex = useCallback(
    async (index) => {
      const question = questions[index];
      const questionId = getQuestionId(question);
      if (!question || !questionId || submittedMap[questionId]) return false;

      const answerValue = selectedAnswers[questionId];
      if (
        answerValue === undefined ||
        answerValue === null ||
        answerValue === ""
      ) {
        return false;
      }

      const timeSpent =
        index === currentIndex
          ? persistCurrentQuestionTime()
          : Number(timeByQuestion[questionId] || 0);

      syncServiceQuestionPointer(index);

      await testService.submitAnswer({
        selectedOptions: answerValue,
        timeSpent,
        answerChanges: Number(answerChanges[questionId] || 0),
        confidence: 0.7,
      });

      setSubmittedMap((prev) => ({
        ...prev,
        [questionId]: true,
      }));

      if (index === currentIndex) {
        questionStartRef.current = 0;
        setQuestionElapsed(Number(timeSpent || 0));
      }

      return true;
    },
    [
      answerChanges,
      currentIndex,
      persistCurrentQuestionTime,
      questions,
      selectedAnswers,
      submittedMap,
      syncServiceQuestionPointer,
      timeByQuestion,
    ],
  );

  const handleSaveAndNext = async () => {
    if (!currentQuestionId || submittingAnswer || finalSubmitting) return;

    setError("");
    setSubmittingAnswer(true);
    try {
      const alreadySubmitted = !!submittedMap[currentQuestionId];

      if (!alreadySubmitted) {
        const hasAnswer =
          selectedAnswers[currentQuestionId] !== undefined &&
          selectedAnswers[currentQuestionId] !== null &&
          selectedAnswers[currentQuestionId] !== "";

        if (hasAnswer) {
          await submitQuestionByIndex(currentIndex);
        }
      }

      if (currentIndex < questions.length - 1) {
        goToQuestion(currentIndex + 1);
      }
    } catch (err) {
      setError(err?.message || "Failed to submit answer");
    } finally {
      setSubmittingAnswer(false);
    }
  };

  const handleMarkForReview = () => {
    if (!currentQuestionId || finalSubmitting) return;

    setReviewMap((prev) => ({
      ...prev,
      [currentQuestionId]: !prev[currentQuestionId],
    }));

    if (currentIndex < questions.length - 1) {
      goToQuestion(currentIndex + 1);
    }
  };

  const handleFinalSubmit = useCallback(
    async (fromTimeout = false) => {
      if (finalizeCalledRef.current) return;
      finalizeCalledRef.current = true;
      setFinalSubmitting(true);
      setError("");

      try {
        persistCurrentQuestionTime();

        for (let i = 0; i < questions.length; i += 1) {
          const question = questions[i];
          const questionId = getQuestionId(question);
          if (!questionId || submittedMap[questionId]) continue;
          await submitQuestionByIndex(i);
        }

        const answers = [...(testService.answers || [])];
        const answeredQuestions = answers.length;
        const correctCount = answers.filter(
          (answer) => answer.isCorrect,
        ).length;
        const wrongCount = Math.max(0, answeredQuestions - correctCount);
        const sessionTime = EXAM_DURATION_SECONDS - globalRemaining;
        const averageTimePerQuestion =
          answeredQuestions > 0
            ? Math.round(
                answers.reduce(
                  (sum, answer) => sum + (answer.timeSpent || 0),
                  0,
                ) / answeredQuestions,
              )
            : 0;

        const metrics = {
          totalQuestions: questions.length,
          answeredQuestions,
          correctCount,
          wrongCount,
          currentAccuracy:
            answeredQuestions > 0
              ? (correctCount / answeredQuestions) * 100
              : 0,
          sessionTime,
          averageTimePerQuestion,
          timeout: fromTimeout,
        };

        const performance = testService.buildPerformanceObject
          ? testService.buildPerformanceObject()
          : {
              topicPerformance: [],
              testHistory: [],
              overallStats: {
                totalQuestions: questions.length,
                totalCorrect: correctCount,
                accuracy: metrics.currentAccuracy,
                totalTimeSpent: sessionTime / 60,
              },
            };

        const modelsData =
          analyticsService.calculateAllModels(performance) || {};

        testService.endTest();
        testService.clearSession();
        if (runtimeStorageKey) {
          localStorage.removeItem(runtimeStorageKey);
        }

        navigate("/test/results", {
          replace: true,
          state: {
            answers,
            metrics,
            modelsData,
            session: {
              ...(session || {}),
              status: "completed",
              completedAt: new Date().toISOString(),
              questions,
            },
            flaskPredictions: {
              method: "real_exam",
              nextDifficulty:
                location.state?.examDifficulty ||
                session?.config?.difficulty ||
                0.5,
            },
          },
        });
      } catch (err) {
        finalizeCalledRef.current = false;
        setError(err?.message || "Failed to submit final test");
      } finally {
        setFinalSubmitting(false);
      }
    },
    [
      globalRemaining,
      location.state?.examDifficulty,
      navigate,
      persistCurrentQuestionTime,
      questions,
      runtimeStorageKey,
      session,
      submitQuestionByIndex,
      submittedMap,
    ],
  );

  useEffect(() => {
    finalSubmitHandlerRef.current = handleFinalSubmit;
  }, [handleFinalSubmit]);

  useEffect(() => {
    if (!runtimeStorageKey || !session?.sessionId) return;

    const payload = {
      sessionId: session.sessionId,
      currentIndex,
      selectedAnswers,
      answerChanges,
      submittedMap,
      reviewMap,
      visitedMap,
      timeByQuestion,
      globalRemaining,
      examEndAt: examEndAtRef.current,
      activeQuestionId: currentQuestionId,
      lastHeartbeatAt: Date.now(),
    };

    localStorage.setItem(runtimeStorageKey, JSON.stringify(payload));
  }, [
    answerChanges,
    currentIndex,
    currentQuestionId,
    globalRemaining,
    runtimeStorageKey,
    reviewMap,
    selectedAnswers,
    session?.sessionId,
    submittedMap,
    timeByQuestion,
    visitedMap,
  ]);

  useEffect(() => {
    if (!runtimeStorageKey || !session?.sessionId) return;

    const heartbeatId = setInterval(() => {
      const raw = localStorage.getItem(runtimeStorageKey);
      if (!raw) return;

      try {
        const parsed = JSON.parse(raw);
        parsed.lastHeartbeatAt = Date.now();
        parsed.examEndAt = examEndAtRef.current;
        parsed.activeQuestionId = currentQuestionId;
        localStorage.setItem(runtimeStorageKey, JSON.stringify(parsed));
      } catch {
        // no-op
      }
    }, 1000);

    return () => clearInterval(heartbeatId);
  }, [currentQuestionId, runtimeStorageKey, session?.sessionId]);

  const paletteData = useMemo(() => {
    return questions.map((question, index) => {
      const questionId = getQuestionId(question);
      const isCurrent = index === currentIndex;
      const isSubmitted = !!submittedMap[questionId];
      const isVisited = !!visitedMap[questionId];
      const isReview = !!reviewMap[questionId];

      let status = "not-visited";
      if (isReview && isSubmitted) status = "review-answered";
      else if (isReview) status = "review";
      else if (isSubmitted) status = "answered";
      else if (isVisited) status = "not-answered";

      return {
        question,
        index,
        questionId,
        status,
        isCurrent,
        subjectKey: inferSubjectKey(question, index, questions.length),
      };
    });
  }, [currentIndex, questions, reviewMap, submittedMap, visitedMap]);

  const stats = useMemo(() => {
    const statusCounts = {
      answered: 0,
      notAnswered: 0,
      markedForReview: 0,
      markedForReviewAnswered: 0,
      notVisited: 0,
    };

    paletteData.forEach((item) => {
      if (item.status === "review-answered")
        statusCounts.markedForReviewAnswered += 1;
      else if (item.status === "review") statusCounts.markedForReview += 1;
      else if (item.status === "answered") statusCounts.answered += 1;
      else if (item.status === "not-answered") statusCounts.notAnswered += 1;
      else statusCounts.notVisited += 1;
    });

    return {
      ...statusCounts,
      visited: Math.max(0, questions.length - statusCounts.notVisited),
    };
  }, [paletteData, questions.length]);

  const testDifficulty =
    Number(
      location.state?.examDifficulty ?? session?.config?.difficulty ?? 0.5,
    ) || 0.5;

  const paletteSections = useMemo(() => {
    const bySubject = {
      mathematics: [],
      english: [],
      reasoning: [],
      general_knowledge: [],
    };

    paletteData.forEach((item) => {
      const key = item.subjectKey;
      if (bySubject[key]) bySubject[key].push(item);
    });

    const orderedSubjects = [
      "mathematics",
      "english",
      "reasoning",
      "general_knowledge",
    ];

    return orderedSubjects.map((subjectKey) => {
      const items = bySubject[subjectKey] || [];

      return {
        subjectKey,
        label: subjectLabel(subjectKey),
        items,
      };
    });
  }, [paletteData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session || questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-xl w-full rounded-2xl border border-red-300 bg-red-50 dark:bg-red-900/20 p-6 text-red-700 dark:text-red-300">
          <div className="flex items-center gap-2 font-semibold">
            <FiAlertCircle />
            <span>No active real exam session found.</span>
          </div>
          <button
            onClick={() => navigate("/test/practice")}
            className="mt-4 rounded-lg bg-purple-600 px-4 py-2 text-white"
          >
            Go to Test Setup
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-purple-50/40 dark:from-dark-100 dark:via-dark-100 dark:to-slate-900 px-2 py-3 md:px-6 md:py-5">
      <div className="w-full">
        <div className="mb-4 rounded-2xl border border-indigo-100/80 dark:border-slate-700 bg-white/90 dark:bg-dark-200/90 backdrop-blur p-4 md:p-5 shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent">
                Real Exam Interface
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                100 Questions • 25 per subject • Submit before time ends
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleFullScreen}
                className="rounded-xl border border-indigo-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-xs md:text-sm font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
              >
                {isFullScreen ? <FiMinimize2 /> : <FiMaximize2 />}
                {isFullScreen ? "Exit Full Screen" : "Full Screen"}
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 px-3 py-2">
                <p className="text-xs text-slate-500">Answered</p>
                <p className="text-lg font-bold text-green-600">
                  {stats.answered}
                </p>
              </div>
              <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 px-3 py-2">
                <p className="text-xs text-slate-500">Not Answered</p>
                <p className="text-lg font-bold text-amber-600">
                  {stats.notAnswered}
                </p>
              </div>
              <div className="rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 px-3 py-2">
                <p className="text-xs text-slate-500">Review</p>
                <p className="text-lg font-bold text-purple-600">
                  {stats.markedForReview}
                </p>
              </div>
              <div className="rounded-xl bg-fuchsia-50 dark:bg-fuchsia-900/20 border border-fuchsia-100 dark:border-fuchsia-800 px-3 py-2">
                <p className="text-xs text-slate-500">Review + Answered</p>
                <p className="text-lg font-bold text-fuchsia-600">
                  {stats.markedForReviewAnswered}
                </p>
              </div>
              <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 px-3 py-2">
                <p className="text-xs text-slate-500">Question Timer</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                  {formatTime(questionElapsed)}
                </p>
              </div>
              <div
                className={`rounded-xl px-3 py-2 border ${
                  globalRemaining <= 600
                    ? "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700"
                    : "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800"
                }`}
              >
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <FiClock /> Main Timer
                </p>
                <p
                  className={`text-lg font-extrabold ${
                    globalRemaining <= 600
                      ? "text-red-600 dark:text-red-400"
                      : "text-slate-900 dark:text-white"
                  }`}
                >
                  {formatTime(globalRemaining)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-700 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 xl:gap-5">
          <div className="xl:col-span-8 2xl:col-span-9 rounded-2xl border border-indigo-100/80 dark:border-slate-700 bg-white/95 dark:bg-dark-200/95 backdrop-blur p-4 md:p-6 shadow-md">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Question {currentIndex + 1} of {questions.length}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {subjectLabel(currentQuestion?.subject)} •{" "}
                  {currentQuestion?.topic || "General"}
                </p>
              </div>
              {submittedMap[currentQuestionId] && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/30 px-3 py-1 text-xs font-semibold text-green-700 dark:text-green-300">
                  <FiCheck /> Answer Saved
                </span>
              )}
            </div>

            <p className="text-base md:text-lg font-medium text-slate-900 dark:text-white leading-relaxed mb-5 bg-gradient-to-r from-slate-50 to-indigo-50/60 dark:from-slate-900/40 dark:to-indigo-900/20 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
              {currentQuestion?.text}
            </p>

            {currentQuestion?.type === "NAT" ? (
              <input
                type="text"
                value={selectedAnswers[currentQuestionId] || ""}
                onChange={(event) => handleSelectOption(event.target.value)}
                disabled={!!submittedMap[currentQuestionId]}
                placeholder="Enter numerical answer"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
              />
            ) : (
              <div className="space-y-3">
                {(currentQuestion?.options || []).map((option, optionIndex) => {
                  const optionId =
                    option?.id ??
                    option?._id ??
                    option?.optionId ??
                    option?.key ??
                    option?.value ??
                    optionIndex;
                  const optionValue = String(optionId);
                  const selectedValue = String(
                    selectedAnswers[currentQuestionId] ?? "",
                  );
                  const isSelected = selectedValue === optionValue;

                  return (
                    <button
                      key={optionValue}
                      type="button"
                      onClick={() => handleSelectOption(optionValue)}
                      disabled={!!submittedMap[currentQuestionId]}
                      className={`w-full text-left rounded-xl border px-4 py-3 transition ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-sm"
                          : "border-slate-200 dark:border-slate-700 hover:border-indigo-300 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10"
                      } ${submittedMap[currentQuestionId] ? "opacity-80 cursor-not-allowed" : ""}`}
                    >
                      <span className="font-semibold mr-2">
                        {String.fromCharCode(65 + optionIndex)}.
                      </span>
                      <span>
                        {option?.text || option?.value || optionValue}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => goToQuestion(currentIndex - 1)}
                disabled={currentIndex === 0 || finalSubmitting}
                className="rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 disabled:opacity-50 flex items-center gap-1 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <FiChevronLeft /> Previous
              </button>
              <button
                onClick={handleSaveAndNext}
                disabled={submittingAnswer || finalSubmitting}
                className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 flex items-center gap-1 shadow-md hover:shadow-lg"
              >
                {submittingAnswer ? "Saving..." : "Save & Next"}{" "}
                <FiChevronRight />
              </button>
              <button
                onClick={handleMarkForReview}
                disabled={finalSubmitting}
                className={`rounded-xl px-4 py-2 text-sm font-semibold border disabled:opacity-50 flex items-center gap-1 ${
                  reviewMap[currentQuestionId]
                    ? "bg-purple-100 dark:bg-purple-900/30 border-purple-400 text-purple-700 dark:text-purple-300"
                    : "border-purple-300 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                }`}
              >
                <FiBookmark />{" "}
                {reviewMap[currentQuestionId]
                  ? "Unmark Review"
                  : "Mark for Review"}
              </button>
            </div>
          </div>

          <div className="xl:col-span-4 2xl:col-span-3 rounded-2xl border border-indigo-100/80 dark:border-slate-700 bg-white/95 dark:bg-dark-200/95 backdrop-blur p-4 shadow-md xl:sticky xl:top-4 self-start">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FiList /> Question Palette
              </h2>
              <span className="text-xs text-slate-500">
                1-{questions.length}
              </span>
            </div>

            <p className="mb-3 text-[11px] text-slate-600 dark:text-slate-300 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1">
              Whole test difficulty: {(testDifficulty * 100).toFixed(0)}% (
              {difficultyLabel(testDifficulty)})
            </p>

            <div className="max-h-[460px] overflow-y-auto pr-1 space-y-3">
              {paletteSections.map((section) => (
                <div
                  key={section.subjectKey}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 p-2"
                >
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">
                    {section.label}: {section.items.length}/25
                  </p>

                  <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
                    {section.items.map((item) => {
                      const baseClass =
                        item.status === "review-answered"
                          ? "bg-fuchsia-600 text-white border-fuchsia-600"
                          : item.status === "review"
                            ? "bg-purple-600 text-white border-purple-600"
                            : item.status === "answered"
                              ? "bg-green-500/90 text-white border-green-500"
                              : item.status === "not-answered"
                                ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700";

                      const currentClass = item.isCurrent
                        ? "ring-2 ring-indigo-500"
                        : "";

                      return (
                        <button
                          key={item.questionId || item.index}
                          onClick={() => goToQuestion(item.index)}
                          disabled={finalSubmitting}
                          className={`h-10 rounded-lg border text-sm font-semibold transition ${baseClass} ${currentClass}`}
                          title={`Question ${item.index + 1}`}
                        >
                          {item.index + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 text-xs">
              <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 px-2 py-1 flex justify-between">
                <span>Answered</span>
                <span className="font-semibold">{stats.answered}</span>
              </div>
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-2 py-1 flex justify-between">
                <span>Not Answered</span>
                <span className="font-semibold">{stats.notAnswered}</span>
              </div>
              <div className="rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 px-2 py-1 flex justify-between">
                <span>Marked for Review</span>
                <span className="font-semibold">{stats.markedForReview}</span>
              </div>
              <div className="rounded-lg bg-fuchsia-50 dark:bg-fuchsia-900/20 border border-fuchsia-200 dark:border-fuchsia-700 px-2 py-1 flex justify-between">
                <span>Marked for Review + Answered</span>
                <span className="font-semibold">
                  {stats.markedForReviewAnswered}
                </span>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-700 px-2 py-1 flex justify-between">
                <span>Not Visited</span>
                <span className="font-semibold">{stats.notVisited}</span>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: finalSubmitting ? 1 : 1.02 }}
              whileTap={{ scale: finalSubmitting ? 1 : 0.98 }}
              onClick={() => handleFinalSubmit(false)}
              disabled={finalSubmitting}
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-red-600 to-pink-600 text-white py-3 font-bold shadow-lg disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {finalSubmitting ? (
                "Submitting Final Exam..."
              ) : (
                <>
                  <FiSend /> Submit Final Exam
                  <FiFlag />
                </>
              )}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealTest;
