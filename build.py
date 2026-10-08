#!/usr/bin/env python3
"""
Build Flipbook Studio.

    python3 build.py   ->  dist/Flipbook-Studio.html   the offline app (one file)
                       ->  docs/index.html             the landing page (GitHub Pages)

Templates (src/studio/index.html, site/index.html) contain /*@@NAME@@*/ markers.
Each marker is replaced with the content listed in PARTS / site_parts below.
No third-party Python packages, no network: everything comes from src/, site/ and vendor/.
"""
from base64 import b64encode
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
VENDOR = ROOT / "vendor"
OUT = ROOT / "dist" / "Flipbook-Studio.html"
SITE_OUT = ROOT / "docs" / "index.html"

# Studio modules, in load order (each attaches to window.Studio).
STUDIO_JS = ["util.js", "storage.js", "ocr.js", "importers.js", "exporter.js", "app.js"]

# Embedded font: Archivo, a free grotesk close to GT America (SIL Open Font License, see vendor/README.md).
FONTS = [
    ("Archivo", "normal", "400 800", "Archivo-normal-400-800.woff2"),
    ("Archivo", "italic", "400 800", "Archivo-italic-400-800.woff2"),
]

# GT America (Grilli Type, used by utrecht.jp) is a commercial font, so it is NOT
# bundled. If it is installed on the computer, the browser uses it via local();
# otherwise everything falls back to the embedded Archivo. Format: (style, weight, names).
GT_AMERICA = [
    ("normal", 400, ["GT America Standard Regular", "GTAmerica-StandardRegular", "GT America Regular", "GTAmerica-Regular"]),
    ("normal", 700, ["GT America Standard Bold", "GTAmerica-StandardBold", "GT America Bold", "GTAmerica-Bold"]),
    ("italic", 400, ["GT America Standard Regular Italic", "GTAmerica-StandardRegularItalic", "GT America Italic"]),
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
    for style, weight, names in GT_AMERICA:
        src = ",".join(f"local('{n}')" for n in names)
        rules.append(f"@font-face{{font-family:'FS GT America';font-style:{style};font-weight:{weight};src:{src}}}")
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
    "VERSION": lambda: version(),                       # from CHANGELOG.md
    "BUILD_DATE": lambda: date.today().isoformat(),     # shown to users; drives the gentle "may be outdated" hint
}


def fill(template: str, parts: dict) -> str:
    """Replace each /*@@NAME@@*/ marker (must appear exactly once) with its content."""
    for name, produce in parts.items():
        marker = f"/*@@{name}@@*/"
        count = template.count(marker)
        if count != 1:
            raise SystemExit(f"build: expected marker {marker} exactly once, found {count}")
        template = template.replace(marker, produce())
    return template


def version() -> str:
    """Current version = first '## x.y.z' heading in CHANGELOG.md."""
    for line in read(ROOT / "CHANGELOG.md").splitlines():
        if line.startswith("## ") and line[3:4].isdigit():
            return line[3:].strip()
    return "dev"


def main() -> None:
    # 1. the app: dist/Flipbook-Studio.html
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(fill(read(SRC / "studio" / "index.html"), PARTS), encoding="utf-8")
    print(f"built {OUT.relative_to(ROOT)}  ({OUT.stat().st_size / 1e6:.1f} MB)")

    # 2. the landing page (GitHub Pages serves docs/): docs/index.html
    site_parts = {
        "FONTS_CSS": fonts_css,
        "VIEWER_CSS": PARTS["VIEWER_CSS"],
        "VIEWER_JS": PARTS["VIEWER_JS"],
        "LANDING_CSS": lambda: read(ROOT / "site" / "landing.css"),
        "LANDING_JS": lambda: script_safe(read(ROOT / "site" / "landing.js")),
        "VERSION": version,
        "APP_SIZE": lambda: f"{round(OUT.stat().st_size / 1e6)} MB",
    }
    SITE_OUT.write_text(fill(read(ROOT / "site" / "index.html"), site_parts), encoding="utf-8")
    (SITE_OUT.parent / ".nojekyll").write_text("")   # serve index.html as-is, no Jekyll processing
    print(f"built {SITE_OUT.relative_to(ROOT)}  ({SITE_OUT.stat().st_size / 1e3:.0f} KB)")


if __name__ == "__main__":
    main()
