# Jejak Ilmu

Aplikasi e-pembelajaran Pendidikan Islam Tingkatan 2 (KSSM) untuk kelas Ustazah Nafisah. Phone-first, boleh dibuka di laptop.

**Aplikasi (GitHub Pages):** https://razinutm.github.io/jejak-ilmu/

## Fasa 1 — sekarang (tiada backend)

Semua kandungan datang daripada **Google Sheets**; kemajuan murid disimpan dalam telefon masing-masing (localStorage). Tiada PIN; murid pilih kelas dan taip nama.

```
Google Sheets ──"Terbitkan ke web" (CSV)──► docs/index.html (GitHub Pages) ──► telefon murid (localStorage)
```

- `docs/index.html` — aplikasi. Memuat `docs/js/config.js` untuk pautan CSV helaian **Soalan**, **SP**, **Pelajaran**, **Pesanan**.
- `templates/bank_soalan_template.xlsx` — muat naik ke Google Sheets. 27 soalan contoh sudah diisi; helaian **Panduan** menerangkan setiap lajur.
- Kalau `bankCsvUrl` kosong, aplikasi guna 27 soalan contoh terbina dalam (mod demo dengan PIN).

Mengemas kini kandungan: edit Sheets → tunggu ±5 minit (Google menerbit semula CSV) → murid muat semula aplikasi. Feature yang ditanda *pratonton* / *Fasa 2* (liga, Misi Kelas, papan guru, hantar tasmik, pesanan suara) menunjukkan data contoh.

## Fasa 2 — Supabase (bila sedia)

Lihat `PANDUAN-SUPABASE.pdf` (langkah demi langkah) dan folder `supabase/`, `tools/`. Ringkasnya: schema + RLS → import bank → cipta akaun murid (nama, kelas, PIN 4 digit dari helaian Murid) → `docs/js/config.js` ditambah kunci Supabase → aplikasi mula menyimpan `percubaan` setiap murid dan papan guru jadi hidup.

| Path | Fungsi |
|---|---|
| `supabase/schema.sql`, `supabase/policies.sql` | Jadual, view (`penguasaan`, `usaha_bulan`, `xp_jumlah`), RLS, polisi storan |
| `tools/import_bank.mjs` | CSV Sheets → Supabase (`--dry` untuk semak sahaja) |
| `tools/cipta_murid.mjs` | Cipta/kemas kini akaun murid dari helaian Murid (PIN 4 digit + akhiran tetap) |
| `tools/liga.mjs` | Liga mingguan (naik 3 / turun 2, kumpulan 10) |
| `.github/workflows/` | `sync-bank.yml` (setiap malam), `liga.yml` (Isnin pagi) — perlukan secrets Supabase |
| `docs/js/api.js`, `docs/js/recorder.js` | Lapisan data dan perakam untuk port Fasa 2 |

## Dasar data

Hanya nama dan kelas murid disimpan. Tiada nombor telefon, alamat atau tarikh lahir. XP diberi untuk usaha (betul +10, salah +3); peperiksaan sebenar tetap bertulis di luar aplikasi.
