"""
Retention blueprint - Handles retention-related API endpoints
"""
from flask import Blueprint, request, jsonify, current_app
import os
import json
import logging
import uuid
from datetime import datetime

import pandas as pd
import numpy as np

retention_bp = Blueprint('retention', __name__)
logger = logging.getLogger(__name__)

# Lightweight in-memory session state used by Flask-side orchestration.
_RETENTION_SESSIONS = {}
_TIMER_FRAMES_SECONDS = [30, 60, 120, 300, 600, 3600, 7200]


def _prediction_service():
    return getattr(current_app, 'retention_prediction_service', current_app.prediction_service)


def _schedule_service():
    return getattr(current_app, 'retention_schedule_service', getattr(current_app, 'schedule_service', None))


def _training_service():
    return getattr(current_app, 'retention_training_service', current_app.training_service)


def _student_paths(user_id: str):
    base = os.path.join(current_app.config['STUDENT_DATA_DIR'], str(user_id))
    paths = {
        'root': base,
        'raw_data': os.path.join(base, 'raw_data'),
        'predictions': os.path.join(base, 'predictions'),
        'models': os.path.join(base, 'models'),
        'metrics': os.path.join(base, 'metrics'),
        'schedules': os.path.join(base, 'schedules'),
    }
    for path in paths.values():
        os.makedirs(path, exist_ok=True)
    return paths


def _append_rows_csv(csv_path: str, rows):
    if not rows:
        return
    df = pd.DataFrame(rows)
    # Keep a strict schema per sequence CSV. If schema changed, rewrite file.
    if os.path.exists(csv_path):
        try:
            existing_cols = list(pd.read_csv(csv_path, nrows=0).columns)
            if existing_cols == list(df.columns):
                df.to_csv(csv_path, mode='a', header=False, index=False)
                return
        except Exception:
            pass
    df.to_csv(csv_path, index=False)


def _sequence_files(user_id: str):
    paths = _student_paths(user_id)
    raw = paths['raw_data']
    return {
        'micro': os.path.join(raw, 'micro_sequences.csv'),
        'meso': os.path.join(raw, 'meso_sequences.csv'),
        'macro': os.path.join(raw, 'macro_sequences.csv'),
    }


def _safe_float(value, default=0.0):
    try:
        return float(value)
    except Exception:
        return float(default)


def _safe_int(value, default=0):
    try:
        return int(value)
    except Exception:
        return int(default)


def _round2(value, default=0.0):
    try:
        return round(float(value), 2)
    except Exception:
        return round(float(default), 2)


def _clip(value, low=0.0, high=1.0):
    return max(low, min(high, float(value)))


def _first_defined(*values):
    for value in values:
        if value is not None and value != '':
            return value
    return None


def _nearest_timer_frame_seconds(seconds: float) -> int:
    safe = max(0.0, _safe_float(seconds, 300.0))
    return int(min(_TIMER_FRAMES_SECONDS, key=lambda frame: abs(frame - safe)))


def _timer_frame_label(seconds: float) -> str:
    sec = _nearest_timer_frame_seconds(seconds)
    labels = {
        30: '30_seconds',
        60: '1_minute',
        120: '2_minutes',
        300: '5_minutes',
        600: '10_minutes',
        3600: '1_hour',
        7200: '2_hours',
    }
    return labels.get(sec, f'{sec}_seconds')


def _retention_to_timer_frame_seconds(retention_score: float) -> int:
    score = _clip(_safe_float(retention_score, 0.5), 0.0, 1.0)
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


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + np.exp(-x))


def _safe_slope(values):
    if not values or len(values) < 2:
        return 0.0
    x = np.arange(len(values), dtype=float)
    y = np.array(values, dtype=float)
    denom = float(np.sum((x - x.mean()) ** 2))
    if denom == 0:
        return 0.0
    slope = float(np.sum((x - x.mean()) * (y - y.mean())) / denom)
    return slope


def _load_interactions_history(user_id: str) -> pd.DataFrame:
    interactions_csv = os.path.join(_student_paths(user_id)['raw_data'], 'interactions.csv')
    if not os.path.exists(interactions_csv):
        return pd.DataFrame()
    try:
        return pd.read_csv(interactions_csv)
    except Exception:
        return pd.DataFrame()


