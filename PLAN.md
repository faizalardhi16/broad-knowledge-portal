# Portal — Slug + Dashboard + Auth Plan

## Arsitektur Sekarang
```
Container (port 8088)
├── nginx (port 80)
│   ├── /           → SPA (React build) fallback to index.html
│   └── /api/*      → proxy to FastAPI (port 8000)
└── FastAPI (port 8000)
    └── SQLite (/data/news.db)
```

## 1. Slug & Detail Halaman
### Backend
- Tambah kolom `slug TEXT UNIQUE` ke tabel articles
- Generate slug otomatis dari title: lowercase, alphanumeric+hyphen, append number kalau duplikat
- Endpoint baru: `GET /api/articles/slug/{slug}` → return full article
- Update POST/POST bulk untuk auto-generate slug

### Frontend
- Install `react-router-dom`
- Bikin 2 halaman: Home (yang sekarang) + ArticleDetail
- Route:
  - `/` → Home (grid artikel)
  - `/article/:slug` → ArticleDetail
- ArticleCard: klik card/title → navigate ke `/article/:slug`
- ArticleDetail: tampilkan full article (title, image, summary, insight, source link, category, date)

## 2. Dashboard + Auth
### Backend
- Tambah tabel `users`:
  - id, email (unique), name, picture, password_hash, role ('admin'|'user'), created_at
- JWT auth (python-jose):
  - `POST /api/auth/register` → buat user (email + password)
  - `POST /api/auth/login` → login (email + password) → return JWT
  - `POST /api/auth/google` → terima Google ID token → verify → find/create user → return JWT
  - `GET /api/auth/me` → return current user (butuh JWT)
- Admin middleware: `require_admin` dependency
- Admin CRUD (butuh auth):
  - `POST /api/admin/articles` (sudah ada, tambahin admin check)
  - `DELETE /api/articles/{id}` (baru)

### Frontend
- AuthContext: simpan token di localStorage, state user
- Pages baru:
  - `/login` → Login page (email/password + Google button)
  - `/register` → Register page
  - `/dashboard` → Admin dashboard (kelola artikel)
- Google Sign-In: pakai `@react-oauth/google` library
- Header: tambahin user menu (login/logout/avatar)
- Protected routes: `/dashboard` cuma admin

## File Changes
### Backend
- `backend/main.py` — restruktur besar
- `backend/auth.py` — baru: auth logic
- `backend/requirements.txt` — baru: python-jose, google-auth

### Frontend
- `frontend/package.json` — tambah: react-router-dom, @react-oauth/google
- `frontend/src/main.jsx` — wrap dg BrowserRouter
- `frontend/src/App.jsx` — routing
- `frontend/src/context/AuthContext.jsx` — baru
- `frontend/src/pages/Home.jsx` — rename dari App content
- `frontend/src/pages/ArticleDetail.jsx` — baru
- `frontend/src/pages/Login.jsx` — baru
- `frontend/src/pages/Register.jsx` — baru
- `frontend/src/pages/Dashboard.jsx` — baru
- `frontend/src/components/ArticleCard.jsx` — update link

## Eksekusi
Gunakan 2 subagent paralel:
1. Subagent backend: semua perubahan Python
2. Subagent frontend: semua perubahan React

Lalu build Docker & deploy.
