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

    <nav class="sidebar__nav" aria-label="Primary">
      <a class="sidebar__home" href="${prefix}index.html">Home</a>

      <h3>The Brief</h3>
      <ul>
        <li><a href="${prefix}brief/the-look.html">The Look</a></li>
        <li><a href="${prefix}brief/the-flora.html">The Flora</a></li>
        <li><a href="${prefix}brief/the-attire.html">The Attire</a></li>
        <li><a href="${prefix}brief/accommodations.html">Accommodations</a></li>
        <li><a href="${prefix}brief/the-ceremony.html">The Ceremony</a></li>
        <li><a href="${prefix}brief/the-evening.html">The Evening</a></li>
        <li><a href="${prefix}brief/the-logistics.html">The Logistics</a></li>
      </ul>

      <h3>The Plans</h3>
      <ul>
        <li><a href="${prefix}dashboard/index.html">Overview</a></li>
        <li><a href="${prefix}dashboard/party.html">Wedding Party</a></li>
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
})();
