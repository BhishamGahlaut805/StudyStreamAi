import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from scipy import stats
from scipy.signal import savgol_filter
import logging
import traceback
import warnings
warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)

class FeatureEngineeringService:
    """
    Advanced feature engineering service that transforms raw attempt data into
    sophisticated learning analytics features. Only produces processed features,
    never stores raw data.
    """

    # Class constants for feature computation
    RESPONSE_TIME_LOWER_BOUND = 1.0  # seconds
    RESPONSE_TIME_UPPER_BOUND = 300.0  # seconds
    SESSION_GAP_THRESHOLD = 1800  # 30 minutes in seconds
    CONFIDENCE_SCALE_FACTOR = 0.7
    EXPONENTIAL_DECAY_FACTOR = 10.0
    ROLLING_WINDOWS = [3, 5, 10]

    @staticmethod
    def _series_or_default(df: pd.DataFrame, column: str, default_value: float = 0.0) -> pd.Series:
        """Return numeric series for a column or a default-filled series."""
        if column in df.columns:
            return pd.to_numeric(df[column], errors='coerce').fillna(default_value)
        if len(df) == 0:
            return pd.Series(dtype=float)
        return pd.Series([default_value] * len(df), index=df.index, dtype=float)

    @staticmethod
    def _safe_mean(series: pd.Series, fallback: float = 0.0) -> float:
        """Return safe float mean for a pandas series."""
        if series is None or len(series) == 0:
            return float(fallback)
        value = pd.to_numeric(series, errors='coerce').dropna()
        if len(value) == 0:
            return float(fallback)
        return float(value.mean())

    @staticmethod
    def compute_performance_metrics(practice_df: pd.DataFrame, exam_df: pd.DataFrame) -> Dict[str, Any]:
        """
        Compute dashboard-ready performance metrics.

        Expected output keys are consumed by `blueprints/dashboard.py`:
        - practice: total_questions, overall_accuracy, recent_accuracy, avg_difficulty, fatigue_level
        - exam: total_exams, avg_score
        - overall: readiness_score, burnout_risk
        - concepts: topic-wise aggregates
        """
        try:
            practice_df = practice_df.copy() if isinstance(practice_df, pd.DataFrame) else pd.DataFrame()
            exam_df = exam_df.copy() if isinstance(exam_df, pd.DataFrame) else pd.DataFrame()

            # ---------- Practice metrics ----------
            total_questions = int(len(practice_df))

            if 'accuracy' in practice_df.columns:
                accuracy_series = FeatureEngineeringService._series_or_default(practice_df, 'accuracy', 0.0)
            elif 'correct' in practice_df.columns:
                accuracy_series = FeatureEngineeringService._series_or_default(practice_df, 'correct', 0.0)
            else:
                accuracy_series = FeatureEngineeringService._series_or_default(practice_df, 'is_correct', 0.0)

            difficulty_series = FeatureEngineeringService._series_or_default(
                practice_df,
                'current_question_difficulty' if 'current_question_difficulty' in practice_df.columns else 'difficulty',
                0.5,
            )

            fatigue_series = FeatureEngineeringService._series_or_default(practice_df, 'fatigue_indicator', 0.0)
            stress_series = FeatureEngineeringService._series_or_default(practice_df, 'stress_score', 0.0)

            overall_accuracy = FeatureEngineeringService._safe_mean(accuracy_series, 0.0)
            recent_accuracy = FeatureEngineeringService._safe_mean(accuracy_series.tail(20), overall_accuracy)
            avg_difficulty = FeatureEngineeringService._safe_mean(difficulty_series, 0.5)
            fatigue_level = FeatureEngineeringService._safe_mean(fatigue_series.tail(20), 0.0)

            practice_metrics = {
                'total_questions': total_questions,
                'overall_accuracy': round(overall_accuracy, 4),
                'recent_accuracy': round(recent_accuracy, 4),
                'avg_difficulty': round(avg_difficulty, 4),
                'fatigue_level': round(fatigue_level, 4),
                'stress_level': round(FeatureEngineeringService._safe_mean(stress_series.tail(20), 0.0), 4),
            }

            # ---------- Exam metrics ----------
            total_exams = int(len(exam_df))
            exam_score_column = None
            for col in ['score', 'accuracy', 'exam_score', 'final_score']:
                if col in exam_df.columns:
                    exam_score_column = col
                    break

            exam_score_series = (
                FeatureEngineeringService._series_or_default(exam_df, exam_score_column, 0.0)
                if exam_score_column
                else pd.Series(dtype=float)
            )

            avg_score = FeatureEngineeringService._safe_mean(exam_score_series, 0.0)
            exam_metrics = {
                'total_exams': total_exams,
                'avg_score': round(avg_score, 4),
            }

            # ---------- Concept metrics ----------
            concept_key = 'concept' if 'concept' in practice_df.columns else 'topic' if 'topic' in practice_df.columns else None
            concepts = []
            if concept_key and len(practice_df) > 0:
                grouped = practice_df.groupby(concept_key)
                for concept_name, group in grouped:
                    group_acc = FeatureEngineeringService._series_or_default(group, 'accuracy', 0.0)
                    if len(group_acc) == 0 and 'correct' in group.columns:
                        group_acc = FeatureEngineeringService._series_or_default(group, 'correct', 0.0)
                    group_diff = FeatureEngineeringService._series_or_default(
                        group,
                        'current_question_difficulty' if 'current_question_difficulty' in group.columns else 'difficulty',
                        0.5,
                    )

                    concepts.append({
                        'concept': str(concept_name),
                        'attempts': int(len(group)),
                        'accuracy': round(FeatureEngineeringService._safe_mean(group_acc, 0.0), 4),
                        'avg_difficulty': round(FeatureEngineeringService._safe_mean(group_diff, 0.5), 4),
                    })

                concepts = sorted(concepts, key=lambda item: item['attempts'], reverse=True)

            # ---------- Overall metrics ----------
            readiness_score = (
                0.55 * practice_metrics['recent_accuracy']
                + 0.25 * max(0.0, 1.0 - abs(practice_metrics['avg_difficulty'] - 0.6))
                + 0.20 * (1.0 - practice_metrics['fatigue_level'])
            )
            readiness_score = float(np.clip(readiness_score, 0.0, 1.0))

            burnout_risk = (
                0.5 * practice_metrics['fatigue_level']
                + 0.3 * practice_metrics['stress_level']
                + 0.2 * max(0.0, 1.0 - practice_metrics['recent_accuracy'])
            )
            burnout_risk = float(np.clip(burnout_risk, 0.0, 1.0))

            return {
                'practice': practice_metrics,
                'exam': exam_metrics,
                'overall': {
                    'readiness_score': round(readiness_score, 4),
                    'burnout_risk': round(burnout_risk, 4),
                },
                'concepts': concepts,
            }

        except Exception as e:
            logger.error(f"Error computing performance metrics: {e}\n{traceback.format_exc()}")
            return {
                'practice': {
                    'total_questions': 0,
                    'overall_accuracy': 0.0,
                    'recent_accuracy': 0.0,
                    'avg_difficulty': 0.5,
                    'fatigue_level': 0.0,
                    'stress_level': 0.0,
                },
                'exam': {
                    'total_exams': 0,
                    'avg_score': 0.0,
                },
                'overall': {
                    'readiness_score': 0.5,
                    'burnout_risk': 0.3,
                },
                'concepts': [],
            }

    @staticmethod
    def compute_practice_features(attempts_data: List[Dict]) -> pd.DataFrame:
        """
        Transform raw attempt data into 12 sophisticated practice features.

        Args:
            attempts_data: List of dictionaries containing raw attempt data with keys:
                - timestamp: ISO format timestamp
                - correct: boolean indicating correctness
                - time_spent: seconds spent on question
                - difficulty: question difficulty (0-1)
                - confidence: student confidence (0-1)
                - answer_changed: boolean if answer was changed
                - concept: concept/topic name
                - session_id: optional session identifier

        Returns:
            DataFrame with 12 features + target, rounded to 2 decimals
        """
        if not attempts_data or len(attempts_data) < 3:
            logger.warning(f"Insufficient data for feature computation: {len(attempts_data) if attempts_data else 0} attempts")
            return pd.DataFrame()

        logger.info(f"Computing practice features from {len(attempts_data)} raw attempts")

        try:
            # Convert to DataFrame and preprocess
            df = FeatureEngineeringService._preprocess_raw_data(attempts_data)

            if df.empty or len(df) < 3:
                logger.warning("DataFrame empty after preprocessing")
                return pd.DataFrame()

            # Compute all 12 features sequentially
            df = FeatureEngineeringService._compute_accuracy_features(df)
            df = FeatureEngineeringService._compute_response_time_features(df)
            df = FeatureEngineeringService._compute_behavioral_features(df)
            df = FeatureEngineeringService._compute_mastery_features(df)
            df = FeatureEngineeringService._compute_fatigue_features(df)
            df = FeatureEngineeringService._compute_focus_features(df)
            df = FeatureEngineeringService._compute_difficulty_features(df)

            # Compute target (next difficulty)
            df = FeatureEngineeringService._compute_target(df)

            # Select only the 12 features and target
            from config import Config
            feature_cols = Config.PRACTICE_FEATURES
            target_col = Config.PRACTICE_TARGET

            # Ensure all feature columns exist
            for col in feature_cols:
                if col not in df.columns:
                    df[col] = 0.5
                    logger.debug(f"Added missing feature column: {col}")

            # Create result DataFrame with only features and target
            result_df = df[feature_cols + [target_col]].copy()

            # Final cleaning and rounding
            for col in result_df.columns:
                result_df[col] = pd.to_numeric(result_df[col], errors='coerce').fillna(0.5)
                result_df[col] = result_df[col].clip(0, 1).round(2)

            # Drop any rows with all zeros or invalid data
            result_df = result_df[~(result_df[feature_cols] == 0).all(axis=1)]

            logger.info(f"Successfully computed {len(result_df)} practice feature rows")
            logger.debug(f"Feature columns: {list(result_df.columns)}")

            return result_df

        except Exception as e:
            logger.error(f"Critical error in compute_practice_features: {e}\n{traceback.format_exc()}")
            return pd.DataFrame()

    @staticmethod
    def _preprocess_raw_data(attempts_data: List[Dict]) -> pd.DataFrame:
        """Preprocess raw attempt data with robust cleaning."""
        df = pd.DataFrame(attempts_data)

        # Ensure required columns
        required_cols = {
            'timestamp': lambda: datetime.now().isoformat(),
            'correct': lambda: False,
            'time_spent': lambda: 10.0,
            'difficulty': lambda: 0.5,
            'confidence': lambda: 0.5,
            'answer_changed': lambda: False,
            'concept': lambda: 'general',
            'session_id': lambda: f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        }

        for col, default_func in required_cols.items():
            if col not in df.columns:
                df[col] = default_func()
                logger.debug(f"Added missing column '{col}' with default values")

        # Convert and clean data types
        df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
        df['timestamp'] = df['timestamp'].fillna(pd.Timestamp.now())

        # Convert boolean columns
        df['correct'] = df['correct'].astype(bool)
        df['answer_changed'] = df['answer_changed'].astype(bool)

        # Clean numeric columns
        df['time_spent'] = pd.to_numeric(df['time_spent'], errors='coerce')
        df['time_spent'] = df['time_spent'].clip(
            FeatureEngineeringService.RESPONSE_TIME_LOWER_BOUND,
            FeatureEngineeringService.RESPONSE_TIME_UPPER_BOUND
        ).fillna(10.0)

        df['difficulty'] = pd.to_numeric(df['difficulty'], errors='coerce')
        df['difficulty'] = df['difficulty'].clip(0, 1).fillna(0.5)

        df['confidence'] = pd.to_numeric(df['confidence'], errors='coerce')
        df['confidence'] = df['confidence'].clip(0, 1).fillna(0.5)

        # Sort by timestamp
        df = df.sort_values('timestamp').reset_index(drop=True)

        logger.debug(f"Preprocessed DataFrame with {len(df)} rows and columns: {list(df.columns)}")
        return df

    @staticmethod
    def _compute_accuracy_features(df: pd.DataFrame) -> pd.DataFrame:
        """Compute accuracy-related features."""
        # Feature 1: accuracy (boolean to float)
        df['accuracy'] = df['correct'].astype(float)

        # Feature 9: consecutive_correct_streak with quality weighting
        df['correct_streak_group'] = (df['correct'] != df['correct'].shift()).cumsum()
        df['consecutive_correct_streak'] = df.groupby('correct_streak_group')['correct'].cumsum()

        # Reset streak when incorrect
        df.loc[~df['correct'], 'consecutive_correct_streak'] = 0

        # Add streak quality (difficulty of questions in streak)
        streak_diff = df.groupby('correct_streak_group')['difficulty'].transform('mean').fillna(0.5)
        df['consecutive_correct_streak'] = df['consecutive_correct_streak'] * (0.5 + 0.5 * streak_diff)
        df['consecutive_correct_streak'] = df['consecutive_correct_streak'].clip(0, 10)

        return df

    @staticmethod
    def _compute_response_time_features(df: pd.DataFrame) -> pd.DataFrame:
        """Compute response time related features."""
        # Feature 2: normalized_response_time
        rolling_mean = df['time_spent'].expanding().mean().fillna(df['time_spent'])
        df['normalized_response_time'] = df['time_spent'] / rolling_mean
        # Log transform for better distribution
        df['normalized_response_time'] = np.log1p(df['normalized_response_time'])
        df['normalized_response_time'] = df['normalized_response_time'].clip(0, 2)

        # Feature 3: rolling_time_variance (adaptive windows)
        time_variances = []
        for window in FeatureEngineeringService.ROLLING_WINDOWS:
            var = df['time_spent'].rolling(window, min_periods=1).var().fillna(0)
            time_variances.append(var)
        df['rolling_time_variance'] = np.mean(time_variances, axis=0)
        df['rolling_time_variance'] = df['rolling_time_variance'].clip(0, 100)

        return df

    @staticmethod
    def _compute_behavioral_features(df: pd.DataFrame) -> pd.DataFrame:
        """Compute behavioral features like answer changes and confidence."""
        # Feature 4: answer_change_count with recency weighting
        def weighted_answer_changes(x):
            if len(x) == 0:
                return 0
            # Exponential decay weighting (more recent = higher weight)
            weights = np.exp(-np.arange(len(x))[::-1] / 5)
            return np.sum(x * weights)

        df['answer_change_count'] = df['answer_changed'].rolling(10, min_periods=1).apply(
            lambda x: weighted_answer_changes(x) if len(x) > 0 else 0,
            raw=True
        ).fillna(0).clip(0, 5)

        # Feature 5: stress_score (combination of time pressure and accuracy stress)
        baseline_time = df['time_spent'].expanding().mean().fillna(df['time_spent'])
        time_ratio = df['time_spent'] / baseline_time
        accuracy_stress = 1 - df['accuracy'].rolling(5, min_periods=1).mean().fillna(0.5)
        df['stress_score'] = (time_ratio * 0.4 + accuracy_stress * 0.6).clip(0, 1)

        # Feature 6: confidence_index with calibration
        # Calculate correlation between confidence and accuracy over time
        confidence_acc_corr = df['confidence'].rolling(10, min_periods=1).corr(df['accuracy']).fillna(0)
        df['confidence_index'] = df['confidence'] * (
            FeatureEngineeringService.CONFIDENCE_SCALE_FACTOR +
            0.3 * confidence_acc_corr.abs()
        )
        df['confidence_index'] = df['confidence_index'].clip(0, 1)

        return df

    @staticmethod
    def _compute_mastery_features(df: pd.DataFrame) -> pd.DataFrame:
        """Compute concept mastery features."""
        # Feature 7: concept_mastery_score with exponential decay
        df['concept_mastery_score'] = 0.5  # default

        for concept in df['concept'].unique():
            mask = df['concept'] == concept
            concept_data = df.loc[mask].copy()

            if len(concept_data) == 0:
                continue

            # Calculate exponential weighted moving average
            alpha = 2 / (FeatureEngineeringService.EXPONENTIAL_DECAY_FACTOR + 1)
            mastery_values = []
            current_mastery = 0.5

            for idx in concept_data.index:
                accuracy = df.loc[idx, 'accuracy']
                # Update mastery with EWMA
                current_mastery = alpha * accuracy + (1 - alpha) * current_mastery
                mastery_values.append(current_mastery)

            df.loc[mask, 'concept_mastery_score'] = mastery_values

        df['concept_mastery_score'] = df['concept_mastery_score'].clip(0, 1)

        return df

    @staticmethod
    def _compute_fatigue_features(df: pd.DataFrame) -> pd.DataFrame:
        """Compute fatigue-related features."""
        # Feature 10: fatigue_indicator
        # Identify sessions (30-minute gaps)
        df['time_diff'] = df['timestamp'].diff().dt.total_seconds().fillna(0)
        df['new_session'] = (df['time_diff'] > FeatureEngineeringService.SESSION_GAP_THRESHOLD) | (df['time_diff'].isna())
        df['session_id_auto'] = df['new_session'].cumsum()

        # Calculate position in session
        df['questions_in_session'] = df.groupby('session_id_auto').cumcount() + 1
        max_q_per_session = df.groupby('session_id_auto')['questions_in_session'].transform('max').fillna(1)
        df['session_question_ratio'] = df['questions_in_session'] / max_q_per_session

        # Time of day factor (circadian rhythm)
        hour = df['timestamp'].dt.hour
        df['time_of_day_factor'] = np.sin(2 * np.pi * (hour - 6) / 24)  # Peak at 6 PM
        df['time_of_day_factor'] = (df['time_of_day_factor'] + 1) / 2  # Scale to 0-1

        # Accuracy decay within session
        df['accuracy_rolling'] = df['accuracy'].rolling(3, min_periods=1).mean().fillna(0.5)
        df['accuracy_decay'] = df.groupby('session_id_auto')['accuracy_rolling'].transform(
            lambda x: (x.iloc[-1] - x.iloc[0]) if len(x) > 1 else 0
        )

        # Combine factors into fatigue indicator
        df['fatigue_indicator'] = (
            df['session_question_ratio'] * 0.5 +
            (1 - df['time_of_day_factor']) * 0.25 +
            (1 - df['accuracy_decay'].clip(0, 1)) * 0.25
        ).clip(0, 1)

        return df

    @staticmethod
    def _compute_focus_features(df: pd.DataFrame) -> pd.DataFrame:
        """Compute focus loss features."""
        # Feature 11: focus_loss_frequency
        # Detect micro-breaks (unusual time spikes)
        time_ma = df['time_spent'].rolling(5, min_periods=1).mean().fillna(df['time_spent'])
        time_std = df['time_spent'].rolling(5, min_periods=1).std().fillna(0)
        df['time_anomaly'] = (df['time_spent'] > (time_ma + 2 * time_std)).astype(float)

        # Answer changes with doubt (low confidence)
        df['answer_change_with_doubt'] = (df['answer_changed'] & (df['confidence'] < 0.6)).astype(float)

        # Combined focus loss metric
        df['focus_loss_frequency'] = (
            df['time_anomaly'].rolling(5, min_periods=1).mean().fillna(0) * 0.6 +
            df['answer_change_with_doubt'].rolling(5, min_periods=1).mean().fillna(0) * 0.4
        )

        return df

    @staticmethod
    def _compute_difficulty_features(df: pd.DataFrame) -> pd.DataFrame:
        """Compute difficulty-related features."""
        # Feature 8: current_question_difficulty
        df['current_question_difficulty'] = df['difficulty']

        # Feature 12: preferred_difficulty_offset
        # Calculate optimal difficulty based on performance history
        optimal_diff = 0.5

        if len(df) >= 5:
            # Find difficulty range where user performs best (>60% accuracy)
            # Create 5 difficulty bins
            diff_bins = pd.cut(df['difficulty'], bins=5, labels=False)
            performance_by_bin = df.groupby(diff_bins)['accuracy'].mean()

            if not performance_by_bin.empty:
                best_bin = performance_by_bin.idxmax()
                # Convert bin index to approximate difficulty
                optimal_diff = (best_bin + 0.5) / 5  # Center of the bin

        df['preferred_difficulty_offset'] = df['difficulty'] - optimal_diff
        df['preferred_difficulty_offset'] = df['preferred_difficulty_offset'].clip(-0.5, 0.5)

        return df

    @staticmethod
    def _compute_target(df: pd.DataFrame) -> pd.DataFrame:
        """Compute target variable (next_difficulty)."""
        # Target is the difficulty of the next question
        df['next_difficulty'] = df['difficulty'].shift(-1)

        # For the last question, use current difficulty (no next question)
        df['next_difficulty'] = df['next_difficulty'].fillna(df['difficulty'])

        # Apply mild smoothing to target
        if len(df) >= 3:
            df['next_difficulty'] = df['next_difficulty'].rolling(3, min_periods=1, center=True).mean()
            # Forward fill for edges
            df['next_difficulty'] = df['next_difficulty'].fillna(method='ffill').fillna(method='bfill')

        return df

    @staticmethod
    def compute_global_features(practice_features_df: pd.DataFrame) -> pd.DataFrame:
        """
        Compute global/session-level features from practice features.

        Args:
            practice_features_df: DataFrame with computed practice features

        Returns:
            DataFrame with global features for each session
        """
        if practice_features_df.empty or len(practice_features_df) < 10:
            logger.warning(f"Insufficient practice data for global features: {len(practice_features_df)} rows")
            return pd.DataFrame()

        logger.info(f"Computing global features from {len(practice_features_df)} practice rows")

        try:
            df = practice_features_df.copy()

            # Create session groupings if not present
            if 'session_id' not in df.columns:
                # Create synthetic sessions based on timestamp if available
                if 'timestamp' in df.columns:
                    df['timestamp'] = pd.to_datetime(df['timestamp'])
                    df['time_diff'] = df['timestamp'].diff().dt.total_seconds().fillna(0)
                    df['new_session'] = (df['time_diff'] > 1800) | (df['time_diff'].isna())
                    df['session_id'] = df['new_session'].cumsum().astype(str)
                else:
                    # Default single session
                    df['session_id'] = 'session_1'

            session_features = []

            # Process each session
            for session_id in df['session_id'].unique():
                session_data = df[df['session_id'] == session_id]

                if len(session_data) < 3:
                    logger.debug(f"Skipping session {session_id}: only {len(session_data)} questions")
                    continue

                # Feature 1: session_accuracy_avg
                session_accuracy_avg = session_data['accuracy'].mean()

                # Feature 2: avg_solved_difficulty
                avg_solved_difficulty = session_data['current_question_difficulty'].mean()

                # Feature 3: max_difficulty_sustained
                # Find max difficulty where accuracy > 60%
                high_acc_mask = session_data['accuracy'] > 0.6
                if high_acc_mask.any():
                    max_difficulty_sustained = session_data.loc[high_acc_mask, 'current_question_difficulty'].max()
                else:
                    max_difficulty_sustained = session_data['current_question_difficulty'].max()

                # Feature 4: performance_trend_slope
                if len(session_data) >= 3:
                    x = np.arange(len(session_data))
                    y = session_data['accuracy'].values
                    slope = np.polyfit(x, y, 1)[0]
                else:
                    slope = 0

                # Feature 5: retention_score
                # Accuracy on concepts seen before in this session
                concept_seen = set()
                retention_scores = []
                for _, row in session_data.iterrows():
                    concept = row.get('concept', 'general')
                    if concept in concept_seen:
                        retention_scores.append(row['accuracy'])
                    concept_seen.add(concept)
                retention_score = np.mean(retention_scores) if retention_scores else session_accuracy_avg

                # Feature 6: burnout_risk_index
                fatigue_trend = session_data['fatigue_indicator'].iloc[-1] - session_data['fatigue_indicator'].iloc[0]

                # Accuracy drop in second half
                if len(session_data) >= 6:
                    half = len(session_data) // 2
                    first_half_acc = session_data.iloc[:half]['accuracy'].mean()
                    second_half_acc = session_data.iloc[half:]['accuracy'].mean()
                    acc_drop = max(0, first_half_acc - second_half_acc)
                else:
                    acc_drop = 0

                # Response time increase
                if len(session_data) >= 6:
                    half = len(session_data) // 2
                    first_half_time = session_data.iloc[:half]['normalized_response_time'].mean()
                    second_half_time = session_data.iloc[half:]['normalized_response_time'].mean()
                    time_increase = max(0, (second_half_time - first_half_time) / (first_half_time + 0.001))
                else:
                    time_increase = 0

                burnout_risk_index = (fatigue_trend * 0.3 + acc_drop * 0.4 + time_increase * 0.3)
                burnout_risk_index = np.clip(burnout_risk_index, 0, 1)

                # Feature 7: stress_trend_slope
                if len(session_data) >= 3 and 'stress_score' in session_data.columns:
                    x = np.arange(len(session_data))
                    y = session_data['stress_score'].values
                    stress_slope = np.polyfit(x, y, 1)[0]
                else:
                    stress_slope = 0

                # Feature 8: concept_coverage_ratio
                unique_concepts = session_data['concept'].nunique() if 'concept' in session_data.columns else 1
                concept_coverage_ratio = unique_concepts / len(session_data)

                # Feature 9: high_difficulty_accuracy
                high_diff_data = session_data[session_data['current_question_difficulty'] > 0.7]
                high_difficulty_accuracy = high_diff_data['accuracy'].mean() if len(high_diff_data) > 0 else session_accuracy_avg

                # Feature 10: consistency_index
                acc_std = session_data['accuracy'].std()
                consistency_index = 1 - acc_std if len(session_data) > 1 else 0.5
                consistency_index = np.clip(consistency_index, 0, 1)

                # Feature 11: avg_response_time_trend
                if len(session_data) >= 3 and 'normalized_response_time' in session_data.columns:
                    x = np.arange(len(session_data))
                    y = session_data['normalized_response_time'].values
                    time_slope = np.polyfit(x, y, 1)[0]
                else:
                    time_slope = 0

                # Feature 12: serious_test_performance_score (composite)
                serious_test_performance_score = (
                    session_accuracy_avg * 0.25 +
                    high_difficulty_accuracy * 0.25 +
                    consistency_index * 0.2 +
                    (1 - burnout_risk_index) * 0.15 +
                    retention_score * 0.15
                )

                session_features.append({
                    'session_id': session_id,
                    'session_accuracy_avg': round(float(session_accuracy_avg), 2),
                    'avg_solved_difficulty': round(float(avg_solved_difficulty), 2),
                    'max_difficulty_sustained': round(float(max_difficulty_sustained), 2),
                    'performance_trend_slope': round(float(slope), 3),
                    'retention_score': round(float(retention_score), 2),
                    'burnout_risk_index': round(float(burnout_risk_index), 2),
                    'stress_trend_slope': round(float(stress_slope), 3),
                    'concept_coverage_ratio': round(float(concept_coverage_ratio), 2),
                    'high_difficulty_accuracy': round(float(high_difficulty_accuracy), 2),
                    'consistency_index': round(float(consistency_index), 2),
                    'avg_response_time_trend': round(float(time_slope), 3),
                    'serious_test_performance_score': round(float(serious_test_performance_score), 2)
                })

            if not session_features:
                logger.warning("No valid sessions for global features")
                return pd.DataFrame()

            result_df = pd.DataFrame(session_features)

            # Compute target: readiness_difficulty_score
            result_df['readiness_difficulty_score'] = (
                result_df['serious_test_performance_score'] * 0.35 +
                result_df['session_accuracy_avg'] * 0.25 +
                result_df['high_difficulty_accuracy'] * 0.25 +
                result_df['consistency_index'] * 0.15
            ).clip(0, 1).round(2)

            logger.info(f"Successfully computed {len(result_df)} global feature rows")
            return result_df

        except Exception as e:
            logger.error(f"Error computing global features: {e}\n{traceback.format_exc()}")
            return pd.DataFrame()
