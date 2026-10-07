#!/usr/bin/env python3
"""Inline viewer + pdf.js into one offline file: 'Flipbook Studio.html'."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def safe(js: str, name: str) -> str:
    # Inline <script> bodies must not contain a closing tag or comment opener.
    out = js.replace("</script", "<\\/script").replace("<!--", "<\\!--")
    if out != js:
        print(f"  escaped HTML-sensitive sequences in {name}")
    return out


app = (ROOT / "src/app.html").read_text()
parts = {
    "/*@@VIEWER_CSS@@*/": (ROOT / "src/viewer.css").read_text(),
    "/*@@VIEWER_JS@@*/": safe((ROOT / "src/viewer.js").read_text(), "viewer.js"),
    "/*@@PDFJS@@*/": safe((ROOT / "vendor/pdf.min.js").read_text(), "pdf.min.js"),
    "/*@@PDFWORKER@@*/": safe((ROOT / "vendor/pdf.worker.min.js").read_text(), "pdf.worker.min.js"),
}
for key, val in parts.items():
    assert app.count(key) == 1, key
    app = app.replace(key, val)

out = ROOT / "Flipbook Studio.html"
out.write_text(app)
print(f"built {out} ({out.stat().st_size / 1e6:.2f} MB)")
