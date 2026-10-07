# Changelog

Every feature or fix gets an entry here, in the same commit. See [CONTRIBUTING.md](CONTRIBUTING.md).

## 2.4.2

**Fixes**
- **Download did nothing.** Chrome rejects the "Save as…" file picker for pages opened from a file, with an error that looks like the user cancelled, so the download silently stopped. Downloads are now always a normal browser download (to your Downloads folder), followed by a "✓ Downloaded … check your Downloads folder" message.
- **Swipe to turn pages.** Two-finger **trackpad swipes** now turn pages; before, only click, drag, and the arrow keys did. Dragging over text no longer starts a text selection instead of turning the page.
- **Selecting text** is now an explicit **Select text** mode in the reader's bar (and in downloaded flipbooks). While it's on, you can select and copy text and swiping pauses. Choose **Done selecting** to go back.
- **Save messages** are now bigger, at the bottom centre, with a ✓, and stay up for 5 seconds. Before, they were small, in the corner, and gone in 3 seconds.

**Tests:** added checks for downloading with no workaround, drag-swipe over text, trackpad swipe, Select text mode, and the save message being visible on screen.

## 2.4.1

- **Readable left margin.** The vertical text in the left column is now horizontal *margin notes*, like a newspaper sidebar: short serif paragraphs with a bold lead-in (*Offline. / Private. / Yours.* in the app; *Free. / Offline. / Open source.* on the website), divided by hairlines. Same treatment in the app and the website.

## 2.4.0

**Calmer, more editorial layout** (modelled on utrecht.jp), for the app and the website
- **Pale cornflower background** `#BDD5E2` with **plum** `#401F28` as the single ink. Bone is used for page sheets and the search panel. The plum fill is kept for the one main action (*+ New flipbook* / *Download*).
- **Frame:** a slim left column with the logo (a line-drawn open book) and margin notes (vertical text at first, made horizontal in 2.4.1). To the right, a small info row, a hairline, the main navigation as plain text links with one filled button, and then content separated by long hairline rules.
- **Removed:** filled cells, the boxed grid, the full-width nav cells, and the footer. The website's colophon (licence, source link) now sits vertically in the left column.
- **App:** Home is a quiet grid of covers with a bold title, the page count, the date, and text-link actions. The editor is a breadcrumb + status line, a large title with Preview / Save as links and Download as the one button, then a single line of steps and tools, then the spreads with captions.
- **Website:** entries in two columns (the live flipbook beside the intro, then Why, FAQ, and the download), and three-column How / Features rows. There's no footer.
- **Reader:** cornflower background, plum controls as small serif text links, and a light-bone search panel. Downloaded flipbooks use the same look.

## 2.3.0

**New palette.** Bone `#E9E2DA`, plum `#401F28`, pale cornflower `#BDD5E2`, powder blue `#B5C5D4`, and chocolate `#3E2923` replace the old paper/ink/red scheme across the app, the reader, exported flipbooks, and the website.
- Plum is the single ink: all text, rules, the active navigation cell, and the reader's background.
- Cornflower and powder are cell fills and highlights. Search matches now highlight in cornflower with a plum outline.
- Chocolate is used for deep panels (the closing download section, error status).

**New layout: a ruled grid** (inspired by Readellion, Utrecht, and Anykey / Nothing International)
- Header: a brand row, then a full-width navigation bar of equal cells with the active cell filled plum. In the app: My flipbooks · + New flipbook · Import a flipbook file. On the website: Why · How it works · Features · FAQ · Download.
- Home: a ruled shelf of cells with alternating cornflower fills. Each cell has the cover, then a caption with the title on the left and page count on the right, then the date and Read / Edit / Download / Delete. "New flipbook" is the first cell, filled plum. Unsaved work appears as a powder strip with Continue editing / Discard.
- Editor: the bar, steps, and tools are all ruled cells. Every spread is its own cell, with its label and page numbers in the caption.
- Website: the hero is split into a headline cell and a live flipbook on cornflower. Why and FAQ are two-cell rows, How and Features are rows of three cells, the closing download panel is chocolate, and the footer is ruled cells.
- The demo magazine pages are redrawn in the new palette.

## 2.2.0

**Website**
- New landing page on GitHub Pages: **https://nandinitandon21.github.io/flipbook-studio/**. It's in the same magazine design, with a **live flipbook demo** you can turn (the real viewer), a "Why this exists" story, how it works, features, an FAQ, and a download button. It's self-contained, with no trackers or outside requests.
- Source in `site/`. `build.py` now also writes `docs/index.html` (and `.nojekyll`) and fills in the current version and download size.
- The repo's About link now points to the landing page.

**Viewer**
- New `embedded` option for books placed inside a longer page. It doesn't steal focus, and the arrow and space keys only turn pages while the book is focused, so page scrolling still works.

## 2.1.0

**Easier navigation**
- The app now opens on **My flipbooks** (Home) instead of jumping straight into your last draft.
- Home has a clear **+ New flipbook** card. Unsaved work shows as a **"Not saved yet — Continue editing / Discard"** card, and every saved flipbook has Read / Edit / Download / Delete.
- The editor has one bar: **← My flipbooks · Title · Preview · Save · Download**. A live save status (*Not saved yet / Unsaved changes / Saved ✓*) sits in the same bar.
- Numbered steps (1 Add → 2 Arrange → 3 Preview, save or download) show where you are.
- Quality and OCR moved into a small **Settings** dropdown, and the OCR toggle says "English only for now".
- Starting a new flipbook or opening another one asks first if there are unsaved changes, so nothing is lost silently.

**Magazine typography**
- Display type is **Advercase** when it's installed on the computer. The app loads it locally and never bundles it, because it's a commercial font. Otherwise it uses the embedded **EB Garamond**, which has the same retro Apple-Garamond feel.
- Labels and controls use **IBM Plex Mono**.
- Instrument Serif and Instrument Sans were removed.

**Fixes**
- Saving now writes the autosave immediately, so reloading right after saving no longer shows the work as unsaved.

**Tests**
- Added checks for landing on Home, the + New flow, the unsaved-work card, the save status, and opening a saved flipbook with Edit.

## 2.0.1

**Docs & UI**
- The OCR toggle now says **"English only"**. Its tooltip explains that text already inside a PDF is kept in any language.
- README: added a *Languages* note and a *Roadmap* (optional offline OCR language packs, and CJK PDF text support).
- Added CONTRIBUTING.md (project rules: keep the changelog updated, run tests and the privacy scan before a release).

**Tooling**
- `npm run scan` (`tools/privacy-scan.sh`) checks the working tree and the full git history for local paths, tokens, private keys, and personal emails.

## 2.0.0

**Searchable flipbooks**
- PDF text is kept along with where it sits on the page, so you can select, copy, and search it in the reader and in downloaded flipbooks.
- Built-in offline OCR (Tesseract, English) reads the text in images and scanned PDF pages. It can be switched off with the "Read text in images" toggle.
- Search panel in the reader (⌘/Ctrl-F). It jumps to each match and highlights it.

**More formats and browsers**
- HEIC/HEIF photos now work in every browser: Safari decodes them natively, and the other browsers use a bundled decoder.
- Fixed a Safari/WebKit bug where the back of a sheet showed through mirrored on an open spread.
- Fixed Firefox: saving to the Library no longer waits on the persistent-storage permission prompt.
- Automated end-to-end tests now cover Chromium, Firefox, and WebKit, including an on-screen pixel check of the spreads.

**Design**
- New editorial interface: paper and ink colours, Instrument Serif and Sans (embedded, so they work offline), hairline rules, and uppercase labels.
- The board shows pages the way the magazine opens: the cover, then numbered spreads.
- The reader has a deep-brown stage, text controls, and zero-padded page numbers.

**Code**
- Split into modules (`src/studio/*`, `src/viewer/*`), with docs in `docs/` and pinned vendor versions in `vendor/README.md`.
- The build output moved to `dist/Flipbook-Studio.html`.
- Flipbook format v2 adds `ratios` and `text`. Version 1 files still import.

## 1.0.0
- First release: PDF/image to flipbook, horizontal 3D page turns, Library, offline single-file export.
