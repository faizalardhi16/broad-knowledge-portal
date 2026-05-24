// ═══════════════════════════════════════════════════════════════
// Broad Knowledge Portal — Frontend Logic
// ═══════════════════════════════════════════════════════════════

const API_BASE = window.location.origin + '/api';
let currentCategory = '';
let articlesCache = [];

// ── Init ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadArticles();
  loadCategories();
});

// ── Theme ──────────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
}

// ── Fetch ──────────────────────────────────────────────────────
async function loadArticles(category = '') {
  const grid = document.getElementById('articles-grid');
  grid.innerHTML = '<div class="loading">🔄 Memuat artikel...</div>';

  let url = `${API_BASE}/articles?limit=100`;
  if (category) url += `&category=${encodeURIComponent(category)}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    articlesCache = data.articles || [];
    renderArticles(articlesCache);
  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><span class="icon">⚠️</span>Gagal memuat artikel.<br><small>${err.message}</small></div>`;
  }
}

async function loadCategories() {
  try {
    const res = await fetch(`${API_BASE}/categories`);
    const data = await res.json();
    const bar = document.getElementById('filter-bar');
    const buttons = data.categories.map(c =>
      `<button class="filter-btn" onclick="filterCategory('${escapeHtml(c.category)}')">${c.category_emoji} ${c.category} <span style="opacity:0.6">${c.count}</span></button>`
    );
    bar.innerHTML = '<button class="filter-btn active" onclick="filterCategory(\'\')">📚 Semua</button>' + buttons.join('');
  } catch (err) {
    console.error('Failed to load categories:', err);
  }
}

// ── Render ─────────────────────────────────────────────────────
function renderArticles(articles) {
  const grid = document.getElementById('articles-grid');
  if (!articles.length) {
    grid.innerHTML = '<div class="empty-state"><span class="icon">📭</span>Belum ada artikel nih. Tunggu research berikutnya ya!</div>';
    return;
  }

  grid.innerHTML = articles.map(a => `
    <article class="article-card">
      <span class="card-category">${a.category_emoji} ${a.category}</span>
      <h2 class="card-title">
        ${a.source_url ? `<a href="${escapeHtml(a.source_url)}" target="_blank" rel="noopener">${escapeHtml(a.title)}</a>` : escapeHtml(a.title)}
      </h2>
      <p class="card-summary">${escapeHtml(a.summary)}</p>
      ${a.insight ? `<div class="card-insight">💡 ${escapeHtml(a.insight)}</div>` : ''}
      <div class="card-footer">
        <span>🕒 ${formatDate(a.created_at)}</span>
        ${a.source_url ? `<a class="card-source" href="${escapeHtml(a.source_url)}" target="_blank" rel="noopener">🔗 Sumber</a>` : ''}
      </div>
    </article>
  `).join('');
}

// ── Filter ─────────────────────────────────────────────────────
function filterCategory(cat) {
  currentCategory = cat;
  document.querySelectorAll('.filter-btn').forEach(b => {
    b.classList.toggle('active', b.textContent.includes(cat) || (cat === '' && b.textContent.includes('Semua')));
  });
  loadArticles(cat);
}

// ── Helpers ────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'Z');
  const now = new Date();
  const diff = now - d;
  if (diff < 3600000) return Math.floor(diff / 60000) + ' menit lalu';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' jam lalu';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}
