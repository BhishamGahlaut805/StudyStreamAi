import os

class Config:
    # Base directory
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

    # Student data directory - specific path
    STUDENTS_DIR = r'C:\Users\bhish\OneDrive\Desktop\StudyStreamAi\AI\data\students'
    BASE_DIR_DATA = r'C:\Users\bhish\OneDrive\Desktop\StudyStreamAi\AI\data'
    # Models directory for saved model files
    MODELS_DIR = os.path.join(BASE_DIR_DATA, 'saved_models')

    # Feature definitions
    PRACTICE_FEATURES = [
        'accuracy', 'normalized_response_time', 'rolling_time_variance',
        'answer_change_count', 'stress_score', 'confidence_index',
        'concept_mastery_score', 'current_question_difficulty',
        'consecutive_correct_streak', 'fatigue_indicator',
        'focus_loss_frequency', 'preferred_difficulty_offset'
    ]
    PRACTICE_TARGET = 'next_difficulty'
    SEQUENCE_LENGTH_PRACTICE = 10
    PRACTICE_FEATURES_COUNT = len(PRACTICE_FEATURES)

    GLOBAL_FEATURES = [
        'session_accuracy_avg', 'avg_solved_difficulty', 'max_difficulty_sustained',
        'performance_trend_slope', 'retention_score', 'burnout_risk_index',
        'stress_trend_slope', 'concept_coverage_ratio', 'high_difficulty_accuracy',
        'consistency_index', 'avg_response_time_trend', 'serious_test_performance_score'
    ]
    GLOBAL_TARGET = 'readiness_difficulty_score'
    SEQUENCE_LENGTH_GLOBAL = 5
    GLOBAL_FEATURES_COUNT = len(GLOBAL_FEATURES)

    # Exam features
    EXAM_FEATURES = 8
    SEQUENCE_LENGTH_EXAM = 5

    # Learning velocity features
    LEARNING_VELOCITY_FEATURES = 9
    SEQUENCE_LENGTH_DAILY = 30

    # Burnout risk features
    BURNOUT_RISK_FEATURES = 11
    SEQUENCE_LENGTH_SESSION = 14

    # Training parameters - adjusted thresholds
    MIN_PRACTICE_SAMPLES = 10  # Train after just 10 samples
    PRACTICE_RETRAIN_INTERVAL = 5  # Retrain every +5 new rows after initial threshold
    MIN_PRACTICE_SAMPLES_FOR_GLOBAL = 40  # Global model after 40 entries
    MIN_EXAM_SAMPLES = 5
    EPOCHS = 100
    BATCH_SIZE = 32

    # Create directories
    os.makedirs(STUDENTS_DIR, exist_ok=True)
    os.makedirs(MODELS_DIR, exist_ok=True)


#----------------------------- Configuration of Retention_Models Folder ------------------#

"""
Centralized configuration for Retention AI Flask Backend
"""

"""
Configuration for Retention AI Flask Backend
"""
import os


