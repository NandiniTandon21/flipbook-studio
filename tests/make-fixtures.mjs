// Generates the test fixtures in tests/fixtures/ (already committed; re-run only to change them).
//   node tests/make-fixtures.mjs
// - poster.png   an image with printed text (exercises OCR)
// - poster.heic  the same image as HEIC (macOS `sips` required)
// sample.pdf (7 pages with a real text layer) is produced by tests/make-sample-pdf.py.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 1100 } });
await page.setContent(`
  <body style="margin:0;background:#f1eee8;font-family:Helvetica,Arial,sans-serif;color:#1b1814">
    <div style="padding:70px">
      <div style="font-size:18px;letter-spacing:.14em">BRANDING &nbsp; + &nbsp; DESIGN</div>
      <h1 style="font-size:96px;margin:120px 0 40px;line-height:1">Slow Promise</h1>
      <p style="font-size:30px;line-height:1.35">Slow branding was created as an antidote to excess.
      Over time it shifted into a moral checklist. Honesty builds credibility.</p>
      <div style="margin-top:220px;font-size:18px;letter-spacing:.14em">SWIPE TO READ</div>
    </div>
  </body>`);
await page.screenshot({ path: path.join(dir, 'poster.png') });
await browser.close();

try {
  execFileSync('sips', ['-s', 'format', 'heic', path.join(dir, 'poster.png'), '--out', path.join(dir, 'poster.heic')], { stdio: 'ignore' });
} catch {
  console.warn('sips not available: poster.heic not regenerated (macOS only)');
}
console.log('fixtures written to', dir);
