"""Compatibility entry point: python -m uvicorn app:app --reload --port 8000."""
from backend.app import app, create_app
