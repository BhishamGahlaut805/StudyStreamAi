"""
Practice Difficulty Random Forest Evaluation Script

Evaluates the trained Random Forest model in:
C:/Users/bhish/OneDrive/Desktop/StudyStreamAi/AI/data/students/STU000005/models/practice_difficulty

Prints 5 regression accuracy parameters:
1) MAE
2) MSE
3) RMSE
4) MAPE
5) R2 Score
"""

import json
import math
import os
import pickle
from typing import Tuple

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

# ============================================================================
# PATHS
# ============================================================================
MODEL_DIR = (
    r"C:\Users\bhish\OneDrive\Desktop\StudyStreamAi\AI\data\students\STU000005\models\practice_difficulty"
)

MODEL_PATH = os.path.join(MODEL_DIR, "practice_difficulty_model.pkl")
SCALER_X_PATH = os.path.join(MODEL_DIR, "practice_difficulty_scaler_X.pkl")
SCALER_Y_PATH = os.path.join(MODEL_DIR, "practice_difficulty_scaler_y.pkl")
METADATA_PATH = os.path.join(MODEL_DIR, "practice_difficulty_metadata.json")

FEATURES_PATH = (
    r"C:\Users\bhish\OneDrive\Desktop\StudyStreamAi\AI\data\students\STU000005\features\practice_features.csv"
)

TARGET_COL = "next_difficulty"


# ============================================================================
# UTILITIES
# ============================================================================
def load_metadata() -> dict:
    if not os.path.exists(METADATA_PATH):
        return {}

    with open(METADATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Expected metadata in current RF implementation is a dict.
    if isinstance(data, dict):
        return data

    # If older format list appears, use latest entry.
    if isinstance(data, list) and data:
        return data[-1]

    return {}


def load_features() -> pd.DataFrame:
    if not os.path.exists(FEATURES_PATH):
        raise FileNotFoundError(f"Features CSV not found: {FEATURES_PATH}")

    df = pd.read_csv(FEATURES_PATH)
    if TARGET_COL not in df.columns:
        raise ValueError(f"Required target column '{TARGET_COL}' not found in features CSV")

    return df


def prepare_sequences(data: pd.DataFrame, sequence_length: int, n_features: int) -> Tuple[np.ndarray, np.ndarray]:
    """
    Build sequence windows and labels exactly as training pipeline expects.

    Returns:
        X_seq: shape (samples, sequence_length, n_features)
        y: shape (samples,)
    """
    # Use all non-target columns and then trim/pad to n_features
    feature_cols = [c for c in data.columns if c != TARGET_COL]

    feature_values = data[feature_cols].apply(pd.to_numeric, errors="coerce").fillna(0.5).values.astype(np.float32)
    target_values = pd.to_numeric(data[TARGET_COL], errors="coerce").fillna(0.5).values.astype(np.float32)

    if feature_values.shape[1] < n_features:
        pad = np.full((feature_values.shape[0], n_features - feature_values.shape[1]), 0.5, dtype=np.float32)
        feature_values = np.hstack([feature_values, pad])
    elif feature_values.shape[1] > n_features:
        feature_values = feature_values[:, :n_features]

    X_seq = []
    y = []

    for i in range(len(feature_values) - sequence_length):
        X_seq.append(feature_values[i : i + sequence_length])
        y.append(target_values[i + sequence_length])

    if not X_seq:
        return np.empty((0, sequence_length, n_features), dtype=np.float32), np.empty((0,), dtype=np.float32)

    return np.array(X_seq, dtype=np.float32), np.array(y, dtype=np.float32)


def flatten_sequences(X_seq: np.ndarray) -> np.ndarray:
    if len(X_seq.shape) != 3:
        raise ValueError(f"Expected 3D sequences, got shape {X_seq.shape}")
    return X_seq.reshape(X_seq.shape[0], -1)


def calculate_mape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    y_true = np.asarray(y_true)
    y_pred = np.asarray(y_pred)

    mask = np.abs(y_true) > 1e-8
    if not np.any(mask):
        return float("nan")

    return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100.0)


def print_header() -> None:
    print("\n" + "=" * 80)
    print("PRACTICE DIFFICULTY RANDOM FOREST - EVALUATION METRICS")
    print("=" * 80)


def print_metrics(mae: float, mse: float, rmse: float, mape: float, r2: float) -> None:
    print("\n" + "-" * 80)
    print("DETAILED METRICS REPORT")
    print("-" * 80)

    print("\n1. MAE (Mean Absolute Error)")
    print(f"  Value   : {mae:.6f}")
    print("  Formula : MAE = (1/n) * sum(|y_true - y_pred|)")

    print("\n2. MSE (Mean Squared Error)")
    print(f"  Value   : {mse:.6f}")
    print("  Formula : MSE = (1/n) * sum((y_true - y_pred)^2)")

    print("\n3. RMSE (Root Mean Squared Error)")
    print(f"  Value   : {rmse:.6f}")
    print("  Formula : RMSE = sqrt(MSE)")

    print("\n4. MAPE (Mean Absolute Percentage Error)")
    if np.isnan(mape):
        print("  Value   : N/A (actual values too close to 0)")
    else:
        print(f"  Value   : {mape:.6f}%")
    print("  Formula : MAPE = (1/n) * sum(|(y_true - y_pred)/y_true|) * 100")

    print("\n5. R2 Score (Coefficient of Determination)")
    print(f"  Value   : {r2:.6f}")
    print("  Formula : R2 = 1 - (SS_res / SS_tot)")


def print_summary_table(mae: float, mse: float, rmse: float, mape: float, r2: float, metadata: dict, n_samples: int) -> None:
    print("\n" + "-" * 80)
    print("QUICK SUMMARY")
    print("-" * 80)

    print(f"\n{'Metric':<30} {'Value':<20} {'Interpretation':<30}")
    print("-" * 80)
    print(f"{'MAE':<30} {mae:<20.6f} {'Average error magnitude':<30}")
    print(f"{'MSE':<30} {mse:<20.6f} {'Squared errors':<30}")
    print(f"{'RMSE':<30} {rmse:<20.6f} {'Root squared errors':<30}")

    if not np.isnan(mape):
        print(f"{'MAPE':<30} {mape:<20.2f}% {'Percentage error':<30}")
    else:
        print(f"{'MAPE':<30} {'N/A':<20} {'N/A (near-zero targets)':<30}")

    r2_interpretation = "Excellent" if r2 > 0.8 else "Good" if r2 > 0.6 else "Fair" if r2 > 0.4 else "Poor"
    print(f"{'R2 Score':<30} {r2:<20.6f} {r2_interpretation:<30}")

    print("\n" + "-" * 80)
    print("MODEL INFORMATION")
    print("-" * 80)
    print(f"Model Path: {MODEL_PATH}")
    print(f"Sequence Length: {metadata.get('sequence_length', 'N/A')}")
    print(f"Number of Features: {metadata.get('n_features', 'N/A')}")
    print(f"Model Type: {metadata.get('model_type', 'practice_difficulty')}")
    print(f"Backend: {metadata.get('model_backend', 'random_forest_regressor')}")
    print(f"Evaluated Samples: {n_samples}")
    print(f"Last Saved: {metadata.get('last_saved', 'N/A')}")


def get_base_feature_names(df: pd.DataFrame, metadata: dict, n_features: int) -> list:
    """Resolve base input feature names in model order (excluding target)."""
    names = metadata.get("feature_names")
    if isinstance(names, list) and names:
        cleaned = [str(x) for x in names][:n_features]
        if len(cleaned) < n_features:
            cleaned.extend([f"feature_{i + 1}" for i in range(len(cleaned), n_features)])
        return cleaned

    df_cols = [c for c in df.columns if c != TARGET_COL]
    if len(df_cols) >= n_features:
        return df_cols[:n_features]

    padded = list(df_cols)
    padded.extend([f"feature_{i + 1}" for i in range(len(df_cols), n_features)])
    return padded


