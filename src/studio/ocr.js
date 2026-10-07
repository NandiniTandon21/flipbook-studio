/* ==========================================================================
   ocr.js — offline text recognition for images and scanned PDF pages.

   Uses Tesseract.js (WebAssembly). Everything it needs is embedded in the page:
     #src-ocr-core    Tesseract core with the .wasm inlined
     #src-ocr-worker  Tesseract.js worker script
     #src-ocr-eng     English language model (gzip, base64)
   We stitch these into ONE worker script (blob URL), so the worker never has to
   fetch or import anything — which is what keeps it working from file:// and
   under the page's no-network policy.

   Output format (same as PDF text): [[word, x, y, w, h, angle], ...]
   with x/y/w/h as fractions of the page size.
   ========================================================================== */
(function (S) {
  'use strict';

  var MAX_SIDE = 2200;          // OCR works on a copy no larger than this (speed)
  var MIN_CONFIDENCE = 35;      // drop words Tesseract is unsure about

  // Tiny wasm module using a SIMD instruction: validates only where SIMD wasm is supported.
  var SIMD_PROBE = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);

  var workerPromise = null;
  var listener = null;

  function supported() {
    try {
      return typeof Tesseract !== 'undefined' && typeof WebAssembly === 'object' && WebAssembly.validate(SIMD_PROBE);
    } catch (e) { return false; }
  }

  /* Runs first inside the worker: decodes the embedded language model and serves it
     to Tesseract's loader through a local-only fetch(). Every other fetch is refused. */
  function workerPrelude() {
    var bin = atob(self.__FB_ENG);
    self.__FB_ENG = null;
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    self.fetch = function (url) {
      if (String(url).indexOf('traineddata') !== -1) return Promise.resolve(new Response(bytes.slice(0)));
      return Promise.reject(new Error('Network disabled: Flipbook Studio runs offline'));
    };
  }

  function workerUrl() {
    function src(id) { return document.getElementById(id).textContent; }
    var code =
      'self.__FB_ENG=' + JSON.stringify(src('src-ocr-eng').replace(/\s+/g, '')) + ';\n' +
      '(' + workerPrelude.toString() + ')();\n' +
      src('src-ocr-core') + '\n;\n' +
      src('src-ocr-worker');
    return URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  }

  function getWorker() {
    if (!workerPromise) {
      workerPromise = Tesseract.createWorker('eng', 1, {
        workerPath: workerUrl(),
        workerBlobURL: false,
        corePath: 'embedded://tesseract-core.js',   // never loaded: the core is already in the worker
        langPath: 'https://embedded.invalid/lang',   // served by workerPrelude, never hits the network
        cacheMethod: 'none',
        gzip: true,
        logger: function (m) { if (listener) listener(m); }
      }).catch(function (e) { workerPromise = null; throw e; });
    }
    return workerPromise;
  }

  /** Recognise words on a canvas. `onProgress(0..1)` is optional. */
  async function recognize(canvas, onProgress) {
    var scale = Math.min(1, MAX_SIDE / Math.max(canvas.width, canvas.height));
    var src = canvas;
    if (scale < 1) {
      src = S.util.whiteCanvas(canvas.width * scale, canvas.height * scale);
      src.getContext('2d').drawImage(canvas, 0, 0, src.width, src.height);
    }
    var worker = await getWorker();
    listener = function (m) { if (onProgress && m.status === 'recognizing text') onProgress(m.progress || 0); };
    try {
      var res = await worker.recognize(src);
      var W = src.width, H = src.height, r4 = S.util.round4;
      return (res.data.words || [])
        .filter(function (w) { return w.text && w.text.trim() && w.confidence >= MIN_CONFIDENCE; })
        .map(function (w) {
          var b = w.bbox;
          return [w.text.trim(), r4(b.x0 / W), r4(b.y0 / H), r4((b.x1 - b.x0) / W), r4((b.y1 - b.y0) / H), 0];
        });
    } finally { listener = null; }
  }

  /** Free the worker's memory (called after each import batch). */
  async function release() {
    if (!workerPromise) return;
    var p = workerPromise;
    workerPromise = null;
    try { (await p).terminate(); } catch (e) { /* already gone */ }
  }

  S.ocr = { supported: supported, recognize: recognize, release: release };
})(window.Studio);
