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
      created: new Date().toISOString()
    };
  }

  /** Render book data into a standalone flipbook HTML document. */
  function buildHtml(data) {
    function text(id) { return document.getElementById(id).textContent; }
    var json = JSON.stringify(data).replace(/</g, '\\u003c');   // can't close the <script> early
    var S_ = 'script';
    return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">\n' +
      '<meta http-equiv="Content-Security-Policy" content="' + EXPORT_CSP + '">\n' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
      '<meta name="generator" content="Flipbook Studio">\n' +
      '<title>' + U.escapeHtml(data.title) + '</title>\n' +
      '<style>html,body{margin:0;height:100%;background:#2a211b}#flipbook{position:fixed;inset:0}</style>\n' +
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
    if (!data || !Array.isArray(data.pages)) return null;
    data.title = data.title || 'Untitled';
    data.text = data.text || data.pages.map(function () { return null; });   // v1 files had no text
    return data;
  }

  /** Save to disk: native "Save as…" dialog where available, plain download otherwise. */
  async function saveFile(name, html) {
    var blob = new Blob([html], { type: 'text/html' });
    if (window.showSaveFilePicker) {
      try {
        var handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'Flipbook', accept: { 'text/html': ['.html'] } }] });
        var w = await handle.createWritable();
        await w.write(blob);
        await w.close();
        return handle.name;
      } catch (e) {
        if (e && e.name === 'AbortError') return null;     // user cancelled
        console.warn('Save dialog unavailable, downloading instead', e);
      }
    }
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

  S.exporter = { toData: toData, buildHtml: buildHtml, parse: parse, saveFile: saveFile, fileName: fileName };
})(window.Studio);
