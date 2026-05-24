import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Helmet } from 'react-helmet-async'
import { BookOpen, Bookmark, ChevronDown } from 'lucide-react'
import FilterBar from '../components/FilterBar'
import ArticleCard from '../components/ArticleCard'
import SkeletonCard from '../components/SkeletonCard'
import FeaturedCarousel from '../components/FeaturedCarousel'
import '../App.css'

const API = 'https://apigw.notiovation.com/notioportal'
const SKELETON_DELAY = 400
const PER_PAGE = 10

export default function Home({ search, setSearch, view, setView, bookmarks, setBookmarks }) {
  const [articles, setArticles] = useState(null)
  const [categories, setCategories] = useState([])
  const [activeCategory, setActiveCategory] = useState('')
  const [showSkeleton, setShowSkeleton] = useState(false)
  const [visibleCount, setVisibleCount] = useState(PER_PAGE)

  // Refs for cleanup — NEVER put these in useCallback deps
  const skeletonTimer = useRef(null)
  const articlesAborter = useRef(null)
  const catsAborter = useRef(null)
  const hasInitiallyLoaded = useRef(false)

  // Hydrate bookmarks from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('bkp_bookmarks')
      if (raw && (!bookmarks || bookmarks.length === 0)) {
        setBookmarks?.(JSON.parse(raw))
      }
    } catch { /* ignore */ }
    return () => {
      // Cleanup on unmount
      if (articlesAborter.current) articlesAborter.current.abort()
      if (catsAborter.current) catsAborter.current.abort()
      if (skeletonTimer.current) clearTimeout(skeletonTimer.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset visible count when filter, search, or view changes
  useEffect(() => {
    setVisibleCount(PER_PAGE)
  }, [activeCategory, search, view])

  // Persist bookmarks
  useEffect(() => {
    if (bookmarks) {
      localStorage.setItem('bkp_bookmarks', JSON.stringify(bookmarks))
    }
  }, [bookmarks])

  const fetchArticles = useCallback(async () => {
    // Cancel previous in-flight request
    if (articlesAborter.current) articlesAborter.current.abort()
    const controller = new AbortController()
    articlesAborter.current = controller

    // Show skeleton after 400ms if still loading
    setShowSkeleton(false)
    if (skeletonTimer.current) clearTimeout(skeletonTimer.current)
    skeletonTimer.current = setTimeout(() => {
      // Only show skeleton if we haven't loaded yet
      if (!hasInitiallyLoaded.current) setShowSkeleton(true)
    }, SKELETON_DELAY)

    const url = activeCategory
      ? `${API}/articles?category=${encodeURIComponent(activeCategory)}&limit=200`
      : `${API}/articles?limit=200`

    try {
      const res = await fetch(url, { signal: controller.signal })
      const data = await res.json()
      setArticles(data.ARTICLES || [])
      hasInitiallyLoaded.current = true
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('Fetch articles failed:', e)
        setArticles([])
      }
    } finally {
      if (skeletonTimer.current) clearTimeout(skeletonTimer.current)
      setShowSkeleton(false)
    }
  }, [activeCategory]) // ✅ Only activeCategory — NO articles!

  const fetchCategories = useCallback(async () => {
    if (catsAborter.current) catsAborter.current.abort()
    const controller = new AbortController()
    catsAborter.current = controller

    try {
      const res = await fetch(`${API}/categories`, { signal: controller.signal })
      const data = await res.json()
      setCategories(data.KATEGORI || [])
    } catch (e) {
      if (e.name !== 'AbortError') console.error('Fetch categories failed:', e)
    }
  }, []) // ✅ Empty deps — fetch once

  useEffect(() => {
    fetchArticles()
    return () => {
      if (articlesAborter.current) articlesAborter.current.abort()
      if (skeletonTimer.current) clearTimeout(skeletonTimer.current)
    }
  }, [fetchArticles])

  useEffect(() => {
    fetchCategories()
    return () => {
      if (catsAborter.current) catsAborter.current.abort()
    }
  }, [fetchCategories])

  const toggleBookmark = (id) => {
    setBookmarks?.(prev => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id])
  }

  const filtered = useMemo(() => {
    if (!articles) return null
    let list = articles
    if (view === 'bookmarks') list = list.filter(a => bookmarks?.includes(a.ID))
    if (search?.trim()) {
      const q = search.toLowerCase()
      list = list.filter(a =>
        (a.TITLE || '').toLowerCase().includes(q) ||
        (a.SUMMARY || '').toLowerCase().includes(q) ||
        (a.CATEGORY || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [articles, search, view, bookmarks])

  const displayed = filtered ? filtered.slice(0, visibleCount) : null
  const hasMore = filtered && visibleCount < filtered.length
  const remaining = filtered ? filtered.length - visibleCount : 0

  const catIcons = { Teknologi: 'cpu', Sains: 'flask-conical', Ekonomi: 'trending-up', Bisnis: 'briefcase', Gaming: 'gamepad-2', Umum: 'sparkles' }

  const isLoading = articles === null || (showSkeleton && articles === null)

  const loadMore = () => {
    setVisibleCount(prev => Math.min(prev + PER_PAGE, filtered?.length || prev))
  }

  return (
    <>
      <Helmet>
        <title>Portal Notiovation — Wawasan Luas Setiap Hari</title>
        <meta name="description" content="Portal berita dan wawasan otomatis yang diperbarui setiap 3 jam. Teknologi, Sains, Ekonomi, Bisnis, Gaming, dan insight terbaru dari seluruh dunia — dalam Bahasa Indonesia." />
        <meta property="og:title" content="Portal Notiovation — Wawasan Luas Setiap Hari" />
        <meta property="og:description" content="Portal berita dan wawasan otomatis — update tiap 3 jam." />
        <meta property="og:url" content="https://portal.notiovation.com/" />
        <link rel="canonical" href="https://portal.notiovation.com/" />
      </Helmet>

      {/* Featured Carousel — only on main view */}
      {view === 'all' && !activeCategory && !search?.trim() && <FeaturedCarousel />}

      {view === 'all' && <FilterBar categories={categories} active={activeCategory}
        onSelect={c => { setActiveCategory(c); setSearch?.('') }} icons={catIcons} />}
      {view === 'bookmarks' && (
        <div className="bookmarks-banner">
          <Bookmark size={16} />
          <span>{bookmarks?.length || 0} artikel tersimpan</span>
          <button onClick={() => setView?.('all')}>Lihat semua →</button>
        </div>
      )}

      <main className="grid" role="main" aria-label="Daftar artikel">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={`sk-${i}`} index={i} />)
        ) : !displayed || displayed.length === 0 ? (
          <div className="state-msg"><BookOpen size={40} strokeWidth={1} /><span>
            {view === 'bookmarks' ? 'Belum ada artikel yang dibookmark.' :
             search ? `Tidak ada hasil untuk "${search}"` :
             'Belum ada artikel. Tunggu research berikutnya!'}
          </span></div>
        ) : (
          <>
            {displayed.map(a => <ArticleCard key={a.ID} article={a}
              isBookmarked={bookmarks?.includes(a.ID)} onToggleBookmark={toggleBookmark} />)}
            {hasMore && (
              <div className="load-more-wrapper">
                <button className="btn-load-more" onClick={loadMore} aria-label={`Muat lebih banyak, ${remaining} artikel tersisa`}>
                  <ChevronDown size={16} />
                  Muat lebih banyak ({remaining} artikel lagi)
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </>
  )
}
