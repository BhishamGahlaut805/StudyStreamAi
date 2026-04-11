import React, { useEffect, useMemo, useRef, useState } from "react";

const TOTAL_SLIDES = 14;

const slides = [
  {
    title: "Retention Learning Blueprint",
    subtitle:
      "Micro LSTM + Macro LSTM intelligence, feature engineering, and scheduling loop",
    accent: "from-red-500 via-orange-500 to-yellow-400",
  },
  {
    title: "Goal and Importance",
    subtitle: "Why retention-first learning improves long-term outcomes",
    accent: "from-amber-500 via-orange-500 to-red-500",
  },
  {
    title: "System Architecture",
    subtitle: "Frontend events, Node orchestration, Flask LSTM services",
    accent: "from-emerald-500 via-lime-500 to-yellow-400",
  },
  {
    title: "Data Pipeline",
    subtitle: "How data is sent from React to Node to Flask and persisted",
    accent: "from-yellow-400 via-orange-500 to-rose-500",
  },
  {
    title: "Micro LSTM Features",
    subtitle: "15 features, frontend origin, normalization, and targets",
    accent: "from-green-500 via-emerald-500 to-yellow-400",
  },
  {
    title: "Macro LSTM Features",
    subtitle: "15 long-range features, formulas, and target calculations",
    accent: "from-orange-500 via-amber-500 to-lime-500",
  },
  {
    title: "Backend Calculation Logic",
    subtitle: "Exact formulas in Flask used to compute retention signals",
    accent: "from-red-500 via-orange-500 to-yellow-500",
  },
  {
    title: "Student Data Samples",
    subtitle: "10 rows preview from micro and macro retention datasets",
    accent: "from-lime-500 via-emerald-500 to-green-500",
  },
  {
    title: "Micro LSTM Report",
    subtitle: "Detailed metrics, goals, and architecture",
    accent: "from-orange-500 via-red-500 to-amber-400",
  },
  {
    title: "Macro LSTM Report",
    subtitle: "Detailed metrics, goals, and architecture",
    accent: "from-green-500 via-yellow-400 to-orange-500",
  },
  {
    title: "Model-to-Product Mapping",
    subtitle: "How predictions become repeat plans and study schedules",
    accent: "from-yellow-400 via-orange-500 to-red-500",
  },
  {
    title: "Deployment Checklist",
    subtitle: "Reliability, tracking, and production safety controls",
    accent: "from-emerald-500 via-green-500 to-lime-400",
  },
  {
    title: "Why Two LSTM Models",
    subtitle:
      "Why Micro + Macro separation and sequence modeling are essential",
    accent: "from-yellow-400 via-orange-500 to-red-500",
  },
  {
    title: "Next Steps",
    subtitle: "Roadmap for stronger retention intelligence",
    accent: "from-red-500 via-orange-500 to-yellow-400",
  },
];

const modelGoalCards = [
  {
    model: "Micro LSTM",
    goal: "Predict question-level retention and immediate revision timing.",
    outputs:
      "current_retention, next_retention, stress_impact, fatigue_prediction",
    sequence: "20 timesteps x 15 features",
  },
  {
    model: "Macro LSTM",
    goal: "Predict long-term retention health and burnout risk for planning.",
    outputs: "predicted_long_term_retention_score, fatigue_risk_probability",
    sequence: "14 timesteps x 15 features",
  },
];

const microFeatureRows = [
  {
    name: "answer_correctness",
    source: "Frontend answer result",
    normalization: "0 or 1",
    formula: "float(answer_correctness)",
    target_link: "current_retention",
  },
  {
    name: "normalized_response_time",
    source: "time_spent + topic mean",
    normalization: "response_time / max(avg_topic_rt, 1)",
    formula: "float(normalized_response_time)",
    target_link: "current_retention, fatigue",
  },
  {
    name: "rolling_accuracy_topic",
    source: "last 10 topic attempts",
    normalization: "mean in [0,1]",
    formula: "float(rolling_accuracy_topic)",
    target_link: "current_retention",
  },
  {
    name: "correct_streak",
    source: "topic attempt history",
    normalization: "raw streak",
    formula: "float(correct_streak)",
    target_link: "next_retention",
  },
  {
    name: "time_since_last_attempt_topic",
    source: "timestamp delta",
    normalization: "/ 86400",
    formula: "float(time_since_last_attempt_topic)/86400",
    target_link: "next_retention",
  },
  {
    name: "answer_change_count",
    source: "answer_changes/hesitation",
    normalization: "/ 5",
    formula: "float(answer_change_count)/5",
    target_link: "stress_impact",
  },
  {
    name: "confidence_rating",
    source: "confidence input",
    normalization: "1-5 then /5",
    formula: "float(confidence_rating)/5",
    target_link: "current_retention",
  },
  {
    name: "concept_mastery_score",
    source: "decay-weighted topic history",
    normalization: "clip [0,1]",
    formula: "float(concept_mastery_score)",
    target_link: "current_retention",
  },
  {
    name: "question_difficulty",
    source: "question payload",
    normalization: "1-5 then /5",
    formula: "float(question_difficulty)/5",
    target_link: "next_retention",
  },
  {
    name: "fatigue_indicator",
    source: "session_elapsed / expected_focus_duration",
    normalization: "continuous",
    formula: "float(fatigue_indicator)",
    target_link: "stress_impact",
  },
  {
    name: "focus_loss_frequency",
    source: "response time spikes",
    normalization: "/ 10",
    formula: "float(focus_loss_frequency)/10",
    target_link: "fatigue_prediction",
  },
  {
    name: "rolling_time_variance",
    source: "recent response variance",
    normalization: "/ 5",
    formula: "float(rolling_time_variance)/5",
    target_link: "stress_impact",
  },
  {
    name: "hint_usage_flag",
    source: "hint usage boolean",
    normalization: "0 or 1",
    formula: "float(hint_usage_flag)",
    target_link: "retention probability",
  },
  {
    name: "preferred_difficulty_offset",
    source: "actual - predicted_optimal_difficulty",
    normalization: "/ 5",
    formula: "float(preferred_difficulty_offset)/5",
    target_link: "next_retention",
  },
  {
    name: "attempt_count_topic",
    source: "topic attempt count",
    normalization: "/ 20",
    formula: "float(attempt_count_topic)/20",
    target_link: "all micro outputs",
  },
];

