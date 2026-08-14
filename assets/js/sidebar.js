/* ==========================================================================
   The Wedding Plan — Sidebar
   Renders the persistent sidebar on every page. Change the nav here once
   and it updates everywhere. Countdown ticks every second.
   ========================================================================== */

(function renderSidebar() {
  const mount = document.getElementById('sidebar');
  if (!mount) return;

  // Path prefix — if we're inside a subfolder like /brief/, links need '../'
  const inSubfolder = /\/(brief|dashboard)\//.test(location.pathname);
  const prefix = inSubfolder ? '../' : '';

  mount.innerHTML = `
    <a class="sidebar__brand" href="${prefix}index.html">7 · 7 · 27</a>

    <div class="sidebar__countdown" data-sidebar-countdown>
      <span data-cd-day>—</span>D<span class="sep">·</span><span data-cd-hr>—</span>H<span class="sep">·</span><span data-cd-min>—</span>M<span class="sep">·</span><span data-cd-sec>—</span>S
    </div>

    <div class="sidebar__rsvp">
      <div class="sidebar__rsvp-head">
        <span class="sidebar__rsvp-label">RSVP</span>
      </div>
      <div class="sidebar__rsvp-bar">
        <div class="sidebar__rsvp-fill" data-rsvp-fill style="width: 0%;"></div>
      </div>
      <div class="sidebar__rsvp-foot">
        <span class="sidebar__rsvp-confirmed"><span data-rsvp-confirmed>—</span> confirmed</span>
        <span class="sidebar__rsvp-awaiting"><span data-rsvp-awaiting>—</span> awaiting</span>
      </div>
    </div>

    <nav class="sidebar__nav" aria-label="Primary">
      <h3>The Brief</h3>
      <ul>
        <li><a href="${prefix}brief/the-look.html">The Look</a></li>
        <li><a href="${prefix}brief/the-flora.html">The Flora</a></li>
        <li><a href="${prefix}brief/the-lodging.html">The Lodging</a></li>
        <li><a href="${prefix}brief/the-ceremony.html">The Ceremony</a></li>
        <li><a href="${prefix}brief/the-evening.html">The Evening</a></li>
        <li><a href="${prefix}brief/the-logistics.html">The Logistics</a></li>
      </ul>

      <h3>The Plans</h3>
      <ul>
        <li><a href="${prefix}dashboard/party.html">The Team</a></li>
        <li><a href="${prefix}brief/the-attire.html">The Attire</a></li>
        <li><a href="${prefix}dashboard/day-of.html">The Day</a></li>
      </ul>
    </nav>
  `;

  // Mark the active link
  const here = location.pathname.split('/').pop() || 'index.html';
  const hereFolder = location.pathname.includes('/brief/') ? 'brief'
                    : location.pathname.includes('/dashboard/') ? 'dashboard'
                    : 'root';
  mount.querySelectorAll('a').forEach(a => {
    const href = a.getAttribute('href');
    if (!href) return;
    const clean = href.replace(/^(\.\.\/)+/, '');
    const currentPath = (hereFolder === 'root' ? '' : hereFolder + '/') + here;
    if (clean === currentPath) a.setAttribute('aria-current', 'page');
  });

  // --- Countdown (days · hours · minutes · seconds) ------------------
  const target = new Date('2027-07-07T16:00:00-04:00');
  const el = {
    day: mount.querySelector('[data-cd-day]'),
    hr:  mount.querySelector('[data-cd-hr]'),
    min: mount.querySelector('[data-cd-min]'),
    sec: mount.querySelector('[data-cd-sec]'),
  };

  function tickSidebar() {
    const now = new Date();
    let delta = Math.max(0, target - now);

    const day = 1000 * 60 * 60 * 24;
    const hr  = 1000 * 60 * 60;
    const min = 1000 * 60;

    const days    = Math.floor(delta / day); delta -= days * day;
    const hours   = Math.floor(delta / hr);  delta -= hours * hr;
    const minutes = Math.floor(delta / min); delta -= minutes * min;
    const seconds = Math.floor(delta / 1000);

    if (el.day) el.day.textContent = days;
    if (el.hr)  el.hr.textContent  = String(hours).padStart(2, '0');
    if (el.min) el.min.textContent = String(minutes).padStart(2, '0');
    if (el.sec) el.sec.textContent = String(seconds).padStart(2, '0');
  }
  tickSidebar();
  setInterval(tickSidebar, 1000);

  // --- RSVP hydration -------------------------------------------------
  // Wait until TWP.api is available (api.js loads after sidebar.js on some
  // pages), then fetch and paint the progress bar.
  function hydrateRsvp() {
    if (!window.TWP || !window.TWP.api) {
      setTimeout(hydrateRsvp, 100);
      return;
    }
    window.TWP.api.get('rsvp').then(rsvp => {
      if (!rsvp) return;
      const total = rsvp.total || 0;
      const confirmed = rsvp.confirmed || 0;
      const awaiting = rsvp.awaiting != null ? rsvp.awaiting : (total - confirmed - (rsvp.declined || 0));

      const totalEl = mount.querySelector('[data-rsvp-total]');
      const confEl = mount.querySelector('[data-rsvp-confirmed]');
      const awaitEl = mount.querySelector('[data-rsvp-awaiting]');
      const fillEl = mount.querySelector('[data-rsvp-fill]');

      if (totalEl) totalEl.textContent = total;
      if (confEl) confEl.textContent = confirmed;
      if (awaitEl) awaitEl.textContent = awaiting;
      if (fillEl) fillEl.style.width = total ? `${(confirmed / total) * 100}%` : '0%';
    }).catch(err => console.warn('Sidebar RSVP fetch failed', err));
  }
  hydrateRsvp();
})();
