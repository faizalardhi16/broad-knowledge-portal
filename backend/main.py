"""
Portal Notiovation — Backend API
FastAPI + MySQL backend with slug support, JWT auth, and admin dashboard.
"""
import os
import re
import aiomysql
from datetime import datetime, timezone, timedelta
from contextlib import asynccontextmanager
from typing import Optional

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, Depends, Query, Header, Request
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

# ── JWT ──────────────────────────────────────────────────────────────────
from jose import jwt, JWTError

# ── Password hashing ─────────────────────────────────────────────────────
import bcrypt

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

# ── Google Auth ──────────────────────────────────────────────────────────
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

# ── Configuration ────────────────────────────────────────────────────────
MYSQL_HOST = os.getenv("MYSQL_HOST", "127.0.0.1")
MYSQL_PORT = int(os.getenv("MYSQL_PORT", "3306"))
MYSQL_USER = os.getenv("MYSQL_USER", "portal")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "portal-pass-2026")
MYSQL_DB = os.getenv("MYSQL_DB", "portal")

API_KEY = os.getenv("API_KEY", "hermes-news-portal-secret-key-2024")
SECRET_HEADER = "X-API-Key"

JWT_SECRET = os.getenv("JWT_SECRET", "hermes-jwt-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = int(os.getenv("JWT_EXPIRATION_HOURS", "72"))


# ── SMTP (Sumopod) ──────────────────────────────────────────────────────
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.sumopod.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASS = os.getenv("SMTP_PASS")
SMTP_FROM = os.getenv("SMTP_FROM", "Portal Notiovation <noreply@portal.notiovation.com>")

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "")

bearer_scheme = HTTPBearer(auto_error=False)

# ── Slug utility ─────────────────────────────────────────────────────────
def slugify(title: str) -> str:
    """Generate a URL-friendly slug from a title."""
    slug = title.lower()
    slug = re.sub(r"\s+", "-", slug)
    slug = re.sub(r"[^a-z0-9\-]", "", slug)
    slug = re.sub(r"-+", "-", slug)
    slug = slug.strip("-")
    return slug or "article"


async def generate_unique_slug(cur, title: str, exclude_id: Optional[int] = None) -> str:
    """Generate a slug, appending -2, -3, etc if duplicates exist."""
    base_slug = slugify(title)
    slug = base_slug
    counter = 1
    while True:
        if exclude_id:
            await cur.execute(
                "SELECT ID FROM ARTICLES WHERE SLUG=%s AND ID!=%s", (slug, exclude_id)
            )
        else:
            await cur.execute(
                "SELECT ID FROM ARTICLES WHERE SLUG=%s", (slug,)
            )
        rows = await cur.fetchall()
        if not rows:
            return slug
        counter += 1
        slug = f"{base_slug}-{counter}"


# ── JWT utilities ────────────────────────────────────────────────────────
def create_jwt_token(data: dict) -> str:
    """Create a JWT token with expiration."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_jwt_token(token: str) -> dict:
    """Decode and verify a JWT token. Raises JWTError on failure."""
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    """Dependency that extracts the current user from the Bearer token."""
    if credentials is None:
        raise HTTPException(status_code=401, detail="Token otentikasi diperlukan")
    try:
        payload = decode_jwt_token(credentials.credentials)
    except JWTError:
        raise HTTPException(status_code=401, detail="Token tidak valid atau kedaluwarsa")
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Payload token tidak valid")

    pool = request.app.state.pool
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute("SELECT * FROM USERS WHERE ID=%s", (user_id,))
            rows = await cur.fetchall()
            if not rows:
                raise HTTPException(status_code=401, detail="Pengguna tidak ditemukan")
            return rows[0]


async def require_admin(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Dependency that requires the current user to be an admin."""
    if current_user.get("ROLE") != "admin":
        raise HTTPException(status_code=403, detail="Akses ditolak: hanya admin yang diizinkan")
    return current_user


