# Flipbook Studio

Turn PDFs and images into flipbook magazines with real horizontal page turns. Store them and share them as flipbooks, not as PDFs.

**Private and offline.** Everything runs on your computer. There's no account, no server, and nothing gets uploaded. A built-in browser security policy blocks every network request from the app.

## Download & run

1. Download **[Flipbook-Studio.html](https://github.com/NandiniTandon21/flipbook-studio/releases/latest/download/Flipbook-Studio.html)** (one file, about 1.5 MB).
2. Double-click it. It opens in your browser (Chrome, Edge, Safari, or Firefox).
3. Make your magazine.

There's nothing to install and no internet connection is needed. It works the same on any computer.

## What it does

- **Upload**: drop in PDFs and images (JPG, PNG, WebP, GIF). Every PDF page becomes a magazine page.
- **Arrange**: drag pages to reorder them, or use the arrows. You can also delete pages, reverse the order, sort by file name, or add blank pages to line up spreads.
- **Read**: the front cover shows alone first, then two-page spreads with a 3D horizontal page turn. Turn pages by clicking, swiping, or with the arrow keys. There's also a page slider and full-screen mode.
- **Store**: the **Library** keeps your flipbooks in this browser on this computer. You can read, edit, download, or delete them there.
- **Download**: you get a single `.html` magazine file. It opens and flips offline in any browser on any device, so you can send it to anyone. Drop it back into Studio to edit it.

> The library lives in browser storage. Your downloaded `.html` flipbooks are the permanent copies, so keep them somewhere safe.

## Develop

```
src/app.html     studio UI
src/viewer.*     flip engine (shared with every exported flipbook)
vendor/          pdf.js 3.11.174 (Apache-2.0)
python3 build.py → Flipbook Studio.html (single self-contained file)
```

Limitations: PDF pages are saved as images, so you can't select text in the flipbook. HEIC photos only open in Safari.
