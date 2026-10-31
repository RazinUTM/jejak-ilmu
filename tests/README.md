# Ujian Jejak Ilmu

Ujian tempatan tanpa Supabase sebenar: PGlite (Postgres dalam Node) menjalankan semua fail `supabase/*.sql`,
pelayan statik kecil menyajikan `docs/`, dan Playwright membuka app seperti telefon murid dan laptop guru.
Fungsi `ulasan-ai` dijalankan dengan Claude palsu (tiada kunci API, tiada kos).

```
cd tests && npm install
node t2.mjs                    # regresi Tingkatan 2 dengan config sebenar: warna, kuiz, XP, guru, laporan
node sql12.mjs                 # skop pesanan/laporan T2, T4, satu kelas, semua
node tingkatan.mjs             # T2 dan T4 dalam telefon yang sama, guru T4, PDF, AI, panduan
OLD_SQL=1 node tingkatan.mjs   # keadaan sebelum SQL 12 dijalankan (laluan sandaran)
npm run semua                  # semua di atas
```

Jalankan `node t2.mjs` setiap kali kod dikongsi (`docs/app/`) diubah semasa membangunkan tingkatan lain.

- Data ujian sahaja: guru ujian PIN `999999`, murid rekaan. **Jangan** letak akaun, PIN atau data murid sebenar di sini.
- `fixtures/*2.csv` = salinan helaian T2 yang memang diterbitkan; `fixtures/*4.csv` = data T4 rekaan.
- Playwright dan Chromium mesti tersedia (`require('playwright')`). Tangkapan skrin dan PDF disimpan dalam `out/`.
- Tingkatan baharu: salin `tingkatan.mjs`, tukar config ujian `T4CFG` dan fixtures.
