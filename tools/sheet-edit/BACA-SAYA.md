# Edit soalan dari app terus ke Google Sheet (Apps Script)

> **Status (31 Okt 2026): TIDAK digunakan untuk T4.** Sheet T4 dimiliki akaun DELIMa (@moe-dl.edu.my); domain itu menyekat
> Web App walaupun "Who has access: Anyone" dipilih (pelayar tanpa log masuk dapat "You need access"). App kini guna
> "Edit dalam Sheet" (`sheetUrl` dalam config). Skrip ini hanya berfungsi jika Sheet dimiliki akaun Gmail biasa.

Ciri **Guru → Semak & betulkan soalan** boleh digunakan tanpa langkah ini (semak sahaja). Untuk butang
**Simpan ke Sheet** berfungsi, pasang skrip ini **sekali** dalam Google Sheet tingkatan itu (T4 = Sheet T4).

## Langkah (±10 minit, di laptop)

1. Buka **Google Sheet T4** (yang ada helaian Soalan, SP, Pelajaran, Pesanan).
2. Menu **Extensions → Apps Script**. Tab baharu terbuka dengan fail `Code.gs`.
3. Padam semua isi `Code.gs`, tampal isi fail [`Kod.gs`](Kod.gs) ini, tekan **Save** (ikon cakera).
4. Kanan atas: **Deploy → New deployment**.
   - Ikon gear di sebelah "Select type" → **Web app**.
   - Description: `Jejak Ilmu edit soalan`
   - **Execute as: Me** (akaun anda)
   - **Who has access: Anyone**
   - Tekan **Deploy**.
5. Google minta kebenaran: **Authorize access** → pilih akaun → jika keluar "Google hasn't verified this app":
   **Advanced → Go to (nama projek) (unsafe)** → **Allow**. (Ini skrip anda sendiri; amaran itu biasa untuk skrip peribadi.)
6. Salin **Web app URL** (berakhir dengan `/exec`). Hantar kepada Claude, atau tampal dalam
   `docs/t4/js/config.js` → `editSoalanUrl: '...'`, kemudian `node tools/terbit.mjs` dan push.
7. Uji: buka URL itu dalam pelayar → sepatutnya nampak `{"ok":true,"app":"jejak-ilmu-edit-soalan",...}`.

## Cara ia berfungsi

- App menghantar edit + nama + PIN guru ke skrip. Skrip menyemak PIN melalui Supabase (`semak_pin`, sama seperti log masuk).
  Akaun murid atau PIN salah ditolak.
- Hanya kandungan soalan boleh diubah (soalan, pilihan, jawapan, urutan, penjelasan, m.s., aras, kbat, aktif).
  `id`, `jenis`, `pelajaran`, `sp_kod` hanya diubah dalam Sheet.
- Jika baris itu sudah diubah dalam Sheet selepas app dimuat, edit **ditolak** (tiada tindih senyap); muat semula app dan edit semula.
- Setiap perubahan dicatat dalam helaian **Log Edit** (masa, id, medan, lama, baru). Jangan terbitkan helaian ini ke web.
- Murid nampak pembetulan selepas Google menerbit semula CSV (±5 minit) dan mereka muat semula app.
  Telefon guru nampak serta-merta.

## Jika kod skrip dikemas kini kemudian

Tampal kod baharu → Save → **Deploy → Manage deployments → ✎ (Edit) → Version: New version → Deploy**.
URL kekal sama; tidak perlu ubah config.

## Nota

- Jika akaun Google ialah akaun organisasi (cth. e-mel institusi), pentadbir mungkin menyekat pilihan "Anyone".
  Gunakan akaun Gmail peribadi yang memiliki Sheet itu.
- Kunci Supabase dalam skrip ialah kunci **awam** (publishable), sama seperti dalam app. Jangan letak kunci service_role.
