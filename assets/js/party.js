/* ==========================================================================
   The Wedding Plan — The Team
   Two views:
   1. Group view — roster of 7 (click a bubble to enter their personal view),
      timeline strip, shared activity feed.
   2. Personal view — bio, timeline, planning tasks (from spreadsheet, filtered
      to this person), day-of duties (placeholder for now).
   Activity feed uses placeholder data until change history is added to the API.
   ========================================================================== */

(async function hydrateTeam() {
  if (!window.TWP || !window.TWP.api) return;

  const q = (sel, root = document) => root.querySelector(sel);
  const qa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // -- Roster: the 7 people who are "The Team" ----------------------------
  // Order matters — Sileni & Mane (godparents) first, then honors, then family.
  const ROSTER = [
    {
      name: 'Sileni',
      initials: 'S',
      role: 'Madrina · Matron of Honor',
      bio: 'The godmother to the couple — the one who\'s been holding Danisa\'s hand since day one.',
    },
    {
      name: 'Mane',
      initials: 'MN',
      role: 'Padrino',
      bio: 'Godfather to the couple — quiet counsel, steady presence, and warm enough to thaw a room.',
    },
    {
      name: 'Kailey',
      initials: 'K',
      role: 'Miss of Honor',
      bio: 'The goddaughter who lights up every room and catches what everyone else misses.',
    },
    {
      name: 'Melonie',
      initials: 'M',
      role: 'Maid of Honor',
      bio: 'Never done anything halfway — the short-list kind of friend, and one of the few people the bride would trust with anything.',
    },
    {
      name: 'Neisha',
      initials: 'N',
      role: 'Comadre',
      bio: 'Comadre to the bride — the hype woman who\'s been family since day one and always shows up.',
    },
    {
      name: 'Carmen',
      initials: 'C',
      role: 'Mother of the Bride',
      bio: 'Mother of the bride — hostess of the reception and heart of Casa Valdez.',
    },
    {
      name: 'José Miguel',
      initials: 'JM',
      role: 'Father of the Bride',
      bio: 'Father of the bride — landowner of Casa Valdez, and keeper of the horses.',
    },
  ];

  // -- Placeholder activity feed (real feed comes when API tracks history)
  const ACTIVITY_FEED = [
    { who: 'Sileni',      what: 'confirmed her Matron of Honor role',                   when: 'earlier this week' },
    { who: 'Melonie',     what: 'said yes to Maid of Honor',                            when: 'earlier this week' },
    { who: 'Kailey',      what: 'accepted Miss of Honor',                               when: 'earlier this week' },
    { who: 'Mane',        what: 'accepted Padrino',                                     when: 'earlier this week' },
    { who: 'Carmen',      what: 'moved fruit station sourcing to In Progress',          when: 'placeholder' },
    { who: 'José Miguel', what: 'confirmed canoe bar delivery',                         when: 'placeholder' },
  ];

  // -- Load data ---------------------------------------------------------
  const [timeframes, tasks] = await Promise.all([
    window.TWP.api.get('timeframes'),
    window.TWP.api.get('tasks'),
  ]);

  if (!timeframes || !tasks) {
    q('[data-team-view]').innerHTML = '<div class="state">Couldn\'t load team data. Refresh to try again.</div>';
    return;
  }

  const NOW_TF = timeframes.find(t => t.isNow) || timeframes[0];
  const NOW_ORDER = NOW_TF.order;
  let activeTf = NOW_TF.code;      // current timeframe (timeline scrub)
  let activePerson = null;         // null = group view, otherwise ROSTER entry

  // Flatten tasks → subtasks (same shape main.js uses)
  // parentsById lets the modal look up full parent context (notes, phase, etc.)
  const subtasks = [];
  const parentsById = {};
  tasks.forEach(parent => {
    parentsById[parent.id] = parent;
    (parent.subtasks || []).forEach(sub => {
      subtasks.push({
        id: sub.id,
        title: sub.title,
        parent: sub.parent,
        parentId: parent.id,
        timeframe: parent.timeframe,
        phase: parent.phase ? parent.phase.toLowerCase() : '',
        rawStatus: sub.status || 'Not Started',
        assignees: (sub.assignees && sub.assignees.length) ? sub.assignees : (parent.assignees || []),
      });
    });
  });

  // ----------------------------------------------------------------------
  // Timeline
  // - timelineHtml() — filterable, used on group view. Buttons scrub timeframe.
  // - personTimelineHtml(personName) — read-only marker showing where this
  //   person's work lands. Dots sized by task count. No click behavior.
  // ----------------------------------------------------------------------
  function timelineHtml() {
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
    return `
      <nav class="timeline" aria-label="Filter by timeframe" data-timeline>
        <div class="timeline__line"></div>
        ${dots}
      </nav>
    `;
  }

  function personTimelineHtml(personName) {
    // Count OPEN subtasks per timeframe for this person
    const counts = {};
    subtasks.forEach(s => {
      if (!s.assignees.includes(personName)) return;
      if ((s.rawStatus || '').toLowerCase() === 'complete') return;
      counts[s.timeframe] = (counts[s.timeframe] || 0) + 1;
    });

    const dots = timeframes.map(tf => {
      const isNow = tf.isNow;
      const count = counts[tf.code] || 0;
      let stateClass = '';
      if (tf.order < NOW_ORDER) stateClass = 'timeline__dot--past';
      else if (tf.order > NOW_ORDER) stateClass = 'timeline__dot--future';
      if (isNow) stateClass += ' timeline__dot--now';
      if (count > 0 && !isNow) stateClass += ' timeline__dot--has-work';

      const label = count > 0
        ? `${tf.label}<em>${count}</em>`
        : tf.label;

      return `
        <div class="timeline__stop timeline__stop--static">
          <span class="timeline__dot ${stateClass}"></span>
          <span class="timeline__label">${label}${isNow ? '<em>NOW</em>' : ''}</span>
        </div>
      `;
    }).join('');
    return `
      <div class="timeline timeline--static" aria-label="Task distribution across time">
        <div class="timeline__line"></div>
        ${dots}
      </div>
    `;
  }

  function wireTimeline(root) {
    qa('.timeline__stop', root).forEach(btn => {
      btn.addEventListener('click', () => {
        activeTf = btn.dataset.tf;
        render();
      });
    });
  }

  // ----------------------------------------------------------------------
  // Group view — roster + timeline + activity feed
  // ----------------------------------------------------------------------
  function renderGroup() {
    const mount = q('[data-team-view]');

    const rosterHtml = ROSTER.map(person => `
      <button class="team-bubble" data-person="${person.name}">
        <span class="team-bubble__circle">${person.initials}</span>
        <span class="team-bubble__name">${person.name}</span>
      </button>
    `).join('');

    const feedHtml = ACTIVITY_FEED.map(item => {
      const person = ROSTER.find(p => p.name === item.who);
      const initials = person ? person.initials : item.who.slice(0, 1);
      return `
        <div class="feed-row">
          <span class="feed-row__bubble">${initials}</span>
          <span class="feed-row__who">${item.who}</span>
          <span class="feed-row__what">${item.what}</span>
          <span class="feed-row__when">${item.when}</span>
        </div>
      `;
    }).join('');

    mount.innerHTML = `
      <header class="home-head home-head--no-border">
        <div class="home-head__title">
          <span class="eyebrow">The Plans</span>
          <h1 class="home-head__h1">The Team</h1>
          <p class="home-head__subtitle">The ones we couldn't do this without.</p>
        </div>
      </header>

      ${timelineHtml()}

      <div class="team-roster">${rosterHtml}</div>

      <section class="tasklist-card">
        <div class="tasklist-card__meta-row">
          <span class="team-section-label">What the Team's Moving On</span>
          <span class="tasklist-card__meta">recent updates</span>
        </div>
        <div class="feed">${feedHtml}</div>
      </section>
    `;

    // Wire bubble clicks
    qa('.team-bubble', mount).forEach(btn => {
      btn.addEventListener('click', () => {
        activePerson = ROSTER.find(p => p.name === btn.dataset.person);
        render();
      });
    });
    wireTimeline(mount);
  }

  // ----------------------------------------------------------------------
  // Personal view — person-scoped kanban + read-only timeline marker.
  // Shows ALL of this person's tasks across every timeframe.
  // Overdue (past-timeframe still-open items) float to the top of their
  // status column with an amber marker + timeframe tag.
  // ----------------------------------------------------------------------
  const STATUS_COLS = [
    { key: 'not',      label: 'Not Started',  matches: ['not started', ''] },
    { key: 'needs',    label: 'Needs Help',   matches: ['needs help'] },
    { key: 'progress', label: 'In Progress',  matches: ['in progress'] },
    { key: 'done',     label: 'Complete',     matches: ['complete'] },
  ];

  function initialsOf(name) {
    const person = ROSTER.find(p => p.name === name);
    if (person) return person.initials;
    // Fallback for non-roster names (Dioris/Guaroa etc)
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 1).toUpperCase();
  }

  function renderPerson() {
    const mount = q('[data-team-view]');
    const person = activePerson;

    // Everything this person is assigned to, across every timeframe
    const theirs = subtasks
      .filter(s => (s.assignees || []).includes(person.name))
      .map(s => {
        const tf = timeframes.find(t => t.code === s.timeframe);
        const isOverdue = tf && tf.order < NOW_ORDER
          && (s.rawStatus || '').toLowerCase() !== 'complete';
        return { ...s, isOverdue, tfOrder: tf ? tf.order : 999, tfLabel: tf ? tf.label : '' };
      });

    // Bucket by status column
    const buckets = { not: [], needs: [], progress: [], done: [] };
    theirs.forEach(t => {
      const key = statusKeyOf(t.rawStatus);
      buckets[key].push(t);
    });

    // Sort each open column: overdue first (earliest timeframe on top),
    // then current-and-future by timeframe order
    ['not', 'needs', 'progress'].forEach(col => {
      buckets[col].sort((a, b) => {
        if (a.isOverdue && !b.isOverdue) return -1;
        if (!a.isOverdue && b.isOverdue) return 1;
        return a.tfOrder - b.tfOrder;
      });
    });
    // Done column: newest-timeframe first (least stale)
    buckets.done.sort((a, b) => b.tfOrder - a.tfOrder);

    const openCount = theirs.filter(t => t.status !== 'done').length;
    const overdueCount = theirs.filter(t => t.isOverdue).length;

    const renderCard = t => {
      const statusKey = statusKeyOf(t.rawStatus);
      const overdueTag = t.isOverdue
        ? `<span class="kcard__overdue">${t.tfLabel} · overdue</span>`
        : '';
      return `
        <div class="kcard kcard--${statusKey}${t.isOverdue ? ' kcard--overdue' : ''}" data-task-id="${t.id}" data-parent-id="${t.parentId}">
          <div class="kcard__title">${t.title}</div>
          <div class="kcard__foot">
            <span class="kcard__parent">${t.parent}</span>
            ${overdueTag}
          </div>
        </div>
      `;
    };

    const metaText = overdueCount
      ? `${overdueCount} overdue · ${openCount} open`
      : `${openCount} open`;

    mount.innerHTML = `
      <a class="team-back" href="#" data-team-back>← The Team</a>

      <header class="home-head home-head--no-border home-head--split">
        <div class="home-head__title">
          <span class="eyebrow">${person.role}</span>
          <h1 class="home-head__h1">${person.name}</h1>
          <p class="home-head__subtitle">${person.bio}</p>
        </div>
        <div class="team-person-bubble">${person.initials}</div>
      </header>

      ${personTimelineHtml(person.name)}

      <section class="tasklist-card">
        <div class="tasklist-card__meta-row">
          <span class="tasklist-card__meta">${metaText}</span>
        </div>
        <div class="kanban">
          ${STATUS_COLS.map(col => {
            const items = buckets[col.key];
            const cards = items.length
              ? items.map(renderCard).join('')
              : '<div class="kanban__empty">—</div>';
            return `
              <div class="kanban__col">
                <div class="kanban__head kanban__head--${col.key}">
                  ${col.label}<span class="kanban__count">· ${items.length}</span>
                </div>
                <div class="kanban__list">${cards}</div>
              </div>
            `;
          }).join('')}
        </div>
      </section>

      <section class="tasklist-card">
        <div class="tasklist-card__meta-row">
          <span class="team-section-label">Day-Of Duties</span>
          <span class="tasklist-card__meta">the wedding day</span>
        </div>
        <div class="kanban__empty">Day-of duties for ${person.name} will render here once wired to the Day-Of tab.</div>
      </section>
    `;

    // Back link
    q('[data-team-back]', mount).addEventListener('click', (e) => {
      e.preventDefault();
      activePerson = null;
      render();
    });

    // Wire card clicks → modal (uses parentsById lookup + same modal shell)
    qa('.kcard', mount).forEach(card => {
      card.addEventListener('click', () => {
        openParentModal(card.dataset.parentId, card.dataset.taskId);
      });
    });
  }

  // Status vocab reused
  function statusKeyOf(rawStatus) {
    const s = (rawStatus || '').toLowerCase().trim();
    if (s === 'complete') return 'done';
    if (s === 'in progress') return 'progress';
    if (s === 'needs help') return 'needs';
    return 'not';
  }

  // ----------------------------------------------------------------------
  // Modal — parent task detail (mirrors Home's modal)
  // ----------------------------------------------------------------------
  function openParentModal(parentId, selectedTaskId) {
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
    document.body.style.overflow = 'hidden';
  }

  function closeParentModal() {
    const modal = q('[data-modal]');
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  // Modal close handlers (backdrop + × button + Esc)
  qa('[data-modal-close]').forEach(el => el.addEventListener('click', closeParentModal));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeParentModal();
  });

  // Root dispatch
  function render() {
    if (activePerson) renderPerson();
    else renderGroup();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  render();
})();
