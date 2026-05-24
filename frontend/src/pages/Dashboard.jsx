import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  Trash2, Plus, Loader2, Shield, BarChart3,
  Newspaper, X, AlertCircle, ExternalLink
} from 'lucide-react'

const API = 'https://apigw.notiovation.com/notioportal'

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr + 'Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function Dashboard() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  // Redirect non-admin
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/')
    }
  }, [authLoading, isAdmin, navigate])

  // State
  const [articles, setArticles] = useState([])
  const [stats, setStats] = useState({ total: 0, categories: {} })
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    title: '', summary: '', category: 'Umum',
    insight: '', image_url: '', source_url: ''
  })
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState('')

  const fetchArticles = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/articles?limit=500`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('bk_token')}` }
      })
      const data = await res.json()
      const list = data.ARTICLES || []
      setArticles(list)

      // Compute stats
      const cats = {}
      list.forEach(a => {
        const c = a.CATEGORY || 'Umum'
        cats[c] = (cats[c] || 0) + 1
      })
      setStats({ total: list.length, categories: cats })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && isAdmin) fetchArticles()
  }, [authLoading, isAdmin, fetchArticles])

  const handleCreate = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!form.title.trim() || !form.summary.trim()) {
      setFormError('Judul dan ringkasan wajib diisi')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`${API}/articles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('bk_token')}`
        },
        body: JSON.stringify(form)
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || err.error || 'Gagal membuat artikel')
      }
      setShowForm(false)
      setForm({ title: '', summary: '', category: 'Umum', insight: '', image_url: '', source_url: '' })
      fetchArticles()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    setDeleting(true)
    setActionError('')
    try {
      const res = await fetch(`${API}/articles/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('bk_token')}` }
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || err.error || 'Gagal menghapus artikel')
      }
      setDeleteConfirm(null)
      fetchArticles()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  if (authLoading) {
    return (
      <main className="dashboard-page">
        <div className="state-msg"><Loader2 size={32} className="spin" /><span>Memeriksa akses...</span></div>
      </main>
    )
  }

  if (!isAdmin) return null

  return (
    <main className="dashboard-page">
      <div className="dashboard-header">
        <div className="dashboard-title">
          <Shield size={28} strokeWidth={1.5} />
          <div>
            <h1>Dashboard Admin</h1>
            <p>Kelola konten portal berita</p>
          </div>
        </div>
        <button className="btn-create" onClick={() => { setShowForm(!showForm); setFormError('') }}>
          <Plus size={18} /> Artikel Baru
        </button>
      </div>

      {/* Stats */}
      <div className="dashboard-stats">
        <div className="stat-card">
          <BarChart3 size={20} strokeWidth={1.5} />
          <div>
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Total Artikel</span>
          </div>
        </div>
        {Object.entries(stats.categories).map(([cat, count]) => (
          <div key={cat} className="stat-card">
            <Newspaper size={20} strokeWidth={1.5} />
            <div>
              <span className="stat-value">{count}</span>
              <span className="stat-label">{cat}</span>
            </div>
          </div>
        ))}
      </div>

      {actionError && (
        <div className="auth-error" style={{ marginBottom: 16 }}>
          <AlertCircle size={16} />
          <span>{actionError}</span>
          <button onClick={() => setActionError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}><X size={14} /></button>
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div className="dashboard-form">
          <div className="form-header">
            <h2>Buat Artikel Baru</h2>
            <button onClick={() => setShowForm(false)} className="form-close-btn"><X size={18} /></button>
          </div>
          {formError && (
            <div className="auth-error">
              <AlertCircle size={16} />
              <span>{formError}</span>
            </div>
          )}
          <form onSubmit={handleCreate}>
            <div className="form-row">
              <div className="form-group">
                <label>Judul *</label>
                <input type="text" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Judul artikel..." />
              </div>
              <div className="form-group">
                <label>Kategori</label>
                <select value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  <option>Umum</option><option>Teknologi</option><option>Sains</option>
                  <option>Ekonomi</option><option>Bisnis</option><option>Gaming</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Ringkasan *</label>
              <textarea rows={3} value={form.summary}
                onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
                placeholder="Ringkasan artikel..." />
            </div>
            <div className="form-group">
              <label>Wawasan (Insight)</label>
              <textarea rows={2} value={form.insight}
                onChange={e => setForm(f => ({ ...f, insight: e.target.value }))}
                placeholder="Wawasan/analisis tambahan..." />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>URL Gambar</label>
                <input type="url" value={form.image_url}
                  onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                  placeholder="https://..." />
              </div>
              <div className="form-group">
                <label>URL Sumber</label>
                <input type="url" value={form.source_url}
                  onChange={e => setForm(f => ({ ...f, source_url: e.target.value }))}
                  placeholder="https://..." />
              </div>
            </div>
            <button type="submit" className="btn-create" disabled={submitting}>
              {submitting ? <Loader2 size={18} className="spin" /> : <Plus size={18} />}
              {submitting ? 'Menyimpan...' : 'Simpan Artikel'}
            </button>
          </form>
        </div>
      )}

      {/* Article Table */}
      {loading ? (
        <div className="state-msg" style={{ padding: '40px 20px' }}>
          <Loader2 size={28} className="spin" /><span>Memuat artikel...</span>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Judul</th>
                <th>Kategori</th>
                <th>Tanggal</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {articles.length === 0 ? (
                <tr>
                  <td colSpan="4" className="table-empty">Belum ada artikel</td>
                </tr>
              ) : (
                articles.map(a => (
                  <tr key={a.ID}>
                    <td className="table-title" title={a.TITLE}>
                      <span>{a.TITLE}</span>
                      {a.SLUG && (
                        <a href={`/article/${a.SLUG}`} target="_blank" rel="noopener noreferrer" className="table-link" title="Lihat artikel">
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </td>
                    <td><span className="table-category">{a.CATEGORY}</span></td>
                    <td className="table-date">{formatDate(a.CREATED_AT)}</td>
                    <td>
                      <button
                        className="btn-delete"
                        onClick={() => setDeleteConfirm(a.ID)}
                        title="Hapus artikel"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Konfirmasi Hapus</h3>
            <p>Anda yakin ingin menghapus artikel ini? Tindakan ini tidak dapat dibatalkan.</p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setDeleteConfirm(null)} disabled={deleting}>
                Batal
              </button>
              <button className="btn-delete-confirm" onClick={() => handleDelete(deleteConfirm)} disabled={deleting}>
                {deleting ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />}
                {deleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
