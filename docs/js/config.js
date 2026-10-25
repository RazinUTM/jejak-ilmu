// Jejak Ilmu · tetapan Fasa 1 (tiada backend). Edit fail ini sahaja.
// Pautan CSV: Google Sheets → File → Share → Publish to web → pilih HELAIAN (bukan "Entire Document") → format CSV → Publish → salin pautan.
// Kosongkan bankCsvUrl ('') untuk kembali kepada 27 soalan contoh terbina dalam (mod demo).
window.JEJAK_CONFIG = {
  bankCsvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ-9Ei6Z4GFb365FHO3bSEi8SZWuBXbICeCuz7a85kt4zGCwIi9cI86q_iOBj-GBQ/pub?gid=1565894710&single=true&output=csv',        // helaian "Soalan"   (wajib untuk mod Sheets)
  spCsvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ-9Ei6Z4GFb365FHO3bSEi8SZWuBXbICeCuz7a85kt4zGCwIi9cI86q_iOBj-GBQ/pub?gid=666182641&single=true&output=csv',          // helaian "SP"
  pelajaranCsvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ-9Ei6Z4GFb365FHO3bSEi8SZWuBXbICeCuz7a85kt4zGCwIi9cI86q_iOBj-GBQ/pub?gid=35581945&single=true&output=csv',   // helaian "Pelajaran" (status kunci/buka)
  pesananCsvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ-9Ei6Z4GFb365FHO3bSEi8SZWuBXbICeCuz7a85kt4zGCwIi9cI86q_iOBj-GBQ/pub?gid=1292877728&single=true&output=csv',     // helaian "Pesanan"   (lajur: tarikh, teks)
  harian: { mudah: 6, sederhana: 3, kbat: 1 },   // komposisi Cabaran Harian (ikut lajur aras / kbat)
  progressVersion: 1,    // NAIKKAN nombor ini (1 → 2) untuk set semula XP/kemajuan SEMUA murid pada muat semula seterusnya (log masuk kekal)
};
