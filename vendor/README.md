# Vendored components

Everything the app needs at runtime is in this folder, pinned to exact versions, so builds are reproducible and offline. To update one, replace the file, run `npm test`, and update this table.

| File | Project | Version | Licence | Source |
|---|---|---|---|---|
| `pdf.min.js`, `pdf.worker.min.js` | [pdf.js](https://github.com/mozilla/pdf.js) | 3.11.174 | Apache-2.0 | `pdfjs-dist/build/` |
| `tesseract.min.js`, `tesseract.worker.min.js` | [Tesseract.js](https://github.com/naptha/tesseract.js) | 5.1.1 | Apache-2.0 | `tesseract.js/dist/` |
| `tesseract-core-simd-lstm.wasm.js` | [tesseract.js-core](https://github.com/naptha/tesseract.js-core) | 5.1.1 | Apache-2.0 | single-file build with the wasm inlined |
| `eng.traineddata.gz` | [tessdata](https://github.com/tesseract-ocr/tessdata) via `@tesseract.js-data/eng` | 4.0.0_best_int | Apache-2.0 | English LSTM model |
| `heic2any.min.js` | [heic2any](https://github.com/alexcorvi/heic2any) | 0.0.4 | MIT (bundles [libheif](https://github.com/strukturag/libheif), LGPL-3.0) | `heic2any/dist/` |
| `fonts/Archivo-*.woff2` | [Archivo](https://github.com/Omnibus-Type/Archivo) | Google Fonts, latin subset, wght 400–800, roman + italic | SIL OFL 1.1 | fonts.google.com |

**GT America is not bundled.** It's a commercial font from [Grilli Type](https://www.grillitype.com/typeface/gt-america) (the font utrecht.jp uses). `build.py` adds `@font-face` rules that only point at a *locally installed* copy (`local('GT America Standard …')`). If it's installed, the app uses it; if not, everything uses Archivo.

The OCR core needs WebAssembly SIMD, which Chrome 91+, Firefox 89+ and Safari 16.4+ all support. Where it isn't available, the OCR switch is disabled. PDF text still works without it.
