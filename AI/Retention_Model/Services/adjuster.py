"""
Smart Adjuster Service - Real-time learning adjustments
"""
import os
import json
import numpy as np
import logging
from datetime import datetime
from typing import Dict, List, Any

logger = logging.getLogger(__name__)

class SmartAdjuster:
    """
    Handles real-time adjustments at all four levels:
    - Immediate (next 2-3 questions)
    - Session (within current session)
    - Chapter (chapter repetition)
    - Long-term (weeks/months)
    """

    def __init__(self, user_id):
        self.user_id = user_id
        self.base_path = f"student_data/{user_id}"
        self.adjustment_history = self._load_adjustment_history()

    def adjust_next_questions(self, current_performance: Dict,
                             upcoming_questions: List,
                             session_context: Dict) -> Dict:
        """
        Level 1: Adjust next 2-3 questions based on current performance
        """

        adjustment = {
            'level': 'immediate',
            'timestamp': datetime.now().isoformat(),
            'action': 'continue',
            'questions': upcoming_questions[:3],
            'reasoning': 'Normal progression'
        }

        # Case 1: Wrong answer - insert scaffolding
        if not current_performance.get('correct', True):
            adjustment = {
                'level': 'immediate',
                'action': 'insert_scaffolding',
                'questions': self._get_scaffolding_questions(
                    current_performance.get('topic'),
                    count=2
                ) + [current_performance.get('topic')],
                'reasoning': 'Building foundation before retry',
                'batch_position': 'next_3_questions'
            }

        # Case 2: Fast correct answer - skip next review
        elif (current_performance.get('response_time_ms', 9999) < 2000 and
              current_performance.get('correct', False)):
            adjustment = {
                'level': 'immediate',
                'action': 'skip_review',
                'questions': self._get_next_different_topics(upcoming_questions, count=3),
                'reasoning': 'Topic mastered, moving forward',
                'batch_position': 'immediate'
            }

        # Case 3: Hesitation detected - build confidence
        elif current_performance.get('hesitation_count', 0) > 2:
            adjustment = {
                'level': 'immediate',
                'action': 'build_confidence',
                'questions': self._get_confidence_questions(
                    current_performance.get('topic')
                ),
                'reasoning': 'Building fluency through repetition',
                'batch_position': 'next_3_questions'
            }

        # Case 4: Fatigue detected - insert break
        elif session_context.get('fatigue_index', 0) > 0.7:
            adjustment = {
                'level': 'immediate',
                'action': 'insert_micro_break',
                'duration': '2_minutes',
                'activity': 'quick_review_game',
                'after_current': True,
                'resume_with': upcoming_questions[:2],
                'reasoning': 'Fatigue detected - taking short break'
            }

        # Log adjustment
        self._log_adjustment(adjustment)

        return adjustment

    def adjust_session_flow(self, session_performance: Dict) -> Dict:
        """
        Level 2: Adjust overall session flow after every 5 questions
        """

        # Calculate metrics
        accuracies = session_performance.get('accuracies', [])
        response_times = session_performance.get('response_times_ms', [])

        accuracy_trend = self._calculate_trend(accuracies)
        fatigue = session_performance.get('fatigue_index', 0)
        avg_response_time = np.mean(response_times) if response_times else 2000
        focus_score = session_performance.get('focus_score', 0.8)

        adjustment = {
            'level': 'session',
            'timestamp': datetime.now().isoformat(),
            'metrics': {
                'accuracy_trend': accuracy_trend,
                'fatigue': fatigue,
                'avg_response_time': avg_response_time,
                'focus_score': focus_score
            }
        }

        # Determine adjustment based on metrics
        if fatigue > 0.7:
            adjustment.update({
                'action': 'insert_micro_break',
                'duration': '2 minutes',
                'after_questions': 2,
                'activity': 'quick_review_game',
                'reasoning': 'Fatigue detected'
            })

        elif accuracy_trend < -0.1:
            adjustment.update({
                'action': 'reduce_difficulty',
                'new_difficulty': 'easy',
                'duration': 'next_10_questions',
                'reasoning': 'Accuracy dropping - rebuilding confidence'
            })

        elif avg_response_time < 1500 and accuracy_trend > 0.1:
            adjustment.update({
                'action': 'accelerate',
                'new_pace': 'challenge_mode',
                'skip_reviews': True,
                'duration': 'until_fatigue_detected',
                'reasoning': 'Fast and accurate - accelerating'
            })

        elif focus_score < 0.5:
            adjustment.update({
                'action': 'switch_modality',
                'new_format': 'interactive_game',
                'duration': '5_minutes',
                'reasoning': 'Re-engaging through play'
            })

        else:
            adjustment.update({
                'action': 'continue_current',
                'reasoning': 'Optimal flow'
            })

        # Log adjustment
        self._log_adjustment(adjustment)

        return adjustment

    def adjust_chapter_repetition(self, chapter_performance: Dict) -> Dict:
        """
        Level 3: Adjust chapter repetition timing
        """

        # Calculate chapter metrics
        topic_retentions = chapter_performance.get('topic_retentions', [0.5])
        avg_retention = np.mean(topic_retentions)
        critical_topics = chapter_performance.get('topics_below_60', [])

        adjustment = {
            'level': 'chapter',
            'timestamp': datetime.now().isoformat(),
            'chapter_id': chapter_performance.get('chapter_id'),
            'avg_retention': float(avg_retention)
        }

        # Determine repetition strategy
        if avg_retention < 0.4:
            adjustment.update({
                'action': 'immediate_chapter_repetition',
                'timing': 'next_session',
                'format': 'condensed_version',
                'focus_areas': critical_topics,
                'estimated_duration': '25_minutes'
            })

        elif 0.4 <= avg_retention < 0.6:
            adjustment.update({
                'action': 'schedule_chapter_repetition',
                'timing': 'in_3_days',
                'format': 'spaced_repetition',
                'intervals': [3, 7, 14],
                'focus_areas': critical_topics
            })

        elif 0.6 <= avg_retention < 0.8:
            adjustment.update({
                'action': 'integrate_with_new',
                'timing': 'interleaved',
                'format': 'mix_with_new_chapter',
                'ratio': '30% review, 70% new',
                'next_review': 'in_7_days'
            })

        else:
            adjustment.update({
                'action': 'long_term_schedule',
                'next_review': 'in_30_days',
                'format': 'comprehensive_test'
            })

        # Log adjustment
        self._log_adjustment(adjustment)

        return adjustment

    def adjust_long_term_path(self, weekly_stats: Dict, current_path: Dict) -> Dict:
        """
        Level 4: Adjust long-term learning path
        """

        # Analyze weekly performance
        learning_velocity = weekly_stats.get('new_topics_learned', 0) / 7
        retention_avg = weekly_stats.get('avg_retention', 0.7)
        expected_velocity = current_path.get('summary', {}).get('expected_velocity', 5)

        adjustment = {
            'level': 'long_term',
            'timestamp': datetime.now().isoformat(),
            'metrics': {
                'learning_velocity': learning_velocity,
                'retention_avg': retention_avg,
                'expected_velocity': expected_velocity
            }
        }

        # Adjust path based on performance
        if learning_velocity > expected_velocity * 1.2:
            # Learning faster than expected
            adjustment.update({
                'action': 'accelerate_path',
                'new_pace': 'accelerated',
                'compressed_timeline': '80% of original',
                'next_milestones': self._get_accelerated_milestones(current_path)
            })

        elif retention_avg < 0.6:
            # Retention lower than expected
            adjustment.update({
                'action': 'add_review_cycles',
                'additional_reviews': 2,
                'extend_timeline': '20% longer',
                'focus_areas': weekly_stats.get('topics_below_60', [])
            })

        else:
            # On track
            adjustment.update({
                'action': 'maintain_current',
                'confidence': 'high',
                'next_check': 'in_7_days'
            })

        # Log adjustment
        self._log_adjustment(adjustment)

        return adjustment

    def _get_scaffolding_questions(self, topic, count=2):
        """Get easier questions for scaffolding"""
        return [f"{topic}_scaffold_{i}" for i in range(count)]

    def _get_next_different_topics(self, upcoming, count=3):
        """Get next different topics"""
        return upcoming[:count] if len(upcoming) >= count else upcoming

    def _get_confidence_questions(self, topic):
        """Get confidence-building questions"""
        return [
            f"{topic}_easy_1",
            f"{topic}_easy_2",
            f"{topic}_medium_1"
        ]

    def _calculate_trend(self, values):
        """Calculate trend in a series of values"""
        if len(values) < 2:
            return 0
        return (values[-1] - values[0]) / len(values)

    def _get_accelerated_milestones(self, current_path):
        """Generate accelerated milestones"""
        milestones = []
        for i, m in enumerate(current_path.get('milestones', [])[:3]):
            milestones.append({
                'original_day': m.get('day'),
                'new_day': int(m.get('day', 0) * 0.8),
                'description': m.get('description', '')
            })
        return milestones

    def _log_adjustment(self, adjustment):
        """Log adjustment for analysis"""
        self.adjustment_history.append(adjustment)

        # Keep only last 100 adjustments in memory
        if len(self.adjustment_history) > 100:
            self.adjustment_history = self.adjustment_history[-100:]

        # Save to file
        os.makedirs(f"{self.base_path}/logs", exist_ok=True)
        with open(f"{self.base_path}/logs/adjustments.json", 'w') as f:
            json.dump(self.adjustment_history, f, indent=2)

    def _load_adjustment_history(self):
        """Load adjustment history from file"""
        history_path = f"{self.base_path}/logs/adjustments.json"
        if os.path.exists(history_path):
            with open(history_path, 'r') as f:
                return json.load(f)
        return []
    