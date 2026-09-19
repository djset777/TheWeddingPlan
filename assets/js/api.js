/* ==========================================================================
   The Wedding Plan — API
   Live data from the deployed Apps Script endpoint, with graceful fallback.
   ========================================================================== */

window.TWP = window.TWP || {};

// --- Live endpoint (deployed Apps Script) ---------------------------------
const API_BASE = 'https://script.google.com/macros/s/AKfycbyl3mtgwwDnxPAT9rG12rgPQka2SjRlbRIAVBKCVetCCJsucxm07iONQkoXsp6Ikv9BHw/exec';

// --- Static reference data (people/timeframes rarely change) ---------------
const PEOPLE = [
  {name:'Danisa',initials:'D'},{name:'Julian',initials:'J'},{name:'Carmen',initials:'C'},
  {name:'José Miguel',initials:'JM'},{name:'Dioris',initials:'DG'},{name:'Sileni',initials:'S'},
  {name:'Melonie',initials:'M'},{name:'Neisha',initials:'N'},{name:'Kailey',initials:'K'},
  {name:'Guaroa',initials:'G'},{name:'Mane',initials:'MN'}
];
// The timeframes are countdown markers, not labels: "7mo" is seven months
// before the wedding. isNow is COMPUTED from today's date, never hardcoded —
// a frozen marker silently hides everything in the buckets after it.
const WEDDING_DATE = new Date('2027-07-07T16:00:00-04:00');

function markerDate(code) {
  const months = {'22mo':22,'16mo':16,'12mo':12,'7mo':7,'3mo':3,'1mo':1};
  const d = new Date(WEDDING_DATE.getTime());
  if (code === '1wk') { d.setDate(d.getDate() - 7); return d; }
  d.setMonth(d.getMonth() - months[code]);
  return d;
}

const TIMEFRAMES = (function buildTimeframes() {
  const codes = ['22mo','16mo','12mo','7mo','3mo','1mo','1wk'];
  const now = Date.now();
  const rows = codes.map((code, i) => ({
    code: code,
    label: code.toUpperCase(),
    order: i,
    date: markerDate(code),
  }));
  // "Now" is the earliest marker still ahead of us; if all have passed,
  // the last one holds.
  const next = rows.find(r => r.date.getTime() >= now) || rows[rows.length - 1];
  next.isNow = true;
  return rows;
})();

// In-memory cache so we hit the network once per session per path.
const _cache = {};

async function apiGet(path) {
  // Serve reference lists locally (not in the sheet as endpoints we need live).
  if (path === 'people') return PEOPLE;
  if (path === 'timeframes') return TIMEFRAMES;

  if (path in _cache) return _cache[path];

  try {
    const res = await fetch(`${API_BASE}?path=${encodeURIComponent(path)}`, {
      method: 'GET',
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    _cache[path] = data;
    return data;
  } catch (err) {
    console.error(`TWP.api.get('${path}') failed:`, err);
    // Signal failure to callers so they can show an error state
    // rather than hanging on "Loading…".
    return null;
  }
}

async function apiPost(body) {
  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('TWP.api.post failed:', err);
    return { ok: false, error: String(err) };
  }
}

window.TWP.api = { get: apiGet, post: apiPost, config: { base: API_BASE } };
