/* ==========================================================================
   importers.js — turn dropped files into Studio pages.

   Every importer returns an array of page records (see util.pageFromCanvas):
     {id, src, thumb, w, h, name, text}

   PDF    rendered page-by-page with pdf.js; its real text layer is kept
          (positions included) so the flipbook stays selectable + searchable.
          Pages with no text layer (scans) fall back to OCR.
   Image  JPG/PNG/WebP/GIF/AVIF/BMP decoded by the browser; HEIC/HEIF decoded
          natively where supported (Safari) or by the bundled heic2any decoder.
          Text is recovered with OCR when enabled.
   HTML   a flipbook previously exported by Flipbook Studio (pages + text reused).
   ========================================================================== */
(function (S) {
  'use strict';
  var U = S.util;

  // ---- pdf.js setup: its worker is embedded as text and started from a blob URL
  var pdfReady = false;
  try {
    var workerUrl = URL.createObjectURL(new Blob([document.getElementById('src-pdf-worker').textContent], { type: 'text/javascript' }));
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
    // Handing pdf.js a ready Worker avoids its importScripts() wrapper, which fails from file://.
    try { pdfjsLib.GlobalWorkerOptions.workerPort = new Worker(workerUrl); } catch (e) { /* main-thread fallback */ }
    pdfReady = true;
  } catch (e) { console.error('PDF engine failed to start', e); }

  /** What kind of file is this? → 'pdf' | 'heic' | 'image' | 'html' | null */
  function kindOf(file) {
    var n = (file.name || '').toLowerCase(), t = (file.type || '').toLowerCase();
    if (t === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
    if (/hei[cf]/.test(t) || /\.hei[cf]$/.test(n)) return 'heic';
    if (n.endsWith('.html') || n.endsWith('.htm') || t === 'text/html') return 'html';
    if (t.indexOf('image/') === 0 || /\.(jpe?g|png|gif|webp|bmp|avif|svg)$/.test(n)) return 'image';
    return null;
  }

  // ---------------------------------------------------------------- PDF
  /** Convert pdf.js text items into normalised [str, x, y, w, h, angle] boxes. */
  function pdfTextItems(content, viewport) {
    var W = viewport.width, H = viewport.height, out = [], r4 = U.round4;
    content.items.forEach(function (it) {
      if (!it.str || !it.str.trim()) return;
      var tx = pdfjsLib.Util.transform(viewport.transform, it.transform);
      var fontHeight = Math.hypot(tx[2], tx[3]);
      if (!fontHeight) return;
      var style = content.styles[it.fontName] || {};
      var ascent = style.ascent ? style.ascent : style.descent ? 1 + style.descent : 0.8;
      var angle = Math.atan2(tx[1], tx[0]);
      if (style.vertical) angle += Math.PI / 2;
      var left = tx[4], top = tx[5] - fontHeight * ascent;
      if (angle) { left = tx[4] + fontHeight * ascent * Math.sin(angle); top = tx[5] - fontHeight * ascent * Math.cos(angle); }
      var width = (style.vertical ? it.height : it.width) * viewport.scale;
      out.push([it.str, r4(left / W), r4(top / H), r4(width / W), r4(fontHeight / H), angle ? r4(angle) : 0]);
    });
    return out;
  }

  async function fromPdf(file, opts, report) {
    if (!pdfReady) throw new Error('PDF engine unavailable');
    var doc = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), useSystemFonts: true, isEvalSupported: false }).promise;
    var pages = [];
    try {
      for (var i = 1; i <= doc.numPages; i++) {
        report('Rendering ' + file.name + ' — page ' + i + ' of ' + doc.numPages, (i - 1) / doc.numPages);
        var page = await doc.getPage(i);
        var base = page.getViewport({ scale: 1 });
        var scale = Math.max(0.5, Math.min(6, opts.quality / Math.max(base.width, base.height)));
        var vp = page.getViewport({ scale: scale });
        var canvas = U.whiteCanvas(Math.floor(vp.width), Math.floor(vp.height));
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;

        var text = pdfTextItems(await page.getTextContent(), base);
        var chars = text.reduce(function (n, t) { return n + t[0].length; }, 0);
        if (chars < 15 && opts.ocr && S.ocr.supported()) {             // scanned page
          report('Reading text on ' + file.name + ' — page ' + i + ' (OCR)', (i - 1) / doc.numPages);
          try { text = await S.ocr.recognize(canvas); } catch (e) { console.warn('OCR failed', e); }
        }
        pages.push(U.pageFromCanvas(canvas, file.name + ' · p' + String(i).padStart(4, '0'), text, 0.86));
        page.cleanup();
        canvas.width = canvas.height = 0;
      }
    } finally { doc.destroy(); }
    return pages;
  }

  // ---------------------------------------------------------------- images
  async function decodeHeic(file) {
    // Safari (and anything else with native HEIC support) decodes it directly.
    var url = URL.createObjectURL(file);
    try { return await U.loadImage(url); } catch (e) { /* fall through */ } finally { URL.revokeObjectURL(url); }
    if (typeof heic2any !== 'function') throw new Error('HEIC decoder unavailable');
    var out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.95 });
    var blob = Array.isArray(out) ? out[0] : out;                   // multi-image HEIC → first frame
    var u2 = URL.createObjectURL(blob);
    try { return await U.loadImage(u2); } finally { URL.revokeObjectURL(u2); }
  }

  async function fromImage(file, opts, report, isHeic) {
    report((isHeic ? 'Converting ' : 'Reading ') + file.name, 0);
    var img;
    if (isHeic) img = await decodeHeic(file);
    else {
      var url = URL.createObjectURL(file);
      try { img = await U.loadImage(url); } finally { URL.revokeObjectURL(url); }
    }
    var w = img.naturalWidth, h = img.naturalHeight;
    var s = Math.min(1, Math.max(opts.quality, 1600) / Math.max(w, h));
    var canvas = U.whiteCanvas(w * s, h * s);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    var text = null;
    if (opts.ocr && S.ocr.supported()) {
      report('Reading text in ' + file.name + ' (OCR)', 0.3);
      try { text = await S.ocr.recognize(canvas, function (p) { report('Reading text in ' + file.name + ' (OCR)', 0.3 + p * 0.7); }); }
      catch (e) { console.warn('OCR failed', e); }
    }
    return [U.pageFromCanvas(canvas, file.name, text, 0.9)];
  }

  // ---------------------------------------------------------------- flipbook html
  async function fromFlipbook(file, opts, report) {
    var data = S.exporter.parse(await file.text());
    if (!data) throw new Error('Not a Flipbook Studio file');
    return pagesFromData(data, report);
  }

  /** Library/export data → page records (thumbs regenerated only if missing). */
  async function pagesFromData(data, report) {
    var pages = [];
    for (var i = 0; i < data.pages.length; i++) {
      if (report) report('Loading ' + data.title + ' — page ' + (i + 1) + ' of ' + data.pages.length, i / data.pages.length);
      var thumb = data.thumbs && data.thumbs[i];
      var ratio = data.ratios && data.ratios[i];
      var w = ratio ? Math.round(1000 * ratio) : 0, h = ratio ? 1000 : 0;
      if (!thumb || !ratio) {
        var im = await U.loadImage(data.pages[i]);
        w = im.naturalWidth; h = im.naturalHeight;
        thumb = thumb || U.thumbFrom(im, w, h);
      }
      pages.push({
        id: U.uid(), src: data.pages[i], thumb: thumb, w: w, h: h,
        name: data.title + ' · p' + String(i + 1).padStart(4, '0'),
        text: (data.text && data.text[i]) || null
      });
    }
    return pages;
  }

  /** Import one file. `report(text, fraction)` drives the status line. */
  function importFile(file, opts, report) {
    var kind = kindOf(file);
    if (kind === 'pdf') return fromPdf(file, opts, report);
    if (kind === 'image') return fromImage(file, opts, report, false);
    if (kind === 'heic') return fromImage(file, opts, report, true);
    if (kind === 'html') return fromFlipbook(file, opts, report);
    return Promise.reject(new Error('Unsupported file type'));
  }

  S.importers = { kindOf: kindOf, importFile: importFile, pagesFromData: pagesFromData };
})(window.Studio);
