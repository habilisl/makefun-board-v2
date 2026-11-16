// Shared by the bounty, leaderboard, and profile pages. Loaded only after the board,
// via the router's dynamic import of those pages.

const API = 'https://make.fun/api/';

function loadCss() {
  if (typeof document === 'undefined') return Promise.resolve();
  if (document.getElementById('page-css')) return Promise.resolve();
  const href = new URL('./page.css', import.meta.url).href;
  return fetch(href).then(r => (r.ok ? r.text() : '')).then(t => {
    if (!t || document.getElementById('page-css')) return;
    const s = document.createElement('style');
    s.id = 'page-css';
    s.textContent = t;
    document.head.appendChild(s);
  }).catch(() => {});
}

export const cssReady = loadCss();

const stamps = new WeakMap();
const clocks = new WeakMap();

export function pathNow() {
  let path = '/';
  try { path = decodeURIComponent(location.hash.slice(1) || '/'); } catch { /* keep / */ }
  return path.replace(/\/+$/, '') || '/';
}

/** Ignore a response that belongs to a route the reader already left. */
export function claim(root, want) {
  const v = (stamps.get(root) || 0) + 1;
  stamps.set(root, v);
  return () => root.isConnected && stamps.get(root) === v && pathNow() === want;
}

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
}

export function api(path) {
  return API + path;
}

export async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) {
    const e = new Error(String(r.status));
    e.status = r.status;
    throw e;
  }
  return r.json();
}

export function usd(v) {
  const n = +v;
  if (!Number.isFinite(n)) return '—';
  const cents = Math.round(Math.abs(n) * 100) % 100;
  return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

export function num(v) {
  const n = +v;
  return Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '0';
}

/** A bounty takes entries until its deadline, whether or not status still says open. */
export function entriesOpen(deadline) {
  return new Date(deadline).getTime() > Date.now();
}

export function entriesLabel(deadline) {
  return entriesOpen(deadline) ? 'Taking entries' : 'Entries closed';
}

export function left(iso) {
  const ms = new Date(iso) - Date.now();
  if (!(ms > 0)) return 'Ended';
  const s = ms / 1000 | 0;
  const d = s / 86400 | 0;
  const p = n => String(n).padStart(2, '0');
  return (d ? d + 'd ' : '') + p(s / 3600 % 24 | 0) + ':' + p(s / 60 % 60 | 0) + ':' + p(s % 60);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function when(iso) {
  const d = new Date(iso);
  if (Number.isNaN(+d)) return '—';
  const p = n => String(n).padStart(2, '0');
  const h = d.getUTCHours();
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}, ${h % 12 || 12}:${p(d.getUTCMinutes())} ${h < 12 ? 'AM' : 'PM'} UTC`;
}

/**
 * Judge win rate is a micro-unit: 950587 means 95.06%.
 * Return only the percentage. Callers must not print the raw score.
 */
export function pct(micro) {
  if (micro == null || micro === '') return '—';
  const n = Number(micro);
  if (!Number.isFinite(n)) return '—';
  const sign = n < 0 ? '-' : '';
  const hundredths = Math.round(Math.abs(n) / 100);
  const whole = Math.trunc(hundredths / 100);
  const frac = String(hundredths % 100).padStart(2, '0');
  return sign + whole.toLocaleString('en-US') + '.' + frac + '%';
}

export function isWin(col) {
  if (!col) return false;
  const src = String(col.source || '');
  const title = String(col.title || '');
  return src.endsWith('win_rate_micro') || /^judge win rate$/i.test(title);
}

export function scoreCols(lb) {
  const cols = (lb && lb.columns || []).filter(c => c && !c.hidden && c.key);
  const win = cols.find(isWin);
  const primary = cols.find(c => c.key === lb.rank_key) || cols[0];
  const out = [];
  if (primary) out.push(primary);
  if (win && (!primary || win.key !== primary.key)) out.push(win);
  return out;
}

export function scoreCell(col, entry) {
  if (!col) return '—';
  const raw = entry && entry.values ? entry.values[col.key] : null;
  if (isWin(col)) return raw == null || raw === '' ? '—' : pct(raw);
  const shown = entry && entry.display ? entry.display[col.key] : null;
  if (shown == null || shown === '' || shown === 'n/a') {
    if (raw == null || raw === '') return '—';
    const n = Number(raw);
    return Number.isFinite(n) ? n.toLocaleString('en-US') : esc(raw);
  }
  return esc(shown);
}

/** Profile or entry score. A win rate becomes a percentage and the raw micro-unit is dropped. */
export function scoreText(score) {
  if (!score || typeof score !== 'object') return '';
  if (isWin(score.column)) return score.value == null ? '' : pct(score.value);
  const shown = score.display;
  if (shown == null || shown === '' || shown === 'n/a') {
    if (score.value == null || score.value === '') return '';
    const n = Number(score.value);
    return Number.isFinite(n) ? n.toLocaleString('en-US') : String(score.value);
  }
  return String(shown);
}

export function absUrl(s) {
  if (typeof s !== 'string' || !s) return '';
  if (s.startsWith('https://') || s.startsWith('http://')) return s;
  if (s.startsWith('//')) return 'https:' + s;
  if (s.startsWith('/')) return 'https://make.fun' + s;
  return '';
}

export function urlOf(v) {
  if (!v) return '';
  if (typeof v === 'string') return absUrl(v);
  if (typeof v === 'object') return absUrl(v.url || v.url_small || v.src || '');
  return '';
}

export function pic(v, alt, cls, lazy) {
  const u = urlOf(v);
  if (!u) return '';
  const c = cls ? ` class="${cls}"` : '';
  const load = lazy ? ' loading="lazy"' : '';
  return `<img${c} alt="${esc(alt || '')}" crossorigin="anonymous"${load} src="${esc(u)}">`;
}

export function avatar(v, label, cls) {
  const img = pic(v, label, cls);
  if (img) return img;
  const ch = esc(String(label || '?').trim().slice(0, 1).toUpperCase() || '?');
  return `<span class="${cls} ph">${ch}</span>`;
}

function nameCell(e) {
  const handle = e.handle || '';
  const link = handle ? `<a href="#/u/${encodeURIComponent(handle)}">${esc(handle)}</a>` : '—';
  const title = e.title ? `<span class="sub">${esc(e.title)}</span>` : '';
  return `<span class="who2">${pic(e.image, '', '', true)}${link}${title}</span>`;
}

export function leaderboard(entries, cols, limit) {
  const list = [...(entries || [])].sort((a, b) => (a.rank ?? 1e15) - (b.rank ?? 1e15));
  const shown = limit ? list.slice(0, limit) : list;
  const heads = ['<th class="rk">Rank', '<th class="nm">Name', ...cols.map(c => `<th class="sc">${esc(c.title || c.key)}`)].join('');
  const body = shown.map(e => {
    const scores = cols.map(c => `<td class="sc">${scoreCell(c, e)}</td>`).join('');
    return `<tr><td class="rk"><i>${e.rank ?? '—'}</i></td><td class="nm">${nameCell(e)}</td>${scores}</tr>`;
  }).join('');
  const span = 2 + cols.length;
  const empty = `<tr><td colspan="${span}"><span class="empty"><i class="tk"></i> No ranked entries yet</span></td></tr>`;
  return `<table class="lb"><thead><tr>${heads}</tr></thead><tbody>${body || empty}</tbody></table>`;
}

export function clock(root, alive) {
  const prev = clocks.get(root);
  if (prev) clearInterval(prev);
  const id = setInterval(() => {
    if (!alive()) { clearInterval(id); clocks.delete(root); return; }
    for (const el of root.querySelectorAll('time.tick')) {
      const next = left(el.dateTime);
      if (el.textContent !== next) el.textContent = next;
    }
    const pill = root.querySelector('.pill[data-deadline]');
    if (!pill) return;
    const on = entriesOpen(pill.getAttribute('data-deadline'));
    const text = on ? 'Taking entries' : 'Entries closed';
    if (pill.textContent !== text) pill.textContent = text;
    pill.classList.toggle('on', on);
    pill.classList.toggle('off', !on);
  }, 1000);
  clocks.set(root, id);
}

export function fail(title, detail) {
  return `<h1><i class="tk"></i> ${esc(title)}</h1><p>${esc(detail)}</p><p class="more"><a href="#/">Back to the board</a></p>`;
}

export function asText(v) {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join('\n\n');
  return '';
}

function inline(escaped) {
  return escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

/** A small markdown subset for bounty descriptions and rules. Text is escaped first. */
export function md(src) {
  const lines = String(src || '').replace(/\r\n/g, '\n').split('\n');
  let html = '';
  let list = '';
  let code = false;
  let buf = [];
  const flush = () => {
    if (!buf.length) return;
    html += `<p>${inline(buf.join(' '))}</p>`;
    buf = [];
  };
  const endList = () => {
    if (!list) return;
    html += list === 'ol' ? '</ol>' : '</ul>';
    list = '';
  };
  for (const line of lines) {
    if (line.startsWith('```')) {
      flush();
      endList();
      if (!code) { html += '<pre><code>'; code = true; }
      else { html += '</code></pre>'; code = false; }
      continue;
    }
    if (code) { html += esc(line) + '\n'; continue; }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      endList();
      const level = Math.min(h[1].length + 2, 5);
      html += `<h${level}>${inline(esc(h[2]))}</h${level}>`;
      continue;
    }
    if (/^---+$/.test(line.trim())) { flush(); endList(); html += '<hr>'; continue; }
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || ordered) {
      flush();
      const kind = ordered ? 'ol' : 'ul';
      if (list !== kind) { endList(); html += kind === 'ol' ? '<ol>' : '<ul>'; list = kind; }
      html += `<li>${inline(esc((bullet || ordered)[1]))}</li>`;
      continue;
    }
    if (!line.trim()) { flush(); endList(); continue; }
    endList();
    buf.push(esc(line.trim()));
  }
  flush();
  endList();
  if (code) html += '</code></pre>';
  return html;
}

export function safeHttp(v) {
  if (typeof v !== 'string' || !v) return '';
  try {
    const u = new URL(v);
    if (u.protocol === 'https:' || u.protocol === 'http:') return u.href;
  } catch { /* not a url */ }
  return '';
}
