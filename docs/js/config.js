// Jejak Ilmu · tetapan TINGKATAN 2. Edit fail ini sahaja; kod app ada dalam app/jejak.js (dikongsi semua tingkatan).
// Pautan CSV: Google Sheets → File → Share → Publish to web → pilih HELAIAN (bukan "Entire Document") → format CSV → Publish → salin pautan.
// Kosongkan bankCsvUrl ('') untuk kembali kepada 27 soalan contoh terbina dalam (mod demo).
window.JEJAK_CONFIG = {
  // ================= TINGKATAN INI =================
  // Kod app dikongsi (app/jejak.js); bahagian ini sahaja yang membezakan setiap tingkatan.
  id: 't2',                         // ruang nama storan telefon; JANGAN tukar selepas murid mula guna
  tingkatan: 2,
  subjek: 'Pendidikan Islam',
  tajuk: 'Pendidikan Islam Tingkatan 2 (KSSM)',
  kelasAwalan: '2 ',                // hanya kelas yang bermula dengan teks ini dipaparkan (Supabase dikongsi semua tingkatan)
  asas: '',                         // laluan ke fail bersama: '' di akar, '../' dalam folder tingkatan (cth t4/)
  guruNama: 'Ustazah Nafisah',
  // Ayat hafazan buku teks (imej dalam img/ayat/). no = nombor surah, ayat = nombor ayat, pel = pelajaran.
  hafazan: [
    { id: '3-8',  surah: 'Ali Imran', no: 3, ayat: 8,  label: '8',  pel: 1, ms: 'm.s. 2–3',  rujukan: 'Surah Ali Imran 3:8',  img: 'img/ayat/ali-imran-3-8.png?v=2' },
    { id: '3-18', surah: 'Ali Imran', no: 3, ayat: 18, label: '18', pel: 2, ms: 'm.s. 5–6',  rujukan: 'Surah Ali Imran 3:18', img: 'img/ayat/ali-imran-3-18.png?v=2' },
    { id: '3-26', surah: 'Ali Imran', no: 3, ayat: 26, label: '26', pel: 3, ms: 'm.s. 9–12', rujukan: 'Surah Ali Imran 3:26', img: 'img/ayat/ali-imran-3-26.png?v=2' },
    { id: '3-27', surah: 'Ali Imran', no: 3, ayat: 27, label: '27', pel: 3, ms: 'm.s. 9–12', rujukan: 'Surah Ali Imran 3:27', img: 'img/ayat/ali-imran-3-27.png?v=2' },
  ],

  // ================= SAMBUNGAN =================
  // Supabase (liga kelas + akaun). Kunci ini AWAM (publishable) dan selamat di pelayar; JANGAN letak secret/service_role di sini.
  supabaseUrl: 'https://pkuxiyabmxmksvccepra.supabase.co',
  supabaseKey: 'sb_publishable_frT2Hvd0DjIE2_no7MQB_Q_yCIJbHlg',
  bankCsvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ-9Ei6Z4GFb365FHO3bSEi8SZWuBXbICeCuz7a85kt4zGCwIi9cI86q_iOBj-GBQ/pub?gid=1565894710&single=true&output=csv',        // helaian "Soalan"   (wajib untuk mod Sheets)
  spCsvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ-9Ei6Z4GFb365FHO3bSEi8SZWuBXbICeCuz7a85kt4zGCwIi9cI86q_iOBj-GBQ/pub?gid=666182641&single=true&output=csv',          // helaian "SP"
  pelajaranCsvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ-9Ei6Z4GFb365FHO3bSEi8SZWuBXbICeCuz7a85kt4zGCwIi9cI86q_iOBj-GBQ/pub?gid=35581945&single=true&output=csv',   // helaian "Pelajaran" (status kunci/buka)
  pesananCsvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ-9Ei6Z4GFb365FHO3bSEi8SZWuBXbICeCuz7a85kt4zGCwIi9cI86q_iOBj-GBQ/pub?gid=1292877728&single=true&output=csv',     // helaian "Pesanan"   (lajur: tarikh, teks)
  hafazanCsvUrl: '',     // pilihan: helaian "Hafazan" (lajur: tarikh, ayat, rujukan, maksud) — baris terkini bertarikh <= hari ini dipaparkan
  ulasanCsvUrl: '',      // pilihan: helaian "Ulasan" (lajur: nama, kelas, teks, tarikh) — nama kosong = ulasan untuk seluruh kelas
  ai: true,             // butang draf AI (Ulasan Ustazah + refleksi laporan). Perlu fungsi Supabase 'ulasan-ai'; tukar ke false untuk sembunyikan
  harian: { mudah: 3, sederhana: 1, kbat: 1 },   // komposisi Cabaran Harian = 5 soalan (ikut lajur aras / kbat); ubah nombor untuk tukar jumlah
  progressVersion: 2,    // NAIKKAN nombor ini (1 → 2) untuk set semula XP/kemajuan SEMUA murid pada muat semula seterusnya (log masuk kekal)
};