def verify_google_token(credential: str) -> dict:
    """Verify a Google ID token. Returns payload if valid."""
    if GOOGLE_CLIENT_ID:
        # Server-side verification
        idinfo = google_id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
        return idinfo
    else:
        # No client ID configured — decode without verification
        # In production, always set GOOGLE_CLIENT_ID
        import base64
        import json as _json
        parts = credential.split(".")
        if len(parts) != 3:
            raise ValueError("Token Google tidak valid")
        # Add padding
        padded = parts[1] + "=" * (4 - len(parts[1]) % 4) if len(parts[1]) % 4 else parts[1]
        try:
            decoded = base64.urlsafe_b64decode(padded)
            return _json.loads(decoded)
        except Exception:
            raise ValueError("Gagal mendekode token Google")


# ── Legacy API key auth (kept for existing scraper compatibility) ───────
async def require_api_key(x_api_key: str = Header(alias=SECRET_HEADER, default="")) -> None:
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Kunci API tidak valid")


import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import BackgroundTasks


def send_welcome_email(to_email: str, username: str):
    """Send welcome email via Sumopod SMTP — minimal plain-text to avoid spam."""
    try:
        body = f"""Halo, {username}!

Akun kamu di Portal Notiovation sudah aktif.

Silakan login dan akses artikel terbaru seputar Teknologi, Sains,
Ekonomi, Bisnis, dan Gaming dalam Bahasa Indonesia.

Kunjungi: https://portal.notiovation.com

Salam,
Portal Notiovation"""

        msg = MIMEText(body, "plain")
        msg["From"] = SMTP_FROM
        msg["To"] = to_email
        msg["Subject"] = f"Akun Portal Notiovation sudah aktif, {username}"
        msg["Reply-To"] = "noreply@portal.notiovation.com"
        
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_FROM, to_email, msg.as_string())
            
        print(f"Welcome email sent to {to_email}")
        return True
    except Exception as e:
        print(f"Failed to send welcome email to {to_email}: {e}")
        return False

# ── Lifespan ─────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create connection pool
    pool = await aiomysql.create_pool(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        db=MYSQL_DB,
        charset="utf8mb4",
        autocommit=True,
        minsize=2,
        maxsize=10,
    )
    app.state.pool = pool

    # Create tables
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            # ── ARTICLES table ──────────────────────────────────────────
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS ARTICLES (
                    ID INT AUTO_INCREMENT PRIMARY KEY,
                    TITLE VARCHAR(500) NOT NULL,
                    SLUG VARCHAR(500) UNIQUE,
                    SUMMARY TEXT,
                    SOURCE_URL VARCHAR(1000),
                    IMAGE_URL VARCHAR(1000),
                    CATEGORY VARCHAR(100),
                    CATEGORY_EMOJI VARCHAR(10) DEFAULT '📰',
                    INSIGHT TEXT,
                    CREATED_AT DATETIME DEFAULT CURRENT_TIMESTAMP,
                    PUBLISHED TINYINT DEFAULT 1
                ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
            """)
            # Indexes (MySQL creates indexes automatically for UNIQUE,
            # but add explicit ones for performance)
            try:
                await cur.execute(
                    "CREATE INDEX idx_articles_category ON ARTICLES (CATEGORY)"
                )
            except Exception:
                pass
            try:
                await cur.execute(
                    "CREATE INDEX idx_articles_created ON ARTICLES (CREATED_AT)"
                )
            except Exception:
                pass

            # ── USERS table ─────────────────────────────────────────────
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS USERS (
                    ID INT AUTO_INCREMENT PRIMARY KEY,
                    EMAIL VARCHAR(255) UNIQUE NOT NULL,
                    USERNAME VARCHAR(100),
                    PICTURE VARCHAR(1000) DEFAULT '',
                    PASSWORD_HASH VARCHAR(255) DEFAULT '',
                    ROLE VARCHAR(20) DEFAULT 'user',
                    GOOGLE_ID VARCHAR(255) DEFAULT '',
                    CREATED_AT DATETIME DEFAULT CURRENT_TIMESTAMP
                ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
            """)
            try:
                await cur.execute(
                    "CREATE INDEX idx_users_email ON USERS (EMAIL)"
                )
            except Exception:
                pass
            try:
                await cur.execute(
                    "CREATE INDEX idx_users_google ON USERS (GOOGLE_ID)"
                )
            except Exception:
                pass

    yield

    pool.close()
    await pool.wait_closed()


