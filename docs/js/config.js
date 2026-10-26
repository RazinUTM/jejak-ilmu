// Jejak Ilmu · tetapan Fasa 1 (tiada backend). Edit fail ini sahaja.
// Pautan CSV: Google Sheets → File → Share → Publish to web → pilih HELAIAN (bukan "Entire Document") → format CSV → Publish → salin pautan.
// Kosongkan bankCsvUrl ('') untuk kembali kepada 27 soalan contoh terbina dalam (mod demo).
window.JEJAK_CONFIG = {
  // Supabase (liga kelas + akaun). Kunci ini AWAM (publishable) dan selamat di pelayar; JANGAN letak secret/service_role di sini.
  supabaseUrl: 'https://pkuxiyabmxmksvccepra.supabase.co',
  supabaseKey: 'sb_publishable_frT2Hvd0DjIE2_no7MQB_Q_yCIJbHlg',
  bankCsvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ-9Ei6Z4GFb365FHO3bSEi8SZWuBXbICeCuz7a85kt4zGCwIi9cI86q_iOBj-GBQ/pub?gid=1565894710&single=true&output=csv',        // helaian "Soalan"   (wajib untuk mod Sheets)
  spCsvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ-9Ei6Z4GFb365FHO3bSEi8SZWuBXbICeCuz7a85kt4zGCwIi9cI86q_iOBj-GBQ/pub?gid=666182641&single=true&output=csv',          // helaian "SP"
  pelajaranCsvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ-9Ei6Z4GFb365FHO3bSEi8SZWuBXbICeCuz7a85kt4zGCwIi9cI86q_iOBj-GBQ/pub?gid=35581945&single=true&output=csv',   // helaian "Pelajaran" (status kunci/buka)
  pesananCsvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ-9Ei6Z4GFb365FHO3bSEi8SZWuBXbICeCuz7a85kt4zGCwIi9cI86q_iOBj-GBQ/pub?gid=1292877728&single=true&output=csv',     // helaian "Pesanan"   (lajur: tarikh, teks)
  hafazanCsvUrl: '',     // pilihan: helaian "Hafazan" (lajur: tarikh, ayat, rujukan, maksud) — baris terkini bertarikh <= hari ini dipaparkan
  ulasanCsvUrl: '',      // pilihan: helaian "Ulasan" (lajur: nama, kelas, teks, tarikh) — nama kosong = ulasan untuk seluruh kelas
  harian: { mudah: 3, sederhana: 1, kbat: 1 },   // komposisi Cabaran Harian = 5 soalan (ikut lajur aras / kbat); ubah nombor untuk tukar jumlah
  progressVersion: 2,    // NAIKKAN nombor ini (1 → 2) untuk set semula XP/kemajuan SEMUA murid pada muat semula seterusnya (log masuk kekal)
};
