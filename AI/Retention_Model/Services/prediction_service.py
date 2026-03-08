"""Prediction Service - Serves retention predictions to Flask routes and Node integration."""
import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


class PredictionService:
    """Handles prediction retrieval, filtering, and summary construction."""

    def __init__(self, config):
        self.config = config

    def _student_dir(self, user_id: str) -> str:
        return os.path.join(self.config.STUDENT_DATA_DIR, user_id)

    def _ensure_dirs(self, user_id: str) -> None:
        for name in ["raw_data", "predictions", "metrics", "schedules", "models"]:
            os.makedirs(os.path.join(self._student_dir(user_id), name), exist_ok=True)

    def _load_json(self, path: str, default):
        if not os.path.exists(path):
            return default
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as exc:
            logger.error("Failed reading JSON %s: %s", path, exc)
            return default

    def _load_interactions(self, user_id: str) -> pd.DataFrame:
        interactions_file = os.path.join(self._student_dir(user_id), "raw_data", "interactions.csv")
        if not os.path.exists(interactions_file):
            return pd.DataFrame()
        try:
            return pd.read_csv(interactions_file)
        except Exception:
            return pd.DataFrame()

    def _filter_by_subject(self, micro_preds: List[Dict], subject: Optional[str]) -> List[Dict]:
        if not subject:
            return micro_preds
        subject_l = subject.lower().strip()
        filtered = []
        for item in micro_preds:
            item_subject = str(item.get("subject", "")).lower().strip()
            topic_id = str(item.get("topic_id", "")).lower()
            # Keep unknown rows as fallback so analytics still renders for legacy data.
            if item_subject in {"", "unknown", subject_l} or topic_id.startswith(f"{subject_l}_"):
                filtered.append(item)
        return filtered

    def get_all_predictions(self, user_id: str, subject: Optional[str] = None) -> Dict:
        """Return micro/meso/macro predictions plus forgetting curves."""
        self._ensure_dirs(user_id)
        pred_dir = os.path.join(self._student_dir(user_id), "predictions")

        micro = self._load_json(os.path.join(pred_dir, "micro_predictions.json"), [])
        meso = self._load_json(os.path.join(pred_dir, "meso_predictions.json"), [])
        macro = self._load_json(os.path.join(pred_dir, "macro_predictions.json"), {})

        if subject:
            micro = self._filter_by_subject(micro, subject)
            meso = [
                m for m in meso
                if str(m.get("subject", "")).lower() in {"", "unknown", subject.lower()}
            ]

        curves = self.generate_forgetting_curves(user_id, micro)

        # Format for frontend
        return {
            "user_id": user_id,
            "subject": subject,
            "timestamp": datetime.now().isoformat(),
            "micro": self._format_micro_predictions(micro),
            "meso": self._format_meso_predictions(meso),
            "macro": self._format_macro_predictions(macro),
            "forgetting_curves": curves,
        }

    def _format_micro_predictions(self, micro: List[Dict]) -> List[Dict]:
        """Format micro predictions with proper feature names for frontend"""
        formatted = []
        for pred in micro:
            repeat_in_seconds = int(pred.get("repeat_in_seconds", max(30, int(float(pred.get("repeat_in_days", 1)) * 86400))))
            formatted.append({
                "topic_id": pred.get("topic_id", "unknown"),
                "subject": pred.get("subject", "unknown"),
                "retention_probability": pred.get("current_retention", 0.5),  # Retention Probability
                "next_question_difficulty": self._calculate_next_difficulty(pred.get("current_retention", 0.5)),  # Next Question Difficulty
                "probability_correct_next": pred.get("next_retention", 0.5),  # Probability of Correct Next Attempt
                "stress_impact": pred.get("stress_impact", 0.3),
                "fatigue_level": pred.get("fatigue_level", 0.3),
                "repeat_in_days": pred.get("repeat_in_days", 1),
                "repeat_in_seconds": repeat_in_seconds,
                "timer_frame_label": pred.get("timer_frame_label", f"{repeat_in_seconds}_seconds"),
                "next_repeat_at": (datetime.now() + pd.Timedelta(seconds=repeat_in_seconds)).isoformat(),
                "batch_type": pred.get("batch_type", "medium_term"),
                "updated_at": pred.get("updated_at", datetime.now().isoformat()),
            })
        return formatted

    def _calculate_next_difficulty(self, retention: float) -> int:
        """Calculate optimal next question difficulty based on retention"""
        if retention < 0.3:
            return 1  # Very easy
        elif retention < 0.5:
            return 2  # Easy
        elif retention < 0.7:
            return 3  # Medium
        elif retention < 0.85:
            return 4  # Hard
        else:
            return 5  # Very hard

    def _format_meso_predictions(self, meso: List[Dict]) -> List[Dict]:
        """Format meso predictions with proper feature names for frontend"""
        formatted = []
        for pred in meso:
            formatted.append({
                "subject": pred.get("subject", "unknown"),
                "topic_id": pred.get("topic_id", "unknown"),
                "subject_retention_score": pred.get("retention_7d", 0.5),  # Subject Retention Score
                "next_topic_revision_priority": pred.get("retention_7d", 0.5),  # Revision Priority (lower = higher priority)
                "optimal_revision_interval_days": pred.get("chapter_repeat_plan", {}).get("next_review_days", 7),  # Optimal Revision Interval
                "retention_7d": pred.get("retention_7d", 0.5),
                "retention_30d": pred.get("retention_30d", 0.5),
                "retention_90d": pred.get("retention_90d", 0.5),
                "target_questions": pred.get("chapter_repeat_plan", {}).get("target_questions", 8),
                "updated_at": pred.get("updated_at", datetime.now().isoformat()),
            })
        return formatted

    def _format_macro_predictions(self, macro: Dict) -> Dict:
        """Format macro predictions with proper feature names for frontend"""
        return {
            "optimal_daily_study_schedule": macro.get("weekly_structure", {}),  # Optimal Daily Study Schedule
            "subject_priority_order": self._calculate_subject_priority(macro),  # Subject Priority Order
            "predicted_long_term_retention_score": macro.get("projected_retention", 0.5),  # Predicted Long Term Retention Score
            "fatigue_risk_probability": macro.get("burnout_risk", 0.3),  # Fatigue Risk Probability
            "burnout_status": macro.get("fatigue_burnout_check", {}).get("status", "low"),
            "recommended_break_minutes": macro.get("fatigue_burnout_check", {}).get("recommended_break_minutes", 10),
            "optimal_daily_minutes": macro.get("optimal_daily_minutes", 60),
            "optimal_long_term_sequence": macro.get("optimal_long_term_sequence", {}),
            "generated_at": macro.get("generated_at", datetime.now().isoformat()),
        }

    def _calculate_subject_priority(self, macro: Dict) -> List[str]:
        """Calculate subject priority order based on retention and fatigue risk"""
        # This would ideally use meso predictions, but for now return default
        return ["english", "gk"]  # Default order

    def _find_optimal_review_day(self, retention: float) -> int:
        if retention < 0.3:
            return 0
        if retention < 0.5:
            return 1
        if retention < 0.7:
            return 3
        if retention < 0.85:
            return 7
        return 30

    def generate_forgetting_curves(self, user_id: str, micro_predictions: List[Dict]) -> Dict:
        """Build forgetting curves from micro retention values and persist them."""
        curves: Dict[str, List[Dict]] = {}
        time_points = self.config.FORGETTING_CURVE.get("time_points", [1, 3, 7, 14, 30])
        boost = float(self.config.FORGETTING_CURVE.get("reinforcement_boost", 0.15))

        for pred in micro_predictions:
            topic_id = str(pred.get("topic_id", "unknown_topic"))
            current_retention = float(pred.get("current_retention", 0.5))
            tau = 30 * (1 + current_retention)
            points = []
            for day in time_points:
                retention = current_retention * np.exp(-day / tau)
                if day in [1, 3, 7, 14, 30]:
                    retention += boost * current_retention
                retention = float(min(1.0, max(0.0, retention)))
                points.append(
                    {
                        "day": int(day),
                        "retention": round(retention, 2),
                        "needs_review": retention < 0.5,
                        "optimal_review_day": self._find_optimal_review_day(retention),
                    }
                )
            curves[topic_id] = points

        curves_file = os.path.join(self._student_dir(user_id), "predictions", "forgetting_curves.json")
        with open(curves_file, "w", encoding="utf-8") as f:
            json.dump(curves, f, indent=2)

        return curves

    def get_topic_predictions(self, user_id: str, topic_id: str) -> Dict:
        predictions = self.get_all_predictions(user_id).get("micro", [])
        topic = next((p for p in predictions if str(p.get("topic_id")) == str(topic_id)), None)
        if not topic:
            return {"error": "Topic not found"}

        curve = self.get_topic_forgetting_curve(user_id, topic_id)
        return {
            "topic_id": str(topic_id),
            "retention_probability": round(float(topic.get("retention_probability", 0.5)), 2),
            "next_question_difficulty": topic.get("next_question_difficulty", 3),
            "probability_correct_next": round(float(topic.get("probability_correct_next", 0.5)), 2),
            "stress_impact": round(float(topic.get("stress_impact", 0.3)), 2),
            "fatigue_level": round(float(topic.get("fatigue_level", 0.3)), 2),
            "batch_type": topic.get("batch_type", "medium_term"),
            "forgetting_curve": curve,
        }

    def get_subject_predictions(self, user_id: str, subject: str) -> Dict:
        data = self.get_all_predictions(user_id, subject=subject)
        return {
            "subject": subject,
            "micro": data.get("micro", []),
            "meso": data.get("meso", []),
            "macro": data.get("macro", {}),
        }

    def get_topic_forgetting_curve(self, user_id: str, topic_id: str) -> List[Dict]:
        curves_file = os.path.join(self._student_dir(user_id), "predictions", "forgetting_curves.json")
        curves = self._load_json(curves_file, {})
        return curves.get(str(topic_id), [])

    def get_all_forgetting_curves(self, user_id: str, subject: Optional[str] = None) -> Dict:
        preds = self.get_all_predictions(user_id, subject)
        return preds.get("forgetting_curves", {})

    def get_retention_summary(self, user_id: str, subject: Optional[str] = None) -> Dict:
        micro = self.get_all_predictions(user_id, subject).get("micro", [])
        if not micro:
            return {
                "overall_retention": 0.5,
                "median_retention": 0.5,
                "std_retention": 0.0,
                "topics_by_status": {},
                "total_topics": 0,
                "generated_at": datetime.now().isoformat(),
            }

        retentions = [float(m.get("retention_probability", 0.5)) for m in micro]
        buckets = {
            "critical": [m for m in micro if float(m.get("retention_probability", 0.5)) < 0.3],
            "warning": [m for m in micro if 0.3 <= float(m.get("retention_probability", 0.5)) < 0.5],
            "moderate": [m for m in micro if 0.5 <= float(m.get("retention_probability", 0.5)) < 0.7],
            "good": [m for m in micro if 0.7 <= float(m.get("retention_probability", 0.5)) < 0.85],
            "excellent": [m for m in micro if float(m.get("retention_probability", 0.5)) >= 0.85],
        }
        return {
            "overall_retention": round(float(np.mean(retentions)), 2),
            "median_retention": round(float(np.median(retentions)), 2),
            "std_retention": round(float(np.std(retentions)), 2),
            "topics_by_status": {
                k: {"count": len(v), "topics": [x.get("topic_id") for x in v[:5]]}
                for k, v in buckets.items()
            },
            "total_topics": len(micro),
            "generated_at": datetime.now().isoformat(),
        }

    def get_batch_recommendations(
        self,
        user_id: str,
        batch_type: Optional[str] = None,
        subject: Optional[str] = None,
    ) -> Dict:
        micro = self.get_all_predictions(user_id, subject).get("micro", [])
        if not micro:
            return {"error": "No predictions available"}

        grouped: Dict[str, List[Dict]] = {}
        for row in micro:
            bt = str(row.get("batch_type", "medium_term"))
            if batch_type and bt != batch_type:
                continue
            grouped.setdefault(bt, []).append(row)

        output = {}
        for bt, topics in grouped.items():
            schedule = self.config.REPETITION_SCHEDULES.get(bt, {})
            qpt = int(schedule.get("questions_per_topic", 3))
            output[bt] = {
                "topics": [str(t.get("topic_id")) for t in topics[:20]],
                "count": len(topics),
                "batch_size": int(schedule.get("batch_size", 5)),
                "questions_per_topic": qpt,
                "total_questions": len(topics) * qpt,
                "schedule_type": schedule.get("schedule_type", "unknown"),
                "description": schedule.get("description", ""),
            }

        return {
            "user_id": user_id,
            "subject": subject,
            "batch_recommendations": output,
            "total_topics": sum(v["count"] for v in output.values()) if output else 0,
            "generated_at": datetime.now().isoformat(),
        }

    def get_question_sequence(
        self,
        user_id: str,
        subject: Optional[str] = None,
        batch_type: str = "immediate",
        count: int = 10,
    ) -> List[Dict]:
        """Return repeat sequence to be saved by Node for session scheduling."""
        micro = self.get_all_predictions(user_id, subject).get("micro", [])
        interactions = self._load_interactions(user_id)

        filtered = [m for m in micro if str(m.get("batch_type", "")) == str(batch_type)]
        if not filtered:
            filtered = sorted(micro, key=lambda x: float(x.get("retention_probability", 0.5)))

        topic_to_question = {}
        if not interactions.empty and "topic_id" in interactions.columns and "question_id" in interactions.columns:
            latest = interactions.dropna(subset=["topic_id", "question_id"]).groupby("topic_id").tail(1)
            topic_to_question = {
                str(r["topic_id"]): str(r["question_id"])
                for _, r in latest.iterrows()
            }

        sequence = []
        for row in filtered[: max(0, int(count))]:
            topic_id = str(row.get("topic_id"))
            retention_prob = float(row.get("retention_probability", 0.5))
            repeat_in_seconds = int(row.get("repeat_in_seconds", max(30, int(float(row.get("repeat_in_days", 1)) * 86400))))
            sequence.append(
                {
                    "topic_id": topic_id,
                    "question_id": topic_to_question.get(topic_id, f"{topic_id}_q1"),
                    "priority": round(1 - retention_prob, 2),
                    "batch_type": row.get("batch_type", batch_type),
                    "retention_probability": retention_prob,
                    "repeat_in_seconds": repeat_in_seconds,
                    "timer_frame_label": row.get("timer_frame_label", f"{repeat_in_seconds}_seconds"),
                    "scheduled_date": (datetime.now() + pd.Timedelta(seconds=repeat_in_seconds)).isoformat(),
                }
            )

        return sequence

    def get_stress_fatigue_predictions(self, user_id: str, subject: Optional[str] = None) -> Dict:
        micro = self.get_all_predictions(user_id, subject).get("micro", [])
        interactions = self._load_interactions(user_id)

        if not interactions.empty:
            if subject and "subject" in interactions.columns:
                interactions = interactions[interactions["subject"].astype(str).str.lower() == subject.lower()]

        if not interactions.empty:
            stress_series = interactions.get("stress_level", pd.Series([0.3]))
            fatigue_series = interactions.get("fatigue_index", pd.Series([0.3]))
            current_stress = float(stress_series.tail(20).mean())
            current_fatigue = float(fatigue_series.tail(20).mean())
            stress_trend = "increasing" if stress_series.tail(10).mean() > stress_series.head(min(10, len(stress_series))).mean() else "stable"
            fatigue_trend = "increasing" if fatigue_series.tail(10).mean() > fatigue_series.head(min(10, len(fatigue_series))).mean() else "stable"
        elif micro:
            current_stress = float(np.mean([m.get("stress_impact", 0.3) for m in micro]))
            current_fatigue = float(np.mean([m.get("fatigue_level", 0.3) for m in micro]))
            stress_trend = "stable"
            fatigue_trend = "stable"
        else:
            current_stress = 0.3
            current_fatigue = 0.3
            stress_trend = "stable"
            fatigue_trend = "stable"

        return {
            "current_stress": round(current_stress, 2),
            "current_fatigue": round(current_fatigue, 2),
            "stress_trend": stress_trend,
            "fatigue_trend": fatigue_trend,
            "recommended_intensity": "low" if current_stress > 0.7 or current_fatigue > 0.7 else "moderate",
            "generated_at": datetime.now().isoformat(),
        }

    def update_after_batch(
        self,
        user_id: str,
        subject: Optional[str],
        batch_type: Optional[str],
        performance: Optional[Dict],
    ) -> Dict:
        """Persist batch completion marker; used by /batch-complete route."""
        self._ensure_dirs(user_id)
        log_file = os.path.join(self._student_dir(user_id), "metrics", "batch_updates.json")
        history = self._load_json(log_file, [])
        history.append(
            {
                "timestamp": datetime.now().isoformat(),
                "subject": subject,
                "batch_type": batch_type,
                "performance": performance or {},
            }
        )
        with open(log_file, "w", encoding="utf-8") as f:
            json.dump(history[-200:], f, indent=2)
        return {"success": True, "logged": True}

    def prepare_for_nodejs(self, user_id: str, subject: Optional[str] = None) -> Dict:
        """Format a Node-ready prediction payload."""
        predictions = self.get_all_predictions(user_id, subject)
        summary = self.get_retention_summary(user_id, subject)

        return {
            "success": True,
            "user_id": user_id,
            "subject": subject,
            "timestamp": datetime.now().isoformat(),
            "predictions": {
                "micro": predictions.get("micro", [])[:100],
                "meso": predictions.get("meso", []),
                "macro": predictions.get("macro", {}),
                "summary": summary,
                "forgetting_curves": predictions.get("forgetting_curves", {}),
            },
            "models_ready": {
                "micro": bool(predictions.get("micro")),
                "meso": bool(predictions.get("meso")),
                "macro": bool(predictions.get("macro")),
            },
        }
