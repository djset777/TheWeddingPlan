/* ==========================================================================
   The Wedding Plan — API
   Talks to the Apps Script deployment that serves JSON from the To-Do
   spreadsheet and the guest list. Until that endpoint is deployed, USE_MOCK
   returns local fixtures so the UI has something to render.
   ========================================================================== */

const CONFIG = {
  API_URL: '',
  USE_MOCK: true,
};

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

const MOCK = {
  people: PEOPLE,
  rsvp: {
    total: 154,
    confirmed: 0,
    declined: 0,
    awaiting: 154,
  },
  tasks: {
    parents: {
      total: 89,
      discover: 41,
      decide: 22,
      execute: 14,
      done: 12,
    },
    subtasks: {
      total: 330,
    },
  },
  vendors: {
    total: 18,
    booked: 4,
    pending: 6,
    needed: 8,
  },
  upcoming: [
    { task: 'Send save-the-dates',    due: 'This month',  assignees: ['D'] },
    { task: 'Confirm photographer',   due: '3 weeks',     assignees: ['DJ'] },
    { task: 'Book church band',       due: '5 weeks',     assignees: ['Dioris'] },
    { task: 'Order dress fitting',    due: '6 weeks',     assignees: ['D'] },
    { task: 'Finalize menu tasting',  due: '2 months',    assignees: ['DJ'] },
    { task: 'Rally the bridal tribe', due: '7 weeks',     assignees: ['S', 'M'] },
    { task: 'Confirm ride timing',    due: '4 weeks',     assignees: ['JM'] },
    { task: 'Draft ceremony program', due: '8 weeks',     assignees: ['D', 'K'] },
  ],
  recent: [
    { when: '2h ago',    what: 'Photographer moved to Decide phase.' },
    { when: 'Today',     what: 'Guest List — five RSVPs marked confirmed.' },
    { when: 'Yesterday', what: 'Invitations moved to Execute phase.' },
    { when: '2 days',    what: 'Ceremony Music — church band contact added.' },
  ],
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
