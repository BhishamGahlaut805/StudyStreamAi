"""
Data Processor Utility - Handles data loading, preprocessing, and transformation
"""
import os
import json
import numpy as np
import pandas as pd
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Tuple, Optional

logger = logging.getLogger(__name__)


class DataProcessor:
    """Utility class for processing all types of learning data"""

    def __init__(self, config):
        self.config = config

    def load_interactions(self, user_id: str, subject: str = None,
                          days: int = None) -> pd.DataFrame:
        """Load interaction data for a user"""
        student_dir = os.path.join(self.config.STUDENT_DATA_DIR, user_id)
        interactions_file = os.path.join(student_dir, 'raw_data', 'interactions.csv')

        if not os.path.exists(interactions_file):
            return pd.DataFrame()

        df = pd.read_csv(interactions_file)

        # Filter by subject if specified
        if subject and 'subject' in df.columns:
            df = df[df['subject'] == subject]

        # Filter by days if specified
        if days and 'timestamp' in df.columns:
            cutoff = datetime.now() - timedelta(days=days)
            df['timestamp_dt'] = pd.to_datetime(df['timestamp'])
            df = df[df['timestamp_dt'] >= cutoff]

        return df

    def load_daily_aggregates(self, user_id: str, subject: str = None,
                              days: int = None) -> pd.DataFrame:
        """Load daily aggregate data for a user"""
        student_dir = os.path.join(self.config.STUDENT_DATA_DIR, user_id)
        daily_file = os.path.join(student_dir, 'raw_data', 'daily_aggregates.csv')

        if not os.path.exists(daily_file):
            return pd.DataFrame()

        df = pd.read_csv(daily_file)

        # Filter by subject if specified
        if subject and 'subject' in df.columns:
            df = df[df['subject'] == subject]

        # Filter by days if specified
        if days and 'date' in df.columns:
            cutoff = (datetime.now() - timedelta(days=days)).date()
            df['date_dt'] = pd.to_datetime(df['date']).dt.date
            df = df[df['date_dt'] >= cutoff]

        return df

    def load_topic_metadata(self, subject: str = None) -> pd.DataFrame:
        """Load topic metadata"""
        metadata_file = os.path.join(
            self.config.BASE_DIR, 'data', 'topic_metadata.csv'
        )

        if not os.path.exists(metadata_file):
            return self._generate_default_metadata(subject)

        df = pd.read_csv(metadata_file)

        if subject and 'subject' in df.columns:
            df = df[df['subject'] == subject]

        return df

    def _generate_default_metadata(self, subject: str = None) -> pd.DataFrame:
        """Generate default metadata if file doesn't exist"""
        metadata = []

        subjects = [subject] if subject else self.config.SUBJECTS.keys()

        for subj in subjects:
            topics = self.config.SUBJECTS.get(subj, {}).get('topics', [])

            for topic in topics:
                metadata.append({
                    'topic_id': f"{subj}_{topic}",
                    'subject': subj,
                    'category': topic,
                    'difficulty': np.random.choice([1, 2, 3, 4, 5]),
                    'prerequisites': '',
                    'related_topics': '',
                    'importance': np.random.uniform(0.3, 0.9),
                    'frequency': np.random.uniform(0.1, 0.5),
                    'avg_time_to_mastery': np.random.randint(30, 120),
                    'forgetting_rate': np.random.uniform(0.1, 0.3),
                    'similarity_to_known': np.random.uniform(0.3, 0.7)
                })

        return pd.DataFrame(metadata)

    def prepare_micro_sequences(self, interactions: pd.DataFrame,
                                topic_id: str = None) -> Dict:
        """Prepare sequences for micro model training"""
        if interactions.empty:
            return {'X': None, 'y': None}

        # Sort by timestamp
        interactions = interactions.sort_values('timestamp')

        # Filter by topic if specified
        if topic_id and 'topic_id' in interactions.columns:
            interactions = interactions[interactions['topic_id'] == topic_id]

        seq_length = self.config.MODEL_CONFIG['micro']['sequence_length']
        n_features = self.config.MODEL_CONFIG['micro']['n_features']

        # Extract features
        features = []
        targets_current = []
        targets_next = []
        targets_stress = []
        targets_fatigue = []

        for _, row in interactions.iterrows():
            feature_vector = self._extract_micro_features(row)
            features.append(feature_vector)
            targets_current.append(row.get('retention', 0.5))
            targets_stress.append(row.get('stress_level', 0.3))
            targets_fatigue.append(row.get('fatigue_index', 0.3))

        if len(features) < seq_length + 1:
            return {'X': None, 'y': None}

        # Create sequences
        X = []
        y_current = []
        y_next = []
        y_stress = []
        y_fatigue = []

        for i in range(len(features) - seq_length):
            X.append(features[i:i + seq_length])

            # Current retention (last in sequence)
            y_current.append(targets_current[i + seq_length - 1])

            # Next retention (if available)
            if i + seq_length < len(targets_current):
                y_next.append(targets_current[i + seq_length])
            else:
                y_next.append(targets_current[i + seq_length - 1])

            y_stress.append(targets_stress[i + seq_length - 1])
            y_fatigue.append(targets_fatigue[i + seq_length - 1])

        return {
            'X': np.array(X),
            'y_current': np.array(y_current),
            'y_next': np.array(y_next),
            'y_stress': np.array(y_stress),
            'y_fatigue': np.array(y_fatigue)
        }

    def _extract_micro_features(self, row: pd.Series) -> List[float]:
        """Extract feature vector from interaction row"""
        return [
            float(row.get('correct', 0)),
            float(row.get('response_time_ms', 2000)) / 5000,
            float(row.get('hesitation_count', 0)) / 5,
            float(row.get('confidence', 3)) / 5,
            float(row.get('difficulty', 3)) / 5,
            float(row.get('streak', 0)) / 10,
            float(row.get('fatigue_index', 0.3)),
            float(row.get('focus_score', 0.7)),
            float(row.get('time_since_last', 86400)) / 604800,
            float(row.get('attempt_number', 1)) / 5,
            float(row.get('session_position', 1)) / 50,
            pd.to_datetime(row.get('timestamp', datetime.now())).hour / 24,
            float(row.get('stress_level', 0.3)),
            float(row.get('sleep_quality', 0.7)),
            float(row.get('mood_score', 0.5))
        ]

    def prepare_meso_data(self, user_id: str, subject: str) -> Tuple:
        """Prepare data for meso model training"""
        # Load daily aggregates
        daily = self.load_daily_aggregates(user_id, subject, days=30)

        if daily.empty:
            return None, None

        # Load topic metadata
        metadata = self.load_topic_metadata(subject)

        # Prepare temporal features
        temporal_features = []
        for _, row in daily.iterrows():
            features = self._extract_meso_features(row)
            temporal_features.append(features)

        # Ensure sequence length
        seq_length = self.config.MODEL_CONFIG['meso']['sequence_length']
        if len(temporal_features) < seq_length:
            padding = [[0] * len(temporal_features[0])] * (
                seq_length - len(temporal_features)
            )
            temporal_features = padding + temporal_features

        temporal_sequence = np.array(temporal_features[-seq_length:])

        # Prepare metadata features for each topic
        metadata_features = []
        for _, row in metadata.iterrows():
            features = self._extract_metadata_features(row)
            metadata_features.append(features)

        return temporal_sequence, np.array(metadata_features)

    def _extract_meso_features(self, row: pd.Series) -> List[float]:
        """Extract meso temporal features"""
        return [
            float(row.get('avg_accuracy', 0.5)),
            float(row.get('avg_response_time', 2000)) / 5000,
            float(row.get('questions_attempted', 0)) / 50,
            float(row.get('topics_covered', 0)) / 20,
            float(row.get('retention_end_of_day', 0.5)),
            float(row.get('fatigue_avg', 0.3)),
            float(row.get('focus_avg', 0.7)),
            float(row.get('new_topics_learned', 0)) / 10,
            float(row.get('stress_avg', 0.3)),
            float(row.get('sleep_quality_avg', 0.7))
        ]

    def _extract_metadata_features(self, row: pd.Series) -> List[float]:
        """Extract topic metadata features"""
        return [
            float(row.get('difficulty', 3)) / 5,
            float(row.get('avg_cohort_retention', 0.5)),
            float(row.get('prerequisite_count', 0)) / 10,
            float(row.get('related_topics_count', 0)) / 10,
            float(row.get('importance', 3)) / 5,
            float(row.get('frequency', 0.5)),
            float(row.get('avg_time_to_mastery', 120)) / 360,
            float(row.get('forgetting_rate', 0.15)),
            float(row.get('interference_score', 0.2)),
            float(row.get('similarity_to_known', 0.5)),
            float(row.get('concreteness', 0.5)),
            float(row.get('imageability', 0.5)),
            float(row.get('age_of_acquisition', 10)) / 20,
            float(row.get('word_length', 8)) / 15,
            float(row.get('syllable_count', 3)) / 6,
            float(row.get('concept_difficulty', 3)) / 5,
            float(row.get('memory_load', 0.5)),
            float(row.get('abstraction_level', 0.5))
        ]

    def prepare_macro_data(self, user_id: str) -> Dict:
        """Prepare data for macro model training"""
        # Load daily aggregates for all subjects
        daily = self.load_daily_aggregates(user_id, days=90)

        if daily.empty:
            return {'encoder_input': None}

        # Prepare encoder input (90 days of history)
        encoder_features = []
        for _, row in daily.iterrows():
            features = self._extract_macro_features(row)
            encoder_features.append(features)

        # Pad if needed
        seq_length = 90
        if len(encoder_features) < seq_length:
            padding = [[0] * len(encoder_features[0])] * (
                seq_length - len(encoder_features)
            )
            encoder_features = padding + encoder_features

        encoder_input = np.array(encoder_features[-seq_length:])

        # Prepare decoder input (future path - placeholder)
        decoder_input = np.zeros((30, 15))

        return {
            'encoder_input': encoder_input.reshape(1, seq_length, -1),
            'decoder_input': decoder_input.reshape(1, 30, 15)
        }

    def _extract_macro_features(self, row: pd.Series) -> List[float]:
        """Extract macro features"""
        return [
            float(row.get('new_topics_learned', 0)) / 10,
            float(row.get('avg_retention', 0.5)),
            float(row.get('study_time_minutes', 30)) / 120,
            float(row.get('sessions_completed', 1)) / 5,
            float(row.get('avg_accuracy', 0.7)),
            float(row.get('avg_response_time', 2000)) / 5000,
            float(row.get('fatigue_avg', 0.3)),
            float(row.get('focus_avg', 0.7)),
            float(row.get('consistency_score', 0.5)),
            float(row.get('momentum_score', 0.5)),
            float(row.get('confidence_growth', 0.1)),
            float(row.get('speed_improvement', 0.1)),
            float(row.get('retention_improvement', 0.05)),
            float(row.get('challenge_preference', 0.5)),
            float(row.get('review_ratio', 0.3)),
            float(row.get('new_vs_review', 0.5)),
            float(row.get('interleaving_score', 0.5)),
            float(row.get('spacing_score', 0.5)),
            float(row.get('active_recall_score', 0.7)),
            float(row.get('elaboration_score', 0.5))
        ]

    def save_interaction(self, user_id: str, interaction_data: Dict):
        """Save a single interaction to CSV"""
        student_dir = os.path.join(self.config.STUDENT_DATA_DIR, user_id)
        interactions_file = os.path.join(student_dir, 'raw_data', 'interactions.csv')

        # Add timestamp if not present
        if 'timestamp' not in interaction_data:
            interaction_data['timestamp'] = datetime.now().isoformat()

        # Create DataFrame from single interaction
        df_new = pd.DataFrame([interaction_data])

        # Append to existing file or create new
        if os.path.exists(interactions_file):
            df_existing = pd.read_csv(interactions_file)
            df_combined = pd.concat([df_existing, df_new], ignore_index=True)
        else:
            df_combined = df_new

        df_combined.to_csv(interactions_file, index=False)
        logger.info(f"Saved interaction for user {user_id}")

    def update_daily_aggregate(self, user_id: str, date: str = None):
        """Update daily aggregates based on interactions"""
        if date is None:
            date = datetime.now().strftime('%Y-%m-%d')

        # Load today's interactions
        interactions = self.load_interactions(user_id, days=1)

        if interactions.empty:
            return

        # Calculate daily aggregates
        daily = {
            'date': date,
            'user_id': user_id,
            'avg_accuracy': interactions['correct'].mean(),
            'avg_response_time': interactions['response_time_ms'].mean(),
            'questions_attempted': len(interactions),
            'topics_covered': interactions['topic_id'].nunique(),
            'retention_end_of_day': interactions['correct'].tail(10).mean(),
            'fatigue_avg': interactions['fatigue_index'].mean(),
            'focus_avg': interactions['focus_score'].mean(),
            'stress_avg': interactions['stress_level'].mean(),
            'new_topics_learned': len(interactions[interactions['attempt_number'] == 1]),
            'sessions_completed': interactions['session_id'].nunique(),
            'study_time_minutes': interactions['response_time_ms'].sum() / (1000 * 60)
        }

        # Save daily aggregate
        student_dir = os.path.join(self.config.STUDENT_DATA_DIR, user_id)
        daily_file = os.path.join(student_dir, 'raw_data', 'daily_aggregates.csv')

        df_new = pd.DataFrame([daily])

        if os.path.exists(daily_file):
            df_existing = pd.read_csv(daily_file)

            # Check if entry for this date already exists
            if date in df_existing['date'].values:
                # Update existing
                df_existing.loc[df_existing['date'] == date] = daily
                df_combined = df_existing
            else:
                # Append new
                df_combined = pd.concat([df_existing, df_new], ignore_index=True)
        else:
            df_combined = df_new

        df_combined.to_csv(daily_file, index=False)
        logger.info(f"Updated daily aggregates for user {user_id} on {date}")
        