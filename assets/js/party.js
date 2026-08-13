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
  const subtasks = [];
  tasks.forEach(parent => {
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
  // Timeline (same as main.js — inlined so party page is self-contained)
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
        <span class="team-bubble__role">${person.role}</span>
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
      <header class="home-head">
        <div class="home-head__title">
          <span class="eyebrow">The Plans</span>
          <h1 class="home-head__h1">The Team</h1>
          <p class="home-head__subtitle">The people making this happen.</p>
        </div>
      </header>

      <p class="team-hint">Tap a name to open their view.</p>

      <div class="team-roster">${rosterHtml}</div>

      ${timelineHtml()}

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
  // Personal view — bio + timeline + tasks for this person
  // ----------------------------------------------------------------------
  function renderPerson() {
    const mount = q('[data-team-view]');
    const person = activePerson;

    // Tasks assigned to this person, for the currently active timeframe
    const theirsAll = subtasks.filter(s => (s.assignees || []).includes(person.name));
    const theirsNow = theirsAll.filter(s => s.timeframe === activeTf);

    // Bucket by simple status: open vs done
    const open = theirsNow.filter(s => (s.rawStatus || '').toLowerCase() !== 'complete');
    const done = theirsNow.filter(s => (s.rawStatus || '').toLowerCase() === 'complete');

    const renderTask = t => {
      const rawStatus = (t.rawStatus || 'Not Started');
      const statusKey = statusKeyOf(rawStatus);
      return `
        <div class="ptask ptask--${statusKey}">
          <div class="ptask__title">${t.title}</div>
          <div class="ptask__foot">
            <span class="ptask__parent">${t.parent}</span>
            <span class="ptask__status ptask__status--${statusKey}">${rawStatus}</span>
          </div>
        </div>
      `;
    };

    const openHtml = open.length
      ? open.map(renderTask).join('')
      : '<div class="kanban__empty">Nothing open in this timeframe.</div>';

    const doneHtml = done.length
      ? done.map(renderTask).join('')
      : '<div class="kanban__empty">Nothing completed yet.</div>';

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

      ${timelineHtml()}

      <div class="team-cols">
        <section class="tasklist-card">
          <div class="tasklist-card__meta-row">
            <span class="team-section-label">Planning</span>
            <span class="tasklist-card__meta">${open.length} open</span>
          </div>
          <div class="ptask-list">${openHtml}</div>
        </section>

        <section class="tasklist-card">
          <div class="tasklist-card__meta-row">
            <span class="team-section-label">Done</span>
            <span class="tasklist-card__meta">${done.length} complete</span>
          </div>
          <div class="ptask-list">${doneHtml}</div>
        </section>
      </div>

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
    wireTimeline(mount);
  }

  // Status vocab reused
  function statusKeyOf(rawStatus) {
    const s = (rawStatus || '').toLowerCase().trim();
    if (s === 'complete') return 'done';
    if (s === 'in progress') return 'progress';
    if (s === 'needs help') return 'needs';
    return 'not';
  }

  // Root dispatch
  function render() {
    if (activePerson) renderPerson();
    else renderGroup();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  render();
})();
