class AnalyticsService {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Calculate all 12 analytics models from student performance data
   */
  calculateAllModels(performance) {
    if (!performance) return null;

    return {
      // 1. Concept Mastery (per topic)
      conceptMastery: this.calculateConceptMastery(performance),

      // 2. Stability Index (per topic)
      stabilityIndex: this.calculateStabilityIndex(performance),

      // 3. Confidence Calibration
      confidenceCalibration: this.calculateConfidenceCalibration(performance),

      // 4. Error Pattern Classification
      errorPatterns: this.calculateErrorPatterns(performance),

      // 5. Weakness Severity Ranking
      weaknessPriority: this.calculateWeaknessPriority(performance),

      // 6. Forgetting Curve
      forgettingCurve: this.calculateForgettingCurve(performance),

      // 7. Fatigue Sensitivity
      fatigueIndex: this.calculateFatigueIndex(performance),

      // 8. Cognitive Behavior Profile
      behaviorProfile: this.calculateBehaviorProfile(performance),

      // 9. Difficulty Tolerance
      difficultyTolerance: this.calculateDifficultyTolerance(performance),

      // 10. Study Efficiency
      studyEfficiency: this.calculateStudyEfficiency(performance),

      // 11. Focus Loss Detection
      focusLoss: this.calculateFocusLoss(performance),

      // 12. Adaptive Time Allocation
      timeAllocation: this.calculateTimeAllocation(performance),
    };
  }

  /**
   * 1. Concept Mastery (Exponential Moving Average)
   */
  calculateConceptMastery(performance) {
    const mastery = {};
    const learningRate = 0.3;

    (performance.topicPerformance || []).forEach((topic) => {
      if (topic.questionsAttempted === 0) {
        mastery[topic.topic] = 0.5;
        return;
      }

      const history = topic.conceptMasteryHistory || [];
      const oldMastery = history.length > 0 ? history[history.length - 1] : 0.5;
      const recentAccuracy = topic.accuracy / 100;

      const newMastery =
        oldMastery + learningRate * (recentAccuracy - oldMastery);
      mastery[topic.topic] = Math.min(1, Math.max(0, newMastery));
    });

    return mastery;
  }

  /**
   * 2. Stability Index (1 - normalized variance)
   */
  calculateStabilityIndex(performance) {
    const stability = {};

    (performance.topicPerformance || []).forEach((topic) => {
      const history = topic.conceptMasteryHistory || [];
      if (history.length < 3) {
        stability[topic.topic] = 0.5;
        return;
      }

      const recent = history.slice(-10);
      const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
      const variance =
        recent.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recent.length;
      const maxVariance = 0.25;

      stability[topic.topic] = Math.max(
        0,
        Math.min(1, 1 - variance / maxVariance),
      );
    });

    return stability;
  }

  /**
   * 3. Confidence Calibration
   */
  calculateConfidenceCalibration(performance) {
    // This would use actual confidence scores from answers
    // For now, return placeholder with derived values
    return {
      overall: 0.15,
      byTopic: {},
      byDifficulty: {
        easy: 0.08,
        medium: 0.12,
        hard: 0.18,
        very_hard: 0.22,
      },
      interpretation: "Calibration error: lower is better (0.15 is good)",
    };
  }

  /**
   * 4. Error Pattern Classification
   */
  calculateErrorPatterns(performance) {
    const patterns = {
      conceptual: 0,
      careless: 0,
      guess: 0,
      overconfidence: 0,
      byTopic: {},
    };

    let totalTopics = 0;

    (performance.topicPerformance || []).forEach((topic) => {
      const mastery = topic.accuracy / 100;
      const attempts = topic.questionsAttempted;

      if (attempts < 3) return;

      let conceptual, careless, guess, overconfidence;

      if (mastery < 0.3) {
        conceptual = 0.6;
        guess = 0.3;
        careless = 0.1;
        overconfidence = 0;
      } else if (mastery < 0.5) {
        conceptual = 0.4;
        guess = 0.3;
        careless = 0.2;
        overconfidence = 0.1;
      } else if (mastery < 0.7) {
        conceptual = 0.2;
        guess = 0.2;
        careless = 0.4;
        overconfidence = 0.2;
      } else {
        conceptual = 0.1;
        guess = 0.1;
        careless = 0.3;
        overconfidence = 0.5;
      }

      patterns.byTopic[topic.topic] = {
        conceptual,
        careless,
        guess,
        overconfidence,
      };

      patterns.conceptual += conceptual;
      patterns.careless += careless;
      patterns.guess += guess;
      patterns.overconfidence += overconfidence;
      totalTopics++;
    });

    // Normalize
    if (totalTopics > 0) {
      patterns.conceptual /= totalTopics;
      patterns.careless /= totalTopics;
      patterns.guess /= totalTopics;
      patterns.overconfidence /= totalTopics;
    }

    return patterns;
  }

