"""Schedule Service - Generates daily and adaptive study schedules."""
import json
import logging
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class ScheduleService:
    """Creates actionable schedules based on micro-level retention predictions."""

    def __init__(self, config):
        self.config = config

    def _student_dir(self, user_id: str) -> str:
        return os.path.join(self.config.STUDENT_DATA_DIR, user_id)

    def _predictions_file(self, user_id: str) -> str:
        return os.path.join(self._student_dir(user_id), "predictions", "micro_predictions.json")

    def _load_micro_predictions(self, user_id: str, subject: Optional[str] = None) -> List[Dict]:
        path = self._predictions_file(user_id)
        if not os.path.exists(path):
            return []
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not subject:
            return data
        subject_l = subject.lower()
        return [
            p
            for p in data
            if str(p.get("subject", "")).lower() == subject_l
            or str(p.get("topic_id", "")).lower().startswith(f"{subject_l}_")
        ]

    def _normalize_predictions_input(
        self,
        user_id: str,
        subject: Optional[str],
        predictions: Optional[Any],
    ) -> List[Dict]:
        if isinstance(predictions, dict):
            return predictions.get("micro", [])
        if isinstance(predictions, list):
            return predictions
        return self._load_micro_predictions(user_id, subject)

    def _timer_frame_from_retention(self, retention: float) -> int:
        score = max(0.0, min(1.0, float(retention or 0.5)))
        if score < 0.30:
            return 30
        if score < 0.45:
            return 60
        if score < 0.55:
            return 120
        if score < 0.65:
            return 300
        if score < 0.75:
            return 600
        if score < 0.88:
            return 3600
        return 7200

    def _timer_label(self, seconds: int) -> str:
        labels = {
            30: "30_seconds",
            60: "1_minute",
            120: "2_minutes",
            300: "5_minutes",
            600: "10_minutes",
            3600: "1_hour",
            7200: "2_hours",
        }
        return labels.get(int(seconds), f"{int(seconds)}_seconds")

    def generate_daily_schedule(
        self,
        user_id: str,
        subject: Optional[str] = None,
        predictions: Optional[Any] = None,
    ) -> Dict:
        """
        Generate schedule.
        Supports legacy call styles:
        - generate_daily_schedule(user_id, predictions_list)
        - generate_daily_schedule(user_id, subject, predictions)
        """
        # Backward compatibility: second arg is predictions list/dict.
        if isinstance(subject, (list, dict)) and predictions is None:
            predictions = subject
            subject = None

        micro = self._normalize_predictions_input(user_id, subject, predictions)

        categorized = {
            "immediate": [],
            "short_term": [],
            "medium_term": [],
            "long_term": [],
            "mastered": [],
        }

        for pred in micro:
            retention = float(pred.get("current_retention", 0.5))
            placed = False
            for category, cfg in self.config.REPETITION_SCHEDULES.items():
                low, high = cfg.get("retention_range", (0.0, 1.0))
                if low <= retention < high:
                    repeat_in_seconds = int(
                        pred.get("repeat_in_seconds", self._timer_frame_from_retention(retention))
                    )
                    categorized[category].append(
                        {
                            "topic_id": str(pred.get("topic_id")),
                            "subject": pred.get("subject", subject),
                            "retention": retention,
                            "questions_needed": int(cfg.get("questions_per_topic", 3)),
                            "batch_size": int(cfg.get("batch_size", 5)),
                            "repeat_in_seconds": repeat_in_seconds,
                            "timer_frame_label": pred.get("timer_frame_label", self._timer_label(repeat_in_seconds)),
                            "next_repeat_at": (datetime.now() + timedelta(seconds=repeat_in_seconds)).isoformat(),
                        }
                    )
                    placed = True
                    break
            if not placed:
                categorized["medium_term"].append(
                    {
                        "topic_id": str(pred.get("topic_id")),
                        "subject": pred.get("subject", subject),
                        "retention": retention,
                        "questions_needed": 3,
                        "batch_size": 5,
                        "repeat_in_seconds": int(self._timer_frame_from_retention(retention)),
                        "timer_frame_label": self._timer_label(self._timer_frame_from_retention(retention)),
                        "next_repeat_at": (datetime.now() + timedelta(seconds=self._timer_frame_from_retention(retention))).isoformat(),
                    }
                )

        immediate_questions = []
        for row in sorted(categorized["immediate"], key=lambda x: x["retention"])[:3]:
            for i in range(min(3, row["questions_needed"])):
                immediate_questions.append(
                    {
                        "topic_id": row["topic_id"],
                        "subject": row.get("subject"),
                        "question_number": i + 1,
                        "priority": round(1 - row["retention"], 4),
                        "repeat_in_seconds": int(row.get("repeat_in_seconds", 300)),
                        "timer_frame_label": row.get("timer_frame_label", "5_minutes"),
                        "next_repeat_at": row.get("next_repeat_at"),
                    }
                )

        session_batches: List[List[Dict]] = []
        cur: List[Dict] = []
        for row in sorted(categorized["short_term"], key=lambda x: x["retention"]):
            for i in range(min(4, row["questions_needed"])):
                cur.append(
                    {
                        "topic_id": row["topic_id"],
                        "subject": row.get("subject"),
                        "question_number": i + 1,
                        "priority": round(1 - row["retention"], 4),
                        "repeat_in_seconds": int(row.get("repeat_in_seconds", 300)),
                        "timer_frame_label": row.get("timer_frame_label", "5_minutes"),
                        "next_repeat_at": row.get("next_repeat_at"),
                    }
                )
                if len(cur) >= 5:
                    session_batches.append(cur)
                    cur = []
        if cur:
            session_batches.append(cur)

        chapter_reviews = [
            {
                "topic_id": row["topic_id"],
                "subject": row.get("subject"),
                "timing": "next_day",
                "questions": row["questions_needed"],
                "repeat_in_seconds": int(row.get("repeat_in_seconds", 300)),
                "timer_frame_label": row.get("timer_frame_label", "5_minutes"),
                "next_repeat_at": row.get("next_repeat_at"),
            }
            for row in categorized["medium_term"][:10]
        ]

        schedule = {
            "user_id": user_id,
            "subject": subject,
            "date": datetime.now().strftime("%Y-%m-%d"),
            "generated_at": datetime.now().isoformat(),
            "immediate_batch": {
                "questions": immediate_questions,
                "total_questions": len(immediate_questions),
                "focus_topics": [q["topic_id"] for q in immediate_questions[:3]],
            },
            "session_batch": {
                "batches": session_batches,
                "batch_count": len(session_batches),
                "total_questions": sum(len(b) for b in session_batches),
            },
            "chapter_reviews": chapter_reviews,
            "long_term_plan": {
                "review_topics": [x["topic_id"] for x in categorized["long_term"][:15]],
                "mastered_topics": [x["topic_id"] for x in categorized["mastered"][:15]],
            },
            "summary": {
                "total_topics": sum(len(v) for v in categorized.values()),
                "estimated_total_questions": len(immediate_questions)
                + sum(len(b) for b in session_batches)
                + sum(c["questions"] for c in chapter_reviews),
            },
        }

        self._save_schedule(user_id, schedule)
        return schedule

    def get_next_questions(
        self,
        user_id: str,
        subject: Optional[str] = None,
        current_stress: float = 0.3,
        current_fatigue: float = 0.3,
    ) -> Dict:
        schedule = self._load_today_schedule(user_id)
        if not schedule:
            schedule = self.generate_daily_schedule(user_id, subject)

        max_q = 2 if current_stress > 0.7 or current_fatigue > 0.7 else 3
        immediate = schedule.get("immediate_batch", {}).get("questions", [])
        session_batches = schedule.get("session_batch", {}).get("batches", [])

        def _due_sort_key(item: Dict) -> float:
            ts = item.get("next_repeat_at")
            if not ts:
                return 0.0
            try:
                return datetime.fromisoformat(str(ts)).timestamp()
            except Exception:
                return 0.0

        now_ts = datetime.now().timestamp()

        immediate_due = [q for q in immediate if _due_sort_key(q) <= now_ts]
        immediate_pool = sorted(immediate_due or immediate, key=_due_sort_key)

        if immediate_pool:
            picked = immediate_pool[:max_q]
        elif session_batches:
            first_batch = sorted(session_batches[0], key=_due_sort_key)
            picked = first_batch[:max_q]
        else:
            picked = []

        return {
            "user_id": user_id,
            "subject": subject,
            "questions": picked,
            "recommended_break": bool(current_stress > 0.7 or current_fatigue > 0.7),
            "remaining_in_batch": max(0, len(immediate) - len(picked)),
        }

    def get_subject_repetition_schedule(self, user_id: str, subject: str) -> Dict:
        schedule = self._load_today_schedule(user_id)
        if not schedule or schedule.get("subject") not in [None, subject]:
            schedule = self.generate_daily_schedule(user_id, subject)

        topics = []
        for q in schedule.get("immediate_batch", {}).get("questions", []):
            if q.get("subject") in [None, subject]:
                topics.append(q.get("topic_id"))

        return {
            "user_id": user_id,
            "subject": subject,
            "topics_for_repetition": sorted(list(set(topics))),
            "schedule": schedule,
        }

    def get_topic_repetition_schedule(self, user_id: str, topic_id: str) -> Dict:
        schedule = self._load_today_schedule(user_id)
        if not schedule:
            schedule = self.generate_daily_schedule(user_id)

        occurrences = []
        for q in schedule.get("immediate_batch", {}).get("questions", []):
            if str(q.get("topic_id")) == str(topic_id):
                occurrences.append({"phase": "immediate", "question": q})

        for batch in schedule.get("session_batch", {}).get("batches", []):
            for q in batch:
                if str(q.get("topic_id")) == str(topic_id):
                    occurrences.append({"phase": "session", "question": q})

        return {
            "user_id": user_id,
            "topic_id": topic_id,
            "occurrences": occurrences,
            "repeat_count": len(occurrences),
        }

    def get_chapter_repetition_schedule(self, user_id: str, chapter_id: str) -> Dict:
        # Compatibility alias used by some older route code.
        return self.get_topic_repetition_schedule(user_id, chapter_id)

    def get_optimal_study_times(
        self,
        user_id: str,
        subject: Optional[str] = None,
        stress_fatigue: Optional[Dict] = None,
    ) -> Dict:
        stress_fatigue = stress_fatigue or {}
        stress = float(stress_fatigue.get("current_stress", 0.3))
        fatigue = float(stress_fatigue.get("current_fatigue", 0.3))

        if stress > 0.7 or fatigue > 0.7:
            windows = ["09:00-10:00", "18:00-19:00"]
            intensity = "light"
        elif stress > 0.5 or fatigue > 0.5:
            windows = ["08:30-10:00", "17:30-19:00"]
            intensity = "moderate"
        else:
            windows = ["07:30-10:00", "16:30-19:30"]
            intensity = "high"

        return {
            "user_id": user_id,
            "subject": subject,
            "optimal_windows": windows,
            "recommended_session_minutes": 35 if intensity == "high" else 25,
            "intensity": intensity,
            "generated_at": datetime.now().isoformat(),
        }

    def update_schedule_after_interaction(self, user_id: str, topic_id: str, was_correct: bool):
        schedule = self._load_today_schedule(user_id)
        if not schedule:
            return

        immediate = schedule.get("immediate_batch", {}).get("questions", [])
        schedule["immediate_batch"]["questions"] = [q for q in immediate if str(q.get("topic_id")) != str(topic_id)]
        schedule["immediate_batch"]["total_questions"] = len(schedule["immediate_batch"]["questions"])

        if not was_correct:
            schedule["immediate_batch"]["questions"].insert(
                0,
                {
                    "topic_id": topic_id,
                    "question_number": 1,
                    "priority": 1.0,
                    "reason": "retry_after_incorrect",
                },
            )
            schedule["immediate_batch"]["total_questions"] = len(schedule["immediate_batch"]["questions"])

        self._save_schedule(user_id, schedule)

    def _load_today_schedule(self, user_id: str) -> Optional[Dict]:
        today = datetime.now().strftime("%Y-%m-%d")
        path = os.path.join(self._student_dir(user_id), "schedules", f"schedule_{today}.json")
        if not os.path.exists(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _save_schedule(self, user_id: str, schedule: Dict):
        sched_dir = os.path.join(self._student_dir(user_id), "schedules")
        os.makedirs(sched_dir, exist_ok=True)
        date = schedule.get("date", datetime.now().strftime("%Y-%m-%d"))
        path = os.path.join(sched_dir, f"schedule_{date}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(schedule, f, indent=2)
        logger.info("Saved schedule for user %s (%s)", user_id, date)
