/* ==========================================================================
   The Wedding Plan — Tracker (v4)
   Left: a permanent index of deliverables, grouped by category.
   Right: the queue by default, or one deliverable's subtasks.
   A subtask row is read-only until clicked; clicking expands it in place
   with editable owner, status, timeframe and notes. The circle toggles
   complete without opening anything. Every write posts to the sheet.
   ========================================================================== */

(async function tracker() {
  if (!window.TWP || !window.TWP.api) return;

  const q  = (sel, root = document) => root.querySelector(sel);
  const qa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const WEDDING = new Date('2027-07-07T16:00:00-04:00');

  // ------------- Load -------------
  const [people, timeframes, tasks] = await Promise.all([
    window.TWP.api.get('people'),
    window.TWP.api.get('timeframes'),
    window.TWP.api.get('tasks'),
  ]);

  const PEOPLE = (people || []).map(p => p.name);
  const TFS = (timeframes || []);
  const NOW_TF = TFS.find(t => t.isNow) || TFS[0] || { code: '', order: 0, label: '' };

  const STATUSES = ['Not Started', 'In Progress', 'Needs Help', 'TBD', 'Complete'];
  const isDone = s => (s || '').toLowerCase().trim() === 'complete';

  // Months each timeframe sits before the wedding — used to place NOW truthfully.
  const TF_MONTHS = { '22mo': 22, '16mo': 16, '12mo': 12, '7mo': 7, '3mo': 3, '1mo': 1, '1wk': 0.25 };

  const deliverables = (tasks || []).map(p => ({
    id: p.id,
    title: p.title,
    category: (p.tags && p.tags.length) ? p.tags[0] : (p.moment || 'Uncategorized'),
    moment: p.moment || '',
    timeframe: p.timeframe,
    phase: p.phase || '',
    notes: p.notes || '',
    assignees: p.assignees || [],
    subtasks: (p.subtasks || []).map(s => ({
      id: s.id,
      parentId: p.id,
      title: s.title,
      status: s.status || 'Not Started',
      notes: s.notes || '',
      timeframe: s.timeframe || p.timeframe,
      assignees: (s.assignees && s.assignees.length) ? s.assignees : (p.assignees || []),
    })),
  }));

  const byId = {};
  deliverables.forEach(d => { byId[d.id] = d; });

  function tfLabel(code) {
    const tf = TFS.find(t => t.code === code);
    return tf ? tf.label : String(code || '').toUpperCase();
  }
  function tfOrder(code) {
    const tf = TFS.find(t => t.code === code);
    return tf ? tf.order : 99;
  }
  function isOverdue(sub) {
    return tfOrder(sub.timeframe) < NOW_TF.order && !isDone(sub.status);
  }
  function progressOf(d) {
    const total = d.subtasks.length;
    const done = d.subtasks.filter(s => isDone(s.status)).length;
    return { done, total, pct: total ? (done / total) * 100 : 0 };
  }

  // ------------- State -------------
  let selectedId = null;    // null = the queue
  let openTaskId = null;    // the one expanded subtask
  let personFilter = null;
  let search = '';

  // ------------- Saving -------------
  async function save(sub, field, value) {
    const res = await window.TWP.api.post({ action: 'updateTask', id: sub.id, field: field, value: value });
    return res && res.ok !== false;
  }

  async function commit(sub, field, value, apply) {
    const before = JSON.parse(JSON.stringify(sub));
    apply(sub, value);
    render();
    const ok = await save(sub, field, value);
    if (!ok) {
      Object.assign(sub, before);
      render();
      flash('Could not save. The change was undone.');
    }
  }

  function flash(msg) {
    const el = q('[data-flash]');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    setTimeout(() => { el.hidden = true; }, 4000);
  }

  // ------------- Index pane -------------
  function renderIndex() {
    const mount = q('[data-index]');
    if (!mount) return;

    const byCat = {};
    deliverables.forEach(d => {
      if (search && !(d.title + ' ' + d.category).toLowerCase().includes(search)) return;
      (byCat[d.category] = byCat[d.category] || []).push(d);
    });

    const groups = Object.keys(byCat).sort().map(cat => {
      const rows = byCat[cat].map(d => {
        const pr = progressOf(d);
        const complete = pr.total && pr.done === pr.total;
        const overdue = d.subtasks.some(isOverdue);
        const cls = ['twp-idx__item'];
        if (d.id === selectedId) cls.push('is-active');
        if (complete) cls.push('is-complete');
        return `<button class="${cls.join(' ')}" data-select="${d.id}">
            <span class="twp-idx__name">${esc(d.title)}</span>
            <span class="twp-idx__n${overdue ? ' is-overdue' : ''}">${pr.done}/${pr.total}</span>
          </button>`;
      }).join('');
      return `<div class="twp-idx__group"><div class="twp-idx__cat">${esc(cat)}</div>${rows}</div>`;
    }).join('');

    mount.innerHTML = `
      <button class="twp-idx__item twp-idx__item--queue${selectedId === null ? ' is-active' : ''}" data-select="">Everything due</button>
      <input class="twp-idx__search" type="search" placeholder="Search" value="${esc(search)}" data-search>
      ${groups || '<div class="twp-idx__empty">No matches.</div>'}
    `;

    qa('[data-select]', mount).forEach(btn => {
      btn.addEventListener('click', () => {
        selectedId = btn.dataset.select || null;
        openTaskId = null;
        render();
      });
    });
    const s = q('[data-search]', mount);
    if (s) {
      s.addEventListener('input', e => {
        search = e.target.value.trim().toLowerCase();
        renderIndex();
        q('[data-search]').focus();
      });
    }
  }

  // ------------- Timeline -------------
  function timelineHtml() {
    const codes = TFS.map(t => t.code);
    const days = Math.max(0, Math.round((WEDDING - new Date()) / 86400000));
    const monthsOut = days / 30.44;

    let pct = 0;
    for (let i = 0; i < codes.length - 1; i++) {
      const a = TF_MONTHS[codes[i]], b = TF_MONTHS[codes[i + 1]];
      if (monthsOut <= a && monthsOut >= b) {
        const within = (a - monthsOut) / (a - b);
        pct = ((i + within) / (codes.length - 1)) * 100;
        break;
      }
      if (monthsOut < TF_MONTHS[codes[codes.length - 1]]) pct = 100;
    }
    pct = Math.max(0, Math.min(100, pct));

    const stops = TFS.map((tf, i) => {
      const left = (i / (TFS.length - 1)) * 100;
      const past = TF_MONTHS[tf.code] > monthsOut;
      return `<span class="twp-tl__stop" style="left:${left}%">
          <span class="twp-tl__dot${past ? ' is-past' : ''}"></span>
          <span class="twp-tl__label">${tf.label}</span>
        </span>`;
    }).join('');

    return `
      <div class="twp-tl">
        <span class="twp-tl__line"></span>
        <span class="twp-tl__line twp-tl__line--filled" style="width:${pct}%"></span>
        <span class="twp-tl__head" style="left:${pct}%"><span class="twp-tl__head-dot"></span><span class="twp-tl__head-label">${days} days</span></span>
        ${stops}
      </div>`;
  }

  // ------------- Rows -------------
  function rowHtml(sub) {
    const done = isDone(sub.status);
    const over = isOverdue(sub);
    const owner = (sub.assignees && sub.assignees.length) ? sub.assignees[0] : 'Unassigned';
    const open = sub.id === openTaskId;

    const note = sub.notes ? `<span class="twp-row__note">${esc(sub.notes)}</span>` : '';

    const editor = open ? `
      <div class="twp-edit">
        <label class="twp-edit__field">
          <span class="twp-edit__label">Owner</span>
          <select data-edit="owner" data-id="${sub.id}">
            <option value=""${owner === 'Unassigned' ? ' selected' : ''}>Unassigned</option>
            ${PEOPLE.map(n => `<option${n === owner ? ' selected' : ''}>${esc(n)}</option>`).join('')}
          </select>
        </label>
        <label class="twp-edit__field">
          <span class="twp-edit__label">Status</span>
          <select data-edit="status" data-id="${sub.id}">
            ${STATUSES.map(s => `<option${s.toLowerCase() === (sub.status || '').toLowerCase() ? ' selected' : ''}>${s}</option>`).join('')}
          </select>
        </label>
        <label class="twp-edit__field">
          <span class="twp-edit__label">Timeframe</span>
          <select data-edit="timeframe" data-id="${sub.id}">
            ${TFS.map(t => `<option value="${t.code}"${t.code === sub.timeframe ? ' selected' : ''}>${t.label}</option>`).join('')}
          </select>
        </label>
        <label class="twp-edit__field twp-edit__field--wide">
          <span class="twp-edit__label">Notes</span>
          <textarea rows="2" data-edit="notes" data-id="${sub.id}">${esc(sub.notes)}</textarea>
        </label>
      </div>` : '';

    return `
      <div class="twp-row${done ? ' is-done' : ''}${open ? ' is-open' : ''}" data-row="${sub.id}">
        <button class="twp-row__circle" data-toggle="${sub.id}" aria-label="Mark complete"></button>
        <button class="twp-row__main" data-open="${sub.id}">
          <span class="twp-row__title">${esc(sub.title)}</span>
          ${note}
        </button>
        <span class="twp-row__owner">${esc(owner)}</span>
        <span class="twp-row__due${over ? ' is-overdue' : ''}">${tfLabel(sub.timeframe)}</span>
        ${editor}
      </div>`;
  }

  function rowsHead() {
    return `<div class="twp-head">
        <span class="twp-head__task">Task</span>
        <span class="twp-head__owner">Owner</span>
        <span class="twp-head__due">Due</span>
      </div>`;
  }

  // ------------- Workspace: the queue -------------
  function queueHtml() {
    let subs = [];
    deliverables.forEach(d => d.subtasks.forEach(s => subs.push(s)));
    if (personFilter) subs = subs.filter(s => (s.assignees || []).includes(personFilter));

    const overdue = subs.filter(isOverdue);
    const dueNow = subs.filter(s => s.timeframe === NOW_TF.code && !isDone(s.status));
    const done = subs.filter(s => isDone(s.status));

    const list = [...overdue, ...dueNow];

    const peopleOpts = ['<option value="">Everyone</option>']
      .concat(PEOPLE.map(n => `<option${n === personFilter ? ' selected' : ''}>${esc(n)}</option>`)).join('');

    return `
      <div class="twp-stats">
        <div class="twp-stat"><span class="twp-stat__n twp-stat__n--over">${overdue.length}</span><span class="twp-stat__label">Overdue</span></div>
        <div class="twp-stat"><span class="twp-stat__n">${dueNow.length}</span><span class="twp-stat__label">Due now</span></div>
        <div class="twp-stat"><span class="twp-stat__n twp-stat__n--done">${done.length}</span><span class="twp-stat__label">Done</span></div>
        <label class="twp-stats__filter"><select data-person>${peopleOpts}</select></label>
      </div>
      ${timelineHtml()}
      ${rowsHead()}
      ${list.length ? list.map(rowHtml).join('') : '<div class="state">Nothing due right now.</div>'}
    `;
  }

  // ------------- Workspace: one deliverable -------------
  function deliverableHtml(d) {
    const pr = progressOf(d);
    const meta = [tfLabel(d.timeframe), d.moment, (d.assignees || []).join(' & ')].filter(Boolean).join(' · ');
    return `
      <div class="twp-deliv">
        <h2 class="twp-deliv__title">${esc(d.title)}</h2>
        <div class="twp-deliv__meta">${esc(meta)}</div>
        <div class="twp-deliv__bar"><span style="width:${pr.pct}%"></span></div>
        <div class="twp-deliv__count">${pr.done} of ${pr.total} complete</div>
        ${d.notes ? `<p class="twp-deliv__notes">${esc(d.notes)}</p>` : ''}
      </div>
      ${rowsHead()}
      ${d.subtasks.map(rowHtml).join('')}
    `;
  }

  // ------------- Render -------------
  function render() {
    renderIndex();
    const mount = q('[data-workspace]');
    if (!mount) return;
    const d = selectedId ? byId[selectedId] : null;
    mount.innerHTML = d ? deliverableHtml(d) : queueHtml();
    wireWorkspace(mount);
  }

  function findSub(id) {
    for (const d of deliverables) {
      const s = d.subtasks.find(x => x.id === id);
      if (s) return s;
    }
    return null;
  }

  function wireWorkspace(mount) {
    const person = q('[data-person]', mount);
    if (person) person.addEventListener('change', e => {
      personFilter = e.target.value || null;
      render();
    });

    qa('[data-toggle]', mount).forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const sub = findSub(btn.dataset.toggle);
        if (!sub) return;
        const next = isDone(sub.status) ? 'Not Started' : 'Complete';
        commit(sub, 'Status', next, (s, v) => { s.status = v; });
      });
    });

    qa('[data-open]', mount).forEach(btn => {
      btn.addEventListener('click', () => {
        openTaskId = (openTaskId === btn.dataset.open) ? null : btn.dataset.open;
        render();
      });
    });

    qa('[data-edit]', mount).forEach(el => {
      const sub = findSub(el.dataset.id);
      if (!sub) return;
      const field = el.dataset.edit;
      const evt = el.tagName === 'TEXTAREA' ? 'change' : 'change';
      el.addEventListener(evt, e => {
        const v = e.target.value;
        if (field === 'owner') commit(sub, 'Assignee', v, (s, val) => { s.assignees = val ? [val] : []; });
        if (field === 'status') commit(sub, 'Status', v, (s, val) => { s.status = val; });
        if (field === 'timeframe') commit(sub, 'Timeframe', v, (s, val) => { s.timeframe = val; });
        if (field === 'notes') commit(sub, 'Notes', v, (s, val) => { s.notes = val; });
      });
      el.addEventListener('click', e => e.stopPropagation());
    });
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && openTaskId) { openTaskId = null; render(); }
  });

  render();
})();