const macroFeatureRows = [
  {
    name: "overall_accuracy_rate",
    source: "session correctness mean",
    normalization: "[0,1]",
    formula: "float(overall_accuracy_rate)",
    target_link: "predicted_long_term_retention_score",
  },
  {
    name: "cross_subject_mastery_vector",
    source: "cross-subject mastery",
    normalization: "[0,1]",
    formula: "float(cross_subject_mastery_vector)",
    target_link: "predicted_long_term_retention_score",
  },
  {
    name: "daily_study_duration",
    source: "total study minutes",
    normalization: "/ 120",
    formula: "float(daily_study_duration)/120",
    target_link: "fatigue_risk_probability",
  },
  {
    name: "study_consistency_index",
    source: "session regularity",
    normalization: "[0,1]",
    formula: "float(study_consistency_index)",
    target_link: "predicted_long_term_retention_score",
  },
  {
    name: "fatigue_pattern",
    source: "session fatigue trend",
    normalization: "[0,1]",
    formula: "float(fatigue_pattern)",
    target_link: "fatigue_risk_probability",
  },
  {
    name: "forgetting_curve_slope",
    source: "computed from performance",
    normalization: "continuous",
    formula: "float(forgetting_curve_slope)",
    target_link: "retention",
  },
  {
    name: "performance_variability",
    source: "variance(correctness)",
    normalization: "continuous",
    formula: "float(performance_variability)",
    target_link: "retention_stability_score",
  },
  {
    name: "session_start_time_pattern",
    source: "hour-of-day pattern",
    normalization: "/ 24",
    formula: "float(session_start_time_pattern)/24",
    target_link: "fatigue risk",
  },
  {
    name: "topic_completion_rate",
    source: "unique_topics/completion base",
    normalization: "[0,1]",
    formula: "float(topic_completion_rate)",
    target_link: "retention",
  },
  {
    name: "learning_efficiency_score",
    source: "accuracy per minute",
    normalization: "continuous",
    formula: "float(learning_efficiency_score)",
    target_link: "retention",
  },
  {
    name: "break_frequency",
    source: "long-response ratio",
    normalization: "[0,1]",
    formula: "float(break_frequency)",
    target_link: "fatigue risk",
  },
  {
    name: "cognitive_load_index",
    source: "mean difficulty/5",
    normalization: "[0,1]",
    formula: "float(cognitive_load_index)",
    target_link: "fatigue risk",
  },
  {
    name: "motivation_index",
    source: "engagement proxy",
    normalization: "[0,1]",
    formula: "float(motivation_index)",
    target_link: "retention",
  },
  {
    name: "stress_indicator",
    source: "incorrect_streak * response_spike",
    normalization: "[0,1]",
    formula: "float(stress_indicator)",
    target_link: "fatigue risk",
  },
  {
    name: "retention_stability_score",
    source: "1 - performance_variability",
    normalization: "[0,1]",
    formula: "float(retention_stability_score)",
    target_link: "predicted_long_term_retention_score",
  },
];

const backendFlowRows = [
  {
    stage: "Frontend (React)",
    payload:
      "studentId, sessionId, subject, topicId, correct, timeSpent, answerChanges, confidence, difficulty, hintUsed, timestamp",
    destination: "Node API",
    purpose: "Capture live answer behavior",
  },
  {
    stage: "Node.js Backend",
    payload:
      "normalized request + auth + session context + topic mapping + counters",
    destination: "Flask retention service",
    purpose: "Orchestrate business flow and secure bridge",
  },
  {
    stage: "Flask Backend",
    payload: "micro_features(15), macro_features(15), derived targets",
    destination: "LSTM models + CSV persistence",
    purpose: "Feature engineering + inference + retraining",
  },
  {
    stage: "Storage",
    payload:
      "micro_sequences.csv, macro_sequences.csv, model files, training_stats",
    destination: "Retention_Student_data/STU000005",
    purpose: "State persistence and audit",
  },
  {
    stage: "Response Back",
    payload:
      "current_retention, next_retention, repeat_timer, chapter plan, projected_retention, burnout risk",
    destination: "Node -> Frontend",
    purpose: "Drive UI and scheduling decisions",
  },
];

const formulaRows = [
  {
    signal: "micro.retention_probability_topic",
    formula:
      "clip(0.45*rolling_accuracy_topic + 0.25*concept_mastery_score + 0.15*(confidence_rating/5) + 0.15*(1/normalized_response_time))",
  },
  {
    signal: "micro.probability_correct_next_attempt",
    formula:
      "clip(sigmoid(2.2*rolling_accuracy + 1.2*mastery + 0.6*confidence - 0.8*fatigue - 0.4*norm_response_time - 0.7))",
  },
  {
    signal: "macro.predicted_long_term_retention_score",
    formula:
      "clip(0.4*overall_accuracy_rate + 0.2*retention_stability_score + 0.2*topic_completion_rate + 0.2*study_consistency_index)",
  },
  {
    signal: "macro.fatigue_risk_probability",
    formula:
      "clip(0.5*fatigue_pattern + 0.3*stress_indicator + 0.2*break_frequency)",
  },
];

const microReportRows = [
  {
    Output: "current_retention",
    MAE: "0.037404",
    MSE: "0.002279",
    RMSE: "0.047742",
    R2: "0.666225",
  },
  {
    Output: "next_retention",
    MAE: "0.037851",
    MSE: "0.002408",
    RMSE: "0.049076",
    R2: "0.676631",
  },
  {
    Output: "stress_impact",
    MAE: "0.013284",
    MSE: "0.000390",
    RMSE: "0.019761",
    R2: "nan",
  },
  {
    Output: "fatigue_prediction",
    MAE: "0.025714",
    MSE: "0.007053",
    RMSE: "0.083982",
    R2: "0.284294",
  },
  {
    Output: "OVERALL",
    MAE: "0.028563",
    MSE: "0.003033",
    RMSE: "0.055071",
    R2: "0.865802",
  },
];

