# ── Stage 1: Build React frontend ──────────────────────
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Python backend + nginx ─────────────────────
FROM python:3.12-slim

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

RUN apt-get update && apt-get install -y --no-install-recommends nginx && \
    rm -rf /var/lib/apt/lists/*

# Copy React build output
COPY --from=frontend-builder /app/frontend/dist /app/frontend

# Copy backend
COPY backend/ /app/backend/

# Nginx config
COPY nginx.conf /etc/nginx/sites-available/default

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && mkdir -p /data

EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
