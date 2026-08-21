/* ==========================================================================
   The Wedding Plan — Main
   Home now opens with an orientation line + three grouped views:
     · Timeline (default) — scrub timeframes, see that timeframe's tasks
     · Person — each person's open tasks, grouped
     · Category — grouped by domain tag (Music, Flora, Food, Attire…)
   Tasks render as a checkable list. Clicking any task opens the detail modal
   (unchanged). The old status-kanban logic is preserved in main-kanban.js.
   ========================================================================== */

(async function hydrateHome() {
  if (!window.TWP || !window.TWP.api) return;

  const q  = (sel, root = document) => root.querySelector(sel);
  const qa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ------------- Load data -------------
  const [rsvp, people, timeframes, tasks] = await Promise.all([
    window.TWP.api.get('rsvp'),
    window.TWP.api.get('people'),
    window.TWP.api.get('timeframes'),
    window.TWP.api.get('tasks'),
  ]);

  // Flatten parents → subtasks (subtasks are the atoms the site works with).
  const subtasks = [];
  const parentsById = {};
  (tasks || []).forEach(parent => {
    parentsById[parent.id] = parent;
    (parent.subtasks || []).forEach(sub => {
      const rawStatus = (sub.status || 'Not Started');
      subtasks.push({
        id: sub.id,
        parentId: parent.id,
        title: sub.title,
        parent: sub.parent,
        categories: (parent.tags && parent.tags.length) ? parent.tags.slice() : [parent.moment || 'Uncategorized'],
        timeframe: parent.timeframe,
        phase: parent.phase ? parent.phase.toLowerCase() : '',
        assignees: sub.assignees && sub.assignees.length ? sub.assignees : (parent.assignees || []),
        rawStatus: rawStatus,
        status: rawStatus.toLowerCase() === 'complete' ? 'done' : 'open',
      });
    });
  });

  const NOW_TF = (timeframes || []).find(t => t.isNow) || (timeframes || [])[0] || { code: '', order: 0 };
  const NOW_ORDER = NOW_TF.order;

  const initialsOf = name => {
    const p = (people || []).find(p => p.name === name);
    return p ? p.initials : (name || '?').slice(0, 1).toUpperCase();
  };

  const STATUS_COLS = [
    { key: 'tbd',      label: 'TBD',         matches: ['tbd', 'on hold', 'paused'] },
    { key: 'not',      label: 'Not Started', matches: ['not started', ''] },
    { key: 'needs',    label: 'Needs Help',  matches: ['needs help'] },
    { key: 'progress', label: 'In Progress', matches: ['in progress'] },
    { key: 'done',     label: 'Complete',    matches: ['complete'] },
  ];
  function statusKeyOf(rawStatus) {
    const s = (rawStatus || '').toLowerCase().trim();
    const col = STATUS_COLS.find(c => c.matches.includes(s));
    return col ? col.key : 'not';
  }

  // ------------- View state -------------
  let activeView = 'timeline';   // timeline | person | category
  let activeStatus = 'all';
  let activePerson = null;   // null = everyone      // all | not | needs | progress | done
  let activeTf = NOW_TF.code;    // used by timeline view

  // ------------- Orientation line -------------
  function statusCounts() {
    const scope = applyPersonFilter(subtasks);
    const c = { all: scope.length, tbd: 0, not: 0, needs: 0, progress: 0, done: 0 };
    scope.forEach(s => { c[statusKeyOf(s.rawStatus)] += 1; });
    return c;
  }

  function renderStatusFilters() {
    const mount = q('[data-status-filters]');
    if (!mount) return;
    const c = statusCounts();
    const chips = [
      { key: 'all',      label: 'All' },
      { key: 'tbd',      label: 'TBD' },
      { key: 'not',      label: 'Not Started' },
      { key: 'progress', label: 'In Progress' },
      { key: 'needs',    label: 'Needs Help' },
      { key: 'done',     label: 'Complete' },
    ];
    mount.innerHTML = chips.map(ch =>
      `<button class="statchip statchip--${ch.key}${ch.key === activeStatus ? ' is-active' : ''}" data-status="${ch.key}">
         ${ch.label}<span class="statchip__n">${c[ch.key]}</span>
       </button>`
    ).join('');
    qa('.statchip', mount).forEach(btn => {
      btn.addEventListener('click', () => {
        activeStatus = btn.dataset.status;
        renderStatusFilters();
        renderView();
      });
    });
  }

  function renderPersonFilters() {
    const mount = q('[data-person-filters]');
    if (!mount) return;
    const counts = {};
    subtasks.forEach(t => (t.assignees || []).forEach(n => { counts[n] = (counts[n]||0)+1; }));
    const opts = [{ name: null, label: 'Everyone', n: subtasks.length }]
      .concat(rosterWithTasks().map(p => ({ name: p.name, label: p.name, n: counts[p.name]||0 })));
    mount.innerHTML = opts.map(o =>
      `<button class="statchip${o.name===activePerson?' is-active':''}" data-person="${o.name===null?'':o.name}">${o.label}<span class="statchip__n">${o.n}</span></button>`
    ).join('');
    qa('.statchip', mount).forEach(btn => {
      btn.addEventListener('click', () => {
        activePerson = btn.dataset.person || null;
        renderPersonFilters(); renderStatusFilters(); renderView();
      });
    });
  }

  function applyPersonFilter(list) {
    if (!activePerson) return list;
    return list.filter(t => (t.assignees || []).includes(activePerson));
  }

  function applyStatusFilter(list) {
    if (activeStatus === 'all') return list;
    return list.filter(t => statusKeyOf(t.rawStatus) === activeStatus);
  }

  // ------------- A single checkable task row -------------
  function taskRow(t) {
    const statusKey = statusKeyOf(t.rawStatus);
    const isDone = statusKey === 'done';
    const box = `<span class="msub__box msub__box--${statusKey}">${isDone ? '✓' : ''}</span>`;
    const bubbles = (t.assignees || []).slice(0, 3)
      .map(name => `<span class="kcard__bubble">${initialsOf(name)}</span>`).join('');
    const tf = (timeframes || []).find(x => x.code === t.timeframe);
    const isOverdue = tf && tf.order < NOW_ORDER && !isDone;
    const meta = isOverdue
      ? `<span class="kcard__overdue">${tf.label} · overdue</span>`
      : `<span class="grouprow__parent">${t.parent}</span>`;
    return `
      <div class="grouprow${isDone ? ' grouprow--done' : ''}${isOverdue ? ' grouprow--overdue' : ''}"
           data-task-id="${t.id}" data-parent-id="${t.parentId}">
        ${box}
        <span class="grouprow__title">${t.title}</span>
        ${meta}
        <span class="grouprow__bubbles">${bubbles}</span>
      </div>`;
  }

  // ------------- A titled group of rows -------------
  function groupBlock(title, count, rowsHtml) {
    return `
      <section class="group-section">
        <div class="group-section__head">${title}<span class="group-section__count">· ${count}</span></div>
        <div class="group-section__list">${rowsHtml || '<div class="kanban__empty">—</div>'}</div>
      </section>`;
  }

  // ------------- Timeline view (default) -------------
  function timelineStripHtml() {
    const dots = (timeframes || []).map(tf => {
      const isActive = tf.code === activeTf;
      const isNow = tf.isNow;
      let cls = '';
      if (tf.order < NOW_ORDER) cls = 'timeline__dot--past';
      else if (tf.order > NOW_ORDER) cls = 'timeline__dot--future';
      if (isActive) cls += ' timeline__dot--active';
      if (isNow) cls += ' timeline__dot--now';
      return `
        <button class="timeline__stop" data-tf="${tf.code}">
          <span class="timeline__dot ${cls}"></span>
          <span class="timeline__label ${isActive ? 'is-active' : ''}">${tf.label}${isNow ? '<em>NOW</em>' : ''}</span>
        </button>`;
    }).join('');
    return `<nav class="timeline" aria-label="Filter by timeframe" data-timeline><div class="timeline__line"></div>${dots}</nav>`;
  }

  function renderTimelineView() {
    // Tasks in the active timeframe, plus overdue when viewing NOW
    let rows;
    if (activeTf === NOW_TF.code) {
      const overdue = subtasks.filter(s => {
        const tf = (timeframes || []).find(t => t.code === s.timeframe);
        return tf && tf.order < NOW_ORDER && s.status !== 'done';
      });
      const current = subtasks.filter(s => s.timeframe === activeTf);
      rows = [...overdue, ...current];
    } else {
      rows = subtasks.filter(s => s.timeframe === activeTf);
    }
    rows = applyStatusFilter(rows);
    const open = rows.filter(r => r.status !== 'done');
    const done = rows.filter(r => r.status === 'done');
    const body = rows.length
      ? groupBlock('To do', open.length, open.map(taskRow).join(''))
        + (done.length ? groupBlock('Done', done.length, done.map(taskRow).join('')) : '')
      : '<div class="state">Nothing in this timeframe.</div>';
    return timelineStripHtml() + body;
  }

  // ------------- Person view -------------
  // Everyone who actually appears on a task — including names the people
  // sheet hasn't caught up with yet.
  function rosterWithTasks() {
    const known = {};
    (people || []).forEach(p => { known[p.name] = p; });
    const names = new Set();
    subtasks.forEach(s => (s.assignees || []).forEach(n => names.add(n)));
    return Array.from(names).sort().map(name => known[name] || {
      name: name,
      initials: name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase(),
    });
  }

  function renderPersonView() {
    const order = rosterWithTasks();
    const blocks = order.map(person => {
      const theirs = applyStatusFilter(subtasks.filter(s => (s.assignees || []).includes(person.name)));
      if (!theirs.length) return '';
      const open = theirs.filter(t => t.status !== 'done');
      const done = theirs.filter(t => t.status === 'done');
      const rows = [...open, ...done].map(taskRow).join('');
      const label = `${person.initials ? `<span class="kcard__bubble">${person.initials}</span> ` : ''}${person.name}`;
      return groupBlock(label, open.length, rows);
    }).filter(Boolean).join('');
    return blocks || '<div class="state">No assigned tasks yet.</div>';
  }

  // ------------- Category view -------------
  function renderCategoryView() {
    const byCat = {};
    applyStatusFilter(subtasks).forEach(s => {
      (s.categories || ['Uncategorized']).forEach(c => {
        (byCat[c] = byCat[c] || []).push(s);
      });
    });
    const cats = Object.keys(byCat).sort();
    const blocks = cats.map(cat => {
      const items = byCat[cat];
      if (!items.length) return '';
      const open = items.filter(t => t.status !== 'done');
      const done = items.filter(t => t.status === 'done');
      const rows = [...open, ...done].map(taskRow).join('');
      return groupBlock(cat, open.length, rows);
    }).filter(Boolean).join('');
    return blocks || '<div class="state">No tasks yet.</div>';
  }

  // ------------- Render the active view -------------
  function renderView() {
    const mount = q('[data-tasklist]');
    if (!mount) return;
    let html;
    if (activeView === 'person') html = renderPersonView();
    else if (activeView === 'category') html = renderCategoryView();
    else html = renderTimelineView();
    mount.innerHTML = html;

    // Wire timeline scrub (only present in timeline view)
    qa('.timeline__stop', mount).forEach(btn => {
      btn.addEventListener('click', () => { activeTf = btn.dataset.tf; renderView(); });
    });
    // Wire task rows → modal
    qa('.grouprow', mount).forEach(row => {
      row.addEventListener('click', () => openModal(row.dataset.parentId, row.dataset.taskId));
    });


  }

  // ------------- Tab bar -------------
  function renderTabs() {
    const mount = q('[data-view-tabs]');
    if (!mount) return;
    const tabs = [
      { key: 'timeline', label: 'Timeline' },
      { key: 'category', label: 'Category' },
    ];
    mount.innerHTML = tabs.map(t =>
      `<button class="viewtab${t.key === activeView ? ' is-active' : ''}" data-view="${t.key}">${t.label}</button>`
    ).join('');
    qa('.viewtab', mount).forEach(btn => {
      btn.addEventListener('click', () => {
        activeView = btn.dataset.view;
        if (activeView === 'timeline') activeTf = NOW_TF.code;
        renderTabs();
        renderView();
      });
    });
  }

  // ------------- Modal (unchanged from original) -------------
  function openModal(parentId, selectedTaskId) {
    const parent = parentsById[parentId];
    if (!parent) return;
    const modal = q('[data-modal]');
    const body = q('[data-modal-body]');
    if (!modal || !body) return;

    const phaseKey = (parent.phase || 'discover').toLowerCase();
    const statusKey = statusKeyOf(parent.status);
    const statusLabel = parent.status || 'Not Started';
    const assignees = (parent.assignees || [])
      .map(name => `<span class="kcard__bubble">${initialsOf(name)}</span>`).join('');

    const subs = (parent.subtasks || []).map(sub => {
      const subStatusKey = statusKeyOf(sub.status);
      const isDone = subStatusKey === 'done';
      const isSelected = sub.id === selectedTaskId;
      const boxCls = `msub__box msub__box--${subStatusKey}`;
      const boxContent = isDone ? '✓' : '';
      const rowCls = `msub${isDone ? ' msub--done' : ''}${isSelected ? ' msub--selected' : ''}`;
      const subBubbles = (sub.assignees || [])
        .map(name => `<span class="kcard__bubble">${initialsOf(name)}</span>`).join('');
      return `
        <div class="${rowCls}">
          <span class="${boxCls}">${boxContent}</span>
          <span class="msub__title">${sub.title}</span>
          <span class="msub__bubbles">${subBubbles}</span>
        </div>`;
    }).join('');

    const notesBlock = parent.notes ? `<p class="mtask__notes">${parent.notes}</p>` : '';

    body.innerHTML = `
      <div class="mtask__eyebrow">Parent Task</div>
      <h2 class="mtask__title" id="modal-title">${parent.title}</h2>
      ${notesBlock}
      <div class="mtask__meta">
        <div class="mtask__meta-item">
          <span class="mtask__meta-label">Phase</span>
          <span class="mtask__meta-value mtask__meta-value--${phaseKey}">${(parent.phase || 'Discover').toUpperCase()}</span>
        </div>
        <div class="mtask__meta-item">
          <span class="mtask__meta-label">Status</span>
          <span class="mtask__meta-value mtask__meta-value--${statusKey}">${statusLabel.toUpperCase()}</span>
        </div>
        ${assignees ? `
          <div class="mtask__meta-item">
            <span class="mtask__meta-label">With</span>
            <div class="kcard__assignees">${assignees}</div>
          </div>` : ''}
      </div>
      <div class="mtask__section-title">All ${parent.subtasks ? parent.subtasks.length : 0} subtasks</div>
      <div class="mtask__subs">${subs || '<div class="kanban__empty">No subtasks yet.</div>'}</div>
    `;

    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    const modal = q('[data-modal]');
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
  }
  qa('[data-modal-close]').forEach(el => el.addEventListener('click', closeModal));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // ---- Init ----
  renderTabs();
  renderPersonFilters();
  renderStatusFilters();
  renderView();
})();
