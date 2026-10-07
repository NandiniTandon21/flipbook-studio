# Flipbook Studio

**Website: [nandinitandon21.github.io/flipbook-studio](https://nandinitandon21.github.io/flipbook-studio/)**, which has a live demo, the story behind it, and the download.

Turn PDFs and images into **flipbook magazines** with horizontal page turns and **searchable, selectable text**. Then keep them and share them as flipbooks, not as PDFs.

**Private and offline.** Everything runs on your computer. There's no account, no server, and nothing gets uploaded. A security policy built into the page blocks every network request, and the tests check that it does.

## Download & run

1. Download **[Flipbook-Studio.html](https://github.com/NandiniTandon21/flipbook-studio/releases/latest/download/Flipbook-Studio.html)** (one file, about 11 MB).
2. Double-click it. It opens in Chrome, Edge, Safari, or Firefox.
3. Make your magazine.

There's nothing to install and you don't need to be online. The same file works on macOS, Windows, and Linux.

## What it does

| | |
|---|---|
| **Upload** | PDF, JPG, PNG, WebP, GIF, AVIF, and **HEIC/HEIF** (iPhone photos, decoded in every browser) |
| **Searchable text** | PDF text is kept along with where it sits on the page. Text in images and scanned pages is read by built-in **OCR**. |
| **Navigate** | Opens on **My flipbooks**. Use **+ New flipbook** to start, **Continue editing** to pick up unsaved work, and **Edit** to change a saved one. In the editor, one bar has **Preview · Save · Download** and shows a live save status. |
| **Arrange** | Pages are laid out the way the magazine opens: the cover, then spreads. Drag to reorder, or use the ← → buttons. You can also add blank pages, reverse the order, or sort A–Z. |
| **Read** | Two-page spreads with a 3D page turn. Click, swipe, use the arrow keys or the slider, or go full screen. **Search** (⌘/Ctrl-F) jumps to each match and highlights it. You can select and copy text. |
| **Library** | Saves your flipbooks in this browser so you can read, edit, download, or delete them. Your work in progress autosaves. |
| **Download** | Creates one `.html` flipbook that opens offline in any browser and can still be searched. Drop it back into Studio to edit it. |

> **Languages:** OCR (reading text in images and scanned pages) supports **English only for now**. Text that's already inside a PDF is kept in any language. One exception: some Chinese, Japanese, and Korean PDFs need extra pdf.js data that isn't bundled yet. More OCR languages are planned (see *Roadmap*).

> The Library lives in this browser's storage. The `.html` files you download are your permanent copies.

## Roadmap

- **More OCR languages.** Tesseract supports 100+ languages, but each language model adds about 2–15 MB. The plan is optional *language packs*: download a language file once, drop it into Studio, and it's kept offline in the Library storage. That way the app itself stays small.
- **CJK PDF text.** Bundle pdf.js character maps (cMaps) so text extraction works for every Chinese, Japanese, and Korean PDF.

## Design

**Palette:** pale cornflower `#BDD5E2` (background), plum `#401F28` (the single ink, plus the one filled main button), bone `#E9E2DA` (page sheets, panels), and chocolate `#3E2923` (hover and error states). **Layout** (modelled on utrecht.jp): a slim left column with the logo and a vertical colophon, plain text-link navigation, and content separated by hairline rules. No boxes, lots of space. The app, the reader, exported flipbooks, and the website all share it.

## Typography

Titles use **Advercase** if it's installed on your computer ([Indieground](https://indieground.net/product/advercase-font/); install the free personal version or a licence you own). Otherwise they use the bundled **EB Garamond**. Labels and controls use **IBM Plex Mono**. Advercase is never bundled into the app or your exported flipbooks, because it's a commercial font.

## Browser support

The automated test suite (`npm test`) runs the whole flow in **Chromium, Firefox, and WebKit** (Safari's engine). See [docs/TESTING.md](docs/TESTING.md).

## Project layout

```
src/
  studio/            the app you open (Make + Library)
    index.html       page template with /*@@MARKERS@@*/ that the build fills in
    studio.css       editorial UI styles
    util.js          shared helpers + the global `Studio` namespace
    storage.js       Library (IndexedDB)
    ocr.js           offline text recognition (Tesseract, WebAssembly)
    importers.js     PDF / image / HEIC / flipbook → pages (+ text)
    exporter.js      the flipbook file format: build, parse, save
    app.js           UI wiring: board, library, reader overlay
  viewer/            the flip engine, also copied into every exported flipbook
    viewer.js
    viewer.css
site/                landing page source (index.html, landing.css, landing.js)
vendor/              pinned third-party engines + fonts (see vendor/README.md)
tests/               end-to-end tests + fixtures
docs/                ARCHITECTURE.md, TESTING.md + the built landing page (index.html, served by GitHub Pages)
tools/privacy-scan.sh  pre-publish scan for paths/secrets (npm run scan)
build.py             inlines everything → dist/Flipbook-Studio.html
dist/                the built single-file app (what users download)
```

## Develop

```bash
python3 build.py      # → dist/Flipbook-Studio.html (stdlib only, no network)
npm install           # once: installs Playwright for tests
npx playwright install chromium firefox webkit
npm test              # build + end-to-end test in all three engines
```

To understand how it works, read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Changes are listed in [CHANGELOG.md](CHANGELOG.md).

## Licence

MIT for this project's code (see [LICENSE](LICENSE)). The bundled third-party components keep their own licences. They're listed in [vendor/README.md](vendor/README.md).
