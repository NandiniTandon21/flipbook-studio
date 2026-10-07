/* ==========================================================================
   landing.js — fills in download links/version and builds the live demo.

   The demo pages are drawn on <canvas> with the page's own fonts (so they
   match the site), turned into images, and handed to the real FlipBook viewer.
   ========================================================================== */
(function () {
  'use strict';
  var SITE = window.SITE || {};

  // ---- links + version
  document.querySelectorAll('[data-download]').forEach(function (a) { a.href = SITE.download; a.setAttribute('download', ''); });
  document.querySelectorAll('[data-version]').forEach(function (s) { s.textContent = 'v' + SITE.version; });
  document.querySelectorAll('[data-size]').forEach(function (s) { s.textContent = SITE.size; });

  // ---- demo pages
  var W = 1200, H = 1600;
  var C = { paper: '#f2eee6', ink: '#1a1714', soft: '#6e675c', brown: '#2a211b', cream: '#efe7d8', red: '#c2371f', sage: '#c9ccc3', slate: '#4f6a85' };
  var SERIF = '"FS Advercase", "EB Garamond", Garamond, serif';
  var MONO = '"IBM Plex Mono", Menlo, monospace';

  function wrap(ctx, text, x, y, maxW, lineH) {
    var words = text.split(' '), line = '';
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, y); line = words[i]; y += lineH; }
      else line = test;
    }
    if (line) ctx.fillText(line, x, y);
    return y + lineH;
  }
  function mono(ctx, text, x, y, color, align) {
    ctx.font = '500 30px ' + MONO; ctx.fillStyle = color; ctx.textAlign = align || 'left';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';                // light tracking where supported
    ctx.fillText(text, x, y);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.textAlign = 'left';
  }
  function page(bg, draw) {
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d');
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    x.textBaseline = 'alphabetic';
    draw(x);
    return c.toDataURL('image/jpeg', 0.9);
  }
  function rule(ctx, y, color) { ctx.fillStyle = color; ctx.fillRect(90, y, W - 180, 3); }

  function stepPage(bg, fg, soft, no, title, body, foot) {
    return page(bg, function (x) {
      mono(x, foot, 90, 130, soft);
      x.fillStyle = fg; x.font = '400 520px ' + SERIF; x.fillText(no, 70, 700);
      rule(x, 790, fg);
      x.font = '400 120px ' + SERIF; var y = wrap(x, title, 90, 940, W - 180, 118);
      x.fillStyle = soft; x.font = '400 50px ' + SERIF; wrap(x, body, 90, y + 30, W - 220, 70);
    });
  }

  function buildPages() {
    return [
      // 1 — front cover
      page(C.brown, function (x) {
        mono(x, 'ISSUE Nº 01', 90, 130, C.cream);
        mono(x, 'FREE · OFFLINE · NO SIGN-UP', W - 90, 130, C.cream, 'right');
        rule(x, 170, 'rgba(239,231,216,.35)');
        x.fillStyle = C.cream;
        x.font = '400 330px ' + SERIF; x.fillText('Flipbook', 70, 760);
        x.font = 'italic 400 330px ' + SERIF; x.fillText('Studio', 70, 1060);
        x.font = '400 64px ' + SERIF; wrap(x, 'PDFs & images, turned into magazines you can keep.', 90, 1260, W - 260, 78);
        mono(x, 'CLICK OR SWIPE TO TURN →', 90, 1510, 'rgba(239,231,216,.65)');
      }),
      // 2 — why
      page(C.paper, function (x) {
        mono(x, 'WHY IT EXISTS', 90, 130, C.soft);
        rule(x, 170, C.ink);
        x.fillStyle = C.ink; x.font = '400 112px ' + SERIF;
        var y = wrap(x, 'No sign-up. No paywall. No watermark.', 90, 380, W - 180, 112);
        x.fillStyle = C.red; x.font = 'italic 400 112px ' + SERIF;
        y = wrap(x, 'Just your flipbook.', 90, y + 20, W - 180, 112);
        x.fillStyle = C.soft; x.font = '400 50px ' + SERIF;
        wrap(x, 'Every “free” flipbook maker wanted an account, a payment, or wouldn’t let me download the result. So I made one that doesn’t.', 90, y + 120, W - 220, 70);
      }),
      // 3–5 — how
      stepPage(C.red, C.cream, 'rgba(239,231,216,.8)', '01', 'Drop in PDFs & images.', 'Every PDF page becomes a magazine page. iPhone HEIC photos work too.', 'HOW IT WORKS'),
      stepPage(C.sage, C.slate, C.slate, '02', 'Arrange the spreads.', 'Drag pages into order. The cover sits alone, then pages open in pairs, like a real magazine.', 'HOW IT WORKS'),
      stepPage(C.paper, C.ink, C.soft, '03', 'Read it. Keep it.', 'Download the flipbook as one file that opens offline in any browser, forever.', 'HOW IT WORKS'),
      // 6 — back cover
      page(C.ink, function (x) {
        x.fillStyle = C.cream; x.font = '400 150px ' + SERIF;
        var y = wrap(x, 'Nothing you add is ever uploaded.', 90, 520, W - 180, 150);
        x.fillStyle = 'rgba(239,231,216,.65)'; x.font = '400 52px ' + SERIF;
        wrap(x, 'It runs on your computer. No account, ever.', 90, y + 60, W - 220, 72);
        mono(x, 'FLIPBOOK STUDIO — MIT LICENCE', 90, 1510, 'rgba(239,231,216,.65)');
      })
    ];
  }

  var stage = document.getElementById('demo');
  if (!stage || !window.FlipBook) return;
  // make sure the faces used on the canvas are loaded before drawing
  var fontsReady = document.fonts
    ? Promise.all(['400 40px "EB Garamond"', 'italic 400 40px "EB Garamond"', '500 30px "IBM Plex Mono"', '400 40px "FS Advercase"']
        .map(function (f) { return document.fonts.load(f).catch(function () {}); }))
    : Promise.resolve();
  fontsReady.then(function () {
    window.demoBook = FlipBook.mount(stage, { title: 'Flipbook Studio — Issue Nº 01', aspect: W / H, pages: buildPages() }, { embedded: true });
  });
})();
