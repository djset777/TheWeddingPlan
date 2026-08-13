/* ==========================================================================
   The Wedding Plan — API
   Mock data until the Apps Script endpoint is deployed.
   Data shape mirrors what the JSON API will return.
   ========================================================================== */

const CONFIG = {
  API_URL: '',
  USE_MOCK: true,
};

// The 11 assignees stored in the spreadsheet
const PEOPLE = [
  { code: 'D',      name: 'Danisa' },
  { code: 'J',      name: 'Julian' },
  { code: 'DJ',     name: 'Both' },
  { code: 'C',      name: 'Carmen' },
  { code: 'JM',     name: 'José Miguel' },
  { code: 'Dioris', name: 'Dioris' },
  { code: 'S',      name: 'Sileni' },
  { code: 'M',      name: 'Melonie' },
  { code: 'G',      name: 'Guaroa' },
  { code: 'K',      name: 'Kailey' },
  { code: 'N',      name: 'Neisha' },
];

// Timeframes in order, plus which one is "now"
const TIMEFRAMES = [
  { code: '22mo', label: '22MO', order: 0 },
  { code: '16mo', label: '16MO', order: 1 },
  { code: '12mo', label: '12MO', order: 2, isNow: true },
  { code: '7mo',  label: '7MO',  order: 3 },
  { code: '3mo',  label: '3MO',  order: 4 },
  { code: '1mo',  label: '1MO',  order: 5 },
  { code: '1wk',  label: '1WK',  order: 6 },
];

// Mock subtasks — each has a parent, timeframe, phase, assignee, status
// Statuses: open | done
// Phases: discover | decide | execute | done
const SUBTASKS = [
  // Overdue (past timeframe, still open — will float to top)
  { id: 1, title: 'Get referrals from Dioris',         parent: 'Photographer',   category: 'Vendors',    timeframe: '16mo', phase: 'discover', assignees: ['D'],  status: 'open' },
  { id: 2, title: 'Draft invitation copy',              parent: 'Invitations',    category: 'Stationery', timeframe: '16mo', phase: 'execute',  assignees: ['D'],  status: 'open' },

  // 12MO — current timeframe
  { id: 10, title: 'Review portfolios',                 parent: 'Photographer',   category: 'Vendors',    timeframe: '12mo', phase: 'discover', assignees: ['D'],       status: 'open' },
  { id: 11, title: 'Request quotes from 3 photographers', parent: 'Photographer', category: 'Vendors',    timeframe: '12mo', phase: 'discover', assignees: ['D', 'J'],  status: 'open' },
  { id: 12, title: 'Ask Dioris for local tent vendors', parent: 'Tent Vendor',    category: 'Vendors',    timeframe: '12mo', phase: 'discover', assignees: ['D'],       status: 'open' },
  { id: 13, title: 'Write save-the-date copy',          parent: 'Save-the-Dates', category: 'Stationery', timeframe: '12mo', phase: 'execute',  assignees: ['D'],       status: 'open' },
  { id: 14, title: 'Julian proofreads copy',            parent: 'Save-the-Dates', category: 'Stationery', timeframe: '12mo', phase: 'execute',  assignees: ['J'],       status: 'open' },
  { id: 15, title: 'Confirm cabana block dates',        parent: 'Cabana Block',   category: 'Lodging',    timeframe: '12mo', phase: 'decide',   assignees: ['D'],       status: 'open' },
  { id: 16, title: 'Talk to Dioris about band options', parent: 'Church Band',    category: 'Ceremony',   timeframe: '12mo', phase: 'discover', assignees: ['Dioris'],  status: 'open' },
  { id: 17, title: 'Discuss ride timing with father',   parent: 'The Ride',       category: 'Ceremony',   timeframe: '12mo', phase: 'discover', assignees: ['D', 'JM'], status: 'open' },
  { id: 18, title: 'Confirm venue with José Miguel',    parent: 'Venue',          category: 'Logistics',  timeframe: '12mo', phase: 'done',     assignees: ['D'],       status: 'done' },
  { id: 19, title: 'Rally the bridal tribe',            parent: 'Wedding Party',  category: 'People',     timeframe: '12mo', phase: 'execute',  assignees: ['S', 'M'],  status: 'open' },
  { id: 20, title: 'Confirm florist availability',      parent: 'Florist',        category: 'Vendors',    timeframe: '12mo', phase: 'discover', assignees: ['D'],       status: 'open' },
  { id: 21, title: 'Update WithJoy → GitHub site copy', parent: 'Guest Website',  category: 'Stationery', timeframe: '12mo', phase: 'execute',  assignees: ['D'],       status: 'open' },
  { id: 22, title: 'Order dress fitting',               parent: 'Wedding Dress',  category: 'Attire',     timeframe: '12mo', phase: 'execute',  assignees: ['D'],       status: 'open' },

  // 7MO — future
  { id: 30, title: 'Finalize photographer contract',    parent: 'Photographer',   category: 'Vendors',    timeframe: '7mo',  phase: 'execute',  assignees: ['D'],  status: 'open' },
  { id: 31, title: 'Menu tasting',                      parent: 'Catering',       category: 'Vendors',    timeframe: '7mo',  phase: 'decide',   assignees: ['DJ'], status: 'open' },
];

const MOCK = {
  people: PEOPLE,
  timeframes: TIMEFRAMES,
  subtasks: SUBTASKS,
  rsvp: {
    total: 154,
    confirmed: 0,
    declined: 0,
    awaiting: 154,
  },
};

async function apiGet(path) {
  if (CONFIG.USE_MOCK || !CONFIG.API_URL) {
    if (path in MOCK) return MOCK[path];
    return null;
  }
  const res = await fetch(`${CONFIG.API_URL}?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

window.TWP = window.TWP || {};
window.TWP.api = { get: apiGet, config: CONFIG };
