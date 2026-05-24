"""
Broad Knowledge Portal — Backend API
FastAPI + SQLite backend for news article CRUD.
"""
import os
import json
import aiosqlite
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

DB_PATH = os.getenv("DB_PATH", "/data/news.db")
API_KEY = os.getenv("API_KEY", "hermes-news-portal-secret-key-2024")
SECRET_HEADER = "X-API-Key"

# ── Lifespan ─────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(os.path.dirname(DB_PATH) if os.path.dirname(DB_PATH) else ".", exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS articles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                summary TEXT NOT NULL,
                source_url TEXT,
                category TEXT NOT NULL,
                category_emoji TEXT DEFAULT '📰',
                insight TEXT DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                published INTEGER DEFAULT 1
            )
        """)
        await db.execute("CREATE INDEX IF NOT EXISTS idx_category ON articles(category)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_created ON articles(created_at DESC)")
        await db.commit()
    yield

app = FastAPI(title="Broad Knowledge Portal API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Models ───────────────────────────────────────────────────────────────
class ArticleCreate(BaseModel):
    title: str
    summary: str
    source_url: Optional[str] = None
    category: str
    category_emoji: str = "📰"
    insight: str = ""

class ArticleOut(BaseModel):
    id: int
    title: str
    summary: str
    source_url: Optional[str] = None
    category: str
    category_emoji: str
    insight: str
    created_at: str

# ── Auth ─────────────────────────────────────────────────────────────────
async def verify_key(x_api_key: str = Depends(lambda: None)):
    # FastAPI header extraction
    return None

from fastapi import Header

async def require_auth(x_api_key: str = Header(alias=SECRET_HEADER)):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")

# ── Routes ───────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {"service": "Broad Knowledge Portal", "version": "1.0.0"}

@app.get("/api/articles")
async def list_articles(
    category: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        if category:
            rows = await db.execute_fetchall(
                "SELECT * FROM articles WHERE published=1 AND category=? ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (category, limit, offset)
            )
            count_row = await db.execute_fetchall(
                "SELECT COUNT(*) as cnt FROM articles WHERE published=1 AND category=?", (category,)
            )
        else:
            rows = await db.execute_fetchall(
                "SELECT * FROM articles WHERE published=1 ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (limit, offset)
            )
            count_row = await db.execute_fetchall(
                "SELECT COUNT(*) as cnt FROM articles WHERE published=1"
            )
        total = count_row[0]["cnt"] if count_row else 0
        return {"articles": [dict(r) for r in rows], "total": total, "limit": limit, "offset": offset}

@app.get("/api/articles/{article_id}")
async def get_article(article_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        row = await db.execute_fetchall("SELECT * FROM articles WHERE id=? AND published=1", (article_id,))
        if not row:
            raise HTTPException(status_code=404, detail="Article not found")
        return dict(row[0])

@app.post("/api/articles")
async def create_article(
    article: ArticleCreate,
    x_api_key: str = Header(alias=SECRET_HEADER),
):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "INSERT INTO articles (title, summary, source_url, category, category_emoji, insight, created_at) VALUES (?,?,?,?,?,?,?)",
            (article.title, article.summary, article.source_url, article.category, article.category_emoji, article.insight, now)
        )
        await db.commit()
        article_id = cursor.lastrowid
        return {"id": article_id, "created_at": now, "status": "published"}

@app.post("/api/articles/bulk")
async def create_articles_bulk(
    articles: list[ArticleCreate],
    x_api_key: str = Header(alias=SECRET_HEADER),
):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    ids = []
    async with aiosqlite.connect(DB_PATH) as db:
        for article in articles:
            cursor = await db.execute(
                "INSERT INTO articles (title, summary, source_url, category, category_emoji, insight, created_at) VALUES (?,?,?,?,?,?,?)",
                (article.title, article.summary, article.source_url, article.category, article.category_emoji, article.insight, now)
            )
            ids.append(cursor.lastrowid)
        await db.commit()
    return {"ids": ids, "count": len(ids), "status": "published"}

@app.get("/api/categories")
async def list_categories():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        rows = await db.execute_fetchall(
            "SELECT category, category_emoji, COUNT(*) as count FROM articles WHERE published=1 GROUP BY category ORDER BY count DESC"
        )
        return {"categories": [dict(r) for r in rows]}
