import numpy as np
import tensorflow as tf
from tensorflow.keras.layers import LSTM, Dense, Dropout, Bidirectional, BatchNormalization, Attention
from tensorflow.keras.regularizers import l2
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
from .base_model import BaseLSTM
import logging
import pandas as pd
import json
import os
from datetime import datetime

logger = logging.getLogger(__name__)

class GlobalReadinessModel(BaseLSTM):
    """
    Predicts global readiness difficulty score based on session-level features
    Features (12): session_accuracy_avg, avg_solved_difficulty, max_difficulty_sustained,
                  performance_trend_slope, retention_score, burnout_risk_index,
                  stress_trend_slope, concept_coverage_ratio, high_difficulty_accuracy,
                  consistency_index, avg_response_time_trend, serious_test_performance_score
    Target: readiness_difficulty_score (0-1)
    """

    def __init__(self, sequence_length=5, n_features=12):
        """
        Initialize Global Readiness Model

        Args:
            sequence_length: Number of past sessions to consider (default: 5)
            n_features: Number of input features (default: 12)
        """
        super().__init__(sequence_length, n_features, 'global_readiness')
        self.target = 'readiness_difficulty_score'
        logger.info(f"Initialized GlobalReadinessModel with seq_len={sequence_length}, n_features={n_features}")

    def build_model(self):
        """
        Build enhanced LSTM model for global readiness prediction
        Architecture: Bidirectional LSTM with attention mechanism
        """
        logger.info("Building GlobalReadinessModel architecture")

        try:
            # Input layer
            inputs = tf.keras.Input(shape=(self.sequence_length, self.n_features))

            # Batch normalization for input stability
            x = BatchNormalization()(inputs)

            # First Bidirectional LSTM layer
            x = Bidirectional(
                LSTM(128,
                     return_sequences=True,
                     dropout=0.3,
                     recurrent_dropout=0.2,
                     kernel_regularizer=l2(0.001),
                     kernel_initializer='he_normal')
            )(x)
            x = BatchNormalization()(x)

            # Second Bidirectional LSTM layer
            x = Bidirectional(
                LSTM(64,
                     return_sequences=True,
                     dropout=0.3,
                     recurrent_dropout=0.2,
                     kernel_regularizer=l2(0.001),
                     kernel_initializer='he_normal')
            )(x)
            x = BatchNormalization()(x)

            # Third LSTM layer (unidirectional for final processing)
            x = LSTM(32,
                     return_sequences=False,
                     dropout=0.3,
                     recurrent_dropout=0.2,
                     kernel_regularizer=l2(0.001),
                     kernel_initializer='he_normal'
            )(x)
            x = BatchNormalization()(x)

            # Dense layers with regularization
            x = Dense(64,
                     activation='relu',
                     kernel_regularizer=l2(0.001),
                     kernel_initializer='he_normal')(x)
            x = BatchNormalization()(x)
            x = Dropout(0.4)(x)

            x = Dense(32,
                     activation='relu',
                     kernel_regularizer=l2(0.001),
                     kernel_initializer='he_normal')(x)
            x = BatchNormalization()(x)
            x = Dropout(0.3)(x)

            x = Dense(16,
                     activation='relu',
                     kernel_regularizer=l2(0.001),
                     kernel_initializer='he_normal')(x)
            x = Dropout(0.2)(x)

            # Output layer with sigmoid activation for 0-1 range
            outputs = Dense(1, activation='sigmoid', name='readiness_score')(x)

            # Create model
            model = tf.keras.Model(inputs=inputs, outputs=outputs)

            # Learning rate schedule
            initial_learning_rate = 0.001
            lr_schedule = tf.keras.optimizers.schedules.ExponentialDecay(
                initial_learning_rate,
                decay_steps=100,
                decay_rate=0.9,
                staircase=True
            )

            # Compile model
            model.compile(
                optimizer=Adam(learning_rate=lr_schedule, clipnorm=1.0),
                loss='mse',
                metrics=['mae', tf.keras.metrics.RootMeanSquaredError(name='rmse')]
            )

            self.model = model
            self.built = True

            logger.info("GlobalReadinessModel built successfully")
            logger.info(f"Model summary: {self.model.summary()}")

            return model

        except Exception as e:
            logger.error(f"Error building GlobalReadinessModel: {e}")
            raise

    def build_simplified_model(self):
        """
        Build a simplified version for faster training with less data
        Used when data is limited
        """
        logger.info("Building simplified GlobalReadinessModel")

        model = tf.keras.Sequential([
            # Input layer
            LSTM(64,
                 return_sequences=True,
                 input_shape=(self.sequence_length, self.n_features),
                 dropout=0.2,
                 recurrent_dropout=0.2,
                 kernel_initializer='he_normal'),

            LSTM(32,
                 return_sequences=False,
                 dropout=0.2,
                 recurrent_dropout=0.2,
                 kernel_initializer='he_normal'),

            # Dense layers
            Dense(32, activation='relu', kernel_initializer='he_normal'),
            Dropout(0.3),
            Dense(16, activation='relu', kernel_initializer='he_normal'),
            Dropout(0.2),
            Dense(1, activation='sigmoid')
        ])

        model.compile(
            optimizer=Adam(learning_rate=0.001),
            loss='mse',
            metrics=['mae']
        )

        self.model = model
        self.built = True
        logger.info("Simplified GlobalReadinessModel built successfully")

        return model

    def prepare_sequences(self, df: pd.DataFrame) -> dict:
        """
        Prepare sequences from global features DataFrame

        Args:
            df: DataFrame with global features

        Returns:
            Dictionary with X and y sequences
        """
        logger.info(f"Preparing sequences from DataFrame with {len(df)} rows")

        try:
            from config import Config

            feature_cols = Config.GLOBAL_FEATURES
            target_col = Config.GLOBAL_TARGET

            # Check if all columns exist
            available_cols = [col for col in feature_cols if col in df.columns]
            if len(available_cols) < 8:
                logger.warning(f"Only {len(available_cols)} feature columns available")
                return None

            # Sort by timestamp if available
            if 'timestamp' in df.columns:
                df = df.sort_values('timestamp')

            # Extract features and target
            X = df[available_cols].values.astype(np.float32)
            y = df[target_col].values.astype(np.float32) if target_col in df.columns else None

            if y is None:
                logger.error("Target column not found in DataFrame")
                return None

            # Create sequences
            X_seq, y_seq = self.prepare_sequences(X, y)

            if len(X_seq) == 0:
                logger.warning("No sequences created")
                return None

            logger.info(f"Created {len(X_seq)} sequences")

            return {
                'X': X_seq,
                'y': y_seq,
                'feature_names': available_cols
            }

        except Exception as e:
            logger.error(f"Error preparing sequences: {e}")
            return None

    def predict_readiness(self, recent_sessions: np.ndarray) -> dict:
        """
        Predict readiness score from recent session data

        Args:
            recent_sessions: Array of shape (sequence_length, n_features) or
                            (batch_size, sequence_length, n_features)

        Returns:
            Dictionary with prediction and confidence
        """
        logger.debug(f"Predicting readiness from input shape: {recent_sessions.shape if hasattr(recent_sessions, 'shape') else 'unknown'}")

        try:
            # Handle input shape
            if len(recent_sessions.shape) == 2:
                # Single sequence
                if recent_sessions.shape[0] == self.sequence_length:
                    X = recent_sessions.reshape(1, self.sequence_length, self.n_features)
                else:
                    # Pad or truncate
                    if recent_sessions.shape[0] < self.sequence_length:
                        # Pad with zeros at the beginning
                        padding = np.zeros((self.sequence_length - recent_sessions.shape[0], self.n_features))
                        X = np.vstack([padding, recent_sessions]).reshape(1, self.sequence_length, self.n_features)
                    else:
                        # Take last sequence_length items
                        X = recent_sessions[-self.sequence_length:].reshape(1, self.sequence_length, self.n_features)
            else:
                X = recent_sessions

            # Make prediction
            prediction = self.predict(X)[0]

            # Calculate confidence based on prediction stability
            # For simplicity, use 0.8 as base confidence
            confidence = 0.8

            # Adjust confidence based on available data
            if X.shape[1] < self.sequence_length:
                confidence *= 0.7  # Lower confidence if sequence is padded

            # Categorize readiness level
            if prediction < 0.3:
                level = "low"
                description = "Low readiness - needs significant review"
            elif prediction < 0.5:
                level = "below_average"
                description = "Below average readiness - needs focused practice"
            elif prediction < 0.7:
                level = "average"
                description = "Average readiness - ready for moderate difficulty"
            elif prediction < 0.85:
                level = "good"
                description = "Good readiness - ready for challenging material"
            else:
                level = "excellent"
                description = "Excellent readiness - ready for advanced concepts"

            result = {
                'readiness_score': float(np.clip(prediction, 0, 1)),
                'readiness_level': level,
                'description': description,
                'confidence': float(confidence),
                'sequence_used': X.shape[1]
            }

            logger.debug(f"Readiness prediction: {result}")
            return result

        except Exception as e:
            logger.error(f"Error in predict_readiness: {e}")
            return {
                'readiness_score': 0.5,
                'readiness_level': 'unknown',
                'description': 'Unable to predict due to error',
                'confidence': 0.5,
                'error': str(e)
            }

    def predict_future_readiness(self, current_sequence: np.ndarray, days_ahead: int = 7) -> list:
        """
        Predict readiness scores for future days

        Args:
            current_sequence: Current sequence of shape (sequence_length, n_features)
            days_ahead: Number of days to predict ahead

        Returns:
            List of predicted readiness scores
        """
        logger.info(f"Predicting future readiness for {days_ahead} days ahead")

        predictions = []
        current_seq = current_sequence.copy()

        try:
            for day in range(days_ahead):
                # Predict next day's readiness
                pred = self.predict_readiness(current_seq)['readiness_score']
                predictions.append(pred)

                # Update sequence (remove oldest, add prediction as new feature)
                # This is simplified - in production, you'd use more sophisticated forecasting
                if len(current_seq.shape) == 2:
                    new_row = np.zeros((1, self.n_features))
                    # Set the first feature (accuracy) to the prediction
                    new_row[0, 0] = pred
                    # Keep other features as average of recent
                    new_row[0, 1:] = current_seq[-1, 1:]

                    current_seq = np.vstack([current_seq[1:], new_row])

            logger.info(f"Generated {len(predictions)} future predictions")
            return [float(p) for p in predictions]

        except Exception as e:
            logger.error(f"Error predicting future readiness: {e}")
            return [0.5] * days_ahead

    def get_readiness_trend(self, historical_predictions: list) -> dict:
        """
        Analyze trend in readiness scores

        Args:
            historical_predictions: List of historical readiness scores

        Returns:
            Dictionary with trend analysis
        """
        if len(historical_predictions) < 2:
            return {
                'trend': 'stable',
                'slope': 0,
                'volatility': 0,
                'description': 'Insufficient data for trend analysis'
            }

        try:
            # Calculate trend using linear regression
            x = np.arange(len(historical_predictions))
            y = np.array(historical_predictions)

            slope = np.polyfit(x, y, 1)[0]

            # Calculate volatility (standard deviation)
            volatility = np.std(y)

            # Determine trend direction
            if slope > 0.02:
                trend = 'improving'
                description = f"Readiness is improving at {slope:.3f} points per session"
            elif slope < -0.02:
                trend = 'declining'
                description = f"Readiness is declining at {abs(slope):.3f} points per session"
            else:
                trend = 'stable'
                description = "Readiness is stable"

            # Add volatility assessment
            if volatility > 0.15:
                description += " with high volatility"
            elif volatility > 0.08:
                description += " with moderate volatility"
            else:
                description += " with low volatility"

            return {
                'trend': trend,
                'slope': float(slope),
                'volatility': float(volatility),
                'description': description,
                'latest': float(y[-1]),
                'min': float(np.min(y)),
                'max': float(np.max(y))
            }

        except Exception as e:
            logger.error(f"Error analyzing readiness trend: {e}")
            return {
                'trend': 'unknown',
                'slope': 0,
                'volatility': 0,
                'description': 'Error analyzing trend'
            }

    def get_training_recommendation(self, readiness_score: float) -> dict:
        """
        Get training recommendations based on readiness score

        Args:
            readiness_score: Current readiness score (0-1)

        Returns:
            Dictionary with recommendations
        """
        recommendations = {
            'difficulty_level': '',
            'focus_areas': [],
            'session_duration': '',
            'break_frequency': ''
        }

        if readiness_score < 0.3:
            recommendations['difficulty_level'] = 'easy'
            recommendations['focus_areas'] = ['fundamental concepts', 'core principles']
            recommendations['session_duration'] = '20-30 minutes'
            recommendations['break_frequency'] = 'take a 5-minute break every 15 minutes'
            recommendations['description'] = 'Focus on building foundation with easy questions'

        elif readiness_score < 0.5:
            recommendations['difficulty_level'] = 'medium-easy'
            recommendations['focus_areas'] = ['concept review', 'basic problem-solving']
            recommendations['session_duration'] = '30-40 minutes'
            recommendations['break_frequency'] = 'take a 5-minute break every 20 minutes'
            recommendations['description'] = 'Practice with gradually increasing difficulty'

        elif readiness_score < 0.7:
            recommendations['difficulty_level'] = 'medium-hard'
            recommendations['focus_areas'] = ['application', 'mixed concepts']
            recommendations['session_duration'] = '40-50 minutes'
            recommendations['break_frequency'] = 'take a 10-minute break every 30 minutes'
            recommendations['description'] = 'Challenge yourself with medium-hard questions'

        elif readiness_score < 0.85:
            recommendations['difficulty_level'] = 'hard'
            recommendations['focus_areas'] = ['advanced problems', 'time management']
            recommendations['session_duration'] = '50-60 minutes'
            recommendations['break_frequency'] = 'take a 10-minute break every 40 minutes'
            recommendations['description'] = 'Tackle hard questions and focus on efficiency'

        else:
            recommendations['difficulty_level'] = 'expert'
            recommendations['focus_areas'] = ['complex scenarios', 'comprehensive tests']
            recommendations['session_duration'] = '60+ minutes'
            recommendations['break_frequency'] = 'take a 15-minute break every 50 minutes'
            recommendations['description'] = 'Ready for expert-level material and full-length tests'

        return recommendations

    def save(self, directory):
        """Save model with additional metadata"""
        logger.info(f"Saving GlobalReadinessModel to {directory}")

        # Call parent save method
        super().save(directory)

        # Save additional model-specific metadata
        try:
            metadata_path = os.path.join(directory, f'{self.model_type}_additional_metadata.json')
            additional_metadata = {
                'target': self.target,
                'feature_ranges': {
                    'min': float(self.scaler_X.data_min_.mean()) if hasattr(self.scaler_X, 'data_min_') else 0,
                    'max': float(self.scaler_X.data_max_.mean()) if hasattr(self.scaler_X, 'data_max_') else 1
                },
                'model_version': '1.0.0',
                'last_updated': datetime.now().isoformat()
            }

            with open(metadata_path, 'w') as f:
                json.dump(additional_metadata, f, indent=2)

            logger.info("Additional metadata saved")

        except Exception as e:
            logger.error(f"Error saving additional metadata: {e}")

    def load(self, directory):
        """Load model with additional validation"""
        logger.info(f"Loading GlobalReadinessModel from {directory}")

        # Call parent load method
        super().load(directory)

        # Load additional metadata if available
        try:
            metadata_path = os.path.join(directory, f'{self.model_type}_additional_metadata.json')
            if os.path.exists(metadata_path):
                with open(metadata_path, 'r') as f:
                    additional_metadata = json.load(f)
                    logger.info(f"Loaded additional metadata: {additional_metadata.get('model_version', 'unknown')}")
        except Exception as e:
            logger.warning(f"Could not load additional metadata: {e}")

        return self