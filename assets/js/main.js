/* ==========================================================================
   The Wedding Plan — Main
   Hydrates the dashboard cards: donut charts, legends, upcoming list, feed.
   Renders person filter tabs and re-filters upcoming on tab click.
   ========================================================================== */

(async function hydrateHome() {
  if (!window.TWP || !window.TWP.api) return;

  const q = (sel, root = document) => root.querySelector(sel);
  const qa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function drawDonut(cardEl, data, segmentKeys) {
    const total = data.total || 0;
    if (!total) return;
    let offset = 25;
    segmentKeys.forEach(key => {
      const value = data[key] || 0;
      const pct = (value / total) * 100;
      const seg = q(`[data-seg="${key}"]`, cardEl);
      if (seg) {
        seg.setAttribute('stroke-dasharray', `${pct} ${100 - pct}`);
        seg.setAttribute('stroke-dashoffset', String(offset));
      }
      offset = ((offset - pct) % 100 + 100) % 100;
    });
    const totalEl = q('[data-total]', cardEl);
    if (totalEl) totalEl.textContent = total;
    segmentKeys.forEach(key => {
      const el = q(`[data-legend="${key}"]`, cardEl);
      if (el) el.textContent = data[key] ?? 0;
    });
    ['awaiting', 'needed'].forEach(key => {
      const el = q(`[data-legend="${key}"]`, cardEl);
      if (el && data[key] != null) el.textContent = data[key];
    });
  }

  function drawSolidDonut(sectionEl, total) {
    const seg = q('[data-seg="subtasks"]', sectionEl);
    if (seg) {
      seg.setAttribute('stroke-dasharray', `100 0`);
      seg.setAttribute('stroke-dashoffset', '25');
    }
    const totalEl = q('[data-subtasks-total]', sectionEl);
    if (totalEl) totalEl.textContent = total;
  }

  // --- Load all data up front ------------------------------------------
  const [rsvp, tasks, vendors, upcoming, recent, people] = await Promise.all([
    window.TWP.api.get('rsvp'),
    window.TWP.api.get('tasks'),
    window.TWP.api.get('vendors'),
    window.TWP.api.get('upcoming'),
    window.TWP.api.get('recent'),
    window.TWP.api.get('people'),
  ]);

  // --- Donuts -----------------------------------------------------------
  const rsvpCard = q('[data-chart="rsvp"]');
  if (rsvpCard && rsvp) drawDonut(rsvpCard, rsvp, ['confirmed', 'declined']);

  const tasksCard = q('[data-chart="tasks"]');
  if (tasksCard && tasks) {
    const parentsSection = q('[data-donut="parents"]', tasksCard);
    if (parentsSection && tasks.parents) {
      drawDonut(parentsSection, tasks.parents, ['discover', 'decide', 'execute', 'done']);
    }
    const subtasksSection = q('[data-donut="subtasks"]', tasksCard);
    if (subtasksSection && tasks.subtasks) {
      drawSolidDonut(subtasksSection, tasks.subtasks.total);
    }
  }

  const vendorsCard = q('[data-chart="vendors"]');
  if (vendorsCard && vendors) drawDonut(vendorsCard, vendors, ['booked', 'pending']);

  // --- Person filter tabs ----------------------------------------------
  const tabsMount = q('[data-person-tabs]');
  let activePerson = 'everyone';

  function renderTabs() {
    if (!tabsMount || !people) return;
    const buttons = [
      `<button class="person-tab ${activePerson === 'everyone' ? 'is-active' : ''}" data-person="everyone">Everyone</button>`
    ];
    people.forEach(p => {
      const isActive = activePerson === p.code;
      buttons.push(
        `<button class="person-tab ${isActive ? 'is-active' : ''}" data-person="${p.code}">${p.name}</button>`
      );
    });
    tabsMount.innerHTML = buttons.join('');
    qa('.person-tab', tabsMount).forEach(btn => {
      btn.addEventListener('click', () => {
        activePerson = btn.dataset.person;
        renderTabs();
        renderUpcoming();
      });
    });
  }

  // --- Upcoming list (filtered by active person) -----------------------
  const upcomingMount = q('[data-upcoming]');

  function personName(code) {
    if (!people) return code;
    const match = people.find(p => p.code === code);
    return match ? match.name : code;
  }

  function renderUpcoming() {
    if (!upcomingMount) return;
    if (!upcoming || !upcoming.length) {
      upcomingMount.innerHTML = '<div class="state">Nothing pressing right now.</div>';
      return;
    }
    const filtered = activePerson === 'everyone'
      ? upcoming
      : upcoming.filter(row => (row.assignees || []).includes(activePerson));

    if (!filtered.length) {
      upcomingMount.innerHTML = `<div class="state">Nothing on ${personName(activePerson)}'s list right now.</div>`;
      return;
    }
    upcomingMount.innerHTML = filtered.map(row => {
      const who = (row.assignees || []).map(personName).join(' · ');
      return `
        <div class="upcoming__row">
          <span class="upcoming__task">${row.task}</span>
          <span class="upcoming__who">${who}</span>
          <span class="upcoming__due">${row.due}</span>
        </div>
      `;
    }).join('');
  }

  renderTabs();
  renderUpcoming();

  // --- Recent activity feed -------------------------------------------
  const feedMount = q('[data-feed]');
  if (feedMount) {
    if (recent && recent.length) {
      feedMount.innerHTML = recent.map(item => `
        <div class="feed__item">
          <div class="feed__when">${item.when}</div>
          <div class="feed__what">${item.what}</div>
        </div>
      `).join('');
    } else {
      feedMount.innerHTML = '<div class="state">Nothing yet — this fills in as changes happen.</div>';
    }
  }
})();
