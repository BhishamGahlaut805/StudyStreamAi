"""Internal routes blueprint - Retention Flask <-> Node bridge endpoints."""
from datetime import datetime
import json
import logging
import os

import requests
import pandas as pd
from flask import Blueprint, current_app, jsonify, request

internal_bp = Blueprint("internal", __name__)
logger = logging.getLogger(__name__)


def _prediction_service():
    return getattr(current_app, "retention_prediction_service", getattr(current_app, "prediction_service", None))


def _performance_service():
    return getattr(current_app, "retention_performance_service", getattr(current_app, "performance_service", None))


def _schedule_service():
    return getattr(current_app, "retention_schedule_service", getattr(current_app, "schedule_service", None))


def _training_service():
    return getattr(current_app, "retention_training_service", getattr(current_app, "training_service", None))


def _node_post(endpoint_key: str, payload: dict) -> bool:
    node_cfg = current_app.config.get("NODE_API", {})
    base_url = node_cfg.get("base_url", "")
    endpoint = node_cfg.get("endpoints", {}).get(endpoint_key)
    timeout = node_cfg.get("timeout", 5)

    if not base_url or not endpoint:
        logger.warning("NODE_API config missing for endpoint key %s", endpoint_key)
        return False

    try:
        response = requests.post(f"{base_url}{endpoint}", json=payload, timeout=timeout)
        return response.status_code == 200
    except Exception as exc:
        logger.error("Node sync failed for %s: %s", endpoint_key, exc)
        return False


def _generate_stress_fatigue_recommendations(stress_fatigue):
    recommendations = []

    stress_level = float(stress_fatigue.get("current_stress", 0.3))
    fatigue_level = float(stress_fatigue.get("current_fatigue", 0.3))
    stress_trend = stress_fatigue.get("stress_trend", "stable")
    fatigue_trend = stress_fatigue.get("fatigue_trend", "stable")

    if stress_level > 0.7:
        recommendations.append(
            {
                "type": "stress",
                "severity": "high",
                "message": "Stress levels are high. Consider a longer break.",
                "action": "take_break",
                "duration": 15,
            }
        )
    elif stress_level > 0.5:
        recommendations.append(
            {
                "type": "stress",
                "severity": "moderate",
                "message": "Moderate stress detected. Use short breathing exercises.",
                "action": "relaxation_exercise",
                "duration": 5,
            }
        )

    if fatigue_level > 0.7:
        recommendations.append(
            {
                "type": "fatigue",
                "severity": "high",
                "message": "High fatigue detected. End the session or take a long break.",
                "action": "end_session",
                "duration": 0,
            }
        )
    elif fatigue_level > 0.5:
        recommendations.append(
            {
                "type": "fatigue",
                "severity": "moderate",
                "message": "Fatigue is rising. Take a short break.",
                "action": "short_break",
                "duration": 10,
            }
        )

    if stress_trend == "increasing" and fatigue_trend == "increasing":
        recommendations.append(
            {
                "type": "combined",
                "severity": "warning",
                "message": "Both stress and fatigue are increasing. Schedule longer rest.",
                "action": "extended_break",
                "duration": 30,
            }
        )

    return recommendations


@internal_bp.route("/node/predictions", methods=["POST"])
def send_predictions_to_node():
    try:
        data = request.get_json() or {}
        user_id = data.get("user_id")
        subject = data.get("subject")

        predictions = _prediction_service().prepare_for_nodejs(user_id, subject)
        metrics = _performance_service().get_metrics_summary(user_id, subject)

        micro = predictions.get("predictions", {}).get("micro", [])
        schedule = _schedule_service().generate_daily_schedule(user_id, subject, micro) if micro else {}
        question_sequence = _prediction_service().get_question_sequence(user_id, subject, "immediate", 20)

        node_payload = {
            "user_id": user_id,
            "subject": subject,
            "timestamp": datetime.now().isoformat(),
            "predictions": predictions.get("predictions", {}),
            "metrics": metrics,
            "schedule": schedule,
            "question_sequence": question_sequence,
            "models_ready": predictions.get("models_ready", {}),
        }

        success = _node_post("initial_predictions", node_payload)

        return jsonify(
            {
                "success": True,
                "user_id": user_id,
                "subject": subject,
                "sent_to_node": success,
                "predictions_ready": predictions.get("models_ready", {}),
            }
        ), 200
    except Exception as exc:
        logger.error("Error sending predictions to Node.js: %s", exc)
        return jsonify({"error": str(exc)}), 500


@internal_bp.route("/node/performance-update", methods=["POST"])
def send_performance_update():
    try:
        data = request.get_json() or {}
        user_id = data.get("user_id")
        subject = data.get("subject")

        metrics = _performance_service().calculate_all_metrics(user_id, days=7, subject=subject)
        summary = _performance_service().get_metrics_summary(user_id, subject)
        predictions = _prediction_service().get_all_predictions(user_id, subject)

        payload = {
            "user_id": user_id,
            "subject": subject,
            "timestamp": datetime.now().isoformat(),
            "metrics": metrics,
            "summary": summary,
            "predictions": predictions,
        }

        success = _node_post("performance_metrics", payload)

        return jsonify(
            {
                "success": True,
                "user_id": user_id,
                "subject": subject,
                "sent_to_node": success,
                "metrics": summary,
            }
        ), 200
    except Exception as exc:
        logger.error("Error sending performance update: %s", exc)
        return jsonify({"error": str(exc)}), 500


