/* ==========================================================================
   The Wedding Plan — Tracker (v6)
   The phase board. Four columns: Discover · Decide · Execute · Done.
   A card is one subtask; its column comes from the parent's Phase, except
   anything Complete, which sits in Done. Timeframes resolve to real dates
   measured back from the wedding. Amber is the only alert color.
   ========================================================================== */

(async function tracker() {
  if (!window.TWP || !window.TWP.api) return;

  const q  = (sel, root = document) => root.querySelector(sel);
  const qa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const WEDDING = new Date('2027-07-07T16:00:00-04:00');
  const DAY = 86400000;

  const STATUSES = ['Not Started', 'In Progress', 'Needs Help', 'Complete'];
  const PHASES = ['Discover', 'Decide', 'Execute'];
  const COLS = [
    { key: 'discover', label: 'Discover' },
    { key: 'decide',   label: 'Decide' },
    { key: 'execute',  label: 'Execute' },
    { key: 'done',     label: 'Done' },
  ];
  const PAGE = 12;   // cards shown per column before "show more"

  // ---- Dates -------------------------------------------------------------
  // Each timeframe is a countdown marker: "7mo" means seven months before
  // the wedding. Resolve it once, here, so everything downstream sees a date.
  function anchorDate(code) {
    const months = { '22mo': 22, '16mo': 16, '12mo': 12, '7mo': 7, '3mo': 3, '1mo': 1 };
    const d = new Date(WEDDING.getTime());
    if (code === '1wk') { d.setDate(d.getDate() - 7); return d; }
    if (code === 'after' || code === 'After Wedding') { d.setDate(d.getDate() + 30); return d; }
    const n = months[code];
    if (n == null) return null;
    d.setMonth(d.getMonth() - n);
    return d;
  }

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function shortDate(d) {
    if (!d) return '';
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return `${MONTHS[d.getMonth()]} ${d.getDate()}${sameYear ? '' : " '" + String(d.getFullYear()).slice(2)}`;
  }
  function daysLate(d) {
    if (!d) return 0;
    return Math.floor((Date.now() - d.getTime()) / DAY);
  }

  // ---- State -------------------------------------------------------------
  let subtasks = [];
  let parentsById = {};
  let people = [];
  let domains = [];
  let domainFilter = null;
  let ownerFilter = null;
  let openId = null;
  let shown = { discover: PAGE, decide: PAGE, execute: PAGE, done: PAGE };
  let loadedAt = null;
  let loadError = false;

  // ---- Load --------------------------------------------------------------
  async function load() {
    const [ppl, tasks] = await Promise.all([
      window.TWP.api.get('people'),
      window.TWP.api.get('tasks'),
    ]);

    people = (ppl || []).map(p => p.name);

    if (!tasks) { loadError = true; return; }
    loadError = false;

    subtasks = [];
    parentsById = {};
    const domainSet = {};

    tasks.forEach(parent => {
      parentsById[parent.id] = parent;
      const domain = (parent.tags && parent.tags.length) ? parent.tags[0] : (parent.moment || 'Other');
      domainSet[domain] = (domainSet[domain] || 0) + (parent.subtasks || []).length;
      const phase = (parent.phase || 'Discover').toLowerCase().trim();

      (parent.subtasks || []).forEach(sub => {
        const code = sub.timeframe || parent.timeframe;
        subtasks.push({
          id: sub.id,
          parentId: parent.id,
          parentTitle: sub.parent || parent.title,
          title: sub.title,
          status: sub.status || 'Not Started',
          notes: sub.notes || parent.notes || '',
          domain: domain,
          moment: parent.moment || '',
          phase: PHASES.map(p => p.toLowerCase()).includes(phase) ? phase : 'discover',
          timeframe: code,
          due: anchorDate(code),
          assignees: (sub.assignees && sub.assignees.length) ? sub.assignees : (parent.assignees || []),
        });
      });
    });

    domains = Object.keys(domainSet).sort((a, b) => domainSet[b] - domainSet[a]);
    loadedAt = new Date();
  }

  // ---- Helpers -----------------------------------------------------------
  const isDone = s => (s.status || '').toLowerCase().trim() === 'complete';
  const needsHelp = s => (s.status || '').toLowerCase().trim() === 'needs help';
  const isLate = s => !isDone(s) && s.due && s.due.getTime() < Date.now();
  const colOf = s => isDone(s) ? 'done' : s.phase;
  const ownerOf = s => (s.assignees && s.assignees.length) ? s.assignees[0] : null;

  function visible() {
    return subtasks.filter(s => {
      if (domainFilter && s.domain !== domainFilter) return false;
      if (ownerFilter && !(s.assignees || []).includes(ownerFilter)) return false;
      return true;
    });
  }

  function findSub(id) {
    return subtasks.find(s => s.id === id) || null;
  }

  function flash(msg) {
    const el = q('[data-flash]');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    setTimeout(() => { el.hidden = true; }, 5000);
  }

  // Optimistic write: paint it, send it, put it back if the sheet says no.
  async function commit(sub, field, value, apply) {
    const before = JSON.parse(JSON.stringify({ status: sub.status, notes: sub.notes, assignees: sub.assignees, timeframe: sub.timeframe }));
    apply(sub, value);
    render();
    const res = await window.TWP.api.post({ action: 'updateTask', id: sub.id, field: field, value: value });
    if (!res || res.ok === false) {
      Object.assign(sub, before);
      sub.due = anchorDate(sub.timeframe);
      render();
      flash('That change did not save. It has been put back.');
    }
  }

  // ---- Toolbar -----------------------------------------------------------
  function renderToolbar() {
    const mount = q('[data-toolbar]');
    if (!mount) return;

    const late = subtasks.filter(isLate).length;

    // Every tag gets a chip. Nothing hides behind a dropdown.
    const chips = [`<button type="button" class="twp-chip${domainFilter === null ? ' is-on' : ''}" data-domain="">All work</button>`]
      .concat(domains.map(d =>
        `<button type="button" class="twp-chip${domainFilter === d ? ' is-on' : ''}" data-domain="${esc(d)}">${esc(d)}</button>`))
      .join('');

    mount.innerHTML = `
      <div class="twp-chips">${chips}</div>
      <div class="twp-bar__right">
        <label class="twp-field__label" for="twp-owner">Showing</label>
        <select id="twp-owner" data-owner>
          <option value="">Everyone</option>
          ${people.map(n => `<option${n === ownerFilter ? ' selected' : ''}>${esc(n)}</option>`).join('')}
        </select>
        ${late ? `<span class="twp-bar__over">${late} overdue</span>` : ''}
        <button type="button" class="twp-bar__sync" data-refresh>${loadedAt ? 'Synced ' + shortTime(loadedAt) : 'Refresh'}</button>
      </div>`;

    qa('[data-domain]', mount).forEach(b => b.addEventListener('click', () => {
      domainFilter = b.dataset.domain || null; resetPaging(); render();
    }));
    const ow = q('[data-owner]', mount);
    if (ow) ow.addEventListener('change', e => { ownerFilter = e.target.value || null; resetPaging(); render(); });
    const rf = q('[data-refresh]', mount);
    if (rf) rf.addEventListener('click', async () => {
      rf.textContent = 'Refreshing…';
      await load();
      render();
    });
  }

  function shortTime(d) {
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ap}`;
  }

  function resetPaging() {
    shown = { discover: PAGE, decide: PAGE, execute: PAGE, done: PAGE };
  }

  // ---- Board -------------------------------------------------------------
  function cardHtml(s) {
    const owner = ownerOf(s);
    const late = isLate(s);
    const done = isDone(s);
    const n = late ? daysLate(s.due) : 0;
    const dueCls = done ? 'twp-card__due--done' : (late ? 'twp-card__due--late' : '');
    const dueText = late
      ? `<span class="twp-card__late-n">${n}</span> day${n === 1 ? '' : 's'} late`
      : esc(shortDate(s.due));
    return `
      <button type="button" class="twp-card${done ? ' twp-card--done' : ''}" data-open="${esc(s.id)}">
        <span class="twp-card__title">${esc(s.title)}</span>
        <span class="twp-card__parent">${esc(s.parentTitle)}</span>
        ${needsHelp(s) ? '<span class="twp-card__help">Needs help</span>' : ''}
        <span class="twp-card__foot">
          <span class="twp-card__who${owner ? '' : ' twp-card__who--none'}">${esc(owner || 'Unassigned')}</span>
          <span class="twp-card__due ${dueCls}">${dueText}</span>
        </span>
      </button>`;
  }

  function renderBoard() {
    const mount = q('[data-board]');
    if (!mount) return;

    if (loadError) {
      mount.innerHTML = `<div class="state">The plan could not be reached just now. Nothing is lost — press Refresh, or try again in a moment.</div>`;
      return;
    }

    const list = visible();
    const buckets = { discover: [], decide: [], execute: [], done: [] };
    list.forEach(s => buckets[colOf(s)].push(s));

    // Within a column: late first, then soonest due, then title.
    Object.keys(buckets).forEach(k => {
      buckets[k].sort((a, b) => {
        const la = isLate(a) ? 0 : 1, lb = isLate(b) ? 0 : 1;
        if (la !== lb) return la - lb;
        const da = a.due ? a.due.getTime() : Infinity;
        const db = b.due ? b.due.getTime() : Infinity;
        if (da !== db) return k === 'done' ? db - da : da - db;
        return a.title.localeCompare(b.title);
      });
    });

    mount.innerHTML = COLS.map(col => {
      const items = buckets[col.key];
      const cut = items.slice(0, shown[col.key]);
      const left = items.length - cut.length;
      return `
        <div class="twp-col">
          <div class="twp-col__bar twp-col__bar--${col.key}">
            <span>${col.label}</span>
            <span class="twp-col__n">${items.length}</span>
          </div>
          ${cut.length ? cut.map(cardHtml).join('') : '<div class="twp-col__empty">Nothing here</div>'}
          ${left > 0 ? `<button type="button" class="twp-col__more" data-more="${col.key}">Show ${left} more</button>` : ''}
        </div>`;
    }).join('');

    qa('[data-open]', mount).forEach(b => b.addEventListener('click', () => openModal(b.dataset.open)));
    qa('[data-more]', mount).forEach(b => b.addEventListener('click', () => {
      shown[b.dataset.more] += 24;
      renderBoard();
    }));
  }

  // ---- Modal -------------------------------------------------------------
  function openModal(id) {
    const sub = findSub(id);
    if (!sub) return;
    openId = id;
    const modal = q('[data-modal]');
    const body = q('[data-modal-body]');
    if (!modal || !body) return;

    const owner = ownerOf(sub) || '';
    const siblings = subtasks.filter(s => s.parentId === sub.parentId);
    const doneCount = siblings.filter(isDone).length;

    body.innerHTML = `
      <span class="twp-modal__eyebrow">${esc(sub.parentTitle)}</span>
      <h2 class="twp-modal__title" id="twp-modal-title">${esc(sub.title)}</h2>
      <div class="twp-fields">
        <label class="twp-field">
          <span class="twp-field__label">Owner</span>
          <select data-edit="Assignee">
            <option value=""${owner ? '' : ' selected'}>Unassigned</option>
            ${people.map(n => `<option${n === owner ? ' selected' : ''}>${esc(n)}</option>`).join('')}
          </select>
        </label>
        <label class="twp-field">
          <span class="twp-field__label">Status</span>
          <select data-edit="Status">
            ${STATUSES.map(s => `<option${s.toLowerCase() === (sub.status || '').toLowerCase() ? ' selected' : ''}>${s}</option>`).join('')}
          </select>
        </label>
        <label class="twp-field">
          <span class="twp-field__label">Due</span>
          <select data-edit="Timeframe">
            ${['22mo', '16mo', '12mo', '7mo', '3mo', '1mo', '1wk'].map(c =>
              `<option value="${c}"${c === sub.timeframe ? ' selected' : ''}>${shortDate(anchorDate(c))}</option>`).join('')}
          </select>
        </label>
        <label class="twp-field twp-field--wide">
          <span class="twp-field__label">Notes</span>
          <textarea data-edit="Notes" placeholder="Vendor, price, link, anything worth keeping">${esc(sub.notes)}</textarea>
        </label>
      </div>
      <div class="twp-modal__meta">
        ${esc(sub.domain)}${sub.moment ? ' · ' + esc(sub.moment) : ''} · ${doneCount} of ${siblings.length} in this deliverable complete
      </div>`;

    qa('[data-edit]', body).forEach(el => {
      el.addEventListener('change', e => {
        const field = el.dataset.edit;
        const v = e.target.value;
        if (field === 'Assignee')  commit(sub, 'Assignee',  v, (s, val) => { s.assignees = val ? [val] : []; });
        if (field === 'Status')    commit(sub, 'Status',    v, (s, val) => { s.status = val; });
        if (field === 'Notes')     commit(sub, 'Notes',     v, (s, val) => { s.notes = val; });
        if (field === 'Timeframe') commit(sub, 'Timeframe', v, (s, val) => { s.timeframe = val; s.due = anchorDate(val); });
      });
    });

    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    const first = q('select, textarea', body);
    if (first) first.focus();
  }

  function closeModal() {
    const modal = q('[data-modal]');
    if (!modal) return;
    modal.hidden = true;
    openId = null;
    document.body.style.overflow = '';
  }

  qa('[data-modal-close]').forEach(el => el.addEventListener('click', closeModal));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // ---- Render ------------------------------------------------------------
  function render() {
    renderToolbar();
    renderBoard();
    if (openId && !q('[data-modal]').hidden) openModal(openId);
  }

  await load();
  render();
})();
