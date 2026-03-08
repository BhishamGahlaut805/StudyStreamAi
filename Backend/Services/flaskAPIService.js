const axios = require("axios");

const FLASK_API_URL = process.env.FLASK_API_URL || "http://localhost:5500/api";

class FlaskApiService {
  constructor() {
    this.client = axios.create({
      baseURL: FLASK_API_URL,
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  // Health check
  async healthCheck() {
    try {
      const response = await this.client.get("/health");
      return response.data;
    } catch (error) {
      console.error("Flask health check failed:", error.message);
      return null;
    }
  }

  // Start test session (for practice mode with AI generation)
  async startTestSession(
    studentId,
    testType,
    selectedTopics,
    selectedPdfs = [],
    initialDifficulty = 0.5,
  ) {
    try {
      const response = await this.client.post("/practice/session-start", {
        student_id: studentId,
        test_mode: testType,
        selected_topics: selectedTopics,
        selected_pdfs: selectedPdfs,
        initial_difficulty: initialDifficulty,
        paper_structure: {
          total_questions: 100,
          sections: [
            { name: "Mathematics", count: 25 },
            { name: "English", count: 25 },
            { name: "Reasoning", count: 25 },
            { name: "GK", count: 25 },
          ],
        },
      });
      return {
        ...response.data,
        session_id: response.data.session_id || null,
      };
    } catch (error) {
      console.error(
        "Error starting Flask test session:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  // Get next questions (for practice mode)
  async getNextQuestions(flaskSessionId, responses) {
    try {
      const response = await this.client.post(`/test/next/${flaskSessionId}`, {
        responses: responses.map((r) => ({
          question_id: r.question_id,
          correct: r.correct,
          time_spent: r.time_spent,
          answer_changes: r.answer_changes || 0,
          confidence: r.confidence || 0.5,
          concept_area: r.concept_area,
          difficulty: r.difficulty,
        })),
      });
      return response.data;
    } catch (error) {
      console.error(
        "Error getting next questions from Flask:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  // Complete test session
  async completeTestSession(flaskSessionId) {
    try {
      const response = await this.client.post(
        `/test/complete/${flaskSessionId}`,
      );
      return response.data;
    } catch (error) {
      console.error(
        "Error completing Flask session:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  // Get session status
  async getSessionStatus(flaskSessionId) {
    try {
      const response = await this.client.get(`/test/session/${flaskSessionId}`);
      return response.data;
    } catch (error) {
      console.error(
        "Error getting Flask session status:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  // Get practice difficulty prediction
  async getPracticeDifficulty(studentId, features) {
    try {
      const response = await this.client.post("/practice/next-difficulty", {
        student_id: studentId,
        features: features,
      });
      return response.data;
    } catch (error) {
      console.error(
        "Error getting practice difficulty:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  // Get real exam difficulty recommendation
  async getExamDifficulty(studentId, features) {
    try {
      const response = await this.client.post("/real-exam/difficulty", {
        student_id: studentId,
        features: features,
      });
      return response.data;
    } catch (error) {
      console.error(
        "Error getting exam difficulty:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  // Get model info for student
  async getModelInfo(studentId) {
    try {
      const response = await this.client.get(
        `/dashboard/performance/${studentId}`,
      );
      return response.data;
    } catch (error) {
      console.error(
        "Error getting model info:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  // Upload practice attempts
  async uploadAttempts(studentId, attempts) {
    try {
      const response = await this.client.post(
        `/dashboard/upload-attempts/${studentId}`,
        {
          attempts: attempts,
        },
      );
      return response.data;
    } catch (error) {
      console.error(
        "Error uploading attempts:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  // Get live analysis
  async getLiveAnalysis(
    studentId,
    concept,
    practiceFeatures,
    conceptHistory,
    sessionFeatures,
  ) {
    try {
      const response = await this.client.post("/analysis/practice/live", {
        student_id: studentId,
        concept: concept,
        practice_features: practiceFeatures,
        concept_history: conceptHistory,
        session_features: sessionFeatures,
      });
      return response.data;
    } catch (error) {
      console.error(
        "Error getting live analysis:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }
}

module.exports = new FlaskApiService();
