"""
Feature Engineering Service - Creates features for all three models
"""
import os
import numpy as np
import pandas as pd
import json
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple

logger = logging.getLogger(__name__)

class FeatureEngineer:
    """
    Creates feature sequences for all three LSTM models
    """

    def __init__(self, user_id):
        self.user_id = user_id
        self.base_path = f"student_data/{user_id}"
        self.sequence_length = 20  # Default for micro model

    def create_micro_sequences(self, interactions: List[Dict]) -> Dict:
        """
        Create sequences for micro-LSTM model
        Input: List of interactions
        Output: Sequences ready for training
        """

        # Sort interactions by timestamp
        interactions = sorted(interactions, key=lambda x: x.get('timestamp', ''))

        # Extract features for each interaction
        features = []
        for interaction in interactions:
            feature_vector = self._extract_micro_features(interaction)
            features.append(feature_vector)

        # Create sequences
        sequences = []
        targets_current = []
        targets_next = []

        for i in range(len(features) - self.sequence_length):
            sequence = features[i:i + self.sequence_length]
            current_target = features[i + self.sequence_length - 1][0]  # Current retention
            next_target = features[i + self.sequence_length][0] if i + self.sequence_length < len(features) else current_target

            sequences.append(sequence)
            targets_current.append(current_target)
            targets_next.append(next_target)

        # Convert to numpy arrays
        X = np.array(sequences)
        y = [np.array(targets_current), np.array(targets_next)]

        # Split into train/val
        split_idx = int(0.8 * len(X))
        X_train, X_val = X[:split_idx], X[split_idx:]
        y_train = [y[0][:split_idx], y[1][:split_idx]]
        y_val = [y[0][split_idx:], y[1][split_idx:]]

        # Save raw data
        self._save_features('micro', {
            'X_train': X_train.tolist(),
            'X_val': X_val.tolist(),
            'y_train': [y_train[0].tolist(), y_train[1].tolist()],
            'y_val': [y_val[0].tolist(), y_val[1].tolist()]
        })

        return {
            'X_train': X_train,
            'X_val': X_val,
            'y_train': y_train,
            'y_val': y_val,
            'raw_data': interactions
        }

    def create_meso_sequences(self, daily_aggregates: List[Dict],
                             topic_metadata: Dict) -> Tuple[np.ndarray, np.ndarray]:
        """
        Create sequences for meso-LSTM model
        """

        # Create temporal sequences
        temporal_features = []
        for day in daily_aggregates:
            features = self._extract_meso_features(day)
            temporal_features.append(features)

        # Ensure sequence length
        if len(temporal_features) < 30:
            # Pad with zeros
            padding = [[0] * len(temporal_features[0])] * (30 - len(temporal_features))
            temporal_features = padding + temporal_features

        temporal_sequence = np.array(temporal_features[-30:])

        # Create metadata features
        metadata_features = self._extract_metadata_features(topic_metadata)
        metadata_array = np.array(metadata_features)

        # Save features
        self._save_features('meso', {
            'temporal_sequence': temporal_sequence.tolist(),
            'metadata': metadata_features
        })

        return temporal_sequence, metadata_array

    def create_macro_features(self, long_term_history: List[Dict],
                             user_profile: Dict) -> Dict:
        """
        Create features for macro-LSTM model
        """

        # Prepare encoder input (learning history)
        encoder_input = []
        for entry in long_term_history[-90:]:  # Last 90 days
            features = self._extract_macro_features(entry)
            encoder_input.append(features)

        # Pad if needed
        if len(encoder_input) < 90:
            padding = [[0] * 20] * (90 - len(encoder_input))
            encoder_input = padding + encoder_input

        encoder_input = np.array(encoder_input)

        # Prepare decoder input (future path)
        decoder_input = np.zeros((30, 15))  # 30 days, 15 features

        # Prepare targets (simulated for training)
        targets = [
            np.random.rand(30, 50),  # Topic probabilities
            np.random.rand(30, 1)     # Retention targets
        ]

        features = {
            'encoder_input': encoder_input.reshape(1, 90, 20),
            'decoder_input': decoder_input.reshape(1, 30, 15),
            'targets': [t.reshape(1, 30, -1) for t in targets],
            'user_profile': user_profile
        }

        # Save features
        self._save_features('macro', {
            'encoder_input': encoder_input.tolist(),
            'user_profile': user_profile
        })

        return features

    def prepare_single_topic_features(self, topic_id: str,
                                     recent_interactions: List[Dict]) -> np.ndarray:
        """
        Prepare features for a single topic prediction
        """

        # Get interactions for this topic
        topic_interactions = [
            i for i in recent_interactions
            if i.get('topic') == topic_id
        ]

        # Extract features
        features = []
        for interaction in topic_interactions[-20:]:  # Last 20
            f = self._extract_micro_features(interaction)
            features.append(f)

        # Pad if needed
        if len(features) < 20:
            padding = [[0] * 12] * (20 - len(features))
            features = padding + features

        return np.array(features[-20:])

    def _extract_micro_features(self, interaction: Dict) -> List[float]:
        """Extract features for micro model"""

        return [
            float(interaction.get('correct', 0)),
            float(interaction.get('response_time_ms', 2000)) / 5000,  # Normalize
            float(interaction.get('hesitation_count', 0)) / 5,
            float(interaction.get('confidence', 3)) / 5,
            float(interaction.get('difficulty', 3)) / 5,
            float(interaction.get('streak', 0)) / 10,
            float(interaction.get('fatigue_index', 0)),
            float(interaction.get('focus_score', 0.8)),
            float(interaction.get('time_since_last', 86400)) / 604800,  # Normalize to week
            float(interaction.get('attempt_number', 1)) / 5,
            float(interaction.get('session_position', 1)) / 50,
            float(datetime.fromisoformat(interaction.get('timestamp', datetime.now().isoformat())).hour) / 24
        ]

    def _extract_meso_features(self, day: Dict) -> List[float]:
        """Extract features for meso model"""

        return [
            float(day.get('avg_accuracy', 0.5)),
            float(day.get('avg_response_time', 2000)) / 5000,
            float(day.get('questions_attempted', 0)) / 50,
            float(day.get('topics_covered', 0)) / 20,
            float(day.get('retention_end_of_day', 0.5)),
            float(day.get('fatigue_avg', 0.3)),
            float(day.get('focus_avg', 0.7)),
            float(day.get('new_topics_learned', 0)) / 10
        ]

    def _extract_metadata_features(self, metadata: Dict) -> List[float]:
        """Extract topic metadata features"""

        return [
            float(metadata.get('difficulty', 3)) / 5,
            float(metadata.get('avg_cohort_retention', 0.5)),
            float(metadata.get('prerequisite_count', 0)) / 10,
            float(metadata.get('related_topics_count', 0)) / 10,
            float(metadata.get('importance', 3)) / 5,
            float(metadata.get('frequency_in_corpus', 0.5)),
            float(metadata.get('avg_time_to_mastery', 120)) / 360,
            float(metadata.get('forgetting_rate', 0.15)),
            float(metadata.get('interference_score', 0.2)),
            float(metadata.get('similarity_to_known', 0.5)),
            float(metadata.get('concreteness', 0.5)),
            float(metadata.get('imageability', 0.5)),
            float(metadata.get('age_of_acquisition', 10)) / 20,
            float(metadata.get('word_length', 8)) / 15,
            float(metadata.get('syllable_count', 3)) / 6
        ]

    def _extract_macro_features(self, entry: Dict) -> List[float]:
        """Extract features for macro model"""

        return [
            float(entry.get('topics_learned', 0)) / 20,
            float(entry.get('avg_retention', 0.5)),
            float(entry.get('study_time_minutes', 30)) / 120,
            float(entry.get('sessions_completed', 1)) / 5,
            float(entry.get('avg_accuracy', 0.7)),
            float(entry.get('avg_response_time', 2000)) / 5000,
            float(entry.get('fatigue_avg', 0.3)),
            float(entry.get('focus_avg', 0.7)),
            float(entry.get('consistency_score', 0.5)),
            float(entry.get('momentum_score', 0.5)),
            float(entry.get('confidence_growth', 0.1)),
            float(entry.get('speed_improvement', 0.1)),
            float(entry.get('retention_improvement', 0.05)),
            float(entry.get('challenge_preference', 0.5)),
            float(entry.get('review_ratio', 0.3)),
            float(entry.get('new_vs_review', 0.5)),
            float(entry.get('interleaving_score', 0.5)),
            float(entry.get('spacing_score', 0.5)),
            float(entry.get('active_recall_score', 0.7)),
            float(entry.get('elaboration_score', 0.5))
        ]

    def _save_features(self, model_name: str, features: Dict):
        """Save features to file"""

        os.makedirs(f"{self.base_path}/features", exist_ok=True)

        with open(f"{self.base_path}/features/{model_name}_features.json", 'w') as f:
            json.dump(features, f, indent=2)

        logger.info(f"{model_name} features saved")
        