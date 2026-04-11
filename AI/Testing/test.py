"""
Practice Difficulty Model Evaluation Script
Evaluates the practice_difficulty_model.h5 and prints key performance metrics
"""

import os
import json
import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from pathlib import Path

# ============================================================================
# PATHS
# ============================================================================
MODEL_PATH = r"C:\Users\bhish\OneDrive\Desktop\StudyStreamAi\AI\data\students\STU000005\models\practice_difficulty\practice_difficulty_model.h5"
FEATURES_PATH = r"C:\Users\bhish\OneDrive\Desktop\StudyStreamAi\AI\data\students\STU000005\features\practice_features.csv"
METADATA_PATH = r"C:\Users\bhish\OneDrive\Desktop\StudyStreamAi\AI\data\students\STU000005\models\practice_difficulty\practice_difficulty_metadata.json"


# ============================================================================
# UTILITIES
# ============================================================================
def load_metadata():
    """Load model metadata"""
    with open(METADATA_PATH, 'r') as f:
        return json.load(f)


def load_features():
    """Load feature data from CSV"""
    df = pd.read_csv(FEATURES_PATH)
    return df


def prepare_sequences(data, sequence_length=10, n_features=12):
    """
    Prepare sequential data for LSTM model

    Args:
        data: DataFrame with features
        sequence_length: Number of timesteps in each sequence
        n_features: Number of features (excluding target)

    Returns:
        X: Input sequences shape (samples, sequence_length, n_features)
        y: Target values
    """
    X, y = [], []

    # Extract features and target
    feature_cols = data.columns[:-1]  # All except last column (next_difficulty)
    target_col = 'next_difficulty'

    features_data = data[feature_cols].values
    target_data = data[target_col].values

    # Create sequences
    for i in range(len(features_data) - sequence_length):
        X.append(features_data[i:i + sequence_length])
        y.append(target_data[i + sequence_length])

    X = np.array(X, dtype=np.float32)
    y = np.array(y, dtype=np.float32)

    return X, y


def calculate_mape(y_true, y_pred):
    """
    Calculate Mean Absolute Percentage Error

    MAPE = (1/n) * Σ|y_true - y_pred| / |y_true| * 100

    Args:
        y_true: True values
        y_pred: Predicted values

    Returns:
        MAPE value (%)
    """
    y_true = np.asarray(y_true)
    y_pred = np.asarray(y_pred)

    # Avoid division by zero - filter out near-zero actual values
    mask = np.abs(y_true) > 1e-6

    if np.sum(mask) == 0:
        return np.nan

    return np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100


def print_metrics_header():
    """Print formatted header"""
    print("\n" + "=" * 80)
    print("PRACTICE DIFFICULTY MODEL - EVALUATION METRICS")
    print("=" * 80)


def print_metric(name, value, unit="", formula=""):
    """Print formatted metric"""
    if isinstance(value, float):
        print(f"\n{name}:")
        print(f"  Value: {value:.6f} {unit}")
        if formula:
            print(f"  Formula: {formula}")
    else:
        print(f"\n{name}: {value}")


def print_metrics_summary(mae, mse, rmse, mape, r2):
    """Print comprehensive metrics summary"""
    print("\n" + "-" * 80)
    print("DETAILED METRICS REPORT")
    print("-" * 80)

    # MAE
    print_metric(
        "1. MAE (Mean Absolute Error)",
        mae,
        unit="",
        formula="MAE = (1/n) Σ |y_true - y_pred|"
    )
    print("  ✓ Easy to understand")
    print("  ✓ Penalizes all errors equally")
    print("  ✓ Same unit as target variable")

    # MSE
    print_metric(
        "2. MSE (Mean Squared Error)",
        mse,
        unit="",
        formula="MSE = (1/n) Σ (y_true - y_pred)²"
    )
    print("  ✓ Penalizes large errors more heavily")
    print("  ✓ Sensitive to outliers")
    print("  ✓ Always non-negative")

    # RMSE
    print_metric(
        "3. RMSE (Root Mean Squared Error)",
        rmse,
        unit="",
        formula="RMSE = √MSE"
    )
    print("  ✓ Same unit as output (target variable)")
    print("  ✓ Very commonly used metric")
    print("  ✓ More interpretable than MSE")

    # MAPE
    if np.isnan(mape):
        print("\n4. MAPE (Mean Absolute Percentage Error):")
        print("  Value: N/A (division by zero - actual values too close to 0)")
    else:
        print_metric(
            "4. MAPE (Mean Absolute Percentage Error)",
            mape,
            unit="%",
            formula="MAPE = (1/n) Σ |y_true - y_pred| / |y_true| × 100"
        )
        print("  ✓ Gives percentage error (scale-independent)")
        print("  ✗ Breaks if actual value ≈ 0")

    # R² Score
    print_metric(
        "5. R² Score (Coefficient of Determination)",
        r2,
        unit="",
        formula="R² = 1 - (SS_res / SS_tot)"
    )
    print("  ✓ Measures how well model explains variance")
    print("  ✓ Range: -∞ to 1")
    print(f"    - 1.0 → Perfect predictions")
    print(f"    - 0.0 → No better than using mean")
    print(f"    - <0.0 → Worse than baseline")
    print(f"  ✓ Current R² Score: {r2:.6f}")


def print_summary_table(mae, mse, rmse, mape, r2, metadata, n_samples):
    """Print summary table"""
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
    print(f"{'R² Score':<30} {r2:<20.6f} {r2_interpretation:<30}")

    print("\n" + "-" * 80)
    print("MODEL INFORMATION")
    print("-" * 80)
    print(f"Sequence Length: {metadata['sequence_length']}")
    print(f"Number of Features: {metadata['n_features']}")
    print(f"Model Type: {metadata['model_type']}")
    print(f"Test Samples: {n_samples}")
    print(f"Last Trained: {metadata['last_saved']}")

    if metadata['training_history']:
        history = metadata['training_history'][-1]
        print(f"Training Epochs: {history['epochs_completed']}")
        print(f"Final Training Loss: {history['final_loss']:.6f}")
        print(f"Final Validation Loss: {history['final_val_loss']:.6f}")


# ============================================================================
# MAIN EXECUTION
# ============================================================================
def main():
    """Main evaluation function"""

    print_metrics_header()

    # 1. Load metadata
    print("\n[1/5] Loading metadata...")
    metadata = load_metadata()
    sequence_length = metadata['sequence_length']
    n_features = metadata['n_features']
    print("✓ Metadata loaded")

    # 2. Load features and prepare data
    print("\n[2/5] Loading and preparing data...")
    df = load_features()
    X, y = prepare_sequences(df, sequence_length=sequence_length, n_features=n_features)
    print(f"✓ Data prepared: {X.shape[0]} sequences created")
    print(f"  Input shape: {X.shape}")
    print(f"  Target shape: {y.shape}")

    # 3. Load model
    print("\n[3/5] Loading model...")
    if not os.path.exists(MODEL_PATH):
        print(f"✗ Model file not found at: {MODEL_PATH}")
        return

    try:
        # Load without compiling to avoid metric deserialization issues
        model = tf.keras.models.load_model(MODEL_PATH, compile=False)
        print("✓ Model loaded successfully")
        print(f"  Model has {len(model.layers)} layers")
    except Exception as e:
        print(f"✗ Error loading model: {str(e)}")
        print("  Attempting alternative loading method...")
        try:
            model = tf.keras.models.load_model(MODEL_PATH, compile=False)
            print("✓ Model loaded with alternative method")
        except Exception as e2:
            print(f"✗ Failed to load model: {str(e2)}")
            return

    # 4. Make predictions
    print("\n[4/5] Making predictions...")
    y_pred = model.predict(X, verbose=0)
    y_pred = y_pred.reshape(-1)  # Flatten predictions
    print(f"✓ Predictions complete: {y_pred.shape[0]} predictions made")

    # 5. Calculate metrics
    print("\n[5/5] Calculating metrics...")
    mae = mean_absolute_error(y, y_pred)
    mse = mean_squared_error(y, y_pred)
    rmse = np.sqrt(mse)
    mape = calculate_mape(y, y_pred)
    r2 = r2_score(y, y_pred)

    print("✓ All metrics calculated")

    # Print detailed results
    print_metrics_summary(mae, mse, rmse, mape, r2)
    print_summary_table(mae, mse, rmse, mape, r2, metadata, X.shape[0])

    # Print sample predictions vs actuals
    print("\n" + "-" * 80)
    print("SAMPLE PREDICTIONS (First 10)")
    print("-" * 80)
    print(f"\n{'#':<5} {'Actual':<12} {'Predicted':<12} {'Error':<12} {'|Error|':<12}")
    print("-" * 80)

    for i in range(min(10, len(y))):
        error = y[i] - y_pred[i]
        abs_error = abs(error)
        print(f"{i+1:<5} {y[i]:<12.6f} {y_pred[i]:<12.6f} {error:<12.6f} {abs_error:<12.6f}")

    print("\n" + "=" * 80)
    print("EVALUATION COMPLETE")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    main()


'''


================================================================================
PRACTICE DIFFICULTY MODEL - EVALUATION METRICS
================================================================================

[1/5] Loading metadata...
✓ Metadata loaded

[2/5] Loading and preparing data...
✓ Data prepared: 93 sequences created
  Input shape: (93, 10, 12)
  Target shape: (93,)

[3/5] Loading model...
2026-03-25 17:14:46.791824: I tensorflow/core/platform/cpu_feature_guard.cc:210] This TensorFlow binary is optimized to use available CPU instructions in performance-critical operations.
To enable the following instructions: SSE3 SSE4.1 SSE4.2 AVX AVX2 AVX512F AVX512_VNNI FMA, in other operations, rebuild TensorFlow with the appropriate compiler flags.
✓ Model loaded successfully
  Model has 14 layers

[4/5] Making predictions...
✓ Predictions complete: 93 predictions made

[5/5] Calculating metrics...
✓ All metrics calculated

--------------------------------------------------------------------------------
DETAILED METRICS REPORT
--------------------------------------------------------------------------------

1. MAE (Mean Absolute Error):
  Value: 0.119975
  Formula: MAE = (1/n) Σ |y_true - y_pred|
  ✓ Easy to understand
  ✓ Penalizes all errors equally
  ✓ Same unit as target variable

2. MSE (Mean Squared Error):
  Value: 0.026358
  Formula: MSE = (1/n) Σ (y_true - y_pred)²
  ✓ Penalizes large errors more heavily
  ✓ Sensitive to outliers
  ✓ Always non-negative

3. RMSE (Root Mean Squared Error):
  Value: 0.162350
  Formula: RMSE = √MSE
  ✓ Same unit as output (target variable)
  ✓ Very commonly used metric
  ✓ More interpretable than MSE

4. MAPE (Mean Absolute Percentage Error): 25.08578872680664
  ✓ Gives percentage error (scale-independent)
  ✗ Breaks if actual value ≈ 0

5. R² Score (Coefficient of Determination):
  Value: -1.144660
  Formula: R² = 1 - (SS_res / SS_tot)
  ✓ Measures how well model explains variance
  ✓ Range: -∞ to 1
    - 1.0 → Perfect predictions
    - 0.0 → No better than using mean
    - <0.0 → Worse than baseline
  ✓ Current R² Score: -1.144660

--------------------------------------------------------------------------------
QUICK SUMMARY
--------------------------------------------------------------------------------

Metric                         Value                Interpretation
--------------------------------------------------------------------------------
MAE                            0.119975             Average error magnitude
MSE                            0.026358             Squared errors
RMSE                           0.162350             Root squared errors
MAPE                           25.09               % Percentage error
R² Score                       -1.144660            Poor

--------------------------------------------------------------------------------
MODEL INFORMATION
--------------------------------------------------------------------------------
Sequence Length: 10
Number of Features: 12
Model Type: practice_difficulty
Test Samples: 93
Last Trained: 2026-03-25T16:43:17.904519
Training Epochs: 100
Final Training Loss: 1.548140
Final Validation Loss: 1.562626

--------------------------------------------------------------------------------
SAMPLE PREDICTIONS (First 10)
--------------------------------------------------------------------------------

#     Actual       Predicted    Error        |Error|
--------------------------------------------------------------------------------
1     0.500000     0.482039     0.017961     0.017961
2     0.600000     0.479360     0.120640     0.120640
3     0.600000     0.476789     0.123211     0.123211
4     0.500000     0.491081     0.008919     0.008919
5     0.400000     0.490674     -0.090674    0.090674
6     0.600000     0.480944     0.119056     0.119056
7     0.400000     0.485729     -0.085729    0.085729
8     0.300000     0.493577     -0.193577    0.193577
9     0.700000     0.491713     0.208287     0.208287
10    0.600000     0.497386     0.102614     0.102614

================================================================================
EVALUATION COMPLETE
================================================================================


'''
