from flask import Blueprint, request, jsonify, current_app
import logging
from datetime import datetime
import traceback

practice_bp = Blueprint('practice', __name__)
logger = logging.getLogger(__name__)


def _difficulty_level_from_value(value: float) -> str:
    score = float(max(0.0, min(1.0, value)))
    if score < 0.3:
        return 'easy'
    if score < 0.5:
        return 'medium-easy'
    if score < 0.7:
        return 'medium-hard'
    return 'hard'


def _compute_retrain_progress(total_feature_rows: int, last_trained_rows, min_samples: int, retrain_interval: int):
    if last_trained_rows is None:
        return max(0, int(min_samples) - int(total_feature_rows))
    return max(0, int(retrain_interval) - (int(total_feature_rows) - int(last_trained_rows)))


def _extract_last_training_info(metadata_history):
    last_trained_rows = None
    last_trained_at = None
    if metadata_history:
        for item in reversed(metadata_history):
            if not isinstance(item, dict):
                continue

            if last_trained_rows is None and item.get('feature_rows_at_training') is not None:
                try:
                    last_trained_rows = int(item.get('feature_rows_at_training'))
                except Exception:
                    last_trained_rows = None

            if last_trained_at is None and item.get('timestamp'):
                last_trained_at = item.get('timestamp')

            if last_trained_rows is not None and last_trained_at is not None:
                break

    return last_trained_rows, last_trained_at


def _build_and_persist_practice_retrain_status(
    data_manager,
    total_feature_rows: int,
    min_samples: int,
    retrain_interval: int,
    metadata_history=None,
    training_triggered: bool = False,
    finalize_session: bool = False,
):
    history = metadata_history if metadata_history is not None else data_manager.load_model_metadata('practice_difficulty')
    last_trained_rows, last_trained_at = _extract_last_training_info(history)

    saved_status = data_manager.load_retrain_status('practice_difficulty')
    if last_trained_rows is None and saved_status.get('last_trained_feature_rows') is not None:
        try:
            last_trained_rows = int(saved_status.get('last_trained_feature_rows'))
        except Exception:
            last_trained_rows = None

    if last_trained_at is None:
        last_trained_at = saved_status.get('last_trained_at')

    rows_to_next_training = _compute_retrain_progress(
        total_feature_rows=int(total_feature_rows),
        last_trained_rows=last_trained_rows,
        min_samples=int(min_samples),
        retrain_interval=int(retrain_interval),
    )

    status_payload = {
        'last_trained_at': last_trained_at,
        'last_trained_feature_rows': last_trained_rows,
        'total_feature_rows': int(total_feature_rows),
        'min_samples_required': int(min_samples),
        'retrain_interval': int(retrain_interval),
        'rows_to_next_training': int(rows_to_next_training),
        'entries_left_for_retraining': int(rows_to_next_training),
        'next_training_at_feature_rows': (
            int(last_trained_rows) + int(retrain_interval)
            if last_trained_rows is not None
            else int(min_samples)
        ),
        'training_ready': bool(int(total_feature_rows) >= int(min_samples) and int(rows_to_next_training) == 0),
        'training_triggered': bool(training_triggered),
        'finalize_session': bool(finalize_session),
    }
    data_manager.save_retrain_status('practice_difficulty', status_payload)
    return status_payload