@internal_bp.route("/node/question-sequence", methods=["POST"])
def send_question_sequence():
    try:
        data = request.get_json() or {}
        user_id = data.get("user_id")
        subject = data.get("subject")
        batch_type = data.get("batch_type", "immediate")
        count = int(data.get("count", 20))

        question_sequence = _prediction_service().get_question_sequence(user_id, subject, batch_type, count)

        predictions = _prediction_service().get_all_predictions(user_id, subject)
        schedule = _schedule_service().generate_daily_schedule(user_id, subject, predictions)

        payload = {
            "user_id": user_id,
            "subject": subject,
            "batch_type": batch_type,
            "timestamp": datetime.now().isoformat(),
            "question_sequence": question_sequence,
            "schedule_context": {
                "immediate_batch": schedule.get("immediate_batch", {}),
                "session_batch": schedule.get("session_batch", {}),
            },
        }

        success = _node_post("question_sequence", payload)

        return jsonify(
            {
                "success": True,
                "user_id": user_id,
                "subject": subject,
                "sent_to_node": success,
                "question_sequence": question_sequence[:10],
            }
        ), 200
    except Exception as exc:
        logger.error("Error sending question sequence: %s", exc)
        return jsonify({"error": str(exc)}), 500


@internal_bp.route("/node/stress-fatigue-update", methods=["POST"])
def send_stress_fatigue_update():
    try:
        data = request.get_json() or {}
        user_id = data.get("user_id")
        subject = data.get("subject")

        stress_fatigue = _prediction_service().get_stress_fatigue_predictions(user_id, subject)
        optimal_times = _schedule_service().get_optimal_study_times(user_id, subject, stress_fatigue)

        payload = {
            "user_id": user_id,
            "subject": subject,
            "timestamp": datetime.now().isoformat(),
            "stress_fatigue": stress_fatigue,
            "optimal_study_times": optimal_times,
            "recommendations": _generate_stress_fatigue_recommendations(stress_fatigue),
        }

        success = _node_post("stress_fatigue_update", payload)

        return jsonify(
            {
                "success": True,
                "user_id": user_id,
                "subject": subject,
                "sent_to_node": success,
                "stress_fatigue": stress_fatigue,
            }
        ), 200
    except Exception as exc:
        logger.error("Error sending stress/fatigue update: %s", exc)
        return jsonify({"error": str(exc)}), 500


@internal_bp.route("/status/<user_id>", methods=["GET"])
def get_system_status(user_id):
    try:
        student_dir = os.path.join(current_app.config["STUDENT_DATA_DIR"], user_id)

        status = {
            "user_id": user_id,
            "initialized": os.path.exists(student_dir),
            "files": {},
            "models": {},
            "data_stats": {},
        }

        if not status["initialized"]:
            return jsonify({"success": True, "status": status}), 200

        raw_dir = os.path.join(student_dir, "raw_data")
        if os.path.exists(raw_dir):
            for filename in os.listdir(raw_dir):
                filepath = os.path.join(raw_dir, filename)
                if filename.endswith(".csv"):
                    try:
                        df = pd.read_csv(filepath)
                        row_count = len(df)
                    except Exception:
                        row_count = 0
                    status["files"][filename] = {
                        "exists": True,
                        "rows": row_count,
                        "modified": datetime.fromtimestamp(os.path.getmtime(filepath)).isoformat(),
                    }

        models_dir = os.path.join(student_dir, "models")
        if os.path.exists(models_dir):
            for model_name in ["micro", "meso", "macro"]:
                model_file = os.path.join(models_dir, f"{model_name}_lstm.h5")
                status["models"][model_name] = {
                    "trained": os.path.exists(model_file),
                    "last_modified": datetime.fromtimestamp(os.path.getmtime(model_file)).isoformat()
                    if os.path.exists(model_file)
                    else None,
                }

        pred_dir = os.path.join(student_dir, "predictions")
        if os.path.exists(pred_dir):
            for pred_file in os.listdir(pred_dir):
                if pred_file.endswith(".json"):
                    filepath = os.path.join(pred_dir, pred_file)
                    data = []
                    try:
                        with open(filepath, "r", encoding="utf-8") as f:
                            data = json.load(f)
                    except Exception:
                        pass
                    status["data_stats"][pred_file.replace(".json", "")] = {
                        "exists": True,
                        "count": len(data) if isinstance(data, list) else "object",
                        "modified": datetime.fromtimestamp(os.path.getmtime(filepath)).isoformat(),
                    }

        status["training_needed"] = _training_service().check_retrain_needed(user_id)

        return jsonify({"success": True, "status": status}), 200
    except Exception as exc:
        logger.error("Error getting system status: %s", exc)
        return jsonify({"error": str(exc)}), 500


