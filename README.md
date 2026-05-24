# 🌐 Broad Knowledge Portal

Portal berita otomatis — artikel research dari Hermes AI tentang teknologi, sains, ekonomi, gaming, dan pengetahuan umum.

## Tech Stack

| Layer | Tech |
|-------|------|
| **Backend** | Python FastAPI + SQLite |
| **Frontend** | Vanilla HTML/CSS/JS |
| **Server** | Nginx reverse proxy |
| **Deploy** | Docker + docker-compose |
| **CI/CD** | GitHub Actions → auto-deploy |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/articles` | - | List all articles |
| GET | `/api/articles/:id` | - | Get single article |
| POST | `/api/articles` | `X-API-Key` | Create article |
| POST | `/api/articles/bulk` | `X-API-Key` | Bulk create |
| GET | `/api/categories` | - | List categories |

## Development

```bash
# Backend
cd backend && pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd frontend && python -m http.server 3000
```

## Deploy

```bash
docker compose up -d
# Portal at http://localhost:8080
```

## Cron Integration

Hermes cron job posts scraped articles to `POST /api/articles/bulk` with `X-API-Key` header.
