/* ==========================================================================
   The Wedding Plan — Main
   Hydrates the dashboard cards: donut charts, legends, upcoming list, feed.
   ========================================================================== */

(async function hydrateHome() {
  if (!window.TWP || !window.TWP.api) return;

  const q = (sel, root = document) => root.querySelector(sel);

  // -- Donut chart hydration ------------------------------------------------
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

  // -- Single-color donut (for subtasks — solid ring) -----------------------
  function drawSolidDonut(sectionEl, total) {
    const seg = q('[data-seg="subtasks"]', sectionEl);
    if (seg) {
      seg.setAttribute('stroke-dasharray', `100 0`);
      seg.setAttribute('stroke-dashoffset', '25');
    }
    const totalEl = q('[data-subtasks-total]', sectionEl);
    if (totalEl) totalEl.textContent = total;
  }

  // RSVP donut
  const rsvpCard = q('[data-chart="rsvp"]');
  if (rsvpCard) {
    const rsvp = await window.TWP.api.get('rsvp');
    if (rsvp) drawDonut(rsvpCard, rsvp, ['confirmed', 'declined']);
  }

  // Tasks card — two donuts side by side
  const tasksCard = q('[data-chart="tasks"]');
  if (tasksCard) {
    const tasks = await window.TWP.api.get('tasks');
    if (tasks) {
      const parentsSection = q('[data-donut="parents"]', tasksCard);
      if (parentsSection && tasks.parents) {
        drawDonut(parentsSection, tasks.parents, ['discover', 'decide', 'execute', 'done']);
      }
      const subtasksSection = q('[data-donut="subtasks"]', tasksCard);
      if (subtasksSection && tasks.subtasks) {
        drawSolidDonut(subtasksSection, tasks.subtasks.total);
      }
    }
  }

  // Vendors donut
  const vendorsCard = q('[data-chart="vendors"]');
  if (vendorsCard) {
    const vendors = await window.TWP.api.get('vendors');
    if (vendors) drawDonut(vendorsCard, vendors, ['booked', 'pending']);
  }

  // Upcoming list
  const upcomingMount = q('[data-upcoming]');
  if (upcomingMount) {
    const upcoming = await window.TWP.api.get('upcoming');
    if (upcoming && upcoming.length) {
      upcomingMount.innerHTML = upcoming.map(row => `
        <div class="upcoming__row">
          <span class="upcoming__task">${row.task}</span>
          <span class="upcoming__due">${row.due}</span>
        </div>
      `).join('');
    } else {
      upcomingMount.innerHTML = '<div class="state">Nothing pressing right now.</div>';
    }
  }

  // Recent activity feed
  const feedMount = q('[data-feed]');
  if (feedMount) {
    const recent = await window.TWP.api.get('recent');
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
