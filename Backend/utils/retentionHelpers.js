// Calculate retention using Ebbinghaus forgetting curve
const calculateRetention = (
  initialRetention,
  daysSince,
  decayConstant = 0.1,
) => {
  return initialRetention * Math.exp(-decayConstant * daysSince);
};

// Calculate optimal next review day
const calculateNextReviewDay = (
  currentRetention,
  targetRetention = 0.7,
  decayConstant = 0.1,
) => {
  if (currentRetention <= targetRetention) return 0;
  return Math.ceil(
    Math.log(targetRetention / currentRetention) / -decayConstant,
  );
};

// Get batch type from retention
const getBatchTypeFromRetention = (retention) => {
  if (retention < 0.3) return "immediate";
  if (retention < 0.5) return "short_term";
  if (retention < 0.7) return "medium_term";
  if (retention < 0.85) return "long_term";
  return "mastered";
};

// Get questions count for batch type
const getQuestionsCountForBatch = (batchType) => {
  const counts = {
    immediate: 3,
    short_term: 5,
    medium_term: 8,
    long_term: 10,
    mastered: 5,
  };
  return counts[batchType] || 5;
};

// Calculate stress level from interaction
const calculateStressLevel = (responseTimeMs, avgResponseTime, difficulty) => {
  const timeRatio = responseTimeMs / avgResponseTime;
  let stress = 0.3; // Base stress

  if (timeRatio > 1.5) stress += 0.3; // Took too long
  if (difficulty > 0.7) stress += 0.2; // Hard question

  return Math.min(1, stress);
};

// Calculate fatigue index
const calculateFatigueIndex = (
  sessionPosition,
  totalSessionQuestions,
  timeSinceBreak,
) => {
  const positionRatio = sessionPosition / totalSessionQuestions;
  let fatigue = 0.2 + positionRatio * 0.4; // Increases with position

  if (timeSinceBreak > 30 * 60 * 1000) {
    // 30 minutes without break
    fatigue += 0.2;
  }

  return Math.min(1, fatigue);
};

// Calculate focus score
const calculateFocusScore = (hesitationCount, answerChanges, timeSpent) => {
  let focus = 0.8; // Base focus

  focus -= hesitationCount * 0.1;
  focus -= answerChanges * 0.15;

  if (timeSpent > 120000) focus -= 0.2; // Over 2 minutes

  return Math.max(0.1, Math.min(1, focus));
};

// Calculate confidence
const calculateConfidence = (isCorrect, responseTimeMs, avgResponseTime) => {
  let confidence = 0.5; // Base

  if (isCorrect) {
    confidence += 0.3;
    if (responseTimeMs < avgResponseTime * 0.7) confidence += 0.2; // Fast correct
  } else {
    confidence -= 0.2;
    if (responseTimeMs > avgResponseTime * 1.3) confidence -= 0.1; // Slow incorrect
  }

  return Math.max(0.1, Math.min(1, confidence));
};

// Group answers by topic
const groupByTopic = (answers) => {
  const grouped = {};

  answers.forEach((answer) => {
    if (!grouped[answer.topicCategory]) {
      grouped[answer.topicCategory] = {
        total: 0,
        correct: 0,
        totalTime: 0,
        stressSum: 0,
        fatigueSum: 0,
      };
    }

    grouped[answer.topicCategory].total++;
    if (answer.isCorrect) grouped[answer.topicCategory].correct++;
    grouped[answer.topicCategory].totalTime += answer.responseTimeMs;
    grouped[answer.topicCategory].stressSum += answer.stressLevel;
    grouped[answer.topicCategory].fatigueSum += answer.fatigueIndex;
  });

  // Calculate averages
  Object.keys(grouped).forEach((topic) => {
    grouped[topic].accuracy =
      (grouped[topic].correct / grouped[topic].total) * 100;
    grouped[topic].avgTime = grouped[topic].totalTime / grouped[topic].total;
    grouped[topic].avgStress = grouped[topic].stressSum / grouped[topic].total;
    grouped[topic].avgFatigue =
      grouped[topic].fatigueSum / grouped[topic].total;
  });

  return grouped;
};

