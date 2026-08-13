/* ==========================================================================
   The Wedding Plan — Main
   Renders: RSVP donut · timeline strip · three category pies · task list.
   Task list groups by timeframe (default: NOW), overdue floats to top.
   ========================================================================== */

(async function hydrateHome() {
  if (!window.TWP || !window.TWP.api) return;

  const q = (sel, root = document) => root.querySelector(sel);
  const qa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ------------- Load data -------------
  const [rsvp, people, timeframes, tasks] = await Promise.all([
    window.TWP.api.get('rsvp'),
    window.TWP.api.get('people'),
    window.TWP.api.get('timeframes'),
    window.TWP.api.get('tasks'),
  ]);

  // Flatten parents → subtasks. Each subtask inherits its parent's timeframe,
  // phase, and any tags/moment/category. The site treats subtasks as the atoms.
  const subtasks = [];
  const parentsById = {};  // for modal lookup
  (tasks || []).forEach(parent => {
    parentsById[parent.id] = parent;
    (parent.subtasks || []).forEach(sub => {
      const rawStatus = (sub.status || 'Not Started');
      subtasks.push({
        id: sub.id,
        parentId: parent.id,
        title: sub.title,
        parent: sub.parent,
        category: (parent.tags && parent.tags[0]) || parent.moment || '',
        timeframe: parent.timeframe,
        phase: parent.phase ? parent.phase.toLowerCase() : '',
        assignees: sub.assignees && sub.assignees.length ? sub.assignees : (parent.assignees || []),
        rawStatus: rawStatus,
        status: rawStatus.toLowerCase() === 'complete' ? 'done' : 'open',
      });
    });
  });

  const NOW_TF = timeframes.find(t => t.isNow) || timeframes[0];
  const NOW_ORDER = NOW_TF.order;
  let activeTf = NOW_TF.code;

  // People are stored as full names in the spreadsheet.
  // Site displays the `initials` field from the API on the bubbles.
  const initialsOf = name => {
    const p = people.find(p => p.name === name);
    return p ? p.initials : name.slice(0, 1).toUpperCase();
  };
  const nameOf = name => name;  // no-op: assignees are already full names
  const displayCode = name => initialsOf(name);

  // -------------------------------------------------------
  // RSVP donut (header, top-right)
  // Colors: forest confirmed · navy declined · soft gold awaiting
  // -------------------------------------------------------
  function drawRsvp() {
    const card = q('[data-chart="rsvp"]');
    if (!card || !rsvp) return;
    const total = rsvp.total || 0;
    if (!total) return;

    let offset = 25;
    ['confirmed', 'declined'].forEach(key => {
      const value = rsvp[key] || 0;
      const pct = (value / total) * 100;
      const seg = q(`[data-seg="${key}"]`, card);
      if (seg) {
        seg.setAttribute('stroke-dasharray', `${pct} ${100 - pct}`);
        seg.setAttribute('stroke-dashoffset', String(offset));
      }
      offset = ((offset - pct) % 100 + 100) % 100;
    });

    q('[data-total]', card).textContent = total;
    ['confirmed', 'declined', 'awaiting'].forEach(key => {
      const el = q(`[data-legend="${key}"]`, card);
      if (el) el.textContent = rsvp[key] ?? 0;
    });
  }
  drawRsvp();

  // -------------------------------------------------------
  // Timeline strip
  // -------------------------------------------------------
  function renderTimeline() {
    const mount = q('[data-timeline]');
    if (!mount) return;

    const dots = timeframes.map(tf => {
      const isActive = tf.code === activeTf;
      const isNow = tf.isNow;
      let stateClass = '';
      if (tf.order < NOW_ORDER) stateClass = 'timeline__dot--past';
      else if (tf.order > NOW_ORDER) stateClass = 'timeline__dot--future';
      if (isActive) stateClass += ' timeline__dot--active';
      if (isNow) stateClass += ' timeline__dot--now';

      return `
        <button class="timeline__stop" data-tf="${tf.code}">
          <span class="timeline__dot ${stateClass}"></span>
          <span class="timeline__label ${isActive ? 'is-active' : ''}">${tf.label}${isNow ? '<em>NOW</em>' : ''}</span>
        </button>
      `;
    }).join('');

    mount.innerHTML = `<div class="timeline__line"></div>${dots}`;
    qa('.timeline__stop', mount).forEach(btn => {
      btn.addEventListener('click', () => {
        activeTf = btn.dataset.tf;
        renderTimeline();
        renderAssignees();
        renderTaskList();
      });
    });
  }

  // -------------------------------------------------------
  // Get tasks for the active timeframe (plus overdue if viewing NOW)
  // -------------------------------------------------------
  function tasksForActiveTf() {
    if (activeTf === NOW_TF.code) {
      // Include overdue: any open subtask whose timeframe is past NOW
      const overdue = subtasks.filter(s => {
        const tf = timeframes.find(t => t.code === s.timeframe);
        return tf && tf.order < NOW_ORDER && s.status !== 'done';
      }).map(s => ({ ...s, isOverdue: true }));
      const current = subtasks.filter(s => s.timeframe === activeTf).map(s => ({ ...s, isOverdue: false }));
      return { overdue, current };
    }
    return {
      overdue: [],
      current: subtasks.filter(s => s.timeframe === activeTf),
    };
  }

  // -------------------------------------------------------
  // Assignee columns — one per person, sorted by task count desc
  // People with zero tasks in this timeframe are dimmed
  // -------------------------------------------------------
  function renderAssignees() {
    const mount = q('[data-assignees]');
    const metaEl = q('[data-assignees-meta]');
    if (!mount) return;

    const { current } = tasksForActiveTf();

    // Count tasks per assignee name (a subtask can have multiple assignees)
    const counts = {};
    people.forEach(p => { counts[p.name] = 0; });
    current.forEach(task => {
      (task.assignees || []).forEach(name => {
        if (counts[name] != null) counts[name] += 1;
      });
    });

    // Sort by count desc, then original order (people list order)
    const sorted = [...people].sort((a, b) => {
      const diff = (counts[b.name] || 0) - (counts[a.name] || 0);
      if (diff !== 0) return diff;
      return people.indexOf(a) - people.indexOf(b);
    });

    const activeCount = sorted.filter(p => counts[p.name] > 0).length;
    if (metaEl) {
      metaEl.textContent = `${current.length} subtasks · ${activeCount} carrying`;
    }

    mount.innerHTML = sorted.map(person => {
      const n = counts[person.name] || 0;
      const isIdle = n === 0;
      return `
        <div class="assignee-col${isIdle ? ' assignee-col--idle' : ''}">
          <div class="assignee-col__count">${n}</div>
          <div class="assignee-col__bubble">${person.initials}</div>
          <div class="assignee-col__name">${person.name}</div>
        </div>
      `;
    }).join('');
  }

  // -------------------------------------------------------
  // Kanban task board — 4 columns by status
  // -------------------------------------------------------
  const STATUS_COLS = [
    { key: 'not',      label: 'Not Started',  matches: ['not started', ''] },
    { key: 'needs',    label: 'Needs Help',   matches: ['needs help'] },
    { key: 'progress', label: 'In Progress',  matches: ['in progress'] },
    { key: 'done',     label: 'Complete',     matches: ['complete'] },
  ];

  function statusKeyOf(rawStatus) {
    const s = (rawStatus || '').toLowerCase().trim();
    const col = STATUS_COLS.find(c => c.matches.includes(s));
    return col ? col.key : 'not';
  }

  function renderKanbanCard(task) {
    const statusKey = statusKeyOf(task.rawStatus);
    const bubbles = (task.assignees || []).slice(0, 3).map(name => {
      return `<span class="kcard__bubble">${initialsOf(name)}</span>`;
    }).join('');
    return `
      <div class="kcard kcard--${statusKey}" data-task-id="${task.id}" data-parent-id="${task.parentId}">
        <div class="kcard__title">${task.title}</div>
        <div class="kcard__foot">
          <span class="kcard__parent">${task.parent}</span>
          <div class="kcard__assignees">${bubbles}</div>
        </div>
      </div>
    `;
  }

  function renderTaskList() {
    const mount = q('[data-tasklist]');
    const metaEl = q('[data-tasklist-meta]');
    if (!mount) return;

    const { overdue, current } = tasksForActiveTf();
    // Overdue subtasks (from earlier timeframes still open) belong at the top
    // of Needs Help / In Progress / Not Started based on their real status.
    const all = [...overdue, ...current];

    // Bucket by status column
    const buckets = { needs: [], progress: [], not: [], done: [] };
    all.forEach(t => {
      const key = statusKeyOf(t.rawStatus);
      buckets[key].push(t);
    });

    const openCount = all.filter(t => t.status !== 'done').length;
    metaEl.textContent = overdue.length
      ? `${overdue.length} overdue · ${openCount} open`
      : `${openCount} open`;

    if (!all.length) {
      mount.innerHTML = '<div class="state">Nothing in this timeframe.</div>';
      return;
    }

    mount.innerHTML = `
      <div class="kanban kanban--split">
        ${STATUS_COLS.map(col => {
          const items = buckets[col.key];
          const cards = items.length
            ? items.map(renderKanbanCard).join('')
            : '<div class="kanban__empty">—</div>';
          return `
            <section class="tasklist-card kanban__card kanban__card--${col.key}">
              <div class="kanban__head kanban__head--${col.key}">
                ${col.label}<span class="kanban__count">· ${items.length}</span>
              </div>
              <div class="kanban__list">${cards}</div>
            </section>
          `;
        }).join('')}
      </div>
    `;

    // Wire card clicks to open the modal
    qa('.kcard', mount).forEach(card => {
      card.addEventListener('click', () => {
        const parentId = card.dataset.parentId;
        const selectedTaskId = card.dataset.taskId;
        openModal(parentId, selectedTaskId);
      });
    });
  }

  // -------------------------------------------------------
  // Modal — full parent task detail with all subtasks
  // -------------------------------------------------------
  function openModal(parentId, selectedTaskId) {
    const parent = parentsById[parentId];
    if (!parent) return;
    const modal = q('[data-modal]');
    const body = q('[data-modal-body]');
    if (!modal || !body) return;

    const phaseKey = (parent.phase || 'discover').toLowerCase();
    const statusKey = statusKeyOf(parent.status);
    const statusLabel = parent.status || 'Not Started';

    const assignees = (parent.assignees || []).map(name => {
      return `<span class="kcard__bubble">${initialsOf(name)}</span>`;
    }).join('');

    const subs = (parent.subtasks || []).map(sub => {
      const subStatusKey = statusKeyOf(sub.status);
      const isDone = subStatusKey === 'done';
      const isSelected = sub.id === selectedTaskId;
      const boxCls = `msub__box msub__box--${subStatusKey}`;
      const boxContent = isDone ? '✓' : '';
      const rowCls = `msub${isDone ? ' msub--done' : ''}${isSelected ? ' msub--selected' : ''}`;
      const subBubbles = (sub.assignees || []).map(name => {
        return `<span class="kcard__bubble">${initialsOf(name)}</span>`;
      }).join('');
      return `
        <div class="${rowCls}">
          <span class="${boxCls}">${boxContent}</span>
          <span class="msub__title">${sub.title}</span>
          <span class="msub__bubbles">${subBubbles}</span>
        </div>
      `;
    }).join('');

    const notesBlock = parent.notes
      ? `<p class="mtask__notes">${parent.notes}</p>`
      : '';

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
          </div>
        ` : ''}
      </div>
      <div class="mtask__section-title">All ${parent.subtasks ? parent.subtasks.length : 0} subtasks</div>
      <div class="mtask__subs">${subs || '<div class="kanban__empty">No subtasks yet.</div>'}</div>
    `;

    modal.hidden = false;
    document.body.style.overflow = 'hidden';  // prevent bg scroll
  }

  function closeModal() {
    const modal = q('[data-modal]');
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  // Modal close handlers (backdrop + × button + Esc)
  qa('[data-modal-close]').forEach(el => el.addEventListener('click', closeModal));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // ---- Init ----
  renderTimeline();
  renderAssignees();
  renderTaskList();
})();
