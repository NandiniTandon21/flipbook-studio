/* Flipbook viewer — shared by Flipbook Studio and every exported magazine.
   FlipBook.mount(container, {title, aspect, pages:[imageSrc...]}, {onClose}) */
(function () {
  'use strict';
  var ICON = {
    first: '<svg viewBox="0 0 24 24"><path d="M17 6l-6 6 6 6M7 6v12"/></svg>',
    prev: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
    last: '<svg viewBox="0 0 24 24"><path d="M7 6l6 6-6 6M17 6v12"/></svg>',
    full: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function mount(container, data, opts) {
    opts = opts || {};
    var pages = (data && data.pages) || [];
    var n = pages.length;
    var aspect = (data && data.aspect) || 0.7071;
    var L = Math.ceil(n / 2);                 // leaves (sheets): front = page 2i, back = page 2i+1
    var maxF = (n % 2 === 1) ? L - 1 : L;     // odd count ends on an open spread
    var f = 0;                                // number of leaves turned to the left
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var DUR = reduce ? 180 : 900;
    var topZ = 2 * L + 10;

    var root = el('div', 'fb-root');
    root.tabIndex = 0;
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', (data && data.title) || 'Flipbook');
    var stage = el('div', 'fb-stage');
    var book = el('div', 'fb-book');
    book.style.setProperty('--dur', DUR + 'ms');
    stage.appendChild(book);
    root.appendChild(stage);

    var leaves = [];
    for (var i = 0; i < L; i++) {
      var leaf = el('div', 'fb-leaf');
      var front = el('div', 'fb-face fb-front');
      var back = el('div', 'fb-face fb-back');
      var fi = document.createElement('img');
      fi.alt = 'Page ' + (2 * i + 1); fi.draggable = false; fi.decoding = 'async';
      front.appendChild(fi);
      front.appendChild(el('div', 'fb-shade'));
      var bi = null;
      if (2 * i + 1 < n) {
        bi = document.createElement('img');
        bi.alt = 'Page ' + (2 * i + 2); bi.draggable = false; bi.decoding = 'async';
        back.appendChild(bi);
      }
      back.appendChild(el('div', 'fb-shade'));
      leaf.appendChild(front);
      leaf.appendChild(back);
      leaf.style.zIndex = String(2 * L - i);
      book.appendChild(leaf);
      leaves.push({ el: leaf, imgs: [fi, bi], token: 0 });
    }
    if (!n) { book.appendChild(el('div', 'fb-empty', 'No pages yet')); }

    // ---- toolbar
    function btn(icon, label) {
      var b = el('button', 'fb-btn', ICON[icon]);
      b.type = 'button'; b.title = label; b.setAttribute('aria-label', label);
      return b;
    }
    var bar = el('div', 'fb-bar');
    var title = el('div', 'fb-title'); title.textContent = (data && data.title) || '';
    var controls = el('div', 'fb-controls');
    var bFirst = btn('first', 'First page'), bPrev = btn('prev', 'Previous page');
    var bNext = btn('next', 'Next page'), bLast = btn('last', 'Last page');
    var counter = el('span', 'fb-count');
    counter.setAttribute('aria-live', 'polite');
    var range = document.createElement('input');
    range.type = 'range'; range.min = '0'; range.max = String(Math.max(0, maxF)); range.step = '1';
    range.className = 'fb-range'; range.setAttribute('aria-label', 'Jump to page');
    controls.appendChild(bFirst); controls.appendChild(bPrev); controls.appendChild(counter);
    controls.appendChild(bNext); controls.appendChild(bLast); controls.appendChild(range);
    var actions = el('div', 'fb-actions');
    var bFull = btn('full', 'Full screen');
    actions.appendChild(bFull);
    var bClose = null;
    if (opts.onClose) { bClose = btn('close', 'Close'); actions.appendChild(bClose); }
    bar.appendChild(title); bar.appendChild(controls); bar.appendChild(actions);
    root.appendChild(bar);
    container.appendChild(root);

    // ---- images (lazy around the current spread)
    function ensure(a, b) {
      for (var p = Math.max(0, a); p <= Math.min(n - 1, b); p++) {
        var img = leaves[p >> 1].imgs[p & 1];
        if (img && !img.getAttribute('src')) img.src = pages[p];
      }
    }

    // ---- sizing
    function layout() {
      var r = stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var pad = Math.max(14, Math.min(r.width, r.height) * 0.05);
      var aw = r.width - pad * 2, ah = r.height - pad * 2;
      var w = Math.max(40, Math.min(aw / 2, ah * aspect));
      book.style.setProperty('--w', w + 'px');
      book.style.setProperty('--h', (w / aspect) + 'px');
    }
    function shift() {
      var x = 0;
      if (n && f === 0) x = -0.5;                       // closed: front cover centred
      else if (n && f === L && n % 2 === 0) x = 0.5;   // closed: back cover centred
      book.style.transform = 'translateX(calc(var(--w) * ' + x + '))';
    }

    // ---- turning
    function turn(i, toFlipped, delay) {
      var lf = leaves[i];
      var tok = ++lf.token;
      setTimeout(function () {
        if (lf.token !== tok) return;
        lf.el.style.zIndex = String(++topZ);
        lf.el.classList.remove('is-turning');
        void lf.el.offsetWidth;
        lf.el.classList.add('is-turning');
        lf.el.classList.toggle('is-flipped', toFlipped);
        setTimeout(function () {
          if (lf.token !== tok) return;
          lf.el.classList.remove('is-turning');
          lf.el.style.zIndex = String(toFlipped ? i + 1 : 2 * L - i);
        }, DUR + 60);
      }, delay);
    }
    function goTo(t) {
      t = clamp(t | 0, 0, Math.max(0, maxF));
      if (t === f || !n) { update(); return; }
      var count = Math.abs(t - f);
      var step = count > 1 ? Math.min(110, 700 / count) : 0;
      ensure(Math.min(f, t) * 2 - 2, Math.max(f, t) * 2 + 3);
      for (var k = 0; k < count; k++) {
        if (t > f) turn(f + k, true, k * step);
        else turn(f - 1 - k, false, k * step);
      }
      f = t;
      shift();
      update();
    }
    function next() { goTo(f + 1); }
    function prev() { goTo(f - 1); }

    function update() {
      var txt;
      if (!n) txt = '0 / 0';
      else if (f === 0) txt = '1 / ' + n;
      else if (f === L && n % 2 === 0) txt = n + ' / ' + n;
      else txt = (2 * f) + '–' + (2 * f + 1) + ' / ' + n;
      counter.textContent = txt;
      range.value = String(f);
      bFirst.disabled = bPrev.disabled = f <= 0;
      bNext.disabled = bLast.disabled = f >= maxF;
      ensure(2 * f - 3, 2 * f + 4);
    }

    // ---- input
    bFirst.onclick = function () { goTo(0); };
    bPrev.onclick = prev;
    bNext.onclick = next;
    bLast.onclick = function () { goTo(maxF); };
    range.oninput = function () { goTo(+range.value); };
    bFull.onclick = function () {
      var d = document;
      if (d.fullscreenElement || d.webkitFullscreenElement) {
        (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      } else {
        var rq = root.requestFullscreen || root.webkitRequestFullscreen;
        if (rq) rq.call(root);
      }
    };
    if (bClose) bClose.onclick = function () { opts.onClose(); };

    var down = null;
    stage.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      down = { x: e.clientX, y: e.clientY };
    });
    stage.addEventListener('pointerup', function (e) {
      if (!down) return;
      var dx = e.clientX - down.x, dy = e.clientY - down.y;
      down = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { if (dx < 0) next(); else prev(); return; }
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        var r = book.getBoundingClientRect();
        if (e.clientX >= r.left + r.width / 2) next(); else prev();
      }
    });
    stage.addEventListener('pointercancel', function () { down = null; });

    function onKey(e) {
      if (!root.isConnected) return;
      var tg = e.target && e.target.tagName;
      if (tg === 'INPUT' && e.target !== range) return;
      if (tg === 'TEXTAREA') return;
      switch (e.key) {
        case 'ArrowRight': case 'PageDown': case ' ': next(); break;
        case 'ArrowLeft': case 'PageUp': prev(); break;
        case 'Home': goTo(0); break;
        case 'End': goTo(maxF); break;
        case 'Escape': if (opts.onClose && !document.fullscreenElement) opts.onClose(); return;
        default: return;
      }
      e.preventDefault();
    }
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', layout);
    var ro = window.ResizeObserver ? new ResizeObserver(layout) : null;
    if (ro) ro.observe(stage);

    layout(); shift(); update();
    setTimeout(function () { root.focus({ preventScroll: true }); }, 0);

    return {
      next: next, prev: prev, goTo: goTo,
      destroy: function () {
        document.removeEventListener('keydown', onKey);
        window.removeEventListener('resize', layout);
        if (ro) ro.disconnect();
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
  }

  window.FlipBook = { mount: mount };
})();