def print_feature_importance(model, base_feature_names: list, sequence_length: int) -> None:
    """Print Random Forest feature importance percentages for target prediction."""
    importances = getattr(model, "feature_importances_", None)
    if importances is None:
        print("\n" + "-" * 80)
        print("FEATURE IMPORTANCE")
        print("-" * 80)
        print("Feature importance not available for this model type.")
        return

    importances = np.asarray(importances, dtype=np.float64)
    n_features = len(base_feature_names)

    expected_flat_count = sequence_length * n_features
    if importances.size != expected_flat_count:
        # Fallback if model importances don't match flattened shape.
        fallback_total = importances.sum()
        if fallback_total <= 0:
            fallback_pct = np.zeros_like(importances)
        else:
            fallback_pct = (importances / fallback_total) * 100.0

        print("\n" + "-" * 80)
        print("FEATURE IMPORTANCE (FLAT FEATURES)")
        print("-" * 80)
        print(f"{'Feature Index':<20} {'Importance (%)':<20}")
        print("-" * 80)
        for idx, pct in enumerate(fallback_pct):
            print(f"{idx:<20} {pct:<20.4f}")
        return

    reshaped = importances.reshape(sequence_length, n_features)
    aggregated = reshaped.sum(axis=0)
    total = aggregated.sum()

    if total <= 0:
        aggregated_pct = np.zeros_like(aggregated)
    else:
        aggregated_pct = (aggregated / total) * 100.0

    ranked = sorted(
        zip(base_feature_names, aggregated_pct),
        key=lambda x: x[1],
        reverse=True,
    )

    # Normalize again to guarantee displayed contributions sum to exactly 100.0
    ranked_total = float(sum(pct for _, pct in ranked))
    if ranked_total > 0:
        ranked = [(name, (pct / ranked_total) * 100.0) for name, pct in ranked]

    top_pct = ranked[0][1] if ranked else 0.0

    print("\n" + "-" * 80)
    print("INPUT FEATURE IMPORTANCE FOR TARGET OUTPUT")
    print("-" * 80)
    print("(Aggregated across all sequence timesteps, shown as percentage contribution)")
    print(f"Detected base input features: {len(base_feature_names)}")
    print(f"\n{'Rank':<8} {'Feature':<35} {'Importance (%)':<15} {'Relative to Top (%)':<22}")
    print("-" * 80)
    for rank, (name, pct) in enumerate(ranked, start=1):
        relative_pct = (pct / top_pct) * 100.0 if top_pct > 0 else 0.0
        print(f"{rank:<8} {name:<35} {pct:<15.4f} {relative_pct:<22.2f}")

    displayed_total = sum(pct for _, pct in ranked)
    print("-" * 80)
    print(f"{'TOTAL':<43} {displayed_total:<15.4f} {'100.00':<22}")

    # Also show top flattened slots (time-step specific) for debugging/analysis.
    flat_total = importances.sum()
    flat_pct = (importances / flat_total) * 100.0 if flat_total > 0 else np.zeros_like(importances)
    top_k = min(10, flat_pct.size)
    top_idx = np.argsort(flat_pct)[::-1][:top_k]

    print("\nTop flattened sequence contributors:")
    print(f"{'Slot':<10} {'Timestep':<10} {'Feature':<30} {'Importance (%)':<15}")
    print("-" * 80)
    for idx in top_idx:
        timestep = int(idx // n_features)
        feat_idx = int(idx % n_features)
        print(
            f"{idx:<10} {timestep:<10} {base_feature_names[feat_idx]:<30} {flat_pct[idx]:<15.4f}"
        )


def main() -> None:
    print_header()

    # 1) Load metadata
    print("\n[1/5] Loading metadata...")
    metadata = load_metadata()
    sequence_length = int(metadata.get("sequence_length", 10))
    n_features = int(metadata.get("n_features", 12))
    print("OK Metadata loaded")

    # 2) Load features and create sequences
    print("\n[2/5] Loading and preparing data...")
    df = load_features()
    X_seq, y_true = prepare_sequences(df, sequence_length=sequence_length, n_features=n_features)

    if X_seq.shape[0] == 0:
        raise RuntimeError(
            "Insufficient rows to build sequences. "
            f"Need > {sequence_length} rows, found {len(df)}"
        )

    print(f"OK Sequences: {X_seq.shape[0]}")
    print(f"   X shape: {X_seq.shape}")
    print(f"   y shape: {y_true.shape}")

    # 3) Load model + scalers
    print("\n[3/5] Loading Random Forest model and scalers...")
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Model file not found: {MODEL_PATH}")
    if not os.path.exists(SCALER_X_PATH):
        raise FileNotFoundError(f"Scaler X file not found: {SCALER_X_PATH}")
    if not os.path.exists(SCALER_Y_PATH):
        raise FileNotFoundError(f"Scaler Y file not found: {SCALER_Y_PATH}")

    with open(MODEL_PATH, "rb") as f:
        model = pickle.load(f)
    with open(SCALER_X_PATH, "rb") as f:
        scaler_x = pickle.load(f)
    with open(SCALER_Y_PATH, "rb") as f:
        scaler_y = pickle.load(f)

    print("OK Model and scalers loaded")

    # 4) Predict
    print("\n[4/5] Predicting...")
    X_flat = flatten_sequences(X_seq)
    X_scaled = scaler_x.transform(X_flat)

    y_pred_scaled = model.predict(X_scaled).reshape(-1, 1)
    y_pred = scaler_y.inverse_transform(y_pred_scaled).reshape(-1)
    print(f"OK Predictions generated: {len(y_pred)}")

    # 5) Metrics
    print("\n[5/5] Calculating metrics...")
    mae = float(mean_absolute_error(y_true, y_pred))
    mse = float(mean_squared_error(y_true, y_pred))
    rmse = float(math.sqrt(mse))
    mape = calculate_mape(y_true, y_pred)
    r2 = float(r2_score(y_true, y_pred))

    print_metrics(mae, mse, rmse, mape, r2)
    print_summary_table(mae, mse, rmse, mape, r2, metadata, n_samples=len(y_true))
    base_feature_names = get_base_feature_names(df, metadata, n_features)
    print_feature_importance(model, base_feature_names, sequence_length)

    print("\n" + "=" * 80)
    print("EVALUATION COMPLETE")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    main()
