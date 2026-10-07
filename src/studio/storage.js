/* ==========================================================================
   storage.js — the Library, kept in the browser's IndexedDB.

   Stores
     meta   {id, title, count, cover, searchable, created, updated}  (cheap list)
     books  {id, data}                                                (full flipbook)
     kv     {k:'draft', ...}                                          (autosaved board)

   If the browser refuses storage (some browsers do for files opened from disk),
   `available` becomes false and the UI explains that downloads are the way to keep work.
   ========================================================================== */
(function (S) {
  'use strict';

  var DB_NAME = 'flipbook-studio';
  var db = null;
  var opening = null;

  function open() {
    if (db) return Promise.resolve(db);
    if (opening) return opening;
    opening = new Promise(function (resolve, reject) {
      var rq;
      try { rq = indexedDB.open(DB_NAME, 1); } catch (e) { reject(e); return; }
      rq.onupgradeneeded = function () {
        var d = rq.result;
        d.createObjectStore('books', { keyPath: 'id' });
        d.createObjectStore('meta', { keyPath: 'id' });
        d.createObjectStore('kv', { keyPath: 'k' });
      };
      rq.onsuccess = function () { db = rq.result; resolve(db); };
      rq.onerror = function () { reject(rq.error || new Error('Storage unavailable')); };
    }).catch(function (e) { opening = null; S.storage.available = false; throw e; });
    return opening;
  }

  /** Run `fn(tx, setResult)` inside one transaction; resolves when it commits. */
  function tx(stores, mode, fn) {
    return open().then(function (d) {
      return new Promise(function (resolve, reject) {
        var t = d.transaction(stores, mode), out;
        t.oncomplete = function () { resolve(out); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error || new Error('Storage aborted')); };
        fn(t, function (v) { out = v; });
      });
    });
  }
  function get(store, key) {
    return tx([store], 'readonly', function (t, set) {
      var r = t.objectStore(store).get(key);
      r.onsuccess = function () { set(r.result); };
    });
  }
  function all(store) {
    return tx([store], 'readonly', function (t, set) {
      var r = t.objectStore(store).getAll();
      r.onsuccess = function () { set(r.result || []); };
    });
  }

  /** Save (create or update) a flipbook. Returns its id. */
  function saveBook(id, data, created) {
    var now = Date.now();
    var meta = {
      id: id, title: data.title, count: data.pages.length, cover: data.thumbs[0],
      searchable: (data.text || []).filter(function (t) { return t && t.length; }).length,
      created: created || now, updated: now
    };
    return tx(['books', 'meta'], 'readwrite', function (t) {
      t.objectStore('books').put({ id: id, data: data });
      t.objectStore('meta').put(meta);
    }).then(function () { return id; });
  }
  function deleteBook(id) {
    return tx(['books', 'meta'], 'readwrite', function (t) {
      t.objectStore('books').delete(id);
      t.objectStore('meta').delete(id);
    });
  }
  function loadBook(id) { return get('books', id).then(function (r) { return r && r.data; }); }
  function listBooks() {
    return all('meta').then(function (m) { return m.sort(function (a, b) { return b.updated - a.updated; }); });
  }
  function getMeta(id) { return get('meta', id); }

  function saveDraft(draft) {
    return tx(['kv'], 'readwrite', function (t) { t.objectStore('kv').put(Object.assign({ k: 'draft' }, draft)); });
  }
  function loadDraft() { return get('kv', 'draft'); }

  /** Ask the browser not to evict our data under storage pressure. */
  function persist() {
    if (navigator.storage && navigator.storage.persist) return navigator.storage.persist().catch(function () {});
    return Promise.resolve();
  }

  S.storage = {
    available: true,
    open: open, saveBook: saveBook, deleteBook: deleteBook, loadBook: loadBook, listBooks: listBooks,
    getMeta: getMeta, saveDraft: saveDraft, loadDraft: loadDraft, persist: persist
  };
})(window.Studio);
