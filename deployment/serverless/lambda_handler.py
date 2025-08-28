"""
Lambda handler for FastAPI application
"""
from mangum import Mangum
import sys
import os

# Add the backend directory to Python path
sys.path.insert(0, '/var/task')

# Import the FastAPI app
from api import app

# Create the Lambda handler
handler = Mangum(app, lifespan="off")