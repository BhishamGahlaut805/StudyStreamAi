"""
Data validation utilities
"""
import json
import logging
from typing import Dict, List, Any, Union

logger = logging.getLogger(__name__)

def validate_training_data(data: Any, model_type: str) -> bool:
    """
    Validate training data for each model type
    """
    if model_type == 'micro':
        return validate_micro_data(data)
    elif model_type == 'meso':
        return validate_meso_data(data)
    elif model_type == 'macro':
        return validate_macro_data(data)
    else:
        return False

def validate_micro_data(interactions: List[Dict]) -> bool:
    """
    Validate micro-model interaction data
    """
    required_fields = [
        'topic', 'correct', 'response_time_ms',
        'timestamp', 'confidence'
    ]

    if not isinstance(interactions, list):
        logger.error("Micro data must be a list")
        return False

    if len(interactions) < 10:
        logger.error(f"Need at least 10 interactions, got {len(interactions)}")
        return False

    for i, interaction in enumerate(interactions):
        for field in required_fields:
            if field not in interaction:
                logger.error(f"Missing required field '{field}' in interaction {i}")
                return False

        # Validate field types
        if not isinstance(interaction['correct'], bool):
            logger.error(f"Field 'correct' must be boolean in interaction {i}")
            return False

        if not isinstance(interaction['response_time_ms'], (int, float)):
            logger.error(f"Field 'response_time_ms' must be number in interaction {i}")
            return False

        if interaction['response_time_ms'] < 0:
            logger.error(f"Field 'response_time_ms' cannot be negative in interaction {i}")
            return False

    logger.info(f"Micro data validation passed: {len(interactions)} interactions")
    return True

def validate_meso_data(daily_aggregates: List[Dict]) -> bool:
    """
    Validate meso-model daily aggregate data
    """
    required_fields = [
        'date', 'avg_accuracy', 'questions_attempted',
        'topics_covered', 'retention_end_of_day'
    ]

    if not isinstance(daily_aggregates, list):
        logger.error("Meso data must be a list")
        return False

    if len(daily_aggregates) < 7:
        logger.error(f"Need at least 7 days of data, got {len(daily_aggregates)}")
        return False

    for i, day in enumerate(daily_aggregates):
        for field in required_fields:
            if field not in day:
                logger.error(f"Missing required field '{field}' in day {i}")
                return False

        # Validate ranges
        if not (0 <= day['avg_accuracy'] <= 1):
            logger.error(f"avg_accuracy must be between 0-1 in day {i}")
            return False

        if day['questions_attempted'] < 0:
            logger.error(f"questions_attempted cannot be negative in day {i}")
            return False

    logger.info(f"Meso data validation passed: {len(daily_aggregates)} days")
    return True

def validate_macro_data(history: List[Dict]) -> bool:
    """
    Validate macro-model long-term history data
    """
    required_fields = [
        'date', 'topics_learned', 'avg_retention',
        'study_time_minutes', 'sessions_completed'
    ]

    if not isinstance(history, list):
        logger.error("Macro data must be a list")
        return False

    if len(history) < 30:
        logger.warning(f"Only {len(history)} days of history, transfer learning recommended")

    for i, entry in enumerate(history):
        for field in required_fields:
            if field not in entry:
                logger.error(f"Missing required field '{field}' in entry {i}")
                return False

    logger.info(f"Macro data validation passed: {len(history)} entries")
    return True

def validate_user_id(user_id: str) -> bool:
    """
    Validate user ID format
    """
    if not user_id or not isinstance(user_id, str):
        return False

    # User ID should be alphanumeric with underscores
    import re
    pattern = r'^[a-zA-Z0-9_]+$'
    return bool(re.match(pattern, user_id))

def validate_json_request(request_data: Dict, required_fields: List[str]) -> Union[Dict, bool]:
    """
    Validate JSON request has required fields
    """
    if not request_data:
        return False

    for field in required_fields:
        if field not in request_data:
            logger.error(f"Missing required field: {field}")
            return False

    return request_data
