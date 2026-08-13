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
  const [rsvp, people, timeframes, subtasks] = await Promise.all([
    window.TWP.api.get('rsvp'),
    window.TWP.api.get('people'),
    window.TWP.api.get('timeframes'),
    window.TWP.api.get('subtasks'),
  ]);

  const NOW_TF = timeframes.find(t => t.isNow) || timeframes[0];
  const NOW_ORDER = NOW_TF.order;
  let activeTf = NOW_TF.code;

  // Helper: person code → name
  const nameOf = code => (people.find(p => p.code === code) || {}).name || code;

  // Helper: person code → short display code (for bubbles)
  // 'Dioris' is the underlying spreadsheet code (not to be changed);
  // display shows 'DG' (Dioris Gómez initials) so the bubble stays circle-sized.
  const displayCode = code => code === 'Dioris' ? 'DG' : code;

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

    // Count tasks per assignee code (a subtask can have multiple assignees)
    const counts = {};
    people.forEach(p => { counts[p.code] = 0; });
    current.forEach(task => {
      (task.assignees || []).forEach(code => {
        if (counts[code] != null) counts[code] += 1;
      });
    });

    // Sort by count desc, then original order (people list order)
    const sorted = [...people].sort((a, b) => {
      const diff = (counts[b.code] || 0) - (counts[a.code] || 0);
      if (diff !== 0) return diff;
      return people.indexOf(a) - people.indexOf(b);
    });

    const activeCount = sorted.filter(p => counts[p.code] > 0).length;
    if (metaEl) {
      metaEl.textContent = `${current.length} subtasks · ${activeCount} carrying`;
    }

    mount.innerHTML = sorted.map(person => {
      const n = counts[person.code] || 0;
      const isIdle = n === 0;
      return `
        <div class="assignee-col${isIdle ? ' assignee-col--idle' : ''}">
          <div class="assignee-col__count">${n}</div>
          <div class="assignee-col__bubble">${displayCode(person.code)}</div>
          <div class="assignee-col__name">${person.name}</div>
        </div>
      `;
    }).join('');
  }

  // -------------------------------------------------------
  // Task list — subtasks with parent tag pills
  // Overdue floats to top with amber marker
  // -------------------------------------------------------
  function renderTask(task) {
    const overdueCls = task.isOverdue ? ' tl-row--overdue' : '';
    const doneCls = task.status === 'done' ? ' tl-row--done' : '';

    // Left check-state indicator
    let indicator;
    if (task.status === 'done') {
      indicator = '<span class="tl-check tl-check--done">✓</span>';
    } else if (task.isOverdue) {
      indicator = '<span class="tl-check tl-check--overdue"></span>';
    } else {
      indicator = '<span class="tl-check tl-check--open"></span>';
    }

    // Assignee pills
    const assignees = (task.assignees || []).map(code => {
      return `<span class="tl-assignee">${displayCode(code)}</span>`;
    }).join('');

    // Overdue note
    const overdueNote = task.isOverdue
      ? `<span class="tl-tag-note tl-tag-note--overdue">${task.timeframe.toUpperCase()} · overdue</span>`
      : '';

    // Phase label
    const phaseCls = `tl-phase tl-phase--${task.phase}`;
    const phaseLabel = task.phase.toUpperCase();

    return `
      <div class="tl-row${overdueCls}${doneCls}">
        ${indicator}
        <div class="tl-body">
          <div class="tl-title">${task.title}</div>
          <div class="tl-tags">
            <span class="tl-tag">${task.parent}</span>
            ${overdueNote}
          </div>
        </div>
        <div class="tl-assignees">${assignees}</div>
        <span class="${phaseCls}">${phaseLabel}</span>
      </div>
    `;
  }

  function renderTaskList() {
    const mount = q('[data-tasklist]');
    const labelEl = q('[data-tasklist-label]');
    const metaEl = q('[data-tasklist-meta]');
    if (!mount) return;

    const { overdue, current } = tasksForActiveTf();
    const tfLabel = timeframes.find(t => t.code === activeTf).label;
    const isNow = activeTf === NOW_TF.code;
    labelEl.textContent = isNow ? `Alive Now · ${tfLabel} Out` : `${tfLabel} Out`;

    const openCount = current.filter(t => t.status !== 'done').length;
    metaEl.textContent = overdue.length
      ? `${overdue.length} overdue · ${openCount} open`
      : `${openCount} open`;

    const rows = [...overdue, ...current];
    if (!rows.length) {
      mount.innerHTML = '<div class="state">Nothing in this timeframe.</div>';
      return;
    }
    mount.innerHTML = rows.map(renderTask).join('');
  }

  // ---- Init ----
  renderTimeline();
  renderAssignees();
  renderTaskList();
})();
