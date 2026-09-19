/* ==========================================================================
   The Wedding Plan — Main (v3)
   Home renders as: status chips + assignee/category dropdowns · timeline rail ·
   category sections → parent deliverables → subtasks on a vertical rail.
   Complete = gold circle + gold text. Clicking a parent opens the detail modal.
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

  const parentsById = {};
  const parents = [];

  (tasks || []).forEach(parent => {
    parentsById[parent.id] = parent;
    const subs = (parent.subtasks || []).map(sub => ({
      id: sub.id,
      parentId: parent.id,
      title: sub.title,
      rawStatus: sub.status || 'Not Started',
      assignees: (sub.assignees && sub.assignees.length) ? sub.assignees : (parent.assignees || []),
    }));
    parents.push({
      id: parent.id,
      title: parent.title,
      category: (parent.tags && parent.tags.length) ? parent.tags[0] : (parent.moment || 'Uncategorized'),
      moment: parent.moment || '',
      timeframe: parent.timeframe,
      assignees: parent.assignees || [],
      subtasks: subs,
    });
  });

  const NOW_TF = (timeframes || []).find(t => t.isNow) || (timeframes || [])[0] || { code: '', order: 0, label: '' };
  const NOW_ORDER = NOW_TF.order;

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

  const initialsOf = name => {
    const p = (people || []).find(p => p.name === name);
    return p ? p.initials : (name || '?').slice(0, 1).toUpperCase();
  };

  // ------------- Filter state -------------
  let activeStatus   = 'all';
  let activePerson   = null;   // null = everyone
  let activeCategory = null;   // null = all categories
  let activeTf       = NOW_TF.code;

  const allSubtasks = () => parents.reduce((acc, p) => acc.concat(p.subtasks), []);

  function tfOrderOf(code) {
    const tf = (timeframes || []).find(t => t.code === code);
    return tf ? tf.order : 0;
  }
  function tfLabelOf(code) {
    const tf = (timeframes || []).find(t => t.code === code);
    return tf ? tf.label : (code || '').toUpperCase();
  }
  function isOverdueParent(p) {
    return tfOrderOf(p.timeframe) < NOW_ORDER
        && p.subtasks.some(s => statusKeyOf(s.rawStatus) !== 'done');
  }

  // ------------- Chips + dropdowns -------------
  function statusCounts() {
    const scope = allSubtasks().filter(s => !activePerson || (s.assignees || []).includes(activePerson));
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
      { key: 'not',      label: 'Not Started' },
      { key: 'progress', label: 'In Progress' },
      { key: 'needs',    label: 'Needs Help' },
      { key: 'tbd',      label: 'TBD' },
      { key: 'done',     label: 'Complete' },
    ];
    mount.innerHTML = chips.map(ch =>
      `<button class="trk-chip${ch.key === activeStatus ? ' is-active' : ''}" data-status="${ch.key}">${ch.label} <span class="trk-chip__n">${c[ch.key]}</span></button>`
    ).join('');
    qa('.trk-chip', mount).forEach(btn => {
      btn.addEventListener('click', () => {
        activeStatus = btn.dataset.status;
        renderStatusFilters();
        renderView();
      });
    });
  }

  function renderSelects() {
    const personMount = q('[data-assignee-select]');
    const catMount = q('[data-category-select]');

    if (personMount) {
      const names = new Set();
      allSubtasks().forEach(s => (s.assignees || []).forEach(n => names.add(n)));
      const opts = ['<option value="">All assignees</option>']
        .concat(Array.from(names).sort().map(n =>
          `<option value="${n}"${n === activePerson ? ' selected' : ''}>${n}</option>`));
      personMount.innerHTML = `<select class="trk-select" aria-label="Filter by assignee">${opts.join('')}</select>`;
      q('select', personMount).addEventListener('change', e => {
        activePerson = e.target.value || null;
        renderStatusFilters();
        renderView();
      });
    }

    if (catMount) {
      const cats = Array.from(new Set(parents.map(p => p.category))).sort();
      const opts = ['<option value="">All categories</option>']
        .concat(cats.map(c => `<option value="${c}"${c === activeCategory ? ' selected' : ''}>${c}</option>`));
      catMount.innerHTML = `<select class="trk-select" aria-label="Filter by category">${opts.join('')}</select>`;
      q('select', catMount).addEventListener('change', e => {
        activeCategory = e.target.value || null;
        renderView();
      });
    }
  }

  // ------------- Timeline rail -------------
  function timelineHtml() {
    const stops = (timeframes || []).map(tf => {
      let cls = '';
      if (tf.order < NOW_ORDER) cls = 'trk-tl__dot--past';
      else if (tf.order > NOW_ORDER) cls = 'trk-tl__dot--future';
      if (tf.isNow) cls += ' trk-tl__dot--now';
      if (tf.code === activeTf) cls += ' trk-tl__dot--active';
      return `
        <button class="trk-tl__stop" data-tf="${tf.code}">
          <span class="trk-tl__dot ${cls}"></span>
          <span class="trk-tl__label${tf.code === activeTf ? ' is-active' : ''}">${tf.label}${tf.isNow ? '<em>NOW</em>' : ''}</span>
        </button>`;
    }).join('');
    const pastCount = (timeframes || []).filter(t => t.order <= NOW_ORDER).length;
    const total = Math.max(1, (timeframes || []).length - 1);
    const pct = Math.min(100, ((pastCount - 1) / total) * 100);
    return `
      <nav class="trk-tl" aria-label="Filter by timeframe" data-timeline>
        <div class="trk-tl__line"></div>
        <div class="trk-tl__line trk-tl__line--filled" style="width:${pct}%"></div>
        ${stops}
      </nav>`;
  }

  // ------------- Filtering -------------
  function visibleParents() {
    return parents.filter(p => {
      if (activeCategory && p.category !== activeCategory) return false;
      if (p.timeframe !== activeTf && !(activeTf === NOW_TF.code && isOverdueParent(p))) return false;
      return visibleSubtasks(p).length > 0;
    });
  }

  function visibleSubtasks(p) {
    return p.subtasks.filter(s => {
      if (activePerson && !(s.assignees || []).includes(activePerson)) return false;
      if (activeStatus !== 'all' && statusKeyOf(s.rawStatus) !== activeStatus) return false;
      return true;
    });
  }

  // ------------- Rendering -------------
  function subtaskRow(s) {
    const isDone = statusKeyOf(s.rawStatus) === 'done';
    const owner = (s.assignees && s.assignees.length) ? s.assignees[0] : '';
    return `
      <div class="trk-sub${isDone ? ' trk-sub--done' : ''}">
        <span class="trk-sub__dot"></span>
        <span class="trk-sub__title">${s.title}</span>
        ${(!isDone && owner) ? `<span class="trk-sub__owner">${owner}</span>` : ''}
      </div>`;
  }

  function parentBlock(p) {
    const subs = visibleSubtasks(p);
    const doneCount = p.subtasks.filter(s => statusKeyOf(s.rawStatus) === 'done').length;
    const total = p.subtasks.length;
    const pct = total ? (doneCount / total) * 100 : 0;
    const meta = [tfLabelOf(p.timeframe), p.moment].filter(Boolean).join(' · ');
    return `
      <div class="trk-parent" data-parent-id="${p.id}">
        <div class="trk-parent__head">
          <span class="trk-parent__title">${p.title}</span>
          <span class="trk-parent__count">${doneCount} / ${total}</span>
          <span class="trk-parent__meta">${meta}</span>
        </div>
        <div class="trk-rail">
          <span class="trk-rail__line"></span>
          <span class="trk-rail__line trk-rail__line--filled" style="height:${pct}%"></span>
          ${subs.map(subtaskRow).join('')}
        </div>
      </div>`;
  }

  function sectionBlock(label, count, parentsHtml) {
    return `
      <section class="trk-section">
        <h2 class="trk-section__head">${label} <span class="trk-section__count">${count}</span></h2>
        ${parentsHtml}
      </section>`;
  }

  function renderView() {
    const mount = q('[data-tasklist]');
    if (!mount) return;

    const list = visibleParents();
    if (!list.length) {
      mount.innerHTML = timelineHtml() + '<div class="state">Nothing matches these filters.</div>';
      wireTimeline(mount);
      return;
    }

    const overdue = list.filter(isOverdueParent);
    const current = list.filter(p => !isOverdueParent(p));

    const byCat = {};
    current.forEach(p => { (byCat[p.category] = byCat[p.category] || []).push(p); });

    let html = timelineHtml();

    if (overdue.length) {
      const n = overdue.reduce((a, p) => a + visibleSubtasks(p).length, 0);
      html += sectionBlock('Overdue', n, overdue.map(parentBlock).join(''));
    }

    Object.keys(byCat).sort().forEach(cat => {
      const group = byCat[cat];
      const n = group.reduce((a, p) => a + visibleSubtasks(p).length, 0);
      html += sectionBlock(cat, n, group.map(parentBlock).join(''));
    });

    mount.innerHTML = html;
    wireTimeline(mount);

    qa('.trk-parent__head', mount).forEach(head => {
      head.addEventListener('click', () => {
        openModal(head.closest('.trk-parent').dataset.parentId);
      });
    });
  }

  function wireTimeline(mount) {
    qa('.trk-tl__stop', mount).forEach(btn => {
      btn.addEventListener('click', () => { activeTf = btn.dataset.tf; renderView(); });
    });
  }

  // ------------- Modal -------------
  function openModal(parentId) {
    const parent = parentsById[parentId];
    if (!parent) return;
    const modal = q('[data-modal]');
    const body = q('[data-modal-body]');
    if (!modal || !body) return;

    const local = parents.find(p => p.id === parentId);
    const total = local ? local.subtasks.length : 0;
    const doneCount = local ? local.subtasks.filter(s => statusKeyOf(s.rawStatus) === 'done').length : 0;
    const pct = total ? Math.round((doneCount / total) * 100) : 0;

    const subs = (local ? local.subtasks : []).map(sub => {
      const isDone = statusKeyOf(sub.rawStatus) === 'done';
      const owner = (sub.assignees && sub.assignees.length) ? sub.assignees[0] : '';
      return `
        <div class="trk-sub${isDone ? ' trk-sub--done' : ''}">
          <span class="trk-sub__dot"></span>
          <span class="trk-sub__title">${sub.title}</span>
          ${(!isDone && owner) ? `<span class="trk-sub__owner">${owner}</span>` : ''}
        </div>`;
    }).join('');

    body.innerHTML = `
      <div class="trk-modal__eyebrow">${local ? local.category : ''}${local && local.moment ? ' · ' + local.moment : ''}</div>
      <h2 class="trk-modal__title" id="modal-title">${parent.title}</h2>

      <div class="trk-modal__meta">
        <div><span class="trk-modal__label">Timeframe</span><span class="trk-modal__value">${tfLabelOf(local ? local.timeframe : '')}</span></div>
        <div><span class="trk-modal__label">Phase</span><span class="trk-modal__value">${parent.phase || '—'}</span></div>
        <div><span class="trk-modal__label">Status</span><span class="trk-modal__value">${parent.status || 'Not Started'}</span></div>
        <div><span class="trk-modal__label">Owners</span><span class="trk-modal__value">${(parent.assignees || []).join(' · ') || '—'}</span></div>
      </div>

      <div class="trk-modal__progress">
        <div class="trk-modal__progress-head"><span>Progress</span><span class="trk-modal__progress-n">${doneCount} of ${total}</span></div>
        <div class="trk-modal__progress-bar"><span style="width:${pct}%"></span></div>
      </div>

      ${parent.notes ? `<p class="trk-modal__notes">${parent.notes}</p>` : ''}

      <div class="trk-modal__subhead">Subtasks · ${total}</div>
      <div class="trk-rail trk-rail--modal">
        <span class="trk-rail__line"></span>
        <span class="trk-rail__line trk-rail__line--filled" style="height:${pct}%"></span>
        ${subs || '<div class="state">No subtasks yet.</div>'}
      </div>
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
  renderStatusFilters();
  renderSelects();
  renderView();
})();
