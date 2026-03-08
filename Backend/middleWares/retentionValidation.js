const validateRetentionSession = (req, res, next) => {
  const { subject, topics } = req.body;

  if (!subject) {
    return res.status(400).json({
      success: false,
      error: "Subject is required",
    });
  }

  if (!["english", "gk"].includes(subject)) {
    return res.status(400).json({
      success: false,
      error: "Subject must be either 'english' or 'gk'",
    });
  }

  if (topics && !Array.isArray(topics)) {
    return res.status(400).json({
      success: false,
      error: "Topics must be an array",
    });
  }

  // Validate topics based on subject
  if (topics && topics.length > 0) {
    const validTopics =
      subject === "english"
        ? [
            "vocabulary",
            "idioms",
            "phrases",
            "synonyms",
            "antonyms",
            "one_word_substitution",
          ]
        : ["history", "geography", "science", "current_affairs"];

    const invalidTopics = topics.filter((t) => !validTopics.includes(t));
    if (invalidTopics.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid topics for ${subject}: ${invalidTopics.join(", ")}`,
      });
    }
  }

  next();
};

const validateAnswer = (req, res, next) => {
  const { questionId, selectedOptions, responseTimeMs } = req.body;

  if (!questionId) {
    return res.status(400).json({
      success: false,
      error: "questionId is required",
    });
  }

  if (selectedOptions === undefined) {
    return res.status(400).json({
      success: false,
      error: "selectedOptions is required",
    });
  }

  if (
    responseTimeMs !== undefined &&
    (typeof responseTimeMs !== "number" || responseTimeMs < 0)
  ) {
    return res.status(400).json({
      success: false,
      error: "responseTimeMs must be a positive number",
    });
  }

  next();
};

const validateScheduleGeneration = (req, res, next) => {
  const { subject, days } = req.body;

  if (subject && !["english", "gk", "both"].includes(subject)) {
    return res.status(400).json({
      success: false,
      error: "Subject must be 'english', 'gk', or 'both'",
    });
  }

  if (days && (typeof days !== "number" || days < 1 || days > 30)) {
    return res.status(400).json({
      success: false,
      error: "days must be a number between 1 and 30",
    });
  }

  next();
};

module.exports = {
  validateRetentionSession,
  validateAnswer,
  validateScheduleGeneration,
};
