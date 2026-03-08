import apiClient from "./utils/apiClient";

class QuestionService {
  constructor() {
    this.questionCache = new Map();
    this.topicCache = null;
  }

  /**
   * Get all topics
   */
  async getAllTopics() {
    try {
      if (this.topicCache) {
        return { success: true, topics: this.topicCache };
      }

      const response = await apiClient.nodeGet("/questions/topics");
      this.topicCache = response.topics;
      return response;
    } catch (error) {
      console.error("Get all topics error:", error);
      throw error;
    }
  }

  /**
   * Get topics by subject
   */
  async getTopicsBySubject(subject) {
    try {
      const response = await apiClient.nodeGet(`/questions/topics/${subject}`);
      return response;
    } catch (error) {
      console.error("Get topics by subject error:", error);
      throw error;
    }
  }

  /**
   * Get questions by subject
   */
  async getQuestionsBySubject(subject, params = {}) {
    try {
      const queryParams = {
        topic: params.topic,
        minDifficulty: params.minDifficulty || 0,
        maxDifficulty: params.maxDifficulty || 1,
        count: params.count || 10,
      };

      const response = await apiClient.nodeGet(
        `/questions/${subject}`,
        queryParams,
      );

      // Cache questions
      response.questions.forEach((q) => {
        this.questionCache.set(q.id, q);
      });

      return response;
    } catch (error) {
      console.error("Get questions by subject error:", error);
      throw error;
    }
  }

  /**
   * Get question by ID
   */
  async getQuestionById(questionId) {
    try {
      // Check cache first
      if (this.questionCache.has(questionId)) {
        return {
          success: true,
          question: this.questionCache.get(questionId),
        };
      }

      const response = await apiClient.nodeGet(
        `/questions/detail/${questionId}`,
      );

      if (response.success && response.question) {
        this.questionCache.set(questionId, response.question);
      }

      return response;
    } catch (error) {
      console.error("Get question by ID error:", error);
      throw error;
    }
  }

  /**
   * Get multiple questions by IDs
   */
  async getQuestionsByIds(questionIds) {
    try {
      const questions = [];
      const missingIds = [];

      // Check cache first
      questionIds.forEach((id) => {
        if (this.questionCache.has(id)) {
          questions.push(this.questionCache.get(id));
        } else {
          missingIds.push(id);
        }
      });

      // Fetch missing questions (in batches)
      if (missingIds.length > 0) {
        const batchSize = 10;
        for (let i = 0; i < missingIds.length; i += batchSize) {
          const batch = missingIds.slice(i, i + batchSize);
          const promises = batch.map((id) => this.getQuestionById(id));
          const results = await Promise.all(promises);

          results.forEach((result) => {
            if (result.success && result.question) {
              questions.push(result.question);
            }
          });
        }
      }

      return {
        success: true,
        questions,
      };
    } catch (error) {
      console.error("Get questions by IDs error:", error);
      throw error;
    }
  }

  /**
   * Get practice questions (mixed subjects)
   */
  async getPracticeQuestions(params = {}) {
    const subjects = [
      "mathematics",
      "english",
      "reasoning",
      "general_knowledge",
    ];
    const allQuestions = [];

    for (const subject of subjects) {
      const response = await this.getQuestionsBySubject(subject, {
        minDifficulty: params.minDifficulty || 0,
        maxDifficulty: params.maxDifficulty || 1,
        count: Math.ceil((params.count || 10) / subjects.length),
      });

      if (response.success) {
        allQuestions.push(...response.questions);
      }
    }

    // Shuffle and trim
    const shuffled = this.shuffleArray(allQuestions);
    const limited = shuffled.slice(0, params.count || 10);

    return {
      success: true,
      questions: limited,
      total: limited.length,
    };
  }

  /**
   * Get questions by difficulty range
   */
  async getQuestionsByDifficulty(minDifficulty, maxDifficulty, count = 10) {
    const subjects = [
      "mathematics",
      "english",
      "reasoning",
      "general_knowledge",
    ];
    const allQuestions = [];

    for (const subject of subjects) {
      const response = await this.getQuestionsBySubject(subject, {
        minDifficulty,
        maxDifficulty,
        count: Math.ceil(count / subjects.length),
      });

      if (response.success) {
        allQuestions.push(...response.questions);
      }
    }

    const shuffled = this.shuffleArray(allQuestions);
    const limited = shuffled.slice(0, count);

    return {
      success: true,
      questions: limited,
    };
  }

  /**
   * Get questions by topics
   */
  async getQuestionsByTopics(topics, count = 5) {
    const allQuestions = [];

    for (const topic of topics) {
      // This would need a backend endpoint for topic-based filtering
      // For now, get from all subjects and filter
      const response = await this.getPracticeQuestions({ count: count * 2 });

      if (response.success) {
        const topicQuestions = response.questions.filter(
          (q) => q.topic === topic,
        );
        allQuestions.push(...topicQuestions.slice(0, count));
      }
    }

    return {
      success: true,
      questions: allQuestions,
    };
  }

  /**
   * Get question statistics
   */
  async getQuestionStats(questionId) {
    // This would need a backend endpoint for question statistics
    // Placeholder implementation
    return {
      success: true,
      stats: {
        timesUsed: 0,
        accuracyRate: 0,
        averageTime: 0,
      },
    };
  }

  /**
   * Shuffle array
   */
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Clear question cache
   */
  clearCache() {
    this.questionCache.clear();
    this.topicCache = null;
  }
}

export default new QuestionService();
