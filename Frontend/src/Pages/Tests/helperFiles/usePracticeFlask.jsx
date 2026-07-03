// hooks/usePracticeFlask.jsx

import { useCallback } from "react";
import flaskService from "../../../services/flaskService";

export const usePracticeFlask = ({
  studentId,
  setFlaskPredictions,
  setFeatures,
  setDifficultySyncing,
  setWindowTrainingTriggered,
  flaskPredictions,
  features,
  questionStartTime,
  answerChanges,
  metrics,
  session,
  testService,
  sessionClockBaseRef,
  questionClockStartRef,
}) => {
  // ==================== HELPER FUNCTIONS ====================

  const calculateTrend = (values) => {
    if (values.length < 2) return 0;
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((a, b, i) => a + b * values[i], 0);
    const sumX2 = x.reduce((a, b) => a + b * b, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return isNaN(slope) ? 0 : slope;
  };

  const calculateStdDev = (values) => {
    if (!values || values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  };

  const calculateSecondHalfDrop = (answers) => {
    if (!answers || answers.length < 4) return 0;
    const half = Math.floor(answers.length / 2);
    const firstHalf = answers.slice(0, half);
    const secondHalf = answers.slice(half);
    const firstAcc =
      firstHalf.filter((a) => a.isCorrect).length /
      Math.max(1, firstHalf.length);
    const secondAcc =
      secondHalf.filter((a) => a.isCorrect).length /
      Math.max(1, secondHalf.length);
    return firstAcc - secondAcc;
  };

  // ==================== FEATURE EXTRACTION ====================

  const extractAndSendFeatures = useCallback(
    async (question, result) => {
      try {
        const concept = question.conceptArea || question.topic || "general";
        const answers = testService.answers || [];

        // ==================== FIX: Get base values ====================
        const accuracy = result.isCorrect ? 1 : 0;
        const responseTime = Math.floor(
          (Date.now() - questionStartTime) / 1000,
        );

        // ==================== FIX: Calculate normalized response time ====================
        const correctAnswers = answers.filter((a) => a.isCorrect);
        const avgTime =
          correctAnswers.length > 0
            ? correctAnswers.reduce((sum, a) => sum + (a.timeSpent || 0), 0) /
              correctAnswers.length
            : Math.max(responseTime, 1);
        const normalizedTime =
          avgTime > 0 ? Math.min(responseTime / avgTime, 2) : 1;

        // ==================== FIX: Calculate variance ====================
        const last5Times = answers.slice(-5).map((a) => a.timeSpent || 0);
        let variance5 = 0;
        if (last5Times.length > 0) {
          const mean5 =
            last5Times.reduce((a, b) => a + b, 0) / last5Times.length;
          variance5 =
            last5Times.reduce((a, b) => a + Math.pow(b - mean5, 2), 0) /
            last5Times.length;
        }

        // ==================== FIX: Calculate concept accuracy ====================
        const conceptAnswers = answers.filter((a) => a.conceptArea === concept);
        const conceptAccuracy =
          conceptAnswers.length > 0
            ? conceptAnswers.filter((a) => a.isCorrect).length /
              conceptAnswers.length
            : 0.5;

        // ==================== FIX: Calculate streak ====================
        let streak = 0;
        for (let i = answers.length - 1; i >= 0; i--) {
          if (answers[i]?.isCorrect) streak++;
          else break;
        }

        // ==================== FIX: Build 12 features ====================
        const newFeatures = [
          Math.max(0, Math.min(1, accuracy)),
          Math.max(0, Math.min(1, normalizedTime / 2)),
          Math.max(0, Math.min(1, variance5 / 10)),
          Math.max(0, Math.min(1, answerChanges / 5)),
          Math.max(0, Math.min(1, 1 - normalizedTime / 2)),
          Math.max(0, Math.min(1, result.confidence || 0.5)),
          Math.max(0, Math.min(1, conceptAccuracy)),
          Math.max(0, Math.min(1, question.difficulty || 0.5)),
          Math.max(0, Math.min(1, streak / 10)),
          Math.max(0, Math.min(1, answers.length / 20)),
          Math.max(0, Math.min(1, answerChanges > 2 ? 1 : 0)),
          Math.max(
            0,
            Math.min(1, (question.difficulty || 0.5) - conceptAccuracy + 0.5),
          ),
        ];

        // ==================== FIX: Update session features ====================
        const recentAnswers = answers.slice(-14);
        let updatedSessionFeatures = features.sessionFeatures || [];

        if (recentAnswers.length >= 5) {
          const sessionAccuracy = recentAnswers.map((a) =>
            a.isCorrect ? 1 : 0,
          );
          const sessionTimes = recentAnswers.map((a) => a.timeSpent || 0);
          const sessionConfidence = recentAnswers.map(
            (a) => a.confidence || 0.5,
          );

          updatedSessionFeatures = [
            sessionAccuracy.reduce((a, b) => a + b, 0) / sessionAccuracy.length,
            calculateTrend(sessionAccuracy),
            calculateTrend(sessionConfidence),
            calculateTrend(sessionTimes),
            sessionTimes[sessionTimes.length - 1] - (sessionTimes[0] || 0),
            sessionTimes.reduce((a, b) => a + b, 0) / 60,
            1,
            recentAnswers
              .filter((a) => a.difficulty > 0.7)
              .filter((a) => a.isCorrect).length /
              Math.max(
                1,
                recentAnswers.filter((a) => a.difficulty > 0.7).length,
              ),
            1 - calculateStdDev(sessionAccuracy),
            calculateTrend(sessionConfidence),
            recentAnswers.filter((a) => (a.timeSpent || 0) < 5).length /
              Math.max(1, recentAnswers.length),
            calculateSecondHalfDrop(recentAnswers),
          ];
        }

        // ==================== FIX: Update concept history ====================
        const updatedConceptHistory = { ...(features.conceptHistory || {}) };
        const currentHistory = updatedConceptHistory[concept] || [];
        updatedConceptHistory[concept] = [...currentHistory, accuracy].slice(
          -30,
        );

        // ==================== FIX: Create snapshot with validated data ====================
        const snapshot = {
          practice: [...(features.practice || []), newFeatures],
          conceptHistory: updatedConceptHistory,
          sessionFeatures: updatedSessionFeatures,
        };

        setFeatures(snapshot);

        // ==================== FIX: Upload attempts if available ====================
        if (answers.length >= 1) {
          const latestAttempt = answers[answers.length - 1];
          if (latestAttempt) {
            try {
              await flaskService.uploadAttempts(
                studentId,
                [latestAttempt],
                session?.sessionId ||
                  testService.currentSession?.sessionId ||
                  null,
              );
            } catch (uploadError) {
              console.warn("[Flask] Upload attempts failed:", uploadError);
            }
          }
        }

        return snapshot;
      } catch (err) {
        console.error("Error extracting features:", err);
        // ==================== FIX: Return fallback snapshot ====================
        return {
          practice: [...(features.practice || []), Array(12).fill(0.5)],
          conceptHistory: features.conceptHistory || {},
          sessionFeatures: features.sessionFeatures || [],
        };
      }
    },
    [
      testService,
      questionStartTime,
      answerChanges,
      features,
      setFeatures,
      studentId,
      session,
      flaskService,
    ],
  );

  // ==================== UPDATE PREDICTIONS ====================

  const updateFlaskPredictions = useCallback(
    async (concept = "general", featureSnapshot = null) => {
      try {
        const sourceFeatures = featureSnapshot || features;

        // ==================== FIX: Get last features safely ====================
        let lastFeatures = [];

        if (sourceFeatures.practice && sourceFeatures.practice.length > 0) {
          const last =
            sourceFeatures.practice[sourceFeatures.practice.length - 1];
          if (Array.isArray(last) && last.length === 12) {
            lastFeatures = last;
          } else if (Array.isArray(last)) {
            // Pad or truncate to 12
            lastFeatures =
              last.length < 12
                ? [...last, ...Array(12 - last.length).fill(0.5)]
                : last.slice(0, 12);
          }
        }

        // ==================== FIX: Create default features if needed ====================
        if (!lastFeatures || lastFeatures.length === 0) {
          const accuracy = metrics?.currentAccuracy
            ? metrics.currentAccuracy / 100
            : 0.5;
          const difficulty = metrics?.avgDifficulty || 0.5;
          lastFeatures = [
            accuracy,
            0.5,
            0.5,
            0.5,
            0.5,
            0.5,
            accuracy,
            difficulty,
            0.5,
            0.5,
            0.5,
            0.5,
          ];
        }

        // ==================== FIX: Ensure exactly 12 features ====================
        if (lastFeatures.length !== 12) {
          if (lastFeatures.length < 12) {
            lastFeatures = [
              ...lastFeatures,
              ...Array(12 - lastFeatures.length).fill(0.5),
            ];
          } else {
            lastFeatures = lastFeatures.slice(0, 12);
          }
        }

        // ==================== FIX: Normalize features ====================
        lastFeatures = lastFeatures.map((f) => {
          const num = Number(f);
          return isNaN(num) ? 0.5 : Math.max(0, Math.min(1, num));
        });

        // ==================== FIX: Get concept history ====================
        const conceptHistory = sourceFeatures.conceptHistory?.[concept] || [];

        // ==================== FIX: Only call API if we have valid studentId ====================
        if (!studentId) {
          console.warn(
            "[Flask] No studentId available, skipping prediction update",
          );
          return;
        }

        const [difficultyResponse, velocityResponse, burnoutResponse] =
          await Promise.all([
            flaskService.getPracticeDifficulty(
              studentId,
              lastFeatures,
              concept,
            ),
            flaskService.getLearningVelocity(
              studentId,
              concept,
              conceptHistory,
            ),
            flaskService.getBurnoutRisk(
              studentId,
              sourceFeatures.sessionFeatures || [],
            ),
          ]);

        setFlaskPredictions((prev) => ({
          ...prev,
          nextDifficulty: difficultyResponse.nextDifficulty || 0.5,
          difficultyLevel:
            difficultyResponse.difficultyLevel || prev.difficultyLevel,
          confidence: difficultyResponse.confidence || 0.5,
          method: difficultyResponse.method || "unknown",
          windowSize: Number(
            difficultyResponse.retrainInterval || DIFFICULTY_WINDOW_SIZE,
          ),
          windowRemaining: Number(
            difficultyResponse.rowsToNextTraining ?? DIFFICULTY_WINDOW_SIZE,
          ),
          entriesLeftForRetraining: Number(
            difficultyResponse.entriesLeftForRetraining ??
              difficultyResponse.rowsToNextTraining ??
              DIFFICULTY_WINDOW_SIZE,
          ),
          modelTrained: !!difficultyResponse.modelTrained,
          featureRows: Number(difficultyResponse.featureRows || 0),
          retrainInterval: Number(
            difficultyResponse.retrainInterval || DIFFICULTY_WINDOW_SIZE,
          ),
          lastTrainedAt: difficultyResponse.lastTrainedAt || prev.lastTrainedAt,
          lastUpdatedAt: new Date().toISOString(),
          learningVelocity: velocityResponse,
          burnoutRisk: burnoutResponse,
        }));

        // ==================== FIX: Update test service ====================
        if (testService?.practiceMode) {
          testService.practiceMode.currentDifficulty =
            difficultyResponse.nextDifficulty || 0.5;
          testService.practiceMode.difficultyWindowSize = Number(
            difficultyResponse.retrainInterval || DIFFICULTY_WINDOW_SIZE,
          );
          testService.practiceMode.difficultyWindowRemaining = Number(
            difficultyResponse.rowsToNextTraining ?? DIFFICULTY_WINDOW_SIZE,
          );
        }
      } catch (err) {
        console.error("Error updating Flask predictions:", err);
        // ==================== FIX: Fallback prediction ====================
        setFlaskPredictions((prev) => ({
          ...prev,
          nextDifficulty: 0.5,
          confidence: 0.5,
          lastUpdatedAt: new Date().toISOString(),
        }));
      }
    },
    [studentId, features, metrics, setFlaskPredictions, testService],
  );

  // ==================== PROFILE FUNCTIONS ====================

  const getPracticeProfile = useCallback(async () => {
    try {
      if (!studentId) {
        console.warn("[Flask] No studentId available for profile");
        return null;
      }
      return await flaskService.getPracticeProfile(studentId);
    } catch (error) {
      console.error("Error getting practice profile:", error);
      return null;
    }
  }, [studentId]);

  const initializeFlaskPredictions = useCallback(async () => {
    try {
      const profile = await getPracticeProfile();
      if (profile?.success) {
        setFlaskPredictions((prev) => ({
          ...prev,
          nextDifficulty: profile.currentDifficulty || 0.5,
          difficultyLevel:
            profile.currentDifficultyLevel || prev.difficultyLevel,
          featureRows: profile.featureRows || 0,
          modelTrained: profile.modelTrained || false,
          windowRemaining: profile.rowsToNextTraining || 0,
          lastTrainedAt: profile.lastTrainedAt || null,
        }));
      }
    } catch (error) {
      console.error("Error initializing Flask predictions:", error);
    }
  }, [getPracticeProfile, setFlaskPredictions]);

  return {
    updateFlaskPredictions,
    extractAndSendFeatures,
    getPracticeProfile,
    initializeFlaskPredictions,
  };
};
