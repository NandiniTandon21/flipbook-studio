/* ==========================================================================
   exporter.js — the flipbook file format.

   A flipbook is a single self-contained .html file:
     <style>  fonts + viewer styles
     <script type="application/json" id="flipbook-data">  the book (below)
     <script> viewer.js + FlipBook.mount(...)
   It opens offline in any browser and can be dropped back into the Studio.

   Book data (format "flipbook-studio", version 2)
     title    string
     aspect   width/height of the book (taken from the first page)
     pages    [JPEG data URL]           one per page, in reading order
     thumbs   [small JPEG data URL]     used by the Studio only
     ratios   [width/height per page]
     text     [[ [str,x,y,w,h,angle], ... ] | null]   selectable/searchable text
   ========================================================================== */
(function (S) {
  'use strict';
  var U = S.util;

  var EXPORT_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'";

  /** Build book data from the Studio's page records. */
  function toData(title, pages) {
    var first = pages[0];
    return {
      format: 'flipbook-studio',
      version: 2,
      title: title || 'Untitled',
      aspect: first ? first.w / first.h : 0.7071,
      pages: pages.map(function (p) { return p.src; }),
      thumbs: pages.map(function (p) { return p.thumb; }),
      ratios: pages.map(function (p) { return U.round4(p.w / p.h); }),
      text: pages.map(function (p) { return p.text || null; }),
      appVersion: (window.FS_BUILD && window.FS_BUILD.version) || '',   // which app made it (since 2.6.0)
      created: new Date().toISOString()
    };
  }

  /**
   * Bring book data from ANY version into the current shape, without losing anything.
   *   v1 (1.x):   {title, aspect, pages, thumbs}                 → text/ratios filled with null
   *   v2 (2.x):   + ratios, text, (appVersion since 2.6.0)
   *   future:     unknown extra fields are kept untouched, so re-saving doesn't drop them
   * Returns null if it isn't a flipbook at all.
   */
  function normalize(data) {
    if (!data || !Array.isArray(data.pages) || !data.pages.length) return null;
    var n = data.pages.length;
    function list(a) { return Array.isArray(a) && a.length === n ? a : data.pages.map(function () { return null; }); }
    data.title = typeof data.title === 'string' && data.title.trim() ? data.title : 'Untitled';
    data.aspect = data.aspect > 0 ? data.aspect : 0.7071;
    data.text = list(data.text);
    data.ratios = list(data.ratios);
    data.thumbs = list(data.thumbs);
    data.appVersion = data.appVersion || '';
    return data;
  }

  /** Render book data into a standalone flipbook HTML document. */
  function buildHtml(data) {
    function text(id) { return document.getElementById(id).textContent; }
    var json = JSON.stringify(data).replace(/</g, '\\u003c');   // can't close the <script> early
    var S_ = 'script';
    return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">\n' +
      '<meta http-equiv="Content-Security-Policy" content="' + EXPORT_CSP + '">\n' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
      '<meta name="generator" content="Flipbook Studio ' + U.escapeHtml(data.appVersion || '') + '">\n' +
      '<title>' + U.escapeHtml(data.title) + '</title>\n' +
      '<style>html,body{margin:0;height:100%;background:#BDD5E2}#flipbook{position:fixed;inset:0}</style>\n' +
      '<style>' + text('fonts-css') + '</style>\n' +
      '<style>' + text('viewer-css') + '</style>\n' +
      '</head><body><div id="flipbook"></div>\n' +
      '<' + S_ + ' type="application/json" id="flipbook-data">' + json + '</' + S_ + '>\n' +
      '<' + S_ + '>' + text('viewer-src') + '</' + S_ + '>\n' +
      '<' + S_ + '>FlipBook.mount(document.getElementById("flipbook"),JSON.parse(document.getElementById("flipbook-data").textContent));</' + S_ + '>\n' +
      '</body></html>\n';
  }

  /** Read book data back out of an exported flipbook. Returns null if it isn't one. */
  function parse(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var node = doc.getElementById('flipbook-data');
    if (!node) return null;
    var data;
    try { data = JSON.parse(node.textContent); } catch (e) { return null; }
    return normalize(data);
  }

  /** Save to disk as a normal browser download (lands in the Downloads folder, or wherever
      the browser is set to ask). We deliberately don't use the "Save as…" file picker:
      Chrome rejects it for pages opened from file:// with an error that looks like a user
      cancel, so downloads silently did nothing. */
  async function saveFile(name, html) {
    var blob = new Blob([html], { type: 'text/html' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    return name;
  }

  function fileName(title) { return U.cleanName(title) + ' — flipbook.html'; }

  S.exporter = { toData: toData, normalize: normalize, buildHtml: buildHtml, parse: parse, saveFile: saveFile, fileName: fileName };
})(window.Studio);
