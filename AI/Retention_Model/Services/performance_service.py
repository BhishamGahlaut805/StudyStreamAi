"""Performance Metrics Service for retention analytics endpoints."""
import json
import logging
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


class PerformanceService:
    """Computes retention-related performance metrics for API consumption."""

    def __init__(self, config):
        self.config = config
        self.metrics_history: Dict[str, Dict] = {}

    def _student_dir(self, user_id: str) -> str:
        return os.path.join(self.config.STUDENT_DATA_DIR, user_id)

    def _load_interactions(self, user_id: str, days: int = 30, subject: Optional[str] = None) -> pd.DataFrame:
        path = os.path.join(self._student_dir(user_id), "raw_data", "interactions.csv")
        if not os.path.exists(path):
            return pd.DataFrame()
        df = pd.read_csv(path)

        if "timestamp" in df.columns and days > 0:
            cutoff = datetime.now() - timedelta(days=days)
            df["timestamp_dt"] = pd.to_datetime(df["timestamp"], errors="coerce")
            df = df[df["timestamp_dt"] >= cutoff]

        if subject and "subject" in df.columns:
            df = df[df["subject"].astype(str).str.lower() == subject.lower()]

        return df

    def _load_daily(self, user_id: str, days: int = 30, subject: Optional[str] = None) -> pd.DataFrame:
        path = os.path.join(self._student_dir(user_id), "raw_data", "daily_aggregates.csv")
        if not os.path.exists(path):
            return pd.DataFrame()
        df = pd.read_csv(path)

        if "date" in df.columns and days > 0:
            cutoff = (datetime.now() - timedelta(days=days)).date()
            df["date_dt"] = pd.to_datetime(df["date"], errors="coerce").dt.date
            df = df[df["date_dt"] >= cutoff]

        if subject and "subject" in df.columns:
            df = df[df["subject"].astype(str).str.lower() == subject.lower()]

        return df

    def _default_metrics(self, user_id: str, subject: Optional[str] = None) -> Dict:
        return {
            "timestamp": datetime.now().isoformat(),
            "user_id": user_id,
            "subject": subject,
            "learning_velocity": {"value": 0.0, "trend": "stable", "new_topics_total": 0},
            "retention_rate": {"overall": 0.0, "by_difficulty": {}, "trend": "stable"},
            "stress_pattern": {
                "average_stress": 0.3,
                "max_stress": 0.3,
                "volatility": 0.0,
                "high_stress_moments": 0,
                "risk_level": "low",
            },
            "fatigue_index": {
                "average_fatigue": 0.3,
                "current_fatigue": 0.3,
                "trend": "stable",
                "risk_level": "low",
            },
            "focus_score": {"average": 0.5, "trend": "stable", "peak_hours": []},
            "confidence_trend": {"average": 0.5, "trend": "stable", "calibration": "neutral"},
            "mastery_progress": {
                "overall": 0.0,
                "topics_mastered": 0,
                "topics_struggling": 0,
                "struggling_list": [],
            },
            "efficiency_score": {"score": 0.0},
            "consistency_index": {"score": 0.5},
            "momentum_score": {"score": 0.5, "direction": "neutral"},
            "learning_efficiency": {"score": 0.0, "rank": "beginner", "percentile": 10},
        }

    def calculate_all_metrics(self, user_id: str, days: int = 30, subject: Optional[str] = None) -> Dict:
        interactions = self._load_interactions(user_id, days=days, subject=subject)
        daily = self._load_daily(user_id, days=days, subject=subject)

        if interactions.empty:
            metrics = self._default_metrics(user_id, subject)
            self.metrics_history[user_id] = metrics
            return metrics

        accuracy = float(interactions.get("correct", pd.Series([0.0])).mean())

        if "topic_id" in interactions.columns:
            topic_scores = interactions.groupby("topic_id")["correct"].mean().to_dict()
        else:
            topic_scores = {}

        mastered = [k for k, v in topic_scores.items() if v >= 0.8]
        struggling = [k for k, v in topic_scores.items() if v < 0.5]

        stress_series = interactions.get("stress_level", pd.Series([0.3]))
        fatigue_series = interactions.get("fatigue_index", pd.Series([0.3]))
        focus_series = interactions.get("focus_score", pd.Series([0.5]))
        confidence_series = interactions.get("confidence", pd.Series([0.5]))

        if "timestamp" in interactions.columns:
            interactions["hour"] = pd.to_datetime(interactions["timestamp"], errors="coerce").dt.hour
            focus_by_hour = interactions.groupby("hour")["focus_score"].mean().to_dict() if "focus_score" in interactions.columns else {}
        else:
            focus_by_hour = {}

        if "difficulty" in interactions.columns:
            by_difficulty = {
                str(k): float(v)
                for k, v in interactions.groupby("difficulty")["correct"].mean().to_dict().items()
            }
        else:
            by_difficulty = {}

        if len(interactions) >= 10:
            split = max(1, int(len(interactions) * 0.8))
            older = float(interactions.iloc[:split]["correct"].mean())
            recent = float(interactions.iloc[split:]["correct"].mean())
            delta = recent - older
        else:
            delta = 0.0

        momentum_direction = "positive" if delta > 0.05 else "negative" if delta < -0.05 else "neutral"
        momentum_score = float(min(1.0, max(0.0, 0.5 + delta)))

        if not daily.empty and "new_topics_learned" in daily.columns:
            velocity_val = float(daily["new_topics_learned"].mean())
            if len(daily) >= 7:
                trend = "accelerating" if daily.tail(7)["new_topics_learned"].mean() > daily.head(max(1, len(daily) - 7))["new_topics_learned"].mean() else "stable"
            else:
                trend = "stable"
        else:
            velocity_val = float(len(mastered) / max(1, days))
            trend = "stable"

        consistency = 1.0 - float(interactions["correct"].rolling(5, min_periods=2).std().fillna(0).mean())
        consistency = float(max(0.0, min(1.0, consistency)))

        efficiency = float(
            max(
                0.0,
                min(
                    1.0,
                    0.35 * accuracy + 0.2 * min(1.0, velocity_val / 5.0) + 0.2 * consistency + 0.25 * momentum_score,
                ),
            )
        )
        if efficiency > 0.8:
            rank, percentile = "expert", 95
        elif efficiency > 0.6:
            rank, percentile = "advanced", 75
        elif efficiency > 0.4:
            rank, percentile = "intermediate", 50
        else:
            rank, percentile = "beginner", 25

        metrics = {
            "timestamp": datetime.now().isoformat(),
            "user_id": user_id,
            "subject": subject,
            "learning_velocity": {
                "value": round(velocity_val, 3),
                "trend": trend,
                "new_topics_total": len(mastered),
            },
            "retention_rate": {
                "overall": round(accuracy, 3),
                "by_difficulty": by_difficulty,
                "trend": "improving" if delta > 0.05 else "declining" if delta < -0.05 else "stable",
            },
            "stress_pattern": {
                "average_stress": round(float(stress_series.mean()), 3),
                "max_stress": round(float(stress_series.max()), 3),
                "volatility": round(float(stress_series.std() if len(stress_series) > 1 else 0.0), 3),
                "high_stress_moments": int((stress_series > 0.7).sum()),
                "risk_level": "high" if float(stress_series.mean()) > 0.6 else "medium" if float(stress_series.mean()) > 0.4 else "low",
            },
            "fatigue_index": {
                "average_fatigue": round(float(fatigue_series.mean()), 3),
                "current_fatigue": round(float(fatigue_series.tail(1).mean()), 3),
                "trend": "increasing" if float(fatigue_series.tail(10).mean()) > float(fatigue_series.head(min(10, len(fatigue_series))).mean()) else "stable",
                "risk_level": "high" if float(fatigue_series.mean()) > 0.6 else "medium" if float(fatigue_series.mean()) > 0.4 else "low",
            },
            "focus_score": {
                "average": round(float(focus_series.mean()), 3),
                "trend": "improving" if float(focus_series.tail(10).mean()) > float(focus_series.head(min(10, len(focus_series))).mean()) else "stable",
                "peak_hours": [int(k) for k, v in focus_by_hour.items() if v > 0.7][:4],
            },
            "confidence_trend": {
                "average": round(float(confidence_series.mean()), 3),
                "trend": "increasing" if float(confidence_series.tail(10).mean()) > float(confidence_series.head(min(10, len(confidence_series))).mean()) else "stable",
                "calibration": "overconfident" if float(confidence_series.mean()) - accuracy > 0.1 else "underconfident" if accuracy - float(confidence_series.mean()) > 0.1 else "well-calibrated",
            },
            "mastery_progress": {
                "overall": round(float(np.mean(list(topic_scores.values())) if topic_scores else 0.0), 3),
                "topics_mastered": len(mastered),
                "topics_struggling": len(struggling),
                "struggling_list": [str(t) for t in struggling[:10]],
            },
            "efficiency_score": {"score": round(efficiency, 3)},
            "consistency_index": {"score": round(consistency, 3)},
            "momentum_score": {"score": round(momentum_score, 3), "direction": momentum_direction},
            "learning_efficiency": {"score": round(efficiency, 3), "rank": rank, "percentile": percentile},
        }

        self._save_metrics(user_id, metrics)
        self.metrics_history[user_id] = metrics
        return metrics

    def _save_metrics(self, user_id: str, metrics: Dict):
        metrics_dir = os.path.join(self._student_dir(user_id), "metrics")
        os.makedirs(metrics_dir, exist_ok=True)

        row = {
            "timestamp": metrics["timestamp"],
            "user_id": user_id,
            "subject": metrics.get("subject"),
            "learning_velocity": metrics["learning_velocity"]["value"],
            "retention_rate": metrics["retention_rate"]["overall"],
            "stress_average": metrics["stress_pattern"]["average_stress"],
            "fatigue_average": metrics["fatigue_index"]["average_fatigue"],
            "focus_average": metrics["focus_score"]["average"],
            "topics_mastered": metrics["mastery_progress"]["topics_mastered"],
            "efficiency_score": metrics["efficiency_score"]["score"],
            "learning_efficiency": metrics["learning_efficiency"]["score"],
            "learning_rank": metrics["learning_efficiency"]["rank"],
            "momentum_direction": metrics["momentum_score"]["direction"],
        }

        csv_file = os.path.join(metrics_dir, "performance_metrics.csv")
        df_new = pd.DataFrame([row])
        if os.path.exists(csv_file):
            df_old = pd.read_csv(csv_file)
            df_new = pd.concat([df_old, df_new], ignore_index=True)
        df_new.to_csv(csv_file, index=False)

        json_file = os.path.join(metrics_dir, f"detailed_metrics_{datetime.now().strftime('%Y%m%d')}.json")
        with open(json_file, "w", encoding="utf-8") as f:
            json.dump(metrics, f, indent=2)

    def get_metrics_summary(self, user_id: str, subject: Optional[str] = None) -> Dict:
        metrics = self.calculate_all_metrics(user_id, days=30, subject=subject)
        return {
            "overall_score": round(metrics["learning_efficiency"]["score"] * 100, 1),
            "rank": metrics["learning_efficiency"]["rank"],
            "retention": round(metrics["retention_rate"]["overall"] * 100, 1),
            "stress_level": round(metrics["stress_pattern"]["average_stress"] * 100, 1),
            "fatigue_level": round(metrics["fatigue_index"]["average_fatigue"] * 100, 1),
            "focus_level": round(metrics["focus_score"]["average"] * 100, 1),
            "momentum": metrics["momentum_score"]["direction"],
            "topics_mastered": metrics["mastery_progress"]["topics_mastered"],
            "struggling_topics": metrics["mastery_progress"]["struggling_list"],
        }

    def get_historical_metrics(self, user_id: str, subject: Optional[str] = None, days: int = 30) -> List[Dict]:
        path = os.path.join(self._student_dir(user_id), "metrics", "performance_metrics.csv")
        if not os.path.exists(path):
            return []

        df = pd.read_csv(path)
        if "timestamp" in df.columns and days > 0:
            cutoff = datetime.now() - timedelta(days=days)
            df["timestamp_dt"] = pd.to_datetime(df["timestamp"], errors="coerce")
            df = df[df["timestamp_dt"] >= cutoff]

        if subject and "subject" in df.columns:
            df = df[df["subject"].astype(str).str.lower() == subject.lower()]

        cols = [
            "timestamp",
            "subject",
            "retention_rate",
            "learning_efficiency",
            "stress_average",
            "fatigue_average",
            "focus_average",
            "topics_mastered",
        ]
        cols = [c for c in cols if c in df.columns]
        return df[cols].tail(200).to_dict(orient="records")

    def get_subject_comparison(self, user_id: str) -> Dict:
        interactions = self._load_interactions(user_id, days=90, subject=None)
        if interactions.empty or "subject" not in interactions.columns:
            return {"subjects": {}, "best_subject": None, "needs_support": None}

        subjects = {}
        for subject, sdf in interactions.groupby("subject"):
            acc = float(sdf.get("correct", pd.Series([0.0])).mean())
            stress = float(sdf.get("stress_level", pd.Series([0.3])).mean())
            fatigue = float(sdf.get("fatigue_index", pd.Series([0.3])).mean())
            subjects[str(subject)] = {
                "accuracy": round(acc, 3),
                "stress": round(stress, 3),
                "fatigue": round(fatigue, 3),
                "interactions": int(len(sdf)),
            }

        ranked = sorted(subjects.items(), key=lambda kv: kv[1]["accuracy"], reverse=True)
        best_subject = ranked[0][0] if ranked else None
        needs_support = ranked[-1][0] if ranked else None

        return {
            "subjects": subjects,
            "best_subject": best_subject,
            "needs_support": needs_support,
        }
