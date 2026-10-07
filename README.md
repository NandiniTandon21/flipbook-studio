# Flipbook Studio (MVP, offline)

Open `Flipbook Studio.html` in Chrome, Safari, Edge, or Firefox. It needs no internet connection.

- **Make**: add PDFs or images (drop them in or choose them), drag tiles or use the arrows to set the order, and add blank pages to line up spreads.
- **Read as flipbook**: a two-page magazine with horizontal 3D page turns. Use the arrow keys, click, swipe, the slider, or full screen.
- **Save to library**: stores the flipbook in this browser (IndexedDB). You can read, edit, download, or delete it.
- **Download flipbook**: saves one self-contained `.html` magazine that flips offline in any browser. You can drop it back into Studio or the Library to edit it.

Development: edit `src/`, then run `python3 build.py` to rebuild the single file. pdf.js 3.11.174 is vendored in `vendor/`.
