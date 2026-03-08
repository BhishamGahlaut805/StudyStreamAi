class AnalyticsService {
  // Calculate real-time analytics during test
  calculateRealtimeAnalytics(testSession) {
    const answers = testSession.answers || [];
    const answeredCount = answers.length;

    if (answeredCount === 0) {
      return {
        currentAccuracy: 0,
        projectedScore: 0,
        timePerQuestion: 0,
        pace: "normal",
        strengthAreas: [],
        weaknessAreas: [],
      };
    }

    const correctCount = answers.filter((a) => a.isCorrect).length;
    const currentAccuracy = (correctCount / answeredCount) * 100;

    // Projected final score
    const totalQuestions = testSession.questions.length;
    const projectedScore = (correctCount / totalQuestions) * 100;

    // Time analysis
    const totalTimeSpent = answers.reduce(
      (sum, a) => sum + (a.timeSpent || 0),
      0,
    );
    const avgTimePerQuestion = totalTimeSpent / answeredCount;

    // Determine pace
    let pace = "normal";
    if (testSession.testType === "real" && testSession.timeRemaining) {
      const timePerQuestionRemaining =
        testSession.timeRemaining / (totalQuestions - answeredCount);
      if (timePerQuestionRemaining < avgTimePerQuestion * 0.7) {
        pace = "slow";
      } else if (timePerQuestionRemaining > avgTimePerQuestion * 1.3) {
        pace = "fast";
      }
    }

    // Identify strength and weakness areas
    const conceptPerformance = {};
    answers.forEach((a) => {
      const concept = a.conceptArea || "general";
      if (!conceptPerformance[concept]) {
        conceptPerformance[concept] = { correct: 0, total: 0 };
      }
      conceptPerformance[concept].total++;
      if (a.isCorrect) conceptPerformance[concept].correct++;
    });

    const strengthAreas = [];
    const weaknessAreas = [];

    Object.entries(conceptPerformance).forEach(([concept, data]) => {
      if (data.total >= 2) {
        const accuracy = (data.correct / data.total) * 100;
        if (accuracy >= 70) {
          strengthAreas.push({ concept, accuracy });
        } else if (accuracy < 40) {
          weaknessAreas.push({ concept, accuracy });
        }
      }
    });

    return {
      currentAccuracy,
      projectedScore,
      answeredCount,
      remainingCount: totalQuestions - answeredCount,
      timePerQuestion: avgTimePerQuestion,
      pace,
      strengthAreas: strengthAreas.slice(0, 3),
      weaknessAreas: weaknessAreas.slice(0, 3),
      conceptPerformance,
    };
  }

  // Check if answer is correct
  checkAnswer(question, selectedOptions) {
    if (!question || !selectedOptions) return false;

    switch (question.type) {
      case "MCQ":
        return selectedOptions === question.correctAnswer;
      case "MSQ":
        // For multiple select, check if arrays match
        const selected = Array.isArray(selectedOptions)
          ? selectedOptions.sort()
          : [selectedOptions];
        const correct = Array.isArray(question.correctAnswer)
          ? question.correctAnswer.sort()
          : [question.correctAnswer];
        return JSON.stringify(selected) === JSON.stringify(correct);
      case "NAT":
        // Numeric answer with tolerance
        const numSelected = parseFloat(selectedOptions);
        const numCorrect = parseFloat(question.correctAnswer);
        return Math.abs(numSelected - numCorrect) < 0.001;
      default:
        return false;
    }
  }

  // Generate export summary
  generateExportSummary(testSession) {
    const summary = {
      testInfo: {
        sessionId: testSession.sessionId,
        testType: testSession.testType,
        title: testSession.testConfig.title,
        date: testSession.endTime || testSession.startTime,
        duration:
          testSession.testType === "real"
            ? testSession.testConfig.totalDuration
            : "Unlimited",
      },
      performance: {
        totalQuestions: testSession.summary.totalQuestions,
        answeredQuestions: testSession.summary.answeredQuestions,
        correctAnswers: testSession.summary.correctAnswers,
        incorrectAnswers: testSession.summary.incorrectAnswers,
        accuracy: testSession.summary.accuracy,
        totalMarks: testSession.summary.totalMarks,
        marksObtained: testSession.summary.marksObtained,
        percentageScore: testSession.summary.percentageScore,
      },
      timeAnalysis: {
        totalTimeSpent: testSession.summary.totalTimeSpent,
        averageTimePerQuestion: testSession.summary.averageTimePerQuestion,
      },
      conceptWise: testSession.summary.conceptWisePerformance,
      difficultyWise: testSession.summary.difficultyWisePerformance,
      strengths: [],
      weaknesses: [],
    };

    // Identify strengths and weaknesses
    if (testSession.summary.conceptWisePerformance) {
      Object.entries(testSession.summary.conceptWisePerformance).forEach(
        ([concept, data]) => {
          if (data.accuracy > 70 && data.total >= 3) {
            summary.strengths.push({ concept, accuracy: data.accuracy });
          } else if (data.accuracy < 40 && data.total >= 3) {
            summary.weaknesses.push({ concept, accuracy: data.accuracy });
          }
        },
      );
    }

    return summary;
  }

  // Calculate features for Flask LSTM models
  extractFeaturesFromAnswers(answers, questions) {
    const features = {
      practice: [], // 12 features for practice model
      exam: [], // 8 features for exam model
      conceptHistory: {},
      sessionFeatures: [],
    };

    // Calculate practice features (last 20 answers)
    const recentAnswers = answers.slice(-20);
    recentAnswers.forEach((answer, index) => {
      const question = questions.find((q) => q._id === answer.questionId);
      if (!question) return;

      // 12 features for practice model
      const accuracy = answer.isCorrect ? 1 : 0;
      const responseTime = answer.timeSpent || 0;
      const avgTime =
        answers
          .filter((a) => a.isCorrect)
          .reduce((sum, a) => sum + (a.timeSpent || 0), 0) /
        Math.max(1, answers.filter((a) => a.isCorrect).length);
      const normalizedResponseTime = avgTime > 0 ? responseTime / avgTime : 1;

      // Rolling variance (last 5)
      const last5Times = answers.slice(-5).map((a) => a.timeSpent || 0);
      const mean5 = last5Times.reduce((a, b) => a + b, 0) / last5Times.length;
      const variance5 =
        last5Times.reduce((a, b) => a + Math.pow(b - mean5, 2), 0) /
        last5Times.length;

      const answerChanges = answer.answerChanges || 0;
      const stressScore = 1 - Math.min(1, normalizedResponseTime / 2);
      const confidence = answer.confidence || 0.5;

      // Concept mastery (rolling accuracy for this concept)
      const conceptAnswers = answers.filter(
        (a) => a.conceptArea === question.conceptArea,
      );
      const conceptAccuracy =
        conceptAnswers.filter((a) => a.isCorrect).length /
        Math.max(1, conceptAnswers.length);

      const currentDifficulty = question.difficulty || 0.5;

      // Consecutive correct streak
      let streak = 0;
      for (let i = answers.length - 1; i >= 0; i--) {
        if (answers[i].isCorrect) streak++;
        else break;
      }

      const fatigue = index / Math.max(1, recentAnswers.length); // Simple fatigue indicator
      const focusLoss = answer.answerChanges > 2 ? 1 : 0;
      const preferredOffset = currentDifficulty - (conceptAccuracy || 0.5);

      features.practice.push([
        accuracy,
        normalizedResponseTime,
        variance5,
        answerChanges,
        stressScore,
        confidence,
        conceptAccuracy,
        currentDifficulty,
        streak,
        fatigue,
        focusLoss,
        preferredOffset,
      ]);
    });

    // Calculate exam features
    if (answers.length > 0) {
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
        answers.reduce((sum, a) => sum + (a.timeSpent || 0), 0) /
        answers.length;
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

      features.exam = [
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

    // Concept history
    const conceptMap = {};
    answers.forEach((answer) => {
      const concept = answer.conceptArea || "general";
      if (!conceptMap[concept]) conceptMap[concept] = [];
      conceptMap[concept].push(answer.isCorrect ? 1 : 0);
    });

    Object.keys(conceptMap).forEach((concept) => {
      features.conceptHistory[concept] = conceptMap[concept].slice(-30);
    });

    // Session features
    if (answers.length >= 5) {
      const sessionData = answers.slice(-14); // Last 14 answers as session proxy
      const sessionAccuracy = sessionData.map((a) => (a.isCorrect ? 1 : 0));
      const sessionTimes = sessionData.map((a) => a.timeSpent || 0);

      features.sessionFeatures = [
        sessionAccuracy.reduce((a, b) => a + b, 0) / sessionAccuracy.length,
        this.calculateSlope(sessionAccuracy),
        this.calculateSlope(sessionData.map((a) => a.confidence || 0.5)),
        this.calculateSlope(sessionTimes),
        sessionTimes[sessionTimes.length - 1] - sessionTimes[0],
        sessionTimes.reduce((a, b) => a + b, 0) / 60,
        1, // days without break placeholder
        sessionData
          .filter((a, i) => {
            const q = questions.find((q) => q._id === a.questionId);
            return q?.difficulty > 0.7;
          })
          .filter((a) => a.isCorrect).length /
          Math.max(
            1,
            sessionData.filter((a) => {
              const q = questions.find((q) => q._id === a.questionId);
              return q?.difficulty > 0.7;
            }).length,
          ),
        1 - this.calculateStandardDeviation(sessionAccuracy),
        this.calculateSlope(sessionData.map((a) => a.confidence || 0.5)),
        sessionData.filter((a) => (a.timeSpent || 0) < 5).length /
          sessionData.length,
        sessionData
          .slice(-Math.floor(sessionData.length / 2))
          .filter((a) => a.isCorrect).length /
          Math.floor(sessionData.length / 2) -
          sessionData
            .slice(0, Math.floor(sessionData.length / 2))
            .filter((a) => a.isCorrect).length /
            Math.floor(sessionData.length / 2),
      ];
    }

    return features;
  }

  // Calculate slope of an array
  calculateSlope(values) {
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

  // Calculate standard deviation
  calculateStandardDeviation(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }
}

module.exports = new AnalyticsService();
