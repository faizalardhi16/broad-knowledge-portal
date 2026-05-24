#!/bin/bash
set -e

# Create data directory
mkdir -p /data

# Start FastAPI backend
cd /app/backend
uvicorn main:app --host 127.0.0.1 --port 8000 &
sleep 2

# Start nginx
nginx -g "daemon off;"
