import { useState, useEffect } from 'react'
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, Sun, Moon, Bookmark, Search, LogOut, User as UserIcon, Shield } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import Home from './pages/Home'
import ArticleDetail from './pages/ArticleDetail'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import './App.css'

export default function App() {
  const { user, loading, logout, isAdmin } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  // Theme
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light'
    return localStorage.getItem('theme') || 'light'
  })
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
    // Update theme-color meta
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.content = theme === 'dark' ? '#0a0a0f' : '#1d1d1f'
  }, [theme])

  // Search + bookmarks state (for header, used by Home page too)
  const [search, setSearch] = useState('')
  const [view, setView] = useState('all')
  const [bookmarks, setBookmarks] = useState([])
  useEffect(() => {
    try {
      const raw = localStorage.getItem('bkp_bookmarks')
      if (raw) setBookmarks(JSON.parse(raw))
    } catch {}
  }, [])

  // Listen for bookmark changes from Home
  useEffect(() => {
    const checkBookmarks = () => {
      try {
        const raw = localStorage.getItem('bkp_bookmarks')
        if (raw) setBookmarks(JSON.parse(raw))
      } catch {}
    }
    window.addEventListener('storage', checkBookmarks)
    const interval = setInterval(checkBookmarks, 2000)
    return () => {
      window.removeEventListener('storage', checkBookmarks)
      clearInterval(interval)
    }
  }, [])

  const isHome = location.pathname === '/'

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="app">
      <a href="#main-content" className="skip-link">Lewati ke konten utama</a>

      <header className="header" role="banner">
        <div className="header-content">
          <Link to="/" className="header-brand" aria-label="Portal Notiovation — Beranda">
            <BookOpen size={28} strokeWidth={1.5} aria-hidden="true" />
            <div>
              <h1>Portal Notiovation</h1>
              <p>Wawasan luas, otomatis tiap 3 jam</p>
            </div>
          </Link>

          <nav className="header-actions" role="navigation" aria-label="Navigasi utama">
            {isHome && (
              <>
                <div className="search-box" role="search">
                  <label htmlFor="search-input" className="sr-only">Cari artikel</label>
                  <Search size={16} strokeWidth={2} className="search-icon" aria-hidden="true" />
                  <input id="search-input" type="search" placeholder="Cari artikel..." value={search}
                    onChange={e => { setSearch(e.target.value); setView('all') }}
                    aria-label="Cari artikel" />
                  {search && <button className="search-clear" onClick={() => setSearch('')} aria-label="Hapus pencarian">&times;</button>}
                </div>
                <button className={`header-tab ${view === 'bookmarks' ? 'active' : ''}`}
                  onClick={() => { setView(view === 'bookmarks' ? 'all' : 'bookmarks'); setSearch('') }}
                  aria-label={view === 'bookmarks' ? 'Tampilkan semua artikel' : `Bookmarks (${bookmarks.length} tersimpan)`}
                  aria-pressed={view === 'bookmarks'}
                  title="Bookmarks">
                  <Bookmark size={18} fill={view === 'bookmarks' ? '#fff' : 'none'} aria-hidden="true" />
                  {bookmarks.length > 0 && <span className="badge" aria-hidden="true">{bookmarks.length}</span>}
                </button>
              </>
            )}

            <button className="theme-btn" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              aria-label={theme === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}>
              {theme === 'dark' ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
            </button>

            {/* User menu */}
            {!loading && (
              <>
                {user ? (
                  <div className="user-menu">
                    <button className="user-avatar" title={user.USERNAME || user.EMAIL} aria-label={`Akun ${user.USERNAME || user.EMAIL}`} aria-expanded="false">
                      <UserIcon size={16} aria-hidden="true" />
                    </button>
                    <div className="user-dropdown" role="menu">
                      <span className="user-name" role="menuitem">{user.USERNAME || user.EMAIL}</span>
                      {isAdmin && (
                        <Link to="/dashboard" className="user-link" role="menuitem">
                          <Shield size={14} aria-hidden="true" /> Dashboard
                        </Link>
                      )}
                      <button onClick={handleLogout} className="user-link" role="menuitem">
                        <LogOut size={14} aria-hidden="true" /> Keluar
                      </button>
                    </div>
                  </div>
                ) : (
                  <Link to="/login" className="btn-login">
                    Masuk
                  </Link>
                )}
              </>
            )}
          </nav>
        </div>
      </header>

      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          id="main-content"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          <Routes location={location}>
            <Route path="/" element={<Home search={search} setSearch={setSearch} view={view} setView={setView} bookmarks={bookmarks} setBookmarks={setBookmarks} />} />
            <Route path="/article/:slug" element={<ArticleDetail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        </motion.div>
      </AnimatePresence>

      <footer className="footer" role="contentinfo">
        <p>Portal Notiovation · Powered by Notiovation · Update tiap 3 jam</p>
      </footer>
    </div>
  )
}
