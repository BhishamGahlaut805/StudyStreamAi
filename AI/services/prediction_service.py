import os
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime
import traceback

from models.practice_difficulty import PracticeDifficultyModel
from models.exam_difficulty import ExamDifficultyModel
from services.data_manager import StudentDataManager
from config import Config

logger = logging.getLogger(__name__)

class PredictionService:
    """Enhanced service for making predictions with trained models"""

    def __init__(self, config):
        self.config = config
        self.models_cache = {}
        self.models_cache_mtime = {}
        self.data_managers = {}
        logger.info("PredictionService initialized")

    def _get_data_manager(self, student_id: str) -> StudentDataManager:
        if student_id not in self.data_managers:
            logger.debug(f"Creating new data manager for student {student_id}")
            self.data_managers[student_id] = StudentDataManager(
                self.config.STUDENTS_DIR, student_id
            )
        return self.data_managers[student_id]

    def clear_student_cache(self, student_id: str):
        """Clear in-memory model/data-manager cache for a student."""
        model_prefix = f"{student_id}_"
        cache_keys = [key for key in self.models_cache.keys() if key.startswith(model_prefix)]
        for key in cache_keys:
            self.models_cache.pop(key, None)
            self.models_cache_mtime.pop(key, None)

        self.data_managers.pop(student_id, None)
        logger.info(f"Cleared prediction cache for {student_id}")

    def _load_model(self, student_id: str, model_class, model_name: str,
                   sequence_length: int, n_features: int):
        """Load model from disk with caching"""
        cache_key = f"{student_id}_{model_name}"
        logger.debug(f"Attempting to load model {model_name} for student {student_id}")

        try:
            data_manager = self._get_data_manager(student_id)
            model_path = data_manager.get_model_path(model_name)
            model_file = os.path.join(model_path, f'{model_name}_model.h5')

            # Check cache
            if cache_key in self.models_cache and os.path.exists(model_file):
                try:
                    current_mtime = os.path.getmtime(model_file)
                    cached_mtime = self.models_cache_mtime.get(cache_key)
                    if cached_mtime == current_mtime:
                        logger.debug(f"Using cached model for {model_name}")
                        return self.models_cache[cache_key]
                except:
                    pass

            # For status checks only
            if model_class is None:
                exists = os.path.exists(model_file)
                logger.debug(f"Model {model_name} exists: {exists}")
                return exists

            # Load model
            if os.path.exists(model_file):
                try:
                    logger.info(f"Loading {model_name} model for student {student_id}")
                    model = model_class(sequence_length=sequence_length, n_features=n_features)
                    model.load(model_path)
                    self.models_cache[cache_key] = model
                    try:
                        self.models_cache_mtime[cache_key] = os.path.getmtime(model_file)
                    except:
                        pass
                    logger.info(f"Successfully loaded {model_name} model for student {student_id}")
                    return model
                except Exception as e:
                    logger.error(f"Error loading {model_name} model: {e}\n{traceback.format_exc()}")

            logger.info(f"No trained model found for {model_name}")
            return None

        except Exception as e:
            logger.error(f"Error in _load_model: {e}\n{traceback.format_exc()}")
            return None

    # ==================== PRACTICE DIFFICULTY PREDICTION ====================

    def predict_practice_difficulty(self, student_id: str, features: List[float]) -> Dict[str, Any]:
        """
        Enhanced prediction for next difficulty
        """
        logger.info(f"Predicting practice difficulty for student {student_id} with features: {features}")

        try:
            data_manager = self._get_data_manager(student_id)
            practice_df = data_manager.load_practice_features()

            # Try to load trained model
            model = self._load_model(
                student_id, PracticeDifficultyModel, 'practice_difficulty',
                self.config.SEQUENCE_LENGTH_PRACTICE, self.config.PRACTICE_FEATURES_COUNT
            )

            current_diff = 0.5
            if isinstance(features, list) and len(features) > 7:
                try:
                    current_diff = float(np.clip(float(features[7]), 0.2, 0.95))
                except Exception:
                    current_diff = 0.5

            if model:
                try:
                    logger.debug("Using LSTM model for prediction")
                    # Get recent sequence with enhanced preprocessing
                    feature_cols = self.config.PRACTICE_FEATURES

                    if practice_df.empty:
                        recent_data = pd.DataFrame(columns=feature_cols)
                    else:
                        recent_data = practice_df.reindex(columns=feature_cols, fill_value=0.5).tail(
                            self.config.SEQUENCE_LENGTH_PRACTICE - 1
                        )

                    # Get last N-1 sequences
                    current_features = np.array(features, dtype=np.float32)
                    if current_features.shape[0] != self.config.PRACTICE_FEATURES_COUNT:
                        if current_features.shape[0] < self.config.PRACTICE_FEATURES_COUNT:
                            pad = np.full(
                                (self.config.PRACTICE_FEATURES_COUNT - current_features.shape[0],),
                                0.5,
                                dtype=np.float32
                            )
                            current_features = np.concatenate([current_features, pad])
                        else:
                            current_features = current_features[:self.config.PRACTICE_FEATURES_COUNT]

                    if len(recent_data) > 0:
                        recent_features = recent_data.values.astype(np.float32)
                        sequence = np.vstack([recent_features, current_features.reshape(1, -1)])
                        logger.debug(f"Created sequence with shape: {sequence.shape}")
                    else:
                        sequence = current_features.reshape(1, -1)
                        logger.debug("No recent data, using only current features")

                    # Ensure correct sequence length
                    if len(sequence) < self.config.SEQUENCE_LENGTH_PRACTICE:
                        padding = np.zeros((
                            self.config.SEQUENCE_LENGTH_PRACTICE - len(sequence),
                            self.config.PRACTICE_FEATURES_COUNT
                        ))
                        sequence = np.vstack([padding, sequence])
                        logger.debug(f"Padded sequence to shape: {sequence.shape}")
                    else:
                        sequence = sequence[-self.config.SEQUENCE_LENGTH_PRACTICE:]

                    # Apply preprocessing
                    sequence = np.clip(sequence, 0, 1)

                    # Make prediction
                    prediction = model.predict_next(sequence)
                    logger.info(f"LSTM prediction result: {prediction}")

                    # Round to 2 decimals
                    raw_pred = float(prediction['predicted_difficulty'])
                    smoothed = self._bounded_smooth_difficulty(current_diff, raw_pred)

                    result = {
                        'method': 'lstm',
                        'predicted_difficulty': round(raw_pred, 2),
                        'smoothed_difficulty': round(smoothed, 2),
                        'confidence': round(float(prediction.get('confidence', 0.8)), 2),
                        'model_trained': True
                    }
                    logger.info(f"Returning prediction: {result}")
                    return result

                except Exception as e:
                    logger.error(f"LSTM prediction error: {e}\n{traceback.format_exc()}")
                    logger.info("Falling back to deterministic baseline prediction")

            # Model unavailable - return deterministic baseline until model is trained/saved
            min_samples = getattr(self.config, 'MIN_PRACTICE_SAMPLES', 10)
            if len(practice_df) >= min_samples:
                method = 'model_unavailable'
                logger.warning(
                    f"Model unavailable for {student_id} despite {len(practice_df)} feature rows; returning baseline"
                )
            else:
                method = 'insufficient_training_data'
                logger.info(
                    f"Only {len(practice_df)} feature rows available for {student_id}; need >= {min_samples} for training"
                )

            return {
                'method': method,
                'predicted_difficulty': round(current_diff, 2),
                'smoothed_difficulty': round(self._bounded_smooth_difficulty(current_diff, current_diff), 2),
                'confidence': 0.5,
                'model_trained': False
            }

        except Exception as e:
            logger.error(f"Practice prediction error: {e}\n{traceback.format_exc()}")
            return self._fallback_prediction()

    # ==================== EXAM DIFFICULTY PREDICTION ====================

    def predict_exam_difficulty(self, student_id: str, features: List[float]) -> Dict[str, Any]:
        """
        Predict recommended exam-level difficulty.

        Returns a payload with keys consumed by blueprints:
        - recommended_difficulty
        - difficulty_level
        - confidence
        - method
        - model_trained
        """
        logger.info(f"Predicting exam difficulty for student {student_id}")

        try:
            data_manager = self._get_data_manager(student_id)
            exam_df = data_manager.load_exam_features()

            current_features = np.array(features if isinstance(features, list) else [], dtype=np.float32)
            expected_size = int(getattr(self.config, 'EXAM_FEATURES', 8))

            if current_features.shape[0] < expected_size:
                pad = np.full((expected_size - current_features.shape[0],), 0.5, dtype=np.float32)
                current_features = np.concatenate([current_features, pad])
            elif current_features.shape[0] > expected_size:
                current_features = current_features[:expected_size]

            current_features = np.clip(current_features, 0.0, 1.0)

            model = self._load_model(
                student_id,
                ExamDifficultyModel,
                'exam_difficulty',
                self.config.SEQUENCE_LENGTH_EXAM,
                self.config.EXAM_FEATURES
            )

            if model:
                try:
                    feature_cols = [
                        'overall_accuracy_avg',
                        'avg_difficulty_handled',
                        'readiness_score',
                        'consistency_index',
                        'exam_performance_trend',
                        'concept_coverage_ratio',
                        'time_efficiency_score',
                        'stamina_index'
                    ]

                    if exam_df.empty:
                        recent_rows = np.empty((0, expected_size), dtype=np.float32)
                    else:
                        safe_df = exam_df.reindex(columns=feature_cols, fill_value=0.5)
                        safe_df = safe_df.apply(pd.to_numeric, errors='coerce').fillna(0.5)
                        recent_rows = safe_df.tail(max(self.config.SEQUENCE_LENGTH_EXAM - 1, 0)).values.astype(np.float32)

                    recent_sequence = []
                    if len(recent_rows) > 0:
                        recent_sequence.extend(recent_rows.tolist())
                    recent_sequence.append(current_features.tolist())

                    readiness_hint = float(current_features[2]) if expected_size >= 3 else None
                    prediction = model.predict_exam_difficulty(
                        recent_sequence,
                        student_readiness=readiness_hint
                    )

                    recommended = float(np.clip(prediction.get('recommended_difficulty', 0.5), 0.2, 0.95))

                    result = {
                        'recommended_difficulty': round(recommended, 2),
                        'difficulty_level': prediction.get('difficulty_level', self._difficulty_level_from_value(recommended)),
                        'confidence': round(float(prediction.get('confidence', 0.75)), 2),
                        'method': 'lstm',
                        'model_trained': True
                    }
                    logger.info(f"Exam difficulty prediction result: {result}")
                    return result

                except Exception as e:
                    logger.error(f"LSTM exam prediction error: {e}\n{traceback.format_exc()}")
                    logger.info("Falling back to deterministic exam baseline prediction")

            # Deterministic fallback when model is not available or prediction fails.
            readiness = float(current_features[2]) if expected_size >= 3 else 0.5
            consistency = float(current_features[3]) if expected_size >= 4 else 0.5
            recommended = float(np.clip(readiness * 0.7 + consistency * 0.3, 0.2, 0.95))

            if len(exam_df) >= int(getattr(self.config, 'MIN_EXAM_SAMPLES', 5)):
                method = 'model_unavailable'
            else:
                method = 'insufficient_training_data'

            return {
                'recommended_difficulty': round(recommended, 2),
                'difficulty_level': self._difficulty_level_from_value(recommended),
                'confidence': 0.55,
                'method': method,
                'model_trained': False
            }

        except Exception as e:
            logger.error(f"Exam prediction error: {e}\n{traceback.format_exc()}")
            return {
                'recommended_difficulty': 0.5,
                'difficulty_level': 'medium-hard',
                'confidence': 0.5,
                'method': 'fallback',
                'model_trained': False
            }

    def _difficulty_level_from_value(self, value: float) -> str:
        """Map numeric difficulty to canonical exam difficulty labels."""
        score = float(np.clip(value, 0.0, 1.0))
        if score < 0.3:
            return 'easy'
        if score < 0.5:
            return 'medium-easy'
        if score < 0.7:
            return 'medium-hard'
        return 'hard'

    def _bounded_smooth_difficulty(self, current_diff: float, predicted_diff: float) -> float:
        """Smooth difficulty shift with bounded per-step delta for stable progression."""
        current = float(np.clip(current_diff, 0.2, 0.95))
        predicted = float(np.clip(predicted_diff, 0.2, 0.95))
        max_step = 0.08

        if predicted > current + max_step:
            return current + max_step
        if predicted < current - max_step:
            return current - max_step
        return predicted

    def _enhanced_rule_based_practice(self, features: List[float]) -> Dict[str, Any]:
        """Enhanced rule-based with more sophisticated logic"""
        logger.debug(f"Using enhanced rule-based with features: {features}")

        try:
            if len(features) >= 12:
                accuracy = features[0]
                response_time = features[1]
                stress = features[4]
                confidence = features[5]
                current_diff = features[7]
                streak = features[8]
                fatigue = features[9]
                focus_loss = features[10]
                diff_offset = features[11]

                logger.debug(f"Extracted features - accuracy: {accuracy}, current_diff: {current_diff}, streak: {streak}")

                # Multi-factor adjustment
                performance_score = accuracy * 0.4 + confidence * 0.3 + (1 - stress) * 0.15 + (1 - fatigue) * 0.15

                if performance_score > 0.8 and streak > 2:
                    # High performance - increase difficulty
                    next_diff = current_diff + 0.15 * (1 + diff_offset * 0.5)
                    logger.debug(f"High performance: increasing difficulty")
                elif performance_score > 0.6:
                    # Good performance - slight increase
                    next_diff = current_diff + 0.05 * (1 - fatigue)
                    logger.debug(f"Good performance: slight increase")
                elif performance_score < 0.4 or fatigue > 0.8 or focus_loss > 0.3:
                    # Struggling - decrease difficulty
                    next_diff = current_diff - 0.15 * (1 + focus_loss)
                    logger.debug(f"Struggling: decreasing difficulty")
                else:
                    # Maintain with slight adjustment
                    next_diff = current_diff + (diff_offset * 0.1)
                    logger.debug(f"Maintaining with slight adjustment")

                # Ensure bounds and smooth
                next_diff = np.clip(next_diff, 0.2, 0.95)

                # Apply momentum
                next_diff = current_diff * 0.7 + next_diff * 0.3
                logger.debug(f"Final next_diff after smoothing: {next_diff}")
            else:
                next_diff = 0.5
                logger.debug(f"Insufficient features, using default: {next_diff}")

            result = {
                'method': 'enhanced_rule_based',
                'predicted_difficulty': round(float(next_diff), 2),
                'smoothed_difficulty': round(float(next_diff), 2),
                'confidence': 0.7,
                'model_trained': False
            }
            logger.info(f"Rule-based prediction result: {result}")
            return result

        except Exception as e:
            logger.error(f"Error in rule-based prediction: {e}\n{traceback.format_exc()}")
            return self._fallback_prediction()

    def _fallback_prediction(self) -> Dict[str, Any]:
        """Ultimate fallback prediction"""
        logger.warning("Using fallback prediction")
        return {
            'method': 'fallback',
            'predicted_difficulty': 0.5,
            'smoothed_difficulty': 0.5,
            'confidence': 0.5,
            'model_trained': False
        }

