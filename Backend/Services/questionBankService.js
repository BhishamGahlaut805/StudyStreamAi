const fs = require("fs");
const path = require("path");
const Question = require("../models/question");

class QuestionBankService {
  constructor() {
    this.questions = {
      mathematics: [],
      english: [],
      reasoning: [],
      general_knowledge: [],
    };
    this.retentionQuestions = {
      english: [],
      gk: [],
    };
    this.loadQuestions();
    this.loadRetentionQuestions();
  }

  normalizeRetentionTopic(subject, topic = "") {
    const raw = this.normalizeTopic(topic);
    if (subject === "english") {
      if (raw.includes("vocabulary")) return "vocabulary";
      if (raw.includes("idiom") || raw.includes("phrase"))
        return raw.includes("idiom") ? "idioms" : "phrases";
      if (raw.includes("synonym")) return "synonyms";
      if (raw.includes("antonym")) return "antonyms";
      if (raw.includes("one word") || raw.includes("substitution"))
        return "one_word_substitution";
      return null;
    }

    if (subject === "gk") {
      if (raw.includes("history")) return "history";
      if (raw.includes("geography")) return "geography";
      if (raw.includes("science")) return "science";
      if (raw.includes("current") || raw.includes("affair"))
        return "current_affairs";
      return null;
    }

    return null;
  }

  normalizeQuestionRecord(q, fallbackSubject) {
    return {
      ...q,
      subject: q.subject || fallbackSubject,
      questionId: q.questionId || q.id,
      id: q.id || q.questionId,
      difficulty: Number(q.difficulty ?? 0.5),
      difficultyLevel: q.difficultyLevel || q.difficulty_level,
      correctAnswer: q.correctAnswer ?? q.correct_answer,
      expectedTime: q.expectedTime ?? q.expected_time ?? 90,
      topicCategory: q.topicCategory || q.topic,
    };
  }

