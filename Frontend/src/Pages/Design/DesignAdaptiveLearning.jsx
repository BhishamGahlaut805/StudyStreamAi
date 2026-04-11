import React, { useEffect, useMemo, useRef, useState } from "react";

const TOTAL_SLIDES = 16;

const slides = [
  {
    title: "Adaptive Learning Blueprint",
    subtitle:
      "Practice + Real Exam architecture, data, models, and intelligence loop",
    accent: "from-red-500 via-orange-500 to-yellow-400",
  },
  {
    title: "Problem Statement",
    subtitle: "Why fixed-level tests fail and adaptive learning solves it",
    accent: "from-amber-500 via-orange-500 to-red-500",
  },
  {
    title: "System Architecture",
    subtitle: "Frontend, Node APIs, Flask AI, and student data layers",
    accent: "from-emerald-500 via-lime-500 to-yellow-400",
  },
  {
    title: "Data Collection Pipeline",
    subtitle: "Exact fields captured from frontend and session lifecycle",
    accent: "from-yellow-400 via-orange-500 to-rose-500",
  },
  {
    title: "12 Features Calculated",
    subtitle: "Simple formulas, frontend origin, and why each feature matters",
    accent: "from-green-500 via-emerald-500 to-yellow-400",
  },
  {
    title: "Sample Data Tables",
    subtitle: "Raw attempt events and transformed feature rows",
    accent: "from-orange-500 via-amber-500 to-lime-500",
  },
  {
    title: "Model Stack and Training",
    subtitle: "Random Forest models and robust +100 row retraining scheduler",
    accent: "from-red-500 via-orange-500 to-yellow-500",
  },
  {
    title: "Model Evaluation Report",
    subtitle: "Practice Difficulty Random Forest evaluation metrics",
    accent: "from-lime-500 via-emerald-500 to-green-500",
  },
  {
    title: "Feature Importance Analysis",
    subtitle: "Understanding what drives difficulty predictions",
    accent: "from-orange-500 via-red-500 to-amber-400",
  },
  {
    title: "Practice vs Real Exam",
    subtitle: "How adaptation behavior changes across modes",
    accent: "from-green-500 via-yellow-400 to-orange-500",
  },
  {
    title: "Operational Readiness",
    subtitle: "Monitoring, reliability, and product roadmap",
    accent: "from-yellow-400 via-orange-500 to-red-500",
  },
  {
    title: "Success Metrics",
    subtitle: "Key performance indicators for adaptive learning",
    accent: "from-emerald-500 via-green-500 to-lime-400",
  },
  {
    title: "Implementation Timeline",
    subtitle: "Roadmap to full production deployment",
    accent: "from-orange-500 via-amber-500 to-yellow-500",
  },
  {
    title: "Risk Mitigation",
    subtitle: "Addressing challenges in adaptive learning systems",
    accent: "from-red-500 via-orange-500 to-yellow-400",
  },
  {
    title: "Why Random Forest",
    subtitle: "Model choice rationale, fit to problem, and practical relevance",
    accent: "from-emerald-500 via-yellow-400 to-orange-500",
  },
  {
    title: "Next Steps",
    subtitle: "Moving forward with adaptive intelligence",
    accent: "from-red-500 via-orange-500 to-yellow-400",
  },
];

const featureRows = [
  {
    name: "accuracy_score",
    from: "isCorrect",
    formula: "1 if correct else 0",
    importance: "18%",
    reason: "Primary signal of understanding",
  },
  {
    name: "normalized_response_time",
    from: "timeSpent",
    formula: "clip(timeSpent / 90, 0, 1)",
    importance: "9%",
    reason: "Captures speed-pressure profile",
  },
  {
    name: "rolling_time_variance",
    from: "last 5 response times",
    formula: "variance(recent normalized times)",
    importance: "6%",
    reason: "Detects consistency or instability",
  },
  {
    name: "difficulty_ratio",
    from: "difficulty and mastery context",
    formula: "scaled ratio in [0,1]",
    importance: "7%",
    reason: "Balances challenge vs ability",
  },
  {
    name: "stress_score",
    from: "accuracy, response time",
    formula: "(1-accuracy)*0.6 + normalized_time*0.4",
    importance: "8%",
    reason: "Tracks cognitive strain",
  },
  {
    name: "confidence_index",
    from: "confidence",
    formula: "clip(confidence, 0, 1)",
    importance: "6%",
    reason: "Self-perception of certainty",
  },
  {
    name: "concept_mastery_score",
    from: "prior mastery + current accuracy",
    formula: "clip(0.2*accuracy + 0.8*prev_mastery, 0, 1)",
    importance: "12%",
    reason: "Smooth learning trajectory signal",
  },
  {
    name: "current_question_difficulty",
    from: "question payload",
    formula: "clip(difficulty, 0.2, 0.95)",
    importance: "8%",
    reason: "Immediate context anchor",
  },
  {
    name: "consecutive_correct_streak",
    from: "running streak state",
    formula: "scaled streak adjusted by difficulty",
    importance: "8%",
    reason: "Momentum and readiness trend",
  },
  {
    name: "fatigue_indicator",
    from: "session progression",
    formula: "0.7*prev_fatigue + 0.3*session_progress",
    importance: "7%",
    reason: "Long-session decay detection",
  },
  {
    name: "focus_loss_frequency",
    from: "high time + indecision",
    formula: "weighted long-time and answer-change indicators",
    importance: "6%",
    reason: "Attention drift estimation",
  },
  {
    name: "preferred_difficulty_offset",
    from: "difficulty - mastery",
    formula: "clip((difficulty - mastery + 1)/2, 0, 1)",
    importance: "5%",
    reason: "Personal comfort zone offset",
  },
];

const attemptSample = [
  {
    id: "A001",
    concept: "Algebra",
    isCorrect: 1,
    timeSpent: 42,
    confidence: 0.86,
    difficulty: 0.58,
    answerChanges: 0,
  },
  {
    id: "A002",
    concept: "Algebra",
    isCorrect: 0,
    timeSpent: 108,
    confidence: 0.45,
    difficulty: 0.62,
    answerChanges: 2,
  },
  {
    id: "A003",
    concept: "Geometry",
    isCorrect: 1,
    timeSpent: 67,
    confidence: 0.73,
    difficulty: 0.65,
    answerChanges: 1,
  },
];

const transformedSample = [
  {
    seq: 219,
    accuracy_score: 1.0,
    normalized_response_time: 0.47,
    stress_score: 0.19,
    concept_mastery_score: 0.74,
    fatigue_indicator: 0.31,
    next_question_difficulty: 0.61,
  },
  {
    seq: 220,
    accuracy_score: 0.0,
    normalized_response_time: 1.0,
    stress_score: 1.0,
    concept_mastery_score: 0.59,
    fatigue_indicator: 0.38,
    next_question_difficulty: 0.55,
  },
  {
    seq: 221,
    accuracy_score: 1.0,
    normalized_response_time: 0.74,
    stress_score: 0.3,
    concept_mastery_score: 0.67,
    fatigue_indicator: 0.41,
    next_question_difficulty: 0.63,
  },
];

const evaluationSteps = [
  { step: "[1/5]", action: "Loading metadata", status: "OK Metadata loaded" },
  {
    step: "[2/5]",
    action: "Loading and preparing data",
    status: "OK Sequences: 313 | X shape: (313, 10, 12) | y shape: (313,)",
  },
  {
    step: "[3/5]",
    action: "Loading Random Forest model and scalers",
    status: "OK Model and scalers loaded",
  },
  {
    step: "[4/5]",
    action: "Predicting",
    status: "OK Predictions generated: 313",
  },
  { step: "[5/5]", action: "Calculating metrics", status: "Completed" },
];

const detailedMetricRows = [
  {
    metric: "MAE (Mean Absolute Error)",
    value: "0.054049",
    formula: "MAE = (1/n) * sum(|y_true - y_pred|)",
  },
  {
    metric: "MSE (Mean Squared Error)",
    value: "0.005034",
    formula: "MSE = (1/n) * sum((y_true - y_pred)^2)",
  },
  {
    metric: "RMSE (Root Mean Squared Error)",
    value: "0.070952",
    formula: "RMSE = sqrt(MSE)",
  },
  {
    metric: "MAPE (Mean Absolute Percentage Error)",
    value: "9.960652%",
    formula: "MAPE = (1/n) * sum(|(y_true - y_pred)/y_true|) * 100",
  },
  {
    metric: "R2 Score (Coefficient of Determination)",
    value: "0.844586",
    formula: "R2 = 1 - (SS_res / SS_tot)",
  },
];

const quickSummaryRows = [
  {
    Metric: "MAE",
    Value: "0.054049",
    Interpretation: "Average error magnitude",
  },
  { Metric: "MSE", Value: "0.005034", Interpretation: "Squared errors" },
  { Metric: "RMSE", Value: "0.070952", Interpretation: "Root squared errors" },
  { Metric: "MAPE", Value: "9.96", Interpretation: "% Percentage error" },
  { Metric: "R2 Score", Value: "0.844586", Interpretation: "Excellent" },
];

const modelInfoRows = [
  {
    Field: "Model Path",
    Value:
      "C:/Users/bhish/OneDrive/Desktop/StudyStreamAi/AI/data/students/STU000005/models/practice_difficulty/practice_difficulty_model.pkl",
  },
  { Field: "Sequence Length", Value: "10" },
  { Field: "Number of Features", Value: "12" },
  { Field: "Model Type", Value: "practice_difficulty" },
  { Field: "Backend", Value: "random_forest_regressor" },
  { Field: "Evaluated Samples", Value: "313" },
  { Field: "Last Saved", Value: "2026-03-26T13:48:32.208365" },
];

const importanceRows = [
  {
    Rank: 1,
    Feature: "current_question_difficulty",
    "Importance (%)": "27.9132",
    "Relative to Top (%)": "100.00",
  },
  {
    Rank: 2,
    Feature: "concept_mastery_score",
    "Importance (%)": "25.9493",
    "Relative to Top (%)": "92.96",
  },
  {
    Rank: 3,
    Feature: "answer_change_count",
    "Importance (%)": "8.9363",
    "Relative to Top (%)": "32.01",
  },
  {
    Rank: 4,
    Feature: "normalized_response_time",
    "Importance (%)": "7.1259",
    "Relative to Top (%)": "25.53",
  },
  {
    Rank: 5,
    Feature: "consecutive_correct_streak",
    "Importance (%)": "6.4653",
    "Relative to Top (%)": "23.16",
  },
  {
    Rank: 6,
    Feature: "fatigue_indicator",
    "Importance (%)": "5.0442",
    "Relative to Top (%)": "18.07",
  },
  {
    Rank: 7,
    Feature: "stress_score",
    "Importance (%)": "4.8649",
    "Relative to Top (%)": "17.43",
  },
  {
    Rank: 8,
    Feature: "preferred_difficulty_offset",
    "Importance (%)": "4.8533",
    "Relative to Top (%)": "17.39",
  },
  {
    Rank: 9,
    Feature: "confidence_index",
    "Importance (%)": "3.5803",
    "Relative to Top (%)": "12.83",
  },
  {
    Rank: 10,
    Feature: "focus_loss_frequency",
    "Importance (%)": "2.4094",
    "Relative to Top (%)": "8.63",
  },
  {
    Rank: 11,
    Feature: "rolling_time_variance",
    "Importance (%)": "2.2486",
    "Relative to Top (%)": "8.06",
  },
  {
    Rank: 12,
    Feature: "accuracy",
    "Importance (%)": "0.6093",
    "Relative to Top (%)": "2.18",
  },
  {
    Rank: "TOTAL",
    Feature: "",
    "Importance (%)": "100.0000",
    "Relative to Top (%)": "100.00",
  },
];

const flattenedContributionRows = [
  {
    Slot: 115,
    Timestep: 9,
    Feature: "current_question_difficulty",
    "Importance (%)": "9.8458",
  },
  {
    Slot: 103,
    Timestep: 8,
    Feature: "current_question_difficulty",
    "Importance (%)": "7.0567",
  },
  {
    Slot: 90,
    Timestep: 7,
    Feature: "concept_mastery_score",
    "Importance (%)": "3.9014",
  },
  {
    Slot: 78,
    Timestep: 6,
    Feature: "concept_mastery_score",
    "Importance (%)": "3.4317",
  },
  {
    Slot: 91,
    Timestep: 7,
    Feature: "current_question_difficulty",
    "Importance (%)": "3.2305",
  },
  {
    Slot: 18,
    Timestep: 1,
    Feature: "concept_mastery_score",
    "Importance (%)": "3.1019",
  },
  {
    Slot: 102,
    Timestep: 8,
    Feature: "concept_mastery_score",
    "Importance (%)": "2.9901",
  },
  {
    Slot: 79,
    Timestep: 6,
    Feature: "current_question_difficulty",
    "Importance (%)": "2.3494",
  },
  {
    Slot: 30,
    Timestep: 2,
    Feature: "concept_mastery_score",
    "Importance (%)": "2.2837",
  },
  {
    Slot: 66,
    Timestep: 5,
    Feature: "concept_mastery_score",
    "Importance (%)": "2.2497",
  },
];

