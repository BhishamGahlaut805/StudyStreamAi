"""
Retention Models Evaluation Script

Evaluates trained retention models for user STU000005:
- micro_lstm.keras
- meso_lstm.keras
- macro_lstm.keras

Prints detailed accuracy metrics similar to test.py:
- MAE
- MSE
- RMSE
- MAPE
- R2 Score
"""

import os
import json
import math
from dataclasses import dataclass
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


# ============================================================================
# PATHS
# ============================================================================
BASE_DIR = r"C:\Users\bhish\OneDrive\Desktop\StudyStreamAi\AI\Retention_Model\Retention_Student_data\STU000005"
MODELS_DIR = os.path.join(BASE_DIR, "models")
RAW_DATA_DIR = os.path.join(BASE_DIR, "raw_data")

MICRO_MODEL_PATH = os.path.join(MODELS_DIR, "micro_lstm.keras")
MESO_MODEL_PATH = os.path.join(MODELS_DIR, "meso_lstm.keras")
MACRO_MODEL_PATH = os.path.join(MODELS_DIR, "macro_lstm.keras")

MICRO_STATS_PATH = os.path.join(MODELS_DIR, "micro_training_stats.json")
MESO_STATS_PATH = os.path.join(MODELS_DIR, "meso_training_stats.json")
MACRO_STATS_PATH = os.path.join(MODELS_DIR, "macro_training_stats.json")

MICRO_SEQ_PATH = os.path.join(RAW_DATA_DIR, "micro_sequences.csv")
MESO_SEQ_PATH = os.path.join(RAW_DATA_DIR, "meso_sequences.csv")
MACRO_SEQ_PATH = os.path.join(RAW_DATA_DIR, "macro_sequences.csv")


# Sequence lengths are used in retention training service.
MICRO_SEQ_LEN = 20
MESO_SEQ_LEN = 30
MACRO_SEQ_LEN = 14


@dataclass
class Metrics:
	mae: float
	mse: float
	rmse: float
	mape: float
	r2: float


def calculate_mape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
	y_true = np.asarray(y_true, dtype=np.float64)
	y_pred = np.asarray(y_pred, dtype=np.float64)
	mask = np.abs(y_true) > 1e-8
	if not np.any(mask):
		return float("nan")
	return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100.0)


def evaluate_regression(y_true: np.ndarray, y_pred: np.ndarray) -> Metrics:
	y_true = np.asarray(y_true, dtype=np.float64).reshape(-1)
	y_pred = np.asarray(y_pred, dtype=np.float64).reshape(-1)
	mse = float(mean_squared_error(y_true, y_pred))
	return Metrics(
		mae=float(mean_absolute_error(y_true, y_pred)),
		mse=mse,
		rmse=float(math.sqrt(mse)),
		mape=calculate_mape(y_true, y_pred),
		r2=float(r2_score(y_true, y_pred)),
	)


def print_header(title: str) -> None:
	print("\n" + "=" * 80)
	print(title)
	print("=" * 80)


def print_metrics_summary(label: str, m: Metrics) -> None:
	print("\n" + "-" * 80)
	print(f"DETAILED METRICS REPORT - {label}")
	print("-" * 80)

	print("\n1. MAE (Mean Absolute Error):")
	print(f"  Value: {m.mae:.6f}")
	print("  Formula: MAE = (1/n) * sum(|y_true - y_pred|)")

	print("\n2. MSE (Mean Squared Error):")
	print(f"  Value: {m.mse:.6f}")
	print("  Formula: MSE = (1/n) * sum((y_true - y_pred)^2)")

	print("\n3. RMSE (Root Mean Squared Error):")
	print(f"  Value: {m.rmse:.6f}")
	print("  Formula: RMSE = sqrt(MSE)")

	print("\n4. MAPE (Mean Absolute Percentage Error):")
	if np.isnan(m.mape):
		print("  Value: N/A (actual values are near zero)")
	else:
		print(f"  Value: {m.mape:.6f}%")
	print("  Formula: MAPE = (1/n) * sum(|(y_true - y_pred) / y_true|) * 100")

	print("\n5. R2 Score (Coefficient of Determination):")
	print(f"  Value: {m.r2:.6f}")
	print("  Formula: R2 = 1 - (SS_res / SS_tot)")


