/* ==========================================================================
   The Wedding Plan — Main
   Hydrates the dashboard cards: donut charts, legends, upcoming list, feed.
   ========================================================================== */

(async function hydrateHome() {
  if (!window.TWP || !window.TWP.api) return;

  const q = (sel, root = document) => root.querySelector(sel);
  const all = (sel, root = document) => root.querySelectorAll(sel);

  // -- Donut chart hydration ------------------------------------------------
  // Segments arranged in the order they appear as [data-seg] children.
  // stroke-dasharray works because circumference = 100 (r ≈ 15.915).
  function drawDonut(cardEl, data, segmentKeys) {
    const total = data.total || 0;
    if (!total) return;

    let offset = 25; // start at top
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

    // Update center total
    const totalEl = q('[data-total]', cardEl);
    if (totalEl) totalEl.textContent = total;

    // Update legend values
    segmentKeys.forEach(key => {
      const el = q(`[data-legend="${key}"]`, cardEl);
      if (el) el.textContent = data[key] ?? 0;
    });
    // Awaiting / needed are computed, not colored segments
    ['awaiting', 'needed'].forEach(key => {
      const el = q(`[data-legend="${key}"]`, cardEl);
      if (el && data[key] != null) el.textContent = data[key];
    });
  }

  const rsvpCard    = q('[data-chart="rsvp"]');
  const tasksCard   = q('[data-chart="tasks"]');
  const vendorsCard = q('[data-chart="vendors"]');

  if (rsvpCard) {
    const rsvp = await window.TWP.api.get('rsvp');
    if (rsvp) drawDonut(rsvpCard, rsvp, ['confirmed', 'declined']);
  }
  if (tasksCard) {
    const tasks = await window.TWP.api.get('tasks');
    if (tasks) drawDonut(tasksCard, tasks, ['discover', 'decide', 'execute', 'done']);
  }
  if (vendorsCard) {
    const vendors = await window.TWP.api.get('vendors');
    if (vendors) drawDonut(vendorsCard, vendors, ['booked', 'pending']);
  }

  // -- Upcoming list --------------------------------------------------------
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

  // -- Recent activity feed -------------------------------------------------
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
