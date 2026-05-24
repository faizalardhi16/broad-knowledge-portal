import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Clock, Tag } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const API = 'https://apigw.notiovation.com/notioportal'
const AUTO_ROTATE_MS = 5000

export default function FeaturedCarousel() {
  const [featured, setFeatured] = useState([])
  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(true)
  const timerRef = useRef(null)
  const aborterRef = useRef(null)

  const fetchFeatured = useCallback(async () => {
    // Cancel previous request
    if (aborterRef.current) aborterRef.current.abort()
    const controller = new AbortController()
    aborterRef.current = controller

    try {
      const res = await fetch(`${API}/articles?limit=5`, { signal: controller.signal })
      const data = await res.json()
      const articles = (data.ARTICLES || []).slice(0, 5)
      // Sort by newest
      articles.sort((a, b) => (b.CREATED_AT || '').localeCompare(a.CREATED_AT || ''))
      setFeatured(articles)
    } catch (e) {
      if (e.name !== 'AbortError') console.error('Carousel fetch failed:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFeatured()
    return () => {
      if (aborterRef.current) aborterRef.current.abort()
    }
  }, [fetchFeatured])

  // Auto-rotate
  useEffect(() => {
    if (featured.length <= 1) return
    timerRef.current = setInterval(() => {
      setCurrent(prev => (prev + 1) % featured.length)
    }, AUTO_ROTATE_MS)
    return () => clearInterval(timerRef.current)
  }, [featured.length])

  const goTo = useCallback((idx) => {
    setCurrent(idx)
    // Reset timer
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCurrent(prev => (prev + 1) % featured.length)
    }, AUTO_ROTATE_MS)
  }, [featured.length])

  const goPrev = () => goTo((current - 1 + featured.length) % featured.length)
  const goNext = () => goTo((current + 1) % featured.length)

  if (loading) {
    return (
      <div className="carousel-wrapper">
        <div className="carousel skeleton-carousel">
          <div className="skeleton" style={{ width: '100%', height: 320, borderRadius: 'var(--radius)' }} />
        </div>
      </div>
    )
  }

  if (featured.length === 0) return null

  const article = featured[current]

  function formatDate(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr + 'Z')
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="carousel-wrapper">
      <div className="carousel">
        <AnimatePresence mode="wait">
          <motion.div
            key={article.ID}
            className="carousel-slide"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
          >
            <div className="carousel-bg">
              {article.IMAGE_URL && (
                <img src={article.IMAGE_URL} alt="" className="carousel-bg-img" />
              )}
              <div className="carousel-overlay" />
            </div>
            <div className="carousel-content">
              <span className="carousel-category">
                <Tag size={12} /> {article.CATEGORY}
              </span>
              <h2 className="carousel-title">
                <Link to={`/article/${article.SLUG}`}>{article.TITLE}</Link>
              </h2>
              <p className="carousel-summary">
                {article.SUMMARY?.length > 160 ? article.SUMMARY.slice(0, 160) + '...' : article.SUMMARY}
              </p>
              <div className="carousel-meta">
                <Clock size={12} /> {formatDate(article.CREATED_AT)}
                <Link to={`/article/${article.SLUG}`} className="carousel-readmore">
                  Baca selengkapnya →
                </Link>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {featured.length > 1 && (
          <>
            <button className="carousel-arrow carousel-arrow-left" onClick={goPrev} aria-label="Sebelumnya">
              <ChevronLeft size={24} />
            </button>
            <button className="carousel-arrow carousel-arrow-right" onClick={goNext} aria-label="Selanjutnya">
              <ChevronRight size={24} />
            </button>
            <div className="carousel-dots">
              {featured.map((_, i) => (
                <button
                  key={i}
                  className={`carousel-dot ${i === current ? 'active' : ''}`}
                  onClick={() => goTo(i)}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
