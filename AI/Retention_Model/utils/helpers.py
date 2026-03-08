"""
Helper utility functions
"""
import json
import numpy as np
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import logging

logger = logging.getLogger(__name__)

def generate_user_id(email: str) -> str:
    """
    Generate a unique user ID from email
    """
    hash_obj = hashlib.md5(email.encode())
    return f"usr_{hash_obj.hexdigest()[:8]}"

def calculate_forgetting_curve(initial_retention: float,
                              days: List[int],
                              decay_factor: float = 0.15) -> List[Dict]:
    """
    Calculate forgetting curve using exponential decay
    R = R0 * e^(-t/τ)
    """
    tau = 30 * (1 + initial_retention)  # Time constant

    curve = []
    for day in days:
        retention = initial_retention * np.exp(-day / tau)
        curve.append({
            'day': day,
            'retention': float(min(1, max(0, retention)))
        })

    return curve

def calculate_optimal_review_time(retention: float) -> int:
    """
    Calculate optimal next review time in days based on current retention
    """
    if retention < 0.3:
        return 0  # Review immediately
    elif retention < 0.5:
        return 1  # Review tomorrow
    elif retention < 0.7:
        return 3  # Review in 3 days
    elif retention < 0.85:
        return 7  # Review in a week
    else:
        return 30  # Review in a month

def calculate_mastery_score(accuracy: float,
                           response_time_ms: int,
                           attempts: int) -> float:
    """
    Calculate mastery score based on multiple factors
    """
    # Base score from accuracy
    score = accuracy

    # Speed bonus (faster = better)
    speed_factor = max(0, 1 - (response_time_ms / 5000))
    score += speed_factor * 0.1

    # Attempts penalty (more attempts = lower mastery)
    attempts_penalty = max(0, (attempts - 1) * 0.05)
    score -= attempts_penalty

    return float(min(1, max(0, score)))

def calculate_confidence_interval(predictions: List[float],
                                 confidence: float = 0.95) -> Dict:
    """
    Calculate confidence interval for predictions
    """
    mean = np.mean(predictions)
    std = np.std(predictions)

    # Assuming normal distribution
    if confidence == 0.95:
        z_score = 1.96
    elif confidence == 0.99:
        z_score = 2.576
    else:
        z_score = 1.645  # 90% confidence

    margin = z_score * (std / np.sqrt(len(predictions)))

    return {
        'mean': float(mean),
        'lower': float(mean - margin),
        'upper': float(mean + margin),
        'std': float(std)
    }

def normalize_score(score: float, min_val: float = 0, max_val: float = 1) -> float:
    """
    Normalize score to 0-1 range
    """
    if max_val == min_val:
        return 0.5
    return (score - min_val) / (max_val - min_val)

def calculate_trend(values: List[float]) -> float:
    """
    Calculate trend in a series of values
    """
    if len(values) < 2:
        return 0

    x = np.arange(len(values))
    y = np.array(values)

    # Linear regression
    slope = np.polyfit(x, y, 1)[0]

    return float(slope)

def group_by_topic(predictions: List[Dict]) -> Dict:
    """
    Group predictions by topic category
    """
    grouped = {}

    for pred in predictions:
        category = pred.get('category', 'unknown')
        if category not in grouped:
            grouped[category] = []
        grouped[category].append(pred)

    return grouped

def format_retention_report(retention_data: Dict) -> str:
    """
    Format retention data for display
    """
    report = []
    report.append("=" * 50)
    report.append("RETENTION REPORT")
    report.append("=" * 50)

    for category, topics in retention_data.items():
        report.append(f"\n{category.upper()}:")
        report.append("-" * 30)

        for topic in topics[:5]:  # Show top 5
            report.append(
                f"  {topic['topic']}: {topic['retention']*100:.1f}%"
            )

    return "\n".join(report)

def log_performance_metrics(user_id: str, metrics: Dict):
    """
    Log performance metrics for monitoring
    """
    log_entry = {
        'timestamp': datetime.now().isoformat(),
        'user_id': user_id,
        **metrics
    }

    # In production, this would send to monitoring system
    logger.info(f"Performance metrics for {user_id}: {json.dumps(metrics)}")

    return log_entry

def get_time_of_day(hour: int) -> str:
    """
    Get time of day category from hour
    """
    if 5 <= hour < 12:
        return 'morning'
    elif 12 <= hour < 17:
        return 'afternoon'
    elif 17 <= hour < 21:
        return 'evening'
    else:
        return 'night'

def calculate_study_streak(session_dates: List[str]) -> int:
    """
    Calculate current study streak in days
    """
    if not session_dates:
        return 0

    dates = sorted([datetime.fromisoformat(d).date() for d in session_dates])

    streak = 1
    for i in range(len(dates) - 1):
        if (dates[i + 1] - dates[i]).days == 1:
            streak += 1
        else:
            streak = 1

    return streak
