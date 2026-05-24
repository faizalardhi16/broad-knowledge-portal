import { Cpu, FlaskConical, TrendingUp, Briefcase, Gamepad2, Sparkles, Layers } from 'lucide-react'

const iconMap = {
  cpu: Cpu,
  'flask-conical': FlaskConical,
  'trending-up': TrendingUp,
  briefcase: Briefcase,
  'gamepad-2': Gamepad2,
  sparkles: Sparkles,
}

export default function FilterBar({ categories, active, onSelect, icons }) {
  return (
    <nav className="filter-bar">
      <button
        className={`filter-btn ${active === '' ? 'active' : ''}`}
        onClick={() => onSelect('')}
      >
        <Layers size={15} strokeWidth={2} />
        Semua
      </button>
      {categories.map(c => {
        const iconName = icons[c.CATEGORY] || 'sparkles'
        const Icon = iconMap[iconName] || Sparkles
        return (
          <button
            key={c.CATEGORY}
            className={`filter-btn ${active === c.CATEGORY ? 'active' : ''}`}
            onClick={() => onSelect(c.CATEGORY)}
          >
            <Icon size={15} strokeWidth={2} />
            {c.CATEGORY}
            <span style={{ opacity: 0.5, fontSize: '0.72rem' }}>{c.COUNT}</span>
          </button>
        )
      })}
    </nav>
  )
}
