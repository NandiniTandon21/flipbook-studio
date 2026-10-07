# Changelog

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