app = FastAPI(
    title="Portal Notiovation API",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Pydantic Models ──────────────────────────────────────────────────────
class ArticleCreate(BaseModel):
    title: str
    summary: str
    source_url: Optional[str] = None
    category: str
    category_emoji: str = "📰"
    insight: str = ""
    image_url: Optional[str] = None


class ArticleUpdate(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    source_url: Optional[str] = None
    category: Optional[str] = None
    category_emoji: Optional[str] = None
    insight: Optional[str] = None
    image_url: Optional[str] = None
    published: Optional[int] = None


class ArticleOut(BaseModel):
    id: int
    title: str
    slug: Optional[str] = None
    summary: str
    source_url: Optional[str] = None
    image_url: Optional[str] = None
    category: str
    category_emoji: str
    insight: str
    created_at: str


class UserRegister(BaseModel):
    email: str
    password: str
    name: str


class UserLogin(BaseModel):
    email: str
    password: str


class GoogleLogin(BaseModel):
    credential: str  # Google ID token from client


class UserOut(BaseModel):
    id: int
    email: str
    name: str
    picture: str
    role: str
    created_at: str


class CreateFirstAdmin(BaseModel):
    email: str
    password: str
    name: str


# ── Routes: Public ───────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {"LAYANAN": "Portal Notiovation", "VERSI": "2.0.0"}


@app.get("/sitemap.xml")
async def sitemap(request: Request):
    """Generate dynamic sitemap for SEO."""
    pool = request.app.state.pool
    base_url = "https://portal.notiovation.com"
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                "SELECT SLUG, CREATED_AT FROM ARTICLES WHERE PUBLISHED=1 ORDER BY CREATED_AT DESC"
            )
            articles = await cur.fetchall()

    urls = [f"  <url>\n    <loc>{base_url}/</loc>\n    <changefreq>hourly</changefreq>\n    <priority>1.0</priority>\n  </url>"]
    for a in articles:
        lastmod = a['CREATED_AT'].strftime('%Y-%m-%d') if a['CREATED_AT'] else ''
        urls.append(
            f"  <url>\n"
            f"    <loc>{base_url}/article/{a['SLUG']}</loc>\n"
            f"    <lastmod>{lastmod}</lastmod>\n"
            f"    <changefreq>daily</changefreq>\n"
            f"    <priority>0.8</priority>\n"
            f"  </url>"
        )
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + '\n'.join(urls) + '\n</urlset>'
    return Response(content=xml, media_type="application/xml")


# ── Routes: Articles (public read) ──────────────────────────────────────
@app.get("/api/articles")
async def list_articles(
    request: Request,
    category: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
):
    pool = request.app.state.pool
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            if category:
                await cur.execute(
                    "SELECT * FROM ARTICLES WHERE PUBLISHED=1 AND CATEGORY=%s "
                    "ORDER BY CREATED_AT DESC LIMIT %s OFFSET %s",
                    (category, limit, offset),
                )
                rows = await cur.fetchall()
                await cur.execute(
                    "SELECT COUNT(*) AS CNT FROM ARTICLES WHERE PUBLISHED=1 AND CATEGORY=%s",
                    (category,),
                )
            else:
                await cur.execute(
                    "SELECT * FROM ARTICLES WHERE PUBLISHED=1 "
                    "ORDER BY CREATED_AT DESC LIMIT %s OFFSET %s",
                    (limit, offset),
                )
                rows = await cur.fetchall()
                await cur.execute(
                    "SELECT COUNT(*) AS CNT FROM ARTICLES WHERE PUBLISHED=1"
                )
            count_row = await cur.fetchone()
        total = count_row["CNT"] if count_row else 0
        return {
            "ARTICLES": rows,
            "TOTAL": total,
            "LIMIT": limit,
            "OFFSET": offset,
        }


@app.get("/api/articles/{article_id}")
async def get_article(request: Request, article_id: int):
    pool = request.app.state.pool
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                "SELECT * FROM ARTICLES WHERE ID=%s AND PUBLISHED=1", (article_id,)
            )
            row = await cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Artikel tidak ditemukan")
        return row


@app.get("/api/articles/slug/{slug}")
async def get_article_by_slug(request: Request, slug: str):
    """Get a single article by its slug."""
    pool = request.app.state.pool
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                "SELECT * FROM ARTICLES WHERE SLUG=%s AND PUBLISHED=1", (slug,)
            )
            row = await cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Artikel tidak ditemukan")
        return row


# ── Routes: Articles (admin write) ──────────────────────────────────────
@app.post("/api/articles")
async def create_article(
    request: Request,
    article: ArticleCreate,
    x_api_key: str = Header(alias=SECRET_HEADER, default=""),
):
    """Create a new article. Requires API key (legacy) or admin JWT."""
    # Try legacy API key first, then try Bearer token
    auth_method = None
    if x_api_key == API_KEY:
        auth_method = "api_key"
    else:
        auth_method = "pending"

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    pool = request.app.state.pool
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            slug = await generate_unique_slug(cur, article.title)
            await cur.execute(
                "INSERT INTO ARTICLES (TITLE, SLUG, SUMMARY, SOURCE_URL, IMAGE_URL, "
                "CATEGORY, CATEGORY_EMOJI, INSIGHT, CREATED_AT) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                (
                    article.title,
                    slug,
                    article.summary,
                    article.source_url,
                    article.image_url,
                    article.category,
                    article.category_emoji,
                    article.insight,
                    now,
                ),
            )
            article_id = cur.lastrowid
        await conn.commit()
        return {
            "ID": article_id,
            "SLUG": slug,
            "CREATED_AT": now,
            "STATUS": "diterbitkan",
        }


@app.post("/api/articles/bulk")
async def create_articles_bulk(
    request: Request,
    articles: list[ArticleCreate],
    x_api_key: str = Header(alias=SECRET_HEADER, default=""),
):
    """Create multiple articles at once. Requires API key."""
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Kunci API tidak valid")
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    ids = []
    slugs = []
    pool = request.app.state.pool
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            for article in articles:
                slug = await generate_unique_slug(cur, article.title)
                await cur.execute(
                    "INSERT INTO ARTICLES (TITLE, SLUG, SUMMARY, SOURCE_URL, IMAGE_URL, "
                    "CATEGORY, CATEGORY_EMOJI, INSIGHT, CREATED_AT) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                    (
                        article.title,
                        slug,
                        article.summary,
                        article.source_url,
                        article.image_url,
                        article.category,
                        article.category_emoji,
                        article.insight,
                        now,
                    ),
                )
                ids.append(cur.lastrowid)
                slugs.append(slug)
        await conn.commit()
    return {"IDS": ids, "SLUGS": slugs, "COUNT": len(ids), "STATUS": "diterbitkan"}


@app.delete("/api/articles/{article_id}")
async def delete_article(
    request: Request,
    article_id: int,
    admin: dict = Depends(require_admin),
):
    """Hapus artikel. Hanya admin."""
    pool = request.app.state.pool
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                "SELECT ID FROM ARTICLES WHERE ID=%s", (article_id,)
            )
            row = await cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Artikel tidak ditemukan")
            await cur.execute("DELETE FROM ARTICLES WHERE ID=%s", (article_id,))
        await conn.commit()
    return {"STATUS": "dihapus", "ID": article_id}


