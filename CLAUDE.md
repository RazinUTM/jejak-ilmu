# Jejak Ilmu · nota untuk Claude

Aplikasi e-pembelajaran Pendidikan Islam KSSM untuk kelas **Ustazah Nafisah**. Pemilik repo: **Razin** (pensyarah UTM, suami Ustazah). Phone-first, GitHub Pages dari `docs/` (branch `main`): https://razinutm.github.io/jejak-ilmu/

## Cara berkomunikasi
- Chat dengan Razin: naratif Bahasa Melayu, istilah teknikal kekal English. Terus terang, nyatakan andaian, tunjuk titik paling lemah dahulu, akui kesilapan sendiri.
- Teks dalam app dan panduan murid: Bahasa Melayu mudah untuk murid sekolah menengah. Masa dalam format AM/PM.
- Razin menguji di telefon dan menghantar tangkapan skrin; maklum balas biasanya senarai pendek. Siapkan semua, uji, push, kemudian terangkan langkah yang perlu dia buat sendiri (SQL, deploy fungsi).

## Struktur (satu kod, satu folder setiap tingkatan)
- Kod dikongsi: `docs/app/jejak.js` (keseluruhan app, satu fail), `docs/app/jejak.css`, `docs/js/laporan-pdf.js` (jsPDF + autotable, vendored), `docs/img/`, `docs/js/vendor/`.
- Tingkatan 2 = akar `docs/` (URL dan kunci storan telefon asal, JANGAN ubah). Tingkatan lain = `docs/tN/` dengan `index.html`, `js/config.js`, `img/ayat/`, `manifest.webmanifest`, `panduan.html`.
- `js/config.js` setiap folder: `id`, `tingkatan`, `tajuk`, `kelasAwalan` ('4 '), `asas` ('../'), `guruNama`, `demo:false`, `hafazan:[…]`, pautan CSV Google Sheets (Soalan, SP, Pelajaran, Pesanan), `harian`, `progressVersion`.
- Kandungan datang daripada Google Sheets yang diterbitkan sebagai CSV (helaian Soalan, SP, Pelajaran, Pesanan). Tingkatan selain 2 WAJIB ada Soalan + SP + Pelajaran; jika tidak, app memaparkan "sedang disediakan".
- Templat folder: `templat/tingkatan/` → `node tools/tingkatan-baru.mjs N`.
- Setiap keluaran: `node tools/terbit.mjs` (naikkan APP_VERSION + `docs/version.json` + `?v=` shell supaya banner "Versi baharu" muncul; salin `docs/panduan.html` ke setiap folder; semak semua config). Kemudian commit + push.

## Supabase (satu projek untuk semua tingkatan)
- Projek `pkuxiyabmxmksvccepra`. App guna kunci publishable sahaja. Semua akses melalui fungsi RPC `security definer` yang menyemak nama + kelas + PIN (bcrypt); RLS tanpa polisi.
- Kelas dibezakan oleh awalan nama ("2 Arif", "4 Adil"). Skop "semua kelas" tingkatan = token `T2`/`T4` (lihat `supabase/tingkatan.sql`).
- Razin menjalankan SQL sendiri di SQL Editor. Fail diberi bernombor: 1 liga, 3 urus_murid, 4 tasmik_import, 5 jawapan, 6 pesanan, 7 laporan, 8 fungsi ulasan-ai, 9 laporan_v2, 10 liga_lencana, 11 reaksi, 12 tingkatan. Fail SQL baharu: nombor seterusnya, selamat dijalankan semula (`create or replace`, `if not exists`).
- Fungsi Edge `ulasan-ai` (`supabase/functions/ulasan-ai/index.ts`): Claude API, model lalai `claude-sonnet-5-5`, structured outputs (`output_config.format` json_schema, `additionalProperties:false`). JANGAN guna `tool_choice` paksa (400 pada model 5.5). Secret `ANTHROPIC_API_KEY`; "Verify JWT with legacy secret" mesti OFF. Nama murid tidak dihantar kepada AI; guru mengesahkan setiap draf.

## Keselamatan dan privasi (murid bawah umur)
- Simpan nama + kelas sahaja. Jangan commit PIN, fail `akaun_murid_SULIT.sql`, kunci service_role atau kunci API. Jangan terbitkan helaian Murid.
- Ujian guna data rekaan sahaja (`tests/`, guru ujian PIN 999999).

## Ujian
- `cd tests && npm install && node sql12.mjs && node tingkatan.mjs` (PGlite + Playwright, Claude palsu). Lihat `tests/README.md`.
- Semak juga lebar telefon 390 px (tiada horizontal overflow) dan mod gelap untuk setiap perubahan UI.

## Keputusan UI yang telah dipersetujui
- Utama: Pesanan hari ini (reaksi emoji positif sahaja + kiraan), Misi harian (4 wajib; misi siap dicoret), kad "Ayat Hafazan Tingkatan N" dengan % hafazan.
- Cabaran = zon pilihan untuk yang sudah siap misi wajib; senarai penuh lencana + syarat di situ.
- Laporan: blok "Usaha kamu" dahulu, ringkasan lencana (lencana bahu + slot kosong) kedua.
- Guru: Peti Tasmik paling atas. Tindakan memadam mesti ada pengesahan.
- Level 1–10 (200 XP setiap level), 11–15 tahap mentor (Level 15 maks). Hafazan: TP3+ = lulus, menunggu semakan = separuh.

## Imej ayat hafazan
- Potong daripada PDF buku teks: render halaman pada 300 dpi, potong di antara jalur label dan jalur rujukan dengan margin luas (potongan pertama T2 memotong bahagian atas baris), simpan PNG dalam `docs/tN/img/ayat/`, kemudian isi `hafazan` dalam config (`id`, `surah`, `no`, `ayat`, `label`, `pel`, `ms`, `rujukan`, `img`).

## Status Tingkatan 4 (30 Okt 2026)
- `docs/t4/` live, `demo:false`, belum ada pautan Sheet dan ayat hafazan → murid nampak "sedang disediakan".
- Perlu: buku teks PI T4 (PDF) → senarai pelajaran, bidang, muka surat untuk helaian Pelajaran; ayat hafazan + imej; pautan CSV Sheet T4; nama kelas T4 ("4 X"). Murid diimport oleh guru melalui app T4 (Urus murid → Import).
- Panduan langkah demi langkah (Docs): https://claude.ai/artifact/Lu5rsXEQd5guvQWrDeE6nQ
