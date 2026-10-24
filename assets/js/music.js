/* ==========================================================================
   The Wedding Plan — The Music (v1)
   Must-Play and Do Not Play come from the "Music" tab of The Wedding Plan
   spreadsheet. Guest Requests are the song lines from RSVPs, synced into the
   same tab by the Apps Script, then reviewed here: To review, Maybe, Pass.
   Add moves a request into Must-Play. Songs are edited in the sheet.
   ========================================================================== */

(async function music() {
  if (!window.TWP || !window.TWP.api) return;

  const mount = document.querySelector('[data-music]');
  if (!mount) return;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const CHEVRON = '<svg viewBox="0 0 12 12" fill="none" stroke="#10706D" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5"/></svg>';
  const CHEVRON_RIGHT = '<svg class="tm-fold__chev" viewBox="0 0 12 12" fill="none" stroke="#D4AF37" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 2.5 8 6l-3.5 3.5"/></svg>';

  const STATUS_WORD = { review: 'To review', maybe: 'Maybe', pass: 'Pass' };

  // ---- Reading the sheet's words ----------------------------------------
  // The sheet is typed by hand, so every value is read loosely.
  function kindOf(list) {
    const v = String(list || '').toLowerCase().trim();
    if (v.indexOf('not') > -1) return 'avoid';
    if (v.indexOf('request') > -1) return 'request';
    return 'must'; // a blank List means a song the couple added by hand
  }
  function statusOf(status) {
    const v = String(status || '').toLowerCase().trim();
    if (v === 'maybe') return 'maybe';
    if (v === 'pass') return 'pass';
    if (v === 'added' || v === 'add') return 'added';
    return 'review';
  }
  function whoseOf(whose) {
    const v = String(whose || '').toLowerCase().replace(/[^a-z&]/g, '');
    if (v === 'guest' || v === 'g') return 'guest';
    if (v === 'both' || v === 'dj' || v === 'd&j' || v === 'danisa&julian' || v === 'julian&danisa') return 'both';
    if (v === 'danisa' || v === 'd') return 'danisa';
    if (v === 'julian' || v === 'j') return 'julian';
    return '';
  }
  function normalize(rows) {
    return (rows || [])
      .filter(r => r && String(r.title || '').trim() !== '')
      .map(r => ({
        id: r.id,
        title: String(r.title).trim(),
        artist: String(r.artist || '').trim(),
        whose: whoseOf(r.whose),
        moment: String(r.moment || '').trim(),
        party: String(r.party || '').trim(),
        kind: kindOf(r.list),
        status: statusOf(r.status),
      }));
  }

  // ---- State -------------------------------------------------------------
  let songs = [];
  let tab = location.hash === '#requests' ? 'requests' : 'must-play';
  let passOpen = false;
  let openMenuId = null;
  let loadError = false;

  const flashEl = () => document.querySelector('[data-flash]');
  function flash(msg) {
    const el = flashEl();
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    setTimeout(() => { el.hidden = true; }, 5000);
  }

  // ---- Pieces ------------------------------------------------------------
  function marksHtml(whose) {
    const letters = whose === 'both' ? ['D', 'J'] : whose === 'danisa' ? ['D'] : whose === 'julian' ? ['J'] : [];
    const names = { danisa: 'Danisa', julian: 'Julian', both: 'Danisa & Julian' };
    const title = names[whose] ? ` title="${esc(names[whose])}"` : '';
    return `<div class="tm-marks"${title}>${letters.map(l => `<span class="tm-mark">${l}</span>`).join('')}</div>`;
  }
  function countWord(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  function mustRow(s) {
    const artist = s.artist ? `<div class="tm-artist">${esc(s.artist)}</div>` : '';
    const party = (s.whose === 'guest' && s.party) ? `<div class="tm-party">${esc(s.party)}</div>` : '';
    const moment = s.moment ? `<div class="tm-moment">${esc(s.moment)}</div>` : '';
    return `<div class="tm-row" data-song="${esc(s.id)}">${marksHtml(s.whose)}<div class="tm-body"><div class="tm-title">${esc(s.title)}</div>${artist}${party}</div>${moment}</div>`;
  }

  function requestRow(r) {
    const artist = r.artist ? `<div class="tm-artist">${esc(r.artist)}</div>` : '';
    const party = r.party ? `<div class="tm-party">${esc(r.party)}</div>` : '';
    const open = openMenuId === r.id;
    const id = esc(r.id);
    const menu = `
      <div class="tm-menu" role="menu" data-menu="${id}"${open ? '' : ' hidden'}>
        <button type="button" role="menuitem" class="tm-menu__item" data-set="add" data-id="${id}"><span class="tm-pip tm-pip--add"></span>Add</button>
        <button type="button" role="menuitem" class="tm-menu__item" data-set="maybe" data-id="${id}"><span class="tm-pip tm-pip--maybe"></span>Maybe</button>
        <button type="button" role="menuitem" class="tm-menu__item tm-menu__item--pass" data-set="pass" data-id="${id}"><span class="tm-pip tm-pip--pass"></span>Pass</button>
      </div>`;
    return `
      <div class="tm-row tm-row--request${r.status === 'pass' ? ' tm-row--pass' : ''}" data-song="${id}">
        <div class="tm-body"><div class="tm-title">${esc(r.title)}</div>${artist}</div>
        ${party}
        <div class="tm-statuswrap">
          <button type="button" class="tm-status" data-status-btn="${id}" aria-haspopup="menu" aria-expanded="${open}" aria-label="Status for ${esc(r.title)}: ${STATUS_WORD[r.status]}">
            <span class="tm-pip tm-pip--${r.status}"></span><span class="tm-status__word">${STATUS_WORD[r.status]}</span>${CHEVRON}
          </button>
          ${menu}
        </div>
      </div>`;
  }

  function groupHead(label, n) {
    return `<div class="tm-group__head"><span>${label}</span><span class="tm-group__count">${countWord(n, 'request', 'requests')}</span></div>`;
  }

  // ---- Panels ------------------------------------------------------------
  function mustPanel() {
    const must = songs.filter(s => s.kind === 'must');
    const avoid = songs.filter(s => s.kind === 'avoid');
    let html = must.length ? `<div class="tm-list tm-list--end">${must.map(mustRow).join('')}</div>` : '';
    if (avoid.length) {
      html += `
        <section class="tm-avoid" aria-label="Do Not Play">
          <div class="tm-avoid__head"><span>Do Not Play</span><span class="tm-avoid__count">${countWord(avoid.length, 'song', 'songs')}</span></div>
          <div class="tm-list tm-list--end">${avoid.map(mustRow).join('')}</div>
        </section>`;
    }
    return html;
  }

  function requestsPanel() {
    const reqs = songs.filter(s => s.kind === 'request');
    if (!reqs.length) {
      return `<div class="tm-empty"><div class="tm-empty__head">Nothing to review</div><div class="tm-empty__line">Requests arrive with each RSVP.</div></div>`;
    }
    const review = reqs.filter(r => r.status === 'review');
    const maybe = reqs.filter(r => r.status === 'maybe');
    const pass = reqs.filter(r => r.status === 'pass');
    let html = '';
    if (review.length) html += groupHead('To review', review.length) + `<div class="tm-list">${review.map(requestRow).join('')}</div>`;
    if (maybe.length) html += groupHead('Maybe', maybe.length) + `<div class="tm-list">${maybe.map(requestRow).join('')}</div>`;
    if (pass.length) {
      html += `
        <div class="tm-fold">
          <button type="button" class="tm-fold__toggle" data-fold aria-expanded="${passOpen}" aria-controls="tm-pass-list">
            ${CHEVRON_RIGHT}<span>Pass</span><span class="tm-fold__spacer"></span><span class="tm-fold__count">${countWord(pass.length, 'request', 'requests')}</span>
          </button>
          <div class="tm-list" id="tm-pass-list"${passOpen ? '' : ' hidden'}>${pass.map(requestRow).join('')}</div>
        </div>`;
    }
    return html;
  }

  // ---- Render ------------------------------------------------------------
  function render() {
    if (loadError) {
      mount.innerHTML = '<div class="state">The music list could not be reached just now. Nothing is lost. Try again in a moment.</div>';
      return;
    }
    const mustCount = songs.filter(s => s.kind === 'must').length;
    const toReview = songs.filter(s => s.kind === 'request' && s.status === 'review').length;
    const onMust = tab === 'must-play';

    mount.innerHTML = `
      <div class="tm-tabs" role="tablist" aria-label="The Music">
        <button type="button" role="tab" id="tm-tab-must" class="tm-tab" data-tab="must-play" aria-selected="${onMust}" aria-controls="tm-panel" tabindex="${onMust ? 0 : -1}">Must-Play<span class="tm-tab__count">${mustCount}</span></button>
        <button type="button" role="tab" id="tm-tab-req" class="tm-tab" data-tab="requests" aria-selected="${!onMust}" aria-controls="tm-panel" tabindex="${!onMust ? 0 : -1}">Guest Requests${toReview ? `<span class="tm-badge" aria-label="${toReview} to review">${toReview}</span>` : ''}</button>
      </div>
      <div id="tm-panel" role="tabpanel" aria-labelledby="${onMust ? 'tm-tab-must' : 'tm-tab-req'}">
        ${onMust ? mustPanel() : requestsPanel()}
      </div>`;
  }

  function renderAndFocus(selector) {
    render();
    if (selector) {
      const el = mount.querySelector(selector);
      if (el) el.focus();
    }
  }

  // ---- Changing a status -------------------------------------------------
  async function setStatus(id, choice) {
    const item = songs.filter(s => String(s.id) === String(id))[0];
    if (!item) return;
    const before = { kind: item.kind, whose: item.whose, status: item.status };
    if (choice === 'add') { item.kind = 'must'; item.whose = 'guest'; item.status = 'added'; }
    else { item.status = choice; }
    openMenuId = null;
    renderAndFocus(null);
    const res = await window.TWP.api.post({ action: 'musicSetStatus', id: item.id, status: choice });
    if (!res || res.ok === false) {
      Object.assign(item, before);
      renderAndFocus(null);
      flash('That change did not save. It has been put back.');
    }
  }

  // ---- Events ------------------------------------------------------------
  mount.addEventListener('click', e => {
    const tabBtn = e.target.closest('[data-tab]');
    if (tabBtn) {
      tab = tabBtn.getAttribute('data-tab');
      openMenuId = null;
      try { history.replaceState(null, '', tab === 'requests' ? '#requests' : location.pathname + location.search); } catch (err) { /* ignore */ }
      renderAndFocus(`[data-tab="${tab}"]`);
      return;
    }
    const setBtn = e.target.closest('[data-set]');
    if (setBtn) { setStatus(setBtn.getAttribute('data-id'), setBtn.getAttribute('data-set')); return; }

    const statusBtn = e.target.closest('[data-status-btn]');
    if (statusBtn) {
      const id = statusBtn.getAttribute('data-status-btn');
      openMenuId = openMenuId === id ? null : id;
      renderAndFocus(openMenuId ? `[data-menu="${CSS.escape(id)}"] .tm-menu__item` : `[data-status-btn="${CSS.escape(id)}"]`);
      return;
    }
    const fold = e.target.closest('[data-fold]');
    if (fold) { passOpen = !passOpen; openMenuId = null; renderAndFocus('[data-fold]'); return; }
  });

  mount.addEventListener('keydown', e => {
    if (e.key === 'Escape' && openMenuId) {
      const id = openMenuId;
      openMenuId = null;
      renderAndFocus(`[data-status-btn="${CSS.escape(id)}"]`);
      return;
    }
    const tabBtn = e.target.closest('[data-tab]');
    if (tabBtn && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      tab = tab === 'must-play' ? 'requests' : 'must-play';
      openMenuId = null;
      renderAndFocus(`[data-tab="${tab}"]`);
    }
  });

  document.addEventListener('click', e => {
    if (openMenuId && !e.target.closest('.tm-statuswrap')) { openMenuId = null; render(); }
  });

  // ---- Load --------------------------------------------------------------
  const data = await window.TWP.api.get('music');
  if (!data || !Array.isArray(data.songs)) { loadError = true; }
  else { songs = normalize(data.songs); }
  render();
})();