# ── Routes: Categories ──────────────────────────────────────────────────
@app.get("/api/categories")
async def list_categories(request: Request):
    pool = request.app.state.pool
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                "SELECT CATEGORY, MIN(CATEGORY_EMOJI) AS CATEGORY_EMOJI, COUNT(*) AS COUNT "
                "FROM ARTICLES WHERE PUBLISHED=1 "
                "GROUP BY CATEGORY ORDER BY COUNT DESC"
            )
            rows = await cur.fetchall()
        return {"KATEGORI": rows, "TOTAL_KATEGORI": len(rows)}


# ── Routes: Auth ─────────────────────────────────────────────────────────
@app.post("/api/auth/register")
async def register(request: Request, user: UserRegister, background_tasks: BackgroundTasks):
    """Daftar pengguna baru. Mengembalikan token JWT."""
    if len(user.password) < 6:
        raise HTTPException(status_code=400, detail="Kata sandi minimal 6 karakter")
    if not user.email or "@" not in user.email:
        raise HTTPException(status_code=400, detail="Email tidak valid")

    pool = request.app.state.pool
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            # Check existing user
            await cur.execute(
                "SELECT ID FROM USERS WHERE EMAIL=%s", (user.email,)
            )
            existing = await cur.fetchone()
            if existing:
                raise HTTPException(status_code=409, detail="Email sudah terdaftar")

            # Determine role: if email matches ADMIN_EMAIL, make admin
            role = "admin" if ADMIN_EMAIL and user.email.lower() == ADMIN_EMAIL.lower() else "user"

            password_hash_val = hash_password(user.password)
            await cur.execute(
                "INSERT INTO USERS (EMAIL, USERNAME, PICTURE, PASSWORD_HASH, ROLE) "
                "VALUES (%s,%s,%s,%s,%s)",
                (user.email, user.name, "", password_hash_val, role),
            )
            user_id = cur.lastrowid
        await conn.commit()

        # Send welcome email in background
        background_tasks.add_task(send_welcome_email, user.email, user.name)
        
        token = create_jwt_token({"sub": str(user_id), "email": user.email, "role": role})
        return {
            "TOKEN": token,
            "PENGGUNA": {
                "ID": user_id,
                "EMAIL": user.email,
                "USERNAME": user.name,
                "PICTURE": "",
                "ROLE": role,
            },
        }


@app.post("/api/auth/login")
async def login(request: Request, user: UserLogin):
    """Login dengan email dan kata sandi. Mengembalikan token JWT."""
    pool = request.app.state.pool
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                "SELECT * FROM USERS WHERE EMAIL=%s", (user.email,)
            )
            rows = await cur.fetchall()
            if not rows:
                raise HTTPException(status_code=401, detail="Email atau kata sandi salah")

            db_user = rows[0]
            if not db_user.get("PASSWORD_HASH"):
                raise HTTPException(
                    status_code=401,
                    detail="Akun ini menggunakan Google login. Silakan login dengan Google.",
                )

            if not verify_password(user.password, db_user["PASSWORD_HASH"]):
                raise HTTPException(status_code=401, detail="Email atau kata sandi salah")

        token = create_jwt_token({
            "sub": str(db_user["ID"]),
            "email": db_user["EMAIL"],
            "role": db_user["ROLE"],
        })
        return {
            "TOKEN": token,
            "PENGGUNA": {
                "ID": db_user["ID"],
                "EMAIL": db_user["EMAIL"],
                "USERNAME": db_user.get("USERNAME", ""),
                "PICTURE": db_user.get("PICTURE", ""),
                "ROLE": db_user["ROLE"],
            },
        }