def print_quick_table(model_name: str, metrics_by_output: Dict[str, Metrics]) -> None:
	print("\n" + "-" * 80)
	print(f"QUICK SUMMARY - {model_name}")
	print("-" * 80)
	print(f"{'Output':<28} {'MAE':>10} {'MSE':>10} {'RMSE':>10} {'MAPE%':>10} {'R2':>10}")
	print("-" * 80)

	for output_name, m in metrics_by_output.items():
		mape_str = "N/A" if np.isnan(m.mape) else f"{m.mape:.4f}"
		print(
			f"{output_name:<28} {m.mae:>10.4f} {m.mse:>10.4f} "
			f"{m.rmse:>10.4f} {mape_str:>10} {m.r2:>10.4f}"
		)


def load_json_if_exists(path: str) -> Dict:
	if not os.path.exists(path):
		return {}
	try:
		with open(path, "r", encoding="utf-8") as f:
			return json.load(f)
	except Exception:
		return {}


def extract_micro_features(row: pd.Series) -> List[float]:
	return [
		float(row.get("answer_correctness", 0.0)),
		float(row.get("normalized_response_time", 1.0)),
		float(row.get("rolling_accuracy_topic", 0.5)),
		float(row.get("correct_streak", 0.0)),
		float(row.get("time_since_last_attempt_topic", 0.0)) / 86400.0,
		float(row.get("answer_change_count", 0.0)) / 5.0,
		float(row.get("confidence_rating", 3.0)) / 5.0,
		float(row.get("concept_mastery_score", 0.5)),
		float(row.get("question_difficulty", 3.0)) / 5.0,
		float(row.get("fatigue_indicator", 0.3)),
		float(row.get("focus_loss_frequency", 0.0)) / 10.0,
		float(row.get("rolling_time_variance", 0.0)) / 5.0,
		float(row.get("hint_usage_flag", 0.0)),
		float(row.get("preferred_difficulty_offset", 0.0)) / 5.0,
		float(row.get("attempt_count_topic", 1.0)) / 20.0,
	]


def extract_meso_features(row: pd.Series) -> List[float]:
	return [
		float(row.get("subject_accuracy_rate", 0.5)),
		float(row.get("topic_mastery_vector", 0.5)),
		float(row.get("forgetting_rate_subject", 0.1)),
		float(row.get("session_performance_trend", 0.0)),
		float(row.get("average_response_time", 2000.0)) / 5000.0,
		float(row.get("response_time_improvement_rate", 0.0)),
		float(row.get("difficulty_success_rate", 0.5)),
		float(row.get("revision_interval", 24.0)) / 168.0,
		float(row.get("topic_switch_frequency", 0.3)),
		float(row.get("incorrect_pattern_frequency", 0.2)),
		float(row.get("learning_velocity", 0.5)),
		float(row.get("engagement_score", 0.5)),
		float(row.get("fatigue_trend", 0.0)),
		float(row.get("hint_dependency_rate", 0.2)),
		float(row.get("retention_decay_index", 0.1)),
	]


def extract_macro_features(row: pd.Series) -> List[float]:
	return [
		float(row.get("overall_accuracy_rate", 0.5)),
		float(row.get("cross_subject_mastery_vector", 0.5)),
		float(row.get("daily_study_duration", 30.0)) / 120.0,
		float(row.get("study_consistency_index", 0.5)),
		float(row.get("fatigue_pattern", 0.3)),
		float(row.get("forgetting_curve_slope", -0.1)),
		float(row.get("performance_variability", 0.1)),
		float(row.get("session_start_time_pattern", 12.0)) / 24.0,
		float(row.get("topic_completion_rate", 0.3)),
		float(row.get("learning_efficiency_score", 0.5)),
		float(row.get("break_frequency", 0.1)),
		float(row.get("cognitive_load_index", 0.5)),
		float(row.get("motivation_index", 0.5)),
		float(row.get("stress_indicator", 0.3)),
		float(row.get("retention_stability_score", 0.5)),
	]


