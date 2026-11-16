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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function clockText(iso, year) {
  const d = new Date(iso);
  if (Number.isNaN(+d)) return '';
  const p = n => String(n).padStart(2, '0');
  const h = d.getUTCHours();
  const y = d.getUTCFullYear();
  const date = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  const time = `${h % 12 || 12}:${p(d.getUTCMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
  return (y === year ? date : `${date}, ${y}`) + ', ' + time;
}

function spanText(start, end) {
  const year = new Date().getUTCFullYear();
  const a = start ? clockText(start, year) : '';
  const b = end ? clockText(end, year) : '';
  if (a && b) return `${a} – ${b} UTC`;
  if (a || b) return `${a || b} UTC`;
  return '';
}

function sameInstant(a, b) {
  const ta = +new Date(a);
  const tb = +new Date(b);
  return Number.isFinite(ta) && ta === tb;
}

/** One row per phase. Opens/Deadline are omitted when they already bound a phase. */
function timeline(comp) {
  const phases = Array.isArray(comp.phases) ? comp.phases : [];
  const opens = comp.opensAt || comp.opens_at || '';
  const deadline = comp.deadline || '';
  const rows = [];
  if (phases.length) {
    const bounds = [];
    for (const ph of phases) {
      const start = ph.startsAt || ph.starts_at || '';
      const end = ph.endsAt || ph.ends_at || '';
      if (start) bounds.push(start);
      if (end) bounds.push(end);
      const text = spanText(start, end);
      if (text) rows.push({ label: ph.title || ph.key || 'Phase', text });
    }
    const opensDup = !!(opens && bounds.some(t => sameInstant(t, opens)));
    const deadDup = !!(deadline && bounds.some(t => sameInstant(t, deadline)));
    if (!opensDup && !deadDup && (opens || deadline)) {
      const text = spanText(opens, deadline);
      if (text) rows.unshift({ label: 'Open', text });
    } else if (!opensDup && opens) {
      const text = spanText(opens, '');
      if (text) rows.unshift({ label: 'Opens', text });
    } else if (!deadDup && deadline) {
      const text = spanText('', deadline);
      if (text) rows.push({ label: 'Deadline', text });
    }
  } else {
    const text = spanText(opens, deadline);
    if (text) rows.push({ label: 'Open', text });
  }
  if (!rows.length) return '';
  return `<div class="tl">${rows.map(r => `<p><span class="k">${esc(r.label)}</span><span class="dot">·</span><b>${esc(r.text)}</b></p>`).join('')}</div>`;
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
  const dates = timeline(comp);
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
<div class="band">
<div class="facts">
<div><span class="k">Live pot</span><b class="pot">${usd(comp.potUsd ?? comp.rewardAmount)}</b></div>
<div><span class="k">Entry fee</span><b${fee ? '' : ' class="muted"'}>${fee || 'No fee'}</b></div>
<div><span class="k">Time left</span><b><time class="tick" datetime="${esc(comp.deadline)}">${left(comp.deadline)}</time></b><span class="when deadline">${esc(when(comp.deadline))}</span></div>
<div><span class="k">Entries</span><b class="pill ${open ? 'on' : 'off'}" data-deadline="${esc(comp.deadline)}">${entriesLabel(comp.deadline)}</b>${count ? `<span class="when">${count}</span>` : ''}</div>
</div>
${dates}
</div>
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
