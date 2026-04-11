import json
import logging
import os
import pickle
import traceback
from abc import ABC, abstractmethod
from datetime import datetime

import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.preprocessing import MinMaxScaler

logger = logging.getLogger(__name__)

class BaseLSTM(ABC):
    """Abstract base class for sequence regressors backed by Random Forest."""

    def __init__(self, sequence_length, n_features, model_type):
        self.sequence_length = sequence_length
        self.n_features = n_features
        self.model_type = model_type
        self.model = None
        self.scaler_X = MinMaxScaler()
        self.scaler_y = MinMaxScaler()
        self.training_history = []
        self.built = False
        logger.info(f"Initialized {model_type} model with seq_len={sequence_length}, n_features={n_features}")

    def _prepare_flat_features(self, X):
        """Convert sequence input into 2D tabular features expected by Random Forest."""
        X = np.asarray(X, dtype=np.float32)

        if len(X.shape) == 2:
            if X.shape == (self.sequence_length, self.n_features):
                X = X.reshape(1, self.sequence_length, self.n_features)
            elif X.shape[1] == self.n_features:
                X = X.reshape(X.shape[0], 1, self.n_features)
            else:
                raise ValueError(f"Invalid 2D shape for X: {X.shape}")

        if len(X.shape) != 3:
            raise ValueError(f"Expected 3D input (samples, seq, features), got {X.shape}")

        if X.shape[2] != self.n_features:
            raise ValueError(f"Feature mismatch: expected {self.n_features}, got {X.shape[2]}")

        return X.reshape(X.shape[0], -1)

    @abstractmethod
    def build_model(self):
        """Build model architecture - to be implemented by subclasses"""
        pass

    def prepare_sequences(self, data, targets):
        """Prepare sequences for LSTM training"""
        X, y = [], []
        for i in range(len(data) - self.sequence_length):
            X.append(data[i:i + self.sequence_length])
            y.append(targets[i + self.sequence_length])

        if not X:
            logger.warning("No sequences created - insufficient data")
            return np.array([]), np.array([])

        logger.debug(f"Created {len(X)} sequences")
        return np.array(X), np.array(y)

    def train(self, X_train, y_train, X_val=None, y_val=None,
              epochs=100, batch_size=32, model_path=None, verbose=0):
        """Train Random Forest regressor while preserving existing history metadata format."""
        logger.info(f"Starting training for {self.model_type} with {len(X_train)} samples")

        try:
            if self.model is None:
                logger.debug("Building model")
                self.build_model()

            X_train_flat = self._prepare_flat_features(X_train)
            logger.debug(f"Flattened X_train to {X_train_flat.shape}")

            # Scale features and targets
            X_train_scaled = self.scaler_X.fit_transform(X_train_flat)
            logger.debug("Scaled features")

            y_train_reshaped = y_train.reshape(-1, 1)
            y_train_scaled = self.scaler_y.fit_transform(y_train_reshaped).flatten()

            self.model.fit(X_train_scaled, y_train_scaled)

            train_pred_scaled = self.model.predict(X_train_scaled).reshape(-1, 1)
            train_pred = self.scaler_y.inverse_transform(train_pred_scaled).flatten()
            y_train_unscaled = self.scaler_y.inverse_transform(y_train_scaled.reshape(-1, 1)).flatten()

            train_loss = float(mean_squared_error(y_train_unscaled, train_pred))
            train_mae = float(mean_absolute_error(y_train_unscaled, train_pred))
            logger.info(f"Training completed. Final loss: {train_loss:.4f}")

            history_dict_container = {'loss': [train_loss], 'mae': [train_mae]}

            val_loss = None
            if X_val is not None and y_val is not None and len(X_val) > 0:
                X_val_flat = self._prepare_flat_features(X_val)
                X_val_scaled = self.scaler_X.transform(X_val_flat)
                y_val_scaled = self.scaler_y.transform(y_val.reshape(-1, 1)).flatten()
                val_pred_scaled = self.model.predict(X_val_scaled).reshape(-1, 1)
                val_pred = self.scaler_y.inverse_transform(val_pred_scaled).flatten()
                y_val_unscaled = self.scaler_y.inverse_transform(y_val_scaled.reshape(-1, 1)).flatten()
                val_loss = float(mean_squared_error(y_val_unscaled, val_pred))
                history_dict_container['val_loss'] = [val_loss]
                logger.debug(f"Validation loss: {val_loss:.4f}")

            # Store history
            history_dict = {
                'timestamp': datetime.now().isoformat(),
                'epochs_completed': 1,
                'final_loss': train_loss,
                'samples': len(X_train_flat)
            }

            if val_loss is not None:
                history_dict['final_val_loss'] = val_loss

            self.training_history.append(history_dict)

            # Save if path provided
            if model_path:
                self.save(model_path)
                logger.info(f"Model saved to {model_path}")

            class _History:
                def __init__(self, history):
                    self.history = history

            return _History(history_dict_container)

        except Exception as e:
            logger.error(f"Training error: {e}\n{traceback.format_exc()}")
            raise

    def predict(self, X):
        """Predict using trained model"""
        if self.model is None:
            raise ValueError("Model not trained. Call train() or load() first.")

        try:
            X_flat = self._prepare_flat_features(X)
            X_scaled = self.scaler_X.transform(X_flat)
            pred_scaled = self.model.predict(X_scaled).reshape(-1, 1)
            pred = self.scaler_y.inverse_transform(pred_scaled)

            return pred.flatten()

        except Exception as e:
            logger.error(f"Prediction error: {e}\n{traceback.format_exc()}")
            raise

    def evaluate(self, X, y):
        """Evaluate model and return (loss, mae) for service compatibility."""
        if self.model is None:
            raise ValueError("Model not trained. Call train() or load() first.")

        X_flat = self._prepare_flat_features(X)
        X_scaled = self.scaler_X.transform(X_flat)

        y = np.asarray(y, dtype=np.float32).reshape(-1, 1)
        y_scaled = self.scaler_y.transform(y).flatten()

        pred_scaled = self.model.predict(X_scaled).reshape(-1, 1)
        pred = self.scaler_y.inverse_transform(pred_scaled).flatten()
        y_unscaled = self.scaler_y.inverse_transform(y_scaled.reshape(-1, 1)).flatten()

        loss = float(mean_squared_error(y_unscaled, pred))
        mae = float(mean_absolute_error(y_unscaled, pred))
        return loss, mae

    def save(self, directory):
        """Save model and scalers"""
        logger.info(f"Saving {self.model_type} model to {directory}")

        try:
            os.makedirs(directory, exist_ok=True)

            # Save model
            model_path = os.path.join(directory, f'{self.model_type}_model.pkl')
            with open(model_path, 'wb') as f:
                pickle.dump(self.model, f)
            logger.debug(f"Model saved to {model_path}")

            # Save scalers
            scaler_X_path = os.path.join(directory, f'{self.model_type}_scaler_X.pkl')
            with open(scaler_X_path, 'wb') as f:
                pickle.dump(self.scaler_X, f)

            scaler_y_path = os.path.join(directory, f'{self.model_type}_scaler_y.pkl')
            with open(scaler_y_path, 'wb') as f:
                pickle.dump(self.scaler_y, f)

            logger.debug(f"Scalers saved")

            # Save metadata
            metadata = {
                'sequence_length': self.sequence_length,
                'n_features': self.n_features,
                'model_type': self.model_type,
                'model_backend': 'random_forest_regressor',
                'feature_count_flattened': self.sequence_length * self.n_features,
                'training_history': self.training_history,
                'last_saved': datetime.now().isoformat()
            }
            metadata_path = os.path.join(directory, f'{self.model_type}_metadata.json')
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)

            logger.info(f"{self.model_type} model successfully saved")

        except Exception as e:
            logger.error(f"Error saving model: {e}\n{traceback.format_exc()}")
            raise

    def load(self, directory):
        """Load model and scalers"""
        logger.info(f"Loading {self.model_type} model from {directory}")

        try:
            model_path = os.path.join(directory, f'{self.model_type}_model.pkl')
            if not os.path.exists(model_path):
                legacy_h5_path = os.path.join(directory, f'{self.model_type}_model.h5')
                raise FileNotFoundError(
                    f"Model file not found: {model_path}. Legacy file present: {os.path.exists(legacy_h5_path)}"
                )

            with open(model_path, 'rb') as f:
                self.model = pickle.load(f)
            self.built = True
            logger.debug(f"Model loaded from {model_path}")

            # Load scalers
            scaler_X_path = os.path.join(directory, f'{self.model_type}_scaler_X.pkl')
            if os.path.exists(scaler_X_path):
                with open(scaler_X_path, 'rb') as f:
                    self.scaler_X = pickle.load(f)
                logger.debug("Scaler_X loaded")

            scaler_y_path = os.path.join(directory, f'{self.model_type}_scaler_y.pkl')
            if os.path.exists(scaler_y_path):
                with open(scaler_y_path, 'rb') as f:
                    self.scaler_y = pickle.load(f)
                logger.debug("Scaler_y loaded")

            # Load metadata
            metadata_path = os.path.join(directory, f'{self.model_type}_metadata.json')
            if os.path.exists(metadata_path):
                with open(metadata_path, 'r') as f:
                    metadata = json.load(f)
                    self.sequence_length = metadata.get('sequence_length', self.sequence_length)
                    self.n_features = metadata.get('n_features', self.n_features)
                    self.training_history = metadata.get('training_history', [])
                logger.debug("Metadata loaded")

            logger.info(f"{self.model_type} model successfully loaded")
            return self

        except Exception as e:
            logger.error(f"Error loading model: {e}\n{traceback.format_exc()}")
            raise
