/* ==========================================================================
   The Wedding Plan — The Attire
   A garment-cut view of the Attire tasks. Each person's "Look" parent is a row:
   italic name + gold progress sliver + "done / total" count. Rows expand to a
   two-column grid of garments — decided items show their value, open items show
   a faint gold "· to choose". Clicking a row opens the same parent-task modal
   The Team uses.

   Data comes from the live API (tasks). We keep only parents whose title ends
   in "'s Look" — that isolates the 9 person-Looks from other Attire-tagged
   parents (Wedding Dress, Bridal Bouquet, etc.).

   "Decided" = subtask status is Complete. The value shown is the subtask's
   notes if present, else its status.
   ========================================================================== */

(async function hydrateAttire() {
  if (!window.TWP || !window.TWP.api) return;

  const q = (sel, root = document) => root.querySelector(sel);
  const qa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // -- Section grouping. Order: Couple → Parents → Party → Guests -----------
  // Each group lists the person NAMES (matched against the Look parent's
  // assignee / title) in the order they should appear.
  const GROUPS = [
    { label: 'The Couple',        names: ['Danisa', 'Julian'] },
    { label: 'The Parents',       names: ['Carmen', 'José Miguel', 'Richard'] },
    { label: 'The Wedding Party',  names: ['Sileni', 'Mane', 'Kailey', 'Melonie'] },
  ];

  // Role eyebrow shown before each name (e.g. "The Bride · Danisa")
  const ROLES = {
    'Danisa':      'The Bride',
    'Julian':      'The Groom',
    'Carmen':      'Mother of the Bride',
    'José Miguel': 'Father of the Bride',
    'Richard':     'Father of the Groom',
    'Sileni':      'Madrina',
    'Mane':        'Padrino',
    'Kailey':      'Miss of Honor',
    'Melonie':     'Maid of Honor',
  };

  // -- Load ----------------------------------------------------------------
  const tasks = await window.TWP.api.get('tasks');
  if (!tasks) {
    q('[data-attire-view]').innerHTML =
      '<div class="state">Couldn\'t load attire data. Refresh to try again.</div>';
    return;
  }

  // Keep the 9 Look parents, index by the person name they belong to.
  // A Look's person = its title minus "'s Look".
  const parentsById = {};
  const lookByPerson = {};
  tasks.forEach(parent => {
    parentsById[parent.id] = parent;
    const title = parent.title || '';
    if (title.endsWith("'s Look")) {
      const person = title.replace(/'s Look$/, '');
      lookByPerson[person] = parent;
    }
  });

  // -- Helpers (mirrors party.js so the modal renders identically) ---------
  function statusKeyOf(rawStatus) {
    const s = (rawStatus || '').toLowerCase().trim();
    if (s === 'complete') return 'done';
    if (s === 'in progress') return 'progress';
    if (s === 'needs help') return 'needs';
    return 'not';
  }

  const INITIALS = {
    'Danisa': 'D', 'Julian': 'J', 'Carmen': 'C', 'José Miguel': 'JM',
    'Richard': 'R', 'Sileni': 'S', 'Mane': 'MN', 'Kailey': 'K', 'Melonie': 'M',
    'Neisha': 'N', 'Dioris': 'DI', 'Guaroa': 'G',
  };
  function initialsOf(name) {
    if (INITIALS[name]) return INITIALS[name];
    const parts = (name || '').trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (name || '?').slice(0, 1).toUpperCase();
  }

  // -- Render one person's row --------------------------------------------
  function personRowHtml(name) {
    const parent = lookByPerson[name];
    if (!parent) return '';
    const subs = parent.subtasks || [];
    const total = subs.length;
    const done = subs.filter(s => statusKeyOf(s.status) === 'done').length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const role = ROLES[name] || '';

    const items = subs.map(sub => {
      const isDone = statusKeyOf(sub.status) === 'done';
      // Decided value: subtask notes if present, else its status text.
      const value = (sub.notes && sub.notes.trim()) ? sub.notes.trim() : '';
      if (isDone) {
        const shown = value || 'confirmed';
        return `<div class="att-item">${sub.title} <span class="att-dot">·</span> <span class="att-v">${shown}</span></div>`;
      }
      return `<div class="att-item">${sub.title} <span class="att-dot att-dot--open">·</span> <span class="att-open">to choose</span></div>`;
    }).join('');

    return `
      <div class="att-person" data-parent-id="${parent.id}">
        <button class="att-person__head" type="button" aria-expanded="true">
          <span class="att-person__name"><b>${role}</b> · ${name}</span>
          <span class="att-person__bar"><span style="width:${pct}%"></span></span>
          <span class="att-person__count">${done} of ${total}</span>
          <span class="att-person__chev">▾</span>
        </button>
        <div class="att-items">${items}</div>
      </div>
    `;
  }

  // -- Render the whole page ----------------------------------------------
  function render() {
    const mount = q('[data-attire-view]');

    const groupsHtml = GROUPS.map(group => {
      const rows = group.names
        .map(personRowHtml)
        .filter(Boolean)
        .join('');
      if (!rows) return '';
      return `
        <section class="att-group">
          <p class="att-section__label">${group.label}</p>
          ${rows}
        </section>
      `;
    }).join('');

    mount.innerHTML = `
      <header class="content__head">
        <span class="eyebrow content__eyebrow">The Plans</span>
        <h1 class="content__title">The Attire</h1>
        <p class="subtitle content__subtitle">Every detail is deliberate. Down to the hem.</p>
      </header>

      <p class="att-legend">Tap a name to collapse it. A gold <span class="att-dot">·</span> marks a piece still being chosen.</p>

      ${groupsHtml}
    `;

    // Expand / collapse on the name row.
    // Clicking the chevron/name toggles; clicking a decided item opens the modal.
    qa('.att-person', mount).forEach(person => {
      const head = q('.att-person__head', person);
      head.addEventListener('click', () => {
        const collapsed = person.classList.toggle('is-collapsed');
        head.setAttribute('aria-expanded', String(!collapsed));
      });
      // The person name itself opens the modal on a separate affordance:
      // clicking any garment item row opens the parent modal.
      qa('.att-item', person).forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          openParentModal(person.dataset.parentId);
        });
      });
    });
  }

  // -- Modal (verbatim from party.js so it matches The Team / Home) --------
  function openParentModal(parentId, selectedTaskId) {
    const parent = parentsById[parentId];
    if (!parent) return;
    const modal = q('[data-modal]');
    const body = q('[data-modal-body]');
    if (!modal || !body) return;

    const phaseKey = (parent.phase || 'discover').toLowerCase();
    const statusKey = statusKeyOf(parent.status);
    const statusLabel = parent.status || 'Not Started';

    const assignees = (parent.assignees || []).map(name =>
      `<span class="kcard__bubble">${initialsOf(name)}</span>`).join('');

    const subs = (parent.subtasks || []).map(sub => {
      const subStatusKey = statusKeyOf(sub.status);
      const isDone = subStatusKey === 'done';
      const isSelected = sub.id === selectedTaskId;
      const boxCls = `msub__box msub__box--${subStatusKey}`;
      const boxContent = isDone ? '✓' : '';
      const rowCls = `msub${isDone ? ' msub--done' : ''}${isSelected ? ' msub--selected' : ''}`;
      const subBubbles = (sub.assignees || []).map(name =>
        `<span class="kcard__bubble">${initialsOf(name)}</span>`).join('');
      return `
        <div class="${rowCls}">
          <span class="${boxCls}">${boxContent}</span>
          <span class="msub__title">${sub.title}</span>
          <span class="msub__bubbles">${subBubbles}</span>
        </div>
      `;
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

  qa('[data-modal-close]').forEach(el => el.addEventListener('click', closeParentModal));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeParentModal();
  });

  render();
})();
