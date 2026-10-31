// Jejak Ilmu · tetapan TINGKATAN 4. Edit fail ini sahaja; kod app ada dalam ../app/jejak.js (dikongsi semua tingkatan).
// Pautan CSV: Google Sheets → File → Share → Publish to web → pilih HELAIAN (bukan "Entire Document") → format CSV → Publish → salin pautan.
// Sheet T4 disambung 31 Okt 2026 (Pelajaran, SP, Soalan, Pesanan).
window.JEJAK_CONFIG = {
  // ================= TINGKATAN INI =================
  id: 't4',                     // ruang nama storan telefon; JANGAN tukar selepas murid mula guna
  tingkatan: 4,
  subjek: 'Pendidikan Islam',
  tajuk: 'Pendidikan Islam Tingkatan 4 (KSSM)',
  kelasAwalan: '4 ',            // hanya kelas yang bermula dengan "4 " dipaparkan, cth. "4 Adil" (Supabase dikongsi semua tingkatan)
  asas: '../',                      // fail bersama (app/, img/, js/vendor/) berada satu tingkat di atas folder ini
  guruNama: 'Ustazah Nafisah',
  tema: 'pink',                     // warna app: 'pink' = pink lembut + emas (bezakan daripada T2 ungu). Kosongkan ('') untuk ungu asal.
  demo: false,                      // jangan papar soalan contoh Tingkatan 2 semasa Sheet belum disambung
  // Ayat hafazan buku teks T4 (bidang al-Quran: "Bacaan dan Hafazan", SP 1.26.3 dan 1.27.3). Imej dipotong daripada buku teks (300 dpi) dalam img/ayat/.
  // Setiap entri = satu petikan hafazan seperti dalam buku (bukan satu ayat): no = nombor surah, ayat = ayat PERTAMA petikan,
  // label = julat ayat yang dipaparkan, pel = pelajaran, ms = muka surat buku teks. Pelajaran 4–7 ialah ayat kefahaman, bukan hafazan.
  hafazan: [
    { id: '6-162',  surah: "al-An'am", no: 6,  ayat: 162, label: '162–163', pel: 1, ms: 'm.s. 2–6',   rujukan: "Surah al-An'am 6:162–163", img: 'img/ayat/al-anam-6-162-163.png' },
    { id: '18-101', surah: 'al-Kahfi', no: 18, ayat: 101, label: '101–106', pel: 2, ms: 'm.s. 7–12',  rujukan: 'Surah al-Kahfi 18:101–106', img: 'img/ayat/al-kahfi-18-101-106.png' },
    { id: '18-107', surah: 'al-Kahfi', no: 18, ayat: 107, label: '107–110', pel: 2, ms: 'm.s. 13–16', rujukan: 'Surah al-Kahfi 18:107–110', img: 'img/ayat/al-kahfi-18-107-110.png' },
    // Pilihan: Ali Imran 137–139 (Pelajaran 5). Buku melabel QR-nya "bacaan ayat hafazan" tetapi tab sisi dan SP 1.30.x menyatakan "Bacaan dan Kefahaman"
    // (tiada SP hafaz). Imej sudah disediakan; buang // di bawah jika Ustazah mahu ia dihafaz juga.
    // { id: '3-137', surah: 'Ali Imran', no: 3, ayat: 137, label: '137–139', pel: 5, ms: 'm.s. 29–36', rujukan: 'Surah Ali Imran 3:137–139', img: 'img/ayat/ali-imran-3-137-139.png' },
  ],
  hafazanLencana: "Hafiz al-An'am & al-Kahfi",   // nama lencana apabila semua petikan lulus (lalai: "Hafiz Tingkatan 4")

  // ================= SAMBUNGAN =================
  // Supabase SAMA untuk semua tingkatan. Kunci ini AWAM (publishable); JANGAN letak secret/service_role di sini.
  supabaseUrl: 'https://pkuxiyabmxmksvccepra.supabase.co',
  supabaseKey: 'sb_publishable_frT2Hvd0DjIE2_no7MQB_Q_yCIJbHlg',
  bankCsvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSWrx4_qAYV6uQF_5tpRJnxHHkjSEM6YdxMuAr-14NQnrqzIpR_oJPSlrZCh7kUNxHsq0jJRlCBRz0Z/pub?gid=1565894710&single=true&output=csv',        // helaian "Soalan"    (wajib)
  spCsvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSWrx4_qAYV6uQF_5tpRJnxHHkjSEM6YdxMuAr-14NQnrqzIpR_oJPSlrZCh7kUNxHsq0jJRlCBRz0Z/pub?gid=666182641&single=true&output=csv',          // helaian "SP"        (wajib untuk tingkatan selain 2)
  pelajaranCsvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSWrx4_qAYV6uQF_5tpRJnxHHkjSEM6YdxMuAr-14NQnrqzIpR_oJPSlrZCh7kUNxHsq0jJRlCBRz0Z/pub?gid=35581945&single=true&output=csv',   // helaian "Pelajaran" (wajib untuk tingkatan selain 2: senarai pelajaran, bidang, muka surat, status kunci/buka)
  pesananCsvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSWrx4_qAYV6uQF_5tpRJnxHHkjSEM6YdxMuAr-14NQnrqzIpR_oJPSlrZCh7kUNxHsq0jJRlCBRz0Z/pub?gid=1292877728&single=true&output=csv',     // pilihan: helaian "Pesanan" (lajur: tarikh, teks)
  hafazanCsvUrl: '',     // pilihan: helaian "Hafazan" (lajur: tarikh, ayat, rujukan, maksud)
  ulasanCsvUrl: '',      // pilihan: helaian "Ulasan" (lajur: nama, kelas, teks, tarikh)
  ai: true,              // butang draf AI (Ulasan Ustazah + refleksi laporan); fungsi Supabase 'ulasan-ai' dikongsi
  harian: { mudah: 3, sederhana: 1, kbat: 1 },   // komposisi Cabaran Harian
  progressVersion: 1,    // NAIKKAN nombor ini untuk set semula XP/kemajuan SEMUA murid tingkatan ini pada muat semula seterusnya
};