@app.post("/api/auth/google")
async def google_login(request: Request, data: GoogleLogin):
    """Login/daftar dengan Google OAuth. Mengembalikan token JWT."""
    try:
        google_payload = verify_google_token(data.credential)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token Google tidak valid: {str(e)}")

    google_id = google_payload.get("sub", "")
    email = google_payload.get("email", "")
    name = google_payload.get("name", "")
    picture = google_payload.get("picture", "")

    if not email:
        raise HTTPException(status_code=400, detail="Token Google tidak mengandung email")

    pool = request.app.state.pool
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            # Check if user exists by google_id or email
            if google_id:
                await cur.execute(
                    "SELECT * FROM USERS WHERE GOOGLE_ID=%s", (google_id,)
                )
                rows = await cur.fetchall()
            else:
                rows = []

            if not rows:
                await cur.execute(
                    "SELECT * FROM USERS WHERE EMAIL=%s", (email,)
                )
                rows = await cur.fetchall()

            if rows:
                # Existing user — update google_id if needed, and maybe promote
                db_user = rows[0]
                updates = []
                params = []

                if google_id and not db_user.get("GOOGLE_ID"):
                    updates.append("GOOGLE_ID=%s")
                    params.append(google_id)
                if picture and not db_user.get("PICTURE"):
                    updates.append("PICTURE=%s")
                    params.append(picture)
                if name and not db_user.get("USERNAME"):
                    updates.append("USERNAME=%s")
                    params.append(name)
                # Auto-promote if ADMIN_EMAIL matches
                if (
                    ADMIN_EMAIL
                    and email.lower() == ADMIN_EMAIL.lower()
                    and db_user.get("ROLE") != "admin"
                ):
                    updates.append("ROLE='admin'")

                if updates:
                    params.append(db_user["ID"])
                    await cur.execute(
                        f"UPDATE USERS SET {', '.join(updates)} WHERE ID=%s",
                        params,
                    )
                    await conn.commit()
                    # Re-fetch
                    await cur.execute(
                        "SELECT * FROM USERS WHERE ID=%s", (db_user["ID"],)
                    )
                    db_user = await cur.fetchone()

                token = create_jwt_token({
                    "sub": str(db_user["ID"]),
                    "email": db_user["EMAIL"],
                    "role": db_user["ROLE"],
                })
                return {
                    "TOKEN": token,
                    "PENGGUNA": {
                        "ID": db_user["ID"],
                        "EMAIL": db_user["EMAIL"],
                        "USERNAME": db_user.get("USERNAME", ""),
                        "PICTURE": db_user.get("PICTURE", ""),
                        "ROLE": db_user["ROLE"],
                    },
                }
            else:
                # New user
                role = "admin" if (ADMIN_EMAIL and email.lower() == ADMIN_EMAIL.lower()) else "user"
                await cur.execute(
                    "INSERT INTO USERS (EMAIL, USERNAME, PICTURE, GOOGLE_ID, ROLE) "
                    "VALUES (%s,%s,%s,%s,%s)",
                    (email, name, picture, google_id, role),
                )
                user_id = cur.lastrowid
            await conn.commit()

        token = create_jwt_token({
            "sub": str(user_id),
            "email": email,
            "role": role,
        })
        return {
            "TOKEN": token,
            "PENGGUNA": {
                "ID": user_id,
                "EMAIL": email,
                "USERNAME": name,
                "PICTURE": picture,
                "ROLE": role,
            },
        }


