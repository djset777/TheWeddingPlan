/* ==========================================================================
   The Wedding Plan — API
   Talks to the Apps Script deployment that serves JSON from the To-Do
   spreadsheet and the guest list. Until that endpoint is deployed, USE_MOCK
   returns local fixtures so the UI has something to render.
   ========================================================================== */

const CONFIG = {
  // Paste your Apps Script Web App URL here after deployment.
  API_URL: '',
  // Flip to false once API_URL is set.
  USE_MOCK: true,
};

const MOCK = {
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
    { task: 'Send save-the-dates',    due: 'This month' },
    { task: 'Confirm photographer',   due: '3 weeks' },
    { task: 'Book church band',       due: '5 weeks' },
    { task: 'Order dress fitting',    due: '6 weeks' },
    { task: 'Finalize menu tasting',  due: '2 months' },
  ],
  recent: [
    { when: '2h ago',    what: 'Photographer moved to Decide phase.' },
    { when: 'Today',     what: 'Guest List — five RSVPs marked confirmed.' },
    { when: 'Yesterday', what: 'Invitations moved to Execute phase.' },
    { when: '2 days',    what: 'Ceremony Music — church band contact added.' },
  ],
  party: [
    { role: 'Bride',         name: 'Danisa Valdez' },
    { role: 'Groom',         name: 'Julian Soto' },
    { role: 'Madrina',       name: 'Sileni Milanovic' },
    { role: 'Miss of Honor', name: 'Kailey' },
    { role: 'Maid of Honor', name: 'Melonie' },
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
