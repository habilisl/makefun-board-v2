import {
  api, avatar, claim, cssReady, esc, fail, getJSON, num, safeHttp, scoreText, usd, when,
} from './kit.js';

function resultOf(s) {
  const bits = [];
  if (s.placement) bits.push('#' + s.placement);
  const score = scoreText(s.score);
  if (score) bits.push(score);
  if (s.prize_usd) bits.push(usd(s.prize_usd));
  return bits.join(' · ');
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
  const seen = new Set();
  const rows = [];
  for (const s of sols) {
    const id = s.submission_id;
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    const comp = s.competition || {};
    if (!comp.slug) continue;
    const href = `#/bounty/${encodeURIComponent(comp.slug)}`;
    const result = resultOf(s);
    rows.push(`<tr><td class="nm"><a href="${esc(href)}">${esc(comp.title || comp.slug)}</a>${s.title ? ` <span class="sub">${esc(s.title)}</span>` : ''}</td><td class="sc">${result ? esc(result) : '—'}</td></tr>`);
  }
  const pays = (p.payouts || []).filter(x => x && x.competition && x.competition.slug).map(x => {
    const href = `#/bounty/${encodeURIComponent(x.competition.slug)}`;
    const bits = [x.place ? '#' + x.place : '', x.amount_usd ? usd(x.amount_usd) : '', x.paid_at ? when(x.paid_at) : ''].filter(Boolean);
    return `<li><a href="${esc(href)}">${esc(x.competition.title || x.competition.slug)}</a> <span class="sub">${esc(bits.join(' · '))}</span></li>`;
  });
  const best = rec.best_placement == null || rec.best_placement === '' ? '—' : num(rec.best_placement);
  return `<div class="who">${avatar(avatarSrc, handle, 'ava')}<div>
<h1>${esc(name || '@' + handle)}</h1>
<p class="meta">${name ? '@' + esc(handle) : ''}${p.joined_at ? `${name ? ' · ' : ''}Joined ${esc(when(p.joined_at))}` : ''}</p>
${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : ''}
${extLinks(p)}
</div></div>
<div class="facts">
<div><span class="k">Entered</span><b>${num(rec.competitions_entered)}</b></div>
<div><span class="k">Placed</span><b>${num(rec.competitions_placed)}</b></div>
<div><span class="k">Won</span><b>${num(rec.competitions_won)}</b></div>
<div><span class="k">Best</span><b>${best}</b></div>
<div><span class="k">Paid</span><b class="pot">${usd(rec.prize_usd)}</b></div>
</div>
<section class="sec"><h2>Entries</h2>${rows.length ? `<table class="lb"><thead><tr><th class="nm">Bounty<th class="sc">Result<tbody>${rows.join('')}</table>` : '<p class="meta">No public entries yet.</p>'}</section>
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
