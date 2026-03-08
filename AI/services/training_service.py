import os
import threading
import logging
import numpy as np
from typing import Dict, Any, Optional, List
from datetime import datetime
import traceback
import time
import pandas as pd

from models.practice_difficulty import PracticeDifficultyModel
from models.exam_difficulty import ExamDifficultyModel
from models.learning_velocity import LearningVelocityModel
from models.burnout_risk import BurnoutRiskModel
from models.adaptive_scheduling import AdaptiveSchedulingModel
from services.data_manager import StudentDataManager
from services.feature_engineering import FeatureEngineeringService

logger = logging.getLogger(__name__)

class TrainingService:
    """Enhanced service for training all models with robust error handling and logging"""

    def __init__(self, config):
        self.config = config
        self.training_jobs = {}  # Track training jobs per student
        self.training_history = {}  # Store training history
        logger.info("=" * 60)
        logger.info("TRAINING SERVICE INITIALIZED")
        logger.info(f"Config: MIN_PRACTICE_SAMPLES={config.MIN_PRACTICE_SAMPLES}")
        logger.info(f"Config: MIN_EXAM_SAMPLES={config.MIN_EXAM_SAMPLES}")
        logger.info(f"Config: SEQUENCE_LENGTH_PRACTICE={config.SEQUENCE_LENGTH_PRACTICE}")
        logger.info(f"Config: EPOCHS={config.EPOCHS}")
        logger.info("=" * 60)

    def _get_data_manager(self, student_id: str) -> StudentDataManager:
        """Get or create data manager for student"""
        logger.debug(f"Getting data manager for student: {student_id}")
        return StudentDataManager(self.config.STUDENTS_DIR, student_id)

    def cancel_practice_training(self, student_id: str):
        """Mark current/future practice training job as cancelled for a student."""
        self.training_jobs[student_id] = self.training_jobs.get(student_id, {})
        self.training_jobs[student_id]['practice_cancelled'] = True
        self.training_jobs[student_id]['practice_cancelled_at'] = datetime.now().isoformat()
        logger.info(f"Practice training cancelled for {student_id}")

    def _is_practice_cancelled(self, student_id: str) -> bool:
        job_info = self.training_jobs.get(student_id, {})
        return bool(job_info.get('practice_cancelled', False))

    def _log_training_start(self, student_id: str, model_type: str, data_size: int):
        """Log training start with details"""
        logger.info(f"╔══════════════════════════════════════════════════════════╗")
        logger.info(f"║ STARTING {model_type.upper()} MODEL TRAINING")
        logger.info(f"║ Student: {student_id}")
        logger.info(f"║ Data size: {data_size} samples")
        logger.info(f"║ Timestamp: {datetime.now().isoformat()}")
        logger.info(f"╚══════════════════════════════════════════════════════════╝")

    def _log_training_complete(self, student_id: str, model_type: str, metadata: Dict):
        """Log training completion with metrics"""
        logger.info(f"╔══════════════════════════════════════════════════════════╗")
        logger.info(f"║ COMPLETED {model_type.upper()} MODEL TRAINING")
        logger.info(f"║ Student: {student_id}")
        logger.info(f"║ Training samples: {metadata.get('samples', 0)}")
        logger.info(f"║ Final loss: {metadata.get('final_loss', 'N/A')}")
        logger.info(f"║ Final MAE: {metadata.get('final_mae', 'N/A')}")
        logger.info(f"║ Test MAE: {metadata.get('test_mae', 'N/A')}")
        logger.info(f"║ Epochs completed: {metadata.get('epochs_completed', 0)}")
        logger.info(f"║ Timestamp: {metadata.get('timestamp', 'N/A')}")
        logger.info(f"╚══════════════════════════════════════════════════════════╝")

    # ==================== PRACTICE DIFFICULTY MODEL ====================

    def train_practice_model(self, student_id: str) -> Dict[str, Any]:
        """
        Train practice difficulty model with enhanced error handling and validation
        """
        training_id = f"practice_{student_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        logger.info(f"[{training_id}] Starting practice model training for student {student_id}")

        try:
            if self._is_practice_cancelled(student_id):
                logger.info(f"[{training_id}] Practice training cancelled before start for {student_id}")
                return {
                    'success': False,
                    'cancelled': True,
                    'error': 'Training cancelled',
                    'training_id': training_id
                }

            # Get data manager
            data_manager = self._get_data_manager(student_id)

            # Check if we have enough data
            practice_df = data_manager.load_practice_features()
            if practice_df.empty:
                logger.warning(f"[{training_id}] No practice features found for student {student_id}")
                return {
                    'success': False,
                    'error': 'No practice features found',
                    'training_id': training_id
                }

            logger.info(f"[{training_id}] Loaded {len(practice_df)} practice feature rows")

            # Prepare training data
            training_data = data_manager.prepare_practice_training_data(
                self.config.MIN_PRACTICE_SAMPLES
            )

            if training_data is None:
                logger.warning(f"[{training_id}] Insufficient training data. Need at least {self.config.MIN_PRACTICE_SAMPLES} samples")
                return {
                    'success': False,
                    'error': f'Insufficient training data. Need at least {self.config.MIN_PRACTICE_SAMPLES} samples',
                    'training_id': training_id
                }

            # Log training start
            self._log_training_start(student_id, 'practice', len(training_data['X_train']))

            # Initialize model
            logger.info(f"[{training_id}] Initializing PracticeDifficultyModel with sequence_length={self.config.SEQUENCE_LENGTH_PRACTICE}, n_features={self.config.PRACTICE_FEATURES_COUNT}")
            model = PracticeDifficultyModel(
                sequence_length=self.config.SEQUENCE_LENGTH_PRACTICE,
                n_features=self.config.PRACTICE_FEATURES_COUNT
            )

            # Build model
            logger.info(f"[{training_id}] Building model architecture")
            model.build_model()
            logger.info(f"[{training_id}] Model built successfully")

            # Get model path
            model_path = data_manager.get_model_path('practice_difficulty')
            logger.info(f"[{training_id}] Model will be saved to: {model_path}")

            # Train model with timing
            logger.info(f"[{training_id}] Starting training with epochs={self.config.EPOCHS}, batch_size={self.config.BATCH_SIZE}")
            start_time = time.time()

            history = model.train(
                X_train=training_data['X_train'],
                y_train=training_data['y_train'],
                X_val=training_data.get('X_val'),
                y_val=training_data.get('y_val'),
                epochs=self.config.EPOCHS,
                batch_size=self.config.BATCH_SIZE,
                model_path=None,  # Don't save yet, we'll save after evaluation
                verbose=0  # Keep logs clean
            )

            training_time = time.time() - start_time
            logger.info(f"[{training_id}] Training completed in {training_time:.2f} seconds")

            if self._is_practice_cancelled(student_id):
                logger.info(f"[{training_id}] Practice training cancelled after fit; skipping save for {student_id}")
                return {
                    'success': False,
                    'cancelled': True,
                    'error': 'Training cancelled after fit',
                    'training_id': training_id
                }

            # Save model
            logger.info(f"[{training_id}] Saving model to {model_path}")
            model.save(model_path)
            logger.info(f"[{training_id}] Model saved successfully")

            # Evaluate on test set if available
            test_loss, test_mae = None, None
            if training_data.get('X_test') is not None and len(training_data['X_test']) > 0:
                logger.info(f"[{training_id}] Evaluating on test set ({len(training_data['X_test'])} samples)")
                evaluation = model.model.evaluate(
                    training_data['X_test'],
                    training_data['y_test'],
                    verbose=0
                )

                # Handle different return formats
                if isinstance(evaluation, list):
                    test_loss = float(evaluation[0])
                    test_mae = float(evaluation[1]) if len(evaluation) > 1 else None
                else:
                    test_loss = float(evaluation)

                logger.info(f"[{training_id}] Test evaluation - Loss: {test_loss:.4f}, MAE: {test_mae if test_mae else 'N/A'}")

            # Prepare metadata
            metadata = {
                'training_id': training_id,
                'timestamp': datetime.now().isoformat(),
                'training_time_seconds': round(training_time, 2),
                'feature_rows_at_training': int(len(practice_df)),
                'samples': int(len(training_data['X_train'])),
                'val_samples': int(len(training_data.get('X_val', []))) if training_data.get('X_val') is not None else 0,
                'test_samples': int(len(training_data.get('X_test', []))) if training_data.get('X_test') is not None else 0,
                'final_loss': float(history.history['loss'][-1]),
                'final_mae': float(history.history['mae'][-1]) if 'mae' in history.history else None,
                'test_loss': float(test_loss) if test_loss else None,
                'test_mae': float(test_mae) if test_mae else None,
                'epochs_completed': int(len(history.history['loss'])),
                'feature_names': training_data.get('feature_names', []),
                'model_architecture': 'Bidirectional LSTM with Batch Normalization',
                'sequence_length': self.config.SEQUENCE_LENGTH_PRACTICE,
                'n_features': self.config.PRACTICE_FEATURES_COUNT
            }

            # Save metadata
            data_manager.save_model_metadata('practice_difficulty', metadata)
            logger.info(f"[{training_id}] Training metadata saved")

            # Log completion
            self._log_training_complete(student_id, 'practice', metadata)

            # Update training history
            if student_id not in self.training_history:
                self.training_history[student_id] = []
            self.training_history[student_id].append({
                'model_type': 'practice',
                'timestamp': datetime.now().isoformat(),
                'metadata': metadata
            })

            return {
                'success': True,
                'metadata': metadata,
                'training_id': training_id
            }

        except Exception as e:
            error_msg = f"Practice model training error: {str(e)}"
            logger.error(f"[{training_id}] {error_msg}")
            logger.error(f"[{training_id}] Traceback: {traceback.format_exc()}")
            return {
                'success': False,
                'error': error_msg,
                'training_id': training_id
            }

    def train_practice_model_async(self, student_id: str) -> bool:
        """
        Train practice model asynchronously with job tracking
        """
        logger.info(f"Requesting async practice training for student {student_id}")

        # Clear cancel flag when a new explicit training request is accepted
        self.training_jobs[student_id] = self.training_jobs.get(student_id, {})
        self.training_jobs[student_id]['practice_cancelled'] = False

        # Check if training is already in progress
        if student_id in self.training_jobs:
            job_info = self.training_jobs[student_id]
            if job_info.get('practice_in_progress', False):
                logger.info(f"Practice training already in progress for {student_id} (started at {job_info.get('practice_start_time', 'unknown')})")
                return False

        def _train():
            """Internal training function"""
            thread_id = threading.current_thread().name
            logger.info(f"[Thread:{thread_id}] Starting async practice training for {student_id}")

            try:
                # Update job status
                self.training_jobs[student_id] = self.training_jobs.get(student_id, {})
                self.training_jobs[student_id]['practice_in_progress'] = True
                self.training_jobs[student_id]['practice_start_time'] = datetime.now().isoformat()

                # Perform training
                logger.info(f"[Thread:{thread_id}] Executing practice model training")
                result = self.train_practice_model(student_id)

                # Update job with results
                self.training_jobs[student_id]['practice_result'] = result
                self.training_jobs[student_id]['practice_completed_time'] = datetime.now().isoformat()

                if result.get('success'):
                    logger.info(f"[Thread:{thread_id}] Practice training completed successfully for {student_id}")
                    logger.info(f"[Thread:{thread_id}] Final MAE: {result.get('metadata', {}).get('test_mae', 'N/A')}")
                else:
                    logger.warning(f"[Thread:{thread_id}] Practice training failed for {student_id}: {result.get('error')}")

            except Exception as e:
                logger.error(f"[Thread:{thread_id}] Unhandled exception in async training: {e}")
                logger.error(f"[Thread:{thread_id}] Traceback: {traceback.format_exc()}")
                self.training_jobs[student_id]['practice_result'] = {
                    'success': False,
                    'error': str(e)
                }
            finally:
                # Always mark as not in progress
                self.training_jobs[student_id]['practice_in_progress'] = False
                logger.info(f"[Thread:{thread_id}] Async practice training finished for {student_id}")

        # Start training thread
        thread = threading.Thread(target=_train, name=f"Train-{student_id}-{datetime.now().strftime('%H%M%S')}")
        thread.daemon = True
        thread.start()

        logger.info(f"Started async practice training for {student_id} in thread {thread.name}")
        return True

    # ==================== GLOBAL FEATURES GENERATION ====================

    def generate_global_features(self, student_id: str) -> Dict[str, Any]:
        """
        Generate global features from practice data with validation
        """
        logger.info(f"Generating global features for student {student_id}")

        try:
            data_manager = self._get_data_manager(student_id)
            practice_df = data_manager.load_practice_features()

            if practice_df.empty:
                logger.warning(f"No practice data found for student {student_id}")
                return {
                    'success': False,
                    'error': 'No practice data found',
                    'generated': False
                }

            logger.info(f"Loaded {len(practice_df)} practice feature rows for global feature generation")

            # Check if we have enough data for global features
            min_global_samples = getattr(self.config, 'MIN_PRACTICE_SAMPLES_FOR_GLOBAL', 40)
            if len(practice_df) < min_global_samples:
                logger.info(f"Insufficient data for global features: {len(practice_df)} < {min_global_samples}")
                return {
                    'success': False,
                    'error': f'Need at least {min_global_samples} samples for global features',
                    'current_samples': len(practice_df),
                    'generated': False
                }

            # Compute global features
            logger.info("Computing global features from practice data")
            feature_service = FeatureEngineeringService()
            global_df = feature_service.compute_global_features(practice_df)

            if global_df.empty:
                logger.warning("Global feature computation returned empty DataFrame")
                return {
                    'success': False,
                    'error': 'Global feature computation failed',
                    'generated': False
                }

            # Save global features
            logger.info(f"Saving {len(global_df)} global feature rows")
            data_manager.save_global_features(global_df)

            # Also try to train global model if we have enough data
            if len(global_df) >= self.config.SEQUENCE_LENGTH_GLOBAL + 2:
                logger.info("Sufficient global data for model training, triggering async training")
                self.train_global_model_async(student_id)

            result = {
                'success': True,
                'generated': True,
                'rows_generated': len(global_df),
                'sessions_processed': len(global_df['session_id'].unique()) if 'session_id' in global_df.columns else 0
            }

            logger.info(f"Global features generated successfully: {result}")
            return result

        except Exception as e:
            logger.error(f"Error generating global features: {e}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return {
                'success': False,
                'error': str(e),
                'generated': False
            }

    def generate_global_features_async(self, student_id: str) -> bool:
        """
        Generate global features asynchronously
        """
        logger.info(f"Requesting async global feature generation for student {student_id}")

        def _generate():
            thread_id = threading.current_thread().name
            logger.info(f"[Thread:{thread_id}] Starting async global feature generation for {student_id}")

            try:
                result = self.generate_global_features(student_id)
                logger.info(f"[Thread:{thread_id}] Global feature generation completed: {result}")
            except Exception as e:
                logger.error(f"[Thread:{thread_id}] Error in global feature generation: {e}")

        thread = threading.Thread(target=_generate, name=f"Global-{student_id}-{datetime.now().strftime('%H%M%S')}")
        thread.daemon = True
        thread.start()

        logger.info(f"Started async global feature generation for {student_id} in thread {thread.name}")
        return True

    # ==================== GLOBAL MODEL TRAINING ====================

    def train_global_model(self, student_id: str) -> Dict[str, Any]:
        """
        Train global readiness model
        """
        training_id = f"global_{student_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        logger.info(f"[{training_id}] Starting global model training for student {student_id}")

        try:
            data_manager = self._get_data_manager(student_id)
            global_df = data_manager.load_global_features()

            if global_df.empty or len(global_df) < self.config.SEQUENCE_LENGTH_GLOBAL + 2:
                logger.warning(f"[{training_id}] Insufficient global data: {len(global_df) if not global_df.empty else 0}")
                return {
                    'success': False,
                    'error': 'Insufficient global data for training',
                    'training_id': training_id
                }

            logger.info(f"[{training_id}] Loaded {len(global_df)} global feature rows")

            # Prepare sequences for global model
            from config import Config
            feature_cols = Config.GLOBAL_FEATURES

            available_cols = [col for col in feature_cols if col in global_df.columns]
            if len(available_cols) < 8:
                logger.warning(f"[{training_id}] Insufficient feature columns: {available_cols}")
                return {
                    'success': False,
                    'error': 'Insufficient feature columns',
                    'training_id': training_id
                }

            # Create sequences
            X, y = [], []
            data_values = global_df[available_cols].values.astype(np.float32)
            target_values = global_df[Config.GLOBAL_TARGET].values.astype(np.float32)

            seq_length = self.config.SEQUENCE_LENGTH_GLOBAL

            for i in range(len(data_values) - seq_length):
                X.append(data_values[i:i + seq_length])
                y.append(target_values[i + seq_length])

            if len(X) < 3:
                logger.warning(f"[{training_id}] Insufficient sequences: {len(X)}")
                return {
                    'success': False,
                    'error': 'Insufficient sequences for training',
                    'training_id': training_id
                }

            X, y = np.array(X), np.array(y)
            logger.info(f"[{training_id}] Created {len(X)} training sequences")

            # Split data
            n = len(X)
            split = int(n * 0.8)
            X_train, X_test = X[:split], X[split:]
            y_train, y_test = y[:split], y[split:]

            # Initialize and train model
            from models.global_readiness import GlobalReadinessModel
            model = GlobalReadinessModel(
                sequence_length=seq_length,
                n_features=len(available_cols)
            )

            model.build_model()
            model_path = data_manager.get_model_path('global_readiness')

            history = model.train(
                X_train=X_train,
                y_train=y_train,
                X_val=X_test,
                y_val=y_test,
                epochs=min(self.config.EPOCHS, 30),
                batch_size=16,
                model_path=model_path,
                verbose=0
            )

            # Evaluate
            test_loss, test_mae = model.model.evaluate(X_test, y_test, verbose=0)

            metadata = {
                'training_id': training_id,
                'timestamp': datetime.now().isoformat(),
                'samples': len(X_train),
                'test_samples': len(X_test),
                'final_loss': float(history.history['loss'][-1]),
                'test_loss': float(test_loss),
                'test_mae': float(test_mae) if test_mae else None,
                'epochs_completed': len(history.history['loss']),
                'feature_names': available_cols
            }

            data_manager.save_model_metadata('global_readiness', metadata)
            logger.info(f"[{training_id}] Global model training completed successfully")

            return {
                'success': True,
                'metadata': metadata,
                'training_id': training_id
            }

        except Exception as e:
            logger.error(f"[{training_id}] Global model training error: {e}")
            logger.error(f"[{training_id}] Traceback: {traceback.format_exc()}")
            return {
                'success': False,
                'error': str(e),
                'training_id': training_id
            }

    def train_global_model_async(self, student_id: str) -> bool:
        """
        Train global model asynchronously
        """
        logger.info(f"Requesting async global model training for student {student_id}")

        def _train():
            thread_id = threading.current_thread().name
            logger.info(f"[Thread:{thread_id}] Starting async global training for {student_id}")

            try:
                self.training_jobs[student_id] = self.training_jobs.get(student_id, {})
                self.training_jobs[student_id]['global_in_progress'] = True

                result = self.train_global_model(student_id)

                self.training_jobs[student_id]['global_result'] = result
                logger.info(f"[Thread:{thread_id}] Global training completed: {result.get('success')}")

            except Exception as e:
                logger.error(f"[Thread:{thread_id}] Error in global training: {e}")
            finally:
                self.training_jobs[student_id]['global_in_progress'] = False

        thread = threading.Thread(target=_train, name=f"GlobalTrain-{student_id}-{datetime.now().strftime('%H%M%S')}")
        thread.daemon = True
        thread.start()

        return True

    # ==================== EXAM DIFFICULTY MODEL ====================

    def train_exam_model(self, student_id: str) -> Dict[str, Any]:
        """
        Train exam difficulty model
        """
        training_id = f"exam_{student_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        logger.info(f"[{training_id}] Starting exam model training for student {student_id}")

        try:
            data_manager = self._get_data_manager(student_id)

            # Check if we have exam data
            exam_df = data_manager.load_exam_features()
            if exam_df.empty:
                logger.warning(f"[{training_id}] No exam features found")
                return {
                    'success': False,
                    'error': 'No exam features found',
                    'training_id': training_id
                }

            logger.info(f"[{training_id}] Loaded {len(exam_df)} exam feature rows")

            # Prepare training data
            training_data = data_manager.prepare_exam_training_data(
                self.config.MIN_EXAM_SAMPLES
            )

            if training_data is None:
                logger.warning(f"[{training_id}] Insufficient exam data")
                return {
                    'success': False,
                    'error': f'Insufficient exam data. Need at least {self.config.MIN_EXAM_SAMPLES} samples',
                    'training_id': training_id
                }

            # Initialize and train model
            model = ExamDifficultyModel(
                sequence_length=self.config.SEQUENCE_LENGTH_EXAM,
                n_features=self.config.EXAM_FEATURES
            )

            model.build_model()
            model_path = data_manager.get_model_path('exam_difficulty')

            history = model.train(
                X_train=training_data['X_train'],
                y_train=training_data['y_train'],
                X_val=training_data.get('X_val'),
                y_val=training_data.get('y_val'),
                epochs=min(self.config.EPOCHS, 50),
                batch_size=16,
                model_path=model_path,
                verbose=0
            )

            # Save metadata
            metadata = {
                'training_id': training_id,
                'timestamp': datetime.now().isoformat(),
                'samples': len(training_data['X_train']),
                'val_samples': len(training_data.get('X_val', [])) if training_data.get('X_val') is not None else 0,
                'final_loss': float(history.history['loss'][-1]),
                'final_mae': float(history.history['mae'][-1]) if 'mae' in history.history else None,
                'epochs_completed': len(history.history['loss']),
                'feature_names': training_data['feature_names']
            }

            data_manager.save_model_metadata('exam_difficulty', metadata)
            logger.info(f"[{training_id}] Exam model training completed")

            return {
                'success': True,
                'metadata': metadata,
                'training_id': training_id
            }

        except Exception as e:
            logger.error(f"[{training_id}] Exam model training error: {e}")
            logger.error(f"[{training_id}] Traceback: {traceback.format_exc()}")
            return {
                'success': False,
                'error': str(e),
                'training_id': training_id
            }

    def train_exam_model_async(self, student_id: str) -> bool:
        """
        Train exam model asynchronously
        """
        logger.info(f"Requesting async exam training for student {student_id}")

        def _train():
            thread_id = threading.current_thread().name
            logger.info(f"[Thread:{thread_id}] Starting async exam training for {student_id}")

            try:
                self.training_jobs[student_id] = self.training_jobs.get(student_id, {})
                self.training_jobs[student_id]['exam_in_progress'] = True

                result = self.train_exam_model(student_id)

                self.training_jobs[student_id]['exam_result'] = result
                logger.info(f"[Thread:{thread_id}] Exam training completed: {result.get('success')}")

            except Exception as e:
                logger.error(f"[Thread:{thread_id}] Error in exam training: {e}")
            finally:
                self.training_jobs[student_id]['exam_in_progress'] = False

        thread = threading.Thread(target=_train, name=f"ExamTrain-{student_id}-{datetime.now().strftime('%H%M%S')}")
        thread.daemon = True
        thread.start()

        return True

    # ==================== LEARNING VELOCITY MODEL ====================

    def train_learning_velocity_model(self, student_id: str, concept: str) -> Dict[str, Any]:
        """
        Train learning velocity model for a specific concept
        """
        training_id = f"velocity_{student_id}_{concept}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        logger.info(f"[{training_id}] Starting learning velocity model training for student {student_id}, concept: {concept}")

        try:
            data_manager = self._get_data_manager(student_id)
            concept_features = data_manager.load_concept_features()

            if concept not in concept_features:
                logger.warning(f"[{training_id}] No data found for concept {concept}")
                return {
                    'success': False,
                    'error': f'No data for concept {concept}',
                    'training_id': training_id
                }

            feat = concept_features[concept]
            history = feat.get('concept_mastery_history', [])

            logger.info(f"[{training_id}] Concept mastery history length: {len(history)}")

            if len(history) < self.config.SEQUENCE_LENGTH_DAILY + 5:
                logger.warning(f"[{training_id}] Insufficient history: {len(history)} < {self.config.SEQUENCE_LENGTH_DAILY + 5}")
                return {
                    'success': False,
                    'error': f'Insufficient history. Need at least {self.config.SEQUENCE_LENGTH_DAILY + 5} points',
                    'training_id': training_id
                }

            # Prepare training data
            X, y = [], []
            for i in range(len(history) - self.config.SEQUENCE_LENGTH_DAILY):
                seq = history[i:i + self.config.SEQUENCE_LENGTH_DAILY]
                feature_seq = []
                for mastery in seq:
                    feature_seq.append([
                        float(mastery),
                        float(feat.get('practice_frequency', 1.0)),
                        float(feat.get('revision_gap', 0.5)),
                        float(feat.get('avg_difficulty', 0.6)),
                        float(feat.get('success_rate', 0.7)),
                        float(feat.get('retention', 0.8)),
                        float(feat.get('time_spent', 30)),
                        float(feat.get('improvement_rate', 0.1)),
                        float(feat.get('confidence_growth', 0.6))
                    ])
                X.append(feature_seq)
                y.append(history[i + self.config.SEQUENCE_LENGTH_DAILY])

            logger.info(f"[{training_id}] Created {len(X)} training sequences")

            if len(X) < 5:
                logger.warning(f"[{training_id}] Insufficient sequences: {len(X)} < 5")
                return {
                    'success': False,
                    'error': 'Insufficient sequences for training',
                    'training_id': training_id
                }

            X = np.array(X, dtype=np.float32)
            y = np.array(y, dtype=np.float32)

            # Split data
            split = int(len(X) * 0.8)
            X_train, X_test = X[:split], X[split:]
            y_train, y_test = y[:split], y[split:]

            # Train model
            model = LearningVelocityModel(
                sequence_length=self.config.SEQUENCE_LENGTH_DAILY,
                n_features=self.config.LEARNING_VELOCITY_FEATURES
            )

            model.build_model()

            concept_model_path = os.path.join(
                data_manager.get_model_path('learning_velocity'),
                concept.replace(' ', '_').replace('/', '_')
            )
            os.makedirs(concept_model_path, exist_ok=True)

            history = model.train(
                X_train, y_train,
                X_val=X_test, y_val=y_test,
                epochs=min(self.config.EPOCHS, 50),
                batch_size=16,
                model_path=concept_model_path,
                verbose=0
            )

            # Evaluate
            test_loss, test_mae = model.model.evaluate(X_test, y_test, verbose=0)

            # Save metadata
            metadata = {
                'training_id': training_id,
                'timestamp': datetime.now().isoformat(),
                'concept': concept,
                'samples': len(X_train),
                'test_samples': len(X_test),
                'final_loss': float(history.history['loss'][-1]),
                'final_mae': float(history.history['mae'][-1]) if 'mae' in history.history else None,
                'test_loss': float(test_loss),
                'test_mae': float(test_mae) if test_mae else None,
                'epochs_completed': len(history.history['loss'])
            }

            data_manager.save_model_metadata(f'learning_velocity_{concept}', metadata)

            logger.info(f"[{training_id}] Learning velocity model training completed for concept {concept}")

            return {
                'success': True,
                'metadata': metadata,
                'training_id': training_id
            }

        except Exception as e:
            logger.error(f"[{training_id}] Learning velocity training error: {e}")
            logger.error(f"[{training_id}] Traceback: {traceback.format_exc()}")
            return {
                'success': False,
                'error': str(e),
                'training_id': training_id
            }

    # ==================== BURNOUT RISK MODEL ====================

    def train_burnout_risk_model(self, student_id: str) -> Dict[str, Any]:
        """
        Train burnout risk model
        """
        training_id = f"burnout_{student_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        logger.info(f"[{training_id}] Starting burnout risk model training for student {student_id}")

        try:
            data_manager = self._get_data_manager(student_id)
            practice_df = data_manager.load_practice_features()

            if practice_df.empty or len(practice_df) < 50:
                logger.warning(f"[{training_id}] Insufficient practice data: {len(practice_df) if not practice_df.empty else 0}")
                return {
                    'success': False,
                    'error': 'Insufficient practice data for burnout model',
                    'training_id': training_id
                }

            # Create session features and synthetic labels
            sessions = []
            if 'session_id' in practice_df.columns:
                unique_sessions = practice_df['session_id'].unique()
                logger.info(f"[{training_id}] Processing {len(unique_sessions)} sessions for burnout training")

                for session_id in unique_sessions:
                    session_data = practice_df[practice_df['session_id'] == session_id].sort_values('timestamp')

                    if len(session_data) >= 5:
                        # Extract features for this session
                        try:
                            features = [
                                float(session_data['accuracy'].mean()),
                                float(session_data['accuracy'].diff().mean()) if len(session_data) > 1 else 0,
                                float(session_data['stress_score'].diff().mean()) if 'stress_score' in session_data.columns and len(session_data) > 1 else 0,
                                float(session_data['normalized_response_time'].diff().mean()) if 'normalized_response_time' in session_data.columns and len(session_data) > 1 else 0,
                                float(session_data['fatigue_indicator'].iloc[-1] - session_data['fatigue_indicator'].iloc[0]) if 'fatigue_indicator' in session_data.columns and len(session_data) > 1 else 0,
                                float(session_data['time_spent'].sum() / 60) if 'time_spent' in session_data.columns else 10,
                                1.0,  # days_without_break placeholder
                                float(session_data[session_data['current_question_difficulty'] > 0.7]['accuracy'].mean()) if 'current_question_difficulty' in session_data.columns and len(session_data[session_data['current_question_difficulty'] > 0.7]) > 0 else 0.5,
                                float(1 - session_data['accuracy'].std()) if len(session_data) > 1 else 0.5,
                                float(session_data['confidence_index'].diff().mean()) if 'confidence_index' in session_data.columns and len(session_data) > 1 else 0,
                                float((session_data['time_spent'] < 5).mean()) if 'time_spent' in session_data.columns else 0,
                                float(session_data['accuracy'].iloc[-len(session_data)//2:].mean() - session_data['accuracy'].iloc[:len(session_data)//2].mean()) if len(session_data) >= 4 else 0
                            ]

                            # Synthetic label (simplified - in production, use actual burnout labels)
                            fatigue_high = session_data['fatigue_indicator'].iloc[-1] > 0.7 if 'fatigue_indicator' in session_data.columns else False
                            accuracy_dropping = (session_data['accuracy'].iloc[-3:].mean() < session_data['accuracy'].iloc[:3].mean()) if len(session_data) >= 6 else False
                            label = 1 if (fatigue_high and accuracy_dropping) else 0

                            sessions.append({
                                'features': features,
                                'label': label
                            })
                        except Exception as e:
                            logger.debug(f"[{training_id}] Error processing session {session_id}: {e}")
                            continue

            if len(sessions) < 10:
                logger.warning(f"[{training_id}] Insufficient sessions for burnout training: {len(sessions)} < 10")
                return {
                    'success': False,
                    'error': f'Insufficient sessions. Need at least 10, got {len(sessions)}',
                    'training_id': training_id
                }

            logger.info(f"[{training_id}] Created {len(sessions)} session records for training")

            # Prepare sequences
            X = np.array([s['features'] for s in sessions], dtype=np.float32)
            y = np.array([s['label'] for s in sessions], dtype=np.float32)

            # Create sequences
            model = BurnoutRiskModel(
                sequence_length=self.config.SEQUENCE_LENGTH_SESSION,
                n_features=self.config.BURNOUT_RISK_FEATURES
            )

            X_seq, y_seq = model.prepare_sequences(X, y)

            if len(X_seq) < 5:
                logger.warning(f"[{training_id}] Insufficient sequences after preparation: {len(X_seq)} < 5")
                return {
                    'success': False,
                    'error': f'Insufficient sequences after preparation. Got {len(X_seq)}',
                    'training_id': training_id
                }

            logger.info(f"[{training_id}] Created {len(X_seq)} training sequences")

            # Split data
            split = int(len(X_seq) * 0.8)
            X_train, X_test = X_seq[:split], X_seq[split:]
            y_train, y_test = y_seq[:split], y_seq[split:]

            # Build and train model
            model.build_model()
            model_path = data_manager.get_model_path('burnout_risk')

            history = model.train(
                X_train, y_train,
                X_val=X_test, y_val=y_test,
                epochs=min(self.config.EPOCHS, 50),
                batch_size=16,
                model_path=model_path,
                verbose=0
            )

            # Evaluate
            evaluation = model.model.evaluate(X_test, y_test, verbose=0)
            if isinstance(evaluation, list):
                test_loss = float(evaluation[0])
                test_accuracy = float(evaluation[1]) if len(evaluation) > 1 else None
            else:
                test_loss = float(evaluation)
                test_accuracy = None

            # Save metadata
            metadata = {
                'training_id': training_id,
                'timestamp': datetime.now().isoformat(),
                'samples': len(X_train),
                'test_samples': len(X_test),
                'final_loss': float(history.history['loss'][-1]),
                'final_accuracy': float(history.history['accuracy'][-1]) if 'accuracy' in history.history else None,
                'test_loss': test_loss,
                'test_accuracy': test_accuracy,
                'epochs_completed': len(history.history['loss'])
            }

            data_manager.save_model_metadata('burnout_risk', metadata)

            logger.info(f"[{training_id}] Burnout risk model training completed")

            return {
                'success': True,
                'metadata': metadata,
                'training_id': training_id
            }

        except Exception as e:
            logger.error(f"[{training_id}] Burnout risk training error: {e}")
            logger.error(f"[{training_id}] Traceback: {traceback.format_exc()}")
            return {
                'success': False,
                'error': str(e),
                'training_id': training_id
            }

    # ==================== ADAPTIVE SCHEDULING MODEL ====================

    def train_adaptive_scheduling_model(self, student_id: str) -> Dict[str, Any]:
        """
        Train adaptive scheduling model for concept prioritization
        """
        training_id = f"schedule_{student_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        logger.info(f"[{training_id}] Starting adaptive scheduling model training for student {student_id}")

        try:
            data_manager = self._get_data_manager(student_id)
            concept_features = data_manager.load_concept_features()

            if not concept_features or len(concept_features) < 3:
                logger.warning(f"[{training_id}] Insufficient concept data: {len(concept_features)} concepts")
                return {
                    'success': False,
                    'error': f'Insufficient concept data. Need at least 3 concepts, got {len(concept_features)}',
                    'training_id': training_id
                }

            logger.info(f"[{training_id}] Loaded features for {len(concept_features)} concepts")

            # Prepare training data (simplified - in production, use actual priority labels)
            X = []
            y = []  # Priority scores (would come from actual user interactions)

            for concept, feat in concept_features.items():
                # Create feature vector for this concept
                feature_vector = [
                    float(feat.get('accuracy', 0.5)),
                    float(feat.get('exam_weight', 0.5)),
                    float(feat.get('avg_difficulty', 0.5)) * 2,
                    float(feat.get('learning_velocity', 0)),
                    float(feat.get('stability', 0.5)),
                    float(feat.get('readiness', 0.5))
                ]

                # Pad to 13 features
                while len(feature_vector) < 13:
                    feature_vector.append(0.5)

                # Create synthetic priority score (in production, use actual user data)
                priority = (
                    (1 - feat.get('accuracy', 0.5)) * 0.4 +
                    feat.get('exam_weight', 0.5) * 0.3 +
                    (feat.get('days_since_last_practice', 0) / 30) * 0.3
                )
                priority = min(1.0, max(0.0, priority))

                X.append(feature_vector)
                y.append(priority)

            X = np.array(X, dtype=np.float32)
            y = np.array(y, dtype=np.float32)

            logger.info(f"[{training_id}] Created {len(X)} training samples")

            # Split data
            split = int(len(X) * 0.8)
            X_train, X_test = X[:split], X[split:]
            y_train, y_test = y[:split], y[split:]

            # Reshape for LSTM (add sequence dimension)
            X_train = X_train.reshape(-1, 1, X_train.shape[1])
            X_test = X_test.reshape(-1, 1, X_test.shape[1])

            # Train model
            model = AdaptiveSchedulingModel(
                sequence_length=1,  # Single time point for now
                n_features=X.shape[1]
            )

            model.build_model()
            model_path = data_manager.get_model_path('adaptive_scheduling')

            history = model.train(
                X_train, y_train,
                X_val=X_test, y_val=y_test,
                epochs=min(self.config.EPOCHS, 30),
                batch_size=8,
                model_path=model_path,
                verbose=0
            )

            # Evaluate
            test_loss, test_mae = model.model.evaluate(X_test, y_test, verbose=0)

            metadata = {
                'training_id': training_id,
                'timestamp': datetime.now().isoformat(),
                'samples': len(X_train),
                'test_samples': len(X_test),
                'concepts_trained': len(concept_features),
                'final_loss': float(history.history['loss'][-1]),
                'final_mae': float(history.history['mae'][-1]) if 'mae' in history.history else None,
                'test_loss': float(test_loss),
                'test_mae': float(test_mae) if test_mae else None,
                'epochs_completed': len(history.history['loss'])
            }

            data_manager.save_model_metadata('adaptive_scheduling', metadata)

            logger.info(f"[{training_id}] Adaptive scheduling model training completed")

            return {
                'success': True,
                'metadata': metadata,
                'training_id': training_id
            }

        except Exception as e:
            logger.error(f"[{training_id}] Adaptive scheduling training error: {e}")
            logger.error(f"[{training_id}] Traceback: {traceback.format_exc()}")
            return {
                'success': False,
                'error': str(e),
                'training_id': training_id
            }

    # ==================== TRAINING STATUS AND MANAGEMENT ====================

    def get_training_status(self, student_id: str) -> Dict[str, Any]:
        """
        Get comprehensive training status for a student
        """
        logger.info(f"Getting training status for student {student_id}")

        try:
            status = self.training_jobs.get(student_id, {})
            data_manager = self._get_data_manager(student_id)

            # Load metadata from disk
            practice_meta = data_manager.load_model_metadata('practice_difficulty')
            exam_meta = data_manager.load_model_metadata('exam_difficulty')
            global_meta = data_manager.load_model_metadata('global_readiness') if hasattr(data_manager, 'load_model_metadata') else []
            burnout_meta = data_manager.load_model_metadata('burnout_risk')
            schedule_meta = data_manager.load_model_metadata('adaptive_scheduling')

            # Get feature counts
            practice_df = data_manager.load_practice_features()
            global_df = data_manager.load_global_features() if hasattr(data_manager, 'load_global_features') else pd.DataFrame()
            exam_df = data_manager.load_exam_features()

            status['data_summary'] = {
                'practice_features': len(practice_df),
                'global_features': len(global_df),
                'exam_features': len(exam_df),
                'practice_threshold': self.config.MIN_PRACTICE_SAMPLES,
                'global_threshold': getattr(self.config, 'MIN_PRACTICE_SAMPLES_FOR_GLOBAL', 40),
                'exam_threshold': self.config.MIN_EXAM_SAMPLES
            }

            status['models'] = {
                'practice': {
                    'trained': len(practice_meta) > 0,
                    'last_trained': practice_meta[-1]['timestamp'] if practice_meta else None,
                    'performance': practice_meta[-1].get('test_mae', practice_meta[-1].get('final_mae')) if practice_meta else None,
                    'in_progress': status.get('practice_in_progress', False),
                    'training_count': len(practice_meta)
                },
                'global': {
                    'trained': len(global_meta) > 0,
                    'last_trained': global_meta[-1]['timestamp'] if global_meta else None,
                    'performance': global_meta[-1].get('test_mae', None) if global_meta else None,
                    'in_progress': status.get('global_in_progress', False),
                    'training_count': len(global_meta)
                },
                'exam': {
                    'trained': len(exam_meta) > 0,
                    'last_trained': exam_meta[-1]['timestamp'] if exam_meta else None,
                    'performance': exam_meta[-1].get('final_mae', None) if exam_meta else None,
                    'in_progress': status.get('exam_in_progress', False),
                    'training_count': len(exam_meta)
                },
                'burnout': {
                    'trained': len(burnout_meta) > 0,
                    'last_trained': burnout_meta[-1]['timestamp'] if burnout_meta else None,
                    'performance': burnout_meta[-1].get('test_accuracy', None) if burnout_meta else None,
                    'in_progress': False,
                    'training_count': len(burnout_meta)
                },
                'scheduling': {
                    'trained': len(schedule_meta) > 0,
                    'last_trained': schedule_meta[-1]['timestamp'] if schedule_meta else None,
                    'performance': schedule_meta[-1].get('test_mae', None) if schedule_meta else None,
                    'in_progress': False,
                    'training_count': len(schedule_meta)
                }
            }

            # Add concept-specific velocity models
            concept_features = data_manager.load_concept_features()
            velocity_models = {}
            for concept in concept_features.keys():
                concept_key = concept.replace(' ', '_').replace('/', '_')
                velocity_meta = data_manager.load_model_metadata(f'learning_velocity_{concept}')
                if velocity_meta:
                    velocity_models[concept] = {
                        'trained': True,
                        'last_trained': velocity_meta[-1]['timestamp'] if velocity_meta else None,
                        'performance': velocity_meta[-1].get('test_mae', None) if velocity_meta else None
                    }

            status['models']['learning_velocity'] = velocity_models

            logger.info(f"Training status retrieved for {student_id}")
            return status

        except Exception as e:
            logger.error(f"Error getting training status: {e}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return {
                'error': str(e),
                'models': {},
                'data_summary': {}
            }

    def cancel_training(self, student_id: str, model_type: str = None) -> Dict[str, Any]:
        """
        Cancel ongoing training for a student
        """
        logger.info(f"Cancelling training for student {student_id}, model: {model_type if model_type else 'all'}")

        if student_id not in self.training_jobs:
            return {
                'success': False,
                'error': f'No training jobs found for student {student_id}'
            }

        cancelled = []

        if model_type is None or model_type == 'practice':
            if self.training_jobs[student_id].get('practice_in_progress', False):
                self.training_jobs[student_id]['practice_in_progress'] = False
                cancelled.append('practice')
                logger.info(f"Cancelled practice training for {student_id}")

        if model_type is None or model_type == 'exam':
            if self.training_jobs[student_id].get('exam_in_progress', False):
                self.training_jobs[student_id]['exam_in_progress'] = False
                cancelled.append('exam')
                logger.info(f"Cancelled exam training for {student_id}")

        if model_type is None or model_type == 'global':
            if self.training_jobs[student_id].get('global_in_progress', False):
                self.training_jobs[student_id]['global_in_progress'] = False
                cancelled.append('global')
                logger.info(f"Cancelled global training for {student_id}")

        return {
            'success': True,
            'cancelled': cancelled,
            'message': f"Cancelled training for: {', '.join(cancelled)}" if cancelled else "No active training found"
        }

    def get_training_history(self, student_id: str, model_type: str = None, limit: int = 10) -> List[Dict]:
        """
        Get training history for a student
        """
        logger.info(f"Getting training history for student {student_id}, model: {model_type if model_type else 'all'}")

        history = []

        try:
            data_manager = self._get_data_manager(student_id)

            if model_type is None or model_type == 'practice':
                practice_meta = data_manager.load_model_metadata('practice_difficulty')
                for meta in practice_meta[-limit:]:
                    meta['model_type'] = 'practice'
                    history.append(meta)

            if model_type is None or model_type == 'exam':
                exam_meta = data_manager.load_model_metadata('exam_difficulty')
                for meta in exam_meta[-limit:]:
                    meta['model_type'] = 'exam'
                    history.append(meta)

            if model_type is None or model_type == 'global':
                global_meta = data_manager.load_model_metadata('global_readiness') if hasattr(data_manager, 'load_model_metadata') else []
                for meta in global_meta[-limit:]:
                    meta['model_type'] = 'global'
                    history.append(meta)

            if model_type is None or model_type == 'burnout':
                burnout_meta = data_manager.load_model_metadata('burnout_risk')
                for meta in burnout_meta[-limit:]:
                    meta['model_type'] = 'burnout'
                    history.append(meta)

            if model_type is None or model_type == 'scheduling':
                schedule_meta = data_manager.load_model_metadata('adaptive_scheduling')
                for meta in schedule_meta[-limit:]:
                    meta['model_type'] = 'scheduling'
                    history.append(meta)

            # Sort by timestamp descending
            history.sort(key=lambda x: x.get('timestamp', ''), reverse=True)

            logger.info(f"Retrieved {len(history)} training history entries")
            return history[:limit]

        except Exception as e:
            logger.error(f"Error getting training history: {e}")
            return []
