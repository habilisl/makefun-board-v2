import {
  api, avatar, claim, cssReady, esc, fail, getJSON, num, pct, safeHttp, usd, when,
} from './kit.js';

function rankText(place) {
  if (place == null || place === '') return '';
  const n = +place;
  return '#' + (Number.isFinite(n) ? num(n) : String(place));
}

/** Win rate only. Judge values are micro-units (772158 → 77.22%). Other metrics stay hidden. */
function judgePct(score) {
  const col = score && typeof score === 'object' ? score.column : null;
  if (!col || col.key !== 'judge') return '';
  if (score.value == null || score.value === '') return '';
  const text = pct(score.value);
  return text && text !== '—' ? text : '';
}

function resultOf(s) {
  const bits = [];
  const rank = rankText(s.placement);
  if (rank) bits.push(rank);
  const win = judgePct(s.score);
  if (win) bits.push(win);
  const head = bits.length ? bits.join(' · ') : 'pending';
  if (s.prize_usd) {
    const money = usd(s.prize_usd);
    if (money && money !== '—') return `${head} · ${money}`;
  }
  return head;
}

/** Prefer a solution that shows a rank or a judge win rate when one bounty has several. */
function resultRank(s) {
  let n = 0;
  if (rankText(s.placement)) n += 2;
  if (judgePct(s.score)) n += 2;
  if (s.prize_usd) n += 1;
  return n;
}

function extLinks(p) {
  const out = [];
  const push = (href, label) => {
    const u = safeHttp(href);
    if (u) out.push(`<a href="${esc(u)}" rel="noopener noreferrer">${esc(label)}</a>`);
  };
  if (typeof p.github_login === 'string' && /^[A-Za-z0-9-]+$/.test(p.github_login)) {
    push('https://github.com/' + p.github_login, 'GitHub');
  }
  if (p.x && typeof p.x === 'object') push(p.x.url || (p.x.username ? 'https://x.com/' + p.x.username : ''), p.x.username ? '@' + p.x.username : 'X');
  if (p.discord && typeof p.discord === 'object') push(p.discord.url, p.discord.global_name || p.discord.username || 'Discord');
  if (p.wallet && typeof p.wallet === 'object') push(p.wallet.explorer_url, 'Wallet');
  return out.length ? `<p class="links">${out.join('')}</p>` : '';
}

export function render(p) {
  const handle = p.handle || '';
  const name = p.display_name && p.display_name !== handle ? p.display_name : '';
  const rec = p.record || {};
  const avatarSrc = (p.avatar && (p.avatar.url || p.avatar.url_small)) || p.image;
  const sols = [...(p.solutions || [])].sort((a, b) => String(b.entered_at || '').localeCompare(String(a.entered_at || '')));
  const bySlug = new Map();
  for (const s of sols) {
    const slug = s.competition && s.competition.slug;
    if (!slug) continue;
    const prev = bySlug.get(slug);
    if (!prev || resultRank(s) > resultRank(prev)) bySlug.set(slug, s);
  }
  const rows = [];
  for (const s of bySlug.values()) {
    const comp = s.competition || {};
    const href = `#/bounty/${encodeURIComponent(comp.slug)}`;
    const result = resultOf(s) || 'pending';
    rows.push(`<a class="erow" href="${esc(href)}"><span>${esc(comp.title || comp.slug)}${s.title ? `<span class="sub">${esc(s.title)}</span>` : ''}</span><b>${esc(result)}</b></a>`);
  }
  const pays = (p.payouts || []).filter(x => x && x.competition && x.competition.slug).map(x => {
    const href = `#/bounty/${encodeURIComponent(x.competition.slug)}`;
    const bits = [x.place ? '#' + x.place : '', x.amount_usd ? usd(x.amount_usd) : '', x.paid_at ? when(x.paid_at) : ''].filter(Boolean);
    return `<li><a href="${esc(href)}">${esc(x.competition.title || x.competition.slug)}</a> <span class="sub">${esc(bits.join(' · '))}</span></li>`;
  });
  const best = rankText(rec.best_placement) || '—';
  const hue = (handle.charCodeAt(0) || 0) % 2 ? 'pink' : 'blue';
  return `<div class="prof"><div class="who ${hue}">${avatar(avatarSrc, handle, 'ava')}<div>
<h1>${esc(name || '@' + handle)}</h1>
<p class="meta">${name ? '@' + esc(handle) : ''}${p.joined_at ? `${name ? ' · ' : ''}Joined ${esc(when(p.joined_at))}` : ''}</p>
${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : ''}
${extLinks(p)}
</div></div>
<div class="stats">
<div><span class="k">Entered</span><b>${num(rec.competitions_entered)}</b></div>
<div><span class="k">Placed</span><b>${num(rec.competitions_placed)}</b></div>
<div><span class="k">Won</span><b>${num(rec.competitions_won)}</b></div>
<div><span class="k">Best rank</span><b>${esc(best)}</b></div>
<div><span class="k">Paid</span><b class="pot">${usd(rec.prize_usd)}</b></div>
</div></div>
<section class="sec"><h2>Entries</h2>${rows.length ? rows.join('') : '<p class="empty"><i class="tk"></i> No public entries yet.</p>'}</section>
${pays.length ? `<section class="sec"><h2>Payouts</h2><ul class="paylist">${pays.join('')}</ul></section>` : ''}`;
}

export async function show(handle, root) {
  const alive = claim(root, '/u/' + handle);
  try {
    const p = await Promise.all([cssReady, getJSON(api('profiles/' + encodeURIComponent(handle)))]).then(x => x[1]);
    if (!alive()) return;
    root.innerHTML = render(p);
  } catch (e) {
    if (!alive()) return;
    const missing = e && e.status === 404;
    root.innerHTML = fail(missing ? 'Not found' : 'Could not load', missing ? 'No profile with this handle.' : 'make.fun did not answer.');
  }
}
