import tensorflow as tf
from tensorflow.keras.layers import LSTM, Dense, Dropout
from .base_model import BaseLSTM

class BurnoutRiskModel(BaseLSTM):
    """
    Predicts burnout risk probability (0-1)
    Features (11): session_accuracy_avg, performance_trend_slope,
                  stress_trend_slope, avg_response_time_trend,
                  fatigue_indicator_trend, study_duration_per_day,
                  days_without_break, high_difficulty_accuracy,
                  consistency_index, confidence_drop_rate,
                  rapid_guess_frequency, late_session_accuracy_drop
    """

    def __init__(self, sequence_length=14, n_features=11):
        super().__init__(sequence_length, n_features, 'burnout_risk')
        self.target = 'burnout_risk_probability'

    def build_model(self):
        """Build LSTM model for burnout risk prediction"""
        model = tf.keras.Sequential([
            # Bidirectional LSTM for better pattern capture
            tf.keras.layers.Bidirectional(
                LSTM(64, return_sequences=True,
                     dropout=0.3, recurrent_dropout=0.3,
                     kernel_initializer='he_normal'),
                input_shape=(self.sequence_length, self.n_features)
            ),

            # Second LSTM
            LSTM(32, return_sequences=False,
                 dropout=0.3, recurrent_dropout=0.3,
                 kernel_initializer='he_normal'),

            # Dense layers
            Dense(32, activation='relu', kernel_initializer='he_normal'),
            Dropout(0.4),
            Dense(16, activation='relu', kernel_initializer='he_normal'),
            Dropout(0.3),
            Dense(1, activation='sigmoid')  # Output: probability 0-1
        ])

        model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=0.0005, clipnorm=1.0),
            loss='binary_crossentropy',
            metrics=['accuracy', 'mae']
        )

        self.model = model
        self.built = True
        return model
    