// hooks/usePracticeAnalytics.js

import { useCallback } from "react";

export const usePracticeAnalytics = ({
  metrics,
  answerChanges,
  features,
  modelsData,
  setModelsData,
  testService,
}) => {
  const calculateModelsData = useCallback(() => {
    const answers = testService.answers;
    if (answers.length === 0) return;

    // 1. Concept Mastery
    const conceptMastery = {};
    const conceptMap = {};

    answers.forEach((answer) => {
      const concept = answer.conceptArea || "general";
      if (!conceptMap[concept]) {
        conceptMap[concept] = [];
      }
      conceptMap[concept].push(answer.isCorrect ? 1 : 0);
    });

    Object.entries(conceptMap).forEach(([concept, history]) => {
      const oldMastery = modelsData.conceptMastery[concept] || 0.5;
      const recentAccuracy = history.slice(-5).reduce((a, b) => a + b, 0) / 5;
      const learningRate = 0.3;
      conceptMastery[concept] =
        oldMastery + learningRate * (recentAccuracy - oldMastery);
    });

    // 2. Stability Index
    const stabilityIndex = {};
    Object.entries(conceptMap).forEach(([concept, history]) => {
      if (history.length >= 3) {
        const recent = history.slice(-10);
        const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
        const variance =
          recent.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recent.length;
        stabilityIndex[concept] = Math.max(0, Math.min(1, 1 - variance / 0.25));
      } else {
        stabilityIndex[concept] = 0.5;
      }
    });

    // 3. Confidence Calibration
    const confidenceCalibration = {
      overall: 0.15,
      byDifficulty: {
        easy: 0.08,
        medium: 0.12,
        hard: 0.18,
      },
    };

    // 4. Error Patterns
    const errorPatterns = {
      conceptual: 0.3,
      careless: 0.3,
      guess: 0.2,
      overconfidence: 0.2,
    };

    // 5. Weakness Priority
    const weaknessPriority = Object.entries(conceptMap)
      .map(([concept, history]) => {
        const mastery = history.reduce((a, b) => a + b, 0) / history.length;
        const errorRate = 1 - mastery;
        const daysSince = 1;
        const retentionDecay = Math.min(1, daysSince / 14);
        const weaknessScore = (1 - mastery) * errorRate * retentionDecay;

        return {
          topic: concept,
          score: weaknessScore,
          mastery,
          rank: 0,
          recommendation:
            mastery < 0.4
              ? "Critical: Review fundamental concepts"
              : mastery < 0.6
                ? "Focus: Practice more"
                : "Maintain: Regular review",
        };
      })
      .sort((a, b) => b.score - a.score)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    // 6. Forgetting Curve
    const forgettingCurve = {
      decayConstant: 0.1,
      retentionScores: {},
    };

    // 7. Fatigue Index
    const fatigueIndex = Math.min(
      1,
      0.2 +
        metrics.sessionTime / 3600 +
        (1 - metrics.currentAccuracy / 100) * 0.3,
    );

    // 8. Behavior Profile
    const avgTime = metrics.averageTimePerQuestion || 60;
    let behaviorProfile = "balanced";
    if (avgTime < 30 && answerChanges < 1) {
      behaviorProfile = "impulsive";
    } else if (avgTime > 90 && answerChanges > 2) {
      behaviorProfile = "overthinker";
    }

    // 9. Difficulty Tolerance
    const difficultyTolerance = Math.min(
      1,
      0.3 + (metrics.currentAccuracy / 100) * 0.5,
    );

    // 10. Study Efficiency
    const studyEfficiency = Math.min(
      1,
      metrics.correctCount / Math.max(1, metrics.sessionTime / 60),
    );

    // 11. Focus Loss
    const focusLoss = answerChanges / Math.max(1, answers.length) / 5;

    // 12. Time Allocation
    const timeAllocation = weaknessPriority.slice(0, 5).map((item) => ({
      topic: item.topic,
      recommendedMinutes: Math.round(30 * (1 - item.mastery)),
      priority: item.rank <= 2 ? "high" : item.rank <= 4 ? "medium" : "low",
      reason: item.recommendation,
    }));

    setModelsData({
      conceptMastery,
      stabilityIndex,
      confidenceCalibration,
      errorPatterns,
      weaknessPriority,
      forgettingCurve,
      fatigueIndex,
      behaviorProfile,
      difficultyTolerance,
      studyEfficiency,
      focusLoss,
      timeAllocation,
    });
  }, [
    metrics,
    answerChanges,
    features.conceptHistory,
    modelsData.conceptMastery,
  ]);

  return {
    calculateModelsData,
  };
};
