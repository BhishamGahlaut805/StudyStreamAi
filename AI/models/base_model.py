import numpy as np
import tensorflow as tf
from tensorflow.keras.models import load_model
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau, ModelCheckpoint
from sklearn.preprocessing import MinMaxScaler
import pickle
import os
import json
import logging
from datetime import datetime
from abc import ABC, abstractmethod
import traceback

logger = logging.getLogger(__name__)

class BaseLSTM(ABC):
    """Abstract base class for all LSTM models"""

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
        """Train the model"""
        logger.info(f"Starting training for {self.model_type} with {len(X_train)} samples")

        try:
            if self.model is None:
                logger.debug("Building model")
                self.build_model()

            # Ensure correct shape
            if len(X_train.shape) == 2:
                X_train = X_train.reshape(-1, self.sequence_length, self.n_features)
                logger.debug(f"Reshaped X_train to {X_train.shape}")

            # Scale features
            original_shape = X_train.shape
            X_train_reshaped = X_train.reshape(-1, self.n_features)
            X_train_scaled = self.scaler_X.fit_transform(X_train_reshaped).reshape(original_shape)
            logger.debug("Scaled features")

            # Scale targets
            y_train_reshaped = y_train.reshape(-1, 1)
            y_train_scaled = self.scaler_y.fit_transform(y_train_reshaped).flatten()

            validation_data = None
            if X_val is not None and y_val is not None and len(X_val) > 0:
                if len(X_val.shape) == 2:
                    X_val = X_val.reshape(-1, self.sequence_length, self.n_features)

                X_val_reshaped = X_val.reshape(-1, self.n_features)
                X_val_scaled = self.scaler_X.transform(X_val_reshaped).reshape(X_val.shape)
                y_val_scaled = self.scaler_y.transform(y_val.reshape(-1, 1)).flatten()
                validation_data = (X_val_scaled, y_val_scaled)
                logger.debug(f"Validation data prepared with {len(X_val)} samples")

            # Callbacks
            callbacks = [
                EarlyStopping(patience=10, restore_best_weights=True,
                             monitor='val_loss' if validation_data else 'loss'),
                ReduceLROnPlateau(factor=0.5, patience=5, min_lr=0.00001,
                                monitor='val_loss' if validation_data else 'loss')
            ]

            if model_path:
                checkpoint_path = os.path.join(model_path, f'{self.model_type}_checkpoint.h5')
                callbacks.append(ModelCheckpoint(
                    checkpoint_path, save_best_only=True,
                    monitor='val_loss' if validation_data else 'loss'
                ))

            # Train
            history = self.model.fit(
                X_train_scaled, y_train_scaled,
                epochs=epochs,
                batch_size=batch_size,
                validation_data=validation_data,
                callbacks=callbacks,
                verbose=verbose
            )

            logger.info(f"Training completed. Final loss: {history.history['loss'][-1]:.4f}")

            # Store history
            history_dict = {
                'timestamp': datetime.now().isoformat(),
                'epochs_completed': len(history.history['loss']),
                'final_loss': float(history.history['loss'][-1]),
                'samples': len(X_train)
            }

            if validation_data:
                history_dict['final_val_loss'] = float(history.history['val_loss'][-1])

            self.training_history.append(history_dict)

            # Save if path provided
            if model_path:
                self.save(model_path)
                logger.info(f"Model saved to {model_path}")

            return history

        except Exception as e:
            logger.error(f"Training error: {e}\n{traceback.format_exc()}")
            raise

    def predict(self, X):
        """Predict using trained model"""
        if self.model is None:
            raise ValueError("Model not trained. Call train() or load() first.")

        try:
            # Handle different input shapes
            if len(X.shape) == 2:
                if X.shape[0] == self.sequence_length and X.shape[1] == self.n_features:
                    X = X.reshape(1, self.sequence_length, self.n_features)
                else:
                    raise ValueError(f"Expected 3D input or 2D (seq_len, features). Got {X.shape}")

            # Scale
            X_reshaped = X.reshape(-1, self.n_features)
            X_scaled = self.scaler_X.transform(X_reshaped).reshape(X.shape)

            # Predict
            pred_scaled = self.model.predict(X_scaled, verbose=0)
            pred = self.scaler_y.inverse_transform(pred_scaled)

            return pred.flatten()

        except Exception as e:
            logger.error(f"Prediction error: {e}\n{traceback.format_exc()}")
            raise

    def save(self, directory):
        """Save model and scalers"""
        logger.info(f"Saving {self.model_type} model to {directory}")

        try:
            os.makedirs(directory, exist_ok=True)

            # Save model
            model_path = os.path.join(directory, f'{self.model_type}_model.h5')
            self.model.save(model_path)
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
            model_path = os.path.join(directory, f'{self.model_type}_model.h5')

            if not os.path.exists(model_path):
                raise FileNotFoundError(f"Model file not found: {model_path}")

            # Keras 3 compatibility: load without compile state to avoid
            # deserialization failures for legacy metric/loss objects.
            self.model = load_model(model_path, compile=False)
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
