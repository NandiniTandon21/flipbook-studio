// Backward/forward compatibility test, in Chromium, Firefox and WebKit.
//   node tests/compat.mjs [engine...]
//
// 1. A library + draft written in the OLD (v1-era) shapes opens, reads, edits and saves.
// 2. A flipbook file exported by Flipbook Studio 1.x imports.
// 3. A flipbook file from a NEWER app (v9.0.0, unknown fields) imports, keeps its unknown
//    fields after edit + save, and triggers the quiet "newer version" note exactly once.
// 4. An old copy of the app (simulated by moving the clock forward) shows the "may be
//    outdated" note exactly once.
import { chromium, firefox, webkit } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = pathToFileURL(path.join(ROOT, 'dist', 'Flipbook-Studio.html')).href;
const FIX = path.join(ROOT, 'tests', 'fixtures');
const ENGINES = { chromium, firefox, webkit };
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ENGINES);
const ready = (p) => p.waitForFunction(() => window.Studio && Studio.app && !document.getElementById('view-home').hidden);

async function run(name) {
  const res = [];
  const check = (label, ok, detail = '') => res.push({ label, ok: !!ok, detail });
  const browser = await ENGINES[name].launch();
  const errors = [];
  try {
    // ---------- 1. legacy library + draft
    const ctx = await browser.newContext({ acceptDownloads: true });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('dialog', (d) => d.accept());
    await page.goto(APP); await ready(page);
    await page.evaluate(async () => {
      const png = (c) => { const k = document.createElement('canvas'); k.width = 300; k.height = 424; const x = k.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, 300, 424); return k.toDataURL('image/jpeg'); };
      const pages = [png('#c33'), png('#36c'), png('#3a3')];
      const db = await new Promise((r, j) => { const q = indexedDB.open('flipbook-studio', 1); q.onsuccess = () => r(q.result); q.onerror = () => j(q.error); });
      await new Promise((r) => {
        const t = db.transaction(['books', 'meta', 'kv'], 'readwrite');
        // v1 book: no format/version/text/ratios; v1 meta: no "searchable"
        t.objectStore('books').put({ id: 'legacy1', data: { title: 'Legacy book', aspect: 300 / 424, pages, thumbs: pages, created: '2026-10-07T10:00:00Z' } });
        t.objectStore('meta').put({ id: 'legacy1', title: 'Legacy book', count: 3, cover: pages[0], created: 1, updated: 2 });
        // early draft: no "dirty" flag, pages without text
        t.objectStore('kv').put({ k: 'draft', title: 'Old draft', editingId: null, pages: [{ id: 'a', src: pages[1], thumb: pages[1], w: 300, h: 424, name: 'x' }] });
        t.oncomplete = r;
      });
      db.close();
    });
    await page.goto(APP); await ready(page); await page.waitForTimeout(500);
    check('old draft shows as "Continue editing"', await page.isVisible('#resume') && (await page.textContent('#resumeTitle')) === 'Old draft');
    check('old saved book is on the shelf', await page.locator('.book .cell-title', { hasText: 'Legacy book' }).count() === 1);
    await page.locator('.book', { hasText: 'Legacy book' }).locator('[data-a="read"]').click();
    await page.waitForSelector('.fb-root');
    check('old book opens in the reader', (await page.textContent('.fb-count')) === '01 / 03', await page.textContent('.fb-count'));
    await page.click('.fb-actions .fb-tb >> text=Close');
    await page.locator('.book', { hasText: 'Legacy book' }).locator('[data-a="edit"]').click();
    await page.waitForFunction(() => !document.getElementById('view-edit').hidden && Studio.app.state.pages.length === 3, null, { timeout: 10000 });
    await page.fill('#title', 'Legacy book (edited)');
    await page.click('#bSave');
    await page.waitForFunction(() => /Updated/.test(document.getElementById('statusText').textContent), null, { timeout: 10000 });
    check('old book edits + saves', true);

    // ---------- 2. v1 flipbook file
    await page.click('#navHome');
    await page.setInputFiles('#importInput', path.join(FIX, 'flipbook-v1.html'));
    await page.waitForFunction(() => document.querySelectorAll('.book').length === 2, null, { timeout: 15000 });
    check('flipbook file from v1 imports', await page.locator('.book .cell-title', { hasText: 'Made with v1' }).count() === 1);
    check('no version note for an older file', !(await page.isVisible('#notice')));

    // ---------- 3. future flipbook file
    await page.setInputFiles('#importInput', path.join(FIX, 'flipbook-future.html'));
    await page.waitForFunction(() => document.querySelectorAll('.book').length === 3, null, { timeout: 15000 });
    await page.waitForTimeout(300);
    const note = (await page.isVisible('#notice')) && await page.textContent('#noticeText');
    check('newer file imports + quiet note appears', /v9\.0\.0/.test(note || ''), note || 'no note');
    await page.locator('.book', { hasText: 'From the future' }).locator('[data-a="edit"]').click();
    await page.waitForFunction(() => !document.getElementById('view-edit').hidden && Studio.app.state.pages.length === 2, null, { timeout: 10000 });
    await page.click('#tBlank');
    await page.click('#bSave');
    await page.waitForFunction(() => /Updated/.test(document.getElementById('statusText').textContent), null, { timeout: 10000 });
    const kept = await page.evaluate(async () => {
      const db = await new Promise((r) => { const q = indexedDB.open('flipbook-studio', 1); q.onsuccess = () => r(q.result); });
      const all = await new Promise((r) => { const g = db.transaction('books').objectStore('books').getAll(); g.onsuccess = () => r(g.result); });
      db.close();
      const b = all.find((x) => x.data.title === 'From the future');
      return { future: b && b.data.futureFeature && b.data.futureFeature.theme, pages: b && b.data.pages.length };
    });
    check('newer file keeps its unknown fields after edit + save', kept.future === 'night' && kept.pages === 3, JSON.stringify(kept));
    await page.goto(APP); await ready(page); await page.waitForTimeout(500);
    check('newer-version note is not shown again', !(await page.isVisible('#notice')));
    check('app shows its version', /^v\d+\.\d+\.\d+$/.test(await page.textContent('#appVersion')), await page.textContent('#appVersion'));
    await ctx.close();

    // ---------- 4. an old copy of the app (clock moved forward 200 days)
    const old = await browser.newContext();
    await old.addInitScript(() => { const real = Date.now; Date.now = () => real() + 200 * 864e5; });
    const p2 = await old.newPage();
    p2.on('pageerror', (e) => errors.push(e.message));
    await p2.goto(APP); await ready(p2); await p2.waitForTimeout(600);
    const ageNote = (await p2.isVisible('#notice')) && await p2.textContent('#noticeText');
    check('old copy: quiet "may be outdated" note', /is from/.test(ageNote || ''), ageNote || 'no note');
    await p2.goto(APP); await ready(p2); await p2.waitForTimeout(600);
    check('old copy: note never shown again', !(await p2.isVisible('#notice')));
    await old.close();
  } catch (e) {
    check('run completed', false, e.message.split('\n')[0]);
  }
  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  return res;
}

let failed = 0;
for (const name of wanted) {
  const res = await run(name);
  console.log(`\ncompat · ${name}`);
  for (const r of res) { if (!r.ok) failed++; console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.label}${r.detail ? '  — ' + r.detail : ''}`); }
}
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