@app.get("/api/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Mengembalikan data pengguna yang sedang login."""
    return {
        "PENGGUNA": {
            "ID": current_user["ID"],
            "EMAIL": current_user["EMAIL"],
            "USERNAME": current_user.get("USERNAME", ""),
            "PICTURE": current_user.get("PICTURE", ""),
            "ROLE": current_user.get("ROLE", ""),
            "CREATED_AT": current_user.get("CREATED_AT", ""),
        }
    }


# ── Routes: Admin ────────────────────────────────────────────────────────
@app.post("/api/admin/create-first-admin")
async def create_first_admin(request: Request, data: CreateFirstAdmin):
    """Buat admin pertama. Hanya bisa digunakan jika belum ada admin sama sekali."""
    pool = request.app.state.pool
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                "SELECT ID FROM USERS WHERE ROLE='admin'"
            )
            existing_admin = await cur.fetchone()
            if existing_admin:
                raise HTTPException(
                    status_code=403,
                    detail="Admin sudah ada. Gunakan endpoint login atau register biasa.",
                )

            # Create admin user
            password_hash_val = hash_password(data.password)
            await cur.execute(
                "INSERT INTO USERS (EMAIL, USERNAME, PASSWORD_HASH, ROLE) VALUES (%s,%s,%s,%s)",
                (data.email, data.name, password_hash_val, "admin"),
            )
            user_id = cur.lastrowid
        await conn.commit()

        token = create_jwt_token({"sub": str(user_id), "email": data.email, "role": "admin"})
        return {
            "TOKEN": token,
            "PESAN": "Admin berhasil dibuat",
            "PENGGUNA": {
                "ID": user_id,
                "EMAIL": data.email,
                "USERNAME": data.name,
                "PICTURE": "",
                "ROLE": "admin",
            },
        }


@app.get("/api/admin/dashboard")
async def admin_dashboard(request: Request, admin: dict = Depends(require_admin)):
    """Dashboard admin: hitung total artikel, pengguna, dsb."""
    pool = request.app.state.pool
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute("SELECT COUNT(*) AS CNT FROM ARTICLES")
            total_articles = await cur.fetchone()

            await cur.execute("SELECT COUNT(*) AS CNT FROM ARTICLES WHERE PUBLISHED=1")
            published_articles = await cur.fetchone()

            await cur.execute("SELECT COUNT(*) AS CNT FROM USERS")
            total_users = await cur.fetchone()

            await cur.execute("SELECT COUNT(*) AS CNT FROM USERS WHERE ROLE='admin'")
            total_admins = await cur.fetchone()

            await cur.execute(
                "SELECT * FROM ARTICLES ORDER BY CREATED_AT DESC LIMIT 10"
            )
            recent_articles = await cur.fetchall()

            await cur.execute(
                "SELECT CATEGORY, MIN(CATEGORY_EMOJI) AS CATEGORY_EMOJI, COUNT(*) AS COUNT "
                "FROM ARTICLES GROUP BY CATEGORY ORDER BY COUNT DESC"
            )
            categories = await cur.fetchall()

        return {
            "DASHBOARD": {
                "TOTAL_ARTIKEL": total_articles["CNT"] if total_articles else 0,
                "ARTIKEL_DITERBITKAN": published_articles["CNT"] if published_articles else 0,
                "TOTAL_PENGGUNA": total_users["CNT"] if total_users else 0,
                "TOTAL_ADMIN": total_admins["CNT"] if total_admins else 0,
            },
            "ARTIKEL_TERBARU": recent_articles,
            "KATEGORI": categories,
        }


@app.get("/api/admin/articles")
async def admin_list_articles(
    request: Request,
    admin: dict = Depends(require_admin),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    published: Optional[int] = Query(None),
):
    """Admin: daftar semua artikel termasuk yang tidak dipublikasikan."""
    pool = request.app.state.pool
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            if published is not None:
                await cur.execute(
                    "SELECT * FROM ARTICLES WHERE PUBLISHED=%s "
                    "ORDER BY CREATED_AT DESC LIMIT %s OFFSET %s",
                    (published, limit, offset),
                )
                rows = await cur.fetchall()
                await cur.execute(
                    "SELECT COUNT(*) AS CNT FROM ARTICLES WHERE PUBLISHED=%s",
                    (published,),
                )
            else:
                await cur.execute(
                    "SELECT * FROM ARTICLES ORDER BY CREATED_AT DESC LIMIT %s OFFSET %s",
                    (limit, offset),
                )
                rows = await cur.fetchall()
                await cur.execute("SELECT COUNT(*) AS CNT FROM ARTICLES")
            count_row = await cur.fetchone()
        total = count_row["CNT"] if count_row else 0
        return {
            "ARTIKEL": rows,
            "TOTAL": total,
            "LIMIT": limit,
            "OFFSET": offset,
        }
