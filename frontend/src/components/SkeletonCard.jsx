import { motion } from 'framer-motion'

/** Skeleton card yang mimic bentuk ArticleCard */
export default function SkeletonCard({ index = 0 }) {
  return (
    <motion.article
      className="card skeleton-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      <div className="skeleton-row">
        <div className="skeleton skeleton-badge" />
        <div className="skeleton skeleton-icon" />
      </div>
      <div className="skeleton skeleton-image" />
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-text" />
      <div className="skeleton skeleton-text short" />
      <div className="skeleton skeleton-insight" />
      <div className="skeleton-row" style={{ marginTop: 4 }}>
        <div className="skeleton skeleton-footer" />
        <div className="skeleton skeleton-footer short" />
      </div>
    </motion.article>
  )
}

/** Skeleton untuk halaman detail artikel */
export function SkeletonDetail() {
  return (
    <main className="detail-page">
      <div className="skeleton skeleton-btn" style={{ width: 120, height: 40, marginBottom: 16 }} />
      <div className="skeleton skeleton-image" style={{ maxHeight: 420, height: 300, borderRadius: 'var(--radius)', marginBottom: 24 }} />
      <div className="skeleton-row" style={{ gap: 12, marginBottom: 12 }}>
        <div className="skeleton skeleton-badge" style={{ width: 100 }} />
        <div className="skeleton skeleton-footer" style={{ width: 140 }} />
      </div>
      <div className="skeleton skeleton-title" style={{ height: 40, marginBottom: 8 }} />
      <div className="skeleton skeleton-title" style={{ height: 40, width: '60%', marginBottom: 20 }} />
      {[...Array(5)].map((_, i) => (
        <div className="skeleton skeleton-text" key={i} style={{ marginBottom: 10 }} />
      ))}
      <div className="skeleton skeleton-text short" style={{ marginBottom: 24 }} />
      <div className="skeleton skeleton-insight" style={{ height: 80 }} />
    </main>
  )
}
