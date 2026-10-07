// End-to-end test: runs the real built app in Chromium, Firefox and WebKit (Safari's engine).
//
//   npm test                 build + test all three browsers
//   node tests/e2e.mjs webkit   test one browser
//
// It exercises what a person does: import a PDF + PNG + HEIC, check text was
// extracted/recognised, reorder, read with page turns, search, save to the
// library, reload, download a flipbook, open that file, search it, re-import it.
// Screenshots and the exported flipbook land in tests/artifacts/ (git-ignored).
import { chromium, firefox, webkit } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = pathToFileURL(path.join(ROOT, 'dist', 'Flipbook-Studio.html')).href;
const FIX = path.join(ROOT, 'tests', 'fixtures');
const ART = path.join(ROOT, 'tests', 'artifacts');
fs.mkdirSync(ART, { recursive: true });

const ENGINES = { chromium, firefox, webkit };
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ENGINES);

/** Colour actually on screen at (x, y): screenshot 1px, decode it in the page. */
async function pixel(page, x, y) {
  const png = await page.screenshot({ clip: { x: Math.round(x), y: Math.round(y), width: 1, height: 1 } });
  return page.evaluate(async (src) => {
    const im = new Image(); im.src = src; await im.decode();
    const c = document.createElement('canvas'); c.width = c.height = 1;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    return Array.from(x.getImageData(0, 0, 1, 1).data.slice(0, 3));
  }, 'data:image/png;base64,' + png.toString('base64'));
}
/** Sample the left and right page of the open spread (lower area, away from the big number). */
async function spreadColours(page) {
  const r = await page.evaluate(() => { const b = document.querySelector('.fb-book').getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
  return { left: await pixel(page, r.x + r.w * 0.25, r.y + r.h * 0.8), right: await pixel(page, r.x + r.w * 0.75, r.y + r.h * 0.8) };
}
const near = (rgb, ref) => rgb.every((v, i) => Math.abs(v - ref[i]) < 40);
// sample.pdf page colours (see tests/make-sample-pdf.py)
const PAGE_RGB = { 2: [31, 77, 128], 3: [230, 191, 77], 4: [51, 115, 64], 5: [128, 51, 128] };

async function run(name) {
  const results = [];
  const check = (label, ok, detail = '') => { results.push({ label, ok: !!ok, detail }); };
  const browser = await ENGINES[name].launch();
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1360, height: 860 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  // (the deliberate example.com probe below is expected to log a blocked-request error)
  page.on('console', (m) => { if (m.type() === 'error' && !/example\.com/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('dialog', (d) => d.accept());

  try {
    await page.goto(APP);
    await page.waitForFunction(() => window.Studio && window.Studio.app);
    await page.waitForTimeout(300);
    check('opens on Home', await page.isVisible('#view-home') && !(await page.isVisible('#view-edit')));
    await page.screenshot({ path: path.join(ART, `${name}-0-home.png`) });
    await page.click('#navNew');
    check('+ New flipbook opens the editor', await page.isVisible('#drop'));
    await page.screenshot({ path: path.join(ART, `${name}-1-empty.png`) });

    // ---- privacy: the page must not be able to reach the network
    const net = await page.evaluate(() => fetch('https://example.com').then(() => 'reached', () => 'blocked'));
    check('network blocked', net === 'blocked', net);

    // ---- import PDF + PNG + HEIC
    const t0 = Date.now();
    await page.setInputFiles('#fileInput', ['sample.pdf', 'poster.png', 'poster.heic'].map((f) => path.join(FIX, f)));
    await page.waitForFunction(() => /Added|Couldn/.test(document.getElementById('statusText').textContent), null, { timeout: 300000 });
    const status = await page.textContent('#statusText');
    const pages = await page.evaluate(() => Studio.app.state.pages.map((p) => ({ name: p.name, text: (p.text || []).map((t) => t[0]).join(' ') })));
    check('imported 9 pages (7 PDF + PNG + HEIC)', pages.length === 9, `${pages.length} pages, "${status}", ${Math.round((Date.now() - t0) / 1000)}s`);
    check('PDF text layer kept', /Test Magazine page 1/.test(pages[0]?.text || ''), (pages[0]?.text || '').slice(0, 40));
    check('PNG text recognised (OCR)', /slow/i.test(pages[7]?.text || '') && /promise/i.test(pages[7]?.text || ''), (pages[7]?.text || '').slice(0, 60));
    check('HEIC decoded + OCR', pages[8]?.name === 'poster.heic' && /promise/i.test(pages[8]?.text || ''), (pages[8]?.text || '').slice(0, 60));
    check('save state shows "Not saved yet"', (await page.textContent('#saveState')) === 'Not saved yet', await page.textContent('#saveState'));
    await page.screenshot({ path: path.join(ART, `${name}-2-board.png`), fullPage: true });
    // unsaved work shows a "Continue editing" card on Home
    await page.click('#navHome');
    check('Home shows unsaved-work card', await page.isVisible('#resume'));
    await page.screenshot({ path: path.join(ART, `${name}-2b-resume.png`) });
    await page.click('#resumeGo');

    // ---- reorder with the tile arrow, then put it back
    await page.hover('.tile[data-index="0"]');
    await page.click('.tile[data-index="0"] [data-act="right"]');
    const moved = await page.evaluate(() => Studio.app.state.pages[1].name);
    await page.hover('.tile[data-index="1"]');
    await page.click('.tile[data-index="1"] [data-act="left"]');
    check('reorder', /p0001/.test(moved), moved);

    // ---- read: page turn, selectable text, search
    await page.click('#bRead');
    await page.waitForSelector('.fb-root');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(ART, `${name}-3-turning.png`) });
    await page.waitForTimeout(900);
    check('page turn', (await page.textContent('.fb-count')) === '02—03 / 09', await page.textContent('.fb-count'));
    const c23 = await spreadColours(page);
    check('spread 02—03 shows the right pages (not mirrored backs)', near(c23.left, PAGE_RGB[2]) && near(c23.right, PAGE_RGB[3]), JSON.stringify(c23));
    const spans = await page.evaluate(() => document.querySelectorAll('.fb-text span').length);
    check('selectable text layer rendered', spans > 0, `${spans} spans`);

    // turning by hand — drag across a page that has text on it, then a trackpad swipe
    const box = await page.evaluate(() => { const b = document.querySelector('.fb-book').getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
    const sx = box.x + box.w * 0.75, sy = box.y + box.h * 0.12;            // over the page's printed title
    await page.mouse.move(sx, sy); await page.mouse.down(); await page.mouse.move(sx - 160, sy, { steps: 8 }); await page.mouse.up();
    await page.waitForTimeout(1200);
    check('drag/swipe turns the page (even over text)', (await page.textContent('.fb-count')) === '04—05 / 09', await page.textContent('.fb-count'));
    await page.mouse.move(box.x + box.w / 2, box.y + box.h / 2);
    for (let i = 0; i < 6; i++) await page.mouse.wheel(-30, 0);              // two-finger swipe back
    await page.waitForTimeout(1200);
    check('trackpad swipe turns the page', (await page.textContent('.fb-count')) === '02—03 / 09', await page.textContent('.fb-count'));

    // "Select text" mode: dragging selects text and does NOT turn the page
    await page.click('.fb-actions .fb-tb >> text=Select text');
    // drag across the visible right page's title text
    const t = await page.evaluate(() => {
      const spans = [...document.querySelectorAll('.fb-text span')].map((s) => ({ s, r: s.getBoundingClientRect() }))
        .filter(({ s, r }) => r.width > 40 && /page 3/.test(s.textContent));
      const r = spans[0].r; return { x1: r.left + 2, x2: r.right - 2, y: r.top + r.height / 2 };
    });
    await page.mouse.move(t.x1, t.y); await page.mouse.down(); await page.mouse.move(t.x2, t.y, { steps: 10 }); await page.mouse.up();
    await page.waitForTimeout(800);
    const sel = await page.evaluate(() => String(getSelection()));
    check('Select text mode: selects text, no page turn', sel.length > 3 && (await page.textContent('.fb-count')) === '02—03 / 09', `selected "${sel.slice(0, 30)}"`);
    await page.click('.fb-actions .fb-tb >> text=Done selecting');
    await page.click('.fb-actions .fb-tb >> text=Search');
    await page.fill('.fb-s-input', 'page 5');
    await page.press('.fb-s-input', 'Enter');
    await page.waitForTimeout(1300);
    const hit = await page.evaluate(() => ({ cur: document.querySelectorAll('.fb-hit-cur').length, count: document.querySelector('.fb-count').textContent, meta: document.querySelector('.fb-s-meta').textContent }));
    check('search jumps + highlights', hit.cur > 0 && hit.count === '04—05 / 09', JSON.stringify(hit));
    const c45 = await spreadColours(page);
    check('spread 04—05 shows the right pages (not mirrored backs)', near(c45.left, PAGE_RGB[4]) && near(c45.right, PAGE_RGB[5]), JSON.stringify(c45));
    await page.screenshot({ path: path.join(ART, `${name}-4-search.png`) });
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    // ---- library: save, reload, still there
    await page.click('#bSave');
    await page.waitForFunction(() => /Saved|Couldn|blocks/.test(document.getElementById('statusText').textContent), null, { timeout: 30000 });
    const saveMsg = await page.textContent('#statusText');
    const toast = await page.evaluate(() => { const s = document.getElementById('status'); const r = s.getBoundingClientRect(); return !s.hidden && r.height > 30 && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; });
    check('save shows a visible confirmation', toast && /✓ Saved/.test(saveMsg), saveMsg);
    check('save state shows "Saved ✓"', (await page.textContent('#saveState')) === 'Saved ✓', await page.textContent('#saveState'));
    await page.reload();
    await page.waitForFunction(() => window.Studio && window.Studio.app);
    await page.waitForTimeout(800);
    const after = await page.evaluate(() => ({ draft: Studio.app.state.pages.length, lib: document.getElementById('libCount').textContent }));
    check('saved to library + survives reload', /Saved/.test(saveMsg) && after.lib.startsWith('01') && after.draft === 9, `${saveMsg} | ${JSON.stringify(after)}`);
    check('no unsaved-work card after saving', !(await page.isVisible('#resume')));
    await page.screenshot({ path: path.join(ART, `${name}-5-library.png`) });
    await page.click('.book [data-a="edit"]');
    await page.waitForFunction(() => !document.getElementById('view-edit').hidden, null, { timeout: 15000 }).catch(() => {});
    check('Edit opens the saved flipbook', await page.isVisible('#view-edit') && (await page.inputValue('#title')) === 'sample');

    // ---- download the flipbook file
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#bDownload')]);
    const exported = path.join(ART, `${name}-export.html`);
    await download.saveAs(exported);
    check('download flipbook file', fs.statSync(exported).size > 100000, `${(fs.statSync(exported).size / 1e6).toFixed(2)} MB`);
    await page.waitForFunction(() => /Downloaded/.test(document.getElementById('statusText').textContent), null, { timeout: 5000 }).catch(() => {});
    check('download shows a confirmation', /✓ Downloaded/.test(await page.textContent('#statusText')), await page.textContent('#statusText'));

    // ---- open the downloaded flipbook on its own, search inside it
    const fb = await context.newPage();
    fb.on('pageerror', (e) => errors.push('export pageerror: ' + e.message));
    await fb.goto(pathToFileURL(exported).href);
    await fb.waitForSelector('.fb-root');
    await fb.click('.fb-tb >> text=Search');
    await fb.fill('.fb-s-input', 'promise');
    await fb.press('.fb-s-input', 'Enter');
    await fb.waitForTimeout(1300);
    const fbHit = await fb.evaluate(() => ({ cur: document.querySelectorAll('.fb-hit-cur').length, count: document.querySelector('.fb-count').textContent }));
    check('exported flipbook: search works offline', fbHit.cur > 0 && /08—09/.test(fbHit.count), JSON.stringify(fbHit));
    await fb.screenshot({ path: path.join(ART, `${name}-6-exported.png`) });
    const fbNet = await fb.evaluate(() => fetch('https://example.com').then(() => 'reached', () => 'blocked'));
    check('exported flipbook: network blocked', fbNet === 'blocked', fbNet);
    await fb.close();

    // ---- import the downloaded file back into the library
    await page.click('#navHome');
    await page.setInputFiles('#importInput', exported);
    await page.waitForFunction(() => document.getElementById('libCount').textContent.startsWith('02'), null, { timeout: 60000 });
    check('re-import flipbook file', true);
  } catch (e) {
    check('run completed', false, e.message.split('\n')[0]);
  }
  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  return results;
}

let failed = 0;
for (const name of wanted) {
  const res = await run(name);
  console.log(`\n${name}`);
  for (const r of res) {
    if (!r.ok) failed++;
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.label}${r.detail ? '  — ' + r.detail : ''}`);
  }
}
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
