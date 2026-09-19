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

  // The labels are the spreadsheet's own values, verbatim. The sheet is
  // the source of truth for vocabulary as well as data.
  const TF_ORDER = ['22mo', '16mo', '12mo', '7mo', '3mo', '1mo', '1wk'];
  const TF_LABEL = {
    '22mo': '22 Months', '16mo': '16 Months', '12mo': '12 Months',
    '7mo': '7 Months', '3mo': '3 Months', '1mo': '1 Month', '1wk': '1 Week',
  };

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

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
  function shortDate(d) {
    if (!d) return '';
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return `${MONTHS[d.getMonth()]} ${d.getDate()}${sameYear ? '' : ', ' + d.getFullYear()}`;
  }
  const daysLate = d => d ? Math.floor((Date.now() - d.getTime()) / DAY) : 0;

  // ---- State -------------------------------------------------------------
  let subtasks = [];
  let parents = {};
  let people = [];
  let domains = [];
  let moments = [];
  let domainFilter = null;
  let momentFilter = null;
  let tfFilter = null;
  let statusFilter = null;
  let ownerFilter = null;
  let openId = null;
  let shown = { discover: PAGE, decide: PAGE, execute: PAGE, done: 24 };
  let loadedAt = null;
  let loadError = false;

  // ---- Helpers -----------------------------------------------------------
  const isDone = s => (s.status || '').toLowerCase().trim() === 'complete';
  const needsHelp = s => (s.status || '').toLowerCase().trim() === 'needs help';
  const isLate = s => !isDone(s) && s.due && s.due.getTime() < Date.now();
  const ownersOf = s => (s.assignees || []).filter(Boolean);
  function initialsFrom(name) {
    const parts = String(name || '').trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return String(name || '?').slice(0, 1).toUpperCase();
  }
  function initialsOf(name) {
    const p = people.filter(x => x.name === name)[0];
    return p ? p.initials : initialsFrom(name);
  }
  // A person as a small mark. Title carries the full name for anyone
  // hovering or using a screen reader.
  function bubbles(names) {
    return (names || []).map(n =>
      `<span class="twp-bub" title="${esc(n)}">${esc(initialsOf(n))}</span>`).join('');
  }
  // Two names fit a card; beyond that the count carries it.
  function ownersLabel(s) {
    const n = ownersOf(s);
    if (!n.length) return 'Unassigned';
    if (n.length === 1) return n[0];
    if (n.length === 2) return n[0] + ' & ' + n[1];
    return n[0] + ' +' + (n.length - 1);
  }
  const openIn = d => subtasks.filter(s => s.domain === d && !isDone(s)).length;
  const lateIn = d => subtasks.filter(s => s.domain === d && isLate(s)).length;

  // ---- Load --------------------------------------------------------------
  async function load() {
    const [ppl, tasks] = await Promise.all([
      window.TWP.api.get('people'),
      window.TWP.api.get('tasks'),
    ]);

    people = (ppl || []).map(p => ({ name: p.name, initials: p.initials || initialsFrom(p.name) }));

    if (!tasks) { loadError = true; return; }
    loadError = false;

    subtasks = [];
    parents = {};
    const seen = {};

    tasks.forEach(parent => {
      const domain = (parent.tags && parent.tags.length) ? parent.tags[0] : (parent.moment || 'Other');
      seen[domain] = true;
      const raw = (parent.phase || 'Discover').toLowerCase().trim();
      parents[parent.id] = {
        id: parent.id,
        title: parent.title,
        phase: PHASES.indexOf(raw) !== -1 ? raw : 'discover',
        timeframe: parent.timeframe,
        moment: parent.moment || '',
        domain: domain,
        notes: parent.notes || '',
      };

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

    domains = Object.keys(seen).sort();
    const mSeen = {};
    subtasks.forEach(s => { if (s.moment) mSeen[s.moment] = true; });
    moments = Object.keys(mSeen).sort();
    loadedAt = new Date();
  }

  // Status "Complete" is how you reach finished work — it is a value in
  // the sheet, not a separate mode.
  const doneView = () => (statusFilter || '').toLowerCase() === 'complete';

  function visible() {
    return subtasks.filter(s => {
      if (domainFilter && s.domain !== domainFilter) return false;
      if (momentFilter && s.moment !== momentFilter) return false;
      // Due By asks "what is due on or before this", which is the question
      // you would actually ask. Matching one bucket exactly is not.
      if (tfFilter) {
        const cut = anchorDate(tfFilter);
        if (!s.due || !cut || s.due.getTime() > cut.getTime()) return false;
      }
      if (statusFilter && (s.status || '').toLowerCase() !== statusFilter.toLowerCase()) return false;
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
  // One control per sheet column: Tag, Moment, Timeframe, Status,
  // Assignee. Nothing the sheet captures is unreachable from the page.
  function optionList(values, current, labeller) {
    return ['<option value="">All</option>'].concat(values.map(v =>
      `<option value="${esc(v)}"${v === current ? ' selected' : ''}>${esc(labeller ? labeller(v) : v)}</option>`
    )).join('');
  }

  function renderToolbar() {
    const mount = q('[data-toolbar]');
    if (!mount) return;

    const late = visible().filter(isLate).length;

    mount.innerHTML = `
      <div class="twp-filters">
        <label class="twp-filter">
          <span class="twp-filter__label">Tag</span>
          <select data-f="tag">${optionList(domains, domainFilter)}</select>
        </label>
        <label class="twp-filter">
          <span class="twp-filter__label">Moment</span>
          <select data-f="moment">${optionList(moments, momentFilter)}</select>
        </label>
        <label class="twp-filter">
          <span class="twp-filter__label">Due By</span>
          <select data-f="tf">
            <option value="">Anytime</option>
            ${TF_ORDER.map(c => `<option value="${c}"${c === tfFilter ? ' selected' : ''}>${esc(shortDate(anchorDate(c)))}</option>`).join('')}
          </select>
        </label>
        <label class="twp-filter">
          <span class="twp-filter__label">Status</span>
          <select data-f="status">${optionList(STATUSES, statusFilter)}</select>
        </label>
        <label class="twp-filter">
          <span class="twp-filter__label">Assignee</span>
          <select data-f="owner">
            <option value="">Everyone</option>
            ${people.map(p => `<option${p.name === ownerFilter ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="twp-bar__right">
        ${late ? `<span class="twp-bar__over">${late} overdue</span>` : ''}
        <button type="button" class="twp-bar__sync" data-refresh>${loadedAt ? 'Synced ' + shortTime(loadedAt) : 'Refresh'}</button>
      </div>`;

    qa('[data-f]', mount).forEach(sel => sel.addEventListener('change', e => {
      const v = e.target.value || null;
      const which = sel.dataset.f;
      if (which === 'tag')    domainFilter = v;
      if (which === 'moment') momentFilter = v;
      if (which === 'tf')     tfFilter = v;
      if (which === 'status') statusFilter = v;
      if (which === 'owner')  ownerFilter = v;
      resetPaging(); render();
    }));

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
    const owned = ownersOf(s).length > 0;
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
            <span class="twp-card__status twp-card__status--${sKey}">${esc(sLabel)}</span>
            <span class="twp-card__who${owned ? '' : ' twp-card__who--none'}">${esc(ownersLabel(s))}</span>
          </span>
          <span class="twp-card__title">${esc(s.title)}</span>
        </span>
        <span class="twp-card__foot">
          <span class="twp-card__parent">${esc(s.parentTitle)}</span>
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
    if (doneView()) {
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

    const parent = parents[sub.parentId] || { title: sub.parentTitle, phase: sub.phase, domain: sub.domain, moment: sub.moment };
    const siblings = subtasks.filter(s => s.parentId === sub.parentId);
    const doneCount = siblings.filter(isDone).length;

    // Everyone carrying any part of this deliverable, once each.
    const crew = [];
    siblings.forEach(s => ownersOf(s).forEach(n => { if (crew.indexOf(n) === -1) crew.push(n); }));

    const rows = siblings.map(s => {
      const done = isDone(s);
      const here = s.id === sub.id;
      return `
        <div class="twp-sub${done ? ' is-done' : ''}${here ? ' is-here' : ''}">
          <button type="button" class="twp-sub__box" data-toggle="${esc(s.id)}" aria-label="${done ? 'Mark not started' : 'Mark complete'}">${done ? '&#10003;' : ''}</button>
          <button type="button" class="twp-sub__title" data-jump="${esc(s.id)}">${esc(s.title)}</button>
          <span class="twp-sub__who">${bubbles(ownersOf(s))}</span>
        </div>`;
    }).join('');

    const owners = ownersOf(sub);

    body.innerHTML = `
      <span class="twp-modal__eyebrow">Deliverable</span>
      <h2 class="twp-modal__title" id="twp-modal-title">${esc(parent.title)}</h2>

      <div class="twp-facts">
        <div class="twp-fact">
          <span class="twp-fact__label">Phase</span>
          <span class="twp-fact__value twp-fact__value--${parent.phase}">${esc((parent.phase || 'discover').toUpperCase())}</span>
        </div>
        <div class="twp-fact">
          <span class="twp-fact__label">Progress</span>
          <span class="twp-fact__value">${doneCount} OF ${siblings.length}</span>
        </div>
        <div class="twp-fact">
          <span class="twp-fact__label">Where</span>
          <span class="twp-fact__value">${esc((parent.domain || '').toUpperCase())}${parent.moment ? ' · ' + esc(parent.moment.toUpperCase()) : ''}</span>
        </div>
        <div class="twp-fact">
          <span class="twp-fact__label">With</span>
          <span class="twp-fact__bubbles">${crew.length ? bubbles(crew) : '<span class="twp-fact__none">Unassigned</span>'}</span>
        </div>
      </div>

      <div class="twp-subs">
        <span class="twp-subs__label">All ${siblings.length} subtask${siblings.length === 1 ? '' : 's'}</span>
        ${rows}
      </div>

      <div class="twp-editor">
        <h3 class="twp-editor__title">${esc(sub.title)}</h3>

        <div class="twp-fields">
          <label class="twp-field">
            <span class="twp-field__label">Status</span>
            <select data-edit="Status">
              ${STATUSES.map(s => `<option${s.toLowerCase() === (sub.status || '').toLowerCase() ? ' selected' : ''}>${s}</option>`).join('')}
            </select>
          </label>
          <label class="twp-field">
            <span class="twp-field__label">Milestone</span>
            <select data-edit="Timeframe">
              ${TF_ORDER.map(c => `<option value="${c}"${c === sub.timeframe ? ' selected' : ''}>${TF_LABEL[c]}</option>`).join('')}
            </select>
          </label>
          <div class="twp-field twp-field--wide">
            <span class="twp-field__label">Owners</span>
            <div class="twp-picker" data-people>
              ${people.map(p => `
                <button type="button" class="twp-bub twp-bub--pick${owners.indexOf(p.name) !== -1 ? ' is-on' : ''}" data-person="${esc(p.name)}" title="${esc(p.name)}" aria-pressed="${owners.indexOf(p.name) !== -1}">${esc(p.initials)}</button>`).join('')}
            </div>
          </div>
          <label class="twp-field twp-field--wide">
            <span class="twp-field__label">Notes</span>
            <textarea data-edit="Notes" placeholder="Vendor, price, link, anything worth keeping">${esc(sub.notes)}</textarea>
          </label>
        </div>
      </div>`;

    // Jump between subtasks without closing
    qa('[data-jump]', body).forEach(b => b.addEventListener('click', () => openModal(b.dataset.jump)));

    // The checkbox is the fast path: tick it, it is complete
    qa('[data-toggle]', body).forEach(b => b.addEventListener('click', () => {
      const s = findSub(b.dataset.toggle);
      if (!s) return;
      commit(s, 'Status', isDone(s) ? 'Not Started' : 'Complete', (x, val) => { x.status = val; });
    }));

    // Owners: each mark toggles, and the whole list is written back
    qa('[data-person]', body).forEach(b => b.addEventListener('click', () => {
      const cur = ownersOf(sub).slice();
      const name = b.dataset.person;
      const i = cur.indexOf(name);
      if (i === -1) cur.push(name); else cur.splice(i, 1);
      commit(sub, 'Assignee', cur.join(', '), (s, val) => {
        s.assignees = val ? val.split(',').map(x => x.trim()).filter(Boolean) : [];
      });
    }));

    qa('[data-edit]', body).forEach(el => {
      el.addEventListener('change', e => {
        const field = el.dataset.edit;
        const v = e.target.value;
        if (field === 'Status')    commit(sub, 'Status',    v, (s, val) => { s.status = val; });
        if (field === 'Notes')     commit(sub, 'Notes',     v, (s, val) => { s.notes = val; });
        if (field === 'Timeframe') commit(sub, 'Timeframe', v, (s, val) => { s.timeframe = val; s.due = anchorDate(val); });
      });
    });

    modal.hidden = false;
    document.body.style.overflow = 'hidden';
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