@internal_bp.route("/train/<user_id>", methods=["POST"])
def trigger_training(user_id):
    try:
        data = request.get_json() or {}
        model_type = data.get("model_type", "all")

        results = {}
        if model_type in ["micro", "all"]:
            results["micro"] = _training_service().train_micro_model(user_id)
        if model_type in ["meso", "all"]:
            results["meso"] = _training_service().train_meso_model(user_id)
        if model_type in ["macro", "all"]:
            results["macro"] = _training_service().train_macro_model(user_id)

        if results:
            _prediction_service().prepare_for_nodejs(user_id, data.get("subject"))

        return jsonify(
            {
                "success": True,
                "user_id": user_id,
                "trained_models": results,
                "timestamp": datetime.now().isoformat(),
            }
        ), 200
    except Exception as exc:
        logger.error("Error triggering training: %s", exc)
        return jsonify({"error": str(exc)}), 500

@internal_bp.route('/debug/training-status/<user_id>', methods=['GET'])
def debug_training_status(user_id):
    """Debug endpoint to check training status and data availability."""
    try:
        # Check all data files
        student_dir = os.path.join(current_app.config["STUDENT_DATA_DIR"], user_id)
        raw_dir = os.path.join(student_dir, "raw_data")

        status = {
            "user_id": user_id,
            "data_files": {},
            "sequence_files": {},
            "training_needed": None,
            "predictions": {}
        }

        # Check raw data files
        if os.path.exists(raw_dir):
            for filename in os.listdir(raw_dir):
                if filename.endswith(".csv"):
                    filepath = os.path.join(raw_dir, filename)
                    try:
                        df = pd.read_csv(filepath)
                        status["data_files"][filename] = {
                            "rows": len(df),
                            "columns": list(df.columns),
                            "modified": datetime.fromtimestamp(os.path.getmtime(filepath)).isoformat()
                        }
                    except Exception as e:
                        status["data_files"][filename] = {"error": str(e)}

        # Check sequence files
        for seq_type in ["micro_sequences", "meso_sequences", "macro_sequences"]:
            seq_file = os.path.join(raw_dir, f"{seq_type}.csv")
            if os.path.exists(seq_file):
                try:
                    df = pd.read_csv(seq_file)
                    status["sequence_files"][seq_type] = {
                        "rows": len(df),
                        "columns": list(df.columns)
                    }

                    # Calculate available windows for micro
                    if seq_type == "micro_sequences" and len(df) >= 20:
                        cfg = current_app.config.get("MODEL_CONFIG", {})
                        seq_len = cfg.get("micro", {}).get("sequence_length", 20)
                        windows = max(0, len(df) - seq_len + 1)
                        status["sequence_files"][seq_type]["available_windows"] = windows
                except Exception as e:
                    status["sequence_files"][seq_type] = {"error": str(e)}

        # Get training needed status
        status["training_needed"] = _training_service().check_retrain_needed(user_id)

        # Check if predictions exist
        pred_dir = os.path.join(student_dir, "predictions")
        if os.path.exists(pred_dir):
            for pred_file in ["micro_predictions.json", "meso_predictions.json", "macro_predictions.json"]:
                filepath = os.path.join(pred_dir, pred_file)
                if os.path.exists(filepath):
                    try:
                        with open(filepath, 'r') as f:
                            data = json.load(f)
                        if isinstance(data, list):
                            status["predictions"][pred_file] = f"List with {len(data)} items"
                        else:
                            status["predictions"][pred_file] = f"Dict with {len(data.keys())} keys"
                    except Exception as e:
                        status["predictions"][pred_file] = f"Error: {str(e)}"
                else:
                    status["predictions"][pred_file] = "Not found"

        return jsonify({"success": True, "status": status}), 200
    except Exception as e:
        logger.error(f"Debug error: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@internal_bp.route('/train-all/<user_id>', methods=['POST'])
def train_all_models_manual(user_id):
        """Manually trigger training for all models."""
        try:
            data = request.get_json() or {}
            force = data.get('force', False)

            # Check if training is needed or forced
            if not force:
                training_needed = _training_service().check_retrain_needed(user_id)
                if not training_needed.get('needed'):
                    return jsonify({
                        "success": False,
                        "message": "Training not needed based on current data",
                        "training_needed": training_needed
                    }), 200

            # Trigger training
            logger.info(f"Manual training triggered for user {user_id}, force={force}")
            results = _training_service().train_all_models(user_id)

            # Prepare predictions for frontend
            predictions = _prediction_service().prepare_for_nodejs(user_id, data.get('subject'))

            return jsonify({
                "success": True,
                "user_id": user_id,
                "training_results": results,
                "predictions": predictions,
                "timestamp": datetime.now().isoformat()
            }), 200
        except Exception as e:
            logger.error(f"Error in manual training: {e}", exc_info=True)
            return jsonify({"error": str(e)}), 500
