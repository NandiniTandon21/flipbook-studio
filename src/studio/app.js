/* ==========================================================================
   app.js — Studio UI: the Make board, the Library, the reader overlay.
   State lives in `state`; `render()` redraws the board from it.
   ========================================================================== */
(function (S) {
  'use strict';
  var U = S.util, store = S.storage, ex = S.exporter;
  var $ = function (id) { return document.getElementById(id); };

  var state = {
    pages: [],          // page records in reading order
    title: '',
    editingId: null     // library id when editing a saved flipbook
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

  // ======================================================== importing
  async function addFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
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
          render();
        } catch (e) {
          console.warn(file.name, e);
          skipped.push(file.name);
        }
      }
    } finally {
      S.ocr.release();
    }
    if (!state.title && added && state.pages.length === added) setTitle(files[0].name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
    render(); saveDraft();
    if (skipped.length) notify('Couldn’t read ' + skipped.length + ' file' + (skipped.length > 1 ? 's' : '') + ': ' + skipped.slice(0, 3).join(', '), true, 6000);
    else if (added) notify('Added ' + added + ' page' + (added === 1 ? '' : 's'));
    else $('status').hidden = true;
  }

  function setTitle(t) {
    state.title = (t || '').trim();
    $('title').value = state.title;
  }

  // ======================================================== board
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

  function render() {
    var n = state.pages.length;
    var searchable = state.pages.filter(function (p) { return p.text && p.text.length; }).length;
    $('metaPages').textContent = n ? U.pad2(n) + ' page' + (n === 1 ? '' : 's') + ' — ' + U.pad2(spreadsOf(n).length) + ' spread' + (spreadsOf(n).length === 1 ? '' : 's') : 'No pages yet';
    $('metaText').textContent = n ? (searchable ? 'Searchable text on ' + searchable + ' of ' + n : 'No searchable text') : '';
    $('metaEditing').hidden = !state.editingId;
    $('metaEditing').textContent = 'Editing a saved flipbook — saving updates it';
    $('drop').hidden = !!n;
    $('spreads').hidden = !n;
    $('tReverse').disabled = $('tSort').disabled = n < 2;
    $('tClear').disabled = !n;
    document.querySelector('.make-actions').hidden = !n;   // nothing to read/save yet

    var aspect = n ? state.pages[0].w / state.pages[0].h : 0.7071;
    $('spreads').style.setProperty('--page-aspect', String(aspect));
    var frag = document.createDocumentFragment();
    var spreads = spreadsOf(n);
    var addPlaced = false;
    spreads.forEach(function (sp, k) {
      var box = document.createElement('div');
      box.className = 'spread';
      [sp[0], sp[1]].forEach(function (i, side) {
        if (i != null) box.appendChild(tile(i, side ? 'right' : 'left'));
        else if (k === spreads.length - 1 && side === 1 && !addPlaced) { box.appendChild(addSlot()); addPlaced = true; }
        else box.appendChild(Object.assign(document.createElement('div'), { className: 'slot' }));
      });
      var label = document.createElement('div');
      label.className = 'spread-label label';
      var left = k === 0 ? 'Cover' : 'Spread ' + U.pad2(k);
      var pp = sp.filter(function (x) { return x != null; }).map(function (x) { return U.pad2(x + 1); }).join('—');
      label.innerHTML = '<span>' + left + '</span><span class="soft num">p. ' + pp + '</span>';
      box.appendChild(label);
      frag.appendChild(box);
    });
    if (n && !addPlaced) {
      var box = document.createElement('div');
      box.className = 'spread';
      box.appendChild(addSlot());
      frag.appendChild(box);
    }
    $('spreads').replaceChildren(frag);
  }
  function addSlot() {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'add-slot'; b.textContent = 'Add pages +';
    b.onclick = pickFiles;
    return b;
  }

  function move(from, to) {
    if (to < 0 || to >= state.pages.length || from === to) return;
    var p = state.pages.splice(from, 1)[0];
    state.pages.splice(to, 0, p);
    render(); saveDraft();
  }

  // tile buttons
  $('spreads').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-act]');
    if (!b) return;
    var i = +b.closest('.tile').dataset.index;
    if (b.dataset.act === 'left') move(i, i - 1);
    else if (b.dataset.act === 'right') move(i, i + 1);
    else if (b.dataset.act === 'del') { state.pages.splice(i, 1); render(); saveDraft(); }
  });
  // double-click a page to read from there
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

  // drop files anywhere on the board
  var board = $('board'), depth = 0;
  function isFileDrag(e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0; }
  board.addEventListener('dragenter', function (e) { if (isFileDrag(e)) { depth++; board.classList.add('is-dragging-files'); } });
  board.addEventListener('dragleave', function (e) { if (isFileDrag(e) && --depth <= 0) { depth = 0; board.classList.remove('is-dragging-files'); } });
  board.addEventListener('dragover', function (e) { if (isFileDrag(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
  board.addEventListener('drop', function (e) {
    if (!isFileDrag(e)) return;
    e.preventDefault(); depth = 0; board.classList.remove('is-dragging-files');
    addFiles(e.dataTransfer.files);
  });
  // never let a stray drop navigate away from the app
  window.addEventListener('dragover', function (e) { if (isFileDrag(e)) e.preventDefault(); });
  window.addEventListener('drop', function (e) { if (isFileDrag(e)) e.preventDefault(); });

  // ======================================================== toolbar
  function pickFiles() { $('fileInput').value = ''; $('fileInput').click(); }
  $('fileInput').onchange = function () { addFiles(this.files); };
  $('dropPick').onclick = pickFiles;
  $('tAdd').onclick = pickFiles;
  $('title').addEventListener('input', function () { state.title = this.value.trim(); saveDraft(); });
  $('tReverse').onclick = function () { state.pages.reverse(); render(); saveDraft(); };
  $('tSort').onclick = function () {
    state.pages.sort(function (a, b) { return U.naturalCompare(a.name || '', b.name || ''); });
    render(); saveDraft(); notify('Sorted by file name');
  };
  $('tClear').onclick = function () {
    if (!confirm('Remove all pages and start a new flipbook?')) return;
    state.pages = []; state.editingId = null; setTitle('');
    render(); saveDraft();
  };
  $('tBlank').onclick = function () {
    var first = state.pages[0], aspect = first ? first.w / first.h : 0.7071;
    var c = U.whiteCanvas(1200, 1200 / aspect);
    state.pages.push(U.pageFromCanvas(c, 'Blank page', null, 0.9));
    render(); saveDraft();
    notify('Blank page added at the end — drag it into place');
  };
  if (!S.ocr.supported()) {
    $('ocr').checked = false; $('ocr').disabled = true;
    $('ocr').parentNode.title = 'This browser can’t run the offline text reader';
  }

  // ======================================================== draft autosave
  var draftTimer;
  function saveDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(function () {
      store.saveDraft({ title: state.title, editingId: state.editingId, pages: state.pages })
        .catch(function (e) { console.warn('Draft not saved', e); });
    }, 600);
  }
  async function loadDraft() {
    try {
      var d = await store.loadDraft();
      if (d && d.pages) { state.pages = d.pages; state.editingId = d.editingId || null; setTitle(d.title); }
    } catch (e) { /* storage unavailable: start empty */ }
    render();
  }

  // ======================================================== read / save / download
  function currentData() { return ex.toData(state.title, state.pages); }

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
    if (saved) notify('Saved ' + saved); else $('status').hidden = true;
  }

  async function saveToLibrary() {
    if (!state.pages.length) return;
    store.persist();   // don't await: Firefox asks the user and would block the save
    var data = currentData();
    var id = state.editingId || U.uid();
    try {
      var prev = state.editingId ? await store.getMeta(id) : null;
      await store.saveBook(id, data, prev && prev.created);
      state.editingId = id;
      render(); saveDraft(); refreshLibrary();
      notify((prev ? 'Updated “' : 'Saved “') + data.title + '” in your library');
    } catch (e) {
      notify(store.available ? 'Couldn’t save — browser storage may be full' : 'This browser blocks storage here — use Download to keep your flipbook', true, 7000);
    }
  }

  $('bRead').onclick = function () { openReader(currentData()); };
  $('bSave').onclick = saveToLibrary;
  $('bDownload').onclick = function () { download(currentData()); };

  // ======================================================== library
  async function refreshLibrary() {
    var books = [];
    try { books = await store.listBooks(); }
    catch (e) {
      $('libCount').textContent = '';
      $('libNum').textContent = '';
      $('shelf').innerHTML = '<p class="empty-lib">This browser doesn’t allow storage for files opened from disk. <em>Download</em> your flipbooks to keep them.</p>';
      return;
    }
    $('libCount').textContent = books.length ? U.pad2(books.length) : '';
    $('libNum').textContent = books.length ? '(' + U.pad2(books.length) + ')' : '';
    if (!books.length) {
      $('shelf').innerHTML = '<p class="empty-lib">Nothing here yet. Make a flipbook and choose <em>Save to library</em>, or import a downloaded flipbook.</p>';
      return;
    }
    var frag = document.createDocumentFragment();
    books.forEach(function (m, k) {
      var c = document.createElement('article');
      c.className = 'book';
      var date = new Date(m.updated);
      c.innerHTML =
        '<div class="cover" role="button" tabindex="0" title="Read"><img alt=""></div>' +
        '<span class="book-no label soft num">No. ' + U.pad2(books.length - k) + '</span>' +
        '<h3></h3>' +
        '<span class="label soft num">' + U.pad2(m.count) + ' pages — ' + U.pad2(date.getDate()) + '.' + U.pad2(date.getMonth() + 1) + '.' + date.getFullYear() +
          (m.searchable ? ' — searchable' : '') + '</span>' +
        '<div class="row">' +
          '<button class="tool" data-a="read">Read</button>' +
          '<button class="tool" data-a="edit">Edit</button>' +
          '<button class="tool" data-a="dl">Download</button>' +
          '<button class="tool danger" data-a="del">Delete</button>' +
        '</div>';
      c.querySelector('img').src = m.cover;
      c.querySelector('h3').textContent = m.title;
      var cover = c.querySelector('.cover');
      cover.onclick = function () { libraryAction('read', m); };
      cover.onkeydown = function (e) { if (e.key === 'Enter') libraryAction('read', m); };
      c.querySelectorAll('[data-a]').forEach(function (b) { b.onclick = function () { libraryAction(b.dataset.a, m); }; });
      frag.appendChild(c);
    });
    $('shelf').replaceChildren(frag);
  }

  async function libraryAction(action, meta) {
    if (action === 'del') {
      if (!confirm('Delete “' + meta.title + '” from the library? Downloaded copies are not affected.')) return;
      await store.deleteBook(meta.id);
      if (state.editingId === meta.id) { state.editingId = null; render(); saveDraft(); }
      refreshLibrary(); notify('Deleted “' + meta.title + '”');
      return;
    }
    var data = await store.loadBook(meta.id);
    if (!data) { notify('That flipbook is missing from storage', true); return; }
    if (action === 'read') openReader(data);
    else if (action === 'dl') download(data);
    else if (action === 'edit') {
      if (state.pages.length && state.editingId !== meta.id && !confirm('Replace the pages on the board with “' + meta.title + '”?')) return;
      try { state.pages = await S.importers.pagesFromData(data, progress); }
      finally { $('status').hidden = true; }
      state.editingId = meta.id; setTitle(data.title);
      render(); saveDraft(); showView('make');
    }
  }

  async function importToLibrary(files) {
    var ok = 0;
    for (var i = 0; i < files.length; i++) {
      progress('Importing ' + files[i].name, i / files.length);
      try {
        var data = ex.parse(await files[i].text());
        if (!data) throw new Error('not a flipbook');
        // normalise older files so the library has thumbs + ratios
        var pages = await S.importers.pagesFromData(data);
        await store.saveBook(U.uid(), ex.toData(data.title, pages));
        ok++;
      } catch (e) {
        console.warn(e);
        notify('“' + files[i].name + '” isn’t a Flipbook Studio file', true, 5000);
      }
    }
    if (ok) { refreshLibrary(); notify('Imported ' + ok + ' flipbook' + (ok === 1 ? '' : 's')); }
  }
  $('bImport').onclick = function () { $('importInput').value = ''; $('importInput').click(); };
  $('importInput').onchange = function () { importToLibrary(Array.prototype.slice.call(this.files)); };
  $('view-library').addEventListener('dragover', function (e) { if (isFileDrag(e)) e.preventDefault(); });
  $('view-library').addEventListener('drop', function (e) {
    if (isFileDrag(e)) { e.preventDefault(); importToLibrary(Array.prototype.slice.call(e.dataTransfer.files)); }
  });

  // ======================================================== navigation
  function showView(view) {
    document.querySelectorAll('.mast-tab').forEach(function (t) { t.classList.toggle('is-active', t.dataset.view === view); });
    $('view-make').hidden = view !== 'make';
    $('view-library').hidden = view !== 'library';
    if (view === 'library') refreshLibrary();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('.mast-tab').forEach(function (t) { t.onclick = function () { showView(t.dataset.view); }; });

  // ======================================================== boot
  loadDraft();
  refreshLibrary();

  // Hooks for the automated end-to-end tests (tests/e2e.mjs).
  S.app = { state: state, addFiles: addFiles, currentData: currentData, openReader: openReader, closeReader: closeReader, refreshLibrary: refreshLibrary };
})(window.Studio);
