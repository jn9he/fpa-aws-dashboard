#!/bin/bash
# Ensure persistent directory exists for SQLite
mkdir -p /home/data

# Start the FastAPI application
uvicorn main:app --host 0.0.0.0 --port 8000