@practice_bp.route('/profile/<student_id>', methods=['GET'])
def get_practice_profile(student_id):
    """Return lightweight practice profile from stored feature CSV/model metadata."""
    request_id = datetime.now().strftime('%Y%m%d%H%M%S%f')

    try:
        data_manager = current_app.prediction_service._get_data_manager(student_id)
        practice_df = data_manager.load_practice_features()

        current_difficulty = 0.5
        if not practice_df.empty and 'current_question_difficulty' in practice_df.columns:
            try:
                current_difficulty = float(practice_df['current_question_difficulty'].iloc[-1])
            except Exception:
                current_difficulty = 0.5

        metadata_history = data_manager.load_model_metadata('practice_difficulty')
        min_samples = int(current_app.config.get('MIN_PRACTICE_SAMPLES', 100))
        retrain_interval = int(current_app.config.get('PRACTICE_RETRAIN_INTERVAL', 100))
        status_payload = _build_and_persist_practice_retrain_status(
            data_manager=data_manager,
            total_feature_rows=int(len(practice_df)),
            min_samples=min_samples,
            retrain_interval=retrain_interval,
            metadata_history=metadata_history,
        )

        return jsonify({
            'success': True,
            'student_id': student_id,
            'current_difficulty': round(max(0.0, min(1.0, current_difficulty)), 2),
            'current_difficulty_level': _difficulty_level_from_value(current_difficulty),
            'feature_rows': int(len(practice_df)),
            'model_trained': len(metadata_history) > 0,
            'last_trained_feature_rows': status_payload.get('last_trained_feature_rows'),
            'last_trained_at': status_payload.get('last_trained_at'),
            'min_samples_required': min_samples,
            'retrain_interval': retrain_interval,
            'rows_to_next_training': status_payload.get('rows_to_next_training', 0),
            'entries_left_for_retraining': status_payload.get('entries_left_for_retraining', 0),
            'next_training_at_feature_rows': status_payload.get('next_training_at_feature_rows'),
            'training_ready': status_payload.get('training_ready', False),
            'timestamp': datetime.now().isoformat(),
            'request_id': request_id,
        })

    except Exception as e:
        logger.error(f"[{request_id}] Practice profile error: {e}\n{traceback.format_exc()}")
        return jsonify({
            'success': False,
            'error': str(e),
            'student_id': student_id,
            'current_difficulty': 0.5,
            'feature_rows': 0,
            'model_trained': False,
            'timestamp': datetime.now().isoformat(),
            'request_id': request_id,
        }), 500


@practice_bp.route('/reset-data', methods=['POST'])
def reset_practice_data():
    """Clear stored practice CSV/model artifacts for a fresh practice start."""
    request_id = datetime.now().strftime('%Y%m%d%H%M%S%f')

    try:
        data = request.get_json() or {}
        student_id = data.get('student_id')

        if not student_id:
            return jsonify({'success': False, 'error': 'Missing student_id', 'request_id': request_id}), 400

        data_manager = current_app.prediction_service._get_data_manager(student_id)
        current_app.training_service.cancel_practice_training(student_id)
        reset_result = data_manager.reset_practice_data()
        current_app.prediction_service.clear_student_cache(student_id)

        return jsonify({
            'success': True,
            'message': 'Practice history cleared successfully',
            'student_id': student_id,
            'cleared_files': reset_result.get('cleared_files', []),
            'timestamp': datetime.now().isoformat(),
            'request_id': request_id,
        })

    except Exception as e:
        logger.error(f"[{request_id}] Practice reset error: {e}\n{traceback.format_exc()}")
        return jsonify({'success': False, 'error': str(e), 'request_id': request_id}), 500

@practice_bp.route('/next-difficulty', methods=['POST'])
def predict_next_difficulty():
    """
    Predict next difficulty for practice mode
    """
    request_id = datetime.now().strftime('%Y%m%d%H%M%S%f')
    logger.info(f"[{request_id}] Practice difficulty prediction request received")

    try:
        data = request.get_json()
        logger.info(f"[{request_id}] Request data: {data}")

        if not data or 'student_id' not in data or 'features' not in data:
            logger.error(f"[{request_id}] Missing required fields")
            return jsonify({'success': False, 'error': 'Missing student_id or features'}), 400

        student_id = data['student_id']
        features = data['features']

        logger.info(f"[{request_id}] Student ID: {student_id}, Features length: {len(features)}")

        # Validate features
        if not isinstance(features, list):
            logger.error(f"[{request_id}] Features must be a list")
            return jsonify({'success': False, 'error': 'Features must be a list'}), 400

        # Ensure 12 features
        if len(features) != 12:
            logger.warning(f"[{request_id}] Features length is {len(features)}, expected 12")
            if len(features) < 12:
                features = features + [0.5] * (12 - len(features))
                logger.info(f"[{request_id}] Padded features to length 12")
            else:
                features = features[:12]
                logger.info(f"[{request_id}] Truncated features to length 12")

        # Convert to float and clip
        features = [float(f) for f in features]
        features = [max(0.0, min(1.0, f)) for f in features]

        logger.debug(f"[{request_id}] Processed features: {features}")

        # Get prediction
        prediction = current_app.prediction_service.predict_practice_difficulty(
            student_id, features
        )

        data_manager = current_app.prediction_service._get_data_manager(student_id)
        practice_df = data_manager.load_practice_features()
        metadata_history = data_manager.load_model_metadata('practice_difficulty')

        min_samples = int(current_app.config.get('MIN_PRACTICE_SAMPLES', 100))
        retrain_interval = int(current_app.config.get('PRACTICE_RETRAIN_INTERVAL', 100))
        feature_rows = int(len(practice_df))
        status_payload = _build_and_persist_practice_retrain_status(
            data_manager=data_manager,
            total_feature_rows=feature_rows,
            min_samples=min_samples,
            retrain_interval=retrain_interval,
            metadata_history=metadata_history,
        )

        predicted_difficulty = float(prediction['predicted_difficulty'])

        response = {
            'success': True,
            'next_difficulty': predicted_difficulty,
            'difficulty_level': _difficulty_level_from_value(predicted_difficulty),
            'smoothed_difficulty': prediction['smoothed_difficulty'],
            'confidence': prediction['confidence'],
            'method': prediction['method'],
            'model_trained': bool(len(metadata_history) > 0),
            'feature_rows': feature_rows,
            'last_trained_feature_rows': status_payload.get('last_trained_feature_rows'),
            'last_trained_at': status_payload.get('last_trained_at'),
            'min_samples_required': min_samples,
            'retrain_interval': retrain_interval,
            'rows_to_next_training': status_payload.get('rows_to_next_training', 0),
            'entries_left_for_retraining': status_payload.get('entries_left_for_retraining', 0),
            'next_training_at_feature_rows': status_payload.get('next_training_at_feature_rows'),
            'training_ready': status_payload.get('training_ready', False),
            'timestamp': datetime.now().isoformat()
        }

        logger.info(f"[{request_id}] Prediction result: {response}")
        return jsonify(response)

    except Exception as e:
        logger.error(f"[{request_id}] Practice prediction error: {e}\n{traceback.format_exc()}")
        return jsonify({
            'success': False,
            'error': str(e),
            'next_difficulty': 0.5,
            'smoothed_difficulty': 0.5,
            'confidence': 0.5,
            'method': 'error_fallback',
            'timestamp': datetime.now().isoformat()
        }), 500

@practice_bp.route('/session-end', methods=['POST'])
def end_practice_session():
    """Session end handler that stores only processed practice features + target."""
    request_id = datetime.now().strftime('%Y%m%d%H%M%S%f')
    logger.info(f"[{request_id}] Session end request received")

    try:
        data = request.get_json()
        logger.info(f"[{request_id}] Request data keys: {data.keys() if data else 'None'}")

        if not data or 'student_id' not in data or 'attempts' not in data:
            logger.error(f"[{request_id}] Missing required fields")
            return jsonify({'success': False, 'error': 'Missing data'}), 400

        student_id = data['student_id']
        attempts = data['attempts']
        session_id = data.get('session_id')
        finalize_session = bool(data.get('finalize_session', False))

        logger.info(f"[{request_id}] Student ID: {student_id}, Attempts count: {len(attempts)}, Session ID: {session_id}")

        if not isinstance(attempts, list):
            logger.error(f"[{request_id}] Attempts must be a list")
            return jsonify({'success': False, 'error': 'attempts must be a list'}), 400

        # Add session_id to each attempt
        if session_id:
            for i, attempt in enumerate(attempts):
                attempt['session_id'] = session_id
            logger.debug(f"[{request_id}] Added session_id to {len(attempts)} attempts")

        # Save processed feature rows only (no raw CSV storage)
        data_manager = current_app.prediction_service._get_data_manager(student_id)
        practice_rows_before = len(data_manager.load_practice_features())
        append_result = data_manager.append_practice_attempts_as_features(attempts)
        feature_count = append_result.get('added_rows', 0)
        total_feature_rows = append_result.get('total_rows', practice_rows_before)
        logger.info(f"[{request_id}] Added {feature_count} rows to practice_features.csv (total={total_feature_rows})")

        training_triggered = False
        global_triggered = False

        # Trigger training only on explicit session finalization.
        # During active session, rows are stored but training is deferred.
        min_samples = current_app.config.get('MIN_PRACTICE_SAMPLES', 10)
        retrain_interval = current_app.config.get('PRACTICE_RETRAIN_INTERVAL', 100)

        metadata_history = data_manager.load_model_metadata('practice_difficulty')
        last_trained_rows, _ = _extract_last_training_info(metadata_history)

        should_trigger_training = False
        if finalize_session and total_feature_rows >= min_samples:
            if last_trained_rows is None:
                should_trigger_training = True
            else:
                should_trigger_training = (total_feature_rows - last_trained_rows) >= retrain_interval

        if should_trigger_training:
            logger.info(
                f"[{request_id}] Practice features total ({total_feature_rows}) met retrain rule "
                f"(min={min_samples}, interval={retrain_interval}, last_trained_rows={last_trained_rows}), triggering training"
            )
            training_triggered = current_app.training_service.train_practice_model_async(student_id)
        elif finalize_session and total_feature_rows >= min_samples:
            logger.info(
                f"[{request_id}] Practice features total ({total_feature_rows}) >= {min_samples} but waiting for "
                f"next retrain window (+{retrain_interval} from last_trained_rows={last_trained_rows})"
            )
        elif not finalize_session:
            logger.info(
                f"[{request_id}] Session still active; deferred model training (rows={total_feature_rows}, min={min_samples})"
            )

        status_payload = _build_and_persist_practice_retrain_status(
            data_manager=data_manager,
            total_feature_rows=int(total_feature_rows),
            min_samples=int(min_samples),
            retrain_interval=int(retrain_interval),
            metadata_history=metadata_history,
            training_triggered=training_triggered,
            finalize_session=finalize_session,
        )

        # Trigger global feature pipeline at configured threshold crossing
        min_global_samples = current_app.config.get('MIN_PRACTICE_SAMPLES_FOR_GLOBAL', 40)
        if practice_rows_before < min_global_samples <= total_feature_rows:
            logger.info(f"[{request_id}] Practice features crossed global threshold ({min_global_samples}), generating global features")
            global_triggered = current_app.training_service.generate_global_features(student_id)

        response = {
            'success': True,
            'message': f'Session ended, {len(attempts)} attempts processed',
            'total_attempts': len(attempts),
            'feature_rows': feature_count,
            'total_feature_rows': total_feature_rows,
            'last_trained_feature_rows': status_payload.get('last_trained_feature_rows', last_trained_rows),
            'last_trained_at': status_payload.get('last_trained_at'),
            'retrain_interval': retrain_interval,
            'rows_to_next_training': status_payload.get('rows_to_next_training', 0),
            'entries_left_for_retraining': status_payload.get('entries_left_for_retraining', 0),
            'next_training_at_feature_rows': status_payload.get('next_training_at_feature_rows'),
            'training_ready': status_payload.get('training_ready', False),
            'finalize_session': finalize_session,
            'training_triggered': training_triggered,
            'global_features_triggered': global_triggered,
            'request_id': request_id
        }

        logger.info(f"[{request_id}] Session end response: {response}")
        return jsonify(response)

    except Exception as e:
        logger.error(f"[{request_id}] Session end error: {e}\n{traceback.format_exc()}")
        return jsonify({'success': False, 'error': str(e), 'request_id': request_id}), 500