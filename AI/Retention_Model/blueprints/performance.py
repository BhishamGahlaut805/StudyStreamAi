"""
Performance blueprint - Handles performance metrics API endpoints
"""
from flask import Blueprint, request, jsonify, current_app
import os
import json
import logging
from datetime import datetime

performance_bp = Blueprint('performance', __name__)
logger = logging.getLogger(__name__)


def _performance_service():
    return getattr(current_app, 'retention_performance_service', getattr(current_app, 'performance_service', None))


@performance_bp.route('/metrics/<user_id>', methods=['GET'])
def get_performance_metrics(user_id):
    """Get all performance metrics for a user"""
    try:
        days = request.args.get('days', 30, type=int)
        subject = request.args.get('subject')

        metrics = _performance_service().calculate_all_metrics(
            user_id, days, subject
        )

        return jsonify({
            'success': True,
            'user_id': user_id,
            'subject': subject,
            'metrics': metrics,
            'period_days': days
        }), 200
    except Exception as e:
        logger.error(f"Error getting performance metrics: {str(e)}")
        return jsonify({'error': str(e)}), 500


@performance_bp.route('/summary/<user_id>', methods=['GET'])
def get_performance_summary(user_id):
    """Get performance summary for dashboard"""
    try:
        subject = request.args.get('subject')
        summary = _performance_service().get_metrics_summary(user_id, subject)

        return jsonify({
            'success': True,
            'user_id': user_id,
            'subject': subject,
            'summary': summary
        }), 200
    except Exception as e:
        logger.error(f"Error getting performance summary: {str(e)}")
        return jsonify({'error': str(e)}), 500


@performance_bp.route('/stress-patterns/<user_id>', methods=['GET'])
def get_stress_patterns(user_id):
    """Get detailed stress pattern analysis"""
    try:
        subject = request.args.get('subject')
        metrics = _performance_service().calculate_all_metrics(
            user_id, 30, subject
        )
        stress = metrics.get('stress_pattern', {})

        return jsonify({
            'success': True,
            'user_id': user_id,
            'subject': subject,
            'stress_pattern': stress
        }), 200
    except Exception as e:
        logger.error(f"Error getting stress patterns: {str(e)}")
        return jsonify({'error': str(e)}), 500


@performance_bp.route('/fatigue-patterns/<user_id>', methods=['GET'])
def get_fatigue_patterns(user_id):
    """Get detailed fatigue pattern analysis"""
    try:
        subject = request.args.get('subject')
        metrics = _performance_service().calculate_all_metrics(
            user_id, 30, subject
        )
        fatigue = metrics.get('fatigue_index', {})

        return jsonify({
            'success': True,
            'user_id': user_id,
            'subject': subject,
            'fatigue_pattern': fatigue
        }), 200
    except Exception as e:
        logger.error(f"Error getting fatigue patterns: {str(e)}")
        return jsonify({'error': str(e)}), 500


@performance_bp.route('/learning-efficiency/<user_id>', methods=['GET'])
def get_learning_efficiency(user_id):
    """Get learning efficiency metrics"""
    try:
        subject = request.args.get('subject')
        metrics = _performance_service().calculate_all_metrics(
            user_id, 30, subject
        )
        efficiency = metrics.get('learning_efficiency', {})

        return jsonify({
            'success': True,
            'user_id': user_id,
            'subject': subject,
            'learning_efficiency': efficiency
        }), 200
    except Exception as e:
        logger.error(f"Error getting learning efficiency: {str(e)}")
        return jsonify({'error': str(e)}), 500


@performance_bp.route('/historical/<user_id>', methods=['GET'])
def get_historical_metrics(user_id):
    """Get historical performance metrics over time"""
    try:
        subject = request.args.get('subject')
        days = request.args.get('days', 30, type=int)

        historical = _performance_service().get_historical_metrics(
            user_id, subject, days
        )

        return jsonify({
            'success': True,
            'user_id': user_id,
            'subject': subject,
            'historical': historical
        }), 200
    except Exception as e:
        logger.error(f"Error getting historical metrics: {str(e)}")
        return jsonify({'error': str(e)}), 500


@performance_bp.route('/subject-comparison/<user_id>', methods=['GET'])
def get_subject_comparison(user_id):
    """Get performance comparison across subjects"""
    try:
        comparison = _performance_service().get_subject_comparison(user_id)

        return jsonify({
            'success': True,
            'user_id': user_id,
            'comparison': comparison
        }), 200
    except Exception as e:
        logger.error(f"Error getting subject comparison: {str(e)}")
        return jsonify({'error': str(e)}), 500
