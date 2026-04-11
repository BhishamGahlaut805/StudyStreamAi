"""
Multi-model regression evaluation for practice difficulty prediction.

This script trains and evaluates three models on practice_features.csv:
1) Linear Regression
2) XGBoost Regressor (or GradientBoosting fallback if xgboost is unavailable)
3) Random Forest Regressor

For each model, it prints detailed regression metrics:
- MAE
- MSE
- RMSE
- MAPE
- R2 Score
"""

from __future__ import annotations

import argparse
import math
from dataclasses import dataclass
from typing import Dict, Tuple

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split


FEATURES_PATH = (
	r"C:\Users\bhish\OneDrive\Desktop\StudyStreamAi\AI\Testing\training_data_5000.csv"
)


@dataclass
class Metrics:
	mae: float
	mse: float
	rmse: float
	mape: float
	r2: float


def calculate_mape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
	"""
	Calculate MAPE safely.

	MAPE = (1/n) * sum( abs((y_true - y_pred) / y_true) ) * 100

	Returns NaN if every y_true is approximately 0.
	"""
	y_true = np.asarray(y_true, dtype=np.float64)
	y_pred = np.asarray(y_pred, dtype=np.float64)

	mask = np.abs(y_true) > 1e-8
	if not np.any(mask):
		return float("nan")

	return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100.0)


def evaluate_model(y_true: np.ndarray, y_pred: np.ndarray) -> Metrics:
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


def print_detailed_metrics(model_name: str, m: Metrics) -> None:
	print_header(f"{model_name} - DETAILED METRICS REPORT")

	print("1. MAE (Mean Absolute Error)")
	print(f"   Value   : {m.mae:.6f}")
	print("   Formula : MAE = (1/n) * sum( |y_true - y_pred| )")
	print("   Notes   : Easy to understand, penalizes all errors equally")

	print("\n2. MSE (Mean Squared Error)")
	print(f"   Value   : {m.mse:.6f}")
	print("   Formula : MSE = (1/n) * sum( (y_true - y_pred)^2 )")
	print("   Notes   : Penalizes large errors more, sensitive to outliers")

	print("\n3. RMSE (Root Mean Squared Error)")
	print(f"   Value   : {m.rmse:.6f}")
	print("   Formula : RMSE = sqrt(MSE)")
	print("   Notes   : Same unit as output, commonly used")

	print("\n4. MAPE (Mean Absolute Percentage Error)")
	if np.isnan(m.mape):
		print("   Value   : N/A")
		print("   Formula : MAPE = (1/n) * sum( |(y_true - y_pred) / y_true| ) * 100")
		print("   Notes   : Undefined here because actual values are near zero")
	else:
		print(f"   Value   : {m.mape:.6f}%")
		print("   Formula : MAPE = (1/n) * sum( |(y_true - y_pred) / y_true| ) * 100")
		print("   Notes   : Gives percentage error, breaks when y_true is near zero")

	print("\n5. R2 Score (Coefficient of Determination)")
	print(f"   Value   : {m.r2:.6f}")
	print("   Meaning : How well the model explains variance")
	print("   Range   : 1 = perfect, 0 = mean baseline, < 0 = worse than baseline")


def print_comparison(results: Dict[str, Metrics]) -> None:
	print_header("MODEL COMPARISON SUMMARY")
	print(f"{'Model':<40} {'MAE':>10} {'MSE':>10} {'RMSE':>10} {'MAPE%':>10} {'R2':>10}")
	print("-" * 80)

	for model_name, m in results.items():
		mape_str = "N/A" if np.isnan(m.mape) else f"{m.mape:.4f}"
		print(
			f"{model_name:<40} {m.mae:>10.4f} {m.mse:>10.4f} "
			f"{m.rmse:>10.4f} {mape_str:>10} {m.r2:>10.4f}"
		)

	best_by_rmse = min(results.items(), key=lambda item: item[1].rmse)
	best_by_r2 = max(results.items(), key=lambda item: item[1].r2)
	print("\nBest model by RMSE:", best_by_rmse[0], f"(RMSE={best_by_rmse[1].rmse:.6f})")
	print("Best model by R2  :", best_by_r2[0], f"(R2={best_by_r2[1].r2:.6f})")


def load_dataset(path: str) -> Tuple[pd.DataFrame, pd.Series, str]:
	df = pd.read_csv(path)
	if df.empty:
		raise ValueError("Input CSV is empty.")

	target_col = "next_difficulty" if "next_difficulty" in df.columns else df.columns[-1]
	if target_col not in df.columns:
		raise ValueError("Could not determine target column.")

	X = df.drop(columns=[target_col])
	y = df[target_col]

	if X.shape[1] == 0:
		raise ValueError("No feature columns found after removing target.")

	return X, y, target_col


def build_models(random_state: int):
	models = {
		"Linear Regression": LinearRegression(),
		"Random Forest Regressor": RandomForestRegressor(
			n_estimators=400,
			random_state=random_state,
			n_jobs=-1,
			max_depth=10,
			min_samples_split=4,
			min_samples_leaf=2,
		),
	}

	try:
		from xgboost import XGBRegressor  # type: ignore

		models["XGBoost Regressor"] = XGBRegressor(
			n_estimators=500,
			learning_rate=0.05,
			max_depth=6,
			subsample=0.9,
			colsample_bytree=0.9,
			objective="reg:squarederror",
			random_state=random_state,
			n_jobs=-1,
		)
	except Exception:
		# Keep the flow stable when xgboost is not installed.
		models["XGBoost (Fallback: Gradient Boosting)"] = GradientBoostingRegressor(
			random_state=random_state,
			n_estimators=500,
			learning_rate=0.05,
			max_depth=3,
		)

	return models


def parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser(
		description="Train and evaluate Linear, XGBoost, and Random Forest models on practice features."
	)
	parser.add_argument("--data", type=str, default=FEATURES_PATH, help="Path to CSV dataset")
	parser.add_argument("--test-size", type=float, default=0.2, help="Test split ratio (default 0.2)")
	parser.add_argument("--random-state", type=int, default=42, help="Random seed")
	return parser.parse_args()


def main() -> None:
	args = parse_args()

	print_header("PRACTICE FEATURES MULTI-MODEL EVALUATION")
	print("Data file:", args.data)
	print("Models   : Linear Regression, XGBoost, Random Forest")

	X, y, target_col = load_dataset(args.data)
	print("\nDataset loaded successfully")
	print("Rows:", len(X))
	print("Features:", X.shape[1])
	print("Target column:", target_col)

	X_train, X_test, y_train, y_test = train_test_split(
		X,
		y,
		test_size=args.test_size,
		random_state=args.random_state,
	)

	print("\nTrain/Test split complete")
	print("Train samples:", len(X_train))
	print("Test samples :", len(X_test))

	models = build_models(args.random_state)
	results: Dict[str, Metrics] = {}

	for model_name, model in models.items():
		print_header(f"TRAINING {model_name}")
		model.fit(X_train, y_train)
		y_pred = model.predict(X_test)
		metrics = evaluate_model(y_test.to_numpy(), np.asarray(y_pred))
		results[model_name] = metrics
		print_detailed_metrics(model_name, metrics)

	print_comparison(results)

	print("\nDone.")


if __name__ == "__main__":
	main()