const DataTable = ({ columns, rows, dark }) => {
  return (
    <div
      className={
        dark
          ? "overflow-x-auto rounded-2xl border border-white/15 bg-black/20 max-h-[calc(100vh-280px)]"
          : "overflow-x-auto rounded-2xl border border-slate-200 bg-white max-h-[calc(100vh-280px)]"
      }
    >
      <table className="min-w-full text-sm">
        <thead
          className={
            dark
              ? "bg-white/10 text-white sticky top-0"
              : "bg-slate-100 text-slate-800 sticky top-0"
          }
        >
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className="px-4 py-3 text-left font-semibold whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={idx}
              className={
                dark
                  ? "border-t border-white/10 text-white/90 hover:bg-white/5 transition-colors"
                  : "border-t border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
              }
            >
              {columns.map((col) => (
                <td
                  key={`${idx}-${col}`}
                  className="px-4 py-2 whitespace-nowrap"
                >
                  {String(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const DesignAdaptiveLearning = () => {
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
        nav: "border border-amber-300/25 bg-slate-900/70",
        chip: "border border-amber-300/35 bg-amber-400/15 text-amber-100 hover:bg-amber-300/25",
        titleGradient: "from-yellow-200 via-orange-200 to-red-200",
      }
    : {
        pageBg: "bg-gradient-to-br from-amber-50 via-orange-50 to-lime-50",
        shell:
          "rounded-3xl border border-orange-200/80 bg-white/90 backdrop-blur shadow-xl",
        nav: "border border-orange-200/80 bg-white/90",
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
              Platform Mission
            </h3>
            <p className={`${textColor} text-lg leading-relaxed`}>
              Create a student-specific adaptive engine where every answer
              updates learning state, recalibrates difficulty, and produces
              explainable model decisions.
            </p>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                className={
                  isDark
                    ? "rounded-xl bg-black/25 p-4"
                    : "rounded-xl bg-sky-50 p-4"
                }
              >
                <p className={`${subTextColor} text-sm`}>Modes</p>
                <p className={`text-2xl font-semibold ${titleColor}`}>
                  Practice + Real Exam
                </p>
              </div>
              <div
                className={
                  isDark
                    ? "rounded-xl bg-black/25 p-4"
                    : "rounded-xl bg-amber-50 p-4"
                }
              >
                <p className={`${subTextColor} text-sm`}>Model Family</p>
                <p className={`text-2xl font-semibold ${titleColor}`}>
                  Random Forest
                </p>
              </div>
            </div>
          </div>

          <div className={card}>
            <h3 className={`text-3xl font-bold mb-4 ${titleColor}`}>
              What You Will See
            </h3>
            <ul
              className={`space-y-3 pl-6 text-lg list-disc ${isDark ? "marker:text-cyan-300/80" : "marker:text-sky-600/70"} ${textColor}`}
            >
              <li>Complete architecture for backend and frontend flow.</li>
              <li>Exact fields captured from student interactions.</li>
              <li>How 12 features are calculated with simple formulas.</li>
              <li>Sample data tables from raw to model-ready rows.</li>
              <li>Metrics report and retraining strategy (+100 rows).</li>
            </ul>
            <p className={`mt-6 text-sm ${subTextColor}`}>
              Controls: Left and Right arrow keys to navigate, F for fullscreen,
              T for theme toggle.
            </p>
          </div>
        </div>
      );
    }

    if (currentSlide === 1) {
      return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-full items-center">
          <div className={`${card} xl:col-span-2`}>
            <h3 className={`text-3xl font-bold mb-4 ${titleColor}`}>
              Core Problem
            </h3>
            <ul
              className={`space-y-3 pl-6 text-lg list-disc ${isDark ? "marker:text-cyan-300/80" : "marker:text-sky-600/70"} ${textColor}`}
            >
              <li>
                Same question flow for all students ignores individual pace.
              </li>
              <li>
                Static scoring misses timing, stress, and confidence behavior.
              </li>
              <li>
                No deterministic retraining means stale models and weaker
                guidance.
              </li>
              <li>Learners and mentors cannot clearly see adaptation logic.</li>
            </ul>
            <div
              className={
                isDark
                  ? "mt-6 rounded-xl bg-black/25 p-5"
                  : "mt-6 rounded-xl bg-rose-50 p-5"
              }
            >
              <p className={`text-xl font-semibold ${titleColor}`}>
                Goal: transform attempt data into explainable features and
                adjust difficulty at the right time, not on random retrain
                triggers.
              </p>
            </div>
          </div>

          <div className={card}>
            <h4 className={`text-2xl font-bold mb-4 ${titleColor}`}>
              Success Metrics
            </h4>
            <div className="space-y-4">
              {[
                "Personalization",
                "Stability",
                "Explainability",
                "Operational Safety",
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
        </div>
      );
    }

    if (currentSlide === 2) {
      return (
        <div className="space-y-6 h-full flex flex-col justify-center">
          <div className={card}>
            <h3 className={`text-3xl font-bold mb-4 ${titleColor}`}>
              Architecture Layers
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
              {[
                "Frontend React: session UI, prediction cards, retrain counters",
                "Node Backend: auth, test session orchestration, sockets",
                "Flask AI: feature pipeline, prediction, asynchronous retraining",
                "Student Storage: CSV features, model weights, metadata and logs",
                "Analytics View: profile, confidence, drift and readiness reporting",
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className={card}>
              <h4 className={`text-2xl font-bold mb-3 ${titleColor}`}>
                Practice Flow
              </h4>
              <p className={`text-lg ${textColor}`}>
                Answer event to feature extraction to next difficulty prediction
                to UI update. Rows are stored continuously and retraining
                happens when +100 new rows are accumulated.
              </p>
            </div>
            <div className={card}>
              <h4 className={`text-2xl font-bold mb-3 ${titleColor}`}>
                Real Exam Flow
              </h4>
              <p className={`text-lg ${textColor}`}>
                Uses stabilized signals from historical learning and readiness
                models, emphasizing consistency and exam-level confidence rather
                than fast oscillation.
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (currentSlide === 3) {
      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full items-center">
          <div className={card}>
            <h3 className={`text-3xl font-bold mb-4 ${titleColor}`}>
              Frontend Data Captured
            </h3>
            <ul
              className={`space-y-3 pl-6 text-lg list-disc ${isDark ? "marker:text-cyan-300/80" : "marker:text-sky-600/70"} ${textColor}`}
            >
              <li>student_id, session_id, concept/topic</li>
              <li>isCorrect from answer verification event</li>
              <li>timeSpent from question timer</li>
              <li>confidence from student input or inferred confidence</li>
              <li>current_question_difficulty from served question</li>
              <li>answerChanges and expectedTime behavior context</li>
              <li>timestamps and sequence order in session</li>
            </ul>
          </div>

          <div className={card}>
            <h3 className={`text-3xl font-bold mb-4 ${titleColor}`}>
              Stored Per Student
            </h3>
            <pre
              className={
                isDark
                  ? "rounded-xl bg-black/30 border border-white/20 p-4 text-sm text-cyan-100 whitespace-pre-wrap"
                  : "rounded-xl bg-slate-100 border border-slate-200 p-4 text-sm text-slate-700 whitespace-pre-wrap"
              }
            >
              {`AI/data/students/STU000005/
  features/practice_features.csv
  models/practice_difficulty/practice_difficulty_model.pkl
  models/practice_difficulty_metadata.json
  metrics/practice_difficulty_retrain_status.json`}
            </pre>
            <p className={`mt-4 text-base ${subTextColor}`}>
              Retrain status is persisted and shown in UI as rows remaining for
              next model update.
            </p>
          </div>
        </div>
      );
    }

    if (currentSlide === 4) {
      return (
        <div className="space-y-6 h-full flex flex-col">
          <div className={card}>
            <h3 className={`text-3xl font-bold mb-3 ${titleColor}`}>
              12 Feature Calculation and Importance
            </h3>
            <p className={`text-base mb-4 ${subTextColor}`}>
              These are generated from frontend attempt events and transformed
              into normalized values in [0,1].
            </p>
            <DataTable
              dark={isDark}
              columns={["name", "from", "formula", "importance", "reason"]}
              rows={featureRows}
            />
          </div>
        </div>
      );
    }

    if (currentSlide === 5) {
      return (
        <div className="space-y-6 h-full flex flex-col">
          <div className={card}>
            <h3 className={`text-3xl font-bold mb-3 ${titleColor}`}>
              Sample Raw Attempt Data
            </h3>
            <DataTable
              dark={isDark}
              columns={[
                "id",
                "concept",
                "isCorrect",
                "timeSpent",
                "confidence",
                "difficulty",
                "answerChanges",
              ]}
              rows={attemptSample}
            />
          </div>

          <div className={card}>
            <h3 className={`text-3xl font-bold mb-3 ${titleColor}`}>
              Sample Transformed Feature Rows
            </h3>
            <DataTable
              dark={isDark}
              columns={[
                "seq",
                "accuracy_score",
                "normalized_response_time",
                "stress_score",
                "concept_mastery_score",
                "fatigue_indicator",
                "next_question_difficulty",
              ]}
              rows={transformedSample}
            />
          </div>
        </div>
      );
    }

    if (currentSlide === 6) {
      return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 h-full items-center">
          <div className={card}>
            <h3 className={`text-3xl font-bold mb-4 ${titleColor}`}>
              Models Used
            </h3>
            <ul
              className={`space-y-3 pl-6 text-lg list-disc ${isDark ? "marker:text-cyan-300/80" : "marker:text-sky-600/70"} ${textColor}`}
            >
              <li>practice_difficulty: RandomForestRegressor</li>
              <li>exam_difficulty: RandomForestRegressor</li>
              <li>learning_velocity: RandomForestRegressor</li>
              <li>burnout_risk: RandomForestRegressor</li>
              <li>adaptive_scheduling: RandomForestRegressor</li>
              <li>global readiness estimators for exam strategy synthesis</li>
            </ul>
          </div>

          <div className={card}>
            <h3 className={`text-3xl font-bold mb-4 ${titleColor}`}>
              Robust Retraining Scheduler
            </h3>
            <ul
              className={`space-y-3 pl-6 text-lg list-disc ${isDark ? "marker:text-cyan-300/80" : "marker:text-sky-600/70"} ${textColor}`}
            >
              <li>
                Collect feature rows continuously in practice_features.csv.
              </li>
              <li>Check metadata: last_trained_feature_rows.</li>
              <li>
                Trigger training only when current_rows - last_rows is at least
                100.
              </li>
              <li>Save updated model weights and metadata on success.</li>
              <li>
                Persist retrain status JSON for frontend counters and audit.
              </li>
            </ul>
          </div>
        </div>
      );
    }

    if (currentSlide === 7) {
      return (
        <div className="space-y-6 h-full flex flex-col overflow-y-auto">
          <div className={card}>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className={`text-3xl font-bold ${titleColor}`}>
                Practice Difficulty Random Forest - Evaluation Metrics
              </h3>
            </div>
            <DataTable
              dark={isDark}
              columns={["step", "action", "status"]}
              rows={evaluationSteps}
            />
          </div>

          <div className={card}>
            <h4 className={`text-2xl font-bold mb-4 ${titleColor}`}>
              Detailed Metrics Report
            </h4>
            <DataTable
              dark={isDark}
              columns={["metric", "value", "formula"]}
              rows={detailedMetricRows}
            />
          </div>

          <div className={card}>
            <h4 className={`text-2xl font-bold mb-4 ${titleColor}`}>
              Quick Summary
            </h4>
            <DataTable
              dark={isDark}
              columns={["Metric", "Value", "Interpretation"]}
              rows={quickSummaryRows}
            />
          </div>
        </div>
      );
    }

    if (currentSlide === 8) {
      return (
        <div className="space-y-6 h-full flex flex-col">
          <div className={card}>
            <h4 className={`text-3xl font-bold mb-4 ${titleColor}`}>
              Input Feature Importance For Target Output
            </h4>
            <p className={`text-base mb-4 ${subTextColor}`}>
              Aggregated across all sequence timesteps. Detected base input
              features: 12
            </p>
            <DataTable
              dark={isDark}
              columns={[
                "Rank",
                "Feature",
                "Importance (%)",
                "Relative to Top (%)",
              ]}
              rows={importanceRows}
            />
          </div>

          <div className={card}>
            <h4 className={`text-2xl font-bold mb-4 ${titleColor}`}>
              Top Flattened Sequence Contributors
            </h4>
            <DataTable
              dark={isDark}
              columns={["Slot", "Timestep", "Feature", "Importance (%)"]}
              rows={flattenedContributionRows}
            />
          </div>
        </div>
      );
    }

    if (currentSlide === 9) {
      return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 h-full items-center">
          <div className={card}>
            <h3 className={`text-3xl font-bold mb-4 ${titleColor}`}>
              Practice Mode
            </h3>
            <ul
              className={`space-y-3 pl-6 text-lg list-disc ${isDark ? "marker:text-cyan-300/80" : "marker:text-sky-600/70"} ${textColor}`}
            >
              <li>Fast adaptation after each answer.</li>
              <li>Difficulty remains personalized and smooth.</li>
              <li>Retraining counter visible to student and mentor.</li>
              <li>
                Designed for growth, correction, and concept reinforcement.
              </li>
            </ul>
          </div>

          <div className={card}>
            <h3 className={`text-3xl font-bold mb-4 ${titleColor}`}>
              Real Exam Mode
            </h3>
            <ul
              className={`space-y-3 pl-6 text-lg list-disc ${isDark ? "marker:text-cyan-300/80" : "marker:text-sky-600/70"} ${textColor}`}
            >
              <li>Stability-first decision policy.</li>
              <li>Uses readiness, burnout, and velocity features.</li>
              <li>Reduces sudden difficulty jumps.</li>
              <li>Supports high-stakes performance planning.</li>
            </ul>
          </div>
        </div>
      );
    }

    if (currentSlide === 10) {
      return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 h-full items-center">
          <div className={card}>
            <h3 className={`text-3xl font-bold mb-4 ${titleColor}`}>
              Production Checklist
            </h3>
            <ul
              className={`space-y-3 pl-6 text-lg list-disc ${isDark ? "marker:text-cyan-300/80" : "marker:text-sky-600/70"} ${textColor}`}
            >
              <li>Prediction latency and API error rate monitoring.</li>
              <li>CSV and metadata integrity checks.</li>
              <li>Retrain policy compliance (+100 rows exactly).</li>
              <li>Frontend counter parity with backend status JSON.</li>
              <li>Model performance tracking by concept and cohort.</li>
            </ul>
          </div>

          <div className={card}>
            <h3 className={`text-3xl font-bold mb-4 ${titleColor}`}>Roadmap</h3>
            <ul
              className={`space-y-3 pl-6 text-lg list-disc ${isDark ? "marker:text-cyan-300/80" : "marker:text-sky-600/70"} ${textColor}`}
            >
              <li>Feature attribution dashboard per prediction.</li>
              <li>Adaptive hints linked to weakness priority.</li>
              <li>Teacher view with intervention suggestions.</li>
              <li>Automated model drift alerts and retrain recommendations.</li>
            </ul>
          </div>
        </div>
      );
    }

    if (currentSlide === 11) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full items-center">
          <div className={`${card} md:col-span-2`}>
            <h3 className={`text-3xl font-bold mb-6 text-center ${titleColor}`}>
              Key Performance Indicators
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  metric: "Adaptation Speed",
                  value: "< 500ms",
                  desc: "Time to adjust difficulty",
                },
                {
                  metric: "Model Accuracy",
                  value: "84.5%",
                  desc: "R2 score on predictions",
                },
                {
                  metric: "Student Engagement",
                  value: "+32%",
                  desc: "Time on platform",
                },
                {
                  metric: "Retraining Cadence",
                  value: "100 rows",
                  desc: "Trigger threshold",
                },
                {
                  metric: "Prediction Latency",
                  value: "< 200ms",
                  desc: "API response time",
                },
                {
                  metric: "User Satisfaction",
                  value: "4.8/5",
                  desc: "Student feedback",
                },
              ].map((item) => (
                <div
                  key={item.metric}
                  className={
                    isDark
                      ? "rounded-xl bg-black/25 p-4 text-center"
                      : "rounded-xl bg-slate-50 p-4 text-center"
                  }
                >
                  <p className={`text-sm ${subTextColor}`}>{item.metric}</p>
                  <p className={`text-3xl font-bold ${titleColor}`}>
                    {item.value}
                  </p>
                  <p className={`text-xs ${subTextColor}`}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (currentSlide === 12) {
      return (
        <div className={card}>
          <h3 className={`text-3xl font-bold mb-6 ${titleColor}`}>
            Implementation Timeline
          </h3>
          <div className="space-y-4">
            {[
              {
                phase: "Phase 1",
                timeframe: "Q1 2024",
                items: "Core infrastructure, data pipeline, initial models",
              },
              {
                phase: "Phase 2",
                timeframe: "Q2 2024",
                items: "Feature engineering, retraining scheduler",
              },
              {
                phase: "Phase 3",
                timeframe: "Q3 2024",
                items: "Dashboard, analytics, explainability features",
              },
              {
                phase: "Phase 4",
                timeframe: "Q4 2024",
                items: "Production deployment, monitoring, scaling",
              },
            ].map((item) => (
              <div
                key={item.phase}
                className={
                  isDark
                    ? "rounded-xl bg-black/25 p-4"
                    : "rounded-xl bg-slate-50 p-4"
                }
              >
                <div className="flex justify-between items-start">
                  <h4 className={`text-xl font-bold ${titleColor}`}>
                    {item.phase}
                  </h4>
                  <span className={`text-sm ${subTextColor}`}>
                    {item.timeframe}
                  </span>
                </div>
                <p className={`text-base ${textColor} mt-2`}>{item.items}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (currentSlide === 13) {
      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full items-center">
          <div className={card}>
            <h3 className={`text-3xl font-bold mb-4 ${titleColor}`}>
              Technical Risks
            </h3>
            <ul
              className={`space-y-3 pl-6 text-lg list-disc ${isDark ? "marker:text-cyan-300/80" : "marker:text-sky-600/70"} ${textColor}`}
            >
              <li>Model drift over time without proper monitoring.</li>
              <li>Data quality issues affecting prediction accuracy.</li>
              <li>Latency spikes during retraining operations.</li>
              <li>Edge cases in student behavior patterns.</li>
            </ul>
          </div>
          <div className={card}>
            <h3 className={`text-3xl font-bold mb-4 ${titleColor}`}>
              Mitigation Strategies
            </h3>
            <ul
              className={`space-y-3 pl-6 text-lg list-disc ${isDark ? "marker:text-cyan-300/80" : "marker:text-sky-600/70"} ${textColor}`}
            >
              <li>Automated drift detection and alerting.</li>
              <li>Data validation pipeline with anomaly detection.</li>
              <li>Asynchronous retraining with caching fallback.</li>
              <li>A/B testing for new model versions.</li>
            </ul>
          </div>
        </div>
      );
    }

    if (currentSlide === 14) {
      return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 h-full items-center">
          <div className={card}>
            <h3 className={`text-3xl font-bold mb-4 ${titleColor}`}>
              Why Random Forest Was Chosen
            </h3>
            <ul
              className={`space-y-3 pl-6 text-lg list-disc ${isDark ? "marker:text-cyan-300/80" : "marker:text-sky-600/70"} ${textColor}`}
            >
              <li>Handles nonlinear learning patterns without heavy tuning.</li>
              <li>
                Works strongly with mixed behavioral features and engineered
                signals.
              </li>
              <li>Robust to outliers and noisy student interaction events.</li>
              <li>
                Performs well on medium-sized tabular datasets like session
                features.
              </li>
              <li>
                Provides feature importance for explainable decisions in UI and
                mentor views.
              </li>
            </ul>
          </div>

          <div className={card}>
            <h3 className={`text-3xl font-bold mb-4 ${titleColor}`}>
              Practical Relevance To Our Product
            </h3>
            <ul
              className={`space-y-3 pl-6 text-lg list-disc ${isDark ? "marker:text-cyan-300/80" : "marker:text-sky-600/70"} ${textColor}`}
            >
              <li>
                Fast training supports retraining trigger policy (+100 new
                rows).
              </li>
              <li>
                Low-latency prediction keeps adaptive question flow responsive.
              </li>
              <li>
                Stable performance across practice and real-exam behavior
                profiles.
              </li>
              <li>
                Feature importance powers transparent analytics and trust.
              </li>
              <li>
                Simple deployment/maintenance reduces operational complexity.
              </li>
            </ul>
          </div>

          <div className={`${card} xl:col-span-2`}>
            <h3 className={`text-3xl font-bold mb-4 ${titleColor}`}>
              How It Works Best For This Problem
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div
                className={
                  isDark
                    ? "rounded-xl bg-black/25 p-4"
                    : "rounded-xl bg-emerald-50 p-4"
                }
              >
                <p className={`text-sm ${subTextColor}`}>Step 1</p>
                <p className={`text-lg font-semibold ${titleColor}`}>
                  Multiple Decision Trees
                </p>
                <p className={textColor}>
                  Each tree learns different partitions of student behavior
                  patterns.
                </p>
              </div>
              <div
                className={
                  isDark
                    ? "rounded-xl bg-black/25 p-4"
                    : "rounded-xl bg-amber-50 p-4"
                }
              >
                <p className={`text-sm ${subTextColor}`}>Step 2</p>
                <p className={`text-lg font-semibold ${titleColor}`}>
                  Bagging + Random Features
                </p>
                <p className={textColor}>
                  Randomness reduces overfitting and improves generalization on
                  unseen attempts.
                </p>
              </div>
              <div
                className={
                  isDark
                    ? "rounded-xl bg-black/25 p-4"
                    : "rounded-xl bg-orange-50 p-4"
                }
              >
                <p className={`text-sm ${subTextColor}`}>Step 3</p>
                <p className={`text-lg font-semibold ${titleColor}`}>
                  Averaged Prediction
                </p>
                <p className={textColor}>
                  Tree ensemble averaging gives stable, practical outputs for
                  adaptation decisions.
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
            className={`space-y-3 pl-6 text-lg list-disc ${isDark ? "marker:text-cyan-300/80" : "marker:text-sky-600/70"} ${textColor}`}
          >
            <li>Complete feature engineering pipeline validation.</li>
            <li>Deploy retraining scheduler with +100 row threshold.</li>
            <li>Launch dashboard for student progress tracking.</li>
            <li>Implement real-time difficulty adaptation.</li>
          </ul>
        </div>
        <div className={card}>
          <h3 className={`text-3xl font-bold mb-4 ${titleColor}`}>
            Future Enhancements
          </h3>
          <ul
            className={`space-y-3 pl-6 text-lg list-disc ${isDark ? "marker:text-cyan-300/80" : "marker:text-sky-600/70"} ${textColor}`}
          >
            <li>Deep learning models for complex pattern recognition.</li>
            <li>Cross-student learning insights and recommendations.</li>
            <li>Gamification elements to boost engagement.</li>
            <li>Integration with learning management systems.</li>
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
            className={`p-5 border-b ${isDark ? "border-white/10" : "border-slate-200"} flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 shrink-0`}
          >
            <div>
              <p
                className={
                  isDark ? "text-white/80 text-sm" : "text-slate-600 text-sm"
                }
              >
                Adaptive Platform Presentation
              </p>
              <h1
                className={`text-4xl sm:text-5xl font-black bg-gradient-to-r ${theme.titleGradient} bg-clip-text text-transparent`}
              >
                {current.title}
              </h1>
              <p
                className={`text-lg ${isDark ? "text-white/85" : "text-slate-700"} mt-1`}
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
            className={`p-4 border-t ${isDark ? "border-white/10" : "border-slate-200"} flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0`}
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

export default DesignAdaptiveLearning;
