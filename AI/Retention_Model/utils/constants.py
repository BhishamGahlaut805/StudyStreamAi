"""
Constants used throughout the Flask application
"""

# Model configuration
MODEL_CONFIG = {
    'micro': {
        'sequence_length': 20,
        'n_features': 15,
        'epochs': 50,
        'batch_size': 32,
        'learning_rate': 0.001
    },
    'meso': {
        'sequence_length': 30,
        'n_temporal_features': 10,
        'n_metadata_features': 18,
        'epochs': 50,
        'batch_size': 32,
        'learning_rate': 0.001
    },
    'macro': {
        'encoder_units': 256,
        'decoder_units': 256,
        'n_topics': 100,
        'epochs': 50,
        'batch_size': 32,
        'learning_rate': 0.001
    }
}

# Retention thresholds
RETENTION_THRESHOLDS = {
    'critical': 0.3,
    'warning': 0.5,
    'moderate': 0.7,
    'good': 0.85,
    'excellent': 0.95
}

# Batch configurations
BATCH_CONFIG = {
    'immediate': {
        'threshold': 0.3,
        'size': '2-3',
        'timing': 'current_session',
        'questions': 3
    },
    'short_term': {
        'threshold': 0.5,
        'size': '5-6',
        'timing': 'same_session_later',
        'questions': 5
    },
    'medium_term': {
        'threshold': 0.7,
        'size': '10-12',
        'timing': 'next_session',
        'questions': 8
    },
    'long_term': {
        'threshold': 0.9,
        'size': 'batch',
        'timing': 'future_sessions',
        'questions': 12
    }
}

# Review intervals (in days)
REVIEW_INTERVALS = {
    'immediate': 0,
    'next_day': 1,
    'three_days': 3,
    'one_week': 7,
    'two_weeks': 14,
    'one_month': 30,
    'three_months': 90
}

# Subject and topic categories
SUBJECTS = {
    'english': {
        'name': 'English',
        'topics': [
            'vocabulary',
            'idioms',
            'phrases',
            'synonyms',
            'antonyms',
            'one_word_substitution'
        ]
    },
    'gk': {
        'name': 'General Knowledge',
        'topics': [
            'history',
            'geography',
            'science',
            'current_affairs'
        ]
    }
}

# Difficulty levels
DIFFICULTY_LEVELS = {
    1: 'very_easy',
    2: 'easy',
    3: 'medium',
    4: 'hard',
    5: 'very_hard'
}

# API endpoints
NODE_API_ENDPOINTS = {
    'initial_predictions': '/api/ml/initial-predictions',
    'retention_update': '/api/ml/retention-update',
    'batch_complete': '/api/ml/batch-complete',
    'performance_metrics': '/api/ml/performance-metrics',
    'schedule_update': '/api/ml/schedule-update',
    'question_sequence': '/api/ml/question-sequence',
    'stress_fatigue_update': '/api/ml/stress-fatigue-update',
    'health_check': '/api/ml/health'
}

# File paths
FILE_PATHS = {
    'student_data': 'data/students',
    'cohort_models': 'data/cohort_models',
    'logs': 'logs',
    'exports': 'exports'
}

# HTTP status codes
HTTP_STATUS = {
    'ok': 200,
    'created': 201,
    'bad_request': 400,
    'unauthorized': 401,
    'forbidden': 403,
    'not_found': 404,
    'server_error': 500
}

# Error messages
ERROR_MESSAGES = {
    'missing_user_id': 'User ID is required',
    'missing_subject': 'Subject is required',
    'missing_topic': 'Topic ID is required',
    'invalid_data': 'Invalid data format',
    'model_not_found': 'Model not found for this user',
    'training_failed': 'Model training failed',
    'prediction_failed': 'Prediction generation failed',
    'unauthorized': 'Unauthorized access',
    'server_error': 'Internal server error'
}

# Stress and fatigue thresholds
STRESS_THRESHOLDS = {
    'low': 0.3,
    'moderate': 0.6,
    'high': 0.8
}

FATIGUE_THRESHOLDS = {
    'low': 0.3,
    'moderate': 0.6,
    'high': 0.8
}

# Focus score thresholds
FOCUS_THRESHOLDS = {
    'low': 0.4,
    'moderate': 0.7,
    'high': 0.9
}
