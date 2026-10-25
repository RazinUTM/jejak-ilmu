// Jejak Ilmu · tetapan Fasa 1 (tiada backend). Edit fail ini sahaja.
// Pautan CSV: Google Sheets → File → Share → Publish to web → pilih HELAIAN (bukan "Entire Document") → format CSV → Publish → salin pautan.
// Kosongkan bankCsvUrl ('') untuk kembali kepada 27 soalan contoh terbina dalam (mod demo).
window.JEJAK_CONFIG = {
  bankCsvUrl: '',        // helaian "Soalan"   (wajib untuk mod Sheets)
  spCsvUrl: '',          // helaian "SP"
  pelajaranCsvUrl: '',   // helaian "Pelajaran" (status kunci/buka)
  pesananCsvUrl: '',     // helaian "Pesanan"   (lajur: tarikh, teks)
  harian: { mudah: 6, sederhana: 3, kbat: 1 },   // komposisi Cabaran Harian (ikut lajur aras / kbat)
  progressVersion: 1,    // NAIKKAN nombor ini (1 → 2) untuk set semula XP/kemajuan SEMUA murid pada muat semula seterusnya (log masuk kekal)
};