def build_micro_eval_data(df: pd.DataFrame, seq_len: int) -> Tuple[np.ndarray, Dict[str, np.ndarray]]:
	if "topic_id" not in df.columns:
		df["topic_id"] = "unknown_topic"

	X_all = []
	y_current = []
	y_next = []
	y_stress = []
	y_fatigue = []

	topics = df["topic_id"].astype(str).unique().tolist()
	for topic_id in topics:
		topic_df = df[df["topic_id"].astype(str) == str(topic_id)].copy().reset_index(drop=True)
		if len(topic_df) < seq_len:
			continue

		features = [extract_micro_features(row) for _, row in topic_df.iterrows()]
		for i in range(len(features) - seq_len + 1):
			idx = i + seq_len - 1
			X_all.append(np.array(features[i : i + seq_len], dtype=np.float32))

			cur = float(topic_df.iloc[idx].get("retention_probability_topic", 0.5))
			nxt = float(topic_df.iloc[min(idx + 1, len(topic_df) - 1)].get("retention_probability_topic", cur))
			stress = float(topic_df.iloc[idx].get("fatigue_indicator", 0.3))
			fatigue = float(topic_df.iloc[idx].get("focus_loss_frequency", 0.3))

			y_current.append(np.clip(cur, 0.0, 1.0))
			y_next.append(np.clip(nxt, 0.0, 1.0))
			y_stress.append(np.clip(stress, 0.0, 1.0))
			y_fatigue.append(np.clip(fatigue, 0.0, 1.0))

	if not X_all:
		raise ValueError("No micro sequence windows could be created for evaluation.")

	return np.array(X_all, dtype=np.float32), {
		"current_retention": np.array(y_current, dtype=np.float32),
		"next_retention": np.array(y_next, dtype=np.float32),
		"stress_impact": np.array(y_stress, dtype=np.float32),
		"fatigue_prediction": np.array(y_fatigue, dtype=np.float32),
	}


