from flask import Blueprint, request, jsonify, current_app
import logging
import os
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from services.feature_engineering import FeatureEngineeringService

dashboard_bp = Blueprint('dashboard', __name__)
logger = logging.getLogger(__name__)


def _get_datetime_series(df: pd.DataFrame):
    """Return parsed datetime series from first available time column."""
    if df is None or df.empty:
        return None

    for col in ['timestamp', 'submitted_at', 'created_at', 'date']:
        if col in df.columns:
            parsed = pd.to_datetime(df[col], errors='coerce')
            parsed = parsed.dropna()
            if not parsed.empty:
                return parsed
    return None


def _get_last_datetime_iso(df: pd.DataFrame):
    """Return last datetime as ISO string from first available time column."""
    series = _get_datetime_series(df)
    if series is None or series.empty:
        return None
    return series.iloc[-1].isoformat()

@dashboard_bp.route('/performance/<student_id>', methods=['GET'])
def get_dashboard_performance(student_id):
    """Complete in-depth performance analysis for dashboard"""
    try:
        data_manager = current_app.prediction_service._get_data_manager(student_id)

        # Load all data
        practice_df = data_manager.load_practice_features()
        exam_df = data_manager.load_exam_features()
        concept_features = data_manager.load_concept_features()

        # Compute performance metrics
        feature_service = FeatureEngineeringService()
        if hasattr(feature_service, 'compute_performance_metrics'):
            metrics = feature_service.compute_performance_metrics(practice_df, exam_df)
        else:
            logger.warning("FeatureEngineeringService.compute_performance_metrics missing; using fallback metrics")
            metrics = {
                'practice': {
                    'total_questions': int(len(practice_df)),
                    'overall_accuracy': 0.0,
                    'recent_accuracy': 0.0,
                    'avg_difficulty': 0.5,
                    'fatigue_level': 0.0,
                },
                'exam': {
                    'total_exams': int(len(exam_df)),
                    'avg_score': 0.0,
                },
                'overall': {
                    'readiness_score': 0.5,
                    'burnout_risk': 0.3,
                },
                'concepts': [],
            }

        # Get model predictions
        predictions = {}

        # 1. Practice difficulty model
        practice_model = current_app.prediction_service._load_model(
            student_id, None, 'practice_difficulty',
            current_app.config.get('SEQUENCE_LENGTH_PRACTICE', 20),
            current_app.config.get('PRACTICE_FEATURES', 12)
        )
        predictions['practice_model'] = {
            'trained': practice_model is not None,
            'last_trained': data_manager.load_model_metadata('practice_difficulty')[-1]['timestamp']
                           if data_manager.load_model_metadata('practice_difficulty') else None
        }

        # 2. Exam difficulty model
        exam_model = current_app.prediction_service._load_model(
            student_id, None, 'exam_difficulty',
            current_app.config.get('SEQUENCE_LENGTH_EXAM', 10),
            current_app.config.get('EXAM_FEATURES', 8)
        )
        predictions['exam_model'] = {
            'trained': exam_model is not None,
            'last_trained': data_manager.load_model_metadata('exam_difficulty')[-1]['timestamp']
                           if data_manager.load_model_metadata('exam_difficulty') else None
        }

        # 3. Learning velocity for all concepts
        predictions['learning_velocity'] = {}
        for concept, feat in list(concept_features.items())[:10]:
            if 'concept_mastery_history' in feat and len(feat['concept_mastery_history']) >= 5:
                # Create proper feature vector for learning velocity
                history = feat['concept_mastery_history'][-30:]
                velocity_features = []
                for i, mastery in enumerate(history):
                    velocity_features.append([
                        mastery,
                        feat.get('practice_frequency', 1.0),
                        feat.get('revision_gap', 0.5),
                        feat.get('avg_difficulty', 0.6),
                        feat.get('success_rate', 0.7),
                        feat.get('retention', 0.8),
                        feat.get('time_spent', 30),
                        feat.get('improvement_rate', 0.1),
                        feat.get('confidence_growth', 0.6)
                    ])

                vel_pred = current_app.prediction_service.predict_learning_velocity(
                    student_id, concept, velocity_features
                )
                predictions['learning_velocity'][concept] = vel_pred

        # 4. Burnout risk with better feature extraction
        if not practice_df.empty and 'session_id' in practice_df.columns:
            session_features = []
            sessions = practice_df['session_id'].unique()[-14:]  # Last 14 sessions

            for session_id in sessions:
                session_data = practice_df[practice_df['session_id'] == session_id]
                if len(session_data) >= 3:
                    session_features.extend([
                        float(session_data['accuracy'].mean()),
                        float(session_data['accuracy'].diff().mean() if len(session_data) > 1 else 0),
                        float(session_data['stress_score'].diff().mean() if 'stress_score' in session_data.columns else 0),
                        float(session_data['normalized_response_time'].diff().mean() if 'normalized_response_time' in session_data.columns else 0),
                        float(session_data['fatigue_indicator'].iloc[-1] - session_data['fatigue_indicator'].iloc[0] if 'fatigue_indicator' in session_data.columns else 0),
                        float(session_data['time_spent'].sum() / 60 if 'time_spent' in session_data.columns else 10),
                        1,  # days_without_break placeholder
                        float(session_data[session_data['current_question_difficulty'] > 0.7]['accuracy'].mean() if 'current_question_difficulty' in session_data.columns and session_data[session_data['current_question_difficulty'] > 0.7].any() else 0.5),
                        float(1 - session_data['accuracy'].std() if len(session_data) > 1 else 0.5),
                        float(session_data['confidence_index'].diff().mean() if 'confidence_index' in session_data.columns and len(session_data) > 1 else 0),
                        float((session_data['time_spent'] < 5).mean() if 'time_spent' in session_data.columns else 0),
                        float(session_data['accuracy'].iloc[-len(session_data)//2:].mean() - session_data['accuracy'].iloc[:len(session_data)//2].mean() if len(session_data) >= 4 else 0)
                    ])

            if session_features:
                burnout = current_app.prediction_service.predict_burnout_risk(
                    student_id, session_features
                )
                predictions['burnout_risk'] = burnout

        # 5. Priority scores for all concepts
        concept_priority_features = {}
        for concept, feat in concept_features.items():
            concept_priority_features[concept] = [
                feat.get('accuracy', 0.5),
                0.5,  # exam_weight
                feat.get('avg_difficulty', 0.5) * 2,
                predictions['learning_velocity'].get(concept, {}).get('mastery_slope_next_7_days', 0),
                0.5,  # stability_index
                0.5   # readiness
            ]

        if concept_priority_features:
            priorities = current_app.prediction_service.predict_priority_scores(
                student_id, concept_priority_features
            )
            predictions['adaptive_scheduling'] = priorities

        # Enhanced chart data
        chart_data = {
            'accuracy_over_time': [],
            'difficulty_over_time': [],
            'concept_mastery': [],
            'burnout_trend': [],
            'weekly_progress': [],
            'concept_radar': []
        }

        if not practice_df.empty and 'timestamp' in practice_df.columns:
            # Daily aggregation
            practice_df['date'] = pd.to_datetime(practice_df['timestamp']).dt.date
            daily = practice_df.groupby('date').agg({
                'accuracy': 'mean',
                'current_question_difficulty': 'mean',
                'stress_score': 'mean' if 'stress_score' in practice_df.columns else None,
                'fatigue_indicator': 'mean' if 'fatigue_indicator' in practice_df.columns else None
            }).reset_index()

            chart_data['accuracy_over_time'] = [
                {'date': str(row['date']), 'value': float(row['accuracy'])}
                for _, row in daily.iterrows()
            ]

            chart_data['difficulty_over_time'] = [
                {'date': str(row['date']), 'value': float(row['current_question_difficulty'])}
                for _, row in daily.iterrows()
            ]

            # Weekly progress
            if len(daily) >= 7:
                weekly_avg = daily['accuracy'].rolling(7, min_periods=1).mean()
                chart_data['weekly_progress'] = [
                    {'week': f'Week {i+1}', 'accuracy': float(val)}
                    for i, val in enumerate(weekly_avg.iloc[::7].tolist())
                ]

        # Concept radar data
        if concept_features:
            chart_data['concept_radar'] = [
                {'concept': c, 'mastery': float(f.get('accuracy', 0.5))}
                for c, f in concept_features.items()
            ]
            chart_data['concept_mastery'] = chart_data['concept_radar']

        # Burnout trend
        if 'burnout_risk' in predictions:
            chart_data['burnout_trend'] = [{
                'current': predictions['burnout_risk'].get('burnout_risk', 0.3),
                'threshold_low': 0.3,
                'threshold_high': 0.6
            }]

        # Performance insights
        insights = []
        if metrics['practice']:
            if metrics['practice'].get('recent_accuracy', 0) > metrics['practice'].get('overall_accuracy', 0):
                insights.append("Your recent performance is improving!")
            if metrics['practice'].get('fatigue_level', 0) > 0.7:
                insights.append("High fatigue detected - consider taking a break")

        if predictions.get('learning_velocity'):
            improving = [c for c, v in predictions['learning_velocity'].items()
                        if v.get('mastery_slope_next_7_days', 0) > 0.05]
            if improving:
                insights.append(f"Fastest improving concepts: {', '.join(improving[:3])}")

        # Final response
        practice_dt = _get_datetime_series(practice_df)
        exam_dt = _get_datetime_series(exam_df)

        questions_today = 0
        if practice_dt is not None and not practice_dt.empty:
            today = datetime.now().date()
            questions_today = int((practice_dt.dt.date == today).sum())

        dashboard_data = {
            'student_id': student_id,
            'last_updated': datetime.now().isoformat(),
            'summary': {
                'total_practice_questions': int(metrics['practice'].get('total_questions', 0)),
                'overall_accuracy': float(metrics['practice'].get('overall_accuracy', 0)),
                'avg_difficulty': float(metrics['practice'].get('avg_difficulty', 0.5)),
                'total_exams': int(metrics.get('exam', {}).get('total_exams', 0)),
                'exam_avg_score': float(metrics.get('exam', {}).get('avg_score', 0)),
                'readiness_score': float(metrics['overall'].get('readiness_score', 0.5)),
                'burnout_risk': float(metrics['overall'].get('burnout_risk', 0.3))
            },
            'practice_metrics': metrics.get('practice', {}),
            'exam_metrics': metrics.get('exam', {}),
            'concept_performance': metrics.get('concepts', []),
            'predictions': predictions,
            'charts': chart_data,
            'insights': insights,
            'recent_activity': {
                'last_practice': _get_last_datetime_iso(practice_df),
                'last_exam': _get_last_datetime_iso(exam_df),
                'questions_today': questions_today,
                'streak_days': _calculate_streak(practice_df)
            }
        }

        return jsonify({'success': True, 'dashboard_data': dashboard_data})

    except Exception as e:
        logger.error(f"Dashboard error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

def _calculate_streak(practice_df):
    """Calculate current practice streak in days"""
    if practice_df.empty or 'timestamp' not in practice_df.columns:
        return 0

    dates = pd.to_datetime(practice_df['timestamp']).dt.date.unique()
    dates = sorted(dates, reverse=True)

    if not dates:
        return 0

    streak = 1
    today = datetime.now().date()

    # Check if practiced today
    if dates[0] != today:
        return 0

    # Count consecutive days
    for i in range(1, len(dates)):
        if (dates[i-1] - dates[i]).days == 1:
            streak += 1
        else:
            break

    return streak
