const RetentionMetrics = require("../models/RetentionMetrics");
const RetentionSchedule = require("../models/RetentionSchedule");
const QuestionRepetition = require("../models/QuestionRepetition");

const latestBridgePayloads = {
  initial_predictions: null,
  retention_update: null,
  batch_complete: null,
  performance_metrics: null,
  schedule_update: null,
  question_sequence: null,
  stress_fatigue_update: null,
};

const saveLatest = (key, payload) => {
  latestBridgePayloads[key] = {
    ...payload,
    receivedAt: new Date().toISOString(),
  };
};

const updateMetricsIfExists = async (studentId, updater) => {
  if (!studentId) return null;
  const metrics = await RetentionMetrics.findOne({
    studentId: String(studentId),
  });
  if (!metrics) return null;
  updater(metrics);
  metrics.lastUpdated = new Date();
  await metrics.save();
  return metrics;
};

exports.health = async (req, res) => {
  res.json({
    success: true,
    status: "healthy",
    bridge: "retention-flask-node",
    timestamp: new Date().toISOString(),
  });
};

exports.initialPredictions = async (req, res) => {
  try {
    const payload = req.body || {};
    const studentId = String(payload.user_id || "");

    saveLatest("initial_predictions", payload);

    await updateMetricsIfExists(studentId, (metrics) => {
      metrics.flaskPredictions = {
        micro: payload.predictions?.micro,
        meso: payload.predictions?.meso,
        macro: payload.predictions?.macro,
        lastUpdated: new Date(),
      };
      if (payload.predictions?.forgetting_curves) {
        metrics.forgettingCurves = payload.predictions.forgetting_curves;
      }
      if (payload.metrics?.stress_pattern) {
        metrics.stressPatterns = payload.metrics.stress_pattern;
      }
      if (payload.metrics?.fatigue_index) {
        metrics.fatiguePatterns = payload.metrics.fatigue_index;
      }
    });

    res.json({ success: true, received: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.performanceMetrics = async (req, res) => {
  try {
    const payload = req.body || {};
    const studentId = String(payload.user_id || "");

    saveLatest("performance_metrics", payload);

    await updateMetricsIfExists(studentId, (metrics) => {
      if (payload.summary?.overall_accuracy) {
        metrics.overallMetrics.overallAccuracy =
          payload.summary.overall_accuracy;
      }
      if (payload.summary?.retention_rate) {
        metrics.overallMetrics.retentionRate = payload.summary.retention_rate;
      }
      if (payload.metrics?.stress_pattern) {
        metrics.stressPatterns = payload.metrics.stress_pattern;
      }
      if (payload.metrics?.fatigue_index) {
        metrics.fatiguePatterns = payload.metrics.fatigue_index;
      }
    });

    res.json({ success: true, received: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.scheduleUpdate = async (req, res) => {
  try {
    const payload = req.body || {};
    const studentId = String(payload.user_id || "");

    saveLatest("schedule_update", payload);

    if (studentId && payload.schedule) {
      await RetentionSchedule.updateMany(
        { studentId, isActive: true },
        { isActive: false },
      );
    }

    res.json({ success: true, received: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.questionSequence = async (req, res) => {
  try {
    const payload = req.body || {};
    const studentId = String(payload.user_id || "");

    saveLatest("question_sequence", payload);

    if (studentId && Array.isArray(payload.question_sequence)) {
      for (const item of payload.question_sequence) {
        if (!item || !item.question_id) continue;
        await QuestionRepetition.updateOne(
          { studentId, questionId: item.question_id },
          {
            $set: {
              currentBatchType: item.batch_type || "immediate",
              currentRetention: item.retention || 0.5,
              nextScheduledDate: item.scheduled_date
                ? new Date(item.scheduled_date)
                : undefined,
            },
          },
        );
      }
    }

    res.json({ success: true, received: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.stressFatigueUpdate = async (req, res) => {
  try {
    const payload = req.body || {};
    const studentId = String(payload.user_id || "");

    saveLatest("stress_fatigue_update", payload);

    await updateMetricsIfExists(studentId, (metrics) => {
      if (payload.stress_fatigue) {
        metrics.stressPatterns = {
          ...(metrics.stressPatterns || {}),
          ...(payload.stress_fatigue || {}),
        };
        metrics.fatiguePatterns = {
          ...(metrics.fatiguePatterns || {}),
          ...(payload.stress_fatigue || {}),
        };
      }
    });

    res.json({ success: true, received: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.retentionUpdate = async (req, res) => {
  try {
    saveLatest("retention_update", req.body || {});
    res.json({ success: true, received: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.batchComplete = async (req, res) => {
  try {
    saveLatest("batch_complete", req.body || {});
    res.json({ success: true, received: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
