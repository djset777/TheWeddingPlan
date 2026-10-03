/* ==========================================================================
   The Dress: tabs + The Appointments
   - Tab switching with #guide / #references / #appointments links
   - Appointment cards (edit the APPOINTMENTS list below as plans change)
   - Tried-on log, notes form and photo upload, saved through the dress
     Apps Script (see apps-script/dress-notes/SETUP.md)
   ========================================================================== */
(function () {
  'use strict';

  // --- Settings you will edit ------------------------------------------------
  // Paste the Web app URL from the dress-account Apps Script deployment here.
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbxt-6WmNpcuappL5Yxw2ftwKCK_eJlgR_8yafWPWLCRJ_IGA86Sw1FW25WykYjEdJx6/exec';

  var PEOPLE = ['Danisa', 'Carmen', 'Sileni', 'Melonie', 'Neisha', 'Kailey'];

  // Gown number -> reference photo number. Only add pairs that are confirmed.
  var REF_MAP = { '25-02': '01' };

  // Style number -> that gown's photo on the designer's or a retailer's page.
  // Add a line here and the style tag becomes a link.
  var STYLE_LINKS = {
    '25-02': 'https://bloomfeld.nl/collection/berta/berta-25-02/',
    '24-04': 'https://www.berta.com/wp-content/uploads/2025/01/24-04-2.jpg',
    '24-107': 'https://bloomfeld.nl/collection/berta/24-107/',
    '26-112': 'https://bloomfeld.nl/collection/berta/26-112/',
    '27-04': 'https://www.berta.com/wp-content/uploads/2026/04/27-04-5.jpg',
    '27-06': 'https://www.berta.com/wp-content/uploads/2026/04/27-06-1.jpg'
  };

  // Style number -> small photo for its tile. Loaded live from the designer's or
  // retailer's site (never copied into this repo). If one fails to load, the
  // tile falls back to the style number.
  var STYLE_IMAGES = {
    '25-02': 'https://bloomfeld-cdn.b-cdn.net/wp-content/uploads/2026/02/Berta%20Eclipse%2025-02%201-683x1024.jpg',
    '24-04': 'https://www.berta.com/wp-content/uploads/2025/01/24-04-3-683x1024.jpg',
    '24-107': 'https://www.berta.com/wp-content/uploads/2025/01/24-107-3-683x1024.jpg',
    '26-112': 'https://bloomfeld-cdn.b-cdn.net/wp-content/uploads/2026/02/Berta%20Amare%2026-112-1.jpg',
    '27-04': 'https://www.berta.com/wp-content/uploads/2026/04/27-04-5.jpg',
    '27-06': 'https://www.berta.com/wp-content/uploads/2026/04/27-06-1.jpg'
  };

  // One entry per boutique, in the order they appear in the picker.
  // short: the line under the name in the picker. arrive / phone are optional.
  // rsvp: true turns on the Guests section. guests: how many the boutique
  // allows. invited: who the calendar invite went to (edit as invites change).
  var APPOINTMENTS = [
    {
      id: 'berta',
      name: 'Berta NYC',
      short: 'Sat, Oct 17 \u00b7 12:00 PM',
      when: 'Saturday, October 17 \u00b7 12:00 PM',
      arrive: 'Arrive by 11:50',
      address: '120 Wooster St, 4th Floor, New York, NY 10012',
      mapQuery: 'Berta NYC, 120 Wooster St, New York, NY 10012',
      phone: '212-625-2000',
      status: 'Confirmed', statusKey: 'confirmed',
      event: 'Fall/Winter 2027 flagship event',
      rsvp: true,
      guests: 4,
      invited: ['Melonie', 'Kailey', 'Neisha', 'Carmen', 'Sileni'],
      styles: ['25-02', '24-04', '24-107', '26-112', '27-04', '27-06']
    },
    {
      id: 'milanova',
      name: 'Milla Nova NYC',
      short: 'Sat, Oct 17 \u00b7 3:30 PM',
      when: 'Saturday, October 17 \u00b7 3:30 PM',
      arrive: 'Arrive by 3:15',
      address: '597 Broadway, New York, NY 10012',
      mapQuery: 'Milla Nova, 597 Broadway, New York, NY 10012',
      phone: '646-787-5178',
      status: 'Confirmed', statusKey: 'confirmed',
      rsvp: true,
      guests: 3,
      invited: ['Melonie', 'Kailey', 'Neisha', 'Carmen', 'Sileni'],
      styles: []
    },
    {
      id: 'galia',
      name: 'Galia Lahav NYC',
      short: 'Oct 15\u201318 \u00b7 date and time TBD',
      when: 'Trunk show \u00b7 October 15\u201318 \u00b7 date and time TBD',
      address: '155 Wooster St, New York, NY 10012',
      mapQuery: 'Galia Lahav, 155 Wooster St, New York, NY 10012',
      phone: '646-677-5147',
      status: 'TBD', statusKey: 'tbd',
      rsvp: false, guests: 0, invited: [],
      styles: []
    },
    {
      id: 'karennovias',
      name: 'Karen Novias',
      short: 'Santiago \u00b7 possible stop-by',
      when: 'Possible stop-by \u00b7 date and time TBD',
      address: 'Santiago, Dominican Republic',
      mapQuery: 'Karen Novias & Boutique, Santiago, Dominican Republic',
      phone: '',
      status: 'TBD', statusKey: 'tbd',
      event: 'Visit only if there is time during the DR trip. Question for Dioris: does it rent bridal gowns?',
      rsvp: false, guests: 0, invited: [],
      styles: []
    },
    {
      id: 'lanovea',
      name: 'La Novea \u00b7 Santiago',
      short: 'Oct 8 \u00b7 3:00 PM \u00b7 not booked',
      when: 'October 8 \u00b7 3:00 PM (not booked yet)',
      address: 'Santiago, Dominican Republic',
      mapQuery: '',
      phone: '',
      status: 'On hold', statusKey: 'hold',
      rsvp: false, guests: 0, invited: [],
      styles: []
    }
  ];
  var selected = 'berta';
  var ready = false;
  // ---------------------------------------------------------------------------

  var VERDICTS = ['Love', 'Maybe', 'No'];
  var notes = [];
  var rsvps = [];
  var loaded = false;
  var flash = null;
  var rsvpFlash = null;

  // Notes reuse the page password that was typed at the gate, so there is no
  // second password. It lives only in memory for this visit.
  function getKey() { return window.DRESS_KEY || ''; }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // --- Tabs ------------------------------------------------------------------
  var tabs = $$('.dress-tabs .viewtab');
  var panels = { guide: $('#panel-guide'), references: $('#panel-references'), appointments: $('#panel-appointments') };

  function showTab(name, updateHash) {
    if (!panels[name]) name = 'guide';
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-tab') === name;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
    });
    Object.keys(panels).forEach(function (k) { panels[k].hidden = (k !== name); });
    if (updateHash && window.history && history.replaceState) history.replaceState(null, '', '#' + name);
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { showTab(t.getAttribute('data-tab'), true); });
    t.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      var next = tabs[(i + d + tabs.length) % tabs.length];
      next.focus();
      showTab(next.getAttribute('data-tab'), true);
    });
  });
  function tabFromHash() {
    var parts = (location.hash || '').replace('#', '').split('/');
    var name = panels[parts[0]] ? parts[0] : 'guide';
    if (name === 'appointments' && parts[1] && APPOINTMENTS.some(function (a) { return a.id === parts[1]; })) {
      selected = parts[1];
      if (ready) render();
    }
    showTab(name, false);
  }
  window.addEventListener('hashchange', tabFromHash);
  tabFromHash();

  // --- Jump from a gown number to its reference photo -------------------------
  function openReference(num) {
    showTab('references', true);
    var tile = $$('.ref-tile').filter(function (t) { return $('.ref-tile__num', t).textContent.trim() === num; })[0];
    if (!tile) return;
    if (tile.hidden) { var all = $('.ref-filter__btn[data-filter="all"]'); if (all) all.click(); }
    tile.scrollIntoView({ block: 'center' });
    var open = $('.ref-tile__open', tile);
    if (open) open.click();
  }

  // --- Server calls ------------------------------------------------------------
  function call(action, payload) {
    if (!ENDPOINT) return Promise.reject(new Error('not-connected'));
    var body = JSON.stringify(Object.assign({ action: action, key: getKey() }, payload || {}));
    return fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (!j || !j.ok) throw new Error((j && j.error) || 'failed'); return j; });
  }

  function setNotice(msg) {
    var n = $('#apptsNotice');
    n.textContent = msg || '';
    n.hidden = !msg;
  }

  function loadNotes() {
    if (!ENDPOINT) {
      setNotice('Notes and photos switch on once the Google Sheet is connected. Appointment details below are live now.');
      render();
      return;
    }
    if (!getKey()) {
      setNotice('Unlock the page with its password to see notes and photos.');
      render();
      return;
    }
    call('list').then(function (j) {
      notes = j.notes || [];
      rsvps = j.rsvps || [];
      loaded = true;
      setNotice('');
      render();
    }).catch(function (err) {
      if (err && err.message === 'auth') {
        setNotice('Notes could not unlock. The notes password in Google may not match the page password.');
      } else {
        setNotice('Notes could not load. Check your connection and refresh the page.');
      }
      render();
    });
  }

  // --- Photo handling ------------------------------------------------------------
  function shrink(file, maxSide, quality) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * s);
        c.height = Math.round(img.naturalHeight * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('bad-image')); };
      img.src = url;
    });
  }

  // --- Viewer for full-size photos -------------------------------------------------
  var viewer = el('div', 'appt-viewer');
  viewer.hidden = true;
  viewer.setAttribute('role', 'dialog');
  viewer.setAttribute('aria-modal', 'true');
  viewer.setAttribute('aria-label', 'Photo, full size');
  var viewerClose = el('button', 'appt-viewer__close', '\u00d7');
  viewerClose.type = 'button';
  viewerClose.setAttribute('aria-label', 'Close');
  var viewerBody = el('div');
  viewer.appendChild(viewerClose);
  viewer.appendChild(viewerBody);
  document.body.appendChild(viewer);
  function closeViewer() { viewer.hidden = true; viewerBody.textContent = ''; document.body.style.overflow = ''; }
  viewerClose.addEventListener('click', closeViewer);
  viewer.addEventListener('click', function (e) { if (e.target === viewer) closeViewer(); });
  document.addEventListener('keydown', function (e) { if (!viewer.hidden && e.key === 'Escape') closeViewer(); });

  function showPhoto(photoId) {
    viewerBody.textContent = '';
    viewerBody.appendChild(el('p', 'appt-viewer__msg', 'Loading photo\u2026'));
    viewer.hidden = false;
    document.body.style.overflow = 'hidden';
    call('photo', { id: photoId }).then(function (j) {
      viewerBody.textContent = '';
      var img = new Image();
      img.alt = 'Gown photo';
      img.src = j.data;
      viewerBody.appendChild(img);
    }).catch(function () {
      viewerBody.textContent = '';
      viewerBody.appendChild(el('p', 'appt-viewer__msg', 'That photo could not load.'));
    });
  }

  // --- Rendering ---------------------------------------------------------------------
  function gownKey(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }

  function groupGowns(apptId) {
    var order = [], map = {};
    notes.filter(function (n) { return n.appt === apptId; }).forEach(function (n) {
      var k = gownKey(n.gown);
      if (!map[k]) { map[k] = { title: n.gown, notes: [] }; order.push(k); }
      map[k].notes.push(n);
    });
    return order.map(function (k) { return map[k]; });
  }

  function verdictBadge(v) {
    var key = String(v || '').toLowerCase();
    return el('span', 'verdict verdict--' + (key === 'love' ? 'love' : key === 'no' ? 'no' : 'maybe'), v);
  }

  function renderGown(g) {
    var row = el('div', 'gown');
    var photos = g.notes.filter(function (n) { return n.thumb && n.photoId; });
    if (photos.length) {
      var col = el('div', 'gown__photos');
      photos.forEach(function (n) {
        var b = el('button', 'appt__photo');
        b.type = 'button';
        b.setAttribute('aria-label', 'Enlarge photo of ' + g.title);
        var img = new Image();
        img.alt = g.title;
        img.src = n.thumb;
        b.appendChild(img);
        b.addEventListener('click', function () { showPhoto(n.photoId); });
        col.appendChild(b);
      });
      row.appendChild(col);
    }
    var body = el('div', 'gown__body');
    body.appendChild(el('p', 'gown__title', g.title));
    var refNum = REF_MAP[g.title.trim()];
    var link = STYLE_LINKS[g.title.trim()];
    if (refNum || link) {
      var ref = el('p', 'gown__ref');
      if (link) {
        var dl = el('a', null, 'Designer photo');
        dl.href = link;
        dl.target = '_blank';
        dl.rel = 'noopener';
        ref.appendChild(dl);
      }
      if (refNum) {
        if (link) ref.appendChild(document.createTextNode(' \u00b7 '));
        var rb = el('button', null, 'See reference ' + refNum);
        rb.type = 'button';
        rb.addEventListener('click', function () { openReference(refNum); });
        ref.appendChild(rb);
      }
      body.appendChild(ref);
    }
    var list = el('ul', 'gown__notes');
    g.notes.forEach(function (n) {
      var li = el('li', 'gown__note');
      li.appendChild(el('span', 'gown__who', n.name));
      li.appendChild(verdictBadge(n.verdict));
      if (n.note) li.appendChild(el('span', 'gown__text', n.note));
      list.appendChild(li);
    });
    body.appendChild(list);
    row.appendChild(body);
    return row;
  }

  function renderForm(a) {
    var d = el('details', 'appt-form');
    d.setAttribute('data-key', 'note-' + a.id);
    var sum = el('summary', null, 'Add a gown or note');
    d.appendChild(sum);

    var form = el('form');
    form.noValidate = true;

    var grid = el('div', 'appt-form__grid');
    var who = el('select', 'appt-form__field');
    who.setAttribute('aria-label', 'Your name');
    who.appendChild(new Option('Your name', ''));
    PEOPLE.forEach(function (p) { who.appendChild(new Option(p, p)); });

    var gown = el('input', 'appt-form__field');
    gown.type = 'text';
    gown.placeholder = 'Gown name or number';
    gown.setAttribute('aria-label', 'Gown name or number');
    gown.maxLength = 80;
    var dlId = 'gowns-' + a.id;
    gown.setAttribute('list', dlId);
    var dl = el('datalist');
    dl.id = dlId;
    var seen = {};
    a.styles.concat(groupGowns(a.id).map(function (g) { return g.title; })).forEach(function (s) {
      var k = gownKey(s);
      if (!seen[k]) { seen[k] = 1; dl.appendChild(new Option(s, s)); }
    });
    grid.appendChild(who);
    grid.appendChild(gown);
    grid.appendChild(dl);
    form.appendChild(grid);

    var fs = el('fieldset', 'appt-form__verdict');
    fs.appendChild(el('legend', null, 'Verdict'));
    VERDICTS.forEach(function (v) {
      var lab = el('label');
      var r = el('input');
      r.type = 'radio'; r.name = 'verdict-' + a.id; r.value = v;
      lab.appendChild(r);
      lab.appendChild(el('span', null, v));
      fs.appendChild(lab);
    });
    form.appendChild(fs);

    var text = el('textarea', 'appt-form__field');
    text.rows = 3;
    text.maxLength = 500;
    text.placeholder = 'What stood out? Fit, sleeves, how it moved\u2026';
    text.setAttribute('aria-label', 'Comment');
    form.appendChild(text);

    var photoWrap = el('div', 'appt-form__photo');
    var photo = el('input');
    photo.type = 'file';
    photo.accept = 'image/*';
    photo.setAttribute('aria-label', 'Add a photo');
    photoWrap.appendChild(photo);
    form.appendChild(photoWrap);

    var actions = el('div', 'appt-form__actions');
    var btn = el('button', 'appt-form__btn', 'Add to this visit');
    btn.type = 'submit';
    var status = el('span', 'appt-form__status');
    status.setAttribute('role', 'status');
    actions.appendChild(btn);
    actions.appendChild(status);
    form.appendChild(actions);

    function say(msg, kind) {
      status.textContent = msg || '';
      status.className = 'appt-form__status' + (kind ? ' is-' + kind : '');
    }

    if (flash && flash.id === a.id) { say(flash.msg, 'ok'); flash = null; }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var verdict = ($('input[name="verdict-' + a.id + '"]:checked', form) || {}).value;
      if (!ENDPOINT) return say('Notes are not connected yet.', 'error');
      if (!getKey()) return say('Unlock the page with its password first.', 'error');
      if (!who.value) return say('Choose your name first.', 'error');
      if (!gown.value.trim()) return say('Enter the gown name or number.', 'error');
      if (!verdict) return say('Pick Love, Maybe, or No.', 'error');

      btn.disabled = true;
      say('Saving\u2026');
      var file = photo.files && photo.files[0];
      var prep = file
        ? Promise.all([shrink(file, 1200, 0.8), shrink(file, 360, 0.7)])
        : Promise.resolve([null, null]);
      prep.then(function (imgs) {
        return call('add', {
          appt: a.id, name: who.value, gown: gown.value.trim(), verdict: verdict,
          note: text.value.trim(), photo: imgs[0], thumb: imgs[1]
        });
      }).then(function () {
        form.reset();
        flash = { id: a.id, msg: 'Added.' };
        loadNotes();
      }).catch(function (err) {
        if (err && err.message === 'auth') return say('Could not save: the notes password does not match the page password.', 'error');
        say(err && err.message === 'bad-image'
          ? 'That photo could not be read. Try a different one.'
          : 'Could not save. Try again in a moment.', 'error');
      }).then(function () { btn.disabled = false; });
    });

    d.appendChild(form);
    return d;
  }

  // --- Guests and RSVP -------------------------------------------------------------
  var RSVP_LABEL = { Yes: 'Going', Maybe: 'Maybe', No: "Can't go" };

  function apptRsvps(apptId) { return rsvps.filter(function (r) { return r.appt === apptId; }); }

  function renderGuests(a) {
    var block = el('section', 'dsec dsec--guests');
    block.appendChild(el('h4', 'dsec__title', 'Guests \u00b7 up to ' + a.guests));

    var known = loaded || !ENDPOINT;
    var byName = {};
    apptRsvps(a.id).forEach(function (r) { byName[r.name] = r; });
    var names = a.invited.slice();
    Object.keys(byName).forEach(function (n) { if (names.indexOf(n) === -1) names.push(n); });

    var yes = 0, maybe = 0, no = 0, wait = 0;
    var ul = el('ul', 'guests');
    names.forEach(function (n) {
      var r = byName[n];
      var key = !known || !r ? 'wait' : r.response === 'Yes' ? 'yes' : r.response === 'Maybe' ? 'maybe' : 'no';
      if (!r) wait++;
      else if (r.response === 'Yes') yes++;
      else if (r.response === 'Maybe') maybe++;
      else no++;

      var li = el('li', 'guest');
      li.appendChild(el('span', 'guest__dot guest__dot--' + key, n.charAt(0)));
      li.appendChild(el('span', 'guest__name', n));
      var status = !known ? '\u2026' : !r ? 'Waiting' : RSVP_LABEL[r.response];
      if (known && r && r.response === 'Yes' && r.inPerson) status += ' \u00b7 in person';
      li.appendChild(el('span', 'guest__status', status));
      ul.appendChild(li);
    });
    if (names.length) block.appendChild(ul);

    if (known) {
      var parts = [];
      if (yes) parts.push(yes + ' going');
      if (maybe) parts.push(maybe + ' maybe');
      if (no) parts.push(no + " can't go");
      if (wait) parts.push(wait + ' waiting');
      block.appendChild(el('p', 'dsec__note', parts.length ? parts.join(' \u00b7 ') : 'No RSVPs yet.'));
    }
    block.appendChild(renderRsvpForm(a));
    block.appendChild(el('p', 'dsec__note', 'You can also RSVP in the calendar invite.'));
    return block;
  }

  function renderRsvpForm(a) {
    var d = el('details', 'appt-form appt-form--rsvp appt-form--button');
    d.setAttribute('data-key', 'rsvp-' + a.id);
    d.appendChild(el('summary', null, 'RSVP'));

    var form = el('form');
    form.noValidate = true;

    var who = el('select', 'appt-form__field');
    who.setAttribute('aria-label', 'Your name');
    who.style.maxWidth = '260px';
    who.appendChild(new Option('Your name', ''));
    PEOPLE.forEach(function (p) { who.appendChild(new Option(p, p)); });
    var grid = el('div', 'appt-form__grid');
    grid.appendChild(who);
    form.appendChild(grid);

    var fs = el('fieldset', 'appt-form__verdict');
    fs.appendChild(el('legend', null, 'Are you coming?'));
    [['Yes', 'Going'], ['Maybe', 'Maybe'], ['No', "Can't go"]].forEach(function (o) {
      var lab = el('label');
      var r = el('input');
      r.type = 'radio'; r.name = 'rsvp-' + a.id; r.value = o[0];
      lab.appendChild(r);
      lab.appendChild(el('span', null, o[1]));
      fs.appendChild(lab);
    });
    form.appendChild(fs);

    var ipWrap = el('label', 'appt-form__check');
    var ip = el('input');
    ip.type = 'checkbox';
    ipWrap.appendChild(ip);
    ipWrap.appendChild(el('span', null, " I'll be there in person"));
    form.appendChild(ipWrap);

    var actions = el('div', 'appt-form__actions');
    var btn = el('button', 'appt-form__btn', 'Send RSVP');
    btn.type = 'submit';
    var status = el('span', 'appt-form__status');
    status.setAttribute('role', 'status');
    actions.appendChild(btn);
    actions.appendChild(status);
    form.appendChild(actions);
    form.appendChild(el('p', 'appt__empty', 'You can change your answer any time by sending it again.'));

    function say(msg, kind) {
      status.textContent = msg || '';
      status.className = 'appt-form__status' + (kind ? ' is-' + kind : '');
    }
    if (rsvpFlash && rsvpFlash.id === a.id) { say(rsvpFlash.msg, 'ok'); rsvpFlash = null; }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var resp = ($('input[name="rsvp-' + a.id + '"]:checked', form) || {}).value;
      if (!ENDPOINT) return say('RSVPs are not connected yet.', 'error');
      if (!getKey()) return say('Unlock the page with its password first.', 'error');
      if (!who.value) return say('Choose your name first.', 'error');
      if (!resp) return say("Pick Going, Maybe, or Can't go.", 'error');
      btn.disabled = true;
      say('Saving\u2026');
      call('rsvp', { appt: a.id, name: who.value, response: resp, inPerson: !!ip.checked && resp === 'Yes' })
        .then(function () {
          rsvpFlash = { id: a.id, msg: 'Thanks, your RSVP is in.' };
          form.reset();
          loadNotes();
        }).catch(function () {
          say('Could not save. If this keeps happening, the Google script may need updating.', 'error');
        }).then(function () { btn.disabled = false; });
    });

    d.appendChild(form);
    return d;
  }

  function renderStyles(a) {
    var panel = el('section', 'dsec dsec--styles');
    panel.appendChild(el('h4', 'dsec__title', 'Styles to try'));
    var grid = el('ul', 'tiles');
    a.styles.forEach(function (st) {
      var li = el('li');
      var link = STYLE_LINKS[st];
      var tile = el(link ? 'a' : 'span', 'tile');
      if (link) {
        tile.href = link;
        tile.target = '_blank';
        tile.rel = 'noopener';
        tile.setAttribute('aria-label', st + ', opens its photo in a new tab');
      }
      var frame = el('span', 'tile__frame');
      var src = STYLE_IMAGES[st];
      if (src) {
        var img = new Image();
        img.alt = '';
        img.loading = 'lazy';
        img.referrerPolicy = 'no-referrer';
        img.className = 'tile__img';
        img.addEventListener('error', function () { frame.classList.add('is-missing'); img.remove(); });
        img.src = src;
        frame.appendChild(img);
      } else {
        frame.classList.add('is-missing');
      }
      tile.appendChild(frame);
      tile.appendChild(el('span', 'tile__num', st));
      li.appendChild(tile);
      grid.appendChild(li);
    });
    panel.appendChild(grid);
    panel.appendChild(el('p', 'dsec__note', "Tap a tile to open the gown on the designer's page."));
    return panel;
  }

  function renderTriedOn(card, a, gowns) {
    var sec = el('section', 'visit');
    sec.appendChild(el('h4', 'dsec__title', gowns.length ? 'Tried on \u00b7 ' + gowns.length + (gowns.length === 1 ? ' gown' : ' gowns') : 'Visit notes'));
    if (gowns.length) {
      gowns.forEach(function (g) { sec.appendChild(renderGown(g)); });
    } else {
      sec.appendChild(el('p', 'visit__empty', loaded || !ENDPOINT
        ? 'Photos and comments from the visit will show up here.'
        : 'Loading\u2026'));
    }
    sec.appendChild(renderForm(a));
    card.appendChild(sec);
  }

  function renderCard(a) {
    var card = el('article', 'appt-detail');
    card.id = 'appt-' + a.id;

    card.appendChild(el('h3', 'appt__name', a.name));
    card.appendChild(el('p', 'appt__when', a.when));
    if (a.arrive) card.appendChild(el('p', 'appt__event', a.arrive));
    var addr = el('p', 'appt__where', a.address);
    if (a.mapQuery) {
      addr.appendChild(document.createTextNode(' '));
      var m = el('a', 'appt__map', 'Open in Maps');
      m.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(a.mapQuery);
      m.target = '_blank';
      m.rel = 'noopener';
      addr.appendChild(m);
    }
    card.appendChild(addr);
    if (a.phone) {
      var ph = el('p', 'appt__phone', a.statusKey === 'confirmed' ? 'Running late? Call ' : 'Questions? Call ');
      var tel = el('a', 'appt__map', a.phone);
      tel.href = 'tel:' + a.phone.replace(/[^0-9+]/g, '');
      ph.appendChild(tel);
      card.appendChild(ph);
    }
    if (a.event) card.appendChild(el('p', 'appt__event', a.event));

    var gowns = groupGowns(a.id);
    // After the visit, photos and comments lead; before it, the plan leads.
    if (gowns.length) renderTriedOn(card, a, gowns);
    if (a.rsvp) card.appendChild(renderGuests(a));
    if (a.styles.length) card.appendChild(renderStyles(a));
    if (!gowns.length) renderTriedOn(card, a, gowns);
    return card;
  }

  function renderPicker() {
    var list = el('div', 'appt-list');
    list.setAttribute('role', 'tablist');
    list.setAttribute('aria-label', 'Boutiques');
    APPOINTMENTS.forEach(function (a) {
      var b = el('button', 'appt-item' + (a.id === selected ? ' is-selected' : ''));
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', a.id === selected ? 'true' : 'false');
      b.appendChild(el('span', 'appt-item__name', a.name));
      b.appendChild(el('span', 'appt-item__when', a.short));
      b.appendChild(el('span', 'appt-item__status appt-item__status--' + a.statusKey, a.status));
      b.addEventListener('click', function () {
        selected = a.id;
        if (window.history && history.replaceState) history.replaceState(null, '', '#appointments/' + a.id);
        render();
      });
      list.appendChild(b);
    });
    return list;
  }

  function render() {
    var root = $('#apptsList');
    // Keep any open form (and what is typed in it) from closing on refresh
    var open = {};
    $$('details.appt-form', root).forEach(function (d) { open[d.getAttribute('data-key')] = d.open; });
    root.textContent = '';
    var cur = APPOINTMENTS.filter(function (a) { return a.id === selected; })[0] || APPOINTMENTS[0];
    var wrap = el('div', 'appts-wrap');
    wrap.appendChild(renderPicker());
    var detail = renderCard(cur);
    $$('details.appt-form', detail).forEach(function (d) { if (open[d.getAttribute('data-key')]) d.open = true; });
    wrap.appendChild(detail);
    root.appendChild(wrap);
  }

  ready = true;
  render();
  document.addEventListener('dress:unlocked', loadNotes);
  if (!$('#dressLayout.dress-locked')) loadNotes();
})();
