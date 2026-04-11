from sklearn.ensemble import RandomForestRegressor
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
        """Build Random Forest regressor for burnout risk probability."""
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