  normalizeTopic(topic = "") {
    return String(topic)
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  matchesSelectedTopics(questionTopic, selectedTopics = []) {
    if (!Array.isArray(selectedTopics) || selectedTopics.length === 0) {
      return true;
    }

    const questionNormalized = this.normalizeTopic(questionTopic);
    const selectedNormalized = selectedTopics.map((topic) =>
      this.normalizeTopic(topic),
    );

    return selectedNormalized.includes(questionNormalized);
  }

  loadQuestions() {
    const subjects = [
      "mathematics",
      "english",
      "reasoning",
      "general_knowledge",
    ];

    subjects.forEach((subject) => {
      try {
        const filePath = path.join(__dirname, "../data", `${subject}.json`);
        if (fs.existsSync(filePath)) {
          const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
          this.questions[subject] = data.questions.map((q) =>
            this.normalizeQuestionRecord(
              {
                ...q,
                subject,
              },
              subject,
            ),
          );
        }
      } catch (error) {
        console.error(`Error loading ${subject} questions:`, error);
      }
    });
  }

  loadRetentionQuestions() {
    const files = [
      { file: "english_retention.json", subject: "english" },
      { file: "gk_retention.json", subject: "gk" },
    ];

    files.forEach(({ file, subject }) => {
      try {
        const filePath = path.join(__dirname, "../data", file);
        if (!fs.existsSync(filePath)) {
          this.retentionQuestions[subject] = [];
          return;
        }

        const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
        const rawQuestions = Array.isArray(data.questions)
          ? data.questions
          : [];

        this.retentionQuestions[subject] = rawQuestions
          .map((q) => {
            const topic = this.normalizeRetentionTopic(
              subject,
              q.topic || q.topicCategory,
            );
            if (!topic) return null;
            return this.normalizeQuestionRecord(
              {
                ...q,
                subject,
                topic,
                topicCategory: topic,
              },
              subject,
            );
          })
          .filter(Boolean);
      } catch (error) {
        console.error(`Error loading retention questions from ${file}:`, error);
        this.retentionQuestions[subject] = [];
      }
    });
  }

  getRetentionQuestions({
    subject,
    topics = [],
    count = 10,
    excludeIds = [],
    minDifficulty = 0,
    maxDifficulty = 1,
  }) {
    const normalizedSubject = subject === "general_knowledge" ? "gk" : subject;
    const pool = this.retentionQuestions[normalizedSubject] || [];
    if (!pool.length) return [];

    const topicSet = new Set(
      (topics || []).map(
        (t) => this.normalizeRetentionTopic(normalizedSubject, t) || t,
      ),
    );

    const filtered = pool.filter((q) => {
      if (excludeIds.includes(q.questionId)) return false;
      if (q.difficulty < minDifficulty || q.difficulty > maxDifficulty)
        return false;
      if (topicSet.size > 0 && !topicSet.has(q.topic)) return false;
      return true;
    });

    return this.getRandomItems(filtered, count);
  }

  getRetentionQuestionById(questionId) {
    const all = [
      ...(this.retentionQuestions.english || []),
      ...(this.retentionQuestions.gk || []),
    ];
    return all.find((q) => q.questionId === questionId || q.id === questionId);
  }

  // Get questions by subject, topic, difficulty
  getQuestions({
    subject,
    topic,
    minDifficulty = 0,
    maxDifficulty = 1,
    count = 10,
    excludeIds = [],
  }) {
    if (!subject || !this.questions[subject]) {
      return [];
    }

    let filtered = this.questions[subject].filter(
      (q) =>
        q.difficulty >= minDifficulty &&
        q.difficulty <= maxDifficulty &&
        !excludeIds.includes(q.questionId),
    );

    if (topic) {
      filtered = filtered.filter((q) => q.topic === topic);
    }

    // Random selection
    const shuffled = this.shuffleArray(filtered);
    return shuffled.slice(0, count);
  }

  // Get questions for real exam (25 per subject, total 100)
  getRealExamQuestions(globalDifficulty = 0.5) {
    const examQuestions = [];
    const subjects = [
      "mathematics",
      "english",
      "reasoning",
      "general_knowledge",
    ];

    const targetPerSubject = 25;

    const safeDifficulty = Math.min(
      0.95,
      Math.max(0.1, Number(globalDifficulty) || 0.5),
    );

    let desiredMix = { easy: 10, medium: 10, hard: 5 };
    if (safeDifficulty < 0.4) {
      desiredMix = { easy: 14, medium: 8, hard: 3 };
    } else if (safeDifficulty > 0.7) {
      desiredMix = { easy: 5, medium: 10, hard: 10 };
    }

    const pickUnique = (source, count, usedIds) => {
      const available = source.filter((item) => !usedIds.has(item.questionId));
      const picked = this.getRandomItems(available, count);
      picked.forEach((item) => usedIds.add(item.questionId));
      return picked;
    };

    subjects.forEach((subject) => {
      const subjectQuestions = this.questions[subject] || [];
      if (!subjectQuestions.length) {
        return;
      }

      const easy = subjectQuestions.filter((q) => q.difficulty < 0.4);
      const medium = subjectQuestions.filter(
        (q) => q.difficulty >= 0.4 && q.difficulty < 0.7,
      );
      const hard = subjectQuestions.filter((q) => q.difficulty >= 0.7);

      const usedIds = new Set();
      let selected = [
        ...pickUnique(easy, desiredMix.easy, usedIds),
        ...pickUnique(medium, desiredMix.medium, usedIds),
        ...pickUnique(hard, desiredMix.hard, usedIds),
      ];

      if (selected.length < targetPerSubject) {
        const remainingNeeded = targetPerSubject - selected.length;
        selected = [
          ...selected,
          ...pickUnique(subjectQuestions, remainingNeeded, usedIds),
        ];
      }

      if (selected.length < targetPerSubject) {
        const withReplacement = this.getRandomItems(
          subjectQuestions,
          targetPerSubject - selected.length,
        );
        selected = [...selected, ...withReplacement];
      }

      examQuestions.push(...selected.slice(0, targetPerSubject));
    });

    if (examQuestions.length < subjects.length * targetPerSubject) {
      const all = this.getAllQuestions();
      const fill = this.getRandomItems(
        all,
        subjects.length * targetPerSubject - examQuestions.length,
      );
      examQuestions.push(...fill);
    }

    return examQuestions.slice(0, subjects.length * targetPerSubject);
  }

  // Get practice questions based on difficulty
  getPracticeQuestions(
    difficulty = 0.5,
    count = 2,
    excludeIds = [],
    selectedTopics = [],
  ) {
    const allQuestions = [
      ...this.questions.mathematics,
      ...this.questions.english,
      ...this.questions.reasoning,
      ...this.questions.general_knowledge,
    ];

    // Select questions around target difficulty
    const diffRange = 0.2;
    const candidates = allQuestions.filter(
      (q) =>
        Math.abs(q.difficulty - difficulty) <= diffRange &&
        !excludeIds.includes(q.questionId) &&
        this.matchesSelectedTopics(q.topic, selectedTopics),
    );

    if (candidates.length < count) {
      // Fallback to any questions
      const remaining = allQuestions.filter(
        (q) =>
          !excludeIds.includes(q.questionId) &&
          this.matchesSelectedTopics(q.topic, selectedTopics),
      );

      if (remaining.length > 0) {
        return this.getRandomItems(remaining, count);
      }

      // Final fallback: if selected topics produced no matches, use full pool
      return this.getRandomItems(
        allQuestions.filter((q) => !excludeIds.includes(q.questionId)),
        count,
      );
    }

    return this.getRandomItems(candidates, count);
  }

  // Get questions by topics
  getQuestionsByTopics(topics, count = 5) {
    const allQuestions = [
      ...this.questions.mathematics,
      ...this.questions.english,
      ...this.questions.reasoning,
      ...this.questions.general_knowledge,
    ];

    const filtered = allQuestions.filter((q) => topics.includes(q.topic));
    return this.getRandomItems(filtered, count);
  }

  // Get question by ID
  getQuestionById(questionId) {
    const allQuestions = [
      ...this.questions.mathematics,
      ...this.questions.english,
      ...this.questions.reasoning,
      ...this.questions.general_knowledge,
    ];
    return allQuestions.find((q) => q.questionId === questionId);
  }

  getAllQuestions() {
    return [
      ...this.questions.mathematics,
      ...this.questions.english,
      ...this.questions.reasoning,
      ...this.questions.general_knowledge,
    ];
  }

  // Get random items from array
  getRandomItems(array, count) {
    const shuffled = this.shuffleArray([...array]);
    return shuffled.slice(0, Math.min(count, array.length));
  }

  // Shuffle array
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // Get all topics
  getAllTopics() {
    const topics = new Set();
    Object.values(this.questions).forEach((subjectQuestions) => {
      subjectQuestions.forEach((q) => topics.add(q.topic));
    });
    return Array.from(topics);
  }

  // Get topics by subject
  getTopicsBySubject(subject) {
    if (!this.questions[subject]) return [];
    const topics = new Set();
    this.questions[subject].forEach((q) => topics.add(q.topic));
    return Array.from(topics);
  }
  /**
   * Get infinite practice questions (cycles through questions)
   */
  getInfinitePracticeQuestions(
    difficulty = 0.5,
    count = 2,
    excludeIds = [],
    cycleCount = 0,
    selectedTopics = [],
  ) {
    const allQuestionsRaw = [
      ...this.questions.mathematics,
      ...this.questions.english,
      ...this.questions.reasoning,
      ...this.questions.general_knowledge,
    ];

    const allQuestions =
      Array.isArray(selectedTopics) && selectedTopics.length > 0
        ? allQuestionsRaw.filter((q) =>
            this.matchesSelectedTopics(q.topic, selectedTopics),
          )
        : allQuestionsRaw;

    if (allQuestions.length === 0) return [];

    // If we've excluded too many, reset the exclusion list partially
    // (keep last 20 excluded to avoid immediate repetition)
    let effectiveExcludeIds = excludeIds;
    if (excludeIds.length > allQuestions.length * 0.7) {
      // Keep only the most recent 20% of excluded IDs
      const keepCount = Math.floor(allQuestions.length * 0.2);
      effectiveExcludeIds = excludeIds.slice(-keepCount);
    }

    // Select questions around target difficulty
    const diffRange = 0.25;
    const candidates = allQuestions.filter(
      (q) => Math.abs(q.difficulty - difficulty) <= diffRange,
    );

    let selectedQuestions = [];

    if (candidates.length >= count) {
      // Filter out excluded IDs
      const availableCandidates = candidates.filter(
        (q) => !effectiveExcludeIds.includes(q.questionId),
      );

      if (availableCandidates.length >= count) {
        selectedQuestions = this.getRandomItems(availableCandidates, count);
      } else {
        // Not enough candidates after exclusion, include some from all questions
        const fromCandidates = this.getRandomItems(
          availableCandidates,
          availableCandidates.length,
        );
        const remainingCount = count - fromCandidates.length;
        const otherQuestions = allQuestions.filter(
          (q) =>
            !effectiveExcludeIds.includes(q.questionId) &&
            !fromCandidates.some((fc) => fc.questionId === q.questionId),
        );
        const fromOthers = this.getRandomItems(otherQuestions, remainingCount);
        selectedQuestions = [...fromCandidates, ...fromOthers];
      }
    } else {
      // Not enough candidates, take all candidates plus others
      const fromCandidates = [...candidates];
      const remainingCount = count - fromCandidates.length;
      const otherQuestions = allQuestions.filter(
        (q) =>
          !candidates.some((c) => c.questionId === q.questionId) &&
          !effectiveExcludeIds.includes(q.questionId),
      );
      const fromOthers = this.getRandomItems(otherQuestions, remainingCount);
      selectedQuestions = [...fromCandidates, ...fromOthers];
    }

    // Ensure we have exactly 'count' questions (pad with random if needed)
    while (selectedQuestions.length < count) {
      const randomQ = this.getRandomItems(
        allQuestions.filter(
          (q) =>
            !selectedQuestions.some((sq) => sq.questionId === q.questionId),
        ),
        1,
      );
      if (randomQ.length > 0) {
        selectedQuestions.push(randomQ[0]);
      } else {
        // If all questions are used, start reusing with a different random selection
        selectedQuestions.push(this.getRandomItems(allQuestions, 1)[0]);
      }
    }

    return selectedQuestions;
  }

  /**
   * Get next practice question with adaptive difficulty
   */
  getNextPracticeQuestion(
    currentDifficulty,
    lastAnswerCorrect,
    excludeIds = [],
    selectedTopics = [],
  ) {
    // Adjust difficulty based on last answer
    let nextDifficulty = currentDifficulty;

    if (lastAnswerCorrect === true) {
      // Increase difficulty slightly
      nextDifficulty = Math.min(1.0, currentDifficulty + 0.1);
    } else if (lastAnswerCorrect === false) {
      // Decrease difficulty slightly
      nextDifficulty = Math.max(0.1, currentDifficulty - 0.1);
    }

    // Get a single question at the new difficulty
    const questions = this.getInfinitePracticeQuestions(
      nextDifficulty,
      1,
      excludeIds,
      0,
      selectedTopics,
    );

    return {
      question: questions[0] || null,
      nextDifficulty,
    };
  }
}

module.exports = new QuestionBankService();
