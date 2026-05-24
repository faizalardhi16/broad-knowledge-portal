FROM python:3.12-slim

RUN pip install --no-cache-dir fastapi uvicorn[standard] aiosqlite pydantic python-multipart httpx

WORKDIR /app
COPY backend/ /app/backend/
COPY frontend/ /app/frontend/

# Install nginx
RUN apt-get update && apt-get install -y --no-install-recommends nginx && \
    rm -rf /var/lib/apt/lists/*

# Nginx config: serve frontend + proxy API
COPY nginx.conf /etc/nginx/sites-available/default

# Copy entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

RUN mkdir -p /data

EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