  /**
   * 5. Weakness Severity Ranking
   */
  calculateWeaknessPriority(performance) {
    const priorities = [];

    (performance.topicPerformance || []).forEach((topic) => {
      if (topic.questionsAttempted < 3) return;

      const mastery = topic.accuracy / 100;
      const errorRate = 1 - mastery;

      // Exam weightage (could be customized per exam)
      const examWeights = {
        Mathematics: 1.0,
        English: 0.8,
        Reasoning: 0.9,
        "General Knowledge": 0.6,
      };

      const weightage = examWeights[topic.topic] || 0.7;

      // Days since last practice
      const daysSince = topic.lastPracticed
        ? Math.floor(
            (new Date() - new Date(topic.lastPracticed)) /
              (1000 * 60 * 60 * 24),
          )
        : 30;
      const retentionDecay = Math.min(1, daysSince / 14);

      const weaknessScore =
        (1 - mastery) * weightage * errorRate * retentionDecay;

      priorities.push({
        topic: topic.topic,
        subject: topic.subject,
        score: weaknessScore,
        mastery,
        questionsAttempted: topic.questionsAttempted,
        daysSince,
        recommendation: this.getWeaknessRecommendation(mastery, daysSince),
      });
    });

    // Sort by score (higher = more urgent)
    priorities.sort((a, b) => b.score - a.score);

    // Add rank
    priorities.forEach((p, i) => {
      p.rank = i + 1;
    });

    return priorities.slice(0, 10);
  }

  /**
   * Get weakness recommendation
   */
  getWeaknessRecommendation(mastery, daysSince) {
    if (mastery < 0.3) {
      return "Critical: Review fundamental concepts immediately";
    } else if (mastery < 0.5) {
      return "Focus: Practice more questions to build understanding";
    } else if (mastery < 0.7) {
      return "Improve: Work on advanced problems in this area";
    } else if (daysSince > 14) {
      return "Review: Long time since practice - refresh your memory";
    } else {
      return "Maintain: Regular practice to keep mastery level";
    }
  }

  /**
   * 6. Forgetting Curve
   */
  calculateForgettingCurve(performance) {
    const retention = {};
    const decayConstant = 0.1; // Can be adjusted per student

    (performance.topicPerformance || []).forEach((topic) => {
      if (!topic.lastPracticed) return;

      const daysSince = Math.floor(
        (new Date() - new Date(topic.lastPracticed)) / (1000 * 60 * 60 * 24),
      );
      if (daysSince < 0) return;

      const mastery = topic.accuracy / 100;

      // Ebbinghaus forgetting curve: R = e^(-t/S)
      const retentionScore = mastery * Math.exp(-decayConstant * daysSince);

      retention[topic.topic] = {
        current: retentionScore,
        original: mastery,
        daysSince,
        predicted7Day: mastery * Math.exp(-decayConstant * 7),
        predicted30Day: mastery * Math.exp(-decayConstant * 30),
        needsReview: retentionScore < 0.6,
      };
    });

    // Generate review recommendations
    const reviewRecommendations = [];
    Object.entries(retention).forEach(([topic, data]) => {
      if (data.needsReview) {
        reviewRecommendations.push({
          topic,
          priority: data.retentionScore < 0.4 ? "high" : "medium",
          daysSince: data.daysSince,
          reason: `Retention dropped to ${Math.round(data.retentionScore * 100)}%`,
        });
      }
    });

    return {
      decayConstant,
      retentionScores: retention,
      reviewRecommendations: reviewRecommendations
        .sort((a, b) => b.daysSince - a.daysSince)
        .slice(0, 5),
    };
  }

  /**
   * 7. Fatigue Sensitivity
   */
  calculateFatigueIndex(performance) {
    const testHistory = performance.testHistory || [];

    if (testHistory.length < 3) {
      return {
        current: 0.2,
        trend: "stable",
        bySession: [],
        recommendations: ["Take more tests to establish fatigue pattern"],
      };
    }

    const bySession = testHistory
      .slice(-10)
      .map((test) => 1 - test.accuracy / 100);

    // Calculate trend
    const trend = this.calculateTrend(bySession);
    const trendDirection =
      trend > 0.02 ? "increasing" : trend < -0.02 ? "decreasing" : "stable";

    // Current fatigue (weighted average of recent)
    const weights = [0.4, 0.3, 0.2, 0.1];
    const recent = bySession.slice(-4);
    const current =
      recent.reduce((sum, score, i) => sum + score * (weights[i] || 0.1), 0) /
      weights.slice(0, recent.length).reduce((a, b) => a + b, 0);

    const recommendations = [];
    if (current > 0.6) {
      recommendations.push("High fatigue detected - take a longer break");
    } else if (current > 0.4) {
      recommendations.push("Moderate fatigue - consider a short break");
    }

    if (trendDirection === "increasing") {
      recommendations.push(
        "Fatigue is increasing - consider reducing session length",
      );
    }

    return {
      current: Math.min(1, Math.max(0, current)),
      trend: trendDirection,
      bySession,
      recommendations,
    };
  }

  /**
   * 8. Cognitive Behavior Profile
   */
  calculateBehaviorProfile(performance) {
    // Analyze test history for behavior patterns
    const testHistory = performance.testHistory || [];

    // Calculate metrics
    const avgTime = 60; // seconds - would be calculated from actual data
    const skipRate = 0.05; // would be calculated
    const answerChangeFrequency = 0.2;
    const difficultyPreference =
      performance.overallStats?.averageDifficulty || 0.5;

    // Determine cluster
    let cluster = "balanced";
    let description = "Balanced learner with good mix of speed and accuracy";
    let strengths = ["Consistent performance", "Good time management"];
    let weaknesses = [];

    if (avgTime < 40 && answerChangeFrequency < 0.1) {
      cluster = "impulsive";
      description =
        "Tends to answer quickly, sometimes without full consideration";
      strengths = ["Fast response time", "Decisive"];
      weaknesses = [
        "May miss subtle details",
        "Higher mistake rate on complex questions",
      ];
    } else if (avgTime > 90 && answerChangeFrequency > 0.3) {
      cluster = "overthinker";
      description = "Takes time to analyze, may second-guess answers";
      strengths = ["Thorough analysis", "Good on complex problems"];
      weaknesses = [
        "Time management",
        "May change correct answers unnecessarily",
      ];
    } else if (difficultyPreference < 0.3) {
      cluster = "risk-averse";
      description = "Prefers easier questions, avoids challenging topics";
      strengths = ["Good accuracy on familiar topics", "Consistent"];
      weaknesses = ["Limited growth", "Avoids difficult challenges"];
    } else if (difficultyPreference > 0.7) {
      cluster = "challenge-seeker";
      description = "Actively seeks difficult questions to improve";
      strengths = ["Rapid growth", "Handles pressure well"];
      weaknesses = [
        "May struggle with basics",
        "Inconsistent on easy questions",
      ];
    }

    return {
      cluster,
      description,
      strengths,
      weaknesses,
      metrics: {
        averageTime: avgTime,
        skipRate,
        answerChangeFrequency,
        difficultyPreference,
      },
      recommendations: this.getBehaviorRecommendations(cluster),
    };
  }

  /**
   * Get behavior recommendations
   */
  getBehaviorRecommendations(cluster) {
    const recommendations = {
      impulsive: [
        "Take a moment to read questions carefully before answering",
        "Practice mindfulness techniques before tests",
        "Review answers before submitting, especially for complex questions",
      ],
      overthinker: [
        "Trust your first instinct more often",
        "Practice with time constraints to improve speed",
        "Identify patterns where you tend to overthink",
      ],
      "risk-averse": [
        "Gradually increase question difficulty",
        "Challenge yourself with one hard question per practice session",
        "Focus on building confidence in weaker areas",
      ],
      "challenge-seeker": [
        "Ensure fundamentals are strong before advancing",
        "Balance difficult questions with review of basics",
        "Help others learn to reinforce your own understanding",
      ],
      balanced: [
        "Continue your balanced approach",
        "Focus on maintaining consistency across all topics",
        "Challenge yourself with occasional advanced questions",
      ],
    };

    return recommendations[cluster] || recommendations.balanced;
  }

  /**
   * 9. Difficulty Tolerance
   */
  calculateDifficultyTolerance(performance) {
    // Would calculate from actual answer data
    // For now, derive from topic performance
    let easyAcc = 85,
      mediumAcc = 70,
      hardAcc = 55,
      veryHardAcc = 40;

    const topicCount = (performance.topicPerformance || []).length;
    if (topicCount > 0) {
      // Simulate based on available data
      const avgMastery =
        (performance.topicPerformance || []).reduce(
          (sum, t) => sum + t.accuracy / 100,
          0,
        ) / topicCount;
      easyAcc = Math.min(95, 70 + avgMastery * 30);
      mediumAcc = Math.min(90, 55 + avgMastery * 30);
      hardAcc = Math.min(85, 40 + avgMastery * 30);
      veryHardAcc = Math.min(80, 25 + avgMastery * 30);
    }

    // Determine max sustainable difficulty
    let maxSustainable = 0.5;
    let recommendation = "";

    if (hardAcc >= 65) {
      maxSustainable = 0.8;
      recommendation =
        "You can handle very difficult questions. Focus on advanced topics.";
    } else if (mediumAcc >= 70) {
      maxSustainable = 0.6;
      recommendation = "Good progress. Gradually increase difficulty.";
    } else if (easyAcc >= 80) {
      maxSustainable = 0.4;
      recommendation =
        "Focus on mastering easy and medium difficulty questions first.";
    } else {
      recommendation =
        "Build foundation with easier questions before advancing.";
    }

    return {
      maxSustainable,
      easyAccuracy: easyAcc,
      mediumAccuracy: mediumAcc,
      hardAccuracy: hardAcc,
      veryHardAccuracy: veryHardAcc,
      recommendation,
    };
  }

  /**
   * 10. Study Efficiency
   */
  calculateStudyEfficiency(performance) {
    const testHistory = performance.testHistory || [];

    if (testHistory.length < 3) {
      return {
        score: 0.5,
        improvementPerHour: 0,
        trend: "stable",
        efficiencyRating: "Insufficient data",
        recommendations: ["Take more tests to calculate efficiency"],
      };
    }

    const firstTest = testHistory[0];
    const lastTest = testHistory[testHistory.length - 1];

    const totalTime = testHistory.reduce(
      (sum, t) => sum + (t.timeSpent || 0),
      0,
    );
    const improvement = lastTest.accuracy - firstTest.accuracy;
    const improvementPerHour =
      totalTime > 0 ? (improvement / totalTime) * 60 : 0;

    // Calculate efficiency score
    const score = Math.max(0, Math.min(1, 0.5 + improvementPerHour * 2));

    let efficiencyRating = "Average";
    if (score > 0.8) efficiencyRating = "Excellent";
    else if (score > 0.6) efficiencyRating = "Good";
    else if (score > 0.4) efficiencyRating = "Average";
    else efficiencyRating = "Needs Improvement";

    const recommendations = [];
    if (score < 0.4) {
      recommendations.push(
        "Focus on understanding concepts rather than just answering",
      );
      recommendations.push(
        "Review explanations for all questions, especially incorrect ones",
      );
    } else if (score < 0.6) {
      recommendations.push(
        "Good progress. Try to identify patterns in your mistakes",
      );
    } else {
      recommendations.push(
        "Great efficiency! Challenge yourself with harder questions",
      );
    }

    return {
      score,
      improvementPerHour: Math.round(improvementPerHour * 100) / 100,
      trend:
        improvement > 0
          ? "improving"
          : improvement < 0
            ? "declining"
            : "stable",
      avgTimePerTest: Math.round(totalTime / testHistory.length),
      efficiencyRating,
      recommendations,
    };
  }

  /**
   * 11. Focus Loss Detection
   */
  calculateFocusLoss(performance) {
    // Would analyze actual answer patterns
    // For now, return placeholder
    return {
      frequency: 0.1,
      lastDetected: new Date().toISOString(),
      triggers: ["rapid wrong attempts", "time variance spikes"],
      pattern: "occasional",
      recommendation: "Monitor focus during longer sessions",
    };
  }

  /**
   * 12. Adaptive Time Allocation
   */
  calculateTimeAllocation(performance) {
    const allocation = [];
    const totalTime = 120; // minutes per day

    // Get weakness priorities (already calculated)
    const weaknesses = this.calculateWeaknessPriority(performance);

    if (weaknesses.length === 0) {
      return [
        {
          topic: "General Practice",
          recommendedMinutes: 60,
          priority: "medium",
          reason: "Start with mixed practice to identify areas for improvement",
        },
      ];
    }

    // Calculate total weakness score
    const totalScore = weaknesses.reduce((sum, w) => sum + w.score, 0);

    weaknesses.forEach((w) => {
      const normalizedScore = Math.sqrt(w.score / totalScore);
      const normalizedTotal = weaknesses.reduce(
        (sum, w2) => sum + Math.sqrt(w2.score / totalScore),
        0,
      );

      let minutes = Math.round((normalizedScore / normalizedTotal) * totalTime);
      minutes = Math.min(45, Math.max(10, minutes));

      let priority = "medium";
      if (w.rank <= 3 && w.mastery < 0.5) priority = "high";
      else if (w.rank > 8 || w.mastery > 0.8) priority = "low";

      allocation.push({
        topic: w.topic,
        recommendedMinutes: minutes,
        priority,
        reason: w.recommendation,
        currentMastery: Math.round(w.mastery * 100),
      });
    });

    // Sort by priority
    const priorityOrder = { high: 1, medium: 2, low: 3 };
    allocation.sort((a, b) => {
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.recommendedMinutes - a.recommendedMinutes;
    });

    return allocation.slice(0, 8);
  }

  /**
   * Calculate trend from array
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
   * Format analytics for dashboard display
   */
  formatForDashboard(analytics) {
    if (!analytics) return null;

    return {
      summary: {
        conceptMastery: Object.keys(analytics.conceptMastery || {}).length,
        weakTopics:
          analytics.weaknessPriority?.filter((w) => w.rank <= 3).length || 0,
        fatigueLevel: analytics.fatigueIndex?.current || 0,
        studyEfficiency: analytics.studyEfficiency?.score || 0,
      },
      charts: {
        conceptMastery: Object.entries(analytics.conceptMastery || {}).map(
          ([topic, value]) => ({
            topic,
            mastery: value,
          }),
        ),
        weaknessPriority:
          analytics.weaknessPriority?.map((w) => ({
            topic: w.topic,
            score: w.score,
            rank: w.rank,
          })) || [],
        fatigueTrend: analytics.fatigueIndex?.bySession || [],
      },
      recommendations: {
        immediate:
          analytics.weaknessPriority
            ?.filter((w) => w.rank <= 3)
            .map((w) => w.recommendation) || [],
        studyPlan: analytics.timeAllocation || [],
        behavior: analytics.behaviorProfile?.recommendations || [],
      },
      insights: {
        behaviorCluster: analytics.behaviorProfile?.cluster || "unclassified",
        difficultyTolerance:
          analytics.difficultyTolerance?.maxSustainable || 0.5,
        forgettingCurve: analytics.forgettingCurve?.reviewRecommendations || [],
      },
    };
  }
}

export default new AnalyticsService();
