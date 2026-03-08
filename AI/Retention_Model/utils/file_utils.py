"""
File utilities - Enhanced for new storage structure
"""
import os
import json
import shutil
import pandas as pd
import logging
from datetime import datetime
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

def create_student_directory(user_id: str, base_dir: str) -> Dict[str, str]:
    """
    Create complete directory structure for a student
    """
    student_dir = os.path.join(base_dir, user_id)

    directories = {
        'root': student_dir,
        'raw_data': os.path.join(student_dir, 'raw_data'),
        'models': os.path.join(student_dir, 'models'),
        'predictions': os.path.join(student_dir, 'predictions'),
        'metrics': os.path.join(student_dir, 'metrics'),
        'schedules': os.path.join(student_dir, 'schedules'),
        'logs': os.path.join(student_dir, 'logs')
    }

    # Create all directories
    for path in directories.values():
        os.makedirs(path, exist_ok=True)
        logger.info(f"Created directory: {path}")

    # Create README
    readme_content = f"""# Student Data Directory: {user_id}
Created: {datetime.now().isoformat()}

## Directory Structure
- **raw_data/**: Raw interaction data and CSV files
  - interactions.csv: All learning interactions
  - daily_aggregates.csv: Daily performance summaries
  - topic_metadata.csv: Topic information
- **models/**: Trained LSTM model files (.h5)
- **predictions/**: Retention predictions and forgetting curves
- **metrics/**: Performance metrics over time
- **schedules/**: Daily learning schedules
- **logs/**: System and training logs

## File Formats
- All data stored in CSV format for easy analysis
- Models saved as Keras .h5 files
- Predictions in JSON format for API consumption
"""

    with open(os.path.join(student_dir, 'README.md'), 'w') as f:
        f.write(readme_content)

    logger.info(f"Student directory created for {user_id}")

    return directories

def load_student_model(user_id: str, model_name: str, base_dir: str, config=None):
    """
    Load a trained model for a student
    """
    from Retention_Model.models.micro_lstm import MicroRetentionLSTM
    from Retention_Model.models.meso_lstm import TopicRetentionLSTM
    from Retention_Model.models.macro_lstm import LearningPathLSTM

    model_path = os.path.join(base_dir, user_id, 'models', f'{model_name}_lstm.h5')

    if not os.path.exists(model_path):
        logger.warning(f"Model {model_name} not found for user {user_id}")
        return None

    # Initialize appropriate model class
    if model_name == 'micro':
        model = MicroRetentionLSTM(config=config)
    elif model_name == 'meso':
        model = TopicRetentionLSTM()
    elif model_name == 'macro':
        model = LearningPathLSTM()
    else:
        return None

    model.load(model_path)
    logger.info(f"Loaded {model_name} model for user {user_id}")

    return model

def export_all_data_csv(user_id: str, base_dir: str) -> Dict[str, str]:
    """
    Export all student data to CSV format for analysis
    """
    student_dir = os.path.join(base_dir, user_id)
    export_dir = os.path.join(student_dir, 'exports')
    os.makedirs(export_dir, exist_ok=True)

    exports = {}

    # Export raw data (already CSV, just copy)
    raw_dir = os.path.join(student_dir, 'raw_data')
    if os.path.exists(raw_dir):
        for filename in os.listdir(raw_dir):
            if filename.endswith('.csv'):
                src = os.path.join(raw_dir, filename)
                dst = os.path.join(export_dir, f"raw_{filename}")
                shutil.copy2(src, dst)
                exports[f"raw_{filename}"] = dst

    # Export predictions as CSV
    pred_dir = os.path.join(student_dir, 'predictions')
    if os.path.exists(pred_dir):
        for filename in os.listdir(pred_dir):
            if filename.endswith('.json'):
                src = os.path.join(pred_dir, filename)
                with open(src, 'r') as f:
                    data = json.load(f)

                # Convert to DataFrame
                if isinstance(data, list):
                    df = pd.DataFrame(data)
                elif isinstance(data, dict):
                    # Handle nested dictionaries
                    rows = []
                    for key, value in data.items():
                        if isinstance(value, list):
                            for item in value:
                                item_copy = item.copy()
                                item_copy['key'] = key
                                rows.append(item_copy)
                        else:
                            rows.append({'key': key, **value})
                    df = pd.DataFrame(rows) if rows else pd.DataFrame()
                else:
                    continue

                csv_name = filename.replace('.json', '.csv')
                dst = os.path.join(export_dir, f"pred_{csv_name}")
                df.to_csv(dst, index=False)
                exports[f"pred_{csv_name}"] = dst

    # Export metrics
    metrics_dir = os.path.join(student_dir, 'metrics')
    if os.path.exists(metrics_dir):
        for filename in os.listdir(metrics_dir):
            if filename.endswith('.csv'):
                src = os.path.join(metrics_dir, filename)
                dst = os.path.join(export_dir, f"metrics_{filename}")
                shutil.copy2(src, dst)
                exports[f"metrics_{filename}"] = dst

    logger.info(f"Exported {len(exports)} files for user {user_id}")

    return exports

def cleanup_old_files(user_id: str, base_dir: str, days: int = 30):
    """
    Clean up old log and temporary files
    """
    import time

    student_dir = os.path.join(base_dir, user_id)
    cutoff_time = time.time() - (days * 24 * 60 * 60)

    # Clean logs older than cutoff
    log_dir = os.path.join(student_dir, 'logs')
    if os.path.exists(log_dir):
        for filename in os.listdir(log_dir):
            filepath = os.path.join(log_dir, filename)
            if os.path.getmtime(filepath) < cutoff_time:
                os.remove(filepath)
                logger.info(f"Removed old file: {filepath}")

    # Clean old schedules (keep last 30 days)
    schedule_dir = os.path.join(student_dir, 'schedules')
    if os.path.exists(schedule_dir):
        schedules = []
        for filename in os.listdir(schedule_dir):
            if filename.endswith('.json'):
                filepath = os.path.join(schedule_dir, filename)
                schedules.append((filepath, os.path.getmtime(filepath)))

        # Sort by modification time
        schedules.sort(key=lambda x: x[1], reverse=True)

        # Keep newest 30, delete rest
        for filepath, _ in schedules[30:]:
            os.remove(filepath)
            logger.info(f"Removed old schedule: {filepath}")

    logger.info(f"Cleanup completed for user {user_id}")

def save_training_logs(user_id: str, model_name: str, history, base_dir: str):
    """Save training history logs"""
    log_path = os.path.join(base_dir, user_id, 'logs', f'{model_name}_training.json')

    logs = {
        'user_id': user_id,
        'model': model_name,
        'timestamp': datetime.now().isoformat(),
        'history': {
            'loss': [float(l) for l in history.history.get('loss', [])],
            'accuracy': [float(a) for a in history.history.get('accuracy', [])],
            'val_loss': [float(l) for l in history.history.get('val_loss', [])],
            'val_accuracy': [float(a) for a in history.history.get('val_accuracy', [])]
        } if history else {}
    }

    with open(log_path, 'w') as f:
        json.dump(logs, f, indent=2)

    logger.info(f"Training logs saved for {model_name}")
