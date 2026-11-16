import {
  api, asText, claim, clock, cssReady, entriesLabel, entriesOpen, esc, fail, getJSON, leaderboard,
  left, md, num, pic, scoreCols, usd, when,
} from './kit.js';

const PREVIEW = 10;

function tone(c) {
  const k = String(c || '').toLowerCase();
  return k === 'games' || k === 'code' || k === 'growth' || k === 'trading' ? k : 'other';
}

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

function ord(n) {
  const v = Math.abs(+n) | 0;
  const k = v % 100;
  const s = k >= 11 && k <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][v % 10] || 'th';
  return v + s;
}

function payoutSplit(comp) {
  const groups = [];
  for (const r of rewardRows(comp)) {
    const amt = +(r.base != null && r.base !== '' ? r.base : r.amount);
    if (!Number.isFinite(amt)) continue;
    const n = +r.place;
    const last = groups.at(-1);
    const ok = Number.isFinite(n);
    if (last && last.ok && ok && last.amt === amt && n === last.to + 1) last.to = n;
    else groups.push({ from: ok ? n : 0, to: ok ? n : 0, amt, place: r.place, ok });
  }
  if (!groups.length) return '';
  const shown = groups.slice(0, 8);
  const rest = groups.length - shown.length;
  const text = g => (
    g.ok
      ? (g.from === g.to ? `${ord(g.from)} ${usd(g.amt)}` : `${ord(g.from)}–${ord(g.to)} ${usd(g.amt)} each`)
      : `${g.place} ${usd(g.amt)}`
  );
  const bits = shown.map(g => `<span class="pp">${esc(text(g))}</span>`);
  if (rest) bits.push(`<span class="pp">+${rest} more</span>`);
  return `<div class="pays" aria-label="Payout split">${bits.join('')}</div>`;
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
  const split = payoutSplit(comp);
  const dates = datesTable(comp);
  const board = lb
    ? leaderboard(entries, cols, PREVIEW)
    : '<p>Leaderboard unavailable.</p>';

  const logo = sponsor.logo ? pic(sponsor.logo, '') : '';
  const about = [
    description ? `<section class="sec"><h2>Description</h2><div class="prose clip" id="desc">${md(description)}</div><button type="button" class="rm" aria-expanded="false" aria-controls="desc">Read more</button>${split}</section>` : split,
    rules || note ? `<section class="sec"><h2>Rules</h2>${note ? `<p>${esc(note)}</p>` : ''}<div class="prose">${md(rules)}</div></section>` : '',
    rewards ? `<section class="sec"><h2>Rewards</h2>${rewards}</section>` : '',
  ].join('');
  return `<article class="sum ${tone(comp.category)}">
${bits.length || logo ? `<p class="meta">${logo}${bits.join(' · ')}</p>` : ''}
<h1>${esc(title)}</h1>
<div class="facts">
<div><span class="k">Live pot</span><b class="pot">${usd(comp.potUsd ?? comp.rewardAmount)}</b></div>
<div><span class="k">Entry fee</span><b${fee ? '' : ' class="muted"'}>${fee || 'No fee'}</b></div>
<div><span class="k">Time left</span><b><time class="tick" datetime="${esc(comp.deadline)}">${left(comp.deadline)}</time></b><span class="when deadline">${esc(when(comp.deadline))}</span></div>
<div><span class="k">Entries</span><b class="pill ${open ? 'on' : 'off'}" data-deadline="${esc(comp.deadline)}">${entriesLabel(comp.deadline)}</b>${count ? `<span class="when">${count}</span>` : ''}</div>
</div>
${dates ? `<div class="dates">${dates}</div>` : ''}
</article>
<div class="split">
${about ? `<div class="box">${about}</div>` : ''}
<section class="box stand" aria-label="Leaderboard"><h2>Leaderboard${total > PREVIEW ? ` <span class="sub">${linkText}</span>` : ''} <a class="go" href="${esc(href)}">Full leaderboard<i></i></a></h2>${board}</section>
</div>`;
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
    const rm = root.querySelector('.rm');
    const clip = root.querySelector('.clip');
    if (rm && clip) {
      if (clip.scrollHeight <= clip.clientHeight + 1) rm.remove();
      else rm.onclick = () => {
        const open = clip.classList.toggle('open');
        rm.textContent = open ? 'Show less' : 'Read more';
        rm.setAttribute('aria-expanded', open ? 'true' : 'false');
      };
    }
    clock(root, alive);
  } catch (e) {
    if (!alive()) return;
    const missing = e && e.status === 404;
    root.innerHTML = fail(missing ? 'Not found' : 'Could not load', missing ? 'No bounty with this name.' : 'make.fun did not answer.');
  }
}
