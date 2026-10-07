/* ==========================================================================
   app.js — Studio UI.

   Screens
     home    "My flipbooks": resume card for unsaved work, + New, saved books
     edit    the editor: title, Preview / Save / Download, steps, page spreads
     reader  FlipBook overlay (src/viewer)

   State lives in `state`; renderEditor() / renderHome() redraw from it.
   `state.dirty` is true when the board has changes that aren't in the library.
   ========================================================================== */
(function (S) {
  'use strict';
  var U = S.util, store = S.storage, ex = S.exporter;
  var $ = function (id) { return document.getElementById(id); };

  var state = {
    pages: [],          // page records in reading order
    title: '',
    editingId: null,    // library id when editing a saved flipbook
    dirty: false        // changes not yet saved to the library
  };

  // ======================================================== status line
  var statusTimer;
  function progress(text, fraction) {
    clearTimeout(statusTimer);
    var s = $('status');
    s.hidden = false; s.classList.remove('is-error');
    $('statusText').textContent = text;
    $('statusPct').textContent = fraction == null ? '' : Math.round(fraction * 100) + '%';
    $('statusLine').style.width = fraction == null ? '0' : Math.round(fraction * 100) + '%';
  }
  function notify(text, isError, ms) {
    progress(text, null);
    $('status').classList.toggle('is-error', !!isError);
    statusTimer = setTimeout(function () { $('status').hidden = true; }, ms || 3200);
  }
  function settings() { return { quality: +$('quality').value || 2400, ocr: $('ocr').checked }; }

  // ======================================================== screens
  var current = 'home';
  function show(view) {
    current = view;
    $('view-home').hidden = view !== 'home';
    $('view-edit').hidden = view !== 'edit';
    $('navHome').classList.toggle('is-active', view === 'home');
    $('navNew').classList.toggle('is-active', view === 'edit');
    if (view === 'home') renderHome();
    else renderEditor();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('[data-go="home"]').forEach(function (b) { b.onclick = function () { show('home'); }; });

  /** Ask before throwing away unsaved work. Returns true if it's OK to continue. */
  function okToDiscard(what) {
    if (!state.dirty || !state.pages.length) return true;
    return confirm('“' + (state.title || 'Untitled flipbook') + '” has unsaved changes.\n\n' + what + ' anyway? (Choose Cancel, then Save, to keep them.)');
  }
  function startNew() {
    if (!okToDiscard('Start a new flipbook')) return;
    state.pages = []; state.title = ''; state.editingId = null; state.dirty = false;
    $('title').value = '';
    saveDraft();
    show('edit');
  }
  $('navNew').onclick = startNew;
  $('navImport').onclick = function () { $('importInput').value = ''; $('importInput').click(); };

  // keep the editor bar docked right under the sticky main nav (its height varies with wrapping)
  function syncHeader() { document.documentElement.style.setProperty('--nav-h', document.querySelector('.mainnav').offsetHeight + 'px'); }
  window.addEventListener('resize', syncHeader);
  syncHeader();

  /** Any change to pages/title goes through here. */
  function changed() {
    state.dirty = true;
    renderEditor();
    saveDraft();
  }

  // ======================================================== importing
  async function addFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    if (current !== 'edit') show('edit');
    var added = 0, skipped = [], opts = settings();
    try {
      for (var i = 0; i < files.length; i++) {
        var file = files[i];
        var report = (function (i) {
          return function (text, frac) { progress(text, (i + (frac || 0)) / files.length); };
        })(i);
        report('Reading ' + file.name, 0);
        await U.nextFrame();
        try {
          var pages = await S.importers.importFile(file, opts, report);
          if (S.importers.kindOf(file) === 'html' && !state.pages.length && !state.title) setTitle(pages[0] && pages[0].name.split(' · ')[0]);
          Array.prototype.push.apply(state.pages, pages);
          added += pages.length;
          state.dirty = true;
          renderEditor();
        } catch (e) {
          console.warn(file.name, e);
          skipped.push(file.name);
        }
      }
    } finally {
      S.ocr.release();
    }
    if (!state.title && added && state.pages.length === added) setTitle(files[0].name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
    changed();
    if (skipped.length) notify('Couldn’t read ' + skipped.length + ' file' + (skipped.length > 1 ? 's' : '') + ': ' + skipped.slice(0, 3).join(', '), true, 6000);
    else if (added) notify('Added ' + added + ' page' + (added === 1 ? '' : 's') + ' — drag to arrange, then Preview, Save or Download');
    else $('status').hidden = true;
  }

  function setTitle(t) {
    state.title = (t || '').trim();
    $('title').value = state.title;
  }

  // ======================================================== editor
  /** Group page indexes the way the magazine opens: cover alone, then pairs. */
  function spreadsOf(n) {
    var out = [];
    if (!n) return out;
    out.push([null, 0]);
    for (var p = 1; p < n; p += 2) out.push([p, p + 1 < n ? p + 1 : null]);
    return out;
  }

  function tile(i, side) {
    var p = state.pages[i];
    var t = document.createElement('div');
    t.className = 'tile ' + side;
    t.draggable = true;
    t.dataset.index = i;
    t.title = p.name || '';
    t.innerHTML =
      '<div class="sheet"><img alt=""></div>' +
      '<span class="pno num">' + U.pad2(i + 1) + '</span>' +
      (p.text && p.text.length ? '' : '<span class="txt" title="This page has no searchable text">No text</span>') +
      '<div class="acts">' +
        '<button class="ib" data-act="left" title="Move earlier" aria-label="Move earlier">←</button>' +
        '<button class="ib" data-act="right" title="Move later" aria-label="Move later">→</button>' +
        '<button class="ib del" data-act="del" title="Remove page" aria-label="Remove page">×</button>' +
      '</div>';
    t.querySelector('img').src = p.thumb;
    return t;
  }
  function addSlot() {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'add-slot'; b.textContent = '+ Add pages';
    b.onclick = pickFiles;
    return b;
  }

  function renderEditor() {
    var n = state.pages.length;
    // bar
    ['bRead', 'bSave', 'bDownload'].forEach(function (id) { $(id).disabled = !n; });
    var st = $('saveState');
    st.classList.toggle('is-dirty', state.dirty && n > 0);
    st.textContent = !n ? '' : state.dirty ? (state.editingId ? 'Unsaved changes' : 'Not saved yet') : 'Saved ✓';
    // steps
    var steps = $('steps').children;
    steps[0].className = n ? 'is-done' : 'is-active';
    steps[1].className = n ? 'is-active' : '';
    steps[2].className = n ? 'is-active' : '';
    // toolbar
    $('tReverse').disabled = $('tSort').disabled = n < 2;
    $('tClear').disabled = $('tBlank').disabled = !n;
    // board
    $('drop').hidden = !!n;
    $('pagesArea').hidden = !n;
    if (!n) { $('spreads').replaceChildren(); return; }

    $('spreads').style.setProperty('--page-aspect', String(state.pages[0].w / state.pages[0].h));
    var frag = document.createDocumentFragment();
    var spreads = spreadsOf(n), addPlaced = false;
    spreads.forEach(function (sp, k) {
      var box = document.createElement('div');
      box.className = 'spread';
      var pagesRow = document.createElement('div');
      pagesRow.className = 'spread-pages';
      [sp[0], sp[1]].forEach(function (i, side) {
        if (i != null) pagesRow.appendChild(tile(i, side ? 'right' : 'left'));
        else if (k === spreads.length - 1 && side === 1) { pagesRow.appendChild(addSlot()); addPlaced = true; }
        else pagesRow.appendChild(Object.assign(document.createElement('div'), { className: 'slot' }));
      });
      box.appendChild(pagesRow);
      var label = document.createElement('div');
      label.className = 'spread-label';
      var pp = sp.filter(function (x) { return x != null; }).map(function (x) { return U.pad2(x + 1); }).join('—');
      label.innerHTML = '<b>' + (k === 0 ? 'Front cover' : 'Spread ' + U.pad2(k)) + '</b><span class="num">p. ' + pp + '</span>';
      box.appendChild(label);
      frag.appendChild(box);
    });
    if (!addPlaced) {
      var box = document.createElement('div');
      box.className = 'spread';
      var row = document.createElement('div');
      row.className = 'spread-pages';
      row.appendChild(addSlot());
      box.appendChild(row);
      var lab = document.createElement('div');
      lab.className = 'spread-label';
      lab.innerHTML = '<b>Next spread</b><span>add pages</span>';
      box.appendChild(lab);
      frag.appendChild(box);
    }
    $('spreads').replaceChildren(frag);
  }

  function move(from, to) {
    if (to < 0 || to >= state.pages.length || from === to) return;
    var p = state.pages.splice(from, 1)[0];
    state.pages.splice(to, 0, p);
    changed();
  }

  // tile buttons
  $('spreads').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-act]');
    if (!b) return;
    var i = +b.closest('.tile').dataset.index;
    if (b.dataset.act === 'left') move(i, i - 1);
    else if (b.dataset.act === 'right') move(i, i + 1);
    else if (b.dataset.act === 'del') { state.pages.splice(i, 1); changed(); }
  });
  // double-click a page to preview from there
  $('spreads').addEventListener('dblclick', function (e) {
    var t = e.target.closest('.tile');
    if (t && !e.target.closest('button')) openReader(currentData(), +t.dataset.index);
  });

  // drag a tile to reorder
  var dragFrom = null;
  function clearMarks() {
    document.querySelectorAll('.drop-before,.drop-after').forEach(function (x) { x.classList.remove('drop-before', 'drop-after'); });
  }
  function dropTarget(e) {
    var t = e.target.closest('.tile');
    if (!t) return null;
    var r = t.getBoundingClientRect();
    return { tile: t, after: e.clientX > r.left + r.width / 2 };
  }
  $('spreads').addEventListener('dragstart', function (e) {
    var t = e.target.closest('.tile');
    if (!t) return;
    dragFrom = +t.dataset.index;
    t.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', 'page ' + (dragFrom + 1));   // Firefox needs data to start a drag
  });
  $('spreads').addEventListener('dragend', function (e) {
    var t = e.target.closest('.tile');
    if (t) t.classList.remove('is-dragging');
    dragFrom = null; clearMarks();
  });
  $('spreads').addEventListener('dragover', function (e) {
    if (dragFrom == null) return;
    var d = dropTarget(e);
    if (!d) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    clearMarks();
    d.tile.classList.add(d.after ? 'drop-after' : 'drop-before');
  });
  $('spreads').addEventListener('drop', function (e) {
    if (dragFrom == null) return;
    var d = dropTarget(e);
    if (!d) return;
    e.preventDefault(); e.stopPropagation();
    var to = +d.tile.dataset.index + (d.after ? 1 : 0);
    if (to > dragFrom) to--;
    var from = dragFrom;
    dragFrom = null; clearMarks();
    move(from, to);
  });

  // drop files: on the editor board, or anywhere on Home (opens the editor)
  function isFileDrag(e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0; }
  var board = $('board'), depth = 0;
  board.addEventListener('dragenter', function (e) { if (isFileDrag(e)) { depth++; board.classList.add('is-dragging-files'); } });
  board.addEventListener('dragleave', function (e) { if (isFileDrag(e) && --depth <= 0) { depth = 0; board.classList.remove('is-dragging-files'); } });
  window.addEventListener('dragover', function (e) { if (isFileDrag(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
  window.addEventListener('drop', function (e) {
    if (!isFileDrag(e)) return;
    e.preventDefault(); depth = 0; board.classList.remove('is-dragging-files');
    var files = Array.prototype.slice.call(e.dataTransfer.files);
    if (current === 'home' && files.every(function (f) { return S.importers.kindOf(f) === 'html'; })) importToLibrary(files);
    else if (current === 'home') { if (okToDiscard('Start a new flipbook')) { state.pages = []; state.title = ''; state.editingId = null; $('title').value = ''; addFiles(files); } }
    else addFiles(files);
  });

  // ======================================================== toolbar
  function pickFiles() { $('fileInput').value = ''; $('fileInput').click(); }
  $('fileInput').onchange = function () { addFiles(this.files); };
  $('dropPick').onclick = pickFiles;
  $('tAdd').onclick = pickFiles;
  $('title').addEventListener('input', function () { state.title = this.value.trim(); state.dirty = state.pages.length > 0; renderEditor(); saveDraft(); });
  $('tReverse').onclick = function () { state.pages.reverse(); changed(); };
  $('tSort').onclick = function () {
    state.pages.sort(function (a, b) { return U.naturalCompare(a.name || '', b.name || ''); });
    changed(); notify('Sorted by file name');
  };
  $('tClear').onclick = function () {
    if (!confirm('Remove all pages from this flipbook?')) return;
    state.pages = []; changed();
  };
  $('tBlank').onclick = function () {
    var first = state.pages[0], aspect = first ? first.w / first.h : 0.7071;
    state.pages.push(U.pageFromCanvas(U.whiteCanvas(1200, 1200 / aspect), 'Blank page', null, 0.9));
    changed();
    notify('Blank page added at the end — drag it into place');
  };
  // close the Settings dropdown when clicking elsewhere
  document.addEventListener('click', function (e) {
    var d = document.querySelector('.settings');
    if (d.open && !d.contains(e.target)) d.open = false;
  });
  if (!S.ocr.supported()) {
    $('ocr').checked = false; $('ocr').disabled = true;
    $('ocr').closest('label').title = 'This browser can’t run the offline text reader';
  }

  // ======================================================== draft autosave
  var draftTimer;
  function writeDraft() {
    clearTimeout(draftTimer);
    return store.saveDraft({ title: state.title, editingId: state.editingId, dirty: state.dirty, pages: state.pages })
      .catch(function (e) { console.warn('Draft not saved', e); });
  }
  /** Debounced autosave for frequent edits (typing, dragging). */
  function saveDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(writeDraft, 400);
  }
  async function loadDraft() {
    try {
      var d = await store.loadDraft();
      if (d && d.pages) {
        state.pages = d.pages; state.editingId = d.editingId || null;
        state.dirty = d.dirty == null ? !d.editingId && d.pages.length > 0 : d.dirty;  // older drafts had no flag
        setTitle(d.title);
      }
    } catch (e) { /* storage unavailable: start empty */ }
  }

  // ======================================================== preview / save / download
  function currentData() { return ex.toData(state.title || 'Untitled flipbook', state.pages); }

  var reader = null;
  function openReader(data, startPage) {
    if (!data.pages.length) return;
    clearTimeout(statusTimer);
    $('status').hidden = true;
    $('viewer').hidden = false;
    document.body.style.overflow = 'hidden';
    reader = FlipBook.mount($('viewer'), data, { onClose: closeReader, startPage: startPage || 0 });
    S.reader = reader;
  }
  function closeReader() {
    if (reader) { reader.destroy(); reader = null; S.reader = null; }
    $('viewer').hidden = true;
    document.body.style.overflow = '';
    if (document.fullscreenElement) document.exitFullscreen();
  }

  async function download(data) {
    progress('Preparing ' + data.title, null);
    var saved = await ex.saveFile(ex.fileName(data.title), ex.buildHtml(data));
    notify('✓ Downloaded “' + saved + '” — check your Downloads folder', false, 6000);
  }

  async function saveToLibrary() {
    if (!state.pages.length) return;
    store.persist();   // don't await: Firefox asks the user and would block the save
    var data = currentData();
    var id = state.editingId || U.uid();
    try {
      var prev = state.editingId ? await store.getMeta(id) : null;
      await store.saveBook(id, data, prev && prev.created);
      state.editingId = id; state.dirty = false;
      await writeDraft();          // immediately, so a reload right after saving can't resurrect "unsaved"
      renderEditor(); refreshCount();
      notify('✓ ' + (prev ? 'Updated “' : 'Saved “') + data.title + '” in My flipbooks', false, 5000);
    } catch (e) {
      notify(store.available ? 'Couldn’t save — browser storage may be full' : 'This browser blocks storage here — use Download to keep your flipbook', true, 7000);
    }
  }

  $('bRead').onclick = function () { openReader(currentData()); };
  $('bSave').onclick = saveToLibrary;
  $('bDownload').onclick = function () { download(currentData()); };

  // ======================================================== home
  async function refreshCount() {
    try {
      var n = (await store.listBooks()).length;
      $('libCount').textContent = n ? U.pad2(n) + ' saved' : '';
    } catch (e) { $('libCount').textContent = ''; }
  }

  async function renderHome() {
    // resume card for unsaved work
    var hasDraft = state.dirty && state.pages.length > 0;
    $('resume').hidden = !hasDraft;
    if (hasDraft) {
      $('resumeCover').src = state.pages[0].thumb;
      $('resumeTitle').textContent = state.title || 'Untitled flipbook';
      $('resumeMeta').textContent = U.pad2(state.pages.length) + ' pages' + (state.editingId ? ' — edits to a saved flipbook' : ' — new flipbook');
    }

    var books = [];
    var shelf = $('shelf');
    try { books = await store.listBooks(); }
    catch (e) {
      shelf.replaceChildren(newCard());
      $('storageNote').textContent = 'This browser doesn’t allow storage for files opened from disk — use Download to keep your flipbooks.';
      return;
    }
    $('libCount').textContent = books.length ? U.pad2(books.length) + ' saved' : '';
    $('homeMeta').textContent = (books.length ? U.pad2(books.length) + ' flipbook' + (books.length === 1 ? '' : 's') : 'Nothing saved yet') + ' · saved in this browser · downloads are your permanent copies';
    var frag = document.createDocumentFragment();
    frag.appendChild(newCard());
    if (!books.length) {
      var p = document.createElement('p');
      p.className = 'shelf-empty';
      p.textContent = 'Your saved flipbooks will appear here.';
      frag.appendChild(p);
    }
    books.forEach(function (m) {
      var c = document.createElement('article');
      c.className = 'cell book';
      var date = new Date(m.updated);
      c.innerHTML =
        '<div class="cell-media"><div class="cover" role="button" tabindex="0" title="Read"><img alt=""></div></div>' +
        '<div>' +
          '<div class="cell-caption"><span class="cell-title"></span><span class="cell-sub num">' + U.pad2(m.count) + ' p.</span></div>' +
          '<div class="small num">' + U.pad2(date.getDate()) + '.' + U.pad2(date.getMonth() + 1) + '.' + date.getFullYear() + (m.searchable ? ' · searchable' : '') + '</div>' +
          '<div class="cell-actions">' +
            '<button data-a="read">Read</button>' +
            '<button data-a="edit">Edit</button>' +
            '<button data-a="dl">Download</button>' +
            '<button data-a="del">Delete</button>' +
          '</div>' +
        '</div>';
      c.querySelector('img').src = m.cover;
      c.querySelector('.cell-title').textContent = m.title;
      c.querySelector('.cell-title').title = m.title;
      var cover = c.querySelector('.cover');
      cover.onclick = function () { bookAction('read', m); };
      cover.onkeydown = function (e) { if (e.key === 'Enter') bookAction('read', m); };
      c.querySelectorAll('[data-a]').forEach(function (b) { b.onclick = function () { bookAction(b.dataset.a, m); }; });
      frag.appendChild(c);
    });
    shelf.replaceChildren(frag);
  }
  function newCard() {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'cell cell-new'; b.id = 'newCard';
    b.innerHTML = '<span class="plus">+</span><span class="cell-title">New flipbook</span><span class="small">from PDFs &amp; images</span>';
    b.onclick = startNew;
    return b;
  }

  async function bookAction(action, meta) {
    if (action === 'del') {
      if (!confirm('Delete “' + meta.title + '” from My flipbooks? Downloaded copies are not affected.')) return;
      await store.deleteBook(meta.id);
      if (state.editingId === meta.id) { state.editingId = null; state.dirty = state.pages.length > 0; saveDraft(); }
      renderHome(); notify('Deleted “' + meta.title + '”');
      return;
    }
    var data = await store.loadBook(meta.id);
    if (!data) { notify('That flipbook is missing from storage', true); return; }
    if (action === 'read') openReader(data);
    else if (action === 'dl') download(data);
    else if (action === 'edit') {
      if (state.editingId !== meta.id && !okToDiscard('Open “' + meta.title + '”')) return;
      if (state.editingId !== meta.id || !state.dirty) {
        try { state.pages = await S.importers.pagesFromData(data, progress); }
        finally { $('status').hidden = true; }
        state.editingId = meta.id; state.dirty = false; setTitle(data.title);
        saveDraft();
      }
      show('edit');
    }
  }

  async function importToLibrary(files) {
    var ok = 0;
    for (var i = 0; i < files.length; i++) {
      progress('Importing ' + files[i].name, i / files.length);
      try {
        var data = ex.parse(await files[i].text());
        if (!data) throw new Error('not a flipbook');
        var pages = await S.importers.pagesFromData(data);   // normalises older files (thumbs + ratios)
        await store.saveBook(U.uid(), ex.toData(data.title, pages));
        ok++;
      } catch (e) {
        console.warn(e);
        notify('“' + files[i].name + '” isn’t a Flipbook Studio file', true, 5000);
      }
    }
    if (ok) { renderHome(); notify('Imported ' + ok + ' flipbook' + (ok === 1 ? '' : 's')); }
  }
  $('importInput').onchange = function () { importToLibrary(Array.prototype.slice.call(this.files)); };

  $('resumeGo').onclick = function () { show('edit'); };
  $('resumeDiscard').onclick = function () {
    if (!confirm('Discard the unsaved changes to “' + (state.title || 'Untitled flipbook') + '”?')) return;
    state.pages = []; state.title = ''; state.editingId = null; state.dirty = false;
    $('title').value = '';
    saveDraft(); renderHome();
  };

  // ======================================================== boot: always land on Home
  loadDraft().then(function () { show('home'); });

  // Hooks for the automated end-to-end tests (tests/e2e.mjs).
  S.app = { state: state, addFiles: addFiles, currentData: currentData, openReader: openReader, closeReader: closeReader, show: show };
})(window.Studio);
