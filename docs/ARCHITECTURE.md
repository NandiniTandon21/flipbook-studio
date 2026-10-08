# Architecture

Flipbook Studio is a static web app that ships as **one HTML file**. It has no server and no build step at runtime. All code, engines, fonts, and the OCR language model are inlined, so the file works from `file://` with the network blocked.

## The two products

| | Studio (`dist/Flipbook-Studio.html`) | Flipbook (exported `*.html`) |
|---|---|---|
| Purpose | Make, arrange, store, export | Read |
| Contains | Studio UI, viewer, pdf.js, Tesseract, heic2any, fonts | Viewer, fonts, the book data |
| Size | about 11 MB | about 0.2 MB + the pages |
| Network policy | `default-src 'none'` + scripts/workers from inline/blob only | `default-src 'none'`, no workers, no eval |

The **viewer** (`src/viewer/`) is the one piece both of them share. The Studio runs it for the "Read" overlay. When it exports, it copies the viewer's source text (`#viewer-src`, `#viewer-css`, `#fonts-css`) straight into the new file, so the reading experience is the same code in both places.

## Landing page (GitHub Pages)

`site/` holds the landing page source. `build.py` inlines the fonts, the **real viewer** (`src/viewer/`), `landing.css`, and `landing.js` into `docs/index.html`, and fills in the version (from CHANGELOG.md) and download size. GitHub Pages serves `docs/` from `main`, and `.nojekyll` makes it serve the file as-is. The live demo pages are drawn on `<canvas>` with the site fonts and mounted with `FlipBook.mount(..., {embedded: true})`. The page makes no outside requests, and `tests/site.mjs` checks that.

## Screens

```
Home (#view-home) ──+ New / Continue / Edit──► Editor (#view-edit) ──Preview──► Reader overlay (#viewer)
     ▲                                              │
     └──────────── ← My flipbooks ─────────────────┘
```

`app.js` always starts on Home. The editor's state is `{pages, title, editingId, dirty}`. `dirty` drives the save status, the "Not saved yet" card on Home, and the confirm-before-discard prompts. The draft (including `dirty`) is autosaved to IndexedDB. Saving writes it immediately.

## Fonts

`build.py` embeds **Archivo** (roman + italic, variable weight 400–800) as base64 `@font-face`, and adds an `FS GT America` face that only uses `local()` sources. The font stack is `"FS GT America", "Archivo", …`. If GT America isn't installed, the browser uses Archivo. `local()` isn't a network request, so the no-network policy is unaffected.

## Data flow

```
 files ──► importers.js ──► page records ──► app.js state ──► exporter.toData() ──► book data
            │  PDF: pdf.js render + text layer        │                 │
            │  image/HEIC: decode (+ heic2any)        │                 ├─► FlipBook.mount()  (read)
            │  OCR: ocr.js when no text layer         │                 ├─► storage.saveBook() (library)
            ▼                                          ▼                 └─► exporter.buildHtml() (download)
         {id, src, thumb, w, h, name, text}      autosaved draft (IndexedDB)
```

### Page record (Studio, in memory + draft)

```js
{ id, src /* JPEG data URL */, thumb, w, h, name, text /* [[str,x,y,w,h,angle],...] | null */ }
```

### Book data (library + exported file), `format: "flipbook-studio", version: 2`

```js
{ title, aspect, pages: [jpegDataUrl], thumbs: [jpegDataUrl], ratios: [w/h], text: [items|null], created }
```

Text boxes use **fractions of the page** (`x, y, w, h` from 0 to 1, angle in radians), so they stay correct at any size. Version 1 files (before text support) still import, with `text` filled as `null`.

## Searchable text

* **PDF.** `page.getTextContent()` gives strings and their transforms. `importers.pdfTextItems()` converts these to normalised boxes using the same maths as pdf.js's own text layer: font height from the transform, top from ascent, and width from `item.width`.
* **Images and scanned PDF pages.** `ocr.js` runs Tesseract on a copy of the page no larger than 2200 px. It keeps word boxes with confidence of 35 or more.
* **Viewer.** For each visible page it builds an invisible `.fb-text` layer of absolutely positioned spans over the image. This layer is letterboxed to match `object-fit: contain`. Font size is `var(--h) × layer height × box height`. Each span gets one `scaleX()` so it matches the printed word's width. That ratio doesn't depend on size, so it's measured only once per page. The spans are transparent, so selecting and copying work, and search highlights them.
* **Search.** The viewer joins each page's strings, remembers each span's character range, finds matches, jumps to the spread, and highlights the overlapping spans. ⌘/Ctrl-F opens it.

## Offline engines without the network

Workers are the hard part. From `file://`, a worker can't `importScripts()` another blob URL, because blob URLs belong to an opaque origin. So:

* **pdf.js.** The worker source is stored as text (`#src-pdf-worker`) and started directly as `new Worker(blobUrl)`. It's handed to pdf.js as `workerPort`.
* **Tesseract.** `ocr.js` concatenates one worker script: a *prelude* that decodes the embedded language model and installs a local-only `fetch()`, then the wasm core (which defines `TesseractCore`, so Tesseract skips its import), then the Tesseract worker script. Any other `fetch` is rejected.
* **HEIC.** Safari decodes HEIC natively. Elsewhere, heic2any (libheif compiled to JS) runs in its own blob worker. It needs `'unsafe-eval'`, which is why the Studio's policy includes it. That setting allows no network access.

## Build

`build.py` replaces each `/*@@NAME@@*/` marker in `src/studio/index.html` (see `PARTS` in the script). It escapes `</script` and `<!--` in inlined code and base64-encodes the fonts and language model. It uses only the standard library.

## Compatibility rules

Every new version must open everything older versions produced, and should tolerate newer files.

* **Additive only.** Book data, library records, and drafts only ever *gain* optional fields. Never rename or remove a field or an IndexedDB store. A real schema change must bump `indexedDB.open(..., N)` and migrate in `onupgradeneeded`.
* **Normalise on the way in.** `exporter.normalize()` turns any book data (v1 = `{title, aspect, pages, thumbs}`, v2 = `+ ratios, text, appVersion`, or future) into the current shape. Drafts are normalised in `app.loadDraft()`. The viewer tolerates missing `text`/`ratios`.
* **Keep unknown fields.** Imports and edits merge the original data (`state.extra`) under the new data, so fields written by a newer app survive a re-save.
* **Storage is shared across copies.** In Chromium, Firefox, and WebKit, every `file://` page shares the same IndexedDB, so a newly downloaded copy sees the existing library.
* **Version awareness without the network.** `build.py` stamps `FS_BUILD = {version, date}`. The app shows the version and stores `newest-seen` (the highest `appVersion` among opened files). It shows a single-line note once per reason (`notice:newer:<v>`, `notice:age:<v>`, kept in the `kv` store) and never again.
* `tests/compat.mjs` enforces all of this in three engines.

## Storage

`storage.js` uses IndexedDB `flipbook-studio` with three stores:

* `meta` holds small records used to draw the Library.
* `books` holds the full book data.
* `kv` holds the autosaved draft.

If the browser refuses storage, `storage.available` turns false and the UI tells you to download instead.
