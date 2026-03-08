import apiClient from "./utils/apiClient";
import authService from "./authService";

class FlaskService {
  constructor() {
    this.cachedModels = new Map();
    this.pendingRequests = new Map();
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const response = await apiClient.flaskGet("/health");
      return {
        success: true,
        status: response.status,
        models: response.models || [],
      };
    } catch (error) {
      return {
        success: false,
        status: "unavailable",
        error: error.message,
      };
    }
  }

  /**
   * Get practice difficulty prediction
   * Sends 12 features, returns next difficulty
   */
  async getPracticeDifficulty(studentId, features, concept = "general") {
    try {
      const response = await apiClient.flaskPost("/practice/next-difficulty", {
        student_id: studentId,
        features,
        concept,
      });

      return {
        success: true,
        nextDifficulty: response.next_difficulty,
        smoothedDifficulty: response.smoothed_difficulty,
        confidence: response.confidence,
        method: response.method,
        timestamp: response.timestamp,
        learningInsight: response.learning_insight,
      };
    } catch (error) {
      console.error("Practice difficulty error:", error);
      return this.getFallbackPracticeDifficulty(features);
    }
  }

  async getPracticeProfile(studentId) {
    try {
      const response = await apiClient.flaskGet(`/practice/profile/${studentId}`);
      return {
        success: true,
        currentDifficulty: response.current_difficulty ?? 0.5,
        featureRows: response.feature_rows ?? 0,
        modelTrained: !!response.model_trained,
        lastTrainedAt: response.last_trained_at || null,
        lastTrainedFeatureRows: response.last_trained_feature_rows ?? null,
      };
    } catch (error) {
      console.error("Practice profile error:", error);
      return {
        success: false,
        currentDifficulty: 0.5,
        featureRows: 0,
        modelTrained: false,
      };
    }
  }

  async resetPracticeData(studentId) {
    try {
      const response = await apiClient.flaskPost("/practice/reset-data", {
        student_id: studentId,
      });
      return {
        success: true,
        message: response.message || "Practice history cleared",
        clearedFiles: response.cleared_files || [],
      };
    } catch (error) {
      console.error("Reset practice data error:", error);
      return {
        success: false,
        message: error?.message || "Could not clear practice history",
      };
    }
  }

  /**
   * Fallback practice difficulty calculation
   */
  getFallbackPracticeDifficulty(features) {
    if (features && features.length >= 8) {
      const accuracy = features[0];
      const currentDiff = features[7];
      const streak = features[8];
      const fatigue = features[9];

      let nextDiff = currentDiff;
      if (accuracy > 0.8 && streak > 3) {
        nextDiff = Math.min(1.0, currentDiff + 0.1);
      } else if (accuracy < 0.4 || fatigue > 0.8) {
        nextDiff = Math.max(0.1, currentDiff - 0.1);
      }

      return {
        success: true,
        nextDifficulty: nextDiff,
        smoothedDifficulty: nextDiff,
        confidence: 0.6,
        method: "fallback",
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      nextDifficulty: 0.5,
      smoothedDifficulty: 0.5,
      confidence: 0.5,
      method: "default",
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get real exam difficulty recommendation
   * Sends 8 features, returns recommended exam difficulty
   */
  async getExamDifficulty(studentId, features = [], examType = "standard") {
    try {
      const response = await apiClient.flaskPost("/real-exam/difficulty", {
        student_id: studentId,
        features,
        exam_type: examType,
      });

      return {
        success: true,
        recommendedDifficulty: response.recommended_difficulty,
        difficultyLevel: response.difficulty_level,
        confidence: response.confidence,
        method: response.method,
        insights: response.insights || {},
        timestamp: response.timestamp,
      };
    } catch (error) {
      console.error("Exam difficulty error:", error);
      return this.getFallbackExamDifficulty(features);
    }
  }

  /**
   * Fallback exam difficulty calculation
   */
  getFallbackExamDifficulty(features) {
    let recommended = 0.5;
    if (features && features.length >= 3) {
      const accuracy = features[0];
      const readiness = features[2] || accuracy;
      recommended = 0.5 * accuracy + 0.5 * readiness;
      recommended = Math.min(0.9, Math.max(0.3, recommended));
    }

    let level = "medium";
    if (recommended < 0.3) level = "easy";
    else if (recommended < 0.5) level = "medium-easy";
    else if (recommended < 0.7) level = "medium-hard";
    else level = "hard";

    return {
      success: true,
      recommendedDifficulty: recommended,
      difficultyLevel: level,
      confidence: 0.5,
      method: "fallback",
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get learning velocity prediction
   * Predicts future mastery for a concept
   */
  async getLearningVelocity(studentId, concept, history) {
    try {
      // Prepare features for learning velocity
      const features = this.prepareLearningVelocityFeatures(history);

      // In a real implementation, you'd call Flask endpoint
      // For now, simulate with local calculation

      const mastery = this.calculateLearningVelocity(history);

      return {
        success: true,
        concept,
        futureMastery: mastery.future,
        masterySlopeNext7Days: mastery.slope,
        predictions7Day: mastery.predictions,
        confidence: 0.8,
        trend:
          mastery.slope > 0
            ? "improving"
            : mastery.slope < 0
              ? "declining"
              : "stable",
      };
    } catch (error) {
      console.error("Learning velocity error:", error);
      return {
        success: false,
        concept,
        futureMastery: history[history.length - 1] || 0.5,
        masterySlopeNext7Days: 0,
        message: "Using current mastery",
      };
    }
  }

  /**
   * Prepare learning velocity features
   */
  prepareLearningVelocityFeatures(history) {
    // Convert history to feature vectors
    const features = [];
    for (let i = 0; i < history.length; i++) {
      features.push([
        history[i], // mastery score
        1.0, // practice frequency (placeholder)
        0.5, // revision gap
        0.6, // avg difficulty
        0.7, // success rate
        0.8, // retention
        30.0, // time spent
        0.1, // improvement rate
        0.6, // confidence growth
      ]);
    }
    return features;
  }

  /**
   * Calculate learning velocity locally
   */
  calculateLearningVelocity(history) {
    if (history.length < 3) {
      return {
        future: history[history.length - 1] || 0.5,
        slope: 0,
        predictions: [history[history.length - 1] || 0.5],
      };
    }

    // Simple linear trend
    const n = history.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = history.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((a, b, i) => a + b * history[i], 0);
    const sumX2 = x.reduce((a, b) => a + b * b, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Predict next 7 days
    const predictions = [];
    for (let i = 1; i <= 7; i++) {
      const pred = intercept + slope * (n + i - 1);
      predictions.push(Math.min(1, Math.max(0, pred)));
    }

    return {
      future: predictions[0],
      slope: slope * 7, // 7-day slope
      predictions,
    };
  }

  /**
   * Get burnout risk prediction
   */
  async getBurnoutRisk(studentId, sessionFeatures) {
    try {
      // In real implementation, call Flask endpoint
      // For now, calculate locally

      const risk = this.calculateBurnoutRisk(sessionFeatures);

      let level = "low";
      let message = "You are at low risk of burnout";
      let recommendation = "Continue studying";

      if (risk > 0.6) {
        level = "high";
        message = "High burnout risk detected - please rest";
        recommendation = "Take a break";
      } else if (risk > 0.3) {
        level = "moderate";
        message = "Consider taking breaks";
        recommendation = "Take short breaks between sessions";
      }

      return {
        success: true,
        burnoutRisk: risk,
        riskLevel: level,
        message,
        recommendation,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Burnout risk error:", error);
      return {
        success: false,
        burnoutRisk: 0.3,
        riskLevel: "unknown",
        message: "Unable to predict accurately",
      };
    }
  }

  /**
   * Calculate burnout risk locally
   */
  calculateBurnoutRisk(features) {
    if (!features || features.length < 10) return 0.3;

    // Simple heuristic based on available features
    const accuracy = features[0] || 0.5;
    const fatigue = features[4] || 0;
    const consistency = features[8] || 0.5;

    // Higher risk when accuracy drops, fatigue increases, consistency drops
    let risk = 0.3;
    if (accuracy < 0.4) risk += 0.2;
    if (fatigue > 0.7) risk += 0.3;
    if (consistency < 0.3) risk += 0.2;

    return Math.min(1, risk);
  }

  /**
   * Get priority scores for concepts
   */
  async getPriorityScores(studentId, conceptFeatures) {
    try {
      const priorities = [];

      Object.entries(conceptFeatures).forEach(([concept, features]) => {
        // Rule-based priority calculation
        const mastery = features[0] || 0.5;
        const examWeight = features[1] || 0.5;
        const daysSince = features[2] || 0;

        const priority =
          (1 - mastery) * 0.4 +
          examWeight * 0.3 +
          Math.min(daysSince / 30, 1) * 0.3;

        priorities.push({
          concept,
          priorityScore: Math.min(1, Math.max(0, priority)),
          mastery,
          reason: this.getPriorityReason(mastery, examWeight, daysSince),
        });
      });

      // Sort by priority
      priorities.sort((a, b) => b.priorityScore - a.priorityScore);

      // Generate study plan
      const studyPlan = this.generateStudyPlan(priorities);

      return {
        success: true,
        priorities,
        topConcept: priorities[0]?.concept || null,
        studyPlan,
      };
    } catch (error) {
      console.error("Priority scores error:", error);
      return {
        success: false,
        priorities: [],
        studyPlan: [],
      };
    }
  }

  /**
   * Get priority reason
   */
  getPriorityReason(mastery, weight, daysSince) {
    if (mastery < 0.3) {
      return "Critical weakness - needs immediate attention";
    } else if (mastery < 0.5) {
      return "Needs significant improvement";
    } else if (mastery < 0.7) {
      return "Moderate improvement needed";
    } else if (daysSince > 14) {
      return "Long time since practice - review needed";
    } else if (weight > 0.7) {
      return "High exam weightage";
    }
    return "Regular maintenance practice";
  }

  /**
   * Generate study plan from priorities
   */
  generateStudyPlan(priorities) {
    const plan = [];
    const totalTime = 120; // minutes per day

    priorities.slice(0, 5).forEach((p, index) => {
      const time = Math.round(
        totalTime *
          (p.priorityScore /
            priorities
              .slice(0, 5)
              .reduce((sum, item) => sum + item.priorityScore, 0)),
      );

      plan.push({
        concept: p.concept,
        order: index + 1,
        suggestedDuration: Math.min(45, Math.max(15, time)),
        focus:
          p.priorityScore > 0.7
            ? "Intensive Review"
            : p.priorityScore > 0.5
              ? "Practice"
              : "Quick Review",
        reason: p.reason,
      });
    });

    return plan;
  }

  /**
   * Get live analysis (all models combined)
   */
  async getLiveAnalysis(
    studentId,
    concept,
    practiceFeatures,
    conceptHistory,
    sessionFeatures,
  ) {
    try {
      const response = await apiClient.flaskPost("/analysis/practice/live", {
        student_id: studentId,
        concept,
        practice_features: practiceFeatures,
        concept_history: conceptHistory,
        session_features: sessionFeatures,
      });

      return {
        success: true,
        timestamp: response.analysis?.timestamp,
        concept: response.analysis?.concept,
        models: response.analysis?.models || {},
      };
    } catch (error) {
      console.error("Live analysis error:", error);

      // Fallback - calculate locally
      return {
        success: true,
        timestamp: new Date().toISOString(),
        concept,
        models: {
          practice_difficulty:
            practiceFeatures.length > 0
              ? await this.getPracticeDifficulty(
                  studentId,
                  practiceFeatures,
                  concept,
                )
              : null,
          learning_velocity:
            conceptHistory.length > 0
              ? await this.getLearningVelocity(
                  studentId,
                  concept,
                  conceptHistory,
                )
              : null,
          burnout_risk:
            sessionFeatures.length > 0
              ? await this.getBurnoutRisk(studentId, sessionFeatures)
              : null,
        },
      };
    }
  }

  /**
   * Upload attempts to Flask for model training
   */
  async uploadAttempts(studentId, attempts, sessionId = null, options = {}) {
    try {
      const normalizedAttempts = (attempts || []).map((attempt) => ({
        timestamp: attempt.timestamp || new Date().toISOString(),
        question_id: attempt.questionId || attempt.question_id,
        concept: attempt.conceptArea || attempt.concept || "general",
        correct:
          typeof attempt.isCorrect === "boolean"
            ? attempt.isCorrect
            : !!attempt.correct,
        time_spent: attempt.timeSpent ?? attempt.time_spent ?? 0,
        difficulty: attempt.difficulty ?? 0.5,
        answer_changed:
          typeof attempt.answerChanges === "number"
            ? attempt.answerChanges > 0
            : !!attempt.answer_changed,
        confidence: attempt.confidence ?? 0.5,
      }));

      const response = await apiClient.flaskPost("/practice/session-end", {
        student_id: studentId,
        attempts: normalizedAttempts,
        session_id: sessionId,
        finalize_session: !!options?.finalizeSession,
      });
      return response;
    } catch (error) {
      console.error("Upload attempts error:", error);
      throw error;
    }
  }

  /**
   * Get model info from Flask
   */
  async getModelInfo(studentId) {
    try {
      const response = await apiClient.flaskGet(
        `/dashboard/performance/${studentId}`,
      );
      return response;
    } catch (error) {
      console.error("Get model info error:", error);
      return null;
    }
  }

  /**
   * Extract 12 features from practice answers
   */
  extractPracticeFeatures(answers, questions) {
    const features = [];

    if (!answers || answers.length === 0) return features;

    // Take last 20 answers
    const recentAnswers = answers.slice(-20);

    recentAnswers.forEach((answer, index) => {
      const question = questions.find(
        (q) =>
          String(q.id || q._id || q.questionId) === String(answer.questionId),
      );
      if (!question) return;

      // 1. accuracy
      const accuracy = answer.isCorrect ? 1 : 0;

      // 2. normalized_response_time
      const responseTime = answer.timeSpent || 0;
      const avgTime =
        answers
          .filter((a) => a.isCorrect)
          .reduce((sum, a) => sum + (a.timeSpent || 0), 0) /
        Math.max(1, answers.filter((a) => a.isCorrect).length);
      const normalizedTime = avgTime > 0 ? responseTime / avgTime : 1;

      // 3. rolling_time_variance
      const last5Times = answers.slice(-5).map((a) => a.timeSpent || 0);
      const mean5 = last5Times.reduce((a, b) => a + b, 0) / last5Times.length;
      const variance5 =
        last5Times.reduce((a, b) => a + Math.pow(b - mean5, 2), 0) /
        last5Times.length;

      // 4. answer_change_count
      const answerChanges = answer.answerChanges || 0;

      // 5. stress_score
      const stressScore = 1 - Math.min(1, normalizedTime / 2);

      // 6. confidence_index
      const confidence = answer.confidence || 0.5;

      // 7. concept_mastery_score
      const conceptAnswers = answers.filter(
        (a) => a.conceptArea === question.conceptArea,
      );
      const conceptMastery =
        conceptAnswers.filter((a) => a.isCorrect).length /
        Math.max(1, conceptAnswers.length);

      // 8. current_question_difficulty
      const currentDifficulty = question.difficulty || 0.5;

      // 9. consecutive_correct_streak
      let streak = 0;
      for (let i = answers.length - 1; i >= 0; i--) {
        if (answers[i].isCorrect) streak++;
        else break;
      }

      // 10. fatigue_indicator
      const fatigue = index / Math.max(1, recentAnswers.length);

      // 11. focus_loss_frequency
      const focusLoss = answer.answerChanges > 2 ? 1 : 0;

      // 12. preferred_difficulty_offset
      const preferredOffset = currentDifficulty - (conceptMastery || 0.5);

      features.push([
        accuracy,
        normalizedTime,
        variance5,
        answerChanges,
        stressScore,
        confidence,
        conceptMastery,
        currentDifficulty,
        streak,
        fatigue,
        focusLoss,
        preferredOffset,
      ]);
    });

    return features;
  }

  /**
   * Extract 8 exam features
   */
  extractExamFeatures(answers, questions) {
    if (answers.length === 0) return [];

    const overallAccuracy =
      answers.filter((a) => a.isCorrect).length / answers.length;
    const avgDifficulty =
      answers.reduce((sum, a) => {
        const q = questions.find((q) => q._id === a.questionId);
        return sum + (q?.difficulty || 0.5);
      }, 0) / answers.length;

    const hardQuestions = answers.filter((a) => {
      const q = questions.find((q) => q._id === a.questionId);
      return q?.difficulty > 0.7;
    });
    const readiness =
      hardQuestions.filter((a) => a.isCorrect).length /
      Math.max(1, hardQuestions.length);

    const accValues = answers.map((a) => (a.isCorrect ? 1 : 0));
    const mean = accValues.reduce((a, b) => a + b, 0) / accValues.length;
    const variance =
      accValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) /
      accValues.length;
    const consistency = 1 - Math.min(1, variance * 2);

    const uniqueConcepts = new Set(answers.map((a) => a.conceptArea)).size;
    const conceptCoverage = uniqueConcepts / Math.max(1, answers.length);

    const avgTime =
      answers.reduce((sum, a) => sum + (a.timeSpent || 0), 0) / answers.length;
    const timeEfficiency = 1 - Math.min(1, avgTime / 120);

    // Stamina (second half vs first half)
    const half = Math.floor(answers.length / 2);
    const firstHalf = answers.slice(0, half);
    const secondHalf = answers.slice(half);
    const firstAcc =
      firstHalf.filter((a) => a.isCorrect).length /
      Math.max(1, firstHalf.length);
    const secondAcc =
      secondHalf.filter((a) => a.isCorrect).length /
      Math.max(1, secondHalf.length);
    const stamina = secondAcc / Math.max(0.1, firstAcc);

    return [
      overallAccuracy,
      avgDifficulty,
      readiness,
      consistency,
      0, // trend placeholder
      conceptCoverage,
      timeEfficiency,
      stamina,
    ];
  }
}

export default new FlaskService();
