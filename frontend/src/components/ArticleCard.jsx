import { Link } from 'react-router-dom'
import { ExternalLink, Clock, Lightbulb, Bookmark } from 'lucide-react'
import { Cpu, FlaskConical, TrendingUp, Briefcase, Gamepad2, Sparkles } from 'lucide-react'

const iconMap = { cpu: Cpu, 'flask-conical': FlaskConical, 'trending-up': TrendingUp, briefcase: Briefcase, 'gamepad-2': Gamepad2, sparkles: Sparkles }
const categoryIcons = { Teknologi: 'cpu', Sains: 'flask-conical', Ekonomi: 'trending-up', Bisnis: 'briefcase', Gaming: 'gamepad-2', Umum: 'sparkles' }

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'Z')
  const diff = Date.now() - d
  if (diff < 3600000) return Math.floor(diff / 60000) + ' mnt'
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' jam'
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function ArticleCard({ article, isBookmarked, onToggleBookmark }) {
  const iconName = categoryIcons[article.CATEGORY] || 'sparkles'
  const Icon = iconMap[iconName] || Sparkles

  return (
    <article className={`card ${isBookmarked ? 'bookmarked' : ''}`}>
      <div className="card-top">
        <span className="card-category">
          <Icon size={14} strokeWidth={2} />
          {article.CATEGORY}
        </span>
        <button
          className={`bookmark-btn ${isBookmarked ? 'active' : ''}`}
          onClick={() => onToggleBookmark(article.ID)}
          title={isBookmarked ? 'Hapus bookmark' : 'Simpan'}
          aria-label={isBookmarked ? 'Hapus bookmark' : 'Tambah bookmark'}
        >
          <Bookmark size={16} fill={isBookmarked ? 'currentColor' : 'none'} />
        </button>
      </div>

      {article.IMAGE_URL && (
        <Link to={article.SLUG ? `/article/${article.SLUG}` : '#'} className="card-image-link">
          <div className="card-image">
            <img src={article.IMAGE_URL} alt={article.TITLE} loading="lazy" />
          </div>
        </Link>
      )}

      <h2 className="card-title">
        {article.SLUG ? (
          <Link to={`/article/${article.SLUG}`}>{article.TITLE}</Link>
        ) : article.SOURCE_URL ? (
          <a href={article.SOURCE_URL} target="_blank" rel="noopener noreferrer">{article.TITLE}</a>
        ) : article.TITLE}
      </h2>

      <p className="card-summary">{article.SUMMARY?.length > 75 ? article.SUMMARY.slice(0, 75) + '...' : article.SUMMARY}</p>

      {article.INSIGHT && (
        <div className="card-insight">
          <Lightbulb size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
          {article.INSIGHT}
        </div>
      )}

      <div className="card-footer">
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={12} /> {formatDate(article.CREATED_AT)}
        </span>
        {article.SOURCE_URL && (
          <a className="card-source" href={article.SOURCE_URL} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={12} /> Sumber
          </a>
        )}
      </div>
    </article>
  )
}