def build_meso_eval_data(df: pd.DataFrame, seq_len: int) -> Tuple[np.ndarray, Dict[str, np.ndarray]]:
	if "subject" not in df.columns:
		df["subject"] = "unknown"
	if "topic_id" not in df.columns:
		df["topic_id"] = "unknown_topic"

	X_all = []
	y7 = []
	y30 = []
	y90 = []

	grouped = df.groupby(["subject", "topic_id"], dropna=False)
	for (_, _), group_df in grouped:
		group_df = group_df.reset_index(drop=True)
		if len(group_df) < max(3, seq_len // 3):
			continue

		features = [extract_meso_features(row) for _, row in group_df.iterrows()]
		min_w = max(1, min(seq_len, len(features)))

		for i in range(len(features) - min_w + 1):
			idx = i + min_w - 1
			window = features[i : i + min_w]
			if min_w < seq_len:
				pad = np.zeros((seq_len - min_w, len(window[0])), dtype=np.float32)
				win_arr = np.vstack([pad, np.array(window, dtype=np.float32)])
			else:
				win_arr = np.array(window, dtype=np.float32)

			r7 = float(group_df.iloc[idx].get("subject_retention_score", group_df.iloc[idx].get("subject_accuracy_rate", 0.5)))
			r7 = float(np.clip(r7, 0.0, 1.0))
			r30 = float(np.clip(r7 - 0.08, 0.0, 1.0))
			r90 = float(np.clip(r30 - 0.1, 0.0, 1.0))

			X_all.append(win_arr)
			y7.append(r7)
			y30.append(r30)
			y90.append(r90)

	if not X_all:
		raise ValueError("No meso sequence windows could be created for evaluation.")

	return np.array(X_all, dtype=np.float32), {
		"retention_7d": np.array(y7, dtype=np.float32),
		"retention_30d": np.array(y30, dtype=np.float32),
		"retention_90d": np.array(y90, dtype=np.float32),
	}


def build_macro_eval_data(df: pd.DataFrame, seq_len: int) -> Tuple[np.ndarray, Dict[str, np.ndarray]]:
	features = [extract_macro_features(row) for _, row in df.iterrows()]

	X_all = []
	y_ret = []
	y_fatigue = []

	for i in range(len(features) - seq_len + 1):
		idx = i + seq_len - 1
		X_all.append(np.array(features[i : i + seq_len], dtype=np.float32))

		ret_target = float(
			df.iloc[idx].get(
				"predicted_long_term_retention_score",
				df.iloc[idx].get("overall_accuracy_rate", 0.5),
			)
		)
		fatigue_target = float(
			df.iloc[idx].get(
				"fatigue_risk_probability",
				df.iloc[idx].get("fatigue_pattern", 0.3),
			)
		)

		y_ret.append(np.clip(ret_target, 0.0, 1.0))
		y_fatigue.append(np.clip(fatigue_target, 0.0, 1.0))

	if not X_all:
		raise ValueError("No macro sequence windows could be created for evaluation.")

	return np.array(X_all, dtype=np.float32), {
		"predicted_long_term_retention_score": np.array(y_ret, dtype=np.float32),
		"fatigue_risk_probability": np.array(y_fatigue, dtype=np.float32),
	}


def evaluate_model(
	model_name: str,
	model_path: str,
	X: np.ndarray,
	y_targets: Dict[str, np.ndarray],
	stats_path: str,
) -> None:
	print_header(f"{model_name.upper()} MODEL - EVALUATION METRICS")

	if not os.path.exists(model_path):
		print(f"Model not found: {model_path}")
		return

	model = tf.keras.models.load_model(model_path, compile=False)
	raw_preds = model.predict(X, verbose=0)

	if not isinstance(raw_preds, list):
		raw_preds = [raw_preds]

	target_names = list(y_targets.keys())
	if len(raw_preds) != len(target_names):
		print("Prediction output mismatch.")
		print(f"Expected outputs: {len(target_names)}")
		print(f"Model outputs   : {len(raw_preds)}")
		return

	metrics_by_output: Dict[str, Metrics] = {}

	for idx, target_name in enumerate(target_names):
		y_true = y_targets[target_name]
		y_pred = np.asarray(raw_preds[idx]).reshape(-1)
		metrics = evaluate_regression(y_true, y_pred)
		metrics_by_output[target_name] = metrics
		print_metrics_summary(target_name, metrics)

	print_quick_table(model_name, metrics_by_output)

	stats = load_json_if_exists(stats_path)
	if stats:
		print("\n" + "-" * 80)
		print("TRAINING STATS")
		print("-" * 80)
		print(f"Trained at : {stats.get('trained_at', 'N/A')}")
		print(f"Epochs     : {stats.get('epochs', 'N/A')}")
		print(f"Batch size : {stats.get('batch_size', 'N/A')}")
		print(f"Windows    : {stats.get('windows', 'N/A')}")
		loss_hist = stats.get("loss_history", [])
		if loss_hist:
			print(f"Final loss : {float(loss_hist[-1]):.6f}")


def main() -> None:
	print_header("RETENTION MODELS PERFORMANCE TEST - STU000005")

	print("\n[1/6] Loading sequence CSV files...")
	micro_df = pd.read_csv(MICRO_SEQ_PATH)
	meso_df = pd.read_csv(MESO_SEQ_PATH)
	macro_df = pd.read_csv(MACRO_SEQ_PATH)
	print(f"Micro rows: {len(micro_df)}")
	print(f"Meso rows : {len(meso_df)}")
	print(f"Macro rows: {len(macro_df)}")

	print("\n[2/6] Building micro evaluation windows...")
	X_micro, y_micro = build_micro_eval_data(micro_df, MICRO_SEQ_LEN)
	print(f"Micro eval windows: {len(X_micro)}")

	print("\n[3/6] Building meso evaluation windows...")
	X_meso, y_meso = build_meso_eval_data(meso_df, MESO_SEQ_LEN)
	print(f"Meso eval windows : {len(X_meso)}")

	print("\n[4/6] Building macro evaluation windows...")
	X_macro, y_macro = build_macro_eval_data(macro_df, MACRO_SEQ_LEN)
	print(f"Macro eval windows: {len(X_macro)}")

	print("\n[5/6] Evaluating micro/meso/macro models...")
	evaluate_model("micro", MICRO_MODEL_PATH, X_micro, y_micro, MICRO_STATS_PATH)
	evaluate_model("meso", MESO_MODEL_PATH, X_meso, y_meso, MESO_STATS_PATH)
	evaluate_model("macro", MACRO_MODEL_PATH, X_macro, y_macro, MACRO_STATS_PATH)

	print("\n[6/6] Evaluation complete.")
	print("=" * 80)


if __name__ == "__main__":
	main()
