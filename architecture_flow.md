# StudyStream AI - Architecture Flow

![Status](https://img.shields.io/badge/Status-Production_Architecture-16A34A?style=for-the-badge)
![Frontend](https://img.shields.io/badge/Frontend-React_%2B_Vite-0EA5E9?style=for-the-badge)
![Backend](https://img.shields.io/badge/Backend-Node.js_%2B_Express-F59E0B?style=for-the-badge)
![AI](https://img.shields.io/badge/AI-Flask_%2B_TensorFlow-E11D48?style=for-the-badge)
![Database](https://img.shields.io/badge/Database-MongoDB-22C55E?style=for-the-badge)

This document presents the complete system design for:

1. Authentication and secure session access
2. Practice Mode and Real Exam Mode (adaptive intelligence + analytics)
3. Retention system (Micro, Meso, Macro LSTM layers)

It focuses on architecture, responsibilities, data contracts, and model behavior rather than endpoint-level route details.

---

## 1. Problem Statement

Modern learners face three recurring problems:

1. One-size-fits-all practice systems that do not adapt to individual pace and confidence.
2. Poor retention over time due to lack of intelligent revision timing.
3. Weak visibility into why performance changes across topics, sessions, and stress conditions.

StudyStream AI is designed to solve these problems with a real-time adaptive engine, sequence-based AI predictions, and retention-driven scheduling.

---

## 2. How StudyStream AI Solves It

StudyStream AI combines deterministic orchestration with predictive intelligence:

1. `React Frontend` captures live behavior signals and renders explainable analytics.
2. `Node.js Backend` controls session state, validation, persistence, and real-time event flow.
3. `Flask AI Backend` runs feature engineering, model inference, and asynchronous retraining.
4. `MongoDB` stores transactional history, analytics snapshots, and retention traces.

Core communication pattern:

`Frontend <-> Node.js (REST + Socket.IO) <-> Flask AI Bridge <-> MongoDB`

---

## 3. High-Level Architecture

```mermaid
flowchart LR
    A[React Frontend] -->|REST + Socket.IO| B[Node.js Backend]
    B -->|Service Bridge| C[Flask AI Services]
    B -->|Read/Write| D[(MongoDB)]
    C -->|Artifacts + Predictions| D
    C -->|Inference Results| B
    B -->|Realtime Updates| A

    classDef frontend fill:#e0f2fe,stroke:#0284c7,color:#0c4a6e;
    classDef backend fill:#fef3c7,stroke:#d97706,color:#78350f;
    classDef ai fill:#ffe4e6,stroke:#be123c,color:#881337;
    classDef db fill:#dcfce7,stroke:#15803d,color:#14532d;

    class A frontend;
    class B backend;
    class C ai;
    class D db;
```

### 3.1 Layer Responsibilities

| Layer                         | Primary Responsibility                                 | Key Outputs                                                  |
| ----------------------------- | ------------------------------------------------------ | ------------------------------------------------------------ |
| Frontend (React)              | Interaction capture, adaptive UI, visual analytics     | Event stream, behavior metrics, user feedback state          |
| Node.js (Express + Socket.IO) | Session lifecycle, security, validation, orchestration | Authoritative session state, summaries, real-time pushes     |
| Flask AI (TensorFlow/Keras)   | Feature prep, inference, retraining, scheduling        | Difficulty guidance, readiness insights, retention forecasts |
| MongoDB                       | Persistent operational + analytical storage            | Replayable history, model-ready datasets, audit trail        |

---

## 4. Authentication Architecture

### 4.1 Objective

Ensure identity trust, secure access, and correct session ownership across practice, exam, and retention workflows.

### 4.2 Conceptual Flow

1. User submits login/register credentials from frontend auth views.
2. Node.js validates identity and issues authenticated session tokens.
3. Frontend hydrates user state and attaches credentials on protected calls.
4. Middleware verifies identity before any protected data/action.
5. Socket sessions inherit authenticated context for secure real-time channels.

### 4.3 Security Controls

1. Credential validation and token verification.
2. Role and ownership checks for session-level resources.
3. Middleware guards before sensitive operations.
4. CORS/cookie policy alignment between frontend and backend services.

---

## 5. Practice + Real Exam Intelligence Architecture

### 5.1 Unified Session Flow

1. Frontend starts a session with learner intent and scope.
2. Node.js creates and manages authoritative session state.
3. Frontend captures timing, confidence, behavior, and answer transitions.
4. Node.js persists events and forwards modeling payloads to Flask.
5. Flask returns predictions and retrains asynchronously when thresholds are met.
6. Node.js streams updated analytics and predictions to frontend.
7. Frontend displays adaptive insights and final performance summaries.

### 5.2 Practice Mode

1. Adaptive practice session starts with subject/topic context.
2. Per-question loop captures behavior and correctness in real time.
3. Flask predicts next difficulty and confidence band.
4. Frontend applies short stability windows to avoid abrupt difficulty jumps.
5. Session completion triggers summary generation and model feedback ingestion.

### 5.3 Real Exam Mode

1. Readiness vector determines initial difficulty bias.
2. Timed question cycle streams answers through real-time channel.
3. Node.js updates score/analytics continuously.
4. Final submission or timeout generates authoritative result package.
5. Frontend renders final insights: accuracy, timing, weak areas, trend signals.

### 5.4 12 Analytics Intelligence Blocks

1. Concept Mastery Model
2. Stability Index Model
3. Confidence Calibration Model
4. Error Pattern Classification Model
5. Weakness Severity Ranking Model
6. Forgetting Curve Model
7. Fatigue Sensitivity Model
8. Cognitive Behavior Profile Model
9. Difficulty Tolerance Model
10. Study Efficiency Model
11. Focus Loss Detection Model
12. Adaptive Time Allocation Model

### 5.5 Trained Models vs Derived Models

`Trained in Flask`:

1. Practice difficulty sequence model
2. Exam difficulty sequence model
3. Learning velocity model
4. Burnout risk model
5. Global readiness model
6. Adaptive scheduling model

`Derived in analytics layer`:

1. The 12 explainability models computed from history and traces

This hybrid approach keeps UI analytics fast while preserving deep model guidance when data volume is sufficient.

---

## 6. Data Contracts

### 6.1 Raw Interaction Events (Realtime to Node.js)

1. `user_id` / `student_id`
2. `session_id`
3. `question_id`
4. `subject` / `topic` / `concept`
5. `selected_answer`
6. `correct_answer_flag` or equivalent correctness fields
7. `response_time`
8. `answer_changes`
9. `confidence_rating`
10. `hint_used`
11. `timestamp`
12. `device_focus_loss_event`

### 6.2 Practice Engineered Vector (12 Features)

1. `accuracy`
2. `normalized_response_time`
3. `rolling_time_variance`
4. `answer_change_count`
5. `stress_score`
6. `confidence_index`
7. `concept_mastery_score`
8. `current_question_difficulty`
9. `consecutive_correct_streak`
10. `fatigue_indicator`
11. `focus_loss_frequency`
12. `preferred_difficulty_offset`

Training target: `next_difficulty`

### 6.3 Real Exam Readiness Vector (8 Features)

1. `overall_accuracy`
2. `avg_difficulty_handled`
3. `readiness_score`
4. `consistency_index`
5. `trend_signal`
6. `concept_coverage_ratio`
7. `time_efficiency_score`
8. `stamina_index`

Expected exam outputs:

1. `recommended_difficulty`
2. `difficulty_band`
3. `confidence`
4. `insights` bundle

---

## 7. Retention Architecture (Micro, Meso, Macro LSTM)

### 7.1 End-to-End Retention Flow

1. Frontend starts retention session through Node.js.
2. Node.js streams question flow and stores session metrics.
3. Frontend sends raw and engineered retention signals.
4. Flask executes Micro, Meso, and Macro models.
5. Predictions and scheduling guidance return to Node.js.
6. Node.js persists to MongoDB and streams updates to frontend.
7. Final retention schedule and scores are generated for learner guidance.

### 7.2 Micro LSTM (Topic Level)

Purpose: Predict topic-level retention probability and near-term question difficulty.

Inputs (15 features): correctness, normalized response time, rolling topic accuracy, streak, time since last attempt, answer changes, confidence, concept mastery, question difficulty, fatigue indicator, focus loss frequency, rolling time variance, hint usage, preferred difficulty offset, topic attempt count.

Targets:

1. Retention probability
2. Next question difficulty
3. Correctness probability for next attempt

### 7.3 Meso LSTM (Subject Level)

Purpose: Predict subject mastery trajectory and revision priorities.

Inputs (15 features): subject accuracy, topic mastery vector, forgetting rate, performance trend, average response time, response time improvement rate, difficulty success rate, revision interval, topic switch frequency, incorrect pattern frequency, learning velocity, engagement score, fatigue trend, hint dependency, retention decay index.

Targets:

1. Subject retention score
2. Next topic revision priority
3. Optimal revision interval

### 7.4 Macro LSTM (Learning Path Level)

Purpose: Optimize long-term study planning across subjects.

Inputs (15 features): overall accuracy, cross-subject mastery vector, daily study duration, consistency index, fatigue pattern, forgetting curve slope, variability, start-time pattern, topic completion rate, efficiency score, break frequency, cognitive load index, motivation index, stress indicator, retention stability score.

Targets:

1. Optimal daily schedule
2. Subject priority order
3. Long-term retention forecast
4. Fatigue risk probability

### 7.5 Retention Payload Contract

In addition to raw events, the retention engine accepts:

1. `micro_features`
2. `meso_features`
3. `macro_features`
4. `derived_targets`
5. `schedule_hint`
6. `quality_signals`

The dual pathway (raw + engineered) improves resilience when one signal stream is sparse.

---

## 8. Implementation-Backed Parameter Engineering Report

This section documents the **actual implemented formulas and payload construction paths** used in the current codebase for:

1. Flask LSTM training and inference parameters
2. Node.js + Flask retention mixture
3. The 12 analytics models (derived layer)
4. Frontend-to-backend parameter computation

**Visual interpretation legend:**

1. <span style="color:#0f766e;"><strong>Green</strong></span> = stable/high retention indicators
2. <span style="color:#b45309;"><strong>Amber</strong></span> = caution/transition indicators
3. <span style="color:#b91c1c;"><strong>Red</strong></span> = risk/urgent intervention indicators

### 8.1 Traceability Matrix (Code Sources)

| Layer                    | Primary Files (Implementation Source)                                                                                                                         | Role in Parameter Flow                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Frontend Practice        | `Frontend/src/Pages/Tests/practicePage.jsx`, `Frontend/src/services/flaskService.js`                                                                          | Builds live 12-feature vector, computes confidence, sends attempts + prediction requests |
| Frontend Real Exam       | `Frontend/src/Pages/Tests/testPage.jsx`, `Frontend/src/services/flaskService.js`                                                                              | Builds 8-feature readiness vector and requests exam difficulty                           |
| Frontend Retention       | `Frontend/src/Pages/Retention/RetentionPageInterface.jsx`, `Frontend/src/services/RetentionModel/RetentionService.js`                                         | Computes micro/meso/macro features, derived targets, schedule hints, quality signals     |
| Node.js Backend          | `Backend/controllers/retentionSessionController.js`, `Backend/Services/retentionFlaskService.js`                                                              | Validates/normalizes, enriches payloads, bridges to Flask, merges schedule decisions     |
| Flask AI (Practice/Exam) | `AI/services/data_manager.py`, `AI/services/feature_engineering.py`, `AI/services/training_service.py`, `AI/services/prediction_service.py`, `AI/models/*.py` | Feature engineering, sequence prep, LSTM training/inference                              |
| Flask AI (Retention)     | `AI/Retention_Model/Services/*.py`, `AI/Retention_Model/models/*.py`, `AI/config.py`                                                                          | Retention sequence generation, micro/meso/macro model training + prediction              |

### 8.2 Flask Practice LSTM: Training Parameters and Architecture

**Configured constants (`AI/config.py`)**

| Parameter                   | Value        |
| --------------------------- | ------------ |
| `SEQUENCE_LENGTH_PRACTICE`  | `10`         |
| `PRACTICE_FEATURES_COUNT`   | `12`         |
| `MIN_PRACTICE_SAMPLES`      | `10`         |
| `PRACTICE_RETRAIN_INTERVAL` | `5` new rows |
| `EPOCHS`                    | `100`        |
| `BATCH_SIZE`                | `32`         |

**Architecture (`AI/models/practice_difficulty.py`)**

1. `BatchNormalization`
2. `Bidirectional(LSTM(128))` with dropout + recurrent dropout + `l2(0.001)`
3. Stacked `LSTM(64)` and `LSTM(32)`
4. Dense regularized head ending with `Dense(1, sigmoid)`
5. Optimizer: Adam with exponential decay schedule
6. Loss: `mse`, metrics include `mae` and `RMSE`

### 8.3 Practice Feature Engineering (Implemented Formulas)

There are **two parallel feature paths** in current implementation:

1. **Live prediction vector path** (frontend computes 12 features, sends to `/practice/next-difficulty`).
2. **Persisted training path** (Flask `append_practice_attempts_as_features` computes/stores training rows).

#### 8.3.1 Live 12-Feature Vector (Frontend)

Source: `Frontend/src/Pages/Tests/practicePage.jsx` (`extractAndSendFeatures`).

| Feature                       | Implemented formula                      |
| ----------------------------- | ---------------------------------------- |
| `accuracy`                    | `1 if isCorrect else 0`                  |
| `normalized_response_time`    | `responseTime / avgTimeOfCorrectAnswers` |
| `rolling_time_variance`       | variance of last 5 `timeSpent` values    |
| `answer_change_count`         | `answerChanges`                          |
| `stress_score`                | `1 - min(1, normalizedTime / 2)`         |
| `confidence_index`            | `result.confidence or 0.5`               |
| `concept_mastery_score`       | concept-wise rolling accuracy            |
| `current_question_difficulty` | `question.difficulty or 0.5`             |
| `consecutive_correct_streak`  | trailing count of correct answers        |
| `fatigue_indicator`           | `answers.length / 20`                    |
| `focus_loss_frequency`        | `1 if answerChanges > 2 else 0`          |
| `preferred_difficulty_offset` | `question.difficulty - conceptAccuracy`  |

#### 8.3.2 Persisted Training Rows (Flask)

Source: `AI/services/data_manager.py` (`append_practice_attempts_as_features`).

| Feature                       | Implemented formula                                                |
| ----------------------------- | ------------------------------------------------------------------ |
| `normalized_response_time`    | `clip(time_spent / 90.0, 0, 1)`                                    |
| `rolling_time_variance`       | `clip(var(last5NormalizedTimes), 0, 1)`                            |
| `stress_score`                | `clip((1-accuracy)*0.6 + normalized_time*0.4, 0, 1)`               |
| `concept_mastery_score`       | EWMA: `0.2*accuracy + 0.8*previous_mastery`                        |
| `consecutive_correct_streak`  | streak update, then scaled by `(0.5 + 0.5*difficulty)` and clipped |
| `fatigue_indicator`           | `clip(previous_fatigue*0.7 + session_progress*0.3, 0, 1)`          |
| `focus_loss_frequency`        | weighted rule from long response and doubtful answer changes       |
| `preferred_difficulty_offset` | `clip((difficulty - mastery + 1)/2, 0, 1)`                         |
| target `next_difficulty`      | shifted to next observed question difficulty                       |

#### 8.3.3 Sample Practice Row (Illustrative, Code-Conformant)

| accuracy | norm_time | var5   | ans_change | stress | conf   | mastery | curr_diff | streak | fatigue | focus_loss | pref_diff_off | next_diff |
| -------- | --------- | ------ | ---------- | ------ | ------ | ------- | --------- | ------ | ------- | ---------- | ------------- | --------- |
| `1.00`   | `0.62`    | `0.08` | `0.20`     | `0.25` | `0.78` | `0.71`  | `0.64`    | `0.56` | `0.33`  | `0.00`     | `0.46`        | `0.68`    |

### 8.4 Real Exam Difficulty Vector (Current Implementation)

Source: `Frontend/src/Pages/Tests/testPage.jsx`.

Current exam readiness vector sent to Flask is:

`[practiceProfile.currentDifficulty, config.initialDifficulty, modelReady?0.7:0.5, 0.6, 0, 0.6, 0.6, 0.7]`

Mapped to exam model expected slots:

1. `overall_accuracy_avg`
2. `avg_difficulty_handled`
3. `readiness_score`
4. `consistency_index`
5. `exam_performance_trend`
6. `concept_coverage_ratio`
7. `time_efficiency_score`
8. `stamina_index`

**Implementation status note:** `AI/blueprints/real_exam.py` references `save_exam_records`, `load_exam_records`, `compute_exam_features`, and `prepare_exam_training_data`, but these functions are not present in `AI/services/data_manager.py` and `AI/services/feature_engineering.py` in the current tree. This means exam-model training feature persistence is partially wired and should be completed for fully consistent retraining behavior.

### 8.5 Retention LSTM Parameters and Engineered Features

#### 8.5.1 Retention Training Configuration (`AI/config.py`)

| Model | Sequence/Shape                               | Epochs | Batch | LR      | Min Samples |
| ----- | -------------------------------------------- | ------ | ----- | ------- | ----------- |
| Micro | seq `20`, features `15`                      | `100`  | `32`  | `0.001` | `20`        |
| Meso  | seq `30`, temporal+metadata                  | `80`   | `16`  | `0.001` | `7`         |
| Macro | encoder-decoder (`20`/`15` feature channels) | `60`   | `16`  | `0.001` | `30`        |

#### 8.5.2 Frontend Retention Feature Equations

Source: `Frontend/src/Pages/Retention/RetentionPageInterface.jsx`.

**Micro feature highlights (15):**

1. `normalizedResponseTime = responseTimeMs / max(avgResponseTime, 1)`
2. `conceptMasteryScore = clamp(rollingTopicAccuracy*0.7 + isCorrect*0.3)`
3. `fatigueIndicator = clamp(sessionElapsedSec / 3600)`
4. `focusLossFrequency = totalFocusLoss / max(answered,1)`
5. `rollingTimeVariance = clamp(abs(normalizedResponseTime - 1) * 2)`
6. `preferredDifficultyOffset = difficulty - round(3 - (topicAccuracy-0.5)*2)`

**Derived micro targets:**

1. `retention_probability = clamp(0.45*topicAcc + 0.25*mastery + 0.15*(confidence/5) + 0.15*clamp(1/max(normTime,0.1)))`
2. `probability_correct_next = clamp(0.4*topicAcc + 0.3*mastery + 0.2*(confidence/5) - 0.1*fatigue)`
3. `next_question_difficulty = round(2.5 + (topicAcc-0.5)*3)` bounded to `1..5`

**Meso and macro are computed in frontend** as deterministic aggregates from session metrics (`accuracy`, `recentAccuracy`, `averageResponseTime`, `focusLossCount`, `microLSTM stress/fatigue`, etc.) and appended as arrays in `meso_features` and `macro_features`.

#### 8.5.3 Node Bridge Enrichment (Retention)

Source: `Backend/controllers/retentionSessionController.js`.

Node enriches payloads before forwarding to Flask via `toFlaskAnswerRow(...)`:

1. Adds canonical IDs (`user_id`, `session_id`, `question_id`, `topic_id`, `subject`)
2. Harmonizes timing fields (`response_time`, `response_time_ms`, `time_spent`)
3. Normalizes engineered arrays (`micro_features`, `meso_features`, `macro_features`)
4. Preserves `derived_targets`, `schedule_hint`, and `quality_signals`

### 8.6 12 Analytics Models (Node.js + Frontend Derived Layer)

Source: `Frontend/src/Pages/Tests/practicePage.jsx` (`calculateModelsData`).

These 12 models are currently **derived analytics** (not separate Flask-trained networks) and mix Node session metrics + Flask guidance.

| Model                  | Formula Basis                                   | Why it matters                          |
| ---------------------- | ----------------------------------------------- | --------------------------------------- |
| Concept Mastery        | incremental update: `old + 0.3*(recentAcc-old)` | Tracks concept learning momentum        |
| Stability Index        | `1 - variance/0.25` (clipped)                   | Detects erratic vs stable performance   |
| Confidence Calibration | configured calibration deltas                   | Helps detect over/under-confidence      |
| Error Patterns         | weighted buckets                                | Improves targeted remediation           |
| Weakness Priority      | `(1-mastery)*errorRate*retentionDecay`          | Prioritizes highest-impact revision     |
| Forgetting Curve       | decay constant + retention map                  | Schedules revision urgency              |
| Fatigue Index          | `0.2 + sessionTime/3600 + (1-accuracy)*0.3`     | Prevents burnout and overloading        |
| Behavior Profile       | time + answer-change rules                      | Adapts coaching style                   |
| Difficulty Tolerance   | `0.3 + accuracy*0.5`                            | Tunes challenge level safely            |
| Study Efficiency       | `correctCount / max(1, sessionMinutes)`         | Optimizes time-to-learning ratio        |
| Focus Loss             | `answerChanges / answers / 5`                   | Captures attention drift                |
| Time Allocation        | minutes by weakness rank                        | Converts analytics into actionable plan |

### 8.7 Frontend-to-Backend Payload Example (Retention Submit)

| Field                                     | Sample value   | Computation source                  |
| ----------------------------------------- | -------------- | ----------------------------------- |
| `responseTimeMs`                          | `18200`        | `Date.now() - questionStartRef`     |
| `confidence`                              | `0.8`          | `confidenceRating / 5`              |
| `stressLevel`                             | `0.41`         | `retentionProbability*0.3 + 0.2`    |
| `fatigueIndex`                            | `0.34`         | `retentionProbability*0.2 + 0.2`    |
| `focusScore`                              | `0.79`         | `1 - retentionProbability*0.3`      |
| `micro_features`                          | `[15 values]`  | `computeMicroFeatures(...)`         |
| `meso_features`                           | `[15+ values]` | `computeMesoFeatures()` flattening  |
| `macro_features`                          | `[15+ values]` | `computeMacroFeatures()` flattening |
| `derived_targets.micro.repeat_in_seconds` | `300`          | retention-band mapping (`30..7200`) |
| `schedule_hint.next_repeat_at`            | ISO datetime   | `now + timer_frame_seconds`         |

### 8.8 Feature Importance for Solution Outcomes

**Why these engineered parameters are high-value for StudyStream AI:**

1. **Personalization depth:** `concept_mastery`, `streak`, and `difficulty offset` prevent one-size-fits-all sequencing.
2. **Cognitive safety:** `stress`, `fatigue`, and `focus` features reduce burnout risk and unstable difficulty jumps.
3. **Retention quality:** micro/meso/macro features jointly support immediate recall, subject planning, and long-horizon scheduling.
4. **Operational robustness:** Node-side normalization ensures frontend variability does not corrupt model inputs.
5. **Explainability:** the 12 derived analytics convert latent model signals into learner-facing action plans.

---

## 9. Analytics and Result Generation

At session completion, the system composes:

1. Overall score and accuracy
2. Response-time profile
3. Subject/topic mastery map
4. Difficulty-wise success map
5. Weakness-priority recommendations
6. Retention and fatigue guidance

Output strategy:

1. Backend summaries are authoritative.
2. Frontend modules provide explainable visual decomposition.

---

## 10. Societal Impact

StudyStream AI contributes beyond individual score improvement:

1. `Improved learning equity`: personalized pacing helps students with different backgrounds and speeds.
2. `Reduced burnout risk`: fatigue-aware scheduling discourages overloading and supports healthier study rhythm.
3. `Higher retention quality`: spaced and adaptive revision lowers forgetting and improves long-term outcomes.
4. `Actionable transparency`: explainable analytics helps students, teachers, and guardians make informed interventions.
5. `Scalable support`: AI-driven guidance can extend quality academic support where teacher bandwidth is limited.

---

## 11. Architectural Principles

1. Separate transactional orchestration (Node.js) from ML computation (Flask).
2. Preserve both raw and engineered data pipelines for robustness.
3. Use asynchronous retraining to protect user-facing latency.
4. Persist model artifacts and prediction history per learner.
5. Stream real-time analytics while maintaining backend-authoritative state.
6. Tie retention scheduling to model outputs with fatigue and stress safeguards.

---

End of architecture specification.
