import os
import json
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Union
from datetime import datetime, timedelta
import logging
import traceback
import hashlib

logger = logging.getLogger(__name__)

class StudentDataManager:
    """
    Manages student data storage - ONLY stores processed features and targets in CSV format.
    No raw data is ever stored. All data is validated, rounded, and optimized.
    """

    # Feature file names
    PRACTICE_FEATURES_FILE = 'practice_features.csv'
    GLOBAL_FEATURES_FILE = 'global_features.csv'
    EXAM_FEATURES_FILE = 'exam_features.csv'
    CONCEPT_FEATURES_FILE = 'concept_features.csv'

    def __init__(self, base_dir: str, student_id: str):
        """
        Initialize data manager for a specific student.

        Args:
            base_dir: Base directory for all student data
            student_id: Unique student identifier
        """
        self.base_dir = base_dir
        self.student_id = student_id
        self.student_dir = os.path.join(base_dir, student_id)

        logger.info(f"Initializing StudentDataManager for {student_id} at {self.student_dir}")

        # Create subdirectories for organized storage
        self.dirs = {
            'features': os.path.join(self.student_dir, 'features'),
            'models': os.path.join(self.student_dir, 'models'),
            'cache': os.path.join(self.student_dir, 'cache'),
            'metrics': os.path.join(self.student_dir, 'metrics')
        }

        # Create all directories
        for dir_path in self.dirs.values():
            os.makedirs(dir_path, exist_ok=True)
            logger.debug(f"Created directory: {dir_path}")

        # Track data statistics
        self._data_stats = {}

    def get_model_path(self, model_name: str) -> str:
        """
        Get path for model directory.

        Args:
            model_name: Name of the model

        Returns:
            Path to model directory
        """
        model_path = os.path.join(self.dirs['models'], model_name)
        os.makedirs(model_path, exist_ok=True)
        return model_path

    # ==================== PRACTICE FEATURES STORAGE ====================

    def save_practice_features(self, features_df: pd.DataFrame, merge_with_existing: bool = True) -> bool:
        """
        Save practice features DataFrame to CSV - ONLY feature columns and target.

        Args:
            features_df: DataFrame with computed practice features

        Returns:
            True if successful, False otherwise
        """
        if features_df.empty:
            logger.warning(f"Attempted to save empty practice features for {self.student_id}")
            return False

        filepath = os.path.join(self.dirs['features'], self.PRACTICE_FEATURES_FILE)
        logger.info(f"Saving {len(features_df)} practice feature rows for {self.student_id}")

        try:
            from config import Config
            feature_cols = Config.PRACTICE_FEATURES
            target_col = Config.PRACTICE_TARGET

            # Validate that we have the required columns
            required_cols = feature_cols + [target_col]
            missing_cols = [col for col in required_cols if col not in features_df.columns]

            if missing_cols:
                logger.error(f"Missing required columns: {missing_cols}")
                return False

            # Create a copy with only required columns
            df_to_save = features_df[required_cols].copy()

            # Validate and clean data
            df_to_save = self._validate_and_clean_features(df_to_save, feature_cols + [target_col])

            # Generate data hash for integrity checking
            data_hash = self._generate_data_hash(df_to_save)

            # Check if file exists and merge appropriately
            if merge_with_existing and os.path.exists(filepath):
                existing_df = pd.read_csv(filepath)

                # Validate existing data
                existing_df = self._validate_and_clean_features(existing_df, feature_cols + [target_col])

                # Merge, remove duplicates, and sort
                merged_df = pd.concat([existing_df, df_to_save], ignore_index=True)
                merged_df = merged_df.drop_duplicates(keep='last')

                # Sort by index or timestamp if available
                if 'timestamp' in merged_df.columns:
                    merged_df = merged_df.sort_values('timestamp')

                logger.debug(f"Merged with existing data. Previous rows: {len(existing_df)}, New total: {len(merged_df)}")
            else:
                merged_df = df_to_save
                logger.debug(f"Creating new practice features file")

            # Final validation and rounding
            for col in merged_df.columns:
                merged_df[col] = pd.to_numeric(merged_df[col], errors='coerce').fillna(0.5)
                merged_df[col] = merged_df[col].clip(0, 1).round(2)

            # Save to CSV
            merged_df.to_csv(filepath, index=False, float_format='%.2f')

            # Save data hash for verification
            self._save_data_hash('practice_features', data_hash, len(merged_df))

            logger.info(f"Successfully saved {len(df_to_save)} new practice feature rows. Total: {len(merged_df)}")
            return True

        except Exception as e:
            logger.error(f"Error saving practice features: {e}\n{traceback.format_exc()}")
            return False

    def load_practice_features(self) -> pd.DataFrame:
        """
        Load practice features DataFrame from CSV.

        Returns:
            DataFrame with practice features, empty DataFrame if not found
        """
        filepath = os.path.join(self.dirs['features'], self.PRACTICE_FEATURES_FILE)

        try:
            if os.path.exists(filepath):
                df = pd.read_csv(filepath)

                # Validate and clean loaded data
                from config import Config
                feature_cols = Config.PRACTICE_FEATURES
                target_col = Config.PRACTICE_TARGET

                # Ensure all expected columns exist
                expected_cols = feature_cols + [target_col]
                for col in expected_cols:
                    if col not in df.columns:
                        df[col] = 0.5
                        logger.debug(f"Added missing column '{col}' with default values")

                # Clean data
                df = self._validate_and_clean_features(df, expected_cols)

                logger.debug(f"Loaded {len(df)} practice feature rows from {filepath}")
                return df
            else:
                logger.debug(f"No practice features file found at {filepath}")
                return pd.DataFrame()

        except Exception as e:
            logger.error(f"Error loading practice features: {e}")
            return pd.DataFrame()

    def append_practice_attempts_as_features(self, attempts: List[Dict[str, Any]]) -> Dict[str, int]:
        """
        Convert incoming attempt events directly into 12 practice features + 1 target rows,
        then append to practice_features.csv.

        This path stores ONLY processed features and target, never raw attempts.

        Args:
            attempts: List of attempt dictionaries

        Returns:
            Dict with added_rows and total_rows
        """
        from config import Config

        if not attempts:
            return {'added_rows': 0, 'total_rows': len(self.load_practice_features())}

        existing_df = self.load_practice_features()
        feature_cols = Config.PRACTICE_FEATURES
        target_col = Config.PRACTICE_TARGET

        existing_records = (
            existing_df[feature_cols + [target_col]].to_dict('records')
            if not existing_df.empty else []
        )

        previous_streak = float(existing_records[-1].get('consecutive_correct_streak', 0.0)) if existing_records else 0.0
        previous_mastery = float(existing_records[-1].get('concept_mastery_score', 0.5)) if existing_records else 0.5
        previous_fatigue = float(existing_records[-1].get('fatigue_indicator', 0.0)) if existing_records else 0.0

        recent_norm_times = [
            float(r.get('normalized_response_time', 0.5))
            for r in existing_records[-5:]
        ]

        new_rows: List[Dict[str, float]] = []

        # Set previous stored row's target to next observed difficulty
        first_attempt = attempts[0] if attempts else {}
        first_difficulty = float(first_attempt.get('difficulty', first_attempt.get('current_question_difficulty', 0.5)) or 0.5)
        first_difficulty = float(np.clip(first_difficulty, 0.2, 0.95))

        if existing_records:
            existing_records[-1][target_col] = first_difficulty

        for attempt in attempts:
            raw_correct = attempt.get('correct', attempt.get('isCorrect', False))
            accuracy = 1.0 if bool(raw_correct) else 0.0

            raw_time = attempt.get('time_spent', attempt.get('timeSpent', 0.0))
            time_spent = float(pd.to_numeric(raw_time, errors='coerce')) if raw_time is not None else 0.0
            time_spent = float(np.clip(np.nan_to_num(time_spent, nan=0.0), 1.0, 300.0))

            difficulty = float(attempt.get('difficulty', attempt.get('current_question_difficulty', 0.5)) or 0.5)
            difficulty = float(np.clip(difficulty, 0.2, 0.95))

            confidence = float(attempt.get('confidence', 0.5) or 0.5)
            confidence = float(np.clip(confidence, 0.0, 1.0))

            answer_changes = attempt.get('answer_changes', attempt.get('answerChanges', attempt.get('answer_changed', False)))
            if isinstance(answer_changes, bool):
                answer_change_count = 1.0 if answer_changes else 0.0
            else:
                answer_change_count = float(pd.to_numeric(answer_changes, errors='coerce'))
                answer_change_count = float(np.nan_to_num(answer_change_count, nan=0.0))
            answer_change_count = float(np.clip(answer_change_count, 0.0, 5.0))

            # Feature 2: normalized_response_time (scaled to 0-1)
            normalized_response_time = float(np.clip((time_spent / 90.0), 0.0, 1.0))

            # Feature 3: rolling_time_variance
            variance_source = recent_norm_times + [normalized_response_time]
            if len(variance_source) > 5:
                variance_source = variance_source[-5:]
            rolling_time_variance = float(np.clip(np.var(variance_source), 0.0, 1.0))
            recent_norm_times = variance_source

            # Feature 5: stress_score
            stress_score = float(np.clip((1.0 - accuracy) * 0.6 + normalized_response_time * 0.4, 0.0, 1.0))

            # Feature 6: confidence_index
            confidence_index = confidence

            # Feature 7: concept_mastery_score (EWMA)
            concept_mastery_score = float(np.clip(0.2 * accuracy + 0.8 * previous_mastery, 0.0, 1.0))
            previous_mastery = concept_mastery_score

            # Feature 9: consecutive_correct_streak
            if accuracy >= 0.5:
                previous_streak = min(10.0, previous_streak + 1.0)
            else:
                previous_streak = 0.0
            consecutive_correct_streak = float(np.clip(previous_streak * (0.5 + 0.5 * difficulty), 0.0, 1.0))

            # Feature 10: fatigue_indicator (progressive session fatigue)
            fatigue_indicator = float(np.clip(previous_fatigue * 0.7 + (len(existing_records) + len(new_rows) + 1) / 40.0 * 0.3, 0.0, 1.0))
            previous_fatigue = fatigue_indicator

            # Feature 11: focus_loss_frequency
            focus_loss_frequency = float(np.clip((1.0 if time_spent > 120 else 0.0) * 0.6 +
                                                 (1.0 if (answer_change_count > 0 and confidence < 0.6) else 0.0) * 0.4, 0.0, 1.0))

            # Feature 12: preferred_difficulty_offset
            preferred_difficulty_offset = float(np.clip((difficulty - concept_mastery_score + 1.0) / 2.0, 0.0, 1.0))

            row = {
                'accuracy': float(np.clip(accuracy, 0.0, 1.0)),
                'normalized_response_time': normalized_response_time,
                'rolling_time_variance': rolling_time_variance,
                'answer_change_count': float(np.clip(answer_change_count / 5.0, 0.0, 1.0)),
                'stress_score': stress_score,
                'confidence_index': confidence_index,
                'concept_mastery_score': concept_mastery_score,
                'current_question_difficulty': float(np.clip(difficulty, 0.0, 1.0)),
                'consecutive_correct_streak': consecutive_correct_streak,
                'fatigue_indicator': fatigue_indicator,
                'focus_loss_frequency': focus_loss_frequency,
                'preferred_difficulty_offset': preferred_difficulty_offset,
                target_col: float(np.clip(difficulty, 0.0, 1.0))
            }

            # Ensure previous newly-created row gets this attempt's difficulty as target
            if new_rows:
                new_rows[-1][target_col] = row['current_question_difficulty']

            new_rows.append(row)

        merged_df = pd.DataFrame(existing_records + new_rows)
        # merged_df already includes existing + new rows, so write directly without
        # re-merging with file contents to avoid duplicate appends.
        save_ok = self.save_practice_features(merged_df, merge_with_existing=False)

        total_rows = len(self.load_practice_features()) if save_ok else len(existing_df)
        return {
            'added_rows': len(new_rows) if save_ok else 0,
            'total_rows': total_rows
        }

    # ==================== GLOBAL FEATURES STORAGE ====================

    def save_global_features(self, features_df: pd.DataFrame) -> bool:
        """
        Save global features DataFrame to CSV.

        Args:
            features_df: DataFrame with computed global features

        Returns:
            True if successful, False otherwise
        """
        if features_df.empty:
            logger.warning(f"Attempted to save empty global features for {self.student_id}")
            return False

        filepath = os.path.join(self.dirs['features'], self.GLOBAL_FEATURES_FILE)
        logger.info(f"Saving {len(features_df)} global feature rows for {self.student_id}")

        try:
            from config import Config
            feature_cols = Config.GLOBAL_FEATURES
            target_col = Config.GLOBAL_TARGET

            # Required columns including session_id and target
            required_cols = feature_cols + [target_col, 'session_id']
            missing_cols = [col for col in required_cols if col not in features_df.columns]

            if missing_cols:
                logger.error(f"Missing required columns: {missing_cols}")
                return False

            # Create copy with required columns
            df_to_save = features_df[required_cols].copy()

            # Clean and validate
            for col in df_to_save.columns:
                if col != 'session_id':
                    df_to_save[col] = pd.to_numeric(df_to_save[col], errors='coerce').fillna(0.5)
                    df_to_save[col] = df_to_save[col].clip(0, 1).round(2)

            # Handle merging with existing data
            if os.path.exists(filepath):
                existing_df = pd.read_csv(filepath)

                # Merge based on session_id to avoid duplicates
                merged_df = pd.concat([existing_df, df_to_save], ignore_index=True)
                merged_df = merged_df.drop_duplicates(subset=['session_id'], keep='last')

                logger.debug(f"Merged with existing data. Previous rows: {len(existing_df)}")
            else:
                merged_df = df_to_save
                logger.debug(f"Creating new global features file")

            # Save to CSV
            merged_df.to_csv(filepath, index=False, float_format='%.2f')

            logger.info(f"Successfully saved {len(df_to_save)} global feature rows. Total: {len(merged_df)}")
            return True

        except Exception as e:
            logger.error(f"Error saving global features: {e}\n{traceback.format_exc()}")
            return False

    def load_global_features(self) -> pd.DataFrame:
        """
        Load global features DataFrame from CSV.

        Returns:
            DataFrame with global features, empty DataFrame if not found
        """
        filepath = os.path.join(self.dirs['features'], self.GLOBAL_FEATURES_FILE)

        try:
            if os.path.exists(filepath):
                df = pd.read_csv(filepath)
                logger.debug(f"Loaded {len(df)} global feature rows from {filepath}")
                return df
            return pd.DataFrame()
        except Exception as e:
            logger.error(f"Error loading global features: {e}")
            return pd.DataFrame()

    # ==================== CONCEPT FEATURES STORAGE ====================

    def save_concept_features(self, concept_data: Dict[str, Dict]) -> bool:
        """
        Save per-concept features to CSV.

        Args:
            concept_data: Dictionary mapping concept names to feature dictionaries

        Returns:
            True if successful, False otherwise
        """
        if not concept_data:
            logger.warning(f"Attempted to save empty concept features for {self.student_id}")
            return False

        filepath = os.path.join(self.dirs['features'], self.CONCEPT_FEATURES_FILE)
        logger.info(f"Saving concept features for {len(concept_data)} concepts")

        try:
            rows = []
            for concept, features in concept_data.items():
                row = {'concept': concept}

                for key, value in features.items():
                    if isinstance(value, list):
                        # Store only last 20 values as JSON string to keep file size manageable
                        if len(value) > 20:
                            value = value[-20:]
                        row[key] = json.dumps([round(float(v), 2) for v in value])
                    elif isinstance(value, (int, float)):
                        row[key] = round(float(value), 2)
                    else:
                        row[key] = str(value)

                rows.append(row)

            df = pd.DataFrame(rows)

            # Handle merging with existing data
            if os.path.exists(filepath):
                existing_df = pd.read_csv(filepath)
                merged_df = pd.concat([existing_df, df], ignore_index=True)
                merged_df = merged_df.drop_duplicates(subset=['concept'], keep='last')
            else:
                merged_df = df

            merged_df.to_csv(filepath, index=False)
            logger.info(f"Saved concept features for {len(rows)} concepts")
            return True

        except Exception as e:
            logger.error(f"Error saving concept features: {e}\n{traceback.format_exc()}")
            return False

    def load_concept_features(self) -> Dict[str, Dict]:
        """
        Load per-concept features from CSV.

        Returns:
            Dictionary mapping concept names to feature dictionaries
        """
        filepath = os.path.join(self.dirs['features'], self.CONCEPT_FEATURES_FILE)

        try:
            if os.path.exists(filepath):
                df = pd.read_csv(filepath)
                concept_data = {}

                for _, row in df.iterrows():
                    concept = row['concept']
                    data = {}

                    for col in df.columns:
                        if col != 'concept':
                            val = row[col]

                            # Parse JSON strings back to lists
                            if isinstance(val, str) and val.startswith('['):
                                try:
                                    data[col] = json.loads(val)
                                except:
                                    data[col] = []
                            else:
                                try:
                                    data[col] = float(val) if pd.notna(val) else 0.5
                                except:
                                    data[col] = val

                    concept_data[concept] = data

                logger.debug(f"Loaded concept features for {len(concept_data)} concepts")
                return concept_data

            return {}

        except Exception as e:
            logger.error(f"Error loading concept features: {e}")
            return {}

    # ==================== EXAM FEATURES STORAGE ====================

    def save_exam_features(self, features_df: pd.DataFrame) -> bool:
        """
        Save exam features DataFrame to CSV.

        Args:
            features_df: DataFrame with exam features

        Returns:
            True if successful, False otherwise
        """
        if features_df.empty:
            return False

        filepath = os.path.join(self.dirs['features'], self.EXAM_FEATURES_FILE)

        try:
            # Round all float columns
            for col in features_df.select_dtypes(include=[np.float64, np.float32]).columns:
                features_df[col] = features_df[col].round(2)

            # Handle merging with existing data
            if os.path.exists(filepath):
                existing_df = pd.read_csv(filepath)
                merged_df = pd.concat([existing_df, features_df], ignore_index=True)
                merged_df = merged_df.drop_duplicates(keep='last')
            else:
                merged_df = features_df

            merged_df.to_csv(filepath, index=False, float_format='%.2f')
            logger.info(f"Saved {len(features_df)} exam feature rows")
            return True

        except Exception as e:
            logger.error(f"Error saving exam features: {e}")
            return False

    def load_exam_features(self) -> pd.DataFrame:
        """
        Load exam features DataFrame from CSV.

        Returns:
            DataFrame with exam features
        """
        filepath = os.path.join(self.dirs['features'], self.EXAM_FEATURES_FILE)

        try:
            if os.path.exists(filepath):
                return pd.read_csv(filepath)
            return pd.DataFrame()
        except Exception as e:
            logger.error(f"Error loading exam features: {e}")
            return pd.DataFrame()

    # ==================== MODEL METADATA STORAGE ====================

    def save_model_metadata(self, model_name: str, metadata: Dict[str, Any]) -> bool:
        """
        Save model training metadata (JSON format for flexibility).

        Args:
            model_name: Name of the model
            metadata: Dictionary of metadata

        Returns:
            True if successful, False otherwise
        """
        filepath = os.path.join(self.dirs['models'], f'{model_name}_metadata.json')

        try:
            history = []
            if os.path.exists(filepath):
                with open(filepath, 'r') as f:
                    history = json.load(f)

            # Add timestamp if not present
            if 'timestamp' not in metadata:
                metadata['timestamp'] = datetime.now().isoformat()

            # Round float values for consistency
            for key, value in metadata.items():
                if isinstance(value, float):
                    metadata[key] = round(value, 4)

            history.append(metadata)

            # Keep only last 20 entries to manage file size
            if len(history) > 20:
                history = history[-20:]

            with open(filepath, 'w') as f:
                json.dump(history, f, indent=2)

            logger.debug(f"Saved metadata for model {model_name}")
            return True

        except Exception as e:
            logger.error(f"Error saving model metadata: {e}")
            return False

    def load_model_metadata(self, model_name: str) -> List[Dict[str, Any]]:
        """
        Load model training history.

        Args:
            model_name: Name of the model

        Returns:
            List of metadata dictionaries
        """
        filepath = os.path.join(self.dirs['models'], f'{model_name}_metadata.json')

        try:
            if os.path.exists(filepath):
                with open(filepath, 'r') as f:
                    return json.load(f)
            return []
        except Exception as e:
            logger.error(f"Error loading model metadata: {e}")
            return []

    # ==================== DATA VALIDATION AND UTILITIES ====================

    def _validate_and_clean_features(self, df: pd.DataFrame, expected_cols: List[str]) -> pd.DataFrame:
        """
        Validate and clean feature DataFrame.

        Args:
            df: DataFrame to validate
            expected_cols: List of expected column names

        Returns:
            Cleaned DataFrame
        """
        # Ensure all expected columns exist
        for col in expected_cols:
            if col not in df.columns:
                df[col] = 0.5

        # Convert all columns to numeric where possible
        for col in df.columns:
            if col != 'session_id' and col != 'concept':
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0.5)
                df[col] = df[col].clip(0, 1).round(2)

        # Remove rows with all zeros (invalid data)
        numeric_cols = [col for col in df.columns if col not in ['session_id', 'concept']]
        if numeric_cols:
            df = df[~(df[numeric_cols] == 0).all(axis=1)]

        return df

    def _generate_data_hash(self, df: pd.DataFrame) -> str:
        """
        Generate a hash for data integrity verification.

        Args:
            df: DataFrame to hash

        Returns:
            SHA-256 hash of the data
        """
        # Create a string representation of the data
        data_str = df.to_string()
        return hashlib.sha256(data_str.encode()).hexdigest()

    def _save_data_hash(self, data_type: str, data_hash: str, row_count: int):
        """
        Save data hash for verification.

        Args:
            data_type: Type of data (e.g., 'practice_features')
            data_hash: SHA-256 hash
            row_count: Number of rows
        """
        hash_file = os.path.join(self.dirs['cache'], f'{data_type}_hash.json')

        try:
            hash_data = {
                'timestamp': datetime.now().isoformat(),
                'hash': data_hash,
                'row_count': row_count,
                'student_id': self.student_id
            }

            with open(hash_file, 'w') as f:
                json.dump(hash_data, f, indent=2)

        except Exception as e:
            logger.debug(f"Could not save hash file: {e}")

    # ==================== TRAINING DATA PREPARATION ====================

    def prepare_practice_training_data(self, min_samples: int = 10) -> Optional[Dict[str, Any]]:
        """
        Prepare training data for practice difficulty model.
        Only uses processed features, never raw data.

        Args:
            min_samples: Minimum number of samples required

        Returns:
            Dictionary with training data or None if insufficient
        """
        df = self.load_practice_features()

        logger.info(f"Preparing practice training data for {self.student_id}. Available samples: {len(df)}")

        if len(df) < min_samples:
            logger.warning(f"Insufficient practice data: {len(df)} < {min_samples}")
            return None

        from config import Config

        feature_cols = Config.PRACTICE_FEATURES
        target_col = Config.PRACTICE_TARGET

        # Verify all columns exist
        available_cols = [col for col in feature_cols if col in df.columns]
        if len(available_cols) < 10:
            logger.warning(f"Insufficient feature columns. Found: {available_cols}")
            return None

        # Extract data
        data_values = df[available_cols].values.astype(np.float32)
        target_values = df[target_col].values.astype(np.float32)

        seq_length = Config.SEQUENCE_LENGTH_PRACTICE

        # Create sequences
        X, y = [], []
        for i in range(len(data_values) - seq_length):
            X.append(data_values[i:i + seq_length])
            y.append(target_values[i + seq_length])

        if len(X) < 5:
            logger.warning(f"Insufficient sequences: {len(X)} < 5")
            return None

        X, y = np.array(X), np.array(y)
        logger.info(f"Created {len(X)} training sequences")

        # Split into train/val/test
        n = len(X)
        indices = np.random.permutation(n)
        train_end = int(n * 0.7)
        val_end = int(n * 0.85)

        train_idx = indices[:train_end]
        val_idx = indices[train_end:val_end] if val_end > train_end else []
        test_idx = indices[val_end:] if n > val_end else []

        result = {
            'X_train': X[train_idx],
            'y_train': y[train_idx],
            'feature_names': available_cols,
            'total_samples': len(X)
        }

        if len(val_idx) > 0:
            result['X_val'] = X[val_idx]
            result['y_val'] = y[val_idx]

        if len(test_idx) > 0:
            result['X_test'] = X[test_idx]
            result['y_test'] = y[test_idx]

        return result

    # ==================== DATA STATISTICS ====================

    def get_data_statistics(self) -> Dict[str, Any]:
        """
        Get statistics about stored data.

        Returns:
            Dictionary with data statistics
        """
        stats = {
            'student_id': self.student_id,
            'timestamp': datetime.now().isoformat(),
            'data_sizes': {}
        }

        # Check each feature file
        for file_name in [self.PRACTICE_FEATURES_FILE, self.GLOBAL_FEATURES_FILE,
                          self.EXAM_FEATURES_FILE, self.CONCEPT_FEATURES_FILE]:
            filepath = os.path.join(self.dirs['features'], file_name)
            if os.path.exists(filepath):
                try:
                    df = pd.read_csv(filepath)
                    stats['data_sizes'][file_name] = len(df)
                except:
                    stats['data_sizes'][file_name] = 0
            else:
                stats['data_sizes'][file_name] = 0

        # Check model metadata
        stats['models'] = {}
        models_dir = self.dirs['models']
        if os.path.exists(models_dir):
            for item in os.listdir(models_dir):
                if item.endswith('_metadata.json'):
                    model_name = item.replace('_metadata.json', '')
                    stats['models'][model_name] = True

        return stats

    def clear_cache(self):
        """Clear cache directory."""
        cache_dir = self.dirs['cache']
        if os.path.exists(cache_dir):
            for file in os.listdir(cache_dir):
                try:
                    os.remove(os.path.join(cache_dir, file))
                except:
                    pass
            logger.info(f"Cleared cache for {self.student_id}")

    def reset_practice_data(self) -> Dict[str, Any]:
        """
        Clear practice-related CSV/model artifacts for a fresh practice start.

        Returns:
            Dict containing list of cleared file paths.
        """
        cleared_files: List[str] = []

        practice_artifacts = [
            os.path.join(self.dirs['features'], self.PRACTICE_FEATURES_FILE),
            os.path.join(self.dirs['features'], self.GLOBAL_FEATURES_FILE),
            os.path.join(self.dirs['features'], self.CONCEPT_FEATURES_FILE),
            os.path.join(self.dirs['models'], 'practice_difficulty_metadata.json'),
            os.path.join(self.dirs['models'], 'practice_difficulty', 'practice_difficulty_model.h5'),
            os.path.join(self.dirs['models'], 'practice_difficulty', 'practice_difficulty_scaler_X.pkl'),
            os.path.join(self.dirs['models'], 'practice_difficulty', 'practice_difficulty_scaler_y.pkl'),
            os.path.join(self.dirs['models'], 'practice_difficulty', 'practice_difficulty_metadata.json'),
            os.path.join(self.dirs['cache'], 'practice_features_hash.json'),
        ]

        for path in practice_artifacts:
            try:
                if os.path.exists(path):
                    os.remove(path)
                    cleared_files.append(path)
            except Exception as e:
                logger.warning(f"Could not remove artifact {path}: {e}")

        # Cleanup empty model subfolder if possible
        practice_model_dir = os.path.join(self.dirs['models'], 'practice_difficulty')
        try:
            if os.path.isdir(practice_model_dir) and not os.listdir(practice_model_dir):
                os.rmdir(practice_model_dir)
        except Exception:
            pass

        logger.info(f"Reset practice data for {self.student_id}. Cleared files: {len(cleared_files)}")
        return {'cleared_files': cleared_files}