class RetentionConfig:
    """Configuration class for retention models"""

    # Base directories
    BASE_DIR_RETENTION = os.path.dirname(os.path.abspath(__file__))
    RETENTION_BASE_DIR = os.path.join(BASE_DIR_RETENTION, 'Retention_Model')

    # Student data storage - Updated path
    STUDENT_DATA_DIR_RETENTION = os.path.join(RETENTION_BASE_DIR, 'Retention_Student_data')

    # Model storage
    MODELS_DIR_RETENTION = os.path.join(STUDENT_DATA_DIR_RETENTION, 'saved_models')

    # Compatibility aliases used by retention blueprints/services
    STUDENT_DATA_DIR = STUDENT_DATA_DIR_RETENTION
    MODELS_DIR = MODELS_DIR_RETENTION
    BASE_DIR = RETENTION_BASE_DIR

    # Create directories
    os.makedirs(STUDENT_DATA_DIR_RETENTION, exist_ok=True)
    os.makedirs(MODELS_DIR_RETENTION, exist_ok=True)

    # Model configurations
    RETRAIN_COOLDOWN_SECONDS = 120
    EXPORT_TFLITE_MODELS = False

    MODEL_CONFIG = {
        'micro': {
            'name': 'micro_lstm',
            'sequence_length': 20,
            'n_features': 15,
            'epochs': 100,
            'batch_size': 32,
            'learning_rate': 0.001,
            'min_samples': 20,
            'retrain_interval': 5
        },
        'meso': {
            'name': 'meso_lstm',
            'sequence_length': 30,
            'n_temporal_features': 10,
            'n_metadata_features': 18,
            'epochs': 80,
            'batch_size': 16,
            'learning_rate': 0.001,
            'min_samples': 7,
            'retrain_interval': 5
        },
        'macro': {
            'name': 'macro_lstm',
            'encoder_units': 256,
            'decoder_units': 256,
            'n_topics': 100,
            'epochs': 60,
            'batch_size': 16,
            'learning_rate': 0.001,
            'min_samples': 30,
            'retrain_interval': 5
        }
    }

    # Subject and topic definitions
    SUBJECTS = {
        'english': {
            'name': 'English',
            'topics': ['vocabulary', 'idioms', 'phrases', 'synonyms', 'antonyms', 'one_word_substitution']
        },
        'gk': {
            'name': 'General Knowledge',
            'topics': ['history', 'geography', 'science', 'current_affairs']
        }
    }

    # Feature definitions
    FEATURE_DEFINITIONS = {
        'micro_features': [
            'correct', 'response_time_normalized', 'hesitation_count_normalized',
            'confidence_score', 'difficulty_level', 'streak_length',
            'fatigue_index', 'focus_score', 'time_since_last_normalized',
            'attempt_number', 'session_position', 'hour_of_day',
            'stress_level', 'sleep_quality', 'mood_score'
        ],
        'meso_temporal_features': [
            'avg_accuracy', 'avg_response_time_normalized', 'questions_per_hour',
            'topics_covered', 'retention_score', 'fatigue_avg',
            'focus_avg', 'new_topics_learned', 'stress_avg', 'sleep_quality_avg'
        ],
        'meso_metadata_features': [
            'difficulty', 'avg_cohort_retention', 'prerequisite_count',
            'related_topics_count', 'importance', 'frequency_in_corpus',
            'avg_time_to_mastery', 'forgetting_rate', 'interference_score',
            'similarity_to_known', 'concreteness', 'imageability',
            'age_of_acquisition', 'word_length', 'syllable_count',
            'concept_difficulty', 'memory_load', 'abstraction_level'
        ],
        'macro_features': [
            'topics_learned', 'avg_retention', 'study_time_minutes',
            'sessions_completed', 'avg_accuracy', 'avg_response_time',
            'fatigue_avg', 'focus_avg', 'consistency_score',
            'momentum_score', 'confidence_growth', 'speed_improvement',
            'retention_improvement', 'challenge_preference', 'review_ratio',
            'new_vs_review', 'interleaving_score', 'spacing_score',
            'active_recall_score', 'elaboration_score'
        ]
    }

    # Retention thresholds
    RETENTION_THRESHOLDS = {
        'critical': 0.3,
        'warning': 0.5,
        'moderate': 0.7,
        'good': 0.85,
        'excellent': 0.95
    }

    # Question repetition schedules
    REPETITION_SCHEDULES = {
        'immediate': {
            'retention_range': (0, 0.3),
            'batch_size': 3,
            'schedule_type': 'immediate_review',
            'questions_per_topic': 3,
            'description': 'Review now - Critical retention'
        },
        'short_term': {
            'retention_range': (0.3, 0.5),
            'batch_size': 5,
            'schedule_type': 'next_session',
            'questions_per_topic': 4,
            'description': 'Review in next session'
        },
        'medium_term': {
            'retention_range': (0.5, 0.7),
            'batch_size': 8,
            'schedule_type': 'next_day',
            'questions_per_topic': 3,
            'description': 'Review tomorrow'
        },
        'long_term': {
            'retention_range': (0.7, 0.85),
            'batch_size': 10,
            'schedule_type': 'in_3_days',
            'questions_per_topic': 2,
            'description': 'Review in 3 days'
        },
        'mastered': {
            'retention_range': (0.85, 1.0),
            'batch_size': 15,
            'schedule_type': 'in_week',
            'questions_per_topic': 1,
            'description': 'Review weekly'
        }
    }

    # Chapter repetition schedules
    CHAPTER_SCHEDULES = {
        'immediate_repetition': {
            'retention_threshold': 0.4,
            'timing': 'next_session',
            'format': 'condensed_chapter',
            'duration_minutes': 25,
            'questions': 15
        },
        'scheduled_repetition': {
            'retention_range': (0.4, 0.6),
            'timing': 'in_3_days',
            'format': 'spaced_practice',
            'intervals': [3, 7, 14],
            'questions': 10
        },
        'integrated_review': {
            'retention_range': (0.6, 0.8),
            'timing': 'interleaved',
            'format': 'mix_with_new',
            'review_ratio': 0.3,
            'questions': 8
        },
        'long_term_schedule': {
            'retention_threshold': 0.8,
            'timing': 'in_30_days',
            'format': 'comprehensive_test',
            'questions': 25
        }
    }

    # Performance metrics to calculate
    PERFORMANCE_METRICS = [
        'learning_velocity',
        'retention_rate',
        'stress_pattern',
        'fatigue_index',
        'focus_score',
        'confidence_trend',
        'mastery_progress',
        'efficiency_score',
        'consistency_index',
        'momentum_score'
    ]

    # Forgetting curve parameters
    FORGETTING_CURVE = {
        'time_points': [1, 3, 7, 14, 30, 60, 90],
        'decay_factor_range': (0.1, 0.3),
        'reinforcement_boost': 0.15
    }

    # API endpoints for Node.js communication
    NODE_API = {
        'base_url': 'http://localhost:5000',
        'endpoints': {
            'initial_predictions': '/api/ml/initial-predictions',
            'retention_update': '/api/ml/retention-update',
            'batch_complete': '/api/ml/batch-complete',
            'performance_metrics': '/api/ml/performance-metrics',
            'schedule_update': '/api/ml/schedule-update',
            'question_sequence': '/api/ml/question-sequence',
            'stress_fatigue_update': '/api/ml/stress-fatigue-update',
            'health_check': '/api/ml/health'
        },
        'timeout': 5,
        'retry_attempts': 3
    }

    # CSV storage structure
    CSV_STRUCTURE = {
        'interactions': {
            'filename': 'interactions.csv',
            'fields': ['timestamp', 'user_id', 'subject', 'topic_id', 'question_id',
                       'correct', 'response_time_ms', 'confidence', 'difficulty',
                       'hesitation_count', 'fatigue_index', 'focus_score',
                       'stress_level', 'session_id', 'attempt_number', 'streak']
        },
        'daily_aggregates': {
            'filename': 'daily_aggregates.csv',
            'fields': ['date', 'user_id', 'subject', 'avg_accuracy', 'avg_response_time',
                       'questions_attempted', 'topics_covered', 'retention_end_of_day',
                       'fatigue_avg', 'focus_avg', 'stress_avg', 'new_topics_learned',
                       'sessions_completed', 'study_time_minutes']
        },
        'topic_metadata': {
            'filename': 'topic_metadata.csv',
            'fields': ['topic_id', 'subject', 'category', 'difficulty', 'prerequisites',
                       'related_topics', 'importance', 'frequency', 'avg_time_to_mastery',
                       'forgetting_rate', 'similarity_to_known']
        },
        'predictions': {
            'filename': 'predictions.csv',
            'fields': ['timestamp', 'user_id', 'subject', 'topic_id', 'current_retention',
                       'predicted_retention', 'confidence', 'next_review', 'batch_type',
                       'stress_impact', 'fatigue_level']
        },
        'performance_metrics': {
            'filename': 'performance_metrics.csv',
            'fields': ['timestamp', 'user_id', 'subject', 'learning_velocity',
                       'retention_rate', 'stress_pattern', 'fatigue_index',
                       'focus_score', 'confidence_trend', 'mastery_progress',
                       'efficiency_score', 'consistency_index', 'momentum_score']
        }
    }
