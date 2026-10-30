// Jejak Ilmu · tetapan TINGKATAN 4. Edit fail ini sahaja; kod app ada dalam ../app/jejak.js (dikongsi semua tingkatan).
// Pautan CSV: Google Sheets → File → Share → Publish to web → pilih HELAIAN (bukan "Entire Document") → format CSV → Publish → salin pautan.
// Selagi bankCsvUrl, spCsvUrl dan pelajaranCsvUrl kosong, murid nampak skrin "sedang disediakan" (demo: false).
window.JEJAK_CONFIG = {
  // ================= TINGKATAN INI =================
  id: 't4',                     // ruang nama storan telefon; JANGAN tukar selepas murid mula guna
  tingkatan: 4,
  subjek: 'Pendidikan Islam',
  tajuk: 'Pendidikan Islam Tingkatan 4 (KSSM)',
  kelasAwalan: '4 ',            // hanya kelas yang bermula dengan "4 " dipaparkan, cth. "4 Adil" (Supabase dikongsi semua tingkatan)
  asas: '../',                      // fail bersama (app/, img/, js/vendor/) berada satu tingkat di atas folder ini
  guruNama: 'Ustazah Nafisah',
  demo: false,                      // jangan papar soalan contoh Tingkatan 2 semasa Sheet belum disambung
  // Ayat hafazan buku teks. Letak imej dalam img/ayat/ folder ini. Kosongkan senarai ([]) jika tiada ayat hafazan.
  // no = nombor surah, ayat = nombor ayat, pel = nombor pelajaran yang mengajar ayat ini, ms = muka surat buku teks.
  hafazan: [
    // { id: '2-255', surah: 'Al-Baqarah', no: 2, ayat: 255, label: '255', pel: 1, ms: 'm.s. 2–4', rujukan: 'Surah Al-Baqarah 2:255', img: 'img/ayat/al-baqarah-2-255.png' },
  ],

  // ================= SAMBUNGAN =================
  // Supabase SAMA untuk semua tingkatan. Kunci ini AWAM (publishable); JANGAN letak secret/service_role di sini.
  supabaseUrl: 'https://pkuxiyabmxmksvccepra.supabase.co',
  supabaseKey: 'sb_publishable_frT2Hvd0DjIE2_no7MQB_Q_yCIJbHlg',
  bankCsvUrl: '',        // helaian "Soalan"    (wajib)
  spCsvUrl: '',          // helaian "SP"        (wajib untuk tingkatan selain 2)
  pelajaranCsvUrl: '',   // helaian "Pelajaran" (wajib untuk tingkatan selain 2: senarai pelajaran, bidang, muka surat, status kunci/buka)
  pesananCsvUrl: '',     // pilihan: helaian "Pesanan" (lajur: tarikh, teks)
  hafazanCsvUrl: '',     // pilihan: helaian "Hafazan" (lajur: tarikh, ayat, rujukan, maksud)
  ulasanCsvUrl: '',      // pilihan: helaian "Ulasan" (lajur: nama, kelas, teks, tarikh)
  ai: true,              // butang draf AI (Ulasan Ustazah + refleksi laporan); fungsi Supabase 'ulasan-ai' dikongsi
  harian: { mudah: 3, sederhana: 1, kbat: 1 },   // komposisi Cabaran Harian
  progressVersion: 1,    // NAIKKAN nombor ini untuk set semula XP/kemajuan SEMUA murid tingkatan ini pada muat semula seterusnya
};
