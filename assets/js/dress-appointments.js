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
      // virtual: true makes every guest a video guest. They can only say yes after
      // timeBlock is filled in (for example 'Thursday, October 22 \u00b7 2:00\u20134:00 PM'),
      // because yes means "I am free that day during that time".
      rsvp: true, virtual: true, timeBlock: '', guests: 0,
      invited: ['Melonie', 'Kailey', 'Neisha', 'Carmen', 'Sileni'],
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
  var triedFilter = 'all';   // which verdict the Tried on list is filtered to
  var openForms = {};        // which add/RSVP forms are open, kept across refreshes

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

  function verdictTally(g) {
    var c = { Love: 0, Maybe: 0, No: 0 };
    g.notes.forEach(function (n) { if (c[n.verdict] != null) c[n.verdict]++; });
    return ['Love', 'Maybe', 'No'].filter(function (k) { return c[k]; })
      .map(function (k) { return c[k] + ' ' + k.toLowerCase(); }).join(' \u00b7 ');
  }

  // A button that opens and closes a form in place. The form never moves,
  // however long the list below it grows.
  function toggleButton(key, label, panel) {
    var b = el('button', 'appt-form__btn', label);
    b.type = 'button';
    function sync() {
      var on = !!openForms[key];
      panel.hidden = !on;
      b.classList.toggle('is-open', on);
      b.setAttribute('aria-expanded', on ? 'true' : 'false');
    }
    b.addEventListener('click', function () { openForms[key] = !openForms[key]; sync(); });
    sync();
    return b;
  }

  function renderGown(g) {
    var row = el('div', 'gown');
    var photos = g.notes.filter(function (n) { return n.thumb && n.photoId; });

    var info = el('div', 'gown__info');
    info.appendChild(el('p', 'gown__title', g.title));
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
      info.appendChild(ref);
    }
    var tally = verdictTally(g);
    if (tally) info.appendChild(el('p', 'gown__tally', tally));
    if (photos.length) info.appendChild(el('p', 'gown__count', photos.length + (photos.length === 1 ? ' photo' : ' photos')));
    row.appendChild(info);

    var main = el('div', 'gown__main');
    if (photos.length) {
      var strip = el('div', 'gown__photos');
      photos.forEach(function (n) {
        var b = el('button', 'appt__photo');
        b.type = 'button';
        b.setAttribute('aria-label', 'Enlarge photo of ' + g.title);
        var img = new Image();
        img.alt = g.title;
        img.src = n.thumb;
        b.appendChild(img);
        b.addEventListener('click', function () { showPhoto(n.photoId); });
        strip.appendChild(b);
      });
      main.appendChild(strip);
    }
    var list = el('ul', 'gown__notes');
    g.notes.forEach(function (n) {
      var li = el('li', 'gown__note');
      li.appendChild(el('span', 'gown__who', n.name));
      li.appendChild(verdictBadge(n.verdict));
      if (n.note) li.appendChild(el('span', 'gown__text', n.note));
      list.appendChild(li);
    });
    main.appendChild(list);
    row.appendChild(main);
    return row;
  }

  function renderForm(a) {
    var d = el('div', 'appt-form appt-form--note');

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
  function apptRsvps(apptId) { return rsvps.filter(function (r) { return r.appt === apptId; }); }

  // How one guest's answer reads: the circle style and the word under it.
  // An RSVP is a yes or a no. A yes that is not "in person" means joining by video.
  function guestState(a, r, known) {
    if (!known) return { key: 'wait', label: '\u2026' };
    if (!r) return { key: 'wait', label: 'Waiting' };
    if (r.response === 'Yes') {
      if (a.virtual) return { key: 'yes', label: 'Available' };
      return r.inPerson ? { key: 'yes', label: 'Going' } : { key: 'video', label: 'By video' };
    }
    if (r.response === 'No') return { key: 'no', label: a.virtual ? "Can't join" : "Can't go" };
    return { key: 'wait', label: 'Waiting' };
  }

  function renderGuests(a) {
    var block = el('section', 'dsec dsec--guests');
    block.appendChild(el('h4', 'dsec__title', a.virtual ? 'Virtual guests \u00b7 by video' : 'Guests \u00b7 up to ' + a.guests));

    var known = loaded || !ENDPOINT;
    var byName = {};
    apptRsvps(a.id).forEach(function (r) { byName[r.name] = r; });
    var names = a.invited.slice();
    Object.keys(byName).forEach(function (n) { if (names.indexOf(n) === -1) names.push(n); });

    var yes = 0, video = 0, no = 0, wait = 0;
    var ul = el('ul', 'guests');
    names.forEach(function (n) {
      var st = guestState(a, byName[n], known);
      if (st.key === 'yes') yes++; else if (st.key === 'video') video++; else if (st.key === 'no') no++; else wait++;
      var li = el('li', 'guest guest--' + st.key);
      li.appendChild(el('span', 'guest__avatar', n.charAt(0).toUpperCase()));
      li.appendChild(el('span', 'guest__name', n));
      li.appendChild(el('span', 'guest__status', st.label));
      ul.appendChild(li);
    });
    if (names.length) block.appendChild(ul);

    // Video guests can only answer once the day and time are known.
    var canRsvp = !a.virtual || !!a.timeBlock;
    if (canRsvp) {
      var form = renderRsvpForm(a);
      var row = el('div', 'rsvp-row');
      row.appendChild(toggleButton('rsvp-' + a.id, 'RSVP', form));
      if (known) {
        var parts = [];
        if (yes) parts.push(yes + (a.virtual ? ' available' : ' going'));
        if (video) parts.push(video + ' by video');
        if (no) parts.push(no + (a.virtual ? " can't join" : " can't go"));
        if (wait) parts.push(wait + ' waiting');
        row.appendChild(el('span', 'dsec__note', parts.length ? parts.join(' \u00b7 ') : 'No RSVPs yet.'));
      }
      block.appendChild(row);
      block.appendChild(form);
    }
    var note;
    if (a.virtual) {
      note = a.timeBlock
        ? 'Time block: ' + a.timeBlock + '. Say yes only if you are free for all of it.'
        : 'Invited to be available by video during a time block. RSVP opens once the day and time are set, so availability can be confirmed.';
    } else {
      note = 'Up to ' + a.guests + ' in person. Anyone else can join by video if free on that day during the appointment. You can also RSVP in the calendar invite.';
    }
    block.appendChild(el('p', 'dsec__note', note));
    return block;
  }

  function radioSet(name, legend, options) {
    var fs = el('fieldset', 'appt-form__verdict');
    fs.appendChild(el('legend', null, legend));
    options.forEach(function (o) {
      var lab = el('label');
      var r = el('input');
      r.type = 'radio'; r.name = name; r.value = o[0];
      lab.appendChild(r);
      lab.appendChild(el('span', null, o[1]));
      fs.appendChild(lab);
    });
    return fs;
  }

  function renderRsvpForm(a) {
    var d = el('div', 'appt-form appt-form--rsvp');

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

    // 1. Yes or no.
    var fsResp = radioSet('rsvp-' + a.id,
      a.virtual ? 'Can you be on the video call?' : 'Are you coming?',
      a.virtual ? [['Yes', 'Available'], ['No', "Can't join"]] : [['Yes', 'Going'], ['No', "Can't go"]]);
    form.appendChild(fsResp);

    // 2. In person or by video (video-only boutiques skip this).
    var fsHow = null;
    if (!a.virtual) {
      fsHow = radioSet('how-' + a.id, 'How will you join?', [['person', 'In person'], ['video', 'By video']]);
      form.appendChild(fsHow);
    }

    // 3. Anyone joining by video confirms they are free that day and time.
    var okWrap = el('label', 'appt-form__check');
    var ok = el('input');
    ok.type = 'checkbox';
    okWrap.appendChild(ok);
    okWrap.appendChild(el('span', null, a.virtual
      ? " I'm free on " + a.timeBlock + ' and can be on the video call for all of it.'
      : " I'm free on " + a.when + ' and can be on the video call for the whole appointment.'));
    form.appendChild(okWrap);

    function pickedValue(name) { return ($('input[name="' + name + '"]:checked', form) || {}).value; }
    function sync() {
      var resp = pickedValue('rsvp-' + a.id);
      var how = fsHow ? pickedValue('how-' + a.id) : 'video';
      if (fsHow) fsHow.hidden = resp !== 'Yes';
      okWrap.hidden = !(resp === 'Yes' && how === 'video');
    }
    form.addEventListener('change', sync);
    sync();

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
      var resp = pickedValue('rsvp-' + a.id);
      var how = fsHow ? pickedValue('how-' + a.id) : 'video';
      if (!ENDPOINT) return say('RSVPs are not connected yet.', 'error');
      if (!getKey()) return say('Unlock the page with its password first.', 'error');
      if (!who.value) return say('Choose your name first.', 'error');
      if (!resp) return say(a.virtual ? "Pick Available or Can't join." : "Pick Going or Can't go.", 'error');
      if (resp === 'Yes' && !how) return say('Pick In person or By video.', 'error');
      if (resp === 'Yes' && how === 'video' && !ok.checked) return say('Please confirm you are free on that day and time.', 'error');
      btn.disabled = true;
      say('Saving\u2026');
      call('rsvp', { appt: a.id, name: who.value, response: resp, inPerson: !a.virtual && resp === 'Yes' && how === 'person' })
        .then(function () {
          rsvpFlash = { id: a.id, msg: 'Thanks, your RSVP is in.' };
          form.reset();
          sync();
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
    panel.appendChild(el('h4', 'dsec__title', 'Dresses to try'));
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

  function hasVerdict(g, v) { return g.notes.some(function (n) { return n.verdict === v; }); }

  function renderTriedOn(card, a, gowns) {
    var sec = el('section', 'visit');

    var head = el('div', 'visit__head');
    head.appendChild(el('h4', 'dsec__title', gowns.length ? 'Tried on \u00b7 ' + gowns.length + (gowns.length === 1 ? ' gown' : ' gowns') : 'Visit notes'));
    var form = renderForm(a);
    head.appendChild(toggleButton('note-' + a.id, 'Add a gown or note', form));
    sec.appendChild(head);
    sec.appendChild(form);

    var shown = gowns;
    // With a longer list, filter chips make the favorites easy to find.
    if (gowns.length > 3) {
      var counts = { Love: 0, Maybe: 0, No: 0 };
      gowns.forEach(function (g) { VERDICTS.forEach(function (v) { if (hasVerdict(g, v)) counts[v]++; }); });
      if (triedFilter !== 'all' && !counts[triedFilter]) triedFilter = 'all';
      var bar = el('div', 'visit__filters');
      bar.setAttribute('role', 'group');
      bar.setAttribute('aria-label', 'Filter gowns by verdict');
      [['all', 'All', gowns.length]].concat(VERDICTS.map(function (v) { return [v, v, counts[v]]; })).forEach(function (f) {
        if (f[0] !== 'all' && !f[2]) return;
        var b = el('button', 'visit__filter' + (triedFilter === f[0] ? ' is-active' : ''), f[1] + ' ' + f[2]);
        b.type = 'button';
        b.setAttribute('aria-pressed', triedFilter === f[0] ? 'true' : 'false');
        b.addEventListener('click', function () { triedFilter = f[0]; render(); });
        bar.appendChild(b);
      });
      sec.appendChild(bar);
      if (triedFilter !== 'all') shown = gowns.filter(function (g) { return hasVerdict(g, triedFilter); });
    }

    if (shown.length) {
      var wrap = el('div', 'gowns');
      shown.forEach(function (g) { wrap.appendChild(renderGown(g)); });
      sec.appendChild(wrap);
    } else {
      sec.appendChild(el('p', 'visit__empty', loaded || !ENDPOINT
        ? 'Photos and comments from the visit will show up here.'
        : 'Loading\u2026'));
    }
    card.appendChild(sec);
  }

  function renderCard(a) {
    var card = el('article', 'appt-detail');
    card.id = 'appt-' + a.id;

    var head = el('div', 'appt__head');
    var info = el('div', 'appt__info');
    info.appendChild(el('h3', 'appt__name', a.name));
    info.appendChild(el('p', 'appt__when', a.when));
    if (a.arrive) info.appendChild(el('p', 'appt__event', a.arrive));
    var addr = el('p', 'appt__where', a.address);
    if (a.mapQuery) {
      addr.appendChild(document.createTextNode(' '));
      var m = el('a', 'appt__map', 'Open in Maps');
      m.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(a.mapQuery);
      m.target = '_blank';
      m.rel = 'noopener';
      addr.appendChild(m);
    }
    info.appendChild(addr);
    if (a.phone) {
      var ph = el('p', 'appt__phone', a.statusKey === 'confirmed' ? 'Running late? Call ' : 'Questions? Call ');
      var tel = el('a', 'appt__map', a.phone);
      tel.href = 'tel:' + a.phone.replace(/[^0-9+]/g, '');
      ph.appendChild(tel);
      info.appendChild(ph);
    }
    if (a.event) info.appendChild(el('p', 'appt__event', a.event));
    head.appendChild(info);
    head.appendChild(el('span', 'appt__status appt__status--' + a.statusKey, a.status));
    card.appendChild(head);

    // The plan (guests beside the dresses to try), then what happened at the visit.
    var hasGuests = !!a.rsvp, hasStyles = a.styles.length > 0;
    if (hasGuests || hasStyles) {
      var plan = el('div', 'appt__plan' + (hasGuests && hasStyles ? '' : ' appt__plan--single'));
      if (hasGuests) plan.appendChild(renderGuests(a));
      if (hasStyles) plan.appendChild(renderStyles(a));
      card.appendChild(plan);
    }
    renderTriedOn(card, a, groupGowns(a.id));
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
    root.textContent = '';
    var cur = APPOINTMENTS.filter(function (a) { return a.id === selected; })[0] || APPOINTMENTS[0];
    var wrap = el('div', 'appts-wrap');
    wrap.appendChild(renderPicker());
    wrap.appendChild(renderCard(cur));
    root.appendChild(wrap);
  }

  ready = true;
  render();
  document.addEventListener('dress:unlocked', loadNotes);
  if (!$('#dressLayout.dress-locked')) loadNotes();
})();