const macroReportRows = [
  {
    Output: "predicted_long_term_retention_score",
    MAE: "0.091694",
    MSE: "0.015718",
    RMSE: "0.125372",
    R2: "0.147429",
  },
  {
    Output: "fatigue_risk_probability",
    MAE: "0.062635",
    MSE: "0.005946",
    RMSE: "0.077111",
    R2: "0.353628",
  },
  {
    Output: "OVERALL",
    MAE: "0.077164",
    MSE: "0.010832",
    RMSE: "0.104077",
    R2: "0.809675",
  },
];

const metricMeaningRows = [
  {
    Metric: "MAE",
    Meaning: "Mean Absolute Error",
    Relevance:
      "Average absolute prediction mistake; easiest metric to interpret in real units.",
    GoodRule:
      "Lower is better. < 0.05 excellent, 0.05-0.10 good, > 0.10 average/weak",
  },
  {
    Metric: "MSE",
    Meaning: "Mean Squared Error",
    Relevance:
      "Squares mistakes, so larger errors are penalized more heavily than MAE.",
    GoodRule: "Lower is better. Near 0 indicates tight prediction spread",
  },
  {
    Metric: "RMSE",
    Meaning: "Root Mean Squared Error",
    Relevance: "Square root of MSE; error magnitude in original target scale.",
    GoodRule: "Lower is better. < 0.08 strong, 0.08-0.12 good, > 0.12 average",
  },
  {
    Metric: "R2",
    Meaning: "Coefficient of Determination",
    Relevance:
      "Explains how much variance in target is captured by model predictions.",
    GoodRule:
      "Higher is better. >= 0.80 excellent, 0.60-0.79 good, 0.40-0.59 average, < 0.40 weak",
  },
];

const microRatingRows = [
  {
    Model: "Micro LSTM (Overall)",
    MAE: "0.028563",
    RMSE: "0.055071",
    R2: "0.865802",
    Rating: "Excellent",
    Why: "Very low error with high explained variance.",
  },
  {
    Model: "Micro current_retention",
    MAE: "0.037404",
    RMSE: "0.047742",
    R2: "0.666225",
    Rating: "Good",
    Why: "Low error and stable predictive quality.",
  },
  {
    Model: "Micro next_retention",
    MAE: "0.037851",
    RMSE: "0.049076",
    R2: "0.676631",
    Rating: "Good",
    Why: "Reliable next-step retention prediction.",
  },
  {
    Model: "Micro fatigue_prediction",
    MAE: "0.025714",
    RMSE: "0.083982",
    R2: "0.284294",
    Rating: "Average",
    Why: "Low absolute error but weak variance capture for this output.",
  },
];

const macroRatingRows = [
  {
    Model: "Macro LSTM (Overall)",
    MAE: "0.077164",
    RMSE: "0.104077",
    R2: "0.809675",
    Rating: "Excellent",
    Why: "Strong overall variance explanation with acceptable error.",
  },
  {
    Model: "Macro long_term_retention",
    MAE: "0.091694",
    RMSE: "0.125372",
    R2: "0.147429",
    Rating: "Average",
    Why: "Error is moderate but variance capture remains weak.",
  },
  {
    Model: "Macro fatigue_risk",
    MAE: "0.062635",
    RMSE: "0.077111",
    R2: "0.353628",
    Rating: "Average",
    Why: "Reasonable error; needs improvement in explanatory power.",
  },
];

const microArchitectureRows = [
  { Field: "Model Name", Value: "micro_lstm" },
  { Field: "Input Shape", Value: "(None, 20, 15)" },
  { Field: "Output Shape", Value: "[(None,1), (None,1), (None,1), (None,1)]" },
  { Field: "Total Parameters", Value: "34,084" },
  { Field: "Sequence Encoder", Value: "LSTM(64) -> LSTM(32)" },
  { Field: "Dense Block", Value: "Dense(32, relu)" },
  {
    Field: "Output Heads",
    Value:
      "current_retention, next_retention, stress_impact, fatigue_prediction",
  },
];

const macroArchitectureRows = [
  { Field: "Model Name", Value: "macro_lstm" },
  { Field: "Input Shape", Value: "(None, 14, 15)" },
  { Field: "Output Shape", Value: "[(None,1), (None,1)]" },
  { Field: "Total Parameters", Value: "19,946" },
  { Field: "Sequence Encoder", Value: "LSTM(48) -> LSTM(24)" },
  { Field: "Dense Block", Value: "Dense(24, relu)" },
  {
    Field: "Output Heads",
    Value: "predicted_long_term_retention_score, fatigue_risk_probability",
  },
];

const microSampleRows = [
  {
    timestamp: "2026-03-07T11:58:55.755933",
    subject: "gk",
    topic_id: "current_affairs",
    answer_correctness: "1.0",
    normalized_response_time: "0.08",
    rolling_accuracy_topic: "0.5",
    retention_probability_topic: "0.62",
  },
  {
    timestamp: "2026-03-07T11:58:55.755933",
    subject: "gk",
    topic_id: "history",
    answer_correctness: "0.0",
    normalized_response_time: "0.17",
    rolling_accuracy_topic: "0.6",
    retention_probability_topic: "0.63",
  },
  {
    timestamp: "2026-03-07T11:58:55.755933",
    subject: "gk",
    topic_id: "geography",
    answer_correctness: "0.0",
    normalized_response_time: "0.53",
    rolling_accuracy_topic: "0.0",
    retention_probability_topic: "0.24",
  },
  {
    timestamp: "2026-03-07T12:48:02.312741",
    subject: "english",
    topic_id: "idioms",
    answer_correctness: "1.0",
    normalized_response_time: "1.34",
    rolling_accuracy_topic: "0.8",
    retention_probability_topic: "0.77",
  },
  {
    timestamp: "2026-03-07T12:48:02.312741",
    subject: "english",
    topic_id: "one_word_substitution",
    answer_correctness: "1.0",
    normalized_response_time: "0.52",
    rolling_accuracy_topic: "1.0",
    retention_probability_topic: "0.94",
  },
  {
    timestamp: "2026-03-07T12:48:02.312741",
    subject: "english",
    topic_id: "one_word_substitution",
    answer_correctness: "1.0",
    normalized_response_time: "0.14",
    rolling_accuracy_topic: "1.0",
    retention_probability_topic: "0.95",
  },
  {
    timestamp: "2026-03-07T12:48:02.312741",
    subject: "english",
    topic_id: "antonyms",
    answer_correctness: "0.0",
    normalized_response_time: "0.26",
    rolling_accuracy_topic: "0.8",
    retention_probability_topic: "0.81",
  },
  {
    timestamp: "2026-03-07T12:48:02.312741",
    subject: "english",
    topic_id: "antonyms",
    answer_correctness: "1.0",
    normalized_response_time: "0.41",
    rolling_accuracy_topic: "0.9",
    retention_probability_topic: "0.89",
  },
  {
    timestamp: "2026-03-07T12:48:02.312741",
    subject: "english",
    topic_id: "vocabulary",
    answer_correctness: "1.0",
    normalized_response_time: "0.2",
    rolling_accuracy_topic: "0.8",
    retention_probability_topic: "0.84",
  },
  {
    timestamp: "2026-03-07T12:48:02.312741",
    subject: "english",
    topic_id: "antonyms",
    answer_correctness: "1.0",
    normalized_response_time: "0.48",
    rolling_accuracy_topic: "0.9",
    retention_probability_topic: "0.92",
  },
];

