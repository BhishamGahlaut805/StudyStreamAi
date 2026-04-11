"""
Comprehensive retention model report for a single student.

This script loads the 3 saved retention models (micro, meso, macro), rebuilds
evaluation windows from student CSV files using the same feature/target logic as
the Flask backend, computes detailed metrics, and prints an easy-to-read report.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Callable, Dict, List, Tuple

import numpy as np
import pandas as pd
import tensorflow as tf


STUDENT_ID = "STU000005"


def _clip01(value: float) -> float:
	return float(np.clip(float(value), 0.0, 1.0))


def _safe_float(row: pd.Series, key: str, default: float = 0.0) -> float:
	value = row.get(key, default)
	if pd.isna(value):
		return float(default)
	try:
		return float(value)
	except Exception:
		return float(default)


def extract_micro_features(row: pd.Series) -> List[float]:
	return [
		_safe_float(row, "answer_correctness", 0.0),
		_safe_float(row, "normalized_response_time", 1.0),
		_safe_float(row, "rolling_accuracy_topic", 0.5),
		_safe_float(row, "correct_streak", 0.0),
		_safe_float(row, "time_since_last_attempt_topic", 0.0) / 86400.0,
		_safe_float(row, "answer_change_count", 0.0) / 5.0,
		_safe_float(row, "confidence_rating", 3.0) / 5.0,
		_safe_float(row, "concept_mastery_score", 0.5),
		_safe_float(row, "question_difficulty", 3.0) / 5.0,
		_safe_float(row, "fatigue_indicator", 0.3),
		_safe_float(row, "focus_loss_frequency", 0.0) / 10.0,
		_safe_float(row, "rolling_time_variance", 0.0) / 5.0,
		_safe_float(row, "hint_usage_flag", 0.0),
		_safe_float(row, "preferred_difficulty_offset", 0.0) / 5.0,
		_safe_float(row, "attempt_count_topic", 1.0) / 20.0,
	]


def extract_meso_features(row: pd.Series) -> List[float]:
	return [
		_safe_float(row, "subject_accuracy_rate", 0.5),
		_safe_float(row, "topic_mastery_vector", 0.5),
		_safe_float(row, "forgetting_rate_subject", 0.1),
		_safe_float(row, "session_performance_trend", 0.0),
		_safe_float(row, "average_response_time", 2000.0) / 5000.0,
		_safe_float(row, "response_time_improvement_rate", 0.0),
		_safe_float(row, "difficulty_success_rate", 0.5),
		_safe_float(row, "revision_interval", 24.0) / 168.0,
		_safe_float(row, "topic_switch_frequency", 0.3),
		_safe_float(row, "incorrect_pattern_frequency", 0.2),
		_safe_float(row, "learning_velocity", 0.5),
		_safe_float(row, "engagement_score", 0.5),
		_safe_float(row, "fatigue_trend", 0.0),
		_safe_float(row, "hint_dependency_rate", 0.2),
		_safe_float(row, "retention_decay_index", 0.1),
	]


def extract_macro_features(row: pd.Series) -> List[float]:
	return [
		_safe_float(row, "overall_accuracy_rate", 0.5),
		_safe_float(row, "cross_subject_mastery_vector", 0.5),
		_safe_float(row, "daily_study_duration", 30.0) / 120.0,
		_safe_float(row, "study_consistency_index", 0.5),
		_safe_float(row, "fatigue_pattern", 0.3),
		_safe_float(row, "forgetting_curve_slope", -0.1),
		_safe_float(row, "performance_variability", 0.1),
		_safe_float(row, "session_start_time_pattern", 12.0) / 24.0,
		_safe_float(row, "topic_completion_rate", 0.3),
		_safe_float(row, "learning_efficiency_score", 0.5),
		_safe_float(row, "break_frequency", 0.1),
		_safe_float(row, "cognitive_load_index", 0.5),
		_safe_float(row, "motivation_index", 0.5),
		_safe_float(row, "stress_indicator", 0.3),
		_safe_float(row, "retention_stability_score", 0.5),
	]


def build_micro_eval(df: pd.DataFrame, seq_len: int) -> Tuple[np.ndarray, List[np.ndarray]]:
	if "topic_id" not in df.columns:
		df = df.copy()
		df["topic_id"] = "unknown_topic"

	x_all: List[List[List[float]]] = []
	y_current: List[float] = []
	y_next: List[float] = []
	y_stress: List[float] = []
	y_fatigue: List[float] = []

	topics = df["topic_id"].astype(str).unique().tolist()
	for topic_id in topics:
		topic_df = df[df["topic_id"].astype(str) == str(topic_id)].reset_index(drop=True)
		if len(topic_df) < seq_len:
			continue

		features = [extract_micro_features(row) for _, row in topic_df.iterrows()]
		for i in range(len(features) - seq_len + 1):
			idx = i + seq_len - 1
			current_ret = _clip01(_safe_float(topic_df.iloc[idx], "retention_probability_topic", 0.5))
			next_ret = _clip01(
				_safe_float(topic_df.iloc[min(idx + 1, len(topic_df) - 1)], "retention_probability_topic", current_ret)
			)
			stress_t = _clip01(_safe_float(topic_df.iloc[idx], "fatigue_indicator", 0.3))
			fatigue_t = _clip01(_safe_float(topic_df.iloc[idx], "focus_loss_frequency", 0.3))

			x_all.append(features[i : i + seq_len])
			y_current.append(current_ret)
			y_next.append(next_ret)
			y_stress.append(stress_t)
			y_fatigue.append(fatigue_t)

	if not x_all:
		features = [extract_micro_features(row) for _, row in df.reset_index(drop=True).iterrows()]
		if len(features) >= seq_len:
			for i in range(len(features) - seq_len + 1):
				idx = i + seq_len - 1
				current_ret = _clip01(_safe_float(df.iloc[idx], "retention_probability_topic", 0.5))
				next_ret = _clip01(_safe_float(df.iloc[min(idx + 1, len(df) - 1)], "retention_probability_topic", current_ret))
				stress_t = _clip01(_safe_float(df.iloc[idx], "fatigue_indicator", 0.3))
				fatigue_t = _clip01(_safe_float(df.iloc[idx], "focus_loss_frequency", 0.3))

				x_all.append(features[i : i + seq_len])
				y_current.append(current_ret)
				y_next.append(next_ret)
				y_stress.append(stress_t)
				y_fatigue.append(fatigue_t)

	x = np.array(x_all, dtype=np.float32)
	y = [
		np.array(y_current, dtype=np.float32),
		np.array(y_next, dtype=np.float32),
		np.array(y_stress, dtype=np.float32),
		np.array(y_fatigue, dtype=np.float32),
	]
	return x, y


def build_meso_eval(df: pd.DataFrame, seq_len: int) -> Tuple[np.ndarray, List[np.ndarray]]:
	df = df.copy()
	if "subject" not in df.columns:
		df["subject"] = "unknown"
	if "topic_id" not in df.columns:
		df["topic_id"] = "unknown_topic"

	x_all: List[np.ndarray] = []
	y7_all: List[float] = []
	y30_all: List[float] = []
	y90_all: List[float] = []

	grouped = df.groupby(["subject", "topic_id"], dropna=False)
	for _, group_df in grouped:
		group_df = group_df.reset_index(drop=True)
		if len(group_df) < max(3, seq_len // 3):
			continue

		features = [extract_meso_features(row) for _, row in group_df.iterrows()]
		min_w = max(1, min(seq_len, len(features)))

		for i in range(len(features) - min_w + 1):
			idx = i + min_w - 1
			r7 = _clip01(
				_safe_float(
					group_df.iloc[idx],
					"subject_retention_score",
					_safe_float(group_df.iloc[idx], "subject_accuracy_rate", 0.5),
				)
			)
			r30 = _clip01(r7 - 0.08)
			r90 = _clip01(r30 - 0.10)

			window = np.array(features[i : i + min_w], dtype=np.float32)
			if min_w < seq_len:
				pad = np.zeros((seq_len - min_w, window.shape[1]), dtype=np.float32)
				window = np.vstack([pad, window])

			x_all.append(window)
			y7_all.append(r7)
			y30_all.append(r30)
			y90_all.append(r90)

	x = np.array(x_all, dtype=np.float32)
	y = [
		np.array(y7_all, dtype=np.float32),
		np.array(y30_all, dtype=np.float32),
		np.array(y90_all, dtype=np.float32),
	]
	return x, y


def build_macro_eval(df: pd.DataFrame, seq_len: int) -> Tuple[np.ndarray, List[np.ndarray]]:
	features = [extract_macro_features(row) for _, row in df.reset_index(drop=True).iterrows()]

	x_all: List[np.ndarray] = []
	y_ret_all: List[float] = []
	y_fatigue_all: List[float] = []

	for i in range(len(features) - seq_len + 1):
		idx = i + seq_len - 1
		x_all.append(np.array(features[i : i + seq_len], dtype=np.float32))

		ret_target = _clip01(
			_safe_float(
				df.iloc[idx],
				"predicted_long_term_retention_score",
				_safe_float(df.iloc[idx], "overall_accuracy_rate", 0.5),
			)
		)
		fatigue_target = _clip01(
			_safe_float(
				df.iloc[idx],
				"fatigue_risk_probability",
				_safe_float(df.iloc[idx], "fatigue_pattern", 0.3),
			)
		)
		y_ret_all.append(ret_target)
		y_fatigue_all.append(fatigue_target)

	x = np.array(x_all, dtype=np.float32)
	y = [
		np.array(y_ret_all, dtype=np.float32),
		np.array(y_fatigue_all, dtype=np.float32),
	]
	return x, y


def calc_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
	y_true = np.asarray(y_true, dtype=np.float64).reshape(-1)
	y_pred = np.asarray(y_pred, dtype=np.float64).reshape(-1)
	mask = np.isfinite(y_true) & np.isfinite(y_pred)
	y_true = y_true[mask]
	y_pred = y_pred[mask]

	if y_true.size == 0:
		return {
			"MAE": np.nan,
			"MSE": np.nan,
			"RMSE": np.nan,
			"MAPE": np.nan,
			"R2": np.nan,
		}

	err = y_true - y_pred
	mae = float(np.mean(np.abs(err)))
	mse = float(np.mean(err ** 2))
	rmse = float(np.sqrt(mse))
	denom = np.where(np.abs(y_true) < 1e-8, 1e-8, np.abs(y_true))
	mape = float(np.mean(np.abs(err) / denom) * 100.0)

	ss_res = float(np.sum(err ** 2))
	y_mean = float(np.mean(y_true))
	ss_tot = float(np.sum((y_true - y_mean) ** 2))
	r2 = float(1.0 - ss_res / ss_tot) if ss_tot > 1e-12 else float("nan")

	return {
		"MAE": mae,
		"MSE": mse,
		"RMSE": rmse,
		"MAPE": mape,
		"R2": r2,
	}


def _f(value: float) -> str:
	if np.isnan(value):
		return "nan"
	return f"{value:.6f}"


def architecture_brief(model: tf.keras.Model) -> str:
	names = [layer.__class__.__name__.lower() for layer in model.layers]
	has_conv = any("conv1d" in n for n in names)
	has_attention = any("attention" in n for n in names)
	has_bi = any("bidirectional" in n for n in names)
	has_lstm = any("lstm" in n for n in names)

	parts = []
	if has_conv:
		parts.append("Conv1D feature extractor")
	if has_bi:
		parts.append("Bidirectional LSTM encoder")
	elif has_lstm:
		parts.append("Stacked LSTM sequence encoder")
	if has_attention:
		parts.append("Attention layer")
	parts.append("Dense multi-output regression heads")
	return " + ".join(parts)


def print_title(text: str) -> None:
	bar = "=" * len(text)
	print(f"\n{bar}\n{text}\n{bar}")


def print_subtitle(text: str) -> None:
	bar = "-" * len(text)
	print(f"\n{text}\n{bar}")


def print_feature_target_block(feature_specs: List[Tuple[str, str]], target_specs: List[Tuple[str, str]]) -> None:
	print_subtitle("1) Features and Targets")
	print("Features:")
	for idx, (name, formula) in enumerate(feature_specs, start=1):
		print(f"  {idx:02d}. {name}: {formula}")

	print("Targets:")
	for idx, (name, formula) in enumerate(target_specs, start=1):
		print(f"  {idx:02d}. {name}: {formula}")


def print_norm_calc_block(notes: List[str]) -> None:
	print_subtitle("2) Feature/Target Normalization and Backend Calculation (Flask)")
	for line in notes:
		print(f"  - {line}")


def print_metrics_block(y_true: List[np.ndarray], y_pred: List[np.ndarray], output_names: List[str]) -> None:
	print_subtitle("3) Accuracy Parameters (MAE, MSE, RMSE, MAPE, R2)")
	rows = []
	for name, t, p in zip(output_names, y_true, y_pred):
		m = calc_metrics(t, p)
		rows.append([
			name,
			_f(m["MAE"]),
			_f(m["MSE"]),
			_f(m["RMSE"]),
			_f(m["MAPE"]),
			_f(m["R2"]),
		])

	# Overall on concatenated outputs
	t_all = np.concatenate([np.asarray(x).reshape(-1) for x in y_true])
	p_all = np.concatenate([np.asarray(x).reshape(-1) for x in y_pred])
	m_all = calc_metrics(t_all, p_all)
	rows.append([
		"OVERALL",
		_f(m_all["MAE"]),
		_f(m_all["MSE"]),
		_f(m_all["RMSE"]),
		_f(m_all["MAPE"]),
		_f(m_all["R2"]),
	])

	table = pd.DataFrame(rows, columns=["Output", "MAE", "MSE", "RMSE", "MAPE(%)", "R2"])
	print(table.to_string(index=False))


def print_architecture_block(model: tf.keras.Model) -> None:
	print_subtitle("4) Model Used and Brief Architecture")
	print(f"Model name: {model.name}")
	print(f"Input shape: {model.input_shape}")
	print(f"Output shape: {model.output_shape}")
	print(f"Total parameters: {model.count_params():,}")
	print(f"Brief architecture: {architecture_brief(model)}")

	summary_lines: List[str] = []
	model.summary(print_fn=lambda line: summary_lines.append(line))
	print("Model summary:")
	for line in summary_lines:
		print(f"  {line}")


def print_data_sample_block(df: pd.DataFrame, csv_name: str) -> None:
	print_subtitle("5) 10 Rows of Student Data")
	print(f"Source file: {csv_name}")
	print(df.head(10).to_string(index=False))


def evaluate_model(
	model_label: str,
	model_path: Path,
	stats_path: Path,
	data_csv_path: Path,
	build_eval_fn: Callable[[pd.DataFrame, int], Tuple[np.ndarray, List[np.ndarray]]],
	feature_specs: List[Tuple[str, str]],
	target_specs: List[Tuple[str, str]],
	norm_calc_notes: List[str],
	output_names: List[str],
) -> None:
	print_title(f"{model_label} RETENTION MODEL REPORT")

	if not model_path.exists():
		print(f"Model not found: {model_path}")
		return

	if not data_csv_path.exists():
		print(f"Data CSV not found: {data_csv_path}")
		return

	training_stats = {}
	if stats_path.exists():
		with open(stats_path, "r", encoding="utf-8") as f:
			training_stats = json.load(f)

	if training_stats:
		print_subtitle("Saved Training Stats")
		print(json.dumps(training_stats, indent=2))

	model = tf.keras.models.load_model(model_path, compile=False)
	df = pd.read_csv(data_csv_path)

	# Infer sequence length from saved model input shape.
	model_input_shape = model.input_shape
	if isinstance(model_input_shape, list):
		seq_len = int(model_input_shape[0][1])
	else:
		seq_len = int(model_input_shape[1])

	x_eval, y_true = build_eval_fn(df, seq_len)
	if x_eval.size == 0:
		print("No evaluation windows could be built from the available CSV rows.")
		print_data_sample_block(df, data_csv_path.name)
		return

	pred = model.predict(x_eval, verbose=0)
	if not isinstance(pred, list):
		pred = [pred]

	y_pred = [np.asarray(p).reshape(-1) for p in pred]

	print_feature_target_block(feature_specs, target_specs)
	print_norm_calc_block(norm_calc_notes)
	print_metrics_block(y_true, y_pred, output_names)
	print_architecture_block(model)
	print_data_sample_block(df, data_csv_path.name)


def main() -> None:
	script_path = Path(__file__).resolve()
	ai_dir = script_path.parent.parent
	student_dir = ai_dir / "Retention_Model" / "Retention_Student_data" / STUDENT_ID
	models_dir = student_dir / "models"
	raw_data_dir = student_dir / "raw_data"

	print_title("RETENTION LEARNING - ALL 3 MODELS TEST REPORT")
	print(f"Student ID: {STUDENT_ID}")
	print(f"Student folder: {student_dir}")

	micro_features = [
		("answer_correctness", "float(row['answer_correctness'])"),
		("normalized_response_time", "float(row['normalized_response_time'])"),
		("rolling_accuracy_topic", "float(row['rolling_accuracy_topic'])"),
		("correct_streak", "float(row['correct_streak'])"),
		("time_since_last_attempt_topic", "float(row['time_since_last_attempt_topic']) / 86400"),
		("answer_change_count", "float(row['answer_change_count']) / 5"),
		("confidence_rating", "float(row['confidence_rating']) / 5"),
		("concept_mastery_score", "float(row['concept_mastery_score'])"),
		("question_difficulty", "float(row['question_difficulty']) / 5"),
		("fatigue_indicator", "float(row['fatigue_indicator'])"),
		("focus_loss_frequency", "float(row['focus_loss_frequency']) / 10"),
		("rolling_time_variance", "float(row['rolling_time_variance']) / 5"),
		("hint_usage_flag", "float(row['hint_usage_flag'])"),
		("preferred_difficulty_offset", "float(row['preferred_difficulty_offset']) / 5"),
		("attempt_count_topic", "float(row['attempt_count_topic']) / 20"),
	]
	micro_targets = [
		("current_retention", "clip01(retention_probability_topic at window end)"),
		("next_retention", "clip01(next row retention_probability_topic, same topic)"),
		("stress_impact", "clip01(fatigue_indicator at window end)"),
		("fatigue_prediction", "clip01(focus_loss_frequency at window end)"),
	]
	micro_notes = [
		"Flask route computes normalized_response_time = response_time / max(avg_topic_response_time, 1.0).",
		"rolling_accuracy_topic is rolling mean of last up to 10 topic correctness values.",
		"retention_probability_topic = clip(0.45*rolling_accuracy + 0.25*mastery + 0.15*confidence/5 + 0.15*(1/normalized_response_time)).",
		"time_since_last_attempt_topic is measured in seconds and then divided by 86400 in training features.",
		"confidence_rating and question_difficulty are kept on 1-5 scale then divided by 5 in training features.",
	]

	meso_features = [
		("subject_accuracy_rate", "float(row['subject_accuracy_rate'])"),
		("topic_mastery_vector", "float(row['topic_mastery_vector'])"),
		("forgetting_rate_subject", "float(row['forgetting_rate_subject'])"),
		("session_performance_trend", "float(row['session_performance_trend'])"),
		("average_response_time", "float(row['average_response_time']) / 5000"),
		("response_time_improvement_rate", "float(row['response_time_improvement_rate'])"),
		("difficulty_success_rate", "float(row['difficulty_success_rate'])"),
		("revision_interval", "float(row['revision_interval']) / 168"),
		("topic_switch_frequency", "float(row['topic_switch_frequency'])"),
		("incorrect_pattern_frequency", "float(row['incorrect_pattern_frequency'])"),
		("learning_velocity", "float(row['learning_velocity'])"),
		("engagement_score", "float(row['engagement_score'])"),
		("fatigue_trend", "float(row['fatigue_trend'])"),
		("hint_dependency_rate", "float(row['hint_dependency_rate'])"),
		("retention_decay_index", "float(row['retention_decay_index'])"),
	]
	meso_targets = [
		("retention_7d", "clip01(subject_retention_score) or fallback subject_accuracy_rate"),
		("retention_30d", "clip01(retention_7d - 0.08)"),
		("retention_90d", "clip01(retention_30d - 0.10)"),
	]
	meso_notes = [
		"Flask computes subject_retention_score = clip(0.55*subject_accuracy + 0.2*(1-incorrect_pattern_freq) + 0.25*(1-hint_dependency_rate)).",
		"average_response_time is in milliseconds and divided by 5000 in training features.",
		"revision_interval generated in hours and divided by 168 (1 week) in training features.",
		"Training derives 30d and 90d targets from 7d target by fixed decay offsets (-0.08, then -0.10).",
	]

	macro_features = [
		("overall_accuracy_rate", "float(row['overall_accuracy_rate'])"),
		("cross_subject_mastery_vector", "float(row['cross_subject_mastery_vector'])"),
		("daily_study_duration", "float(row['daily_study_duration']) / 120"),
		("study_consistency_index", "float(row['study_consistency_index'])"),
		("fatigue_pattern", "float(row['fatigue_pattern'])"),
		("forgetting_curve_slope", "float(row['forgetting_curve_slope'])"),
		("performance_variability", "float(row['performance_variability'])"),
		("session_start_time_pattern", "float(row['session_start_time_pattern']) / 24"),
		("topic_completion_rate", "float(row['topic_completion_rate'])"),
		("learning_efficiency_score", "float(row['learning_efficiency_score'])"),
		("break_frequency", "float(row['break_frequency'])"),
		("cognitive_load_index", "float(row['cognitive_load_index'])"),
		("motivation_index", "float(row['motivation_index'])"),
		("stress_indicator", "float(row['stress_indicator'])"),
		("retention_stability_score", "float(row['retention_stability_score'])"),
	]
	macro_targets = [
		(
			"predicted_long_term_retention_score",
			"clip01(predicted_long_term_retention_score) or fallback overall_accuracy_rate",
		),
		(
			"fatigue_risk_probability",
			"clip01(fatigue_risk_probability) or fallback fatigue_pattern",
		),
	]
	macro_notes = [
		"Flask computes predicted_long_term_retention_score = clip(0.4*overall_accuracy + 0.2*retention_stability + 0.2*topic_completion + 0.2*consistency).",
		"Flask computes fatigue_risk_probability = clip(0.5*fatigue_pattern + 0.3*stress_indicator + 0.2*break_frequency).",
		"daily_study_duration is in minutes and normalized by dividing by 120.",
		"session_start_time_pattern is hour-normalized in Flask; training additionally divides by 24.",
	]

	evaluate_model(
		model_label="MICRO",
		model_path=models_dir / "micro_lstm.keras",
		stats_path=models_dir / "micro_training_stats.json",
		data_csv_path=raw_data_dir / "micro_sequences.csv",
		build_eval_fn=build_micro_eval,
		feature_specs=micro_features,
		target_specs=micro_targets,
		norm_calc_notes=micro_notes,
		output_names=["current_retention", "next_retention", "stress_impact", "fatigue_prediction"],
	)

	evaluate_model(
		model_label="MESO",
		model_path=models_dir / "meso_lstm.keras",
		stats_path=models_dir / "meso_training_stats.json",
		data_csv_path=raw_data_dir / "meso_sequences.csv",
		build_eval_fn=build_meso_eval,
		feature_specs=meso_features,
		target_specs=meso_targets,
		norm_calc_notes=meso_notes,
		output_names=["retention_7d", "retention_30d", "retention_90d"],
	)

	evaluate_model(
		model_label="MACRO",
		model_path=models_dir / "macro_lstm.keras",
		stats_path=models_dir / "macro_training_stats.json",
		data_csv_path=raw_data_dir / "macro_sequences.csv",
		build_eval_fn=build_macro_eval,
		feature_specs=macro_features,
		target_specs=macro_targets,
		norm_calc_notes=macro_notes,
		output_names=["predicted_long_term_retention_score", "fatigue_risk_probability"],
	)


if __name__ == "__main__":
	main()
