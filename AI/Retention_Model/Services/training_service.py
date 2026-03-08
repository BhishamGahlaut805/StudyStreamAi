"""
Training Service - Manages training of all three retention model layers.

This implementation is intentionally resilient for API usage:
- It reads CSV interaction history from Retention_Student_data
- It generates persisted micro/meso/macro prediction artifacts
- It updates metadata for retraining decisions
"""
import json
import logging
import os
import numpy as np
import pandas as pd
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import tensorflow as tf

logger = logging.getLogger(__name__)


class TrainingService:
    """Handles retention model training lifecycle and artifact generation."""

    def __init__(self, config):
        self.config = config
        self.model_config = config.MODEL_CONFIG

    def _student_dir(self, user_id: str) -> str:
        return os.path.join(self.config.STUDENT_DATA_DIR, user_id)

    def _ensure_student_structure(self, user_id: str) -> Dict[str, str]:
        base = self._student_dir(user_id)
        paths = {
            "root": base,
            "raw_data": os.path.join(base, "raw_data"),
            "models": os.path.join(base, "models"),
            "predictions": os.path.join(base, "predictions"),
            "metrics": os.path.join(base, "metrics"),
            "schedules": os.path.join(base, "schedules"),
        }
        for p in paths.values():
            os.makedirs(p, exist_ok=True)
        return paths

    def _metadata_path(self, user_id: str) -> str:
        return os.path.join(self._student_dir(user_id), "metadata.json")

    def _load_metadata(self, user_id: str) -> Dict:
        metadata_file = self._metadata_path(user_id)
        if os.path.exists(metadata_file):
            with open(metadata_file, "r", encoding="utf-8") as f:
                return json.load(f)

        metadata = {
            "user_id": user_id,
            "created_at": datetime.now().isoformat(),
            "last_micro_train": None,
            "last_meso_train": None,
            "last_macro_train": None,
            "interactions_since_micro": 0,
            "interactions_since_meso": 0,
            "interactions_since_macro": 0,
            "last_micro_trained_rows": 0,
            "last_meso_trained_rows": 0,
            "last_macro_trained_rows": 0,
        }
        self._save_metadata(user_id, metadata)
        return metadata

    def _save_metadata(self, user_id: str, metadata: Dict) -> None:
        self._ensure_student_structure(user_id)
        with open(self._metadata_path(user_id), "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)

    def _load_csv(self, user_id: str, filename: str) -> pd.DataFrame:
        self._ensure_student_structure(user_id)
        csv_path = os.path.join(self._student_dir(user_id), "raw_data", filename)
        if not os.path.exists(csv_path):
            return pd.DataFrame()
        try:
            df = pd.read_csv(csv_path)
            logger.info(f"Loaded {filename} with {len(df)} rows for user {user_id}")
            return df
        except Exception as exc:
            logger.error("Failed reading %s: %s", csv_path, exc)
            return pd.DataFrame()

    def _load_sequence_csv(self, user_id: str, filename: str) -> pd.DataFrame:
        return self._load_csv(user_id, filename)

    def _csv_path(self, user_id: str, filename: str) -> str:
        return os.path.join(self._student_dir(user_id), "raw_data", filename)

    def _prediction_path(self, user_id: str, filename: str) -> str:
        return os.path.join(self._student_dir(user_id), "predictions", filename)

    def _model_path(self, user_id: str, filename: str) -> str:
        return os.path.join(self._student_dir(user_id), "models", filename)

    def _safe_mtime(self, path: str) -> float:
        try:
            return float(os.path.getmtime(path))
        except Exception:
            return 0.0

    def _seconds_since(self, iso_ts: Optional[str]) -> float:
        if not iso_ts:
            return float("inf")
        try:
            return max(0.0, (datetime.now() - datetime.fromisoformat(iso_ts)).total_seconds())
        except Exception:
            return float("inf")

    def _prediction_stale(
        self,
        user_id: str,
        prediction_filename: str,
        sequence_filename: str,
        last_train_ts: Optional[str],
    ) -> bool:
        """Detect stale/missing artifacts even when row deltas are inconsistent."""
        pred_path = self._prediction_path(user_id, prediction_filename)
        seq_path = self._csv_path(user_id, sequence_filename)

        if not os.path.exists(pred_path):
            return True

        # If the model was never marked as trained, do not trust the artifact blindly.
        if not last_train_ts:
            return True

        pred_mtime = self._safe_mtime(pred_path)
        seq_mtime = self._safe_mtime(seq_path)

        # Tolerate tiny filesystem timestamp differences.
        return seq_mtime > (pred_mtime + 1.0)

    def _prediction_exists(self, user_id: str, filename: str, min_items: int = 1) -> bool:
        pred_path = self._prediction_path(user_id, filename)
        if not os.path.exists(pred_path):
            return False
        try:
            with open(pred_path, "r", encoding="utf-8") as f:
                payload = json.load(f)
            if isinstance(payload, list):
                return len(payload) >= min_items
            if isinstance(payload, dict):
                return len(payload.keys()) > 0
            return False
        except Exception:
            return False

    def _model_exists(self, user_id: str, filename: str) -> bool:
        return os.path.exists(self._model_path(user_id, filename))

    def _save_model_artifacts(self, user_id: str, model_name: str, model: tf.keras.Model, training_stats: Dict) -> Dict[str, str]:
        """Persist executable model artifacts to user models directory."""
        model_dir = os.path.join(self._student_dir(user_id), "models")
        os.makedirs(model_dir, exist_ok=True)

        keras_file = os.path.join(model_dir, f"{model_name}_lstm.keras")
        stats_file = os.path.join(model_dir, f"{model_name}_training_stats.json")
        tflite_file = os.path.join(model_dir, f"{model_name}_lstm.tflite")

        model.save(keras_file, overwrite=True)

        with open(stats_file, "w", encoding="utf-8") as f:
            json.dump(training_stats, f, indent=2)

        tflite_saved = False
        if bool(getattr(self.config, "EXPORT_TFLITE_MODELS", False)):
            try:
                converter = tf.lite.TFLiteConverter.from_keras_model(model)
                tflite_model = converter.convert()
                with open(tflite_file, "wb") as f:
                    f.write(tflite_model)
                tflite_saved = True
            except Exception as exc:
                logger.warning("Could not export %s TFLite model for user %s: %s", model_name, user_id, exc)

        return {
            "keras_path": keras_file,
            "tflite_path": tflite_file if tflite_saved else "",
            "stats_path": stats_file,
        }

    def _build_micro_lstm_model(self, sequence_length: int, n_features: int, learning_rate: float) -> tf.keras.Model:
        inputs = tf.keras.Input(shape=(sequence_length, n_features), name="micro_sequence")
        x = tf.keras.layers.LSTM(
            64,
            return_sequences=True,
            dropout=0.2,
            name="micro_lstm_1",
        )(inputs)
        x = tf.keras.layers.LSTM(32, dropout=0.2, name="micro_lstm_2")(x)
        x = tf.keras.layers.Dense(32, activation="relu", name="micro_dense")(x)

        current_retention = tf.keras.layers.Dense(1, activation="sigmoid", name="current_retention")(x)
        next_retention = tf.keras.layers.Dense(1, activation="sigmoid", name="next_retention")(x)
        stress_impact = tf.keras.layers.Dense(1, activation="sigmoid", name="stress_impact")(x)
        fatigue_prediction = tf.keras.layers.Dense(1, activation="sigmoid", name="fatigue_prediction")(x)

        model = tf.keras.Model(
            inputs=inputs,
            outputs=[current_retention, next_retention, stress_impact, fatigue_prediction],
            name="micro_lstm",
        )
        model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=learning_rate),
            loss="mse",
            metrics={
                "current_retention": ["mae"],
                "next_retention": ["mae"],
                "stress_impact": ["mae"],
                "fatigue_prediction": ["mae"],
            },
        )
        return model

    def _build_meso_lstm_model(self, sequence_length: int, n_features: int, learning_rate: float) -> tf.keras.Model:
        inputs = tf.keras.Input(shape=(sequence_length, n_features), name="meso_sequence")
        x = tf.keras.layers.LSTM(
            48,
            return_sequences=True,
            dropout=0.2,
            name="meso_lstm_1",
        )(inputs)
        x = tf.keras.layers.LSTM(24, dropout=0.2, name="meso_lstm_2")(x)
        x = tf.keras.layers.Dense(24, activation="relu", name="meso_dense")(x)

        r7 = tf.keras.layers.Dense(1, activation="sigmoid", name="retention_7d")(x)
        r30 = tf.keras.layers.Dense(1, activation="sigmoid", name="retention_30d")(x)
        r90 = tf.keras.layers.Dense(1, activation="sigmoid", name="retention_90d")(x)

        model = tf.keras.Model(inputs=inputs, outputs=[r7, r30, r90], name="meso_lstm")
        model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=learning_rate),
            loss="mse",
            metrics={
                "retention_7d": ["mae"],
                "retention_30d": ["mae"],
                "retention_90d": ["mae"],
            },
        )
        return model

    def _build_macro_lstm_model(self, sequence_length: int, n_features: int, learning_rate: float) -> tf.keras.Model:
        inputs = tf.keras.Input(shape=(sequence_length, n_features), name="macro_sequence")
        x = tf.keras.layers.LSTM(
            48,
            return_sequences=True,
            dropout=0.2,
            name="macro_lstm_1",
        )(inputs)
        x = tf.keras.layers.LSTM(24, dropout=0.2, name="macro_lstm_2")(x)
        x = tf.keras.layers.Dense(24, activation="relu", name="macro_dense")(x)

        retention_score = tf.keras.layers.Dense(1, activation="sigmoid", name="predicted_long_term_retention_score")(x)
        fatigue_risk = tf.keras.layers.Dense(1, activation="sigmoid", name="fatigue_risk_probability")(x)

        model = tf.keras.Model(inputs=inputs, outputs=[retention_score, fatigue_risk], name="macro_lstm")
        model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=learning_rate),
            loss="mse",
            metrics={
                "predicted_long_term_retention_score": ["mae"],
                "fatigue_risk_probability": ["mae"],
            },
        )
        return model

    def _col(self, df: pd.DataFrame, names, default=0.0):
        if isinstance(names, str):
            names = [names]
        for name in names:
            if name in df.columns:
                return pd.to_numeric(df[name], errors="coerce").fillna(default)
        return pd.Series([default] * max(1, len(df)), dtype=float)

    def check_retrain_needed(self, user_id: str) -> Dict:
        """Determine whether any model should retrain based on data volume/interval."""
        interactions = self._load_csv(user_id, "interactions.csv")
        micro_seq = self._load_sequence_csv(user_id, "micro_sequences.csv")
        meso_seq = self._load_sequence_csv(user_id, "meso_sequences.csv")
        macro_seq = self._load_sequence_csv(user_id, "macro_sequences.csv")
        metadata = self._load_metadata(user_id)

        def _days_since(iso_ts: str) -> int:
            if not iso_ts:
                return 10**9
            try:
                return (datetime.now() - datetime.fromisoformat(iso_ts)).days
            except Exception:
                return 10**9

        micro_cfg = self.model_config["micro"]
        meso_cfg = self.model_config["meso"]
        macro_cfg = self.model_config["macro"]
        cooldown_seconds = int(getattr(self.config, "RETRAIN_COOLDOWN_SECONDS", 120))

        # Calculate available windows for micro model
        micro_windows = max(0, len(micro_seq) - micro_cfg["sequence_length"] + 1) if not micro_seq.empty else 0

        # Check if we have enough data for each model
        micro_pred_exists = self._prediction_exists(user_id, "micro_predictions.json")
        meso_pred_exists = self._prediction_exists(user_id, "meso_predictions.json")
        macro_pred_exists = self._prediction_exists(user_id, "macro_predictions.json")

        micro_model_exists = self._model_exists(user_id, "micro_lstm.keras")
        meso_model_exists = self._model_exists(user_id, "meso_lstm.keras")
        macro_model_exists = self._model_exists(user_id, "macro_lstm.keras")

        micro_stale = self._prediction_stale(
            user_id,
            "micro_predictions.json",
            "micro_sequences.csv",
            metadata.get("last_micro_train"),
        )
        meso_stale = self._prediction_stale(
            user_id,
            "meso_predictions.json",
            "meso_sequences.csv",
            metadata.get("last_meso_train"),
        )
        macro_stale = self._prediction_stale(
            user_id,
            "macro_predictions.json",
            "macro_sequences.csv",
            metadata.get("last_macro_train"),
        )

        # Bootstrap only when artifacts are missing/corrupt, not merely stale.
        micro_bootstrap_needed = micro_windows >= micro_cfg["min_samples"] and (not micro_pred_exists or not micro_model_exists)
        meso_bootstrap_needed = len(meso_seq) >= meso_cfg["min_samples"] and (not meso_pred_exists or not meso_model_exists)
        macro_bootstrap_needed = len(macro_seq) >= macro_cfg["min_samples"] and (not macro_pred_exists or not macro_model_exists)

        # Check if retraining is needed based on new data
        micro_delta_rows = max(0, len(micro_seq) - int(metadata.get("last_micro_trained_rows", 0)))
        meso_delta_rows = max(0, len(meso_seq) - int(metadata.get("last_meso_trained_rows", 0)))
        macro_delta_rows = max(0, len(macro_seq) - int(metadata.get("last_macro_trained_rows", 0)))

        # Prefer the larger of computed row-delta and explicit counters to avoid stale metadata lockouts.
        micro_counter_delta = int(metadata.get("interactions_since_micro", 0) or 0)
        meso_counter_delta = int(metadata.get("interactions_since_meso", 0) or 0)
        macro_counter_delta = int(metadata.get("interactions_since_macro", 0) or 0)

        micro_effective_delta = max(micro_delta_rows, micro_counter_delta)
        meso_effective_delta = max(meso_delta_rows, meso_counter_delta)
        macro_effective_delta = max(macro_delta_rows, macro_counter_delta)

        micro_seconds_since = self._seconds_since(metadata.get("last_micro_train"))
        meso_seconds_since = self._seconds_since(metadata.get("last_meso_train"))
        macro_seconds_since = self._seconds_since(metadata.get("last_macro_train"))

        micro_cooldown_ok = micro_seconds_since >= cooldown_seconds
        meso_cooldown_ok = meso_seconds_since >= cooldown_seconds
        macro_cooldown_ok = macro_seconds_since >= cooldown_seconds

        # Cooldown-aware retraining: allow bootstrap anytime; otherwise require cooldown.
        micro_signal = (
            micro_effective_delta >= micro_cfg["retrain_interval"]
            or _days_since(metadata.get("last_micro_train")) >= 7
            or micro_stale
            or micro_effective_delta > 0
        )
        meso_signal = (
            meso_effective_delta >= meso_cfg["retrain_interval"]
            or _days_since(metadata.get("last_meso_train")) >= 3
            or meso_stale
            or meso_effective_delta > 0
        )
        macro_signal = (
            macro_effective_delta >= macro_cfg["retrain_interval"]
            or _days_since(metadata.get("last_macro_train")) >= 7
            or macro_stale
            or macro_effective_delta > 0
        )

        micro_needed = bool(
            micro_windows >= micro_cfg["min_samples"]
            and (micro_bootstrap_needed or (micro_cooldown_ok and micro_signal))
        )
        meso_needed = bool(
            len(meso_seq) >= meso_cfg["min_samples"]
            and (meso_bootstrap_needed or (meso_cooldown_ok and meso_signal))
        )
        macro_needed = bool(
            len(macro_seq) >= macro_cfg["min_samples"]
            and (macro_bootstrap_needed or (macro_cooldown_ok and macro_signal))
        )

        logger.info(
            f"Training check for user {user_id}: "
            f"micro={micro_needed} (windows={micro_windows}, delta={micro_effective_delta}, stale={micro_stale}), "
            f"meso={meso_needed} (rows={len(meso_seq)}, delta={meso_effective_delta}, stale={meso_stale}), "
            f"macro={macro_needed} (rows={len(macro_seq)}, delta={macro_effective_delta}, stale={macro_stale})"
        )

        return {
            "needed": any([micro_needed, meso_needed, macro_needed]),
            "models": {
                "micro": {
                    "needed": micro_needed,
                    "total_interactions": int(len(micro_seq)),
                    "available_windows": int(micro_windows),
                    "new_rows_since_train": int(micro_effective_delta),
                    "bootstrap_needed": bool(micro_bootstrap_needed),
                    "prediction_stale": bool(micro_stale),
                    "model_exists": bool(micro_model_exists),
                    "cooldown_ok": bool(micro_cooldown_ok),
                    "sequence_length": int(micro_cfg["sequence_length"]),
                    "min_required": micro_cfg["min_samples"],
                },
                "meso": {
                    "needed": meso_needed,
                    "total_rows": int(len(meso_seq)),
                    "new_rows_since_train": int(meso_effective_delta),
                    "bootstrap_needed": bool(meso_bootstrap_needed),
                    "prediction_stale": bool(meso_stale),
                    "model_exists": bool(meso_model_exists),
                    "cooldown_ok": bool(meso_cooldown_ok),
                    "min_required": meso_cfg["min_samples"],
                },
                "macro": {
                    "needed": macro_needed,
                    "total_rows": int(len(macro_seq)),
                    "new_rows_since_train": int(macro_effective_delta),
                    "bootstrap_needed": bool(macro_bootstrap_needed),
                    "prediction_stale": bool(macro_stale),
                    "model_exists": bool(macro_model_exists),
                    "cooldown_ok": bool(macro_cooldown_ok),
                    "min_required": macro_cfg["min_samples"],
                },
            },
        }

    def _write_prediction_file(self, user_id: str, filename: str, payload) -> str:
        pred_dir = os.path.join(self._student_dir(user_id), "predictions")
        os.makedirs(pred_dir, exist_ok=True)
        output = os.path.join(pred_dir, filename)
        with open(output, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)
        logger.info(f"Saved predictions to {output}")
        return output

    def _update_training_metadata(self, user_id: str, model_name: str, data_points: int) -> None:
        metadata = self._load_metadata(user_id)
        metadata[f"last_{model_name}_train"] = datetime.now().isoformat()
        metadata[f"interactions_since_{model_name}"] = 0

        if model_name == "micro":
            metadata["last_micro_trained_rows"] = int(len(self._load_sequence_csv(user_id, "micro_sequences.csv")))
        elif model_name == "meso":
            metadata["last_meso_trained_rows"] = int(len(self._load_sequence_csv(user_id, "meso_sequences.csv")))
        elif model_name == "macro":
            metadata["last_macro_trained_rows"] = int(len(self._load_sequence_csv(user_id, "macro_sequences.csv")))

        history_key = f"{model_name}_training_history"
        metadata.setdefault(history_key, [])
        metadata[history_key].append(
            {
                "date": datetime.now().isoformat(),
                "data_points": int(data_points),
                "loss": 0.0,
            }
        )
        metadata[history_key] = metadata[history_key][-10:]
        self._save_metadata(user_id, metadata)

    def record_sequence_updates(
        self,
        user_id: str,
        micro_added: int = 0,
        meso_added: int = 0,
        macro_added: int = 0,
    ) -> None:
        """Track new sequence rows so retrain_interval logic can trigger reliably."""
        metadata = self._load_metadata(user_id)
        metadata["interactions_since_micro"] = int(metadata.get("interactions_since_micro", 0)) + int(max(0, micro_added))
        metadata["interactions_since_meso"] = int(metadata.get("interactions_since_meso", 0)) + int(max(0, meso_added))
        metadata["interactions_since_macro"] = int(metadata.get("interactions_since_macro", 0)) + int(max(0, macro_added))
        metadata["last_sequence_update"] = datetime.now().isoformat()
        self._save_metadata(user_id, metadata)

    def _extract_micro_features(self, row: pd.Series) -> List[float]:
        """Extract the 15 features for micro LSTM model"""
        return [
            float(row.get('answer_correctness', 0)),  # 1. Answer Correctness
            float(row.get('normalized_response_time', 1.0)),  # 2. Normalized Response Time
            float(row.get('rolling_accuracy_topic', 0.5)),  # 3. Rolling Accuracy (Topic)
            float(row.get('correct_streak', 0)),  # 4. Consecutive Correct Streak
            float(row.get('time_since_last_attempt_topic', 0)) / 86400,  # 5. Time Since Last Attempt (normalized to days)
            float(row.get('answer_change_count', 0)) / 5,  # 6. Answer Change Count (normalized)
            float(row.get('confidence_rating', 3)) / 5,  # 7. Confidence Rating (normalized to 0-1)
            float(row.get('concept_mastery_score', 0.5)),  # 8. Concept Mastery Score
            float(row.get('question_difficulty', 3)) / 5,  # 9. Question Difficulty (normalized)
            float(row.get('fatigue_indicator', 0.3)),  # 10. Fatigue Indicator
            float(row.get('focus_loss_frequency', 0)) / 10,  # 11. Focus Loss Frequency (normalized)
            float(row.get('rolling_time_variance', 0)) / 5,  # 12. Rolling Response Time Variance (normalized)
            float(row.get('hint_usage_flag', 0)),  # 13. Hint Usage Flag
            float(row.get('preferred_difficulty_offset', 0)) / 5,  # 14. Preferred Difficulty Offset (normalized)
            float(row.get('attempt_count_topic', 1)) / 20,  # 15. Attempt Count Per Topic (normalized)
        ]

    def _extract_meso_features(self, row: pd.Series) -> List[float]:
        """Extract the 15 features for meso LSTM model"""
        return [
            float(row.get('subject_accuracy_rate', 0.5)),  # 1. Subject Accuracy Rate
            float(row.get('topic_mastery_vector', 0.5)),  # 2. Topic Mastery Vector (simplified)
            float(row.get('forgetting_rate_subject', 0.1)),  # 3. Forgetting Rate
            float(row.get('session_performance_trend', 0)),  # 4. Session Performance Trend
            float(row.get('average_response_time', 2000)) / 5000,  # 5. Average Response Time (normalized)
            float(row.get('response_time_improvement_rate', 0)),  # 6. Response Time Improvement Rate
            float(row.get('difficulty_success_rate', 0.5)),  # 7. Difficulty Success Rate
            float(row.get('revision_interval', 24)) / 168,  # 8. Revision Interval (normalized to week)
            float(row.get('topic_switch_frequency', 0.3)),  # 9. Topic Switch Frequency
            float(row.get('incorrect_pattern_frequency', 0.2)),  # 10. Incorrect Pattern Frequency
            float(row.get('learning_velocity', 0.5)),  # 11. Learning Velocity
            float(row.get('engagement_score', 0.5)),  # 12. Engagement Score
            float(row.get('fatigue_trend', 0)),  # 13. Fatigue Trend
            float(row.get('hint_dependency_rate', 0.2)),  # 14. Hint Dependency Rate
            float(row.get('retention_decay_index', 0.1)),  # 15. Retention Decay Index
        ]

    def _extract_macro_features(self, row: pd.Series) -> List[float]:
        """Extract the 15 features for macro LSTM model"""
        return [
            float(row.get('overall_accuracy_rate', 0.5)),  # 1. Overall Accuracy Rate
            float(row.get('cross_subject_mastery_vector', 0.5)),  # 2. Cross Subject Mastery Vector (simplified)
            float(row.get('daily_study_duration', 30)) / 120,  # 3. Daily Study Duration (normalized to 2 hours)
            float(row.get('study_consistency_index', 0.5)),  # 4. Study Consistency Index
            float(row.get('fatigue_pattern', 0.3)),  # 5. Fatigue Pattern
            float(row.get('forgetting_curve_slope', -0.1)),  # 6. Forgetting Curve Slope
            float(row.get('performance_variability', 0.1)),  # 7. Performance Variability
            float(row.get('session_start_time_pattern', 12)) / 24,  # 8. Session Start Time Pattern
            float(row.get('topic_completion_rate', 0.3)),  # 9. Topic Completion Rate
            float(row.get('learning_efficiency_score', 0.5)),  # 10. Learning Efficiency Score
            float(row.get('break_frequency', 0.1)),  # 11. Break Frequency
            float(row.get('cognitive_load_index', 0.5)),  # 12. Cognitive Load Index
            float(row.get('motivation_index', 0.5)),  # 13. Motivation Index
            float(row.get('stress_indicator', 0.3)),  # 14. Stress Indicator
            float(row.get('retention_stability_score', 0.5)),  # 15. Retention Stability Score
        ]

    def _timer_frame_from_retention(self, retention_score: float) -> int:
        score = float(np.clip(retention_score, 0.0, 1.0))
        if score < 0.30:
            return 30
        if score < 0.45:
            return 60
        if score < 0.55:
            return 120
        if score < 0.65:
            return 300
        if score < 0.75:
            return 600
        if score < 0.88:
            return 3600
        return 7200

    def _timer_frame_label(self, seconds: int) -> str:
        labels = {
            30: "30_seconds",
            60: "1_minute",
            120: "2_minutes",
            300: "5_minutes",
            600: "10_minutes",
            3600: "1_hour",
            7200: "2_hours",
        }
        return labels.get(int(seconds), f"{int(seconds)}_seconds")

    def _batch_type_from_timer(self, seconds: int) -> str:
        sec = int(seconds)
        if sec <= 60:
            return "immediate"
        if sec <= 300:
            return "short_term"
        if sec <= 600:
            return "medium_term"
        if sec <= 3600:
            return "long_term"
        return "mastered"

    def train_micro_model(self, user_id: str) -> Dict:
        """Train micro-level retention model from interaction records."""
        logger.info(f"Starting micro model training for user {user_id}")

        micro_seq = self._load_sequence_csv(user_id, "micro_sequences.csv")
        if micro_seq.empty:
            logger.warning(f"No micro sequences found for user {user_id}")
            return {
                "success": False,
                "model": "micro",
                "error": "No micro sequences found",
            }

        cfg = self.model_config["micro"]
        seq_len = cfg["sequence_length"]
        min_samples = cfg["min_samples"]

        available_windows = max(0, len(micro_seq) - seq_len + 1)
        logger.info(f"Micro sequences: {len(micro_seq)} rows, {available_windows} windows available")

        if available_windows < min_samples:
            logger.warning(f"Insufficient windows: {available_windows} < {min_samples}")
            return {
                "success": False,
                "model": "micro",
                "error": f"Insufficient sequence windows: {available_windows} < {min_samples}",
            }

        if "topic_id" not in micro_seq.columns:
            micro_seq["topic_id"] = "unknown_topic"
        if "subject" not in micro_seq.columns:
            micro_seq["subject"] = "unknown"

        topics = micro_seq["topic_id"].astype(str).unique().tolist()
        logger.info(f"Found {len(topics)} topics in micro sequences")

        X_all = []
        y_current_all = []
        y_next_all = []
        y_stress_all = []
        y_fatigue_all = []
        latest_windows: Dict[str, np.ndarray] = {}
        topic_subject: Dict[str, str] = {}
        topic_windows: Dict[str, int] = {}

        for topic_id in topics:
            topic_df = micro_seq[micro_seq["topic_id"].astype(str) == str(topic_id)].copy()
            topic_df = topic_df.reset_index(drop=True)
            if len(topic_df) < seq_len:
                continue

            features = [self._extract_micro_features(row) for _, row in topic_df.iterrows()]

            for i in range(len(features) - seq_len + 1):
                window = features[i:i + seq_len]
                idx = i + seq_len - 1
                current_ret = float(topic_df.iloc[idx].get("retention_probability_topic", 0.5))
                next_ret = float(topic_df.iloc[min(idx + 1, len(topic_df) - 1)].get("retention_probability_topic", current_ret))
                stress_target = float(topic_df.iloc[idx].get("fatigue_indicator", 0.3))
                fatigue_target = float(topic_df.iloc[idx].get("focus_loss_frequency", 0.3))

                X_all.append(window)
                y_current_all.append(np.clip(current_ret, 0.0, 1.0))
                y_next_all.append(np.clip(next_ret, 0.0, 1.0))
                y_stress_all.append(np.clip(stress_target, 0.0, 1.0))
                y_fatigue_all.append(np.clip(fatigue_target, 0.0, 1.0))

            latest_windows[str(topic_id)] = np.array(features[-seq_len:], dtype=np.float32)
            topic_subject[str(topic_id)] = str(topic_df.iloc[-1].get("subject", "unknown"))
            topic_windows[str(topic_id)] = max(0, len(features) - seq_len + 1)

        if not X_all:
            logger.warning("No micro windows generated after topic grouping; falling back to global rolling windows")

            if "timestamp" in micro_seq.columns:
                try:
                    micro_seq = micro_seq.sort_values("timestamp").reset_index(drop=True)
                except Exception:
                    micro_seq = micro_seq.reset_index(drop=True)
            else:
                micro_seq = micro_seq.reset_index(drop=True)

            all_features = [
                self._extract_micro_features(row) for _, row in micro_seq.iterrows()
            ]
            if len(all_features) < seq_len:
                return {
                    "success": False,
                    "model": "micro",
                    "error": "No sequence windows available for micro training",
                }

            for i in range(len(all_features) - seq_len + 1):
                window = all_features[i:i + seq_len]
                idx = i + seq_len - 1
                current_ret = float(micro_seq.iloc[idx].get("retention_probability_topic", 0.5))
                next_ret = float(
                    micro_seq.iloc[min(idx + 1, len(micro_seq) - 1)].get(
                        "retention_probability_topic", current_ret
                    )
                )
                stress_target = float(micro_seq.iloc[idx].get("fatigue_indicator", 0.3))
                fatigue_target = float(
                    micro_seq.iloc[idx].get("focus_loss_frequency", 0.3)
                )

                X_all.append(window)
                y_current_all.append(np.clip(current_ret, 0.0, 1.0))
                y_next_all.append(np.clip(next_ret, 0.0, 1.0))
                y_stress_all.append(np.clip(stress_target, 0.0, 1.0))
                y_fatigue_all.append(np.clip(fatigue_target, 0.0, 1.0))

            for topic_id in topics:
                topic_df = micro_seq[micro_seq["topic_id"].astype(str) == str(topic_id)].copy()
                topic_df = topic_df.reset_index(drop=True)
                if topic_df.empty:
                    continue

                topic_features = [
                    self._extract_micro_features(row)
                    for _, row in topic_df.iterrows()
                ]

                if len(topic_features) >= seq_len:
                    latest = np.array(topic_features[-seq_len:], dtype=np.float32)
                else:
                    pad = np.zeros((seq_len - len(topic_features), len(topic_features[0])), dtype=np.float32)
                    latest = np.vstack([pad, np.array(topic_features, dtype=np.float32)])

                latest_windows[str(topic_id)] = latest
                topic_subject[str(topic_id)] = str(topic_df.iloc[-1].get("subject", "unknown"))
                topic_windows[str(topic_id)] = max(0, len(topic_features) - seq_len + 1)

        X_array = np.array(X_all, dtype=np.float32)
        y_current_array = np.array(y_current_all, dtype=np.float32)
        y_next_array = np.array(y_next_all, dtype=np.float32)
        y_stress_array = np.array(y_stress_all, dtype=np.float32)
        y_fatigue_array = np.array(y_fatigue_all, dtype=np.float32)

        tf.keras.backend.clear_session()
        model = self._build_micro_lstm_model(
            sequence_length=seq_len,
            n_features=int(cfg.get("n_features", 15)),
            learning_rate=float(cfg.get("learning_rate", 0.001)),
        )
        callbacks = [
            tf.keras.callbacks.EarlyStopping(monitor="loss", patience=3, restore_best_weights=True),
        ]
        epochs = int(max(3, min(15, int(cfg.get("epochs", 10)))))
        batch_size = int(max(4, min(int(cfg.get("batch_size", 16)), len(X_array))))

        history = model.fit(
            X_array,
            [y_current_array, y_next_array, y_stress_array, y_fatigue_array],
            epochs=epochs,
            batch_size=batch_size,
            verbose=0,
            callbacks=callbacks,
        )

        predictions = []
        latest_items = list(latest_windows.items())
        latest_batch = np.array([window for _, window in latest_items], dtype=np.float32)
        pred_batch = model.predict(latest_batch, verbose=0)

        for idx, (topic_id, _) in enumerate(latest_items):
            current_pred = float(np.clip(pred_batch[0][idx][0], 0.0, 1.0))
            next_pred = float(np.clip(pred_batch[1][idx][0], 0.0, 1.0))
            stress_pred = float(np.clip(pred_batch[2][idx][0], 0.0, 1.0))
            fatigue_pred = float(np.clip(pred_batch[3][idx][0], 0.0, 1.0))

            repeat_seconds = int(self._timer_frame_from_retention(current_pred))
            repeat_days = float(repeat_seconds / 86400.0)
            batch_type = self._batch_type_from_timer(repeat_seconds)

            predictions.append({
                "topic_id": str(topic_id),
                "subject": topic_subject.get(str(topic_id), "unknown"),
                "current_retention": round(current_pred, 2),
                "next_retention": round(next_pred, 2),
                "stress_impact": round(stress_pred, 2),
                "fatigue_level": round(fatigue_pred, 2),
                "repeat_in_seconds": int(repeat_seconds),
                "timer_frame_label": self._timer_frame_label(repeat_seconds),
                "repeat_in_days": round(repeat_days, 4),
                "batch_type": batch_type,
                "sequence_length": seq_len,
                "windows_used": int(topic_windows.get(str(topic_id), 0)),
                "updated_at": datetime.now().isoformat(),
            })

        if not predictions:
            logger.warning(f"No predictions generated for user {user_id}")
            return {
                "success": False,
                "model": "micro",
                "error": "No predictions could be generated",
            }

        # Sort by retention (lowest first)
        predictions.sort(key=lambda x: x["current_retention"])

        # Save predictions
        self._write_prediction_file(user_id, "micro_predictions.json", predictions)
        model_artifacts = self._save_model_artifacts(
            user_id,
            "micro",
            model,
            {
                "trained_at": datetime.now().isoformat(),
                "epochs": epochs,
                "batch_size": batch_size,
                "loss_history": [float(x) for x in history.history.get("loss", [])],
                "windows": int(len(X_array)),
            },
        )
        self._update_training_metadata(user_id, "micro", len(micro_seq))

        logger.info(f"Micro model training complete for user {user_id}: {len(predictions)} topics processed, {len(X_array)} windows used")

        return {
            "success": True,
            "model": "micro",
            "predictions_count": len(predictions),
            "topics_processed": len(predictions),
            "windows_used": int(len(X_array)),
            "interactions_used": int(len(micro_seq)),
            "model_artifacts": model_artifacts,
        }

    def train_meso_model(self, user_id: str) -> Dict:
        """Train meso-level (subject/topic aggregate) retention model."""
        logger.info(f"Starting meso model training for user {user_id}")

        meso_seq = self._load_sequence_csv(user_id, "meso_sequences.csv")
        if meso_seq.empty:
            logger.warning(f"No meso sequences found for user {user_id}")
            return {
                "success": False,
                "model": "meso",
                "error": "No meso sequences found",
            }

        cfg = self.model_config["meso"]
        min_samples = cfg["min_samples"]

        logger.info(f"Meso sequences: {len(meso_seq)} rows available")

        if len(meso_seq) < min_samples:
            logger.warning(f"Insufficient data: {len(meso_seq)} < {min_samples}")
            return {
                "success": False,
                "model": "meso",
                "error": f"Insufficient data: {len(meso_seq)} < {min_samples}",
            }

        # Ensure required columns exist
        if "subject" not in meso_seq.columns:
            meso_seq["subject"] = "unknown"
        if "topic_id" not in meso_seq.columns:
            meso_seq["topic_id"] = "unknown_topic"

        X_all = []
        y7_all = []
        y30_all = []
        y90_all = []
        latest_windows: Dict[Tuple[str, str], np.ndarray] = {}

        seq_len = int(cfg.get("sequence_length", 30))
        grouped = meso_seq.groupby(["subject", "topic_id"], dropna=False)
        logger.info(f"Found {len(grouped)} subject-topic groups")

        for (subject, topic_id), group_df in grouped:
            group_df = group_df.reset_index(drop=True)
            if len(group_df) < max(3, seq_len // 3):
                continue

            features = [self._extract_meso_features(row) for _, row in group_df.iterrows()]

            min_w = max(1, min(seq_len, len(features)))
            for i in range(len(features) - min_w + 1):
                window = features[i:i + min_w]
                idx = i + min_w - 1

                r7_target = float(group_df.iloc[idx].get("subject_retention_score", group_df.iloc[idx].get("subject_accuracy_rate", 0.5)))
                r7_target = float(np.clip(r7_target, 0.0, 1.0))
                r30_target = float(np.clip(r7_target - 0.08, 0.0, 1.0))
                r90_target = float(np.clip(r30_target - 0.1, 0.0, 1.0))

                if min_w < seq_len:
                    pad = np.zeros((seq_len - min_w, len(window[0])), dtype=np.float32)
                    window_arr = np.vstack([pad, np.array(window, dtype=np.float32)])
                else:
                    window_arr = np.array(window, dtype=np.float32)

                X_all.append(window_arr)
                y7_all.append(r7_target)
                y30_all.append(r30_target)
                y90_all.append(r90_target)

            if len(features) >= seq_len:
                latest = np.array(features[-seq_len:], dtype=np.float32)
            else:
                pad = np.zeros((seq_len - len(features), len(features[0])), dtype=np.float32)
                latest = np.vstack([pad, np.array(features, dtype=np.float32)])
            latest_windows[(str(subject), str(topic_id))] = latest

        if not X_all:
            return {
                "success": False,
                "model": "meso",
                "error": "No sequence windows available for meso training",
            }

        X_array = np.array(X_all, dtype=np.float32)
        y7_array = np.array(y7_all, dtype=np.float32)
        y30_array = np.array(y30_all, dtype=np.float32)
        y90_array = np.array(y90_all, dtype=np.float32)

        tf.keras.backend.clear_session()
        model = self._build_meso_lstm_model(
            sequence_length=seq_len,
            n_features=15,
            learning_rate=float(cfg.get("learning_rate", 0.001)),
        )
        callbacks = [
            tf.keras.callbacks.EarlyStopping(monitor="loss", patience=3, restore_best_weights=True),
        ]
        epochs = int(max(3, min(12, int(cfg.get("epochs", 10)))))
        batch_size = int(max(4, min(int(cfg.get("batch_size", 16)), len(X_array))))

        history = model.fit(
            X_array,
            [y7_array, y30_array, y90_array],
            epochs=epochs,
            batch_size=batch_size,
            verbose=0,
            callbacks=callbacks,
        )

        predictions = []
        latest_items = list(latest_windows.items())
        latest_batch = np.array([window for _, window in latest_items], dtype=np.float32)
        pred_batch = model.predict(latest_batch, verbose=0)

        for idx, ((subject, topic_id), _) in enumerate(latest_items):
            r7 = float(np.clip(pred_batch[0][idx][0], 0.0, 1.0))
            r30 = float(np.clip(pred_batch[1][idx][0], 0.0, 1.0))
            r90 = float(np.clip(pred_batch[2][idx][0], 0.0, 1.0))

            if r7 < 0.5:
                next_review_days, target_questions = 3, 12
            elif r7 < 0.7:
                next_review_days, target_questions = 7, 8
            else:
                next_review_days, target_questions = 30, 4

            predictions.append({
                "subject": str(subject),
                "topic_id": str(topic_id),
                "retention_7d": round(r7, 2),
                "retention_30d": round(r30, 2),
                "retention_90d": round(r90, 2),
                "chapter_repeat_plan": {
                    "next_review_days": int(next_review_days),
                    "target_questions": int(target_questions),
                },
                "updated_at": datetime.now().isoformat(),
            })

        if not predictions:
            logger.warning(f"No meso predictions generated for user {user_id}")
            return {
                "success": False,
                "model": "meso",
                "error": "No predictions could be generated",
            }

        # Save predictions
        self._write_prediction_file(user_id, "meso_predictions.json", predictions)
        model_artifacts = self._save_model_artifacts(
            user_id,
            "meso",
            model,
            {
                "trained_at": datetime.now().isoformat(),
                "epochs": epochs,
                "batch_size": batch_size,
                "loss_history": [float(x) for x in history.history.get("loss", [])],
                "windows": int(len(X_array)),
            },
        )
        self._update_training_metadata(user_id, "meso", len(meso_seq))

        logger.info(f"Meso model training complete for user {user_id}: {len(predictions)} predictions generated")

        return {
            "success": True,
            "model": "meso",
            "predictions_count": len(predictions),
            "days_used": int(len(meso_seq)),
            "model_artifacts": model_artifacts,
        }

    def train_macro_model(self, user_id: str) -> Dict:
        """Train macro-level long-term path model from long-range daily trends."""
        logger.info(f"Starting macro model training for user {user_id}")

        macro_seq = self._load_sequence_csv(user_id, "macro_sequences.csv")
        if macro_seq.empty:
            logger.warning(f"No macro sequences found for user {user_id}")
            return {
                "success": False,
                "model": "macro",
                "error": "No macro sequences found",
            }

        cfg = self.model_config["macro"]
        min_samples = cfg["min_samples"]

        logger.info(f"Macro sequences: {len(macro_seq)} rows available")

        if len(macro_seq) < min_samples:
            logger.warning(f"Insufficient data: {len(macro_seq)} < {min_samples}")
            return {
                "success": False,
                "model": "macro",
                "error": f"Insufficient data: {len(macro_seq)} < {min_samples}",
            }

        seq_len = int(cfg.get("sequence_length", 14))
        features = [self._extract_macro_features(row) for _, row in macro_seq.iterrows()]

        X_all = []
        y_ret_all = []
        y_fatigue_all = []
        for i in range(len(features) - seq_len + 1):
            window = np.array(features[i:i + seq_len], dtype=np.float32)
            idx = i + seq_len - 1

            ret_target = float(macro_seq.iloc[idx].get("predicted_long_term_retention_score", macro_seq.iloc[idx].get("overall_accuracy_rate", 0.5)))
            fatigue_target = float(macro_seq.iloc[idx].get("fatigue_risk_probability", macro_seq.iloc[idx].get("fatigue_pattern", 0.3)))
            X_all.append(window)
            y_ret_all.append(np.clip(ret_target, 0.0, 1.0))
            y_fatigue_all.append(np.clip(fatigue_target, 0.0, 1.0))

        if not X_all:
            return {
                "success": False,
                "model": "macro",
                "error": "No sequence windows available for macro training",
            }

        X_array = np.array(X_all, dtype=np.float32)
        y_ret_array = np.array(y_ret_all, dtype=np.float32)
        y_fatigue_array = np.array(y_fatigue_all, dtype=np.float32)

        tf.keras.backend.clear_session()
        model = self._build_macro_lstm_model(
            sequence_length=seq_len,
            n_features=15,
            learning_rate=float(cfg.get("learning_rate", 0.001)),
        )
        callbacks = [
            tf.keras.callbacks.EarlyStopping(monitor="loss", patience=3, restore_best_weights=True),
        ]
        epochs = int(max(3, min(10, int(cfg.get("epochs", 8)))))
        batch_size = int(max(4, min(int(cfg.get("batch_size", 16)), len(X_array))))

        history = model.fit(
            X_array,
            [y_ret_array, y_fatigue_array],
            epochs=epochs,
            batch_size=batch_size,
            verbose=0,
            callbacks=callbacks,
        )

        latest_window = np.array(features[-seq_len:], dtype=np.float32).reshape(1, seq_len, -1)
        pred = model.predict(latest_window, verbose=0)
        projected_retention = float(np.clip(pred[0][0][0], 0.0, 1.0))
        burnout_risk = float(np.clip(pred[1][0][0], 0.0, 1.0))
        avg_accuracy = float(np.mean([float(x[0]) for x in features])) if features else 0.5
        study_time = float(np.mean([float(x[2]) for x in features])) if features else 0.5

        # Determine burnout status
        if burnout_risk >= 0.7:
            burnout_status = "high"
            break_minutes = 20
        elif burnout_risk >= 0.45:
            burnout_status = "moderate"
            break_minutes = 10
        else:
            burnout_status = "low"
            break_minutes = 5

        # Optimal daily study minutes
        optimal_minutes = int(max(25, min(120, float(study_time * 120) * 1.05)))

        # Weekly structure based on performance
        if avg_accuracy > 0.7:
            weekly_structure = {
                "revision_days": ["Monday", "Thursday"],
                "new_learning_days": ["Tuesday", "Wednesday", "Friday", "Saturday"],
                "light_review_day": "Sunday",
            }
        elif avg_accuracy > 0.5:
            weekly_structure = {
                "revision_days": ["Monday", "Wednesday", "Friday"],
                "new_learning_days": ["Tuesday", "Thursday", "Saturday"],
                "light_review_day": "Sunday",
            }
        else:
            weekly_structure = {
                "revision_days": ["Monday", "Tuesday", "Thursday", "Friday"],
                "new_learning_days": ["Wednesday", "Saturday"],
                "light_review_day": "Sunday",
            }

        macro_payload = {
            "generated_at": datetime.now().isoformat(),
            "projected_retention": round(projected_retention, 2),
            "burnout_risk": round(burnout_risk, 2),
            "fatigue_burnout_check": {
                "status": burnout_status,
                "recommended_break_minutes": break_minutes,
            },
            "optimal_daily_minutes": optimal_minutes,
            "weekly_structure": weekly_structure,
            "optimal_long_term_sequence": {
                "day_1_7": "reinforce_low_retention_topics",
                "day_8_30": "mixed_revision_with_interleaving",
                "day_31_90": "spaced_mastery_and_checkpoint_tests",
            },
        }

        self._write_prediction_file(user_id, "macro_predictions.json", macro_payload)
        model_artifacts = self._save_model_artifacts(
            user_id,
            "macro",
            model,
            {
                "trained_at": datetime.now().isoformat(),
                "epochs": epochs,
                "batch_size": batch_size,
                "loss_history": [float(x) for x in history.history.get("loss", [])],
                "windows": int(len(X_array)),
            },
        )
        self._update_training_metadata(user_id, "macro", len(macro_seq))

        logger.info(f"Macro model training complete for user {user_id}")

        return {
            "success": True,
            "model": "macro",
            "projected_retention": macro_payload["projected_retention"],
            "burnout_risk": macro_payload["burnout_risk"],
            "days_used": int(len(macro_seq)),
            "model_artifacts": model_artifacts,
        }

    def train_all_models(self, user_id: str, training_plan: Optional[Dict] = None) -> Dict:
        """Convenience API to train retention layers that are actually needed."""
        logger.info(f"Training all models for user {user_id}")

        plan = training_plan or self.check_retrain_needed(user_id)
        models_plan = (plan or {}).get("models", {})

        def _skip_payload(model_name: str) -> Dict:
            return {
                "success": True,
                "model": model_name,
                "skipped": True,
                "reason": "not_needed",
            }

        results = {
            "micro": self.train_micro_model(user_id)
            if bool((models_plan.get("micro") or {}).get("needed"))
            else _skip_payload("micro"),
            "meso": self.train_meso_model(user_id)
            if bool((models_plan.get("meso") or {}).get("needed"))
            else _skip_payload("meso"),
            "macro": self.train_macro_model(user_id)
            if bool((models_plan.get("macro") or {}).get("needed"))
            else _skip_payload("macro"),
            "timestamp": datetime.now().isoformat(),
        }

        success_count = sum(
            1
            for name in ["micro", "meso", "macro"]
            if isinstance(results.get(name), dict)
            and bool(results[name].get("success", False))
        )
        logger.info(
            f"Training complete for user {user_id}: {success_count}/3 models successful"
        )

        return results
