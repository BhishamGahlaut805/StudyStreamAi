// constants.js
module.exports = {
  TEST_TYPES: {
    PRACTICE: "practice",
    REAL: "real",
  },

  TEST_STATUS: {
    ACTIVE: "active",
    PAUSED: "paused",
    COMPLETED: "completed",
    ABANDONED: "abandoned",
  },

  QUESTION_TYPES: {
    MCQ: "MCQ",
    MSQ: "MSQ",
    NAT: "NAT",
  },

  DIFFICULTY_LEVELS: {
    VERY_EASY: "very_easy",
    EASY: "easy",
    MEDIUM: "medium",
    HARD: "hard",
    VERY_HARD: "very_hard",
  },

  MASTERY_LEVELS: {
    BEGINNER: "beginner",
    INTERMEDIATE: "intermediate",
    ADVANCED: "advanced",
    EXPERT: "expert",
  },

  PERFORMANCE_PERIODS: {
    DAILY: "daily",
    WEEKLY: "weekly",
    MONTHLY: "monthly",
  },

  SOCKET_EVENTS: {
    JOIN_TEST: "join-test",
    TEST_JOINED: "test-joined",
    SUBMIT_ANSWER: "submit-answer",
    ANSWER_CONFIRMED: "answer-confirmed",
    ANSWER_PROCESSED: "answer-processed",
    NEXT_QUESTION: "next-question",
    NEXT_QUESTION_RECEIVED: "next-question-received",
    NO_MORE_QUESTIONS: "no-more-questions",
    ANALYTICS_UPDATE: "analytics-update",
    TIMER_UPDATE: "timer-update",
    TIMER_COMPLETE: "timer-complete",
    TEST_COMPLETED: "test-completed",
    TEST_TIMEOUT: "test-timeout",
    TEST_PAUSED: "test-paused",
    TEST_RESUMED: "test-resumed",
    ADD_QUESTIONS: "add-questions",
    QUESTIONS_ADDED: "questions-added",
    QUESTIONS_UPDATED: "questions-updated",
    SKIP_QUESTION: "skip-question",
    QUESTION_SKIPPED: "question-skipped",
    REQUEST_ANALYTICS: "request-analytics",
    END_TEST: "end-test",
    TEST_ENDED: "test-ended",
    ERROR: "error",
  },
};
