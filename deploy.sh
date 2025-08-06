#!/bin/bash

echo "🚀 Prompt Evaluator Deployment Script"
echo "====================================="

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "📝 Please copy env.example to .env and fill in your values:"
    echo "   cp env.example .env"
    echo "   nano .env"
    exit 1
fi

# Check if required environment variables are set
source .env

if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "your_openai_api_key_here" ]; then
    echo "❌ OPENAI_API_KEY not set in .env file"
    exit 1
fi

if [ -z "$PGPASSWORD" ] || [ "$PGPASSWORD" = "your_cloudsql_password_here" ]; then
    echo "❌ PGPASSWORD not set in .env file"
    exit 1
fi

echo "✅ Environment variables configured"

# Install Docker if not installed
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    sudo apt-get update
    sudo apt-get install -y docker.io docker-compose
    sudo usermod -aG docker $USER
    echo "⚠️  Please log out and back in, or run: newgrp docker"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker service:"
    echo "   sudo systemctl start docker"
    exit 1
fi

echo "✅ Docker is ready"

# Check if we should use registry or build locally
if [ "$1" = "--registry" ]; then
    echo "📥 Pulling image from registry..."
    docker-compose pull
    echo "🚀 Starting application from registry..."
    docker-compose up -d
else
    echo "🔨 Building Docker image locally..."
    docker-compose build
    echo "🚀 Starting application..."
    docker-compose up -d
fi

echo "⏳ Waiting for application to start..."
sleep 10

# Check if application is running
if docker-compose ps | grep -q "Up"; then
    echo "✅ Application is running!"
    echo "🌐 Access your application at: http://localhost:3000"
    echo "📊 Check logs with: docker-compose logs -f"
else
    echo "❌ Application failed to start"
    echo "📋 Check logs with: docker-compose logs"
    exit 1
fi 