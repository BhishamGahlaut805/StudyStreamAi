"""
Meso-LSTM Model - Chapter-level retention prediction
"""
import tensorflow as tf
from tensorflow.keras import layers, models
import numpy as np
import logging

logger = logging.getLogger(__name__)

class TopicRetentionLSTM:
    """
    Predicts chapter-level retention at 7, 30, 90 days
    Input: Daily aggregates (30 days) + topic metadata
    Output: Retention at 7, 30, 90 days
    """

    def __init__(self, sequence_length=30, n_temporal_features=8, n_metadata_features=15):
        self.sequence_length = sequence_length
        self.n_temporal_features = n_temporal_features
        self.n_metadata_features = n_metadata_features
        self.model = self._build_model()
        self.history = None
        self._inference_fn = None

    def _get_inference_fn(self):
        """Build once and reuse to keep TensorFlow tracing stable across requests."""
        if self._inference_fn is None:
            @tf.function(reduce_retracing=True)
            def _infer(X_temporal, X_metadata):
                return self.model([X_temporal, X_metadata], training=False)
            self._inference_fn = _infer
        return self._inference_fn

    def _build_model(self):
        """Build the meso-LSTM architecture"""

        # Temporal sequence input (daily aggregates)
        temporal_input = layers.Input(
            shape=(self.sequence_length, self.n_temporal_features),
            name='temporal_sequence'
        )

        # 1D Convolutional layers for feature extraction
        x = layers.Conv1D(filters=64, kernel_size=7, padding='same', activation='relu')(temporal_input)
        x = layers.BatchNormalization()(x)
        x = layers.MaxPooling1D(pool_size=2)(x)

        x = layers.Conv1D(filters=128, kernel_size=5, padding='same', activation='relu')(x)
        x = layers.BatchNormalization()(x)
        x = layers.MaxPooling1D(pool_size=2)(x)

        # LSTM for temporal dependencies
        x = layers.LSTM(128, return_sequences=True, dropout=0.2)(x)
        x = layers.LSTM(64, dropout=0.2)(x)

        # Topic metadata input
        metadata_input = layers.Input(
            shape=(self.n_metadata_features,),
            name='topic_metadata'
        )

        # Process metadata
        y = layers.Dense(32, activation='relu')(metadata_input)
        y = layers.Dropout(0.2)(y)

        # Combine temporal and metadata features
        combined = layers.Concatenate()([x, y])

        # Dense layers
        z = layers.Dense(128, activation='relu')(combined)
        z = layers.Dropout(0.3)(z)
        z = layers.Dense(64, activation='relu')(z)
        z = layers.Dropout(0.2)(z)

        # Multiple outputs for different time horizons
        retention_7d = layers.Dense(1, activation='sigmoid', name='retention_7d')(z)
        retention_30d = layers.Dense(1, activation='sigmoid', name='retention_30d')(z)
        retention_90d = layers.Dense(1, activation='sigmoid', name='retention_90d')(z)

        model = models.Model(
            inputs=[temporal_input, metadata_input],
            outputs=[retention_7d, retention_30d, retention_90d]
        )

        # Compile model
        model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
            loss={
                'retention_7d': 'mse',
                'retention_30d': 'mse',
                'retention_90d': 'mse'
            },
            loss_weights={
                'retention_7d': 0.2,
                'retention_30d': 0.3,
                'retention_90d': 0.5
            },
            metrics={
                'retention_7d': ['mae'],
                'retention_30d': ['mae'],
                'retention_90d': ['mae']
            }
        )

        logger.info("Meso-LSTM model built successfully")
        return model

    def fit(self, X_temporal, X_metadata, y, X_val_temporal=None, X_val_metadata=None, y_val=None,
            epochs=50, batch_size=32, **kwargs):
        """Train the model"""

        callbacks = [
            tf.keras.callbacks.EarlyStopping(
                monitor='val_loss' if X_val_temporal is not None else 'loss',
                patience=10,
                restore_best_weights=True
            ),
            tf.keras.callbacks.ReduceLROnPlateau(
                monitor='val_loss' if X_val_temporal is not None else 'loss',
                factor=0.5,
                patience=5,
                min_lr=0.00001
            )
        ]

        validation_data = None
        if X_val_temporal is not None and X_val_metadata is not None and y_val is not None:
            validation_data = ([X_val_temporal, X_val_metadata], y_val)

        self.history = self.model.fit(
            [X_temporal, X_metadata],
            y,
            validation_data=validation_data,
            epochs=epochs,
            batch_size=batch_size,
            callbacks=callbacks,
            verbose=1,
            **kwargs
        )

        return self.history

    def predict(self, X_temporal, X_metadata):
        """Predict retention"""
        X_temporal = tf.convert_to_tensor(np.asarray(X_temporal, dtype=np.float32))
        X_metadata = tf.convert_to_tensor(np.asarray(X_metadata, dtype=np.float32))
        predictions = self._get_inference_fn()(X_temporal, X_metadata)
        return {
            'retention_7d': predictions[0].numpy(),
            'retention_30d': predictions[1].numpy(),
            'retention_90d': predictions[2].numpy()
        }

    def predict_chapter_retention(self, chapter_sequence, chapter_metadata):
        """Predict retention for a single chapter"""
        chapter_sequence = np.asarray(chapter_sequence, dtype=np.float32)
        if len(chapter_sequence) < self.sequence_length:
            # Pad sequence if too short
            padding = np.zeros((self.sequence_length - len(chapter_sequence), self.n_temporal_features), dtype=np.float32)
            chapter_sequence = np.vstack([padding, chapter_sequence])

        sequence = chapter_sequence[-self.sequence_length:].reshape(1, self.sequence_length, self.n_temporal_features)
        metadata = np.asarray(chapter_metadata, dtype=np.float32).reshape(1, self.n_metadata_features)

        sequence_tensor = tf.convert_to_tensor(sequence, dtype=tf.float32)
        metadata_tensor = tf.convert_to_tensor(metadata, dtype=tf.float32)
        pred = self._get_inference_fn()(sequence_tensor, metadata_tensor)

        return {
            'retention_7d': float(pred[0][0][0].numpy()),
            'retention_30d': float(pred[1][0][0].numpy()),
            'retention_90d': float(pred[2][0][0].numpy())
        }

    def predict_all_chapters(self, all_chapters_data):
        """Predict retention for all chapters"""
        results = []

        for chapter_id, data in all_chapters_data.items():
            predictions = self.predict_chapter_retention(
                data['sequence'],
                data['metadata']
            )

            results.append({
                'chapter_id': chapter_id,
                'name': data.get('name', chapter_id),
                **predictions,
                'next_review': self._calculate_next_review(predictions)
            })

        return sorted(results, key=lambda x: x['retention_7d'])

    def _calculate_next_review(self, predictions):
        """Calculate next review timing based on predictions"""
        retention_7d = predictions['retention_7d']

        if retention_7d < 0.3:
            return 'immediate'
        elif retention_7d < 0.5:
            return 'in_3_days'
        elif retention_7d < 0.7:
            return 'in_7_days'
        else:
            return 'in_30_days'

    def save(self, filepath):
        """Save model"""
        self.model.save(filepath)
        logger.info(f"Model saved to {filepath}")

    def load(self, filepath):
        """Load model"""
        self.model = tf.keras.models.load_model(filepath)
        self._inference_fn = None
        logger.info(f"Model loaded from {filepath}")
        return self
