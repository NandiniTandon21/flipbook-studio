// Landing page test: opens the built docs/index.html in Chromium, Firefox and WebKit.
//   node tests/site.mjs [engine...]
// Screenshots go to tests/artifacts/ (git-ignored).
import { chromium, firefox, webkit } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = pathToFileURL(path.join(ROOT, 'docs', 'index.html')).href;
const ART = path.join(ROOT, 'tests', 'artifacts');
fs.mkdirSync(ART, { recursive: true });
const DOWNLOAD = 'https://github.com/NandiniTandon21/flipbook-studio/releases/latest/download/Flipbook-Studio.html';
const ENGINES = { chromium, firefox, webkit };
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ENGINES);

async function run(name) {
  const res = [];
  const check = (label, ok, detail = '') => res.push({ label, ok: !!ok, detail });
  const browser = await ENGINES[name].launch();
  const page = await browser.newPage({ viewport: { width: 1360, height: 860 } });
  const errors = [];
  const requests = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', (r) => { if (!/^(file|data|blob):/.test(r.url())) requests.push(r.url()); });
  try {
    await page.goto(SITE);
    await page.waitForSelector('#demo .fb-root');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(ART, `site-${name}-hero.png`) });

    const links = await page.$$eval('[data-download]', (as) => as.map((a) => a.href));
    check('every Download button → latest release file', links.length >= 3 && links.every((h) => h === DOWNLOAD), `${links.length} buttons`);
    const version = await page.textContent('[data-version]');
    check('version shown', /^v\d+\.\d+\.\d+$/.test(version), version);

    // space scrolls the page (demo not focused) and must NOT turn the demo
    const before = await page.textContent('#demo .fb-count');
    await page.keyboard.press('Space');
    await page.waitForTimeout(600);
    const scrolled = await page.evaluate(() => window.scrollY);
    check('space scrolls the page, not the demo', scrolled > 0 && (await page.textContent('#demo .fb-count')) === before, `scrollY=${scrolled}`);

    // demo turns
    await page.click('#demo .fb-tb >> text=Next →');
    await page.waitForTimeout(1200);
    check('demo flipbook turns', (await page.textContent('#demo .fb-count')) === '02—03 / 06', await page.textContent('#demo .fb-count'));
    await page.locator('#demo').screenshot({ path: path.join(ART, `site-${name}-demo.png`) });

    // nav anchor
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.click('.nav-links a[href="#faq"]');
    await page.waitForTimeout(1200);
    const faqTop = await page.evaluate(() => document.getElementById('faq').getBoundingClientRect().top);
    check('nav link scrolls to section', Math.abs(faqTop) < 120, `faq top=${Math.round(faqTop)}`);

    await page.screenshot({ path: path.join(ART, `site-${name}-full.png`), fullPage: true });
    check('no outside requests (no trackers)', requests.length === 0, requests.slice(0, 3).join(' '));
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
  console.log(`\nsite · ${name}`);
  for (const r of res) { if (!r.ok) failed++; console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.label}${r.detail ? '  — ' + r.detail : ''}`); }
}
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