const macroSampleRows = [
  {
    timestamp: "2026-03-06T18:35:18.999923",
    subject: "gk",
    overall_accuracy_rate: "1.00",
    study_consistency_index: "0.05",
    fatigue_pattern: "0.31",
    predicted_long_term_retention_score: "0.66",
    fatigue_risk_probability: "0.16",
  },
  {
    timestamp: "2026-03-06T18:35:31.746743",
    subject: "gk",
    overall_accuracy_rate: "1.00",
    study_consistency_index: "0.05",
    fatigue_pattern: "0.38",
    predicted_long_term_retention_score: "0.66",
    fatigue_risk_probability: "0.19",
  },
  {
    timestamp: "2026-03-06T18:35:34.207399",
    subject: "gk",
    overall_accuracy_rate: "1.00",
    study_consistency_index: "0.10",
    fatigue_pattern: "0.34",
    predicted_long_term_retention_score: "0.72",
    fatigue_risk_probability: "0.17",
  },
  {
    timestamp: "2026-03-06T18:35:51.858182",
    subject: "gk",
    overall_accuracy_rate: "0.00",
    study_consistency_index: "0.05",
    fatigue_pattern: "0.38",
    predicted_long_term_retention_score: "0.26",
    fatigue_risk_probability: "0.19",
  },
  {
    timestamp: "2026-03-06T18:35:53.774535",
    subject: "gk",
    overall_accuracy_rate: "0.67",
    study_consistency_index: "0.15",
    fatigue_pattern: "0.36",
    predicted_long_term_retention_score: "0.55",
    fatigue_risk_probability: "0.18",
  },
  {
    timestamp: "2026-03-06T18:35:58.245446",
    subject: "gk",
    overall_accuracy_rate: "0.00",
    study_consistency_index: "0.05",
    fatigue_pattern: "0.34",
    predicted_long_term_retention_score: "0.26",
    fatigue_risk_probability: "0.17",
  },
  {
    timestamp: "2026-03-06T18:43:17.151476",
    subject: "english",
    overall_accuracy_rate: "0.00",
    study_consistency_index: "0.05",
    fatigue_pattern: "0.31",
    predicted_long_term_retention_score: "0.24",
    fatigue_risk_probability: "0.16",
  },
  {
    timestamp: "2026-03-06T18:43:23.359357",
    subject: "english",
    overall_accuracy_rate: "0.00",
    study_consistency_index: "0.05",
    fatigue_pattern: "0.31",
    predicted_long_term_retention_score: "0.24",
    fatigue_risk_probability: "0.16",
  },
  {
    timestamp: "2026-03-06T18:43:44.254992",
    subject: "english",
    overall_accuracy_rate: "0.00",
    study_consistency_index: "0.05",
    fatigue_pattern: "0.30",
    predicted_long_term_retention_score: "0.24",
    fatigue_risk_probability: "0.15",
  },
  {
    timestamp: "2026-03-06T20:00:31.110962",
    subject: "gk",
    overall_accuracy_rate: "1.00",
    study_consistency_index: "0.05",
    fatigue_pattern: "0.31",
    predicted_long_term_retention_score: "0.66",
    fatigue_risk_probability: "0.16",
  },
];

