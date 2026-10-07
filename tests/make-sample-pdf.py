#!/usr/bin/env python3
"""Write tests/fixtures/sample.pdf: 7 coloured pages, each with a real (selectable) text layer.
Pure standard library — hand-assembles a minimal PDF."""
from pathlib import Path

OUT = Path(__file__).resolve().parent / "fixtures" / "sample.pdf"
COLOURS = [(0.71, 0.22, 0.12), (0.12, 0.3, 0.5), (0.9, 0.75, 0.3), (0.2, 0.45, 0.25),
           (0.5, 0.2, 0.5), (0.95, 0.5, 0.3), (0.1, 0.1, 0.1)]
W, H = 595, 842

objects = [b"<< /Type /Catalog /Pages 2 0 R >>", None,
           b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"]
kids = []
for i, (r, g, b) in enumerate(COLOURS, start=1):
    stream = (f"{r} {g} {b} rg 40 40 {W-80} {H-80} re f 1 1 1 rg "
              f"BT /F1 160 Tf 200 380 Td (P{i}) Tj ET "
              f"BT /F1 28 Tf 60 780 Td (Test Magazine page {i}) Tj ET").encode()
    objects.append(b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream")
    content_id = len(objects)
    objects.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {W} {H}] "
                   f"/Resources << /Font << /F1 3 0 R >> >> /Contents {content_id} 0 R >>".encode())
    kids.append(len(objects))
objects[1] = f"<< /Type /Pages /Kids [{' '.join(f'{k} 0 R' for k in kids)}] /Count {len(kids)} >>".encode()

pdf, offsets = b"%PDF-1.4\n", []
for n, body in enumerate(objects, start=1):
    offsets.append(len(pdf))
    pdf += f"{n} 0 obj\n".encode() + body + b"\nendobj\n"
xref = len(pdf)
pdf += f"xref\n0 {len(objects)+1}\n0000000000 65535 f \n".encode()
pdf += b"".join(f"{o:010d} 00000 n \n".encode() for o in offsets)
pdf += f"trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
OUT.write_bytes(pdf)
print("wrote", OUT)
