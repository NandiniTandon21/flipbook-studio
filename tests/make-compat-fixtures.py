#!/usr/bin/env python3
"""Write compatibility fixtures to tests/fixtures/ (committed; re-run only to change them).

flipbook-v1.html      a flipbook exactly as Flipbook Studio 1.x exported it:
                      {title, aspect, pages, thumbs, created} — no format/version, no text, no ratios.
flipbook-future.html  a flipbook from a hypothetical newer app (v9.0.0): format version 9 with an
                      unknown extra field. The current app must open it and keep that field.
"""
import json
from pathlib import Path

DIR = Path(__file__).resolve().parent / "fixtures"
# tiny solid-colour PNGs (2x3 px) so files stay small
PNG = {
    "red": "iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAIAAAA2iEnWAAAAEElEQVR4nGM4oaEBRAwoFABIvQaRikDLogAAAABJRU5ErkJggg==",
    "blue": "iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAIAAAA2iEnWAAAAEElEQVR4nGPQCDgBRAwoFABLFQeB+K0kzQAAAABJRU5ErkJggg==",
}


def page(name: str) -> str:
    return "data:image/png;base64," + PNG[name]


def html(data: dict) -> str:
    js = json.dumps(data).replace("<", "\\u003c")
    return ("<!doctype html><html><head><meta charset=\"utf-8\"><title>%s</title></head><body>"
            "<div id=\"flipbook\"></div><script type=\"application/json\" id=\"flipbook-data\">%s</script>"
            "</body></html>\n") % (data["title"], js)


v1 = {"title": "Made with v1", "aspect": 2 / 3, "pages": [page("red"), page("blue"), page("red")],
      "thumbs": [page("red"), page("blue"), page("red")], "created": "2026-10-07T10:00:00.000Z"}
future = {"format": "flipbook-studio", "version": 9, "appVersion": "9.0.0", "title": "From the future",
          "aspect": 2 / 3, "pages": [page("blue"), page("red")], "thumbs": [page("blue"), page("red")],
          "ratios": [0.6667, 0.6667], "text": [[["Hello future", 0.1, 0.1, 0.5, 0.05, 0]], None],
          "futureFeature": {"soundtrack": "lofi.mp3", "theme": "night"}, "created": "2030-01-01T00:00:00.000Z"}

(DIR / "flipbook-v1.html").write_text(html(v1))
(DIR / "flipbook-future.html").write_text(html(future))
print("wrote", DIR / "flipbook-v1.html", DIR / "flipbook-future.html")