// Generate session report
const generateSessionReport = (session) => {
  const answers = session.answers;
  if (answers.length === 0) return null;

  const correct = answers.filter((a) => a.isCorrect).length;
  const accuracy = (correct / answers.length) * 100;

  const topicBreakdown = groupByTopic(answers);

  const stressLevels = answers.map((a) => a.stressLevel);
  const fatigueLevels = answers.map((a) => a.fatigueIndex);

  const firstHalf = answers.slice(0, Math.floor(answers.length / 2));
  const secondHalf = answers.slice(Math.floor(answers.length / 2));

  const firstHalfAcc =
    firstHalf.length > 0
      ? (firstHalf.filter((a) => a.isCorrect).length / firstHalf.length) * 100
      : 0;
  const secondHalfAcc =
    secondHalf.length > 0
      ? (secondHalf.filter((a) => a.isCorrect).length / secondHalf.length) * 100
      : 0;

  return {
    sessionId: session.sessionId,
    subject: session.subject,
    duration: session.endTime
      ? (session.endTime - session.startTime) / (1000 * 60)
      : null,
    totalQuestions: answers.length,
    correctAnswers: correct,
    accuracy,
    topicBreakdown,
    stressPattern: {
      average: stressLevels.reduce((a, b) => a + b, 0) / stressLevels.length,
      trend: stressLevels[stressLevels.length - 1] - stressLevels[0],
    },
    fatiguePattern: {
      average: fatigueLevels.reduce((a, b) => a + b, 0) / fatigueLevels.length,
      trend: fatigueLevels[fatigueLevels.length - 1] - fatigueLevels[0],
    },
    stamina: secondHalfAcc - firstHalfAcc,
    recommendations: generateRecommendations(
      topicBreakdown,
      accuracy,
      stressLevels,
      fatigueLevels,
    ),
  };
};

// Generate recommendations
const generateRecommendations = (
  topicBreakdown,
  accuracy,
  stressLevels,
  fatigueLevels,
) => {
  const recommendations = [];

  // Topic-based
  Object.entries(topicBreakdown).forEach(([topic, data]) => {
    if (data.total >= 3 && data.accuracy < 50) {
      recommendations.push({
        type: "weakness",
        priority: "high",
        topic,
        message: `Focus on improving ${topic}`,
        action: `Practice more questions in ${topic}`,
      });
    }
  });

  // Stress-based
  const avgStress =
    stressLevels.reduce((a, b) => a + b, 0) / stressLevels.length;
  if (avgStress > 0.7) {
    recommendations.push({
      type: "stress",
      priority: "high",
      message: "High stress levels detected",
      action: "Take breaks and practice relaxation techniques",
    });
  }

  // Fatigue-based
  const avgFatigue =
    fatigueLevels.reduce((a, b) => a + b, 0) / fatigueLevels.length;
  if (avgFatigue > 0.7) {
    recommendations.push({
      type: "fatigue",
      priority: "high",
      message: "High fatigue detected",
      action: "Consider shorter sessions with adequate rest",
    });
  }

  // Accuracy-based
  if (accuracy < 40) {
    recommendations.push({
      type: "accuracy",
      priority: "high",
      message: "Focus on understanding concepts before speed",
      action: "Take untimed practice and review explanations",
    });
  } else if (accuracy > 80) {
    recommendations.push({
      type: "challenge",
      priority: "medium",
      message: "Great accuracy! Time to increase difficulty",
      action: "Try more challenging questions",
    });
  }

  return recommendations;
};

// Format time (ms to readable)
const formatTime = (ms) => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
};

module.exports = {
  calculateRetention,
  calculateNextReviewDay,
  getBatchTypeFromRetention,
  getQuestionsCountForBatch,
  calculateStressLevel,
  calculateFatigueIndex,
  calculateFocusScore,
  calculateConfidence,
  groupByTopic,
  generateSessionReport,
  formatTime,
};
