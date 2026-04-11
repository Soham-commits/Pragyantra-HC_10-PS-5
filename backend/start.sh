#!/bin/bash

# MediQ Backend Startup Script

echo "🏥 Starting MediQ Health Companion Backend..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚙️  Creating .env from .env.example..."
    cp .env.example .env
    echo "⚠️  Please update .env with your configuration!"
fi

# Check if MongoDB is running
echo "🔍 Checking MongoDB connection..."
if ! mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    echo "⚠️  MongoDB not detected. Make sure MongoDB is running!"
    echo "   Quick start: docker run -d -p 27017:27017 --name mongodb mongo:latest"
fi

# Start the server
echo "🚀 Starting FastAPI server..."
echo "📍 API will be available at: http://localhost:8000"
echo "📚 Documentation at: http://localhost:8000/api/docs"
echo ""
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
