import { api, claim, cssReady, esc, fail, getJSON, leaderboard, num, scoreCols } from './kit.js';

export function render(lb, slug) {
  const comp = lb && lb.competition || {};
  const title = comp.title || slug;
  const href = `#/bounty/${encodeURIComponent(slug)}`;
  const cols = scoreCols(lb || {});
  const entries = lb && lb.entries || [];
  const live = lb && lb.phase && lb.phase.scores === 'live';
  return `<p class="meta"><a href="${esc(href)}">${esc(title)}</a></p>
<h1>Leaderboard</h1>
<p class="meta">${num(entries.length)} ranked${live ? ' · Live' : ''}</p>
<div class="box">${leaderboard(entries, cols)}</div>`;
}

export async function show(slug, root) {
  const alive = claim(root, '/bounty/' + slug + '/leaderboard');
  try {
    const lb = await Promise.all([cssReady, getJSON(api('competitions/' + encodeURIComponent(slug) + '/leaderboard'))]).then(x => x[1]);
    if (!alive()) return;
    root.innerHTML = render(lb, slug);
  } catch (e) {
    if (!alive()) return;
    const missing = e && e.status === 404;
    root.innerHTML = fail(missing ? 'Not found' : 'Could not load', missing ? 'No leaderboard for this bounty.' : 'make.fun did not answer.');
  }
}
