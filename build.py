#!/usr/bin/env python3
"""
Build Flipbook Studio into ONE offline HTML file.

    python3 build.py            ->  dist/Flipbook-Studio.html

The template src/studio/index.html contains /*@@NAME@@*/ markers. Each marker is
replaced with the file(s) listed in PARTS below. No third-party Python packages,
no network: everything comes from src/ and vendor/.
"""
from base64 import b64encode
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
VENDOR = ROOT / "vendor"
OUT = ROOT / "dist" / "Flipbook-Studio.html"

# Studio modules, in load order (each attaches to window.Studio).
STUDIO_JS = ["util.js", "storage.js", "ocr.js", "importers.js", "exporter.js", "app.js"]

# Embedded fonts (SIL Open Font License, see vendor/README.md).
FONTS = [
    ("EB Garamond", "normal", "400 600", "EBGaramond-normal-400-600.woff2"),
    ("EB Garamond", "italic", "400 600", "EBGaramond-italic-400-600.woff2"),
    ("IBM Plex Mono", "normal", "400", "IBMPlexMono-normal-400.woff2"),
    ("IBM Plex Mono", "normal", "500", "IBMPlexMono-normal-500.woff2"),
]

# Advercase (Indieground) is a commercial font, so it is NOT bundled. If it is
# installed on the computer, the browser uses it via local(); otherwise the
# display face falls back to the embedded EB Garamond.
ADVERCASE = [
    ("normal", ["Advercase", "Advercase Regular", "Advercase-Regular", "Advercase Font Regular", "AdvercaseFont-Regular"]),
    ("italic", ["Advercase Italic", "Advercase-Italic", "Advercase Font Italic", "AdvercaseFont-Italic"]),
]


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def script_safe(code: str) -> str:
    """Text placed inside <script> must not contain '</script' or '<!--'."""
    return code.replace("</script", "<\\/script").replace("<!--", "<\\!--")


def fonts_css() -> str:
    rules = []
    for family, style, weight, file in FONTS:
        data = b64encode((VENDOR / "fonts" / file).read_bytes()).decode()
        rules.append(
            f"@font-face{{font-family:'{family}';font-style:{style};font-weight:{weight};"
            f"font-display:swap;src:url(data:font/woff2;base64,{data}) format('woff2')}}"
        )
    for style, names in ADVERCASE:
        src = ",".join(f"local('{n}')" for n in names)
        rules.append(f"@font-face{{font-family:'FS Advercase';font-style:{style};font-weight:400 700;src:{src}}}")
    return "\n".join(rules)


PARTS = {
    "FONTS_CSS": fonts_css,
    "VIEWER_CSS": lambda: read(SRC / "viewer" / "viewer.css"),
    "STUDIO_CSS": lambda: read(SRC / "studio" / "studio.css"),
    "VIEWER_JS": lambda: script_safe(read(SRC / "viewer" / "viewer.js")),
    "STUDIO_JS": lambda: script_safe("\n".join(read(SRC / "studio" / f) for f in STUDIO_JS)),
    "PDFJS": lambda: script_safe(read(VENDOR / "pdf.min.js")),
    "PDF_WORKER": lambda: script_safe(read(VENDOR / "pdf.worker.min.js")),
    "TESSERACT": lambda: script_safe(read(VENDOR / "tesseract.min.js")),
    "TESS_WORKER": lambda: script_safe(read(VENDOR / "tesseract.worker.min.js")),
    "TESS_CORE": lambda: script_safe(read(VENDOR / "tesseract-core-simd-lstm.wasm.js")),
    "ENG_DATA_B64": lambda: b64encode((VENDOR / "eng.traineddata.gz").read_bytes()).decode(),
    "HEIC2ANY": lambda: script_safe(read(VENDOR / "heic2any.min.js")),
}


def main() -> None:
    html = read(SRC / "studio" / "index.html")
    for name, produce in PARTS.items():
        marker = f"/*@@{name}@@*/"
        count = html.count(marker)
        if count != 1:
            raise SystemExit(f"build: expected marker {marker} exactly once, found {count}")
        html = html.replace(marker, produce())
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(html, encoding="utf-8")
    print(f"built {OUT.relative_to(ROOT)}  ({OUT.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
