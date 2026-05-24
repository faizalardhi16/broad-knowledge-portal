import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { ArrowLeft, Clock, ExternalLink, Lightbulb, Tag } from 'lucide-react'
import { SkeletonDetail } from '../components/SkeletonCard'

const API = 'https://apigw.notiovation.com/notioportal'
const SKELETON_DELAY = 400

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'Z')
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDateISO(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr + 'Z').toISOString()
}

export default function ArticleDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showSkeleton, setShowSkeleton] = useState(false)
  const aborterRef = useRef(null)
  const skeletonTimer = useRef(null)

  const fetchArticle = useCallback(async () => {
    if (aborterRef.current) aborterRef.current.abort()
    const controller = new AbortController()
    aborterRef.current = controller

    setLoading(true)
    setError(null)
    setShowSkeleton(false)

    if (skeletonTimer.current) clearTimeout(skeletonTimer.current)
    skeletonTimer.current = setTimeout(() => setShowSkeleton(true), SKELETON_DELAY)

    try {
      const res = await fetch(`${API}/articles/slug/${encodeURIComponent(slug)}`, {
        signal: controller.signal
      })
      if (!res.ok) {
        if (res.status === 404) throw new Error('Artikel tidak ditemukan')
        throw new Error('Gagal memuat artikel')
      }
      const data = await res.json()
      setArticle(data)
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('Fetch article failed:', e)
        setError(e.message)
      }
    } finally {
      setLoading(false)
      setShowSkeleton(false)
      if (skeletonTimer.current) clearTimeout(skeletonTimer.current)
    }
  }, [slug])

  useEffect(() => {
    fetchArticle()
    return () => {
      if (aborterRef.current) aborterRef.current.abort()
      if (skeletonTimer.current) clearTimeout(skeletonTimer.current)
    }
  }, [fetchArticle])

  if (loading && showSkeleton) return <SkeletonDetail />

  if (loading) {
    return (
      <main className="detail-page">
        <div className="state-msg"><span>Memuat artikel...</span></div>
      </main>
    )
  }

  if (error || !article) {
    return (
      <main className="detail-page">
        <div className="state-msg">
          <span>{error || 'Artikel tidak ditemukan'}</span>
          <button className="btn-back" onClick={() => navigate('/')}>
            <ArrowLeft size={16} /> Kembali ke Beranda
          </button>
        </div>
      </main>
    )
  }

  const pageUrl = `https://portal.notiovation.com/article/${article.SLUG}`
  const pageTitle = `${article.TITLE} — Portal Notiovation`
  const pageDesc = article.SUMMARY?.replace(/\n\n/g, ' ').slice(0, 160) || article.TITLE
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.TITLE,
    description: pageDesc,
    url: pageUrl,
    image: article.IMAGE_URL || undefined,
    datePublished: formatDateISO(article.CREATED_AT),
    dateModified: formatDateISO(article.CREATED_AT),
    author: {
      '@type': 'Organization',
      name: 'Portal Notiovation',
      url: 'https://portal.notiovation.com'
    },
    publisher: {
      '@type': 'Organization',
      name: 'Portal Notiovation',
      url: 'https://portal.notiovation.com'
    },
    inLanguage: 'id',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': pageUrl
    }
  }

  return (
    <main className="detail-page">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <meta name="keywords" content={`${article.CATEGORY}, berita ${article.CATEGORY.toLowerCase()}, broad knowledge, wawasan`} />
        <link rel="canonical" href={pageUrl} />

        {/* Open Graph */}
        <meta property="og:type" content="article" />
        <meta property="og:title" content={article.TITLE} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:url" content={pageUrl} />
        {article.IMAGE_URL && <meta property="og:image" content={article.IMAGE_URL} />}
        <meta property="article:published_time" content={formatDateISO(article.CREATED_AT)} />
        <meta property="article:section" content={article.CATEGORY} />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={article.TITLE} />
        <meta name="twitter:description" content={pageDesc} />
        {article.IMAGE_URL && <meta name="twitter:image" content={article.IMAGE_URL} />}

        {/* JSON-LD */}
        <script type="application/ld+json">
          {JSON.stringify(articleJsonLd)}
        </script>
      </Helmet>

      <button className="btn-back" onClick={() => navigate('/')}>
        <ArrowLeft size={18} /> Kembali
      </button>

      {article.IMAGE_URL && (
        <div className="detail-image">
          <img src={article.IMAGE_URL} alt={article.TITLE} />
        </div>
      )}

      <div className="detail-content">
        <div className="detail-meta">
          <span className="detail-category">
            <Tag size={14} strokeWidth={2} />
            {article.CATEGORY}
          </span>
          <span className="detail-date">
            <Clock size={13} /> {formatDate(article.CREATED_AT)}
          </span>
        </div>

        <h1 className="detail-title">{article.TITLE}</h1>

        <div className="detail-summary">
          {article.SUMMARY?.split('\n').filter(p => p.trim()).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        {article.INSIGHT && (
          <div className="detail-insight">
            <Lightbulb size={18} strokeWidth={2} />
            <div>
              <strong>Wawasan</strong>
              <p>{article.INSIGHT}</p>
            </div>
          </div>
        )}

        {article.SOURCE_URL && (
          <a
            className="detail-source-btn"
            href={article.SOURCE_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={16} /> Baca Sumber Asli
          </a>
        )}
      </div>
    </main>
  )
}
