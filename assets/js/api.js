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
const TIMEFRAMES = [
  {code:'22mo',label:'22MO',order:0},{code:'16mo',label:'16MO',order:1},
  {code:'12mo',label:'12MO',order:2,isNow:true},{code:'7mo',label:'7MO',order:3},
  {code:'3mo',label:'3MO',order:4},{code:'1mo',label:'1MO',order:5},{code:'1wk',label:'1WK',order:6}
];

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