const DetailCards = ({ rows, dark }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {rows.map((row, idx) => {
        const keys = Object.keys(row);
        const title = String(row[keys[0]]);
        return (
          <div
            key={idx}
            className={
              dark
                ? "rounded-xl border border-white/20 bg-white/10 p-4 card-lift"
                : "rounded-xl border border-amber-200 bg-white p-4 card-lift"
            }
          >
            <h4
              className={
                dark
                  ? "text-white font-semibold mb-3"
                  : "text-slate-900 font-semibold mb-3"
              }
            >
              {title}
            </h4>
            <div className="space-y-2 text-sm">
              {keys.slice(1).map((key) => (
                <div key={key} className="grid grid-cols-[140px_1fr] gap-2">
                  <span className={dark ? "text-white/70" : "text-slate-500"}>
                    {key}
                  </span>
                  <span
                    className={
                      key.toLowerCase().includes("formula")
                        ? dark
                          ? "text-cyan-200 font-mono"
                          : "text-teal-700 font-mono"
                        : dark
                          ? "text-white/90"
                          : "text-slate-700"
                    }
                  >
                    {String(row[key])}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const DesignRetention = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const deckRef = useRef(null);

  const current = useMemo(() => slides[currentSlide], [currentSlide]);

  const theme = isDark
    ? {
        pageBg: "bg-slate-950",
        shell:
          "rounded-3xl border border-amber-300/25 bg-slate-900/75 backdrop-blur-xl shadow-2xl",
        chip: "border border-amber-300/35 bg-amber-400/15 text-amber-100 hover:bg-amber-300/25",
        titleGradient: "from-yellow-200 via-orange-200 to-red-200",
      }
    : {
        pageBg: "bg-gradient-to-br from-amber-50 via-orange-50 to-lime-50",
        shell:
          "rounded-3xl border border-orange-200/80 bg-white/90 backdrop-blur shadow-xl",
        chip: "border border-orange-300 bg-white text-slate-800 hover:bg-orange-50",
        titleGradient: "from-red-600 via-orange-600 to-emerald-600",
      };

  const card = isDark
    ? "rounded-2xl border border-amber-200/25 bg-white/10 p-6 backdrop-blur-md shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 card-lift"
    : "rounded-2xl border border-orange-200 bg-white/85 p-6 backdrop-blur-md shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 card-lift";

  const titleColor = isDark ? "text-white" : "text-slate-900";
  const textColor = isDark ? "text-white/90" : "text-slate-700";
  const subTextColor = isDark ? "text-white/70" : "text-slate-500";

  const nextSlide = () =>
    setCurrentSlide((prev) => Math.min(prev + 1, TOTAL_SLIDES - 1));
  const prevSlide = () => setCurrentSlide((prev) => Math.max(prev - 1, 0));
  const goToSlide = (index) =>
    setCurrentSlide(Math.max(0, Math.min(index, TOTAL_SLIDES - 1)));

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await deckRef.current?.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch (error) {
      console.error("Fullscreen toggle failed", error);
    }
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "ArrowRight" || event.key === "PageDown") nextSlide();
      if (event.key === "ArrowLeft" || event.key === "PageUp") prevSlide();
      if (event.key === "Home") goToSlide(0);
      if (event.key === "End") goToSlide(TOTAL_SLIDES - 1);
      if (event.key.toLowerCase() === "f") toggleFullscreen();
      if (event.key.toLowerCase() === "t") setIsDark((prev) => !prev);
    };

    const onFullscreenChange = () =>
      setIsFullscreen(Boolean(document.fullscreenElement));

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  const renderSlide = () => {
    if (currentSlide === 0) {
      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full items-center">
          <div className={card}>
            <h3 className={`text-3xl font-bold mb-4 ${titleColor}`}>
              Our Goal
            </h3>
            <p className={`${textColor} text-lg leading-relaxed`}>
              Build a retention intelligence system that predicts when a student
              will forget, schedules revision at the right time, and explains
              each decision through transparent feature logic.
            </p>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                className={
                  isDark
                    ? "rounded-xl bg-black/25 p-4"
                    : "rounded-xl bg-teal-50 p-4"
                }
              >
                <p className={`${subTextColor} text-sm`}>Models Used</p>
                <p className={`text-2xl font-semibold ${titleColor}`}>
                  Micro LSTM + Macro LSTM
                </p>
              </div>
              <div
                className={
                  isDark
                    ? "rounded-xl bg-black/25 p-4"
                    : "rounded-xl bg-cyan-50 p-4"
                }
              >
                <p className={`${subTextColor} text-sm`}>Evaluation Focus</p>
                <p className={`text-2xl font-semibold ${titleColor}`}>
                  Retention + Fatigue
                </p>
              </div>
            </div>
          </div>

          <div className={card}>
            <h3 className={`text-3xl font-bold mb-4 ${titleColor}`}>
              This Presentation Covers
            </h3>
            <ul
              className={`space-y-3 pl-6 text-lg list-disc ${
                isDark
                  ? "marker:text-emerald-300/80"
                  : "marker:text-teal-600/70"
              } ${textColor}`}
            >
              <li>Retention architecture and node-flask data handshake.</li>
              <li>Detailed Micro and Macro feature calculations.</li>
              <li>How targets are calculated in backend Flask services.</li>
              <li>Detailed metrics for Micro LSTM and Macro LSTM.</li>
              <li>How model outputs are translated into study plans.</li>
            </ul>
          </div>
        </div>
      );
    }

    if (currentSlide === 1) {
      return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-full items-center">
          <div className={`${card} xl:col-span-2`}>
            <h3 className={`text-3xl font-bold mb-4 ${titleColor}`}>
              Why Retention Learning Matters
            </h3>
            <ul
              className={`space-y-3 pl-6 text-lg list-disc ${
                isDark
                  ? "marker:text-emerald-300/80"
                  : "marker:text-teal-600/70"
              } ${textColor}`}
            >
              <li>Correct answers alone do not guarantee long-term memory.</li>
              <li>
                Timing, fatigue, confidence, and revision spacing strongly
                affect forgetting.
              </li>
              <li>
                Retention-aware scheduling reduces wasted revision and burnout.
              </li>
              <li>
                Explainable features let mentors trust and tune interventions.
              </li>
            </ul>
            <div
              className={
                isDark
                  ? "mt-6 rounded-xl bg-black/25 p-5"
                  : "mt-6 rounded-xl bg-emerald-50 p-5"
              }
            >
              <p className={`text-xl font-semibold ${titleColor}`}>
                Strategic objective: predict forgetting early and prescribe
                precise review windows using Micro + Macro LSTM signals.
              </p>
            </div>
          </div>

          <div className={card}>
            <h4 className={`text-2xl font-bold mb-4 ${titleColor}`}>
              Success Outcomes
            </h4>
            <div className="space-y-4">
              {[
                "Better Recall",
                "Lower Burnout",
                "Smarter Revision",
                "Transparent AI",
              ].map((item) => (
                <div
                  key={item}
                  className={
                    isDark
                      ? "rounded-lg border border-white/20 bg-white/10 p-4"
                      : "rounded-lg border border-slate-200 bg-slate-50 p-4"
                  }
                >
                  <p className={`text-lg font-semibold ${titleColor}`}>
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className={`${card} xl:col-span-3`}>
            <h4 className={`text-2xl font-bold mb-4 ${titleColor}`}>
              Model Goals
            </h4>
            <DetailCards dark={isDark} rows={modelGoalCards} />
          </div>
        </div>
      );
    }

    if (currentSlide === 2) {
      return (
        <div className="space-y-6 h-full flex flex-col justify-center">
          <div className={card}>
            <h3 className={`text-3xl font-bold mb-4 ${titleColor}`}>
              Retention System Architecture
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
              {[
                "React Frontend: answer events, timer, confidence, topic context",
                "Node APIs: auth, validation, orchestration, persistence bridge",
                "Flask Retention Service: feature generation + LSTM inference",
                "Student Data Layer: sequence CSVs, training_stats, model artifacts",
                "Schedule Engine: repeat timers, chapter plans, burnout safeguards",
              ].map((item, idx) => (
                <div
                  key={idx}
                  className={
                    isDark
                      ? "rounded-xl border border-white/20 bg-white/10 p-4 text-white/90 text-base"
                      : "rounded-xl border border-slate-200 bg-white p-4 text-slate-700 text-base"
                  }
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (currentSlide === 3) {
      return (
        <div className="space-y-6 h-full flex flex-col">
          <div className={card}>
            <h3 className={`text-3xl font-bold mb-3 ${titleColor}`}>
              Data Transfer: Frontend to Node to Flask
            </h3>
            <DetailCards dark={isDark} rows={backendFlowRows} />
          </div>

          <div className={card}>
            <h4 className={`text-2xl font-bold mb-3 ${titleColor}`}>
              Example Payload at Node-Flask Bridge
            </h4>
            <pre
              className={
                isDark
                  ? "rounded-xl bg-black/30 border border-white/20 p-4 text-sm text-cyan-100 whitespace-pre-wrap"
                  : "rounded-xl bg-slate-100 border border-slate-200 p-4 text-sm text-slate-700 whitespace-pre-wrap"
              }
            >
              {`{
	"studentId": "STU000005",
	"sessionId": "<uuid>",
	"subject": "gk",
	"responses": [
		{
			"topic_id": "history",
			"correct": false,
			"time_spent": 13864,
			"answer_changes": 1,
			"confidence_rating": 3.5,
			"question_difficulty": 2.75,
			"hint_used": false,
			"timestamp": "2026-03-06T20:00:47.219971"
		}
	]
}`}
            </pre>
          </div>
        </div>
      );
    }

    if (currentSlide === 4) {
      return (
        <div className="space-y-6 h-full flex flex-col">
          <div className={card}>
            <h3 className={`text-3xl font-bold mb-3 ${titleColor}`}>
              Micro LSTM Feature Engineering (15 Features)
            </h3>
            <p className={`text-base mb-4 ${subTextColor}`}>
              Sequence length: 20. Outputs: current_retention, next_retention,
              stress_impact, fatigue_prediction.
            </p>
            <DetailCards dark={isDark} rows={microFeatureRows} />
          </div>
        </div>
      );
    }

    if (currentSlide === 5) {
      return (
        <div className="space-y-6 h-full flex flex-col">
          <div className={card}>
            <h3 className={`text-3xl font-bold mb-3 ${titleColor}`}>
              Macro LSTM Feature Engineering (15 Features)
            </h3>
            <p className={`text-base mb-4 ${subTextColor}`}>
              Sequence length: 14. Outputs: predicted_long_term_retention_score
              and fatigue_risk_probability.
            </p>
            <DetailCards dark={isDark} rows={macroFeatureRows} />
          </div>
        </div>
      );
    }

    if (currentSlide === 6) {
      return (
        <div className="space-y-6 h-full flex flex-col">
          <div className={card}>
            <h3 className={`text-3xl font-bold mb-3 ${titleColor}`}>
              Flask Calculation Logic
            </h3>
            <DetailCards dark={isDark} rows={formulaRows} />
          </div>
        </div>
      );
    }

    if (currentSlide === 7) {
      return (
        <div className="space-y-6 h-full flex flex-col">
          <div className={card}>
            <h3 className={`text-3xl font-bold mb-3 ${titleColor}`}>
              Micro Sequences (10 Rows)
            </h3>
            <DetailCards dark={isDark} rows={microSampleRows} />
          </div>

          <div className={card}>
            <h3 className={`text-3xl font-bold mb-3 ${titleColor}`}>
              Macro Sequences (10 Rows)
            </h3>
            <DetailCards dark={isDark} rows={macroSampleRows} />
          </div>
        </div>
      );
    }

    if (currentSlide === 8) {
      return (
        <div className="space-y-6 h-full flex flex-col overflow-y-auto">
          <div className={card}>
            <h3 className={`text-3xl font-bold mb-4 ${titleColor}`}>
              Micro LSTM Model Report
            </h3>
            <DetailCards dark={isDark} rows={microReportRows} />
          </div>
          <div className={card}>
            <h4 className={`text-2xl font-bold mb-4 ${titleColor}`}>
              Metrics Meaning and Relevance
            </h4>
            <DetailCards dark={isDark} rows={metricMeaningRows} />
          </div>
          <div className={card}>
            <h4 className={`text-2xl font-bold mb-4 ${titleColor}`}>
              Result Rating (Excellent/Good/Average)
            </h4>
            <DetailCards dark={isDark} rows={microRatingRows} />
          </div>
          <div className={card}>
            <h4 className={`text-2xl font-bold mb-4 ${titleColor}`}>
              Micro Architecture Snapshot
            </h4>
            <DetailCards dark={isDark} rows={microArchitectureRows} />
          </div>
        </div>
      );
    }

    if (currentSlide === 9) {
      return (
        <div className="space-y-6 h-full flex flex-col overflow-y-auto">
          <div className={card}>
            <h3 className={`text-3xl font-bold mb-4 ${titleColor}`}>
              Macro LSTM Model Report
            </h3>
            <DetailCards dark={isDark} rows={macroReportRows} />
          </div>
          <div className={card}>
            <h4 className={`text-2xl font-bold mb-4 ${titleColor}`}>
              Result Rating (Excellent/Good/Average)
            </h4>
            <DetailCards dark={isDark} rows={macroRatingRows} />
          </div>
          <div className={card}>
            <h4 className={`text-2xl font-bold mb-4 ${titleColor}`}>
              Macro Architecture Snapshot
            </h4>
            <DetailCards dark={isDark} rows={macroArchitectureRows} />
          </div>
        </div>
      );
    }

    if (currentSlide === 10) {
      return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 h-full items-center">
          <div className={card}>
            <h3 className={`text-3xl font-bold mb-4 ${titleColor}`}>
              How Micro Output Is Used
            </h3>
            <ul
              className={`space-y-3 pl-6 text-lg list-disc ${
                isDark
                  ? "marker:text-emerald-300/80"
                  : "marker:text-teal-600/70"
              } ${textColor}`}
            >
              <li>Low current_retention triggers immediate review timers.</li>
              <li>next_retention guides short-term spacing decisions.</li>
              <li>stress_impact and fatigue_prediction reduce overload.</li>
              <li>Node pushes timer plan to frontend schedule widgets.</li>
            </ul>
          </div>

          <div className={card}>
            <h3 className={`text-3xl font-bold mb-4 ${titleColor}`}>
              How Macro Output Is Used
            </h3>
            <ul
              className={`space-y-3 pl-6 text-lg list-disc ${
                isDark
                  ? "marker:text-emerald-300/80"
                  : "marker:text-teal-600/70"
              } ${textColor}`}
            >
              <li>
                predicted_long_term_retention_score adjusts weekly revision
                structure.
              </li>
              <li>
                fatigue_risk_probability tunes break_minutes and daily load.
              </li>
              <li>
                Subject priority is derived and sent to planner endpoints.
              </li>
              <li>
                Frontend displays projected trajectory and burnout warnings.
              </li>
            </ul>
          </div>
        </div>
      );
    }

    if (currentSlide === 11) {
      return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 h-full items-center">
          <div className={card}>
            <h3 className={`text-3xl font-bold mb-4 ${titleColor}`}>
              Production Checklist
            </h3>
            <ul
              className={`space-y-3 pl-6 text-lg list-disc ${
                isDark
                  ? "marker:text-emerald-300/80"
                  : "marker:text-teal-600/70"
              } ${textColor}`}
            >
              <li>Validate sequence CSV schema before model inference.</li>
              <li>Track model metrics drift per student/cohort weekly.</li>
              <li>Monitor Node-Flask bridge latency and failures.</li>
              <li>
                Version models and persist training_stats with timestamps.
              </li>
              <li>Expose explainability payload to mentor dashboard.</li>
            </ul>
          </div>

          <div className={card}>
            <h3 className={`text-3xl font-bold mb-4 ${titleColor}`}>
              Reliability Controls
            </h3>
            <ul
              className={`space-y-3 pl-6 text-lg list-disc ${
                isDark
                  ? "marker:text-emerald-300/80"
                  : "marker:text-teal-600/70"
              } ${textColor}`}
            >
              <li>Fallback schedule if Flask model call fails.</li>
              <li>Input sanitization for confidence and timing fields.</li>
              <li>Idempotent session processing to avoid duplicate rows.</li>
              <li>Alerting for RMSE spikes and R2 degradation over time.</li>
            </ul>
          </div>
        </div>
      );
    }

    if (currentSlide === 12) {
      return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 h-full items-center">
          <div className={card}>
            <h3 className={`text-3xl font-bold mb-4 ${titleColor}`}>
              Why Two Separate LSTM Models
            </h3>
            <ul
              className={`space-y-3 pl-6 text-lg list-disc ${
                isDark
                  ? "marker:text-emerald-300/80"
                  : "marker:text-teal-600/70"
              } ${textColor}`}
            >
              <li>
                Micro LSTM solves short-horizon decisions: per-question
                retention, immediate next retention, stress and fatigue effects.
              </li>
              <li>
                Macro LSTM solves long-horizon planning: long-term retention
                trajectory and burnout risk across sessions.
              </li>
              <li>
                A single model mixes incompatible timescales and reduces
                precision for both instant and strategic decisions.
              </li>
              <li>
                Split models make outputs clearer for product actions: timer
                scheduling from micro, weekly planning from macro.
              </li>
            </ul>
          </div>

          <div className={card}>
            <h3 className={`text-3xl font-bold mb-4 ${titleColor}`}>
              Why LSTM Sequence/Time-Series Modeling Helps
            </h3>
            <ul
              className={`space-y-3 pl-6 text-lg list-disc ${
                isDark
                  ? "marker:text-emerald-300/80"
                  : "marker:text-teal-600/70"
              } ${textColor}`}
            >
              <li>
                Retention is path-dependent; the order of attempts matters, not
                just final averages.
              </li>
              <li>
                LSTM captures temporal patterns like streaks, decay, recovery,
                fatigue accumulation, and spacing effects.
              </li>
              <li>
                Time gaps (revision interval, time since last attempt) are
                learned as part of the sequence context.
              </li>
              <li>
                This improves real-world recommendations: when to repeat, how
                much to review, and when to reduce load.
              </li>
            </ul>
          </div>

          <div className={`${card} xl:col-span-2`}>
            <h3 className={`text-3xl font-bold mb-4 ${titleColor}`}>
              Practical Relevance To Our Problem
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div
                className={
                  isDark
                    ? "rounded-xl bg-black/25 p-4"
                    : "rounded-xl bg-emerald-50 p-4"
                }
              >
                <p className={`text-sm ${subTextColor}`}>Micro Action Layer</p>
                <p className={`text-lg font-semibold ${titleColor}`}>
                  Immediate Adaptation
                </p>
                <p className={textColor}>
                  Per-question outputs drive repeat timers and short-term topic
                  reinforcement.
                </p>
              </div>
              <div
                className={
                  isDark
                    ? "rounded-xl bg-black/25 p-4"
                    : "rounded-xl bg-amber-50 p-4"
                }
              >
                <p className={`text-sm ${subTextColor}`}>
                  Macro Strategy Layer
                </p>
                <p className={`text-lg font-semibold ${titleColor}`}>
                  Long-Term Planning
                </p>
                <p className={textColor}>
                  Weekly structure, workload tuning, and burnout prevention are
                  optimized using long sequences.
                </p>
              </div>
              <div
                className={
                  isDark
                    ? "rounded-xl bg-black/25 p-4"
                    : "rounded-xl bg-orange-50 p-4"
                }
              >
                <p className={`text-sm ${subTextColor}`}>Product Outcome</p>
                <p className={`text-lg font-semibold ${titleColor}`}>
                  Better Retention + Safety
                </p>
                <p className={textColor}>
                  Students revise at the right time while keeping cognitive load
                  under control.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 h-full items-center">
        <div className={card}>
          <h3 className={`text-3xl font-bold mb-4 ${titleColor}`}>
            Immediate Next Steps
          </h3>
          <ul
            className={`space-y-3 pl-6 text-lg list-disc ${
              isDark ? "marker:text-emerald-300/80" : "marker:text-teal-600/70"
            } ${textColor}`}
          >
            <li>
              Add output confidence calibration for micro and macro models.
            </li>
            <li>Expose feature-wise contributions in retention dashboard.</li>
            <li>Automate daily report generation from test6 pipeline.</li>
            <li>Attach mentor alerts to burnout risk thresholds.</li>
          </ul>
        </div>
        <div className={card}>
          <h3 className={`text-3xl font-bold mb-4 ${titleColor}`}>
            Strategic Enhancements
          </h3>
          <ul
            className={`space-y-3 pl-6 text-lg list-disc ${
              isDark ? "marker:text-emerald-300/80" : "marker:text-teal-600/70"
            } ${textColor}`}
          >
            <li>Topic graph-aware attention for cross-concept forgetting.</li>
            <li>Personalized revision batch optimizer with constraints.</li>
            <li>Teacher panel with explainable intervention suggestions.</li>
            <li>Continuous A/B evaluation on retention outcomes.</li>
          </ul>
        </div>
      </div>
    );
  };

  return (
    <div
      ref={deckRef}
      className={`relative h-screen w-full overflow-hidden transition-all duration-500 ${
        theme.pageBg
      }`}
    >
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div
          className={`absolute inset-0 bg-gradient-to-br ${current.accent} transition-all duration-700 bg-pan`}
        />
        <div className="absolute -top-20 -left-16 w-96 h-96 rounded-full bg-red-300/30 blur-3xl float-glow" />
        <div className="absolute top-1/3 -right-10 w-80 h-80 rounded-full bg-yellow-300/30 blur-3xl float-glow delay-700" />
        <div className="absolute -bottom-16 left-1/4 w-96 h-96 rounded-full bg-green-300/25 blur-3xl float-glow delay-1000" />
      </div>

      <div
        className={`relative z-10 h-full w-full ${isFullscreen ? "p-4" : "p-6"}`}
      >
        <div className={`h-full flex flex-col ${theme.shell} overflow-hidden`}>
          <div
            className={`p-5 border-b ${
              isDark ? "border-white/10" : "border-slate-200"
            } flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 shrink-0`}
          >
            <div>
              <p
                className={
                  isDark ? "text-white/80 text-sm" : "text-slate-600 text-sm"
                }
              >
                Retention Platform Presentation
              </p>
              <h1
                className={`text-4xl sm:text-5xl font-black bg-gradient-to-r ${theme.titleGradient} bg-clip-text text-transparent`}
              >
                {current.title}
              </h1>
              <p
                className={`text-lg ${
                  isDark ? "text-white/85" : "text-slate-700"
                } mt-1`}
              >
                {current.subtitle}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsDark((prev) => !prev)}
                className={`px-4 py-2 rounded-xl transition-all duration-300 hover:-translate-y-0.5 ${theme.chip}`}
              >
                {isDark ? "Light Mode" : "Dark Mode"}
              </button>
              <button
                type="button"
                onClick={toggleFullscreen}
                className={`px-4 py-2 rounded-xl transition-all duration-300 hover:-translate-y-0.5 ${theme.chip}`}
              >
                {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              </button>
              <button
                type="button"
                onClick={prevSlide}
                disabled={currentSlide === 0}
                className={
                  isDark
                    ? "px-4 py-2 rounded-xl border border-white/25 bg-black/45 text-white disabled:opacity-40 hover:bg-black/60 transition-all"
                    : "px-4 py-2 rounded-xl border border-slate-300 bg-slate-200 text-slate-800 disabled:opacity-40 hover:bg-slate-300 transition-all"
                }
              >
                Previous
              </button>
              <button
                type="button"
                onClick={nextSlide}
                disabled={currentSlide === TOTAL_SLIDES - 1}
                className={
                  isDark
                    ? "px-4 py-2 rounded-xl bg-white text-slate-900 font-semibold disabled:opacity-40 hover:bg-white/90 transition-all"
                    : "px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold disabled:opacity-40 hover:bg-slate-800 transition-all"
                }
              >
                Next
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 scroll-smooth">
            <div key={currentSlide} className="animate-fadeIn h-full">
              {renderSlide()}
            </div>
          </div>

          <div
            className={`p-4 border-t ${
              isDark ? "border-white/10" : "border-slate-200"
            } flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0`}
          >
            <div className="flex flex-wrap gap-2">
              {slides.map((s, idx) => (
                <button
                  key={s.title}
                  type="button"
                  onClick={() => goToSlide(idx)}
                  className={`transition-all duration-300 ${
                    idx === currentSlide
                      ? isDark
                        ? "h-3 w-8 rounded-full bg-yellow-300"
                        : "h-3 w-8 rounded-full bg-orange-600"
                      : isDark
                        ? "h-2 w-4 rounded-full bg-amber-200/40 hover:bg-yellow-300/70"
                        : "h-2 w-4 rounded-full bg-orange-300 hover:bg-red-400"
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>

            <p
              className={
                isDark ? "text-white/80 text-sm" : "text-slate-600 text-sm"
              }
            >
              Slide {currentSlide + 1} of {TOTAL_SLIDES}
            </p>
          </div>
        </div>
      </div>

      <style>{`
				@keyframes fadeIn {
					from {
						opacity: 0;
						transform: translateY(10px) scale(0.98);
					}
					to {
						opacity: 1;
						transform: translateY(0) scale(1);
					}
				}
        @keyframes floatGlow {
          0% { transform: translateY(0px) translateX(0px) scale(1); }
          50% { transform: translateY(-12px) translateX(8px) scale(1.04); }
          100% { transform: translateY(0px) translateX(0px) scale(1); }
        }
        @keyframes bgPan {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
				.animate-fadeIn {
					animation: fadeIn 400ms cubic-bezier(0.2, 0.9, 0.4, 1.1) forwards;
				}
        .float-glow {
          animation: floatGlow 7s ease-in-out infinite;
        }
        .bg-pan {
          background-size: 200% 200%;
          animation: bgPan 14s ease infinite;
        }
        .card-lift {
          transition: transform 350ms ease, box-shadow 350ms ease, border-color 350ms ease;
        }
        .card-lift:hover {
          border-color: rgba(251, 191, 36, 0.75);
        }
				* {
					scrollbar-width: thin;
				}
			`}</style>
    </div>
  );
};

export default DesignRetention;
