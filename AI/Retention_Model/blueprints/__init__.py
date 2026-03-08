"""
Blueprints module for Retention AI
"""
from .retention import retention_bp
from .schedule import schedule_bp
from .performance import performance_bp
from .internal_routes import internal_bp

__all__ = [
    'retention_bp',
    'schedule_bp',
    'performance_bp',
    'internal_bp'
]
