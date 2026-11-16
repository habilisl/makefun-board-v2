import {
  api, asText, claim, clock, cssReady, entriesLabel, entriesOpen, esc, fail, getJSON, leaderboard,
  left, md, num, pic, scoreCols, usd, when,
} from './kit.js';

const PREVIEW = 10;

function feeLabel(v) {
  const n = +v;
  if (!v || !Number.isFinite(n) || n === 0) return '';
  return usd(n);
}

function rewardRows(comp) {
  const now = Array.isArray(comp.rewardsNow) ? comp.rewardsNow : [];
  if (now.length) {
    return now.map(r => ({
      place: r.place,
      base: r.baseUsd,
      fee: r.feeShareUsd,
      amount: r.amountUsd ?? r.baseUsd,
    }));
  }
  const map = comp.rewards && typeof comp.rewards === 'object' ? comp.rewards : {};
  return Object.keys(map)
    .map(k => ({ place: +k || k, base: map[k], fee: 0, amount: map[k] }))
    .sort((a, b) => (a.place > b.place ? 1 : -1));
}

function rewardsTable(comp) {
  let rows = rewardRows(comp);
  if (!rows.length && (comp.rewardAmount != null || comp.potUsd != null)) {
    rows = [{ place: 1, base: comp.rewardAmount, fee: 0, amount: comp.potUsd ?? comp.rewardAmount }];
  }
  if (!rows.length) return '';
  const fees = rows.some(r => +r.fee);
  const head = fees
    ? '<tr><th>Place<th>Base<th>Entry fees<th>Reward'
    : '<tr><th>Place<th>Reward';
  const body = rows.map(r => (
    fees
      ? `<tr><td>${esc(r.place)}<td>${usd(r.base)}<td>${usd(r.fee)}<td class="amt">${usd(r.amount)}`
      : `<tr><td>${esc(r.place)}<td class="amt">${usd(r.amount)}`
  )).join('');
  return `<table class="pay"><thead>${head}<tbody>${body}</table>`;
}

function datesTable(comp) {
  const rows = [];
  const add = (k, v) => { if (v) rows.push([k, when(v)]); };
  add('Opens', comp.opensAt || comp.opens_at);
  if (comp.publishedAt && comp.publishedAt !== (comp.opensAt || comp.opens_at)) add('Published', comp.publishedAt);
  add('Deadline', comp.deadline);
  add('Resolved', comp.resolvedAt);
  const phases = Array.isArray(comp.phases) ? comp.phases : [];
  let html = '';
  if (rows.length) {
    html += `<table class="pay"><thead><tr><th>When<th>Date<tbody>${rows.map(([k, v]) => `<tr><td>${esc(k)}<td>${esc(v)}`).join('')}</table>`;
  }
  if (phases.length) {
    const body = phases.map(ph => {
      const start = ph.startsAt || ph.starts_at;
      const end = ph.endsAt || ph.ends_at;
      return `<tr><td>${esc(ph.title || ph.key || '')}<td>${start ? esc(when(start)) : '—'}<td>${end ? esc(when(end)) : '—'}`;
    }).join('');
    html += `<table class="pay"><thead><tr><th>Phase<th>Starts<th>Ends<tbody>${body}</table>`;
  }
  return html;
}

export function render(comp, lb, slug) {
  const title = comp.title || slug;
  const sponsor = comp.sponsor || {};
  const bits = [sponsor.name, comp.category].filter(Boolean).map(esc);
  const fee = feeLabel(comp.entryFeeUsd);
  const open = entriesOpen(comp.deadline);
  const href = `#/bounty/${encodeURIComponent(slug)}/leaderboard`;
  const cols = lb ? scoreCols(lb) : [];
  const entries = lb && lb.entries || [];
  const total = entries.length;
  const linkText = total > PREVIEW ? `All ${num(total)}` : 'Full leaderboard';
  const count = comp.submissionCount != null ? `${num(comp.submissionCount)} submitted` : '';
  const description = asText(comp.description) || asText(comp.summary);
  const rules = asText(comp.rules);
  const note = asText(comp.rulesNote);
  const rewards = rewardsTable(comp);
  const dates = datesTable(comp);
  const board = lb
    ? leaderboard(entries, cols, PREVIEW)
    : '<p>Leaderboard unavailable.</p>';

  const logo = sponsor.logo ? pic(sponsor.logo, '') : '';
  return `<div class="hero"><div class="lead">
${bits.length || logo ? `<p class="meta">${logo}${bits.join(' · ')}</p>` : ''}
<h1>${esc(title)}</h1>
<div class="facts">
<div><span class="k">Live pot</span><b class="pot">${usd(comp.potUsd ?? comp.rewardAmount)}</b></div>
<div><span class="k">Entry fee</span><b${fee ? '' : ' class="muted"'}>${fee || 'No fee'}</b></div>
<div><span class="k">Time left</span><b><time class="tick" datetime="${esc(comp.deadline)}">${left(comp.deadline)}</time></b><span class="when deadline">${esc(when(comp.deadline))}</span></div>
<div><span class="k">Entries</span><b class="pill ${open ? 'on' : 'off'}" data-deadline="${esc(comp.deadline)}">${entriesLabel(comp.deadline)}</b>${count ? `<span class="when">${count}</span>` : ''}</div>
</div></div>
<section class="stand" aria-label="Leaderboard"><h2>Leaderboard <a href="${esc(href)}">${linkText}</a></h2>${board}</section>
</div>
${description ? `<section class="sec"><h2>Description</h2><div class="prose">${md(description)}</div></section>` : ''}
${rules || note ? `<section class="sec"><h2>Rules</h2>${note ? `<p>${esc(note)}</p>` : ''}<div class="prose">${md(rules)}</div></section>` : ''}
${rewards ? `<section class="sec"><h2>Rewards</h2>${rewards}</section>` : ''}
${dates ? `<section class="sec"><h2>Dates</h2>${dates}</section>` : ''}
<p class="more"><a href="${esc(href)}">Full leaderboard</a></p>`;
}

export async function show(slug, root) {
  const alive = claim(root, '/bounty/' + slug);
  try {
    const enc = encodeURIComponent(slug);
    const [compR, lbR] = await Promise.allSettled([
      getJSON(api('competitions/' + enc)),
      getJSON(api('competitions/' + enc + '/leaderboard')),
    ]);
    await cssReady;
    if (!alive()) return;
    if (compR.status !== 'fulfilled') throw compR.reason;
    root.innerHTML = render(compR.value, lbR.status === 'fulfilled' ? lbR.value : null, slug);
    clock(root, alive);
  } catch (e) {
    if (!alive()) return;
    const missing = e && e.status === 404;
    root.innerHTML = fail(missing ? 'Not found' : 'Could not load', missing ? 'No bounty with this name.' : 'make.fun did not answer.');
  }
}
