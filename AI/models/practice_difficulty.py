import numpy as np
import tensorflow as tf
from tensorflow.keras.layers import LSTM, Dense, Dropout, Bidirectional, BatchNormalization, Attention
from tensorflow.keras.regularizers import l2
from .base_model import BaseLSTM

class PracticeDifficultyModel(BaseLSTM):
    """
    Enhanced LSTM model for practice difficulty prediction
    """

    def __init__(self, sequence_length=10, n_features=12):
        super().__init__(sequence_length, n_features, 'practice_difficulty')
        self.target = 'next_difficulty'

    def build_model(self):
        """Build enhanced LSTM model with attention and regularization"""
        model = tf.keras.Sequential([
            # Input layer with batch normalization
            BatchNormalization(input_shape=(self.sequence_length, self.n_features)),

            # First Bidirectional LSTM with L2 regularization
            Bidirectional(
                LSTM(128, return_sequences=True,
                     dropout=0.3, recurrent_dropout=0.2,
                     kernel_regularizer=l2(0.001),
                     kernel_initializer='he_normal')
            ),

            BatchNormalization(),

            # Second LSTM layer
            LSTM(64, return_sequences=True,
                 dropout=0.3, recurrent_dropout=0.2,
                 kernel_regularizer=l2(0.001),
                 kernel_initializer='he_normal'),

            BatchNormalization(),

            # Third LSTM layer
            LSTM(32, return_sequences=False,
                 dropout=0.3, recurrent_dropout=0.2,
                 kernel_regularizer=l2(0.001),
                 kernel_initializer='he_normal'),

            # Dense layers with regularization
            Dense(64, activation='relu', kernel_regularizer=l2(0.001)),
            Dropout(0.4),
            BatchNormalization(),

            Dense(32, activation='relu', kernel_regularizer=l2(0.001)),
            Dropout(0.3),

            Dense(16, activation='relu', kernel_regularizer=l2(0.001)),
            Dropout(0.2),

            Dense(1, activation='sigmoid')
        ])

        # Use learning rate schedule
        initial_learning_rate = 0.001
        lr_schedule = tf.keras.optimizers.schedules.ExponentialDecay(
            initial_learning_rate,
            decay_steps=100,
            decay_rate=0.9,
            staircase=True
        )

        model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=lr_schedule, clipnorm=1.0),
            loss='mse',
            metrics=['mae', tf.keras.metrics.RootMeanSquaredError()]
        )

        self.model = model
        self.built = True
        return model

    def predict_next(self, recent_features):
        """
        Enhanced prediction with uncertainty estimation
        """
        if len(recent_features.shape) == 2:
            X = recent_features.reshape(1, self.sequence_length, self.n_features)
        else:
            X = recent_features

        # Get prediction
        prediction = self.predict(X)[0]

        # Monte Carlo Dropout for uncertainty (if in training mode)
        # For simplicity, use prediction variance from last layer
        if hasattr(self.model.layers[-2], 'output'):
            # Simple confidence based on prediction stability
            last_difficulty = recent_features[-1][7] if len(recent_features) >= self.sequence_length else prediction
            stability = 1 - abs(prediction - last_difficulty)
            confidence = np.clip(stability * 0.8 + 0.2, 0.5, 0.95)
        else:
            confidence = 0.8

        # Apply adaptive smoothing
        if len(recent_features) >= self.sequence_length:
            # More smoothing when uncertain
            last_difficulty = recent_features[-1][7]
            smooth_factor = 0.7 if confidence > 0.8 else 0.5
            smoothed = smooth_factor * prediction + (1 - smooth_factor) * last_difficulty
        else:
            smoothed = prediction

        return {
            'predicted_difficulty': float(np.clip(prediction, 0.2, 0.95)),
            'smoothed_difficulty': float(np.clip(smoothed, 0.2, 0.95)),
            'confidence': float(confidence)
        }