import os
import logging
from flask import Flask, jsonify
from flask_cors import CORS
from datetime import datetime

from config import Config, RetentionConfig
from services.training_service import TrainingService
from services.prediction_service import PredictionService
from Retention_Model.Services.training_service import TrainingService as RetentionTrainingService
from Retention_Model.Services.prediction_service import PredictionService as RetentionPredictionService
from Retention_Model.Services.schedule_service import ScheduleService as RetentionScheduleService
from Retention_Model.Services.performance_service import PerformanceService as RetentionPerformanceService

# Blueprints
from blueprints.practice import practice_bp
from blueprints.real_exam import real_exam_bp
from blueprints.analysis import analysis_bp
from blueprints.dashboard import dashboard_bp

#Blueprints of Retention_Model folder
from Retention_Model.blueprints.retention import retention_bp
from Retention_Model.blueprints.internal_routes import internal_bp
from Retention_Model.blueprints.performance import performance_bp
from Retention_Model.blueprints.schedule import schedule_bp

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # CORS
    CORS(app)

    # Setup logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # Initialize services
    app.training_service = TrainingService(config_class)
    app.prediction_service = PredictionService(config_class)

    # Initialize dedicated Retention_Model services
    app.retention_training_service = RetentionTrainingService(RetentionConfig)
    app.retention_prediction_service = RetentionPredictionService(RetentionConfig)
    app.retention_schedule_service = RetentionScheduleService(RetentionConfig)
    app.retention_performance_service = RetentionPerformanceService(RetentionConfig)

    # Expose retention config for route modules that read from app.config
    app.config['NODE_API'] = RetentionConfig.NODE_API
    app.config['STUDENT_DATA_DIR'] = RetentionConfig.STUDENT_DATA_DIR

    # Register blueprints
    app.register_blueprint(practice_bp, url_prefix='/api/practice')
    app.register_blueprint(real_exam_bp, url_prefix='/api/real-exam')
    app.register_blueprint(analysis_bp, url_prefix='/api/analysis')
    app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')

    # Register blueprints for Retention_Model under one namespace.
    app.register_blueprint(retention_bp, url_prefix='/api/retention')
    app.register_blueprint(schedule_bp, url_prefix='/api/retention/schedule')
    app.register_blueprint(performance_bp, url_prefix='/api/retention/performance')
    app.register_blueprint(internal_bp, url_prefix='/api/retention/internal')

    @app.route('/api/health', methods=['GET'])
    def health():
        return jsonify({
            'success': True,
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'models': ['learning_velocity', 'burnout_risk', 'adaptive_scheduling']
        })

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=False, host='0.0.0.0', port=5500)
