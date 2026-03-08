import numpy as np
import tensorflow as tf
from tensorflow.keras.layers import LSTM, Dense, Dropout
from .base_model import BaseLSTM

class ExamDifficultyModel(BaseLSTM):
    """
    Predicts optimal difficulty for entire exam
    Features (8): overall_accuracy_avg, avg_difficulty_handled,
                  readiness_score, consistency_index,
                  exam_performance_trend, concept_coverage_ratio,
                  time_efficiency_score, stamina_index
    Target: recommended_exam_difficulty (0-1)
    """

    def __init__(self, sequence_length=10, n_features=8):
        super().__init__(sequence_length, n_features, 'exam_difficulty')
        self.target = 'recommended_difficulty'

    def build_model(self):
        """Build LSTM model for exam difficulty prediction"""
        model = tf.keras.Sequential([
            # LSTM layers
            LSTM(64, return_sequences=True,
                 input_shape=(self.sequence_length, self.n_features),
                 dropout=0.2, recurrent_dropout=0.2,
                 kernel_initializer='he_normal'),

            LSTM(32, return_sequences=False,
                 dropout=0.2, recurrent_dropout=0.2,
                 kernel_initializer='he_normal'),

            # Dense layers
            Dense(32, activation='relu', kernel_initializer='he_normal'),
            Dropout(0.3),
            Dense(16, activation='relu', kernel_initializer='he_normal'),
            Dropout(0.2),
            Dense(1, activation='sigmoid')  # Output: difficulty 0-1
        ])

        model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=0.0005),
            loss='mse',
            metrics=['mae']
        )

        self.model = model
        self.built = True
        return model

    def prepare_training_data(self, exam_records):
        """
        Prepare training data from exam records
        exam_records: list of dicts with exam-level features
        """
        if len(exam_records) < self.sequence_length + 3:
            return None

        feature_cols = [
            'overall_accuracy_avg', 'avg_difficulty_handled',
            'readiness_score', 'consistency_index',
            'exam_performance_trend', 'concept_coverage_ratio',
            'time_efficiency_score', 'stamina_index'
        ]

        X = []
        y = []

        for i in range(len(exam_records) - self.sequence_length):
            seq = exam_records[i:i + self.sequence_length]
            X_seq = []
            for record in seq:
                X_seq.append([record.get(col, 0.5) for col in feature_cols])
            X.append(X_seq)

            # Target is the difficulty of next exam
            next_exam = exam_records[i + self.sequence_length]
            y.append(next_exam.get('exam_difficulty', 0.5))

        return {
            'X': np.array(X),
            'y': np.array(y),
            'feature_names': feature_cols
        }

    def predict_exam_difficulty(self, recent_exams, student_readiness=None):
        """
        Predict recommended exam difficulty
        recent_exams: list of recent exam feature vectors
        student_readiness: optional current readiness score
        """
        if len(recent_exams) < self.sequence_length:
            # Pad with defaults
            padding = [[0.5] * self.n_features] * (self.sequence_length - len(recent_exams))
            recent_exams = padding + recent_exams[-self.sequence_length:]

        X = np.array(recent_exams[-self.sequence_length:]).reshape(1, self.sequence_length, self.n_features)
        prediction = self.predict(X)[0]

        # Adjust based on current readiness if provided
        if student_readiness is not None:
            prediction = 0.6 * prediction + 0.4 * student_readiness

        # Categorize difficulty
        if prediction < 0.3:
            level = "easy"
        elif prediction < 0.5:
            level = "medium-easy"
        elif prediction < 0.7:
            level = "medium-hard"
        else:
            level = "hard"

        return {
            'recommended_difficulty': float(prediction),
            'difficulty_level': level,
            'confidence': 0.85 if len(recent_exams) >= self.sequence_length else 0.6
        }
        