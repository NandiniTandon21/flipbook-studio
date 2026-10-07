/* ==========================================================================
   util.js — small shared helpers. Creates the global `Studio` namespace
   that every other studio module attaches to.
   ========================================================================== */
window.Studio = window.Studio || {};

(function (S) {
  'use strict';

  var THUMB_WIDTH = 300;

  /** Short unique id for pages and books. */
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  /** Load an image URL (data:, blob:) into an <img>. */
  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var im = new Image();
      im.onload = function () { resolve(im); };
      im.onerror = function () { reject(new Error('Could not decode image')); };
      im.src = src;
    });
  }

  /** New canvas filled white (pages never have transparent backgrounds). */
  function whiteCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    var x = c.getContext('2d');
    x.fillStyle = '#fff';
    x.fillRect(0, 0, c.width, c.height);
    x.imageSmoothingQuality = 'high';
    return c;
  }

  /** Small JPEG used in the Studio grid and library. */
  function thumbFrom(source, w, h) {
    var c = whiteCanvas(THUMB_WIDTH, THUMB_WIDTH * h / w);
    c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.78);
  }

  /** Turn a finished canvas into the page record used everywhere in the Studio. */
  function pageFromCanvas(canvas, name, text, quality) {
    return {
      id: uid(),
      src: canvas.toDataURL('image/jpeg', quality || 0.88),
      thumb: thumbFrom(canvas, canvas.width, canvas.height),
      w: canvas.width,
      h: canvas.height,
      name: name,
      text: text && text.length ? text : null
    };
  }

  function round4(v) { return Math.round(v * 10000) / 10000; }
  function pad2(n) { return n < 10 ? '0' + n : String(n); }
  function naturalCompare(a, b) { return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }); }
  function nextFrame() { return new Promise(function (r) { setTimeout(r, 0); }); }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  /** Safe file name (no path separators / control chars). */
  function cleanName(s) {
    return (s || 'flipbook').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100) || 'flipbook';
  }

  S.util = {
    uid: uid, loadImage: loadImage, whiteCanvas: whiteCanvas, thumbFrom: thumbFrom,
    pageFromCanvas: pageFromCanvas, round4: round4, pad2: pad2, naturalCompare: naturalCompare,
    nextFrame: nextFrame, escapeHtml: escapeHtml, cleanName: cleanName
  };
})(window.Studio);
