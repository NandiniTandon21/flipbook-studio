/* Flipbook viewer — shared by Flipbook Studio and every exported flipbook.
   FlipBook.mount(container, data, {onClose, startPage, embedded})
     embedded: true when the book sits inside a longer page (e.g. the landing page):
               no autofocus, and keys only work while the book has focus.
   data = {title, aspect, pages:[imgSrc], ratios:[w/h], text:[[ [str,x,y,w,h,angle], ... ] | null]} */
(function () {
  'use strict';

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function mount(container, data, opts) {
    opts = opts || {};
    data = data || {};
    var pages = data.pages || [];
    var texts = data.text || [];
    var ratios = data.ratios || [];
    var n = pages.length;
    var aspect = data.aspect || 0.7071;
    var L = Math.ceil(n / 2);                 // leaves: front = page 2i, back = page 2i+1
    var maxF = (n % 2 === 1) ? L - 1 : L;     // odd page count ends on an open spread
    var f = 0;                                // leaves turned to the left
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var DUR = reduce ? 180 : 900;
    var topZ = 2 * L + 10;
    var hasText = texts.some(function (t) { return t && t.length; });

    var root = el('div', 'fb-root');
    root.tabIndex = 0;
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', data.title || 'Flipbook');
    var stage = el('div', 'fb-stage');
    var book = el('div', 'fb-book');
    book.style.setProperty('--dur', DUR + 'ms');
    stage.appendChild(book);
    root.appendChild(stage);

    // ---- leaves
    var faces = [];   // page index -> {img, layer, spans}
    var leaves = [];
    function makeFace(cls, p) {
      var face = el('div', 'fb-face ' + cls);
      var rec = { img: null, layer: null, spans: null, built: false };
      if (p < n) {
        var img = document.createElement('img');
        img.alt = 'Page ' + (p + 1); img.draggable = false; img.decoding = 'async';
        face.appendChild(img);
        rec.img = img;
        if (texts[p] && texts[p].length) {
          var layer = el('div', 'fb-text');
          // sit exactly over the letterboxed (object-fit: contain) image
          var r = ratios[p] || aspect, lw = 1, lh = 1;
          if (r > aspect) lh = aspect / r; else lw = r / aspect;
          layer.style.left = ((1 - lw) / 2 * 100) + '%';
          layer.style.top = ((1 - lh) / 2 * 100) + '%';
          layer.style.width = (lw * 100) + '%';
          layer.style.height = (lh * 100) + '%';
          layer.style.setProperty('--lh', String(lh));
          rec.layer = layer;
          face.appendChild(layer);
        }
      } else {
        face.classList.add('fb-blank');
      }
      face.appendChild(el('div', 'fb-shade'));
      faces[p] = rec;
      return face;
    }
    for (var i = 0; i < L; i++) {
      var leaf = el('div', 'fb-leaf');
      leaf.appendChild(makeFace('fb-front', 2 * i));
      leaf.appendChild(makeFace('fb-back', 2 * i + 1));
      leaf.style.zIndex = String(2 * L - i);
      book.appendChild(leaf);
      leaves.push({ el: leaf, token: 0 });
    }
    if (!n) book.appendChild(el('div', 'fb-empty', 'No pages yet'));

    // ---- toolbar
    function tbtn(label, aria) {
      var b = el('button', 'fb-tb', label);
      b.type = 'button';
      if (aria) b.setAttribute('aria-label', aria);
      return b;
    }
    var bar = el('div', 'fb-bar');
    var title = el('div', 'fb-title', data.title || '');
    var controls = el('div', 'fb-controls');
    var bPrev = tbtn('← Prev', 'Previous page');
    var counter = el('span', 'fb-count');
    counter.setAttribute('aria-live', 'polite');
    var bNext = tbtn('Next →', 'Next page');
    var range = document.createElement('input');
    range.type = 'range'; range.min = '0'; range.max = String(Math.max(0, maxF)); range.step = '1';
    range.className = 'fb-range'; range.setAttribute('aria-label', 'Jump to page');
    controls.appendChild(bPrev); controls.appendChild(counter); controls.appendChild(bNext); controls.appendChild(range);
    var actions = el('div', 'fb-actions');
    var bSearch = tbtn('Search', 'Search text');
    var bFull = tbtn('Full screen');
    if (hasText) actions.appendChild(bSearch);
    actions.appendChild(bFull);
    var bClose = null;
    if (opts.onClose) { bClose = tbtn('Close'); actions.appendChild(bClose); }
    bar.appendChild(title); bar.appendChild(controls); bar.appendChild(actions);
    root.appendChild(bar);

    // ---- search panel
    var panel = el('aside', 'fb-search');
    panel.hidden = true;
    var sHead = el('div', 'fb-s-head');
    var sInput = document.createElement('input');
    sInput.type = 'text'; sInput.placeholder = 'Search this flipbook'; sInput.className = 'fb-s-input';
    sInput.setAttribute('aria-label', 'Search text'); sInput.autocomplete = 'off'; sInput.spellcheck = false;
    var sClose = tbtn('Close', 'Close search');
    sHead.appendChild(sInput); sHead.appendChild(sClose);
    var sMeta = el('div', 'fb-s-meta');
    var sList = el('ol', 'fb-s-list');
    panel.appendChild(sHead); panel.appendChild(sMeta); panel.appendChild(sList);
    root.appendChild(panel);
    container.appendChild(root);

    // ---- lazy images + selectable text layers around the current spread
    function buildText(p) {
      var rec = faces[p];
      if (!rec || !rec.layer || rec.built) return;
      rec.built = true;
      var items = texts[p], spans = [], frag = document.createDocumentFragment();
      for (var k = 0; k < items.length; k++) {
        var it = items[k];
        var s = el('span', null, it[0]);
        s.style.left = (it[1] * 100) + '%';
        s.style.top = (it[2] * 100) + '%';
        s.style.setProperty('--fh', String(it[4]));
        spans.push(s);
        frag.appendChild(s);
        frag.appendChild(document.createTextNode(' '));  // keeps words apart when copying
      }
      rec.layer.appendChild(frag);
      rec.spans = spans;
      fitText(p);
    }
    // stretch each span to the width of the printed word (ratio is size-independent)
    function fitText(p) {
      var rec = faces[p];
      if (!rec || !rec.spans) return;
      var lw = rec.layer.offsetWidth;
      if (!lw) { rec.fitPending = true; return; }
      rec.fitPending = false;
      var widths = rec.spans.map(function (s) { return s.offsetWidth; });
      var items = texts[p];
      rec.spans.forEach(function (s, k) {
        var target = items[k][3] * lw, w = widths[k];
        var t = w > 0 && target > 0 ? 'scaleX(' + (target / w).toFixed(4) + ')' : '';
        if (items[k][5]) t = 'rotate(' + items[k][5] + 'rad) ' + t;
        s.style.transform = t;
      });
    }
    function ensure(a, b) {
      for (var p = Math.max(0, a); p <= Math.min(n - 1, b); p++) {
        var rec = faces[p];
        if (rec.img && !rec.img.getAttribute('src')) rec.img.src = pages[p];
        buildText(p);
        if (rec.fitPending) fitText(p);
      }
    }

    // ---- sizing
    function layout() {
      var r = stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var padX = Math.max(14, r.width * 0.04), padY = Math.max(14, r.height * 0.05);
      var aw = r.width - padX * 2, ah = r.height - padY * 2;
      var w = Math.max(40, Math.min(aw / 2, ah * aspect));
      book.style.setProperty('--w', w + 'px');
      book.style.setProperty('--h', (w / aspect) + 'px');
      faces.forEach(function (rec, p) { if (rec && rec.fitPending) fitText(p); });
    }
    function shift() {
      var x = 0;
      if (n && f === 0) x = -0.5;
      else if (n && f === L && n % 2 === 0) x = 0.5;
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
        // swap the visible side when the sheet is edge-on (half-way; the easing is symmetric)
        setTimeout(function () { if (lf.token === tok) lf.el.classList.toggle('show-back', toFlipped); }, DUR / 2);
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
    function goPage(p) { goTo(Math.floor((p + 1) / 2)); }
    function next() { goTo(f + 1); }
    function prev() { goTo(f - 1); }

    function update() {
      var txt;
      if (!n) txt = '00 / 00';
      else if (f === 0) txt = pad(1) + ' / ' + pad(n);
      else if (f === L && n % 2 === 0) txt = pad(n) + ' / ' + pad(n);
      else txt = pad(2 * f) + '—' + pad(2 * f + 1) + ' / ' + pad(n);
      counter.textContent = txt;
      range.value = String(f);
      bPrev.disabled = f <= 0;
      bNext.disabled = f >= maxF;
      ensure(2 * f - 3, 2 * f + 4);
    }

    // ---- search
    var index = null, results = [], cur = -1, hits = [];
    function buildIndex() {
      index = texts.map(function (items) {
        if (!items || !items.length) return null;
        var str = '', ranges = [];
        items.forEach(function (it) {
          var s = String(it[0]).replace(/\s+/g, ' ');
          ranges.push([str.length, str.length + s.length]);
          str += s + ' ';
        });
        return { lower: str.toLowerCase(), raw: str, ranges: ranges };
      });
    }
    function clearHits() {
      hits.forEach(function (s) { s.classList.remove('fb-hit', 'fb-hit-cur'); });
      hits = [];
    }
    function runSearch() {
      if (!index) buildIndex();
      var q = sInput.value.trim().toLowerCase().replace(/\s+/g, ' ');
      results = []; cur = -1; clearHits();
      sList.replaceChildren();
      if (q.length < 2) { sMeta.textContent = q ? 'Type at least two letters' : ''; return; }
      for (var p = 0; p < index.length && results.length < 500; p++) {
        var ix = index[p];
        if (!ix) continue;
        var from = 0, at;
        while ((at = ix.lower.indexOf(q, from)) !== -1 && results.length < 500) {
          results.push({ p: p, start: at, end: at + q.length });
          from = at + q.length;
        }
      }
      sMeta.textContent = results.length ? results.length + (results.length === 500 ? '+' : '') + ' result' + (results.length === 1 ? '' : 's') : 'No matches';
      var frag = document.createDocumentFragment();
      results.forEach(function (r, k) {
        var li = el('li');
        var b = el('button', 'fb-s-item');
        b.type = 'button';
        var raw = index[r.p].raw;
        var a = Math.max(0, r.start - 40), z = Math.min(raw.length, r.end + 60);
        b.appendChild(el('span', 'fb-s-page', 'P. ' + pad(r.p + 1)));
        var snip = el('span', 'fb-s-snip');
        snip.appendChild(document.createTextNode((a > 0 ? '…' : '') + raw.slice(a, r.start)));
        snip.appendChild(el('mark', null, raw.slice(r.start, r.end)));
        snip.appendChild(document.createTextNode(raw.slice(r.end, z) + (z < raw.length ? '…' : '')));
        b.appendChild(snip);
        b.onclick = function () { show(k); };
        li.appendChild(b);
        frag.appendChild(li);
      });
      sList.appendChild(frag);
    }
    function show(k) {
      if (!results.length) return;
      cur = (k + results.length) % results.length;
      var r = results[cur];
      goPage(r.p);
      ensure(r.p, r.p);
      clearHits();
      var rec = faces[r.p], ranges = index[r.p].ranges;
      results.forEach(function (o, j) {
        if (o.p !== r.p) return;
        ranges.forEach(function (rg, i) {
          if (rg[1] > o.start && rg[0] < o.end && rec.spans[i]) {
            var s = rec.spans[i];
            s.classList.add('fb-hit');
            if (j === cur) s.classList.add('fb-hit-cur');
            hits.push(s);
          }
        });
      });
      sMeta.textContent = (cur + 1) + ' of ' + results.length;
      Array.prototype.forEach.call(sList.children, function (li, j) { li.classList.toggle('is-cur', j === cur); });
      var li = sList.children[cur];
      if (li) {
        var lt = li.offsetTop, lb = lt + li.offsetHeight;
        if (lt < sList.scrollTop || lb > sList.scrollTop + sList.clientHeight) sList.scrollTop = lt - sList.clientHeight / 3;
      }
    }
    var sTimer = null;
    sInput.addEventListener('input', function () { clearTimeout(sTimer); sTimer = setTimeout(function () { sTimer = null; runSearch(); }, 160); });
    sInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (sTimer) { clearTimeout(sTimer); sTimer = null; runSearch(); }
        show(e.shiftKey ? cur - 1 : cur + 1);
      } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeSearch(); }
    });
    function openSearch() {
      if (!hasText) return;
      panel.hidden = false; root.classList.add('is-searching');
      sInput.focus(); sInput.select();
    }
    function closeSearch() {
      panel.hidden = true; root.classList.remove('is-searching'); clearHits();
      root.focus({ preventScroll: true });
    }
    bSearch.onclick = function () { if (panel.hidden) openSearch(); else closeSearch(); };
    sClose.onclick = closeSearch;

    // ---- input
    bPrev.onclick = prev;
    bNext.onclick = next;
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
      down = { x: e.clientX, y: e.clientY, onText: !!(e.target.closest && e.target.closest('.fb-text span')) };
    });
    stage.addEventListener('pointerup', function (e) {
      if (!down) return;
      var d = down; down = null;
      var dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (window.getSelection && String(window.getSelection())) return;   // selecting text, don't turn
      if (!d.onText && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { if (dx < 0) next(); else prev(); return; }
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        var r = book.getBoundingClientRect();
        if (e.clientX >= r.left + r.width / 2) next(); else prev();
      }
    });
    stage.addEventListener('pointercancel', function () { down = null; });

    function onKey(e) {
      if (!root.isConnected) return;
      if (opts.embedded && !root.contains(document.activeElement)) return;   // don't hijack page scrolling
      if ((e.metaKey || e.ctrlKey) && (e.key === 'f' || e.key === 'F') && hasText) { e.preventDefault(); openSearch(); return; }
      var tg = e.target && e.target.tagName;
      if (tg === 'INPUT' && e.target !== range) return;
      if (tg === 'TEXTAREA') return;
      switch (e.key) {
        case 'ArrowRight': case 'PageDown': case ' ': next(); break;
        case 'ArrowLeft': case 'PageUp': prev(); break;
        case 'Home': goTo(0); break;
        case 'End': goTo(maxF); break;
        case 'Escape':
          if (!panel.hidden) { closeSearch(); break; }
          if (opts.onClose && !document.fullscreenElement) opts.onClose();
          return;
        default: return;
      }
      e.preventDefault();
    }
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', layout);
    var ro = window.ResizeObserver ? new ResizeObserver(layout) : null;
    if (ro) ro.observe(stage);

    layout(); shift(); update();
    if (opts.startPage) goPage(opts.startPage);
    if (!opts.embedded) setTimeout(function () { root.focus({ preventScroll: true }); }, 0);
    else stage.addEventListener('pointerdown', function () { root.focus({ preventScroll: true }); });

    return {
      next: next, prev: prev, goTo: goTo, goPage: goPage,
      state: function () { return { spread: f, max: maxF, count: counter.textContent }; },
      search: function (q) { openSearch(); sInput.value = q; runSearch(); show(0); return results.length; },
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
