# Kandungan Tingkatan 4 (sumber: buku teks Pendidikan Islam KSSM T4, imbasan)

Fail TSV ini ialah salinan apa yang ditampal ke Google Sheet T4 (satu fail = satu helaian). Sumber kebenaran tetap Google Sheet;
kemas kini di Sheet, bukan di sini. Format TSV (bukan CSV) supaya boleh ditampal terus ke Sheets dan tidak ditapis `.gitignore`.

| Fail | Helaian | Nota |
|---|---|---|
| `pelajaran.tsv` | Pelajaran | 25 pelajaran, 6 bidang, m.s. ikut buku; `status` = `buka` (semua dibuka minggu pertama; tukar ke `kunci` ikut RPT). |
| `sp.tsv` | SP | 134 kod SP seperti yang tercetak dalam buku (ditambah `JAWI` untuk Jawi Sprint). Nama ditulis supaya bermakna berdiri sendiri. |
| `soalan_pelajaran1-2_draf.tsv` | Soalan | DRAF 38 soalan (Pelajaran 1–2 + 6 Jawi Sprint) untuk semakan Ustazah sebelum ditampal. |
| `soalan_tajwid_pelajaran3_draf.tsv` | Soalan | DRAF 57 soalan Pelajaran 3 Hukum Tajwid (37 Tajwid Tap dengan pilihan Mad Silah/Mad Lazim/Qalqalah + 20 konsep/KBAT). Contoh ayat daripada buku m.s. 17–24. |
| `sp_rujukan_buku.tsv` | — | Rujukan: setiap kemunculan kod SP dalam buku dengan m.s. dan tajuk seksyen asal (Rumi + Jawi). |

Nota buku teks: m.s. buku = halaman PDF − 7. Unit dalam satu pelajaran berkongsi kod SP (al-Kahfi Unit 1/2 → 1.27.x; Korban/Akikah → 4.22.x;
Dhuha/Gerhana → 4.24.x; Orang Sakit/OKU → 6.17.x). Nota guru m.s. 185 tersalah cetak `5.12.5`; dalam `sp.tsv` ia `5.13.4`.
Ayat hafazan: al-An'am 162–163 (m.s. 2), al-Kahfi 101–106 (m.s. 7), al-Kahfi 107–110 (m.s. 13) — lihat `docs/t4/js/config.js`.
