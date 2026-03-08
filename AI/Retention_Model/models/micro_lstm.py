"""
Micro-LSTM Model - Question-level retention prediction with enhanced features
"""
import tensorflow as tf
from tensorflow.keras import layers, models, backend as K
import numpy as np
import pandas as pd
import logging
from datetime import datetime, timedelta
import json
import os

logger = logging.getLogger(__name__)

class MicroRetentionLSTM:
    """
    Predicts retention after each question with stress and fatigue awareness
    Input: Sequence of 20 interactions with 15 features each
    Output: Current retention, next retention, stress impact, fatigue prediction
    """

    def __init__(self, sequence_length=20, n_features=15, config=None):
        self.sequence_length = sequence_length
        self.n_features = n_features
        self.config = config or {}
        self.model = self._build_model()
        self.history = None
        self._inference_fn = None
        self.feature_names = [
            'correct', 'response_time_normalized', 'hesitation_count_normalized',
            'confidence_score', 'difficulty_level', 'streak_length',
            'fatigue_index', 'focus_score', 'time_since_last_normalized',
            'attempt_number', 'session_position', 'hour_of_day',
            'stress_level', 'sleep_quality', 'mood_score'
        ]

    def _get_inference_fn(self):
        """Build once and reuse to avoid recreating tf.function during repeated API calls."""
        if self._inference_fn is None:
            @tf.function(reduce_retracing=True)
            def _infer(sequence):
                return self.model(sequence, training=False)
            self._inference_fn = _infer
        return self._inference_fn

    def _build_model(self):
        """Build enhanced micro-LSTM architecture with stress awareness"""

        # Input layer
        inputs = layers.Input(shape=(self.sequence_length, self.n_features))

        # First Bidirectional LSTM with attention
        x = layers.Bidirectional(
            layers.LSTM(128, return_sequences=True, dropout=0.2, recurrent_dropout=0.2)
        )(inputs)
        x = layers.LayerNormalization()(x)

        # Self-attention mechanism for important moments
        attention = layers.MultiHeadAttention(num_heads=8, key_dim=64)(x, x)
        x = layers.Add()([x, attention])
        x = layers.LayerNormalization()(x)

        # Second Bidirectional LSTM
        x = layers.Bidirectional(
            layers.LSTM(64, return_sequences=True, dropout=0.2, recurrent_dropout=0.2)
        )(x)
        x = layers.LayerNormalization()(x)

        # Global pooling
        x = layers.GlobalAveragePooling1D()(x)

        # Dense layers with residual connections
        d1 = layers.Dense(128, activation='relu')(x)
        d1 = layers.Dropout(0.3)(d1)
        d1 = layers.BatchNormalization()(d1)

        d2 = layers.Dense(64, activation='relu')(d1)
        d2 = layers.Dropout(0.2)(d2)
        d2 = layers.BatchNormalization()(d2)

        # Multiple outputs
        current_retention = layers.Dense(1, activation='sigmoid', name='current_retention')(d2)
        next_retention = layers.Dense(1, activation='sigmoid', name='next_retention')(d2)
        stress_impact = layers.Dense(1, activation='sigmoid', name='stress_impact')(d2)
        fatigue_prediction = layers.Dense(1, activation='sigmoid', name='fatigue_prediction')(d2)

        model = models.Model(
            inputs=inputs,
            outputs=[current_retention, next_retention, stress_impact, fatigue_prediction]
        )

        # Custom loss weights
        model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
            loss={
                'current_retention': 'mse',
                'next_retention': 'mse',
                'stress_impact': 'mse',
                'fatigue_prediction': 'mse'
            },
            loss_weights={
                'current_retention': 0.4,
                'next_retention': 0.3,
                'stress_impact': 0.15,
                'fatigue_prediction': 0.15
            },
            metrics={
                'current_retention': ['mae', tf.keras.metrics.RootMeanSquaredError()],
                'next_retention': ['mae', tf.keras.metrics.RootMeanSquaredError()],
                'stress_impact': ['mae'],
                'fatigue_prediction': ['mae']
            }
        )

        logger.info("Enhanced Micro-LSTM model built successfully")
        return model

    def fit(self, X_train, y_train, X_val=None, y_val=None, epochs=100, batch_size=32, **kwargs):
        """Train the model with enhanced callbacks"""

        callbacks = [
            tf.keras.callbacks.EarlyStopping(
                monitor='val_loss' if X_val is not None else 'loss',
                patience=15,
                restore_best_weights=True,
                verbose=1
            ),
            tf.keras.callbacks.ReduceLROnPlateau(
                monitor='val_loss' if X_val is not None else 'loss',
                factor=0.5,
                patience=8,
                min_lr=0.00001,
                verbose=1
            ),
            tf.keras.callbacks.ModelCheckpoint(
                filepath='best_micro_model.h5',
                monitor='val_loss' if X_val is not None else 'loss',
                save_best_only=True,
                verbose=1
            )
        ]

        validation_data = None
        if X_val is not None and y_val is not None:
            validation_data = (X_val, y_val)

        self.history = self.model.fit(
            X_train, y_train,
            validation_data=validation_data,
            epochs=epochs,
            batch_size=batch_size,
            callbacks=callbacks,
            verbose=1,
            **kwargs
        )

        return self.history

    def predict_topic_retention(self, topic_sequence, return_all=False):
        """
        Predict retention for a single topic sequence
        Returns: current_retention, next_retention, stress_impact, fatigue
        """
        topic_sequence = np.asarray(topic_sequence, dtype=np.float32)
        if len(topic_sequence) < self.sequence_length:
            # Pad sequence if too short
            padding = np.zeros((self.sequence_length - len(topic_sequence), self.n_features), dtype=np.float32)
            topic_sequence = np.vstack([padding, topic_sequence])

        sequence = topic_sequence[-self.sequence_length:].reshape(1, self.sequence_length, self.n_features)
        sequence_tensor = tf.convert_to_tensor(sequence, dtype=tf.float32)
        predictions = self._get_inference_fn()(sequence_tensor)

        if return_all:
            return {
                'current_retention': float(predictions[0][0][0].numpy()),
                'next_retention': float(predictions[1][0][0].numpy()),
                'stress_impact': float(predictions[2][0][0].numpy()),
                'fatigue_prediction': float(predictions[3][0][0].numpy())
            }

        return float(predictions[0][0][0].numpy())  # Current retention

    def predict_all_topics(self, all_sequences):
        """Predict retention for all topics with detailed metrics"""
        results = []

        for topic_id, sequences in all_sequences.items():
            predictions = self.predict_topic_retention(sequences, return_all=True)

            # Calculate next review time based on retention
            next_review = self._calculate_next_review(predictions['current_retention'])

            results.append({
                'topic_id': topic_id,
                'current_retention': predictions['current_retention'],
                'next_retention': predictions['next_retention'],
                'stress_impact': predictions['stress_impact'],
                'fatigue_level': predictions['fatigue_prediction'],
                'next_review': next_review,
                'confidence': 0.85 + (0.1 * predictions['current_retention']),  # Dynamic confidence
                'batch_type': self._determine_batch_type(predictions['current_retention'])
            })

        # Sort by retention (lowest first - most urgent)
        return sorted(results, key=lambda x: x['current_retention'])

    def _calculate_next_review(self, retention):
        """Calculate next review timing based on retention"""
        from config import RetentionConfig

        for schedule, details in RetentionConfig.REPETITION_SCHEDULES.items():
            low, high = details['retention_range']
            if low <= retention < high:
                return {
                    'schedule_type': details['schedule_type'],
                    'questions_needed': details['questions_per_topic'],
                    'batch_size': details['batch_size'],
                    'description': details['description']
                }

        # Default
        return {
            'schedule_type': 'in_3_days',
            'questions_needed': 3,
            'batch_size': 8,
            'description': 'Standard review schedule'
        }

    def _determine_batch_type(self, retention):
        """Determine which batch this topic belongs to"""
        if retention < 0.3:
            return 'immediate'
        elif retention < 0.5:
            return 'short_term'
        elif retention < 0.7:
            return 'medium_term'
        elif retention < 0.85:
            return 'long_term'
        else:
            return 'mastered'

    def generate_forgetting_curve(self, topic_id, current_retention, days=None):
        """
        Generate forgetting curve for a topic
        Uses exponential decay with reinforcement effects
        """
        from config import RetentionConfig

        if days is None:
            days = RetentionConfig.FORGETTING_CURVE['time_points']

        # Decay factor based on topic difficulty and student's learning rate
        decay_factor = 0.15 + (0.15 * (1 - current_retention))  # Higher decay for lower retention

        tau = 30 * (1 + current_retention)  # Time constant

        curve = []
        for day in days:
            # Base forgetting
            retention = current_retention * np.exp(-day / tau)

            # Add reinforcement effects at typical review intervals
            if day in [1, 3, 7, 14, 30]:
                retention += RetentionConfig.FORGETTING_CURVE['reinforcement_boost'] * current_retention

            # Ensure bounds
            retention = min(1.0, max(0.0, retention))

            curve.append({
                'day': day,
                'retention': float(retention),
                'review_needed': retention < 0.5,
                'optimal_review_day': self._find_optimal_review_day(retention)
            })

        return {
            'topic_id': topic_id,
            'current_retention': current_retention,
            'decay_factor': decay_factor,
            'curve': curve
        }

    def _find_optimal_review_day(self, retention):
        """Find optimal day for next review"""
        if retention < 0.3:
            return 0
        elif retention < 0.5:
            return 1
        elif retention < 0.7:
            return 3
        elif retention < 0.85:
            return 7
        else:
            return 30

    def analyze_stress_patterns(self, interaction_sequences):
        """
        Analyze stress patterns from interaction data
        Returns stress metrics and recommendations
        """
        stress_metrics = {
            'overall_stress_level': np.mean([s[-1][12] for s in interaction_sequences if len(s) > 0]),  # stress_level feature
            'stress_trend': [],
            'high_stress_moments': [],
            'stress_recovery_rate': 0,
            'recommendations': []
        }

        for sequence in interaction_sequences:
            if len(sequence) > 5:
                stress_values = [step[12] for step in sequence]  # stress_level feature

                # Calculate trend
                if len(stress_values) > 1:
                    trend = (stress_values[-1] - stress_values[0]) / len(stress_values)
                    stress_metrics['stress_trend'].append(trend)

                # Identify high stress moments
                for i, stress in enumerate(stress_values):
                    if stress > 0.7:
                        stress_metrics['high_stress_moments'].append({
                            'position': i,
                            'stress_level': stress,
                            'preceding_accuracy': sequence[i][0] if i > 0 else None  # correct feature
                        })

        # Generate recommendations
        if stress_metrics['overall_stress_level'] > 0.6:
            stress_metrics['recommendations'].append("Consider taking more frequent breaks")
        if len(stress_metrics['high_stress_moments']) > 3:
            stress_metrics['recommendations'].append("Difficulty level may be too high - consider easier questions")

        return stress_metrics

    def save(self, filepath):
        """Save model with metadata"""
        # Save model
        self.model.save(filepath)

        # Save metadata
        metadata = {
            'sequence_length': self.sequence_length,
            'n_features': self.n_features,
            'feature_names': self.feature_names,
            'saved_at': datetime.now().isoformat()
        }

        metadata_path = filepath.replace('.h5', '_metadata.json')
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)

        logger.info(f"Model and metadata saved to {filepath}")

    def load(self, filepath):
        """Load model with custom objects"""
        self.model = tf.keras.models.load_model(filepath)
        self._inference_fn = None

        # Load metadata if exists
        metadata_path = filepath.replace('.h5', '_metadata.json')
        if os.path.exists(metadata_path):
            with open(metadata_path, 'r') as f:
                metadata = json.load(f)
                self.sequence_length = metadata.get('sequence_length', self.sequence_length)
                self.n_features = metadata.get('n_features', self.n_features)
                self.feature_names = metadata.get('feature_names', self.feature_names)

        logger.info(f"Model loaded from {filepath}")
        return self