def _build_sequence_rows(user_id: str, session_id: str, subject: str, responses):
    micro_rows = []
    meso_rows = []
    macro_rows = []

    history = _load_interactions_history(user_id)
    now_dt = datetime.now()
    expected_focus_duration_sec = 45 * 60
    sess_correctness = []
    sess_times = []
    sess_fatigue = []
    sess_topics = []
    sess_hints = []
    sess_difficulty = []

    for idx, item in enumerate(responses):
        ts = item.get('timestamp') or now_dt.isoformat()
        try:
            current_ts = datetime.fromisoformat(str(ts).replace('Z', '+00:00'))
        except Exception:
            current_ts = now_dt

        topic = item.get('topic_id') or item.get('concept_area') or item.get('topic') or 'unknown_topic'
        is_correct = 1.0 if bool(item.get('correct', False)) else 0.0
        response_time = _safe_float(item.get('time_spent', item.get('response_time_ms', 0.0)), 0.0)
        answer_changes = _safe_int(item.get('answer_changes', item.get('hesitation_count', 0)), 0)
        confidence_rating = _safe_float(item.get('confidence_rating', 0.0), 0.0)
        if confidence_rating <= 0:
            confidence_rating = _safe_float(item.get('confidence', 0.5), 0.5) * 5.0
        question_difficulty = _safe_float(item.get('question_difficulty', item.get('difficulty', 0.5)), 0.5)
        if question_difficulty <= 1.0:
            question_difficulty *= 5.0
        hint_used_flag = 1.0 if bool(item.get('hint_used', False)) else 0.0
        micro_features_hint = item.get('micro_features') if isinstance(item.get('micro_features'), list) else []
        target_hints = item.get('derived_targets') if isinstance(item.get('derived_targets'), dict) else {}
        schedule_hint = item.get('schedule_hint') if isinstance(item.get('schedule_hint'), dict) else {}

        topic_history = history[history.get('topic_id', pd.Series(dtype=str)).astype(str) == str(topic)] if not history.empty and 'topic_id' in history.columns else pd.DataFrame()
        topic_response_times = topic_history.get('response_time_ms', pd.Series(dtype=float)).astype(float).tolist() if not topic_history.empty else []
        avg_topic_rt = float(np.mean(topic_response_times)) if topic_response_times else max(response_time, 1.0)
        normalized_response_time = response_time / max(avg_topic_rt, 1.0)

        topic_correct_hist = topic_history.get('correct', pd.Series(dtype=float)).astype(float).tolist() if not topic_history.empty else []
        rolling_topic_hist = (topic_correct_hist + [is_correct])[-10:]
        rolling_accuracy_topic = float(np.mean(rolling_topic_hist)) if rolling_topic_hist else is_correct

        correct_streak = 0
        for val in reversed(topic_correct_hist + [is_correct]):
            if float(val) >= 0.5:
                correct_streak += 1
            else:
                break

        if not topic_history.empty and 'timestamp' in topic_history.columns:
            try:
                prev_ts = datetime.fromisoformat(str(topic_history.iloc[-1]['timestamp']).replace('Z', '+00:00'))
                time_since_last_attempt_topic = max(0.0, (current_ts - prev_ts).total_seconds())
            except Exception:
                time_since_last_attempt_topic = response_time / 1000.0
        else:
            time_since_last_attempt_topic = response_time / 1000.0

        decay_weights = np.exp(-0.2 * np.arange(len(rolling_topic_hist))[::-1]) if rolling_topic_hist else np.array([1.0])
        concept_mastery_score = float(np.dot(np.array(rolling_topic_hist, dtype=float), decay_weights) / np.sum(decay_weights)) if rolling_topic_hist else is_correct

        session_start_raw = item.get('session_start_time')
        if session_start_raw:
            try:
                session_start_dt = datetime.fromisoformat(str(session_start_raw).replace('Z', '+00:00'))
            except Exception:
                session_start_dt = current_ts
        else:
            session_start_dt = current_ts
        session_elapsed_sec = max(0.0, (current_ts - session_start_dt).total_seconds())
        fatigue_indicator = session_elapsed_sec / expected_focus_duration_sec

        recent_session_times = sess_times[-20:] + [response_time]
        mu = float(np.mean(recent_session_times)) if recent_session_times else response_time
        sigma = float(np.std(recent_session_times)) if recent_session_times else 0.0
        focus_loss_frequency = float(sum(1 for t in recent_session_times if t > (mu + 2 * sigma)))
        rolling_time_variance = float(np.var(recent_session_times)) if recent_session_times else 0.0

        predicted_optimal_difficulty = 3.0 if rolling_accuracy_topic > 0.75 else 2.0 if rolling_accuracy_topic < 0.4 else 2.5
        preferred_difficulty_offset = question_difficulty - predicted_optimal_difficulty
        attempt_count_topic = len(topic_correct_hist) + 1

        if len(micro_features_hint) >= 15:
            # Blend client-side extracted features with server-computed values for robustness.
            answer_correctness = 0.5 * answer_correctness + 0.5 * _clip(_safe_float(micro_features_hint[0], answer_correctness), 0.0, 1.0)
            normalized_response_time = 0.5 * normalized_response_time + 0.5 * max(0.0, _safe_float(micro_features_hint[1], normalized_response_time))
            rolling_accuracy_topic = 0.5 * rolling_accuracy_topic + 0.5 * _clip(_safe_float(micro_features_hint[2], rolling_accuracy_topic), 0.0, 1.0)
            confidence_rating = 0.5 * confidence_rating + 0.5 * max(1.0, min(5.0, _safe_float(micro_features_hint[6], confidence_rating)))
            concept_mastery_score = 0.5 * concept_mastery_score + 0.5 * _clip(_safe_float(micro_features_hint[7], concept_mastery_score), 0.0, 1.0)
            fatigue_indicator = 0.5 * fatigue_indicator + 0.5 * max(0.0, _safe_float(micro_features_hint[9], fatigue_indicator))

        retention_probability_topic = _clip(
            0.45 * rolling_accuracy_topic
            + 0.25 * concept_mastery_score
            + 0.15 * _clip(confidence_rating / 5.0)
            + 0.15 * _clip(1.0 / max(normalized_response_time, 1e-6)),
            0.0,
            1.0,
        )
        retention_probability_topic = _clip(
            _safe_float(
                _first_defined(
                    (((target_hints.get('micro') or {}).get('retention_probability')) if isinstance(target_hints.get('micro'), dict) else None),
                    item.get('retention_probability'),
                    retention_probability_topic,
                ),
                retention_probability_topic,
            ),
            0.0,
            1.0,
        )
        next_question_difficulty = max(1.0, min(5.0, round(2.5 + (retention_probability_topic - 0.5) * 2.0, 2)))
        probability_correct_next_attempt = _clip(
            _sigmoid(
                2.2 * rolling_accuracy_topic
                + 1.2 * concept_mastery_score
                + 0.6 * (confidence_rating / 5.0)
                - 0.8 * min(fatigue_indicator, 1.5)
                - 0.4 * min(normalized_response_time, 2.0)
                - 0.7
            ),
            0.0,
            1.0,
        )
        probability_correct_next_attempt = _clip(
            _safe_float(
                _first_defined(
                    (((target_hints.get('micro') or {}).get('probability_correct_next')) if isinstance(target_hints.get('micro'), dict) else None),
                    item.get('probability_correct_next'),
                    probability_correct_next_attempt,
                ),
                probability_correct_next_attempt,
            ),
            0.0,
            1.0,
        )

        repeat_in_seconds = _nearest_timer_frame_seconds(
            _first_defined(
                schedule_hint.get('timer_frame_seconds'),
                schedule_hint.get('timerFrameSeconds'),
                (((target_hints.get('micro') or {}).get('repeat_in_seconds')) if isinstance(target_hints.get('micro'), dict) else None),
                _retention_to_timer_frame_seconds(retention_probability_topic),
            )
        )
        repeat_in_days = repeat_in_seconds / 86400.0
        timer_frame_label = _timer_frame_label(repeat_in_seconds)

        micro_rows.append(
            {
                'timestamp': current_ts.isoformat(),
                'session_id': session_id,
                'subject': _normalize_subject(subject),
                'topic_id': str(topic),
                'answer_correctness': _round2(is_correct),
                'normalized_response_time': _round2(normalized_response_time),
                'rolling_accuracy_topic': _round2(rolling_accuracy_topic),
                'correct_streak': _round2(correct_streak),
                'time_since_last_attempt_topic': _round2(time_since_last_attempt_topic),
                'answer_change_count': _round2(answer_changes),
                'confidence_rating': _round2(max(1.0, min(5.0, confidence_rating))),
                'concept_mastery_score': _round2(concept_mastery_score),
                'question_difficulty': _round2(max(1.0, min(5.0, question_difficulty))),
                'fatigue_indicator': _round2(fatigue_indicator),
                'focus_loss_frequency': _round2(focus_loss_frequency),
                'rolling_time_variance': _round2(rolling_time_variance),
                'hint_usage_flag': _round2(hint_used_flag),
                'preferred_difficulty_offset': _round2(preferred_difficulty_offset),
                'attempt_count_topic': _round2(attempt_count_topic),
                'retention_probability_topic': _round2(retention_probability_topic),
                'next_question_difficulty': _round2(next_question_difficulty),
                'probability_correct_next_attempt': _round2(probability_correct_next_attempt),
                'repeat_in_seconds': int(repeat_in_seconds),
                'repeat_in_days': _round2(repeat_in_days),
                'timer_frame_label': timer_frame_label,
            }
        )

        sess_correctness.append(is_correct)
        sess_times.append(response_time)
        sess_topics.append(str(topic))
        sess_hints.append(hint_used_flag)
        sess_difficulty.append(question_difficulty)
        sess_fatigue.append(_safe_float(item.get('fatigue_index', fatigue_indicator), fatigue_indicator))

        perf_trend = _safe_slope(sess_correctness[-20:])
        avg_rt = float(np.mean(sess_times[-20:])) if sess_times else response_time
        rt_first = sess_times[0] if sess_times else response_time
        rt_last = sess_times[-1] if sess_times else response_time
        rt_improvement = (rt_first - rt_last) / max(rt_first, 1.0)
        diffs = [int(round(d)) for d in sess_difficulty[-20:]]
        current_diff = int(round(question_difficulty))
        correct_at_diff = [c for c, d in zip(sess_correctness[-len(diffs):], diffs) if d == current_diff]
        difficulty_success_rate = float(np.mean(correct_at_diff)) if correct_at_diff else rolling_accuracy_topic
        topic_switch_frequency = float(sum(1 for i in range(1, len(sess_topics)) if sess_topics[i] != sess_topics[i - 1])) / max(1, len(sess_topics))
        incorrect_pattern_frequency = float(sum(1 for c in sess_correctness if c < 0.5)) / max(1, len(sess_correctness))
        study_time_hours = max(1e-6, float(sum(sess_times)) / 1000.0 / 3600.0)
        learning_velocity = len(set(sess_topics)) / study_time_hours
        session_duration_min = max(1e-6, float(sum(sess_times)) / 1000.0 / 60.0)
        engagement_score = len(sess_correctness) / session_duration_min
        fatigue_trend = _safe_slope(sess_times[-20:])
        hint_dependency_rate = float(sum(sess_hints)) / max(1, len(sess_hints))
        mid = max(1, len(sess_correctness) // 2)
        perf_start = float(np.mean(sess_correctness[:mid]))
        perf_end = float(np.mean(sess_correctness[mid:]))
        retention_decay_index = perf_start - perf_end
        subject_accuracy_rate = float(np.mean(sess_correctness))
        subject_retention_score = _clip(0.55 * subject_accuracy_rate + 0.2 * (1 - incorrect_pattern_frequency) + 0.25 * _clip(1 - hint_dependency_rate))
        next_topic_revision_priority = _clip(1.0 - subject_retention_score)
        optimal_revision_interval_days = 1.0 if subject_retention_score < 0.35 else 3.0 if subject_retention_score < 0.55 else 7.0 if subject_retention_score < 0.75 else 30.0

        meso_rows.append(
            {
                'timestamp': current_ts.isoformat(),
                'session_id': session_id,
                'subject': _normalize_subject(subject),
                'topic_id': str(topic),
                'subject_accuracy_rate': _round2(subject_accuracy_rate),
                'topic_mastery_vector': _round2(np.mean([r['concept_mastery_score'] for r in micro_rows[-10:]])),
                'forgetting_rate_subject': _round2(max(0.0, retention_decay_index)),
                'session_performance_trend': _round2(perf_trend),
                'average_response_time': _round2(avg_rt),
                'response_time_improvement_rate': _round2(rt_improvement),
                'difficulty_success_rate': _round2(difficulty_success_rate),
                'revision_interval': _round2(time_since_last_attempt_topic / 3600.0),
                'topic_switch_frequency': _round2(topic_switch_frequency),
                'incorrect_pattern_frequency': _round2(incorrect_pattern_frequency),
                'learning_velocity': _round2(learning_velocity),
                'engagement_score': _round2(engagement_score),
                'fatigue_trend': _round2(fatigue_trend),
                'hint_dependency_rate': _round2(hint_dependency_rate),
                'retention_decay_index': _round2(retention_decay_index),
                'subject_retention_score': _round2(subject_retention_score),
                'next_topic_revision_priority': _round2(next_topic_revision_priority),
                'optimal_revision_interval_days': _round2(optimal_revision_interval_days),
            }
        )

    if responses:
        overall_accuracy = float(np.mean(sess_correctness)) if sess_correctness else 0.0
        daily_study_duration = float(sum(sess_times) / 1000.0 / 60.0)
        study_consistency_index = min(1.0, len(responses) / 20.0)
        fatigue_pattern = float(np.mean(sess_fatigue)) if sess_fatigue else 0.0
        forgetting_curve_slope = _round2(-0.1 * (1.0 - overall_accuracy))
        performance_variability = float(np.var(sess_correctness)) if len(sess_correctness) > 1 else 0.0
        session_start_time_pattern = _round2((now_dt.hour + now_dt.minute / 60.0) / 24.0)
        topic_completion_rate = float(len(set(sess_topics)) / max(1, len(_default_topics_for_subject(subject))))
        learning_efficiency_score = overall_accuracy / max(1e-6, daily_study_duration)
        break_frequency = float(sum(1 for t in sess_times if t > 90000)) / max(1, len(sess_times))
        cognitive_load_index = float(np.mean(sess_difficulty)) / 5.0 if sess_difficulty else 0.0
        motivation_index = min(1.0, len(responses) / 10.0)
        response_spike = float(np.mean([1.0 if t > (np.mean(sess_times) + 2 * np.std(sess_times)) else 0.0 for t in sess_times])) if len(sess_times) > 1 else 0.0
        incorrect_streak = 0
        for c in reversed(sess_correctness):
            if c < 0.5:
                incorrect_streak += 1
            else:
                break
        stress_indicator = incorrect_streak * response_spike
        retention_stability_score = max(0.0, 1.0 - performance_variability)

        predicted_long_term_retention_score = _clip(
            0.4 * overall_accuracy + 0.2 * retention_stability_score + 0.2 * topic_completion_rate + 0.2 * study_consistency_index
        )
        fatigue_risk_probability = _clip(0.5 * fatigue_pattern + 0.3 * stress_indicator + 0.2 * break_frequency)
        optimal_daily_study_schedule = 45.0 if fatigue_risk_probability > 0.7 else 60.0 if fatigue_risk_probability > 0.45 else 75.0
        subject_priority_order = _clip(1.0 - predicted_long_term_retention_score)

        macro_rows.append(
            {
                'timestamp': now_dt.isoformat(),
                'session_id': session_id,
                'subject': _normalize_subject(subject),
                'overall_accuracy_rate': _round2(overall_accuracy),
                'cross_subject_mastery_vector': _round2(overall_accuracy),
                'daily_study_duration': _round2(daily_study_duration),
                'study_consistency_index': _round2(study_consistency_index),
                'fatigue_pattern': _round2(fatigue_pattern),
                'forgetting_curve_slope': _round2(forgetting_curve_slope),
                'performance_variability': _round2(performance_variability),
                'session_start_time_pattern': _round2(session_start_time_pattern),
                'topic_completion_rate': _round2(topic_completion_rate),
                'learning_efficiency_score': _round2(learning_efficiency_score),
                'break_frequency': _round2(break_frequency),
                'cognitive_load_index': _round2(cognitive_load_index),
                'motivation_index': _round2(motivation_index),
                'stress_indicator': _round2(stress_indicator),
                'retention_stability_score': _round2(retention_stability_score),
                'optimal_daily_study_schedule': _round2(optimal_daily_study_schedule),
                'subject_priority_order': _round2(subject_priority_order),
                'predicted_long_term_retention_score': _round2(predicted_long_term_retention_score),
                'fatigue_risk_probability': _round2(fatigue_risk_probability),
            }
        )

    return micro_rows, meso_rows, macro_rows


def _sequence_status(user_id: str):
    files = _sequence_files(user_id)

    def _count_rows(csv_path: str) -> int:
        if not os.path.exists(csv_path):
            return 0
        try:
            return int(len(pd.read_csv(csv_path)))
        except Exception:
            return 0

    micro_rows = _count_rows(files['micro'])
    meso_rows = _count_rows(files['meso'])
    macro_rows = _count_rows(files['macro'])
    micro_windows = max(0, micro_rows - 20 + 1)

    return {
        'micro_rows': micro_rows,
        'micro_sequence_windows': micro_windows,
        'meso_rows': meso_rows,
        'macro_rows': macro_rows,
        'csv_files': files,
    }


def _build_model_outputs(user_id: str, subject: str, answers, predictions, sequence_status, training_needed):
    micro_predictions = predictions.get('micro', []) or []
    meso_predictions = predictions.get('meso', []) or []
    macro_prediction = predictions.get('macro', {}) or {}

    latest_topic = None
    if answers:
      latest_topic = (
          answers[-1].get('topic_id')
          or answers[-1].get('concept_area')
          or answers[-1].get('topic')
      )

    latest_micro = None
    if latest_topic:
      latest_micro = next(
          (m for m in micro_predictions if str(m.get('topic_id')) == str(latest_topic)),
          None,
      )

    if not latest_micro and micro_predictions:
        latest_micro = micro_predictions[0]

    latest_current_ret = float(
        (latest_micro or {}).get('current_retention', (latest_micro or {}).get('retention_probability', 0.0) or 0.0)
    )
    latest_next_ret = float(
        (latest_micro or {}).get('next_retention', (latest_micro or {}).get('probability_correct_next', 0.0) or 0.0)
    )
    latest_stress = float((latest_micro or {}).get('stress_impact', 0.3) or 0.3)
    latest_fatigue = float((latest_micro or {}).get('fatigue_level', 0.3) or 0.3)
    latest_repeat_days = _safe_float((latest_micro or {}).get('repeat_in_days', 1), 1.0)
    latest_repeat_seconds = _nearest_timer_frame_seconds(
        _first_defined(
            (latest_micro or {}).get('repeat_in_seconds'),
            latest_repeat_days * 86400,
        )
    )

    subject_meso = [
        m for m in meso_predictions if str(m.get('subject', '')).lower() == str(subject or '').lower()
    ]
    if not subject_meso:
      subject_meso = meso_predictions

    subject_priority = []
    for s in sorted(
        set([str(m.get('subject', 'unknown')) for m in meso_predictions]),
        key=lambda sub: np.mean([
            float(x.get('retention_30d', 0.5)) for x in meso_predictions if str(x.get('subject')) == sub
        ]) if any(str(x.get('subject')) == sub for x in meso_predictions) else 0.5,
    ):
      subject_priority.append(s)

    chapter_priority = sorted(
        subject_meso,
        key=lambda m: float(m.get('retention_30d', 0.5)),
    )[:5]

    stress_fatigue = _prediction_service().get_stress_fatigue_predictions(user_id, subject)
    next_questions = _build_question_batch(
        user_id,
        subject or 'english',
        stress_fatigue.get('current_stress', 0.3),
        stress_fatigue.get('current_fatigue', 0.3),
    )

    micro_required = int(((training_needed.get('models') or {}).get('micro') or {}).get('min_required', 20))
    available_windows = int(sequence_status.get('micro_sequence_windows', 0))

    return {
        'micro_lstm': {
            'input_requirement': {
                'sequence_length': 20,
                'feature_count': 15,
                'available_windows': available_windows,
                'min_required_windows': micro_required,
                'ready': available_windows >= micro_required,
            },
            'output': {
                'topic_id': latest_micro.get('topic_id') if latest_micro else latest_topic,
                'retention_score': _round2(latest_current_ret),
                'current_retention': _round2(latest_current_ret),
                'next_retention': _round2(latest_next_ret),
                'probability_correct_next_attempt': _round2(latest_next_ret),
                'stress_impact': _round2(latest_stress if latest_micro else stress_fatigue.get('current_stress', 0.3)),
                'fatigue_prediction': _round2(latest_fatigue if latest_micro else stress_fatigue.get('current_fatigue', 0.3)),
                'repeat_in_days': round(float(latest_repeat_seconds) / 86400.0, 4),
                'repeat_in_seconds': int(latest_repeat_seconds),
                'timer_frame_label': _timer_frame_label(latest_repeat_seconds),
                'planned_revision': {
                    'after_questions': int(max(1, np.median([
                        int((m.get('chapter_repeat_plan') or {}).get('target_questions', 8)) for m in subject_meso
                    ]) if subject_meso else 8)),
                    'after_seconds': int(max(0, latest_repeat_seconds)),
                    'after_days': round(float(latest_repeat_seconds) / 86400.0, 4),
                    'timer_frame_label': _timer_frame_label(latest_repeat_seconds),
                },
            },
        },
        'meso_lstm': {
            'output': {
                'subject_retention_score': _round2(np.mean([float(m.get('retention_7d', 0.0)) for m in subject_meso])) if subject_meso else 0.0,
                'subject_retention_7d': _round2(np.mean([float(m.get('retention_7d', 0.0)) for m in subject_meso])) if subject_meso else 0.0,
                'subject_retention_30d': _round2(np.mean([float(m.get('retention_30d', 0.0)) for m in subject_meso])) if subject_meso else 0.0,
                'subject_retention_90d': _round2(np.mean([float(m.get('retention_90d', 0.0)) for m in subject_meso])) if subject_meso else 0.0,
                'next_topic_revision_priority': [
                    {
                        'topic_id': item.get('topic_id'),
                        'retention_30d': _round2(item.get('retention_30d', 0.0)),
                    }
                    for item in chapter_priority
                ],
                'optimal_revision_interval_days': int(np.median([
                    int((item.get('chapter_repeat_plan') or {}).get('next_review_days', 7))
                    for item in subject_meso
                ])) if subject_meso else 7,
                'optimal_revision_plan': {
                    'days_until_next_revision': int(np.median([
                        int((item.get('chapter_repeat_plan') or {}).get('next_review_days', 7))
                        for item in subject_meso
                    ])) if subject_meso else 7,
                    'target_questions': int(max(1, np.median([
                        int((item.get('chapter_repeat_plan') or {}).get('target_questions', 8))
                        for item in subject_meso
                    ]))) if subject_meso else 8,
                },
            },
        },
        'macro_lstm': {
            'output': {
                'optimal_daily_study_schedule': macro_prediction.get('weekly_structure', macro_prediction.get('optimal_daily_study_schedule', {})),
                'subject_priority_order': subject_priority,
                'predicted_long_term_retention_score': _round2(macro_prediction.get('projected_retention', macro_prediction.get('predicted_long_term_retention_score', 0.0))),
                'fatigue_risk_probability': _round2(macro_prediction.get('burnout_risk', macro_prediction.get('fatigue_risk_probability', 0.0))),
                'optimal_long_term_learning_sequence': macro_prediction.get('optimal_long_term_sequence', macro_prediction.get('optimal_long_term_sequence', {})),
            },
        },
        'repeat_schedule': {
            'next_questions': next_questions.get('questions', []),
            'recommended_break': bool(next_questions.get('recommended_break', False)),
        },
        'stress_fatigue_burnout': {
            'current_stress': _round2(stress_fatigue.get('current_stress', 0.3)),
            'current_fatigue': _round2(stress_fatigue.get('current_fatigue', 0.3)),
            'burnout_status': (macro_prediction.get('fatigue_burnout_check') or {}).get('status', 'moderate'),
            'recommended_break_minutes': int((macro_prediction.get('fatigue_burnout_check') or {}).get('recommended_break_minutes', 10)),
        },
    }


def _normalize_subject(subject: str) -> str:
    if not subject:
        return ''
    return str(subject).strip().lower()


def _is_valid_subject(subject: str) -> bool:
    return _normalize_subject(subject) in {'english', 'gk'}


def _default_topics_for_subject(subject: str):
    subject = _normalize_subject(subject)
    if subject == 'english':
        return ['vocabulary', 'idioms', 'phrases', 'synonyms', 'antonyms', 'one_word_substitution']
    if subject == 'gk':
        return ['history', 'geography', 'science', 'current_affairs']
    return []


def _persist_interactions(user_id: str, session_id: str, subject: str, responses):
    if not responses:
        return

    paths = _student_paths(user_id)
    interactions_csv = os.path.join(paths['raw_data'], 'interactions.csv')

    now_iso = datetime.now().isoformat()
    rows = []
    for index, item in enumerate(responses):
        topic = item.get('topic_id') or item.get('concept_area') or item.get('topic') or 'unknown_topic'
        rows.append(
            {
                'timestamp': item.get('timestamp', now_iso),
                'user_id': user_id,
                'subject': _normalize_subject(subject),
                'topic_id': topic,
                'question_id': item.get('question_id') or f'{session_id}_q_{index + 1}',
                'correct': bool(item.get('correct', False)),
                'response_time_ms': float(item.get('time_spent', item.get('response_time_ms', 0)) or 0),
                'confidence': float(item.get('confidence', 0.5) or 0.5),
                'difficulty': float(item.get('difficulty', 0.5) or 0.5),
                'hesitation_count': int(item.get('hesitation_count', item.get('answer_changes', 0)) or 0),
                'fatigue_index': float(item.get('fatigue_index', 0.3) or 0.3),
                'focus_score': float(item.get('focus_score', 0.7) or 0.7),
                'stress_level': float(item.get('stress_level', 0.3) or 0.3),
                'session_id': session_id,
                'attempt_number': int(item.get('attempt_number', 1) or 1),
                'streak': int(item.get('streak', 0) or 0),
            }
        )

    _append_rows_csv(interactions_csv, rows)

    micro_rows, meso_rows, macro_rows = _build_sequence_rows(
        user_id=user_id,
        session_id=session_id,
        subject=subject,
        responses=responses,
    )
    seq_files = _sequence_files(user_id)
    _append_rows_csv(seq_files['micro'], micro_rows)
    _append_rows_csv(seq_files['meso'], meso_rows)
    _append_rows_csv(seq_files['macro'], macro_rows)

    # Keep retrain_interval counters in sync with newly persisted sequence rows.
    try:
        _training_service().record_sequence_updates(
            user_id,
            micro_added=len(micro_rows),
            meso_added=len(meso_rows),
            macro_added=len(macro_rows),
        )
    except Exception as exc:
        logger.warning("Failed to update sequence counters for %s: %s", user_id, exc)


def _build_question_batch(user_id: str, subject: str, current_stress: float, current_fatigue: float):
    next_q = _schedule_service().get_next_questions(
        user_id,
        _normalize_subject(subject),
        float(current_stress or 0.3),
        float(current_fatigue or 0.3),
    )
    questions = []
    for idx, q in enumerate(next_q.get('questions', []), start=1):
        topic_id = q.get('topic_id', 'unknown_topic')
        questions.append(
            {
                'id': q.get('question_id') or f"flask_{topic_id}_{int(datetime.now().timestamp())}_{idx}",
                'topic_id': topic_id,
                'topic': topic_id,
                'topic_category': topic_id,
                'subject': q.get('subject') or _normalize_subject(subject),
                'difficulty': float(q.get('difficulty', 0.5) or 0.5),
                'type': 'MCQ',
                'text': q.get('text') or f"Practice question for {topic_id}",
                'options': q.get('options', []),
                'expected_time': int(q.get('expected_time', 120) or 120),
                'marks': int(q.get('marks', 4) or 4),
                'priority': q.get('priority'),
                'batch_type': q.get('batch_type', 'immediate'),
            }
        )

    return {
        'questions': questions,
        'recommended_break': bool(next_q.get('recommended_break', False)),
        'remaining_in_batch': int(next_q.get('remaining_in_batch', 0) or 0),
    }

def _safe_train_if_needed(user_id: str):
    """Check if training is needed and trigger it with proper logging."""
    training_needed = _training_service().check_retrain_needed(user_id)
    training_result = None

    if training_needed.get('needed'):
        logger.info(f"Training needed for user {user_id}: {training_needed['models']}")
        try:
            training_result = _training_service().train_all_models(user_id, training_needed)
            logger.info(f"Training completed for user {user_id}: {training_result}")
        except Exception as exc:
            logger.error(f"Training failed for user {user_id}: {exc}", exc_info=True)
    else:
        logger.debug(f"No training needed for user {user_id}")

    post_status = _training_service().check_retrain_needed(user_id)
    return {
        **training_needed,
        'training_result': training_result,
        'post_training_status': post_status,
    }

@retention_bp.route('/health', methods=['GET'])
def retention_health():
    """Health endpoint scoped to retention blueprint."""
    return jsonify(
        {
            'success': True,
            'status': 'healthy',
            'service': 'retention',
            'timestamp': datetime.now().isoformat(),
        }
    ), 200


@retention_bp.route('/session/start', methods=['POST'])
def start_retention_session():
    """Start Flask-side retention session for Node/Frontend orchestration."""
    try:
        data = request.get_json() or {}

        user_id = data.get('student_id') or data.get('user_id')
        subject = _normalize_subject(data.get('subject'))
        topics = data.get('topics') or _default_topics_for_subject(subject)
        session_type = data.get('session_type', 'practice')
        session_id = data.get('session_id') or str(uuid.uuid4())

        if not user_id:
            return jsonify({'success': False, 'error': 'student_id is required'}), 400
        if not _is_valid_subject(subject):
            return jsonify({'success': False, 'error': 'subject must be english or gk'}), 400

        _student_paths(user_id)
        training_needed = _safe_train_if_needed(user_id)
        predictions = _prediction_service().get_all_predictions(user_id, subject)
        question_batch = _build_question_batch(user_id, subject, 0.3, 0.3)

        _RETENTION_SESSIONS[session_id] = {
            'session_id': session_id,
            'user_id': str(user_id),
            'subject': subject,
            'topics': topics,
            'session_type': session_type,
            'started_at': datetime.now().isoformat(),
            'events_count': 0,
        }

        return jsonify(
            {
                'success': True,
                'session_id': session_id,
                'user_id': str(user_id),
                'subject': subject,
                'topics': topics,
                'session_type': session_type,
                'predictions': {
                    'micro': predictions.get('micro', []),
                    'meso': predictions.get('meso', []),
                    'macro': predictions.get('macro', {}),
                    'forgetting_curves': predictions.get('forgetting_curves', {}),
                    'stressFatigue': _prediction_service().get_stress_fatigue_predictions(user_id, subject),
                },
                'questions': question_batch.get('questions', []),
                'metadata': {
                    'training_needed': training_needed,
                    'sequence_status': _sequence_status(str(user_id)),
                    'recommended_break': question_batch.get('recommended_break', False),
                    'remaining_in_batch': question_batch.get('remaining_in_batch', 0),
                    'storage_dir': _student_paths(user_id)['root'],
                    'timestamp': datetime.now().isoformat(),
                },
            }
        ), 200
    except Exception as e:
        logger.error(f"Error starting retention session: {str(e)}")
        return jsonify({'error': str(e)}), 500


@retention_bp.route('/session/<session_id>/next', methods=['POST'])
def get_next_session_questions(session_id):
    """Return next questions and updated predictions after recent answers."""
    try:
        session = _RETENTION_SESSIONS.get(session_id)
        data = request.get_json() or {}
        responses = data.get('responses', [])

        inferred_subject = None
        if responses and isinstance(responses, list):
            first = responses[0] or {}
            inferred_subject = first.get('subject') or first.get('subject_id')

        user_id = (
            data.get('student_id')
            or data.get('user_id')
            or (session or {}).get('user_id')
        )
        subject = _normalize_subject(
            data.get('subject')
            or inferred_subject
            or (session or {}).get('subject')
        )
        current_stress = float(data.get('current_stress', 0.3) or 0.3)
        current_fatigue = float(data.get('current_fatigue', 0.3) or 0.3)

        if not user_id:
            return jsonify({'success': False, 'error': 'user_id/student_id is required'}), 400
        if not _is_valid_subject(subject):
            return jsonify({'success': False, 'error': 'subject must be english or gk'}), 400

        _persist_interactions(str(user_id), session_id, subject, responses)
        _safe_train_if_needed(str(user_id))

        if session:
            session['events_count'] = int(session.get('events_count', 0)) + len(responses)

        question_batch = _build_question_batch(str(user_id), subject, current_stress, current_fatigue)
        predictions = _prediction_service().get_all_predictions(str(user_id), subject)

        return jsonify(
            {
                'success': True,
                'session_id': session_id,
                'questions': question_batch.get('questions', []),
                'predictions': {
                    'micro': predictions.get('micro', []),
                    'meso': predictions.get('meso', []),
                    'macro': predictions.get('macro', {}),
                    'stress_fatigue': _prediction_service().get_stress_fatigue_predictions(str(user_id), subject),
                },
                'metadata': {
                    'recommended_break': question_batch.get('recommended_break', False),
                    'remaining_in_batch': question_batch.get('remaining_in_batch', 0),
                    'timestamp': datetime.now().isoformat(),
                },
            }
        ), 200
    except Exception as e:
        logger.error(f"Error getting next session questions: {str(e)}")
        return jsonify({'error': str(e)}), 500


@retention_bp.route('/session/<session_id>/complete', methods=['POST'])
def complete_retention_session(session_id):
    """Finalize Flask-side session and return updated predictions/schedule."""
    try:
        data = request.get_json() or {}
        session = _RETENTION_SESSIONS.get(session_id, {})

        user_id = data.get('student_id') or data.get('user_id') or session.get('user_id')
        subject = _normalize_subject(data.get('subject') or session.get('subject'))
        answers = data.get('answers', [])

        if not user_id:
            return jsonify({'success': False, 'error': 'user_id/student_id is required'}), 400
        if subject and not _is_valid_subject(subject):
            return jsonify({'success': False, 'error': 'subject must be english or gk'}), 400

        if answers:
            _persist_interactions(str(user_id), session_id, subject or 'english', answers)

        training_needed = _safe_train_if_needed(str(user_id))
        predictions = _prediction_service().get_all_predictions(str(user_id), subject)
        schedule = _schedule_service().generate_daily_schedule(str(user_id), subject, predictions)

        _RETENTION_SESSIONS.pop(session_id, None)

        return jsonify(
            {
                'success': True,
                'session_id': session_id,
                'analysis': {
                    'training_needed': training_needed,
                    'retention_summary': _prediction_service().get_retention_summary(str(user_id), subject),
                },
                'updated_predictions': {
                    'micro': predictions.get('micro', []),
                    'meso': predictions.get('meso', []),
                    'macro': predictions.get('macro', {}),
                    'forgetting_curves': predictions.get('forgetting_curves', {}),
                    'stress_fatigue': _prediction_service().get_stress_fatigue_predictions(str(user_id), subject),
                },
                'schedule': schedule,
                'timestamp': datetime.now().isoformat(),
            }
        ), 200
    except Exception as e:
        logger.error(f"Error completing retention session: {str(e)}")
        return jsonify({'error': str(e)}), 500


@retention_bp.route('/predictions/update/<user_id>', methods=['POST'])
def update_predictions_after_answers(user_id):
    """Node compatibility endpoint to refresh predictions after recent answers."""
    try:
        data = request.get_json() or {}
        subject = _normalize_subject(data.get('subject')) or None
        answers = data.get('answers', [])

        if answers:
            session_id = data.get('session_id', f"update_{int(datetime.now().timestamp())}")
            _persist_interactions(str(user_id), session_id, subject or 'english', answers)

        training_needed = _safe_train_if_needed(str(user_id))
        predictions = _prediction_service().get_all_predictions(str(user_id), subject)

        sequence_status = _sequence_status(str(user_id))
        models_cfg = training_needed.get('models', {})
        micro_ready = bool(predictions.get('micro')) and int(sequence_status.get('micro_sequence_windows', 0)) >= int((models_cfg.get('micro') or {}).get('min_required', 20))
        meso_ready = bool(predictions.get('meso')) and int(sequence_status.get('meso_rows', 0)) >= int((models_cfg.get('meso') or {}).get('min_required', 7))
        macro_ready = bool(predictions.get('macro')) and int(sequence_status.get('macro_rows', 0)) >= int((models_cfg.get('macro') or {}).get('min_required', 30))

        model_outputs = _build_model_outputs(
            str(user_id),
            subject,
            answers,
            predictions,
            sequence_status,
            training_needed,
        )

        micro_output = ((model_outputs.get('micro_lstm') or {}).get('output') or {})
        meso_output = ((model_outputs.get('meso_lstm') or {}).get('output') or {})
        macro_output = ((model_outputs.get('macro_lstm') or {}).get('output') or {})

        live_analysis = {
            'retention_score': _round2(micro_output.get('retention_score', micro_output.get('current_retention', 0.0))),
            'planned_revision': micro_output.get('planned_revision', {
                'after_questions': int((meso_output.get('optimal_revision_plan') or {}).get('target_questions', 8)),
                'after_seconds': int(max(0, int(micro_output.get('repeat_in_days', 1)) * 86400)),
                'after_days': int(micro_output.get('repeat_in_days', 1)),
            }),
            'probability_next_correct_attempt': _round2(micro_output.get('probability_correct_next_attempt', micro_output.get('next_retention', 0.0))),
            'subject_retention_score': _round2(meso_output.get('subject_retention_score', meso_output.get('subject_retention_7d', 0.0))),
            'optimal_revision_plan': meso_output.get('optimal_revision_plan', {}),
            'optimal_daily_study_schedule': macro_output.get('optimal_daily_study_schedule', {}),
            'subject_priority_order': macro_output.get('subject_priority_order', []),
            'predicted_long_term_retention_score': _round2(macro_output.get('predicted_long_term_retention_score', 0.0)),
            'fatigue_risk_probability': _round2(macro_output.get('fatigue_risk_probability', 0.0)),
        }

        return jsonify(
            {
                'success': True,
                'user_id': str(user_id),
                'predictions': predictions,
                'schedule_update_needed': bool(training_needed.get('needed', False)),
                'training_needed': training_needed,
                'sequence_status': sequence_status,
                'models_ready': {
                    'micro': micro_ready,
                    'meso': meso_ready,
                    'macro': macro_ready,
                },
                'model_outputs': model_outputs,
                'live_analysis': live_analysis,
                'timestamp': datetime.now().isoformat(),
            }
        ), 200
    except Exception as e:
        logger.error(f"Error updating predictions after answers: {str(e)}")
        return jsonify({'error': str(e)}), 500


@retention_bp.route('/predictions/<user_id>', methods=['GET'])
def get_predictions(user_id):
    """Get all retention predictions for a user"""
    try:
        subject = request.args.get('subject')
        predictions = _prediction_service().get_all_predictions(user_id, subject)

        return jsonify({
            'success': True,
            'user_id': user_id,
            'subject': subject,
            'predictions': predictions
        }), 200
    except Exception as e:
        logger.error(f"Error getting predictions: {str(e)}")
        return jsonify({'error': str(e)}), 500


@retention_bp.route('/predictions/<user_id>/topic/<topic_id>', methods=['GET'])
def get_topic_prediction(user_id, topic_id):
    """Get prediction for a specific topic"""
    try:
        prediction = _prediction_service().get_topic_predictions(user_id, topic_id)

        return jsonify({
            'success': True,
            'user_id': user_id,
            'topic_id': topic_id,
            'prediction': prediction
        }), 200
    except Exception as e:
        logger.error(f"Error getting topic prediction: {str(e)}")
        return jsonify({'error': str(e)}), 500


@retention_bp.route('/predictions/<user_id>/subject/<subject>', methods=['GET'])
def get_subject_predictions(user_id, subject):
    """Get predictions for a specific subject"""
    try:
        predictions = _prediction_service().get_subject_predictions(user_id, subject)

        return jsonify({
            'success': True,
            'user_id': user_id,
            'subject': subject,
            'predictions': predictions
        }), 200
    except Exception as e:
        logger.error(f"Error getting subject predictions: {str(e)}")
        return jsonify({'error': str(e)}), 500


@retention_bp.route('/summary/<user_id>', methods=['GET'])
def get_retention_summary(user_id):
    """Get retention summary for dashboard"""
    try:
        subject = request.args.get('subject')
        summary = _prediction_service().get_retention_summary(user_id, subject)

        return jsonify({
            'success': True,
            'user_id': user_id,
            'subject': subject,
            'summary': summary
        }), 200
    except Exception as e:
        logger.error(f"Error getting retention summary: {str(e)}")
        return jsonify({'error': str(e)}), 500


@retention_bp.route('/forgetting-curves/<user_id>', methods=['GET'])
def get_forgetting_curves(user_id):
    """Get forgetting curves for all topics"""
    try:
        subject = request.args.get('subject')
        topic_id = request.args.get('topic_id')

        if topic_id:
            curve = _prediction_service().get_topic_forgetting_curve(user_id, topic_id)
            return jsonify({
                'success': True,
                'user_id': user_id,
                'topic_id': topic_id,
                'curve': curve
            }), 200
        else:
            curves = _prediction_service().get_all_forgetting_curves(user_id, subject)
            return jsonify({
                'success': True,
                'user_id': user_id,
                'subject': subject,
                'curves': curves
            }), 200
    except Exception as e:
        logger.error(f"Error getting forgetting curves: {str(e)}")
        return jsonify({'error': str(e)}), 500


@retention_bp.route('/batch-recommendations/<user_id>', methods=['GET'])
def get_batch_recommendations(user_id):
    """Get batch recommendations for scheduling"""
    try:
        batch_type = request.args.get('batch_type')
        subject = request.args.get('subject')

        recommendations = _prediction_service().get_batch_recommendations(
            user_id, batch_type, subject
        )

        return jsonify({
            'success': True,
            'user_id': user_id,
            'subject': subject,
            'recommendations': recommendations
        }), 200
    except Exception as e:
        logger.error(f"Error getting batch recommendations: {str(e)}")
        return jsonify({'error': str(e)}), 500


@retention_bp.route('/stress-fatigue/<user_id>', methods=['GET'])
def get_stress_fatigue(user_id):
    """Get stress and fatigue predictions"""
    try:
        predictions = _prediction_service().get_stress_fatigue_predictions(user_id)

        return jsonify({
            'success': True,
            'user_id': user_id,
            'stress_fatigue': predictions
        }), 200
    except Exception as e:
        logger.error(f"Error getting stress fatigue: {str(e)}")
        return jsonify({'error': str(e)}), 500


@retention_bp.route('/update-after-interaction', methods=['POST'])
def update_after_interaction():
    """Update retention after a learning interaction"""
    try:
        data = request.get_json()
        session_id = data.get('session_id')
        session_ctx = _RETENTION_SESSIONS.get(session_id, {})

        user_id = data.get('user_id') or data.get('student_id') or session_ctx.get('user_id')
        topic_id = data.get('topic_id') or data.get('concept_area') or 'unknown_topic'
        question_id = data.get('question_id')
        was_correct = data.get('correct', False)
        response_time = data.get('response_time_ms', 2000)
        stress_level = data.get('stress_level', 0.3)
        fatigue_level = data.get('fatigue_index', 0.3)

        if not user_id:
            return jsonify({'success': False, 'error': 'user_id/student_id is required'}), 400

        _persist_interactions(
            str(user_id),
            session_id or f"interaction_{int(datetime.now().timestamp())}",
            session_ctx.get('subject', data.get('subject', 'english')),
            [
                {
                    'question_id': question_id,
                    'topic_id': topic_id,
                    'correct': was_correct,
                    'response_time_ms': response_time,
                    'stress_level': stress_level,
                    'fatigue_index': fatigue_level,
                    'timestamp': datetime.now().isoformat(),
                }
            ],
        )

        # Update schedule
        _schedule_service().update_schedule_after_interaction(
            user_id, topic_id, was_correct
        )

        # Check if retraining needed
        training_needed = _training_service().check_retrain_needed(user_id)

        # Get updated predictions for the topic
        updated_prediction = _prediction_service().get_topic_predictions(
            user_id, topic_id
        )

        return jsonify({
            'success': True,
            'user_id': user_id,
            'topic_id': topic_id,
            'question_id': question_id,
            'training_needed': training_needed,
            'updated_prediction': updated_prediction,
            'timestamp': datetime.now().isoformat()
        }), 200
    except Exception as e:
        logger.error(f"Error updating after interaction: {str(e)}")
        return jsonify({'error': str(e)}), 500


@retention_bp.route('/question-sequence/<user_id>', methods=['GET'])
def get_question_sequence(user_id):
    """Get question ID repetition sequence for scheduling"""
    try:
        subject = request.args.get('subject')
        batch_type = request.args.get('batch_type', 'immediate')
        count = request.args.get('count', 10, type=int)

        sequence = _prediction_service().get_question_sequence(
            user_id, subject, batch_type, count
        )

        return jsonify({
            'success': True,
            'user_id': user_id,
            'subject': subject,
            'batch_type': batch_type,
            'sequence': sequence,
            'count': len(sequence)
        }), 200
    except Exception as e:
        logger.error(f"Error getting question sequence: {str(e)}")
        return jsonify({'error': str(e)}), 500


@retention_bp.route('/batch-complete/<user_id>', methods=['POST'])
def batch_complete(user_id):
    """Handle batch completion notification"""
    try:
        data = request.get_json()
        batch_type = data.get('batch_type')
        subject = data.get('subject')
        performance = data.get('performance', {})

        # Update predictions based on batch performance
        _prediction_service().update_after_batch(
            user_id, subject, batch_type, performance
        )

        # Generate new schedule
        new_schedule = _schedule_service().generate_daily_schedule(
            user_id, subject
        )

        return jsonify({
            'success': True,
            'user_id': user_id,
            'batch_type': batch_type,
            'subject': subject,
            'new_schedule': new_schedule,
            'timestamp': datetime.now().isoformat()
        }), 200
    except Exception as e:
        logger.error(f"Error handling batch completion: {str(e)}")
        return jsonify({'error': str(e)}), 500
