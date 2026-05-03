// Services/questionBankService.js
const mongoose = require("mongoose");
const CourseQuestionBank = require("../models/Question/questionAdaptationSchema");

class QuestionBankService {
  constructor() {
    // No more local JSON file loading
    console.log(
      "[QuestionBankService] Initialized - Using MongoDB CourseQuestionBank exclusively",
    );
  }

  /**
   * Normalize a topic string for consistent comparison
   */
  normalizeTopic(topic = "") {
    return String(topic)
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  /**
   * Check if a question's topic matches any of the selected topics
   */
  matchesSelectedTopics(questionTopic, selectedTopics = []) {
    if (!Array.isArray(selectedTopics) || selectedTopics.length === 0) {
      return true;
    }

    const questionNormalized = this.normalizeTopic(questionTopic);
    const selectedNormalized = selectedTopics.map((topic) =>
      this.normalizeTopic(topic),
    );

    return selectedNormalized.some(
      (sel) =>
        questionNormalized.includes(sel) || sel.includes(questionNormalized),
    );
  }

  /**
   * Get all available questions from ALL CourseQuestionBanks
   */
  async getAllQuestionsFromDB() {
    try {
      const questionBanks = await CourseQuestionBank.find({}).lean();
      const allQuestions = [];

      for (const bank of questionBanks) {
        if (bank.questions && bank.questions.length > 0) {
          for (const q of bank.questions) {
            if (q.isActive !== false) {
              allQuestions.push({
                ...q,
                _id: q._id,
                questionId: q.questionId,
                id: q.questionId,
                subject: bank.subject || q.subject || "General",
                difficulty: Number(q.difficulty ?? 0.5),
                difficultyLevel:
                  q.difficulty_level ||
                  this.mapDifficultyLevel(q.difficulty || 0.5),
                correctAnswer: q.correct_answer,
                expectedTime: q.expected_time ?? 90,
                topic: q.topic || "General",
                topicCategory: q.topic || "General",
                fromCourseBank: true,
              });
            }
          }
        }
      }

      return allQuestions;
    } catch (error) {
      console.error(
        "[QuestionBankService] Error fetching all questions:",
        error.message,
      );
      return [];
    }
  }

  /**
   * Map difficulty value to level string
   */
  mapDifficultyLevel(difficulty) {
    if (difficulty < 0.2) return "very_easy";
    if (difficulty < 0.4) return "easy";
    if (difficulty < 0.6) return "medium";
    if (difficulty < 0.8) return "hard";
    return "very_hard";
  }

  /**
   * Get practice questions from MongoDB based on difficulty and topics
   */
  async getPracticeQuestions(
    difficulty = 0.5,
    count = 30,
    excludeIds = [],
    selectedTopics = [],
  ) {
    try {
      console.log(
        `[QuestionBankService] Getting ${count} practice questions (difficulty: ${difficulty}, topics: ${selectedTopics?.length || 0})`,
      );

      // Query all question banks
      const questionBanks = await CourseQuestionBank.find({}).lean();

      let allQuestions = [];
      const excludeSet = new Set(excludeIds.map((id) => String(id)));

      for (const bank of questionBanks) {
        if (!bank.questions || bank.questions.length === 0) continue;

        let filtered = bank.questions.filter((q) => {
          if (q.isActive === false) return false;
          const qId = String(q._id || q.questionId);
          return !excludeSet.has(qId);
        });

        // Filter by selected topics
        if (selectedTopics && selectedTopics.length > 0) {
          filtered = filtered.filter((q) =>
            this.matchesSelectedTopics(q.topic, selectedTopics),
          );
        }

        // Filter by difficulty range (±0.25 tolerance)
        const diffRange = 0.25;
        filtered = filtered.filter((q) => {
          const qDifficulty = q.difficulty || 0.5;
          return Math.abs(qDifficulty - difficulty) <= diffRange;
        });

        allQuestions = allQuestions.concat(filtered);
      }

      console.log(
        `[QuestionBankService] Found ${allQuestions.length} candidates after filtering`,
      );

      // If not enough questions, widen difficulty range
      if (allQuestions.length < count) {
        console.log(
          `[QuestionBankService] Not enough questions with strict range, widening...`,
        );
        const wideRange = 0.5;
        for (const bank of questionBanks) {
          if (!bank.questions || bank.questions.length === 0) continue;

          let filtered = bank.questions.filter((q) => {
            if (q.isActive === false) return false;
            const qId = String(q._id || q.questionId);
            return !excludeSet.has(qId);
          });

          if (selectedTopics && selectedTopics.length > 0) {
            filtered = filtered.filter((q) =>
              this.matchesSelectedTopics(q.topic, selectedTopics),
            );
          }

          filtered = filtered.filter((q) => {
            const qDifficulty = q.difficulty || 0.5;
            return Math.abs(qDifficulty - difficulty) <= wideRange;
          });

          // Don't add duplicates
          const existingIds = new Set(
            allQuestions.map((q) => String(q._id || q.questionId)),
          );
          filtered = filtered.filter(
            (q) => !existingIds.has(String(q._id || q.questionId)),
          );

          allQuestions = allQuestions.concat(filtered);
        }
        console.log(
          `[QuestionBankService] After widening: ${allQuestions.length} candidates`,
        );
      }

      // Shuffle and return
      allQuestions = this.shuffleArray(allQuestions);
      const result = allQuestions.slice(
        0,
        Math.min(count, allQuestions.length),
      );

      console.log(`[QuestionBankService] Returning ${result.length} questions`);
      return result;
    } catch (error) {
      console.error(
        "[QuestionBankService] Error getting practice questions:",
        error.message,
      );
      return [];
    }
  }

  /**
   * Get next practice question with adaptive difficulty
   */
  async getNextPracticeQuestion(
    currentDifficulty,
    lastAnswerCorrect,
    excludeIds = [],
    selectedTopics = [],
  ) {
    try {
      // Adjust difficulty based on last answer
      let nextDifficulty = currentDifficulty;
      if (lastAnswerCorrect === true) {
        nextDifficulty = Math.min(0.95, currentDifficulty + 0.1);
      } else if (lastAnswerCorrect === false) {
        nextDifficulty = Math.max(0.1, currentDifficulty - 0.1);
      }

      const questions = await this.getPracticeQuestions(
        nextDifficulty,
        1,
        excludeIds,
        selectedTopics,
      );

      const question = questions[0] || null;

      // Normalize the question
      if (question) {
        question.questionId = question.questionId || question._id;
        question.difficulty = Number(question.difficulty ?? 0.5);
        question.difficultyLevel =
          question.difficulty_level ||
          this.mapDifficultyLevel(question.difficulty);
        question.correctAnswer =
          question.correct_answer || question.correctAnswer;
        question.correct_answer =
          question.correctAnswer || question.correct_answer;
        question.expectedTime =
          question.expected_time ?? question.expectedTime ?? 90;
        question.topicCategory = question.topic || "General";
      }

      return {
        question,
        nextDifficulty,
      };
    } catch (error) {
      console.error(
        "[QuestionBankService] Error getting next question:",
        error.message,
      );
      return { question: null, nextDifficulty: currentDifficulty };
    }
  }

  /**
   * Get real exam questions from MongoDB
   */
  async getRealExamQuestions(globalDifficulty = 0.5) {
    try {
      const safeDifficulty = Math.min(
        0.95,
        Math.max(0.1, Number(globalDifficulty) || 0.5),
      );

      // Determine desired mix based on difficulty
      let desiredMix = { easy: 10, medium: 10, hard: 5 };
      if (safeDifficulty < 0.4) {
        desiredMix = { easy: 14, medium: 8, hard: 3 };
      } else if (safeDifficulty > 0.7) {
        desiredMix = { easy: 5, medium: 10, hard: 10 };
      }

      const allQuestions = await this.getAllQuestionsFromDB();

      if (allQuestions.length === 0) {
        console.warn("[QuestionBankService] No questions available for exam");
        return [];
      }

      // Categorize by difficulty
      const easy = allQuestions.filter((q) => (q.difficulty || 0.5) < 0.4);
      const medium = allQuestions.filter(
        (q) => (q.difficulty || 0.5) >= 0.4 && (q.difficulty || 0.5) < 0.7,
      );
      const hard = allQuestions.filter((q) => (q.difficulty || 0.5) >= 0.7);

      const usedIds = new Set();

      const pickUnique = (source, count) => {
        const available = source.filter(
          (item) => !usedIds.has(String(item._id || item.questionId)),
        );
        const picked = this.getRandomItems(available, count);
        picked.forEach((item) =>
          usedIds.add(String(item._id || item.questionId)),
        );
        return picked;
      };

      let selected = [
        ...pickUnique(easy, desiredMix.easy),
        ...pickUnique(medium, desiredMix.medium),
        ...pickUnique(hard, desiredMix.hard),
      ];

      // Fill remaining if needed
      if (selected.length < 100) {
        const remaining = allQuestions.filter(
          (item) => !usedIds.has(String(item._id || item.questionId)),
        );
        selected = [
          ...selected,
          ...this.getRandomItems(remaining, 100 - selected.length),
        ];
      }

      return selected.slice(0, 100);
    } catch (error) {
      console.error(
        "[QuestionBankService] Error getting exam questions:",
        error.message,
      );
      return [];
    }
  }

  /**
   * Get all questions (for fallback)
   */
  getAllQuestions() {
    // This is a synchronous wrapper - should be avoided in favor of async methods
    console.warn(
      "[QuestionBankService] getAllQuestions() called synchronously - use async methods instead",
    );
    return [];
  }

  /**
   * Get random items from array
   */
  getRandomItems(array, count) {
    const shuffled = this.shuffleArray([...array]);
    return shuffled.slice(0, Math.min(count, array.length));
  }

  /**
   * Fisher-Yates shuffle
   */
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Get questions by topics from MongoDB
   */
  async getQuestionsByTopics(topics, count = 5) {
    try {
      const questionBanks = await CourseQuestionBank.find({}).lean();
      let allQuestions = [];

      for (const bank of questionBanks) {
        if (!bank.questions || bank.questions.length === 0) continue;

        const filtered = bank.questions.filter(
          (q) =>
            q.isActive !== false && this.matchesSelectedTopics(q.topic, topics),
        );
        allQuestions = allQuestions.concat(filtered);
      }

      return this.getRandomItems(allQuestions, count);
    } catch (error) {
      console.error(
        "[QuestionBankService] Error getting questions by topics:",
        error.message,
      );
      return [];
    }
  }

  /**
   * Get question by ID from MongoDB
   */
  async getQuestionById(questionId) {
    try {
      const questionBanks = await CourseQuestionBank.find({}).lean();

      for (const bank of questionBanks) {
        if (!bank.questions) continue;
        const found = bank.questions.find(
          (q) =>
            String(q.questionId) === String(questionId) ||
            String(q._id) === String(questionId),
        );
        if (found) return found;
      }
      return null;
    } catch (error) {
      console.error(
        "[QuestionBankService] Error getting question by ID:",
        error.message,
      );
      return null;
    }
  }

  /**
   * Get infinite practice questions from MongoDB
   */
  async getInfinitePracticeQuestions(
    difficulty = 0.5,
    count = 30,
    excludeIds = [],
    cycleCount = 0,
    selectedTopics = [],
  ) {
    try {
      let effectiveExcludeIds = excludeIds;

      // If we've excluded too many, reduce the exclusion list
      if (excludeIds.length > 50) {
        const keepCount = 20;
        effectiveExcludeIds = excludeIds.slice(-keepCount);
      }

      return await this.getPracticeQuestions(
        difficulty,
        count,
        effectiveExcludeIds,
        selectedTopics,
      );
    } catch (error) {
      console.error(
        "[QuestionBankService] Error getting infinite questions:",
        error.message,
      );
      return [];
    }
  }

  // file: Services/questionBankService.js
  // Add these methods to the existing class

  /**
   * Get retention-specific questions (for backward compatibility)
   */
  getRetentionQuestions({ subject, topics, count = 10 }) {
    // This method is deprecated - use getPracticeQuestions instead
    console.warn(
      "getRetentionQuestions is deprecated, using getPracticeQuestions instead",
    );
    return this.getPracticeQuestionsByTopics(subject, topics, count);
  }

  /**
   * Get practice questions by topics (synchronous wrapper for backward compatibility)
   */
  getPracticeQuestionsByTopics(subject, topics, count = 10) {
    // This is a synchronous wrapper - should be avoided in favor of async methods
    console.warn(
      "getPracticeQuestionsByTopics called synchronously - this may return empty array",
    );
    return [];
  }

  /**
   * Get retention question by ID (for backward compatibility)
   */
  getRetentionQuestionById(questionId) {
    return this.getQuestionById(questionId);
  }
}

// Create and export singleton instance
const questionBankService = new QuestionBankService();
module.exports = questionBankService;
