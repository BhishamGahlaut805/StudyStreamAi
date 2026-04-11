from sklearn.ensemble import RandomForestRegressor
from .base_model import BaseLSTM
import numpy as np

class LearningVelocityModel(BaseLSTM):
    """
    Predicts future mastery score (next 7 days)
    Features (9): concept_mastery_score_history, practice_frequency_per_day,
                 revision_gap_days, average_difficulty_attempted,
                 success_rate_by_difficulty, retention_score,
                 time_spent_per_concept, improvement_rate_last_week,
                 confidence_growth_trend
    """

    def __init__(self, sequence_length=30, n_features=9):
        super().__init__(sequence_length, n_features, 'learning_velocity')
        self.target = 'future_mastery_score'

    def build_model(self):
        """Build Random Forest regressor for learning velocity prediction."""
        self.model = RandomForestRegressor(
            n_estimators=300,
            max_depth=10,
            min_samples_split=6,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1
        )
        self.built = True
        return self.model

    def predict_next_7_days(self, X):
        """Predict mastery for next 7 days"""
        predictions = []
        current_seq = X.copy()

        for _ in range(7):
            pred = self.predict(current_seq)[0]
            predictions.append(pred)

            # Update sequence (remove first, append prediction)
            if len(current_seq.shape) == 3:
                current_seq = current_seq[0, 1:, :]
                new_row = np.zeros((1, self.n_features))
                new_row[0, 0] = pred  # Replace mastery score
                current_seq = np.vstack([current_seq, new_row])
                current_seq = current_seq.reshape(1, self.sequence_length, self.n_features)

        return predictions
