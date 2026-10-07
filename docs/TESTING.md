# Testing

## Automated end-to-end tests

```bash
npm install
npx playwright install chromium firefox webkit   # once
npm test                                          # build, then test all three engines
node tests/e2e.mjs webkit                         # one engine only
```

`tests/e2e.mjs` opens the **built** `dist/Flipbook-Studio.html` from `file://` (just as a user would) in Chromium, Firefox, and WebKit (Safari's engine). Each run checks:

| Check | Why |
|---|---|
| network blocked (Studio and exported file) | privacy promise |
| import 7-page PDF + PNG + HEIC → 9 pages | every input path |
| PDF text layer kept | PDF searchability |
| PNG and HEIC text recognised (OCR) | image searchability, HEIC decode in every engine |
| reorder | arranging |
| page turn lands on `02—03 / 09` | the flip engine |
| **spread colours are correct** | reads the actual screen pixels, so it catches the Safari bug where a sheet's mirrored back showed through |
| text layer rendered, search jumps + highlights | selectable/searchable reading |
| save → reload → library + draft still there | storage |
| download → open the file alone → search works | the exported flipbook |
| re-import the downloaded file | round trip |
| no page errors | general health |

Screenshots of each step, plus each engine's exported flipbook, are written to `tests/artifacts/` (git-ignored). Look through them after visual changes.

## Fixtures

`tests/fixtures/` is committed. Rebuild it with:

```bash
python3 tests/make-sample-pdf.py     # sample.pdf: 7 coloured pages with real text
node tests/make-fixtures.mjs         # poster.png (+ poster.heic via macOS `sips`)
```

If you change the colours in `make-sample-pdf.py`, update `PAGE_RGB` in `e2e.mjs`.

## Manual check before a release

Open `dist/Flipbook-Studio.html` in Safari and in Chrome. Drop in a real PDF and a phone photo, read it, search it, download it, and open the downloaded file.
