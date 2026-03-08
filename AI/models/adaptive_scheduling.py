import tensorflow as tf
import numpy as np
from tensorflow.keras.layers import LSTM, Dense, Dropout, Concatenate
from .base_model import BaseLSTM

class AdaptiveSchedulingModel(BaseLSTM):
    """
    Predicts concept priority score (0-1) for scheduling
    Features (13): mastery_score, retention_decay_score,
                  weakness_severity_rank, exam_weightage,
                  days_since_last_practice, learning_velocity,
                  stability_index, high_difficulty_readiness,
                  burnout_risk, daily_available_time,
                  fatigue_sensitivity_index, concept_coverage_ratio,
                  performance_trend
    """

    def __init__(self, sequence_length=30, n_features=13):
        super().__init__(sequence_length, n_features, 'adaptive_scheduling')
        self.target = 'concept_priority_score'

    def build_model(self):
        """Build hybrid model for adaptive scheduling"""
        # This is a hybrid model - can use LSTM but also allows rule-based override

        model = tf.keras.Sequential([
            # LSTM for temporal patterns
            LSTM(128, return_sequences=True,
                 input_shape=(self.sequence_length, self.n_features),
                 dropout=0.2, recurrent_dropout=0.2,
                 kernel_initializer='he_normal'),

            LSTM(64, return_sequences=False,
                 dropout=0.2, recurrent_dropout=0.2,
                 kernel_initializer='he_normal'),

            # Dense layers for feature interaction
            Dense(64, activation='relu', kernel_initializer='he_normal'),
            Dropout(0.3),
            Dense(32, activation='relu', kernel_initializer='he_normal'),
            Dropout(0.2),
            Dense(16, activation='relu', kernel_initializer='he_normal'),
            Dense(1, activation='sigmoid')  # Output: priority score 0-1
        ])

        model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
            loss='mse',
            metrics=['mae']
        )

        self.model = model
        self.built = True
        return model

    def predict_with_rules(self, X, rule_weight=0.3):
        """
        Hybrid prediction: combine LSTM output with rule-based scoring
        """
        lstm_score = self.predict(X)[0]

        # Simple rule-based scoring (example)
        if len(X.shape) == 3:
            latest = X[0, -1, :]
        else:
            latest = X[-1, :]

        # Rule: prioritize concepts with low mastery and high exam weightage
        mastery = latest[0]  # mastery_score
        exam_weight = latest[3]  # exam_weightage
        days_since = latest[4]  # days_since_last_practice

        rule_score = (1 - mastery) * 0.4 + exam_weight * 0.3 + min(days_since / 30, 1) * 0.3

        # Combine
        final_score = (1 - rule_weight) * lstm_score + rule_weight * rule_score
        return final_score
    