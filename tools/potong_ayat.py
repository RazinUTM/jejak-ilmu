#!/usr/bin/env python3
"""Potong imej ayat hafazan daripada PDF buku teks (imbasan) → PNG lutsinar bersih untuk docs/tN/img/ayat/.

Cara (digunakan untuk T4, 30 Okt 2026):
  1. Kenal pasti halaman PDF yang ada kotak ayat (m.s. buku + offset; T4: PDF = m.s. + 7).
  2. Lihat profil baris teks dalam kawasan kotak ayat (x0 x1 y0 y1 pada 300 dpi):
       python3 tools/potong_ayat.py profil BUKU.pdf 14 860 2280 1000 2600
     Keluaran: senarai julat baris berdakwat (y_atas, y_bawah, tinggi). Baris pertama biasanya ta'awwudh, baris terakhir rujukan surah.
  3. Potong dari baris ayat pertama hingga baris ayat terakhir (abaikan ta'awwudh dan baris rujukan):
       python3 tools/potong_ayat.py potong BUKU.pdf 14 860 2280 1199 2327 docs/t4/img/ayat/al-kahfi-18-101-106.png
     Skrip memotong tepat pada dakwat (+12 px), membuang latar berwarna (alpha daripada kecerahan), menyusut ke lebar 1100 px,
     menambah margin lutsinar 40 px dan mengkuantum kepada 16 warna (≈20–80 KB). Semak *_preview.png (di atas putih) sebelum commit.
Perlu: pdftoppm (poppler), Pillow, numpy.
"""
import subprocess, sys, tempfile, os
from PIL import Image, ImageFilter
import numpy as np

def render(pdf, page, dpi=300):
    d = tempfile.mkdtemp(); subprocess.run(['pdftoppm', '-r', str(dpi), '-f', str(page), '-l', str(page), '-png', pdf, os.path.join(d, 'p')], check=True)
    f = [x for x in os.listdir(d) if x.endswith('.png')][0]; return Image.open(os.path.join(d, f)).convert('L')

def profil(gray, x0, x1, y0, y1, thr=110):
    reg = np.array(gray)[y0:y1, x0:x1]; rows = (reg < thr).sum(axis=1)
    runs, start = [], None
    for i, v in enumerate(rows):
        if v >= 3 and start is None: start = i
        if v < 3 and start is not None: runs.append((y0 + start, y0 + i)); start = None
    if start is not None: runs.append((y0 + start, y0 + len(rows)))
    merged = []
    for r in runs:
        if merged and r[0] - merged[-1][1] < 12: merged[-1] = (merged[-1][0], r[1])
        else: merged.append(r)
    return merged

def potong(gray, xr, yr, out, pad=40, target_w=1100, lo=100, hi=205, warna=16):
    g = np.array(gray); y0, y1 = yr
    reg = g[y0:y1, xr[0]:xr[1]]; cols = (reg < 110).sum(axis=0); xs = np.where(cols >= 2)[0]
    x0 = int(xr[0] + xs.min() - 14); x1 = int(xr[0] + xs.max() + 14); y0 -= 12; y1 += 12
    crop = gray.crop((x0, y0, x1, y1)).filter(ImageFilter.MedianFilter(3))
    a = np.array(crop).astype(np.float32); alpha = np.clip((hi - a) / (hi - lo), 0, 1) * 255
    rgba = np.zeros((a.shape[0], a.shape[1], 4), dtype=np.uint8); rgba[..., 0:3] = 20; rgba[..., 3] = alpha.astype(np.uint8)
    img = Image.fromarray(rgba, 'RGBA'); s = target_w / img.size[0]; img = img.resize((target_w, max(1, round(img.size[1] * s))), Image.LANCZOS)
    canvas = Image.new('RGBA', (img.size[0] + 2 * pad, img.size[1] + 2 * pad), (0, 0, 0, 0)); canvas.paste(img, (pad, pad), img)
    canvas.quantize(colors=warna, method=Image.Quantize.FASTOCTREE).save(out, optimize=True)
    prev = Image.new('RGB', canvas.size, 'white'); prev.paste(canvas, (0, 0), canvas); prev.save(out.replace('.png', '_preview.png'))
    print(out, 'kotak', (x0, y0, x1, y1), 'saiz', canvas.size, f'{os.path.getsize(out)//1024} KB  (semak {out.replace(".png", "_preview.png")}, kemudian padam preview)')

if __name__ == '__main__':
    if len(sys.argv) < 8 or sys.argv[1] not in ('profil', 'potong'): print(__doc__); sys.exit(1)
    cmd, pdf, page = sys.argv[1], sys.argv[2], int(sys.argv[3]); x0, x1, y0, y1 = map(int, sys.argv[4:8])
    gray = render(pdf, page)
    if cmd == 'profil': print([(a, b, b - a) for a, b in profil(gray, x0, x1, y0, y1)])
    else: potong(gray, (x0, x1), (y0, y1), sys.argv[8])
