"""
Schedule blueprint - Handles learning schedule API endpoints
"""
from flask import Blueprint, request, jsonify, current_app
import os
import json
import logging
from datetime import datetime

schedule_bp = Blueprint('schedule', __name__)
logger = logging.getLogger(__name__)


def _prediction_service():
    return getattr(current_app, 'retention_prediction_service', getattr(current_app, 'prediction_service', None))


def _schedule_service():
    return getattr(current_app, 'retention_schedule_service', getattr(current_app, 'schedule_service', None))


@schedule_bp.route('/daily/<user_id>', methods=['GET'])
def get_daily_schedule(user_id):
    """Get today's learning schedule"""
    try:
        subject = request.args.get('subject')

        # Get predictions
        predictions = _prediction_service().get_all_predictions(user_id, subject)

        # Generate schedule
        schedule = _schedule_service().generate_daily_schedule(
            user_id, subject, predictions
        )

        return jsonify({
            'success': True,
            'user_id': user_id,
            'subject': subject,
            'schedule': schedule
        }), 200
    except Exception as e:
        logger.error(f"Error getting daily schedule: {str(e)}")
        return jsonify({'error': str(e)}), 500


@schedule_bp.route('/next-questions/<user_id>', methods=['GET'])
def get_next_questions(user_id):
    """Get next set of questions for immediate learning"""
    try:
        subject = request.args.get('subject')
        current_stress = request.args.get('current_stress', 0.3, type=float)
        current_fatigue = request.args.get('current_fatigue', 0.3, type=float)

        questions = _schedule_service().get_next_questions(
            user_id, subject, current_stress, current_fatigue
        )

        return jsonify({
            'success': True,
            'user_id': user_id,
            'subject': subject,
            'questions': questions,
            'timestamp': datetime.now().isoformat()
        }), 200
    except Exception as e:
        logger.error(f"Error getting next questions: {str(e)}")
        return jsonify({'error': str(e)}), 500


@schedule_bp.route('/subject-repetition/<user_id>/<subject>', methods=['GET'])
def get_subject_repetition(user_id, subject):
    """Get subject-level repetition schedule"""
    try:
        schedule = _schedule_service().get_subject_repetition_schedule(
            user_id, subject
        )

        return jsonify({
            'success': True,
            'user_id': user_id,
            'subject': subject,
            'schedule': schedule
        }), 200
    except Exception as e:
        logger.error(f"Error getting subject repetition: {str(e)}")
        return jsonify({'error': str(e)}), 500


@schedule_bp.route('/topic-repetition/<user_id>/<topic_id>', methods=['GET'])
def get_topic_repetition(user_id, topic_id):
    """Get topic-level repetition schedule"""
    try:
        schedule = _schedule_service().get_topic_repetition_schedule(
            user_id, topic_id
        )

        return jsonify({
            'success': True,
            'user_id': user_id,
            'topic_id': topic_id,
            'schedule': schedule
        }), 200
    except Exception as e:
        logger.error(f"Error getting topic repetition: {str(e)}")
        return jsonify({'error': str(e)}), 500


@schedule_bp.route('/optimal-study-times/<user_id>', methods=['GET'])
def get_optimal_study_times(user_id):
    """Get optimal study times based on stress and fatigue patterns"""
    try:
        subject = request.args.get('subject')
        optimal_times = _schedule_service().get_optimal_study_times(user_id, subject)

        return jsonify({
            'success': True,
            'user_id': user_id,
            'optimal_times': optimal_times
        }), 200
    except Exception as e:
        logger.error(f"Error getting optimal study times: {str(e)}")
        return jsonify({'error': str(e)}), 500


@schedule_bp.route('/update', methods=['POST'])
def update_schedule():
    """Update schedule based on performance"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        subject = data.get('subject')
        batch_completed = data.get('batch_completed', {})

        # Get fresh predictions
        predictions = _prediction_service().get_all_predictions(user_id, subject)

        if not predictions.get('micro'):
            return jsonify({'error': 'No predictions available'}), 404

        # Generate new schedule
        schedule = _schedule_service().generate_daily_schedule(
            user_id, subject, predictions
        )

        # Get updated question sequence
        question_sequence = _prediction_service().get_question_sequence(
            user_id, subject, 'immediate', 10
        )

        return jsonify({
            'success': True,
            'user_id': user_id,
            'subject': subject,
            'schedule': schedule,
            'question_sequence': question_sequence,
            'updated_at': datetime.now().isoformat()
        }), 200
    except Exception as e:
        logger.error(f"Error updating schedule: {str(e)}")
        return jsonify({'error': str(e)}), 500
