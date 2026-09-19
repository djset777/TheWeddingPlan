/* ==========================================================================
   The Wedding Plan — Tracker (v12)
   Three columns of live work: Discover · Decide · Execute.
   Done is not a phase you work in, so it lives in the filter row, not on
   the board. A card is one subtask; its column comes from the parent's
   Phase. Timeframes resolve to real dates measured back from the wedding.
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
  const PHASES = ['discover', 'decide', 'execute'];
  const COLS = [
    { key: 'discover', label: 'Discover' },
    { key: 'decide',   label: 'Decide' },
    { key: 'execute',  label: 'Execute' },
  ];
  const PAGE = 12;

  // ---- Dates -------------------------------------------------------------
  function anchorDate(code) {
    const months = { '22mo': 22, '16mo': 16, '12mo': 12, '7mo': 7, '3mo': 3, '1mo': 1 };
    const d = new Date(WEDDING.getTime());
    if (code === '1wk') { d.setDate(d.getDate() - 7); return d; }
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
  const daysLate = d => d ? Math.floor((Date.now() - d.getTime()) / DAY) : 0;

  // ---- State -------------------------------------------------------------
  let subtasks = [];
  let people = [];
  let domains = [];
  let domainFilter = null;
  let ownerFilter = null;
  let doneView = false;
  let openId = null;
  let shown = { discover: PAGE, decide: PAGE, execute: PAGE, done: 24 };
  let loadedAt = null;
  let loadError = false;

  // ---- Helpers -----------------------------------------------------------
  const isDone = s => (s.status || '').toLowerCase().trim() === 'complete';
  const needsHelp = s => (s.status || '').toLowerCase().trim() === 'needs help';
  const isLate = s => !isDone(s) && s.due && s.due.getTime() < Date.now();
  const ownerOf = s => (s.assignees && s.assignees.length) ? s.assignees[0] : null;
  const openIn = d => subtasks.filter(s => s.domain === d && !isDone(s)).length;
  const lateIn = d => subtasks.filter(s => s.domain === d && isLate(s)).length;

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
    const seen = {};

    tasks.forEach(parent => {
      const domain = (parent.tags && parent.tags.length) ? parent.tags[0] : (parent.moment || 'Other');
      seen[domain] = true;
      const raw = (parent.phase || 'Discover').toLowerCase().trim();

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
          phase: PHASES.indexOf(raw) !== -1 ? raw : 'discover',
          timeframe: code,
          due: anchorDate(code),
          assignees: (sub.assignees && sub.assignees.length) ? sub.assignees : (parent.assignees || []),
        });
      });
    });

    // Chips are ordered by how much open work each domain is carrying.
    domains = Object.keys(seen).sort((a, b) => openIn(b) - openIn(a));
    loadedAt = new Date();
  }

  function visible() {
    return subtasks.filter(s => {
      if (domainFilter && s.domain !== domainFilter) return false;
      if (ownerFilter && (s.assignees || []).indexOf(ownerFilter) === -1) return false;
      return true;
    });
  }

  const findSub = id => subtasks.filter(s => s.id === id)[0] || null;

  function flash(msg) {
    const el = q('[data-flash]');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    setTimeout(() => { el.hidden = true; }, 5000);
  }

  async function commit(sub, field, value, apply) {
    const before = { status: sub.status, notes: sub.notes, assignees: sub.assignees, timeframe: sub.timeframe };
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
  // A chip carries its own count. Amber means that domain is running late,
  // so the filter row diagnoses rather than merely listing.
  function chipCount(d) {
    const late = lateIn(d);
    return late
      ? `<span class="twp-chip__n twp-chip__n--late">${late}</span>`
      : `<span class="twp-chip__n">${openIn(d)}</span>`;
  }

  function renderToolbar() {
    const mount = q('[data-toolbar]');
    if (!mount) return;

    const allOpen = subtasks.filter(s => !isDone(s)).length;
    const allDone = subtasks.filter(isDone).length;

    const chips = [
      `<button type="button" class="twp-chip${(domainFilter === null && !doneView) ? ' is-on' : ''}" data-domain="">All work <span class="twp-chip__n twp-chip__n--all">${allOpen}</span></button>`
    ].concat(domains.map(d =>
      `<button type="button" class="twp-chip${domainFilter === d ? ' is-on' : ''}" data-domain="${esc(d)}">${esc(d)} ${chipCount(d)}</button>`
    )).concat([
      `<button type="button" class="twp-chip twp-chip--done${doneView ? ' is-on' : ''}" data-done>Done <span class="twp-chip__n twp-chip__n--done">${allDone}</span></button>`
    ]).join('');

    mount.innerHTML = `
      <div class="twp-chips">${chips}</div>
      <div class="twp-bar__right">
        <select id="twp-owner" data-owner aria-label="Show one person's tasks">
          <option value="">Everyone</option>
          ${people.map(n => `<option${n === ownerFilter ? ' selected' : ''}>${esc(n)}</option>`).join('')}
        </select>
        <button type="button" class="twp-bar__sync" data-refresh>${loadedAt ? 'Synced ' + shortTime(loadedAt) : 'Refresh'}</button>
      </div>`;

    qa('[data-domain]', mount).forEach(b => b.addEventListener('click', () => {
      domainFilter = b.dataset.domain || null;
      doneView = false;
      resetPaging(); render();
    }));
    const dn = q('[data-done]', mount);
    if (dn) dn.addEventListener('click', () => { doneView = !doneView; resetPaging(); render(); });
    const ow = q('[data-owner]', mount);
    if (ow) ow.addEventListener('change', e => { ownerFilter = e.target.value || null; resetPaging(); render(); });
    const rf = q('[data-refresh]', mount);
    if (rf) rf.addEventListener('click', async () => { rf.textContent = 'Refreshing…'; await load(); render(); });
  }

  function shortTime(d) {
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ap}`;
  }

  function resetPaging() {
    shown = { discover: PAGE, decide: PAGE, execute: PAGE, done: 24 };
  }

  // ---- Cards -------------------------------------------------------------
  const STATUS_KEY = {
    'not started': 'not',
    'in progress': 'progress',
    'needs help':  'needs',
    'complete':    'done',
  };

  function cardHtml(s) {
    const owner = ownerOf(s);
    const sKey = STATUS_KEY[(s.status || '').toLowerCase().trim()] || 'not';
    const sLabel = s.status || 'Not Started';
    const late = isLate(s);
    const done = isDone(s);
    const n = late ? daysLate(s.due) : 0;
    const dueText = late
      ? `<span class="twp-card__late-n">${n}</span> day${n === 1 ? '' : 's'} late`
      : esc(shortDate(s.due));
    return `
      <button type="button" class="twp-card${done ? ' twp-card--done' : ''}" data-open="${esc(s.id)}">
        <span class="twp-card__top">
          <span class="twp-card__head">
            <span class="twp-card__parent">${esc(s.parentTitle)}</span>
            <span class="twp-card__status twp-card__status--${sKey}">${esc(sLabel)}</span>
          </span>
          <span class="twp-card__title">${esc(s.title)}</span>
        </span>
        <span class="twp-card__foot">
          <span class="twp-card__who${owner ? '' : ' twp-card__who--none'}">${esc(owner || 'Unassigned')}</span>
          <span class="twp-card__due${late ? ' twp-card__due--late' : ''}">${dueText}</span>
        </span>
      </button>`;
  }

  function sortCards(list, newestFirst) {
    return list.sort((a, b) => {
      const la = isLate(a) ? 0 : 1, lb = isLate(b) ? 0 : 1;
      if (la !== lb) return la - lb;
      const da = a.due ? a.due.getTime() : Infinity;
      const db = b.due ? b.due.getTime() : Infinity;
      if (da !== db) return newestFirst ? db - da : da - db;
      return a.title.localeCompare(b.title);
    });
  }

  function renderBoard() {
    const mount = q('[data-board]');
    if (!mount) return;

    if (loadError) {
      mount.className = 'twp-board twp-board--message';
      mount.innerHTML = '<div class="state">The plan could not be reached just now. Nothing is lost — press Refresh, or try again in a moment.</div>';
      return;
    }

    const list = visible();

    // Done view: one wide list, kept off the working board.
    if (doneView) {
      const items = sortCards(list.filter(isDone), true);
      const cut = items.slice(0, shown.done);
      const left = items.length - cut.length;
      mount.className = 'twp-board twp-board--done';
      mount.innerHTML = `
        <div class="twp-col__bar twp-col__bar--done">
          <span>Done</span><span class="twp-col__n">${items.length}</span>
        </div>
        <div class="twp-donegrid">
          ${cut.length ? cut.map(cardHtml).join('') : '<div class="twp-col__empty">Nothing finished yet</div>'}
        </div>
        ${left > 0 ? `<button type="button" class="twp-col__more" data-more="done">Show ${left} more</button>` : ''}`;
      wire(mount);
      return;
    }

    const buckets = { discover: [], decide: [], execute: [] };
    list.filter(s => !isDone(s)).forEach(s => buckets[s.phase].push(s));
    Object.keys(buckets).forEach(k => sortCards(buckets[k], false));

    mount.className = 'twp-board';
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
    wire(mount);
  }

  function wire(mount) {
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
