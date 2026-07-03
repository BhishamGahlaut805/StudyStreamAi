// constants/practiceConstants.js

export const DIFFICULTY_WINDOW_SIZE = 100;

export const SESSION_STORAGE_KEY = "practicePageState";

export const DEFAULT_METRICS = {
  correctCount: 0,
  wrongCount: 0,
  totalQuestions: 0,
  answeredQuestions: 0,
  currentAccuracy: 0,
  sessionTime: 0,
  questionTime: 0,
  averageTimePerQuestion: 0,
};

export const DEFAULT_FLASK_PREDICTIONS = {
  nextDifficulty: 0.5,
  difficultyLevel: "medium-hard",
  confidence: 0,
  method: "initial",
  windowSize: DIFFICULTY_WINDOW_SIZE,
  windowRemaining: 0,
  entriesLeftForRetraining: DIFFICULTY_WINDOW_SIZE,
  modelTrained: false,
  featureRows: 0,
  retrainInterval: DIFFICULTY_WINDOW_SIZE,
  lastTrainedAt: null,
  lastUpdatedAt: null,
  learningVelocity: null,
  burnoutRisk: null,
};

export const DEFAULT_DIFFICULTY_TELEMETRY = {
  nodeAppliedDifficulty: 0.5,
  nodeRequestedDifficulty: 0.5,
  lastNodeSyncAt: null,
};

export const DEFAULT_MODELS_DATA = {
  conceptMastery: {},
  stabilityIndex: {},
  confidenceCalibration: null,
  errorPatterns: null,
  weaknessPriority: [],
  forgettingCurve: {},
  fatigueIndex: 0.2,
  behaviorProfile: "balanced",
  difficultyTolerance: 0.5,
  studyEfficiency: 0.5,
  focusLoss: 0.1,
  timeAllocation: [],
};

export const DEFAULT_FEATURES = {
  practice: [],
  conceptHistory: {},
  sessionFeatures: [],
};

export const DIFFICULTY_LEVELS = {
  EASY: 0.3,
  MEDIUM_EASY: 0.5,
  MEDIUM_HARD: 0.7,
  HARD: 0.9,
};

export const TIME_THRESHOLDS = {
  OVER_TIME: 1.1,
  UNDER_TIME: 0.9,
};
