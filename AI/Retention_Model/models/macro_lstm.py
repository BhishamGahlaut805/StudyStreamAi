"""
Macro-LSTM Model - Long-term learning path optimization
"""
import tensorflow as tf
from tensorflow.keras import layers, models
import numpy as np
import logging

logger = logging.getLogger(__name__)

class LearningPathLSTM:
    """
    Generates optimal long-term learning sequences
    Uses encoder-decoder architecture with attention
    """

    def __init__(self, encoder_units=256, decoder_units=256, n_topics=50):
        self.encoder_units = encoder_units
        self.decoder_units = decoder_units
        self.n_topics = n_topics
        self.model = self._build_model()
        self.history = None
        self._inference_fn = None

    def _get_inference_fn(self):
        """Build once and reuse to avoid repeated retracing under API load."""
        if self._inference_fn is None:
            @tf.function(reduce_retracing=True)
            def _infer(encoder_input, decoder_input):
                return self.model([encoder_input, decoder_input], training=False)
            self._inference_fn = _infer
        return self._inference_fn

    def _build_model(self):
        """Build encoder-decoder LSTM with attention"""

        # ----- Encoder -----
        encoder_inputs = layers.Input(shape=(None, 20), name='encoder_input')  # Variable length history
        encoder_lstm = layers.LSTM(
            self.encoder_units,
            return_state=True,
            return_sequences=True,
            dropout=0.2,
            recurrent_dropout=0.2
        )
        encoder_outputs, state_h, state_c = encoder_lstm(encoder_inputs)
        encoder_states = [state_h, state_c]

        # ----- Decoder -----
        decoder_inputs = layers.Input(shape=(None, 15), name='decoder_input')  # Future sequence to generate
        decoder_lstm = layers.LSTM(
            self.decoder_units,
            return_sequences=True,
            return_state=True,
            dropout=0.2,
            recurrent_dropout=0.2
        )
        decoder_outputs, _, _ = decoder_lstm(decoder_inputs, initial_state=encoder_states)

        # ----- Attention Mechanism -----
        attention = layers.Attention()([decoder_outputs, encoder_outputs])
        decoder_concat = layers.Concatenate(axis=-1)([decoder_outputs, attention])

        # ----- Output Layers -----
        # Topic prediction (which topic to study next)
        topic_output = layers.TimeDistributed(
            layers.Dense(self.n_topics, activation='softmax'),
            name='next_topics'
        )(decoder_concat)

        # Retention targets (expected retention after studying)
        retention_output = layers.TimeDistributed(
            layers.Dense(1, activation='sigmoid'),
            name='retention_targets'
        )(decoder_concat)

        # Build model
        model = models.Model(
            inputs=[encoder_inputs, decoder_inputs],
            outputs=[topic_output, retention_output]
        )

        # Compile model
        model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
            loss={
                'next_topics': 'categorical_crossentropy',
                'retention_targets': 'mse'
            },
            loss_weights={
                'next_topics': 0.7,
                'retention_targets': 0.3
            },
            metrics={
                'next_topics': ['accuracy'],
                'retention_targets': ['mae']
            }
        )

        logger.info("Macro-LSTM model built successfully")
        return model

    def fit(self, encoder_input, decoder_input, targets,
            val_encoder=None, val_decoder=None, val_targets=None,
            epochs=50, batch_size=32, **kwargs):
        """Train the model"""

        callbacks = [
            tf.keras.callbacks.EarlyStopping(
                monitor='val_loss' if val_encoder is not None else 'loss',
                patience=10,
                restore_best_weights=True
            ),
            tf.keras.callbacks.ReduceLROnPlateau(
                monitor='val_loss' if val_encoder is not None else 'loss',
                factor=0.5,
                patience=5,
                min_lr=0.00001
            )
        ]

        validation_data = None
        if val_encoder is not None and val_decoder is not None and val_targets is not None:
            validation_data = ([val_encoder, val_decoder], val_targets)

        self.history = self.model.fit(
            [encoder_input, decoder_input],
            targets,
            validation_data=validation_data,
            epochs=epochs,
            batch_size=batch_size,
            callbacks=callbacks,
            verbose=1,
            **kwargs
        )

        return self.history

    def predict_learning_path(self, history_sequence, future_length=30):
        """Predict optimal learning path for next N days"""

        history_sequence = np.asarray(history_sequence, dtype=np.float32)

        # Prepare encoder input
        if len(history_sequence) < self.encoder_units:
            # Pad if too short
            padding = np.zeros((self.encoder_units - len(history_sequence), history_sequence.shape[1]), dtype=np.float32)
            encoder_input = np.vstack([padding, history_sequence])
        else:
            encoder_input = history_sequence[-self.encoder_units:]

        encoder_input = encoder_input.reshape(1, -1, 20).astype(np.float32)

        # Prepare decoder input (start with zeros)
        decoder_input = np.zeros((1, future_length, 15), dtype=np.float32)

        # Generate path autoregressively
        path = []
        infer = self._get_inference_fn()

        for day in range(future_length):
            # Keep input shapes stable across loop iterations to avoid tf retracing.
            topic_probs, retention_pred = infer(
                tf.convert_to_tensor(encoder_input, dtype=tf.float32),
                tf.convert_to_tensor(decoder_input, dtype=tf.float32),
            )

            topic_probs_np = topic_probs.numpy()
            retention_pred_np = retention_pred.numpy()

            # Get recommended topic
            topic_idx = int(np.argmax(topic_probs_np[0, day]))
            predicted_retention = float(retention_pred_np[0, day, 0])

            # Store prediction
            path.append({
                'day': day + 1,
                'recommended_topic': f"topic_{topic_idx}",
                'topic_id': int(topic_idx),
                'expected_retention': predicted_retention,
                'confidence': float(np.max(topic_probs_np[0, day]))
            })

            # Update decoder input for next iteration
            if day < future_length - 1:
                decoder_input[0, day + 1, 0] = topic_idx
                decoder_input[0, day + 1, 1] = predicted_retention

        return {
            'path': path,
            'summary': self._generate_path_summary(path),
            'milestones': self._identify_milestones(path)
        }

    def _generate_path_summary(self, path):
        """Generate summary of learning path"""
        avg_retention = np.mean([p['expected_retention'] for p in path])

        # Group by week
        weeks = {}
        for p in path:
            week = (p['day'] - 1) // 7
            if week not in weeks:
                weeks[week] = []
            weeks[week].append(p)

        weekly_summary = []
        for week, days in weeks.items():
            weekly_summary.append({
                'week': week + 1,
                'days': len(days),
                'topics': list(set([d['topic_id'] for d in days])),
                'avg_retention': np.mean([d['expected_retention'] for d in days])
            })

        return {
            'total_days': len(path),
            'avg_retention': float(avg_retention),
            'weekly_breakdown': weekly_summary
        }

    def _identify_milestones(self, path):
        """Identify key milestones in learning path"""
        milestones = []

        for i, p in enumerate(path):
            # Every 7 days
            if (p['day'] % 7) == 0:
                milestones.append({
                    'day': p['day'],
                    'type': 'weekly_review',
                    'description': f"Week {p['day']//7} completion"
                })

            # When retention drops below threshold
            if p['expected_retention'] < 0.4:
                milestones.append({
                    'day': p['day'],
                    'type': 'intervention_needed',
                    'description': f"Retention critical at {p['expected_retention']:.2f}"
                })

        return milestones

    def fine_tune(self, new_data, epochs=10):
        """Fine-tune model with new user data"""
        # This would implement transfer learning
        logger.info(f"Fine-tuning model with {len(new_data)} new samples")
        # Implementation would go here
        pass

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
