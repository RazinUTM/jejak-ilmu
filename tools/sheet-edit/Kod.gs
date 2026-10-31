/**
 * Jejak Ilmu · Edit soalan daripada app → Google Sheet (helaian "Soalan").
 * Pasang SEKALI dalam Google Sheet tingkatan itu (bukan Sheet lain): Extensions → Apps Script → tampal fail ini.
 * Kemudian Deploy → New deployment → Web app → Execute as: Me · Who has access: Anyone → salin URL (/exec)
 * ke js/config.js → editSoalanUrl. Langkah penuh: tools/sheet-edit/BACA-SAYA.md
 *
 * Keselamatan: setiap permintaan mesti membawa nama + PIN akaun GURU; skrip menyemaknya melalui RPC Supabase
 * semak_pin (sama seperti log masuk app). Hanya medan kandungan soalan boleh diubah (bukan id, jenis, pelajaran, sp_kod).
 * Jika nilai dalam Sheet sudah berubah sejak app memuatkannya, edit DITOLAK (tiada tindih senyap).
 * Setiap perubahan dicatat dalam helaian "Log Edit" (dicipta automatik; jangan terbitkan ke web).
 */
var SUPABASE_URL = 'https://pkuxiyabmxmksvccepra.supabase.co';
var SUPABASE_KEY = 'sb_publishable_frT2Hvd0DjIE2_no7MQB_Q_yCIJbHlg';   // kunci AWAM (publishable), sama seperti dalam app
var HELAIAN = 'Soalan';
var HELAIAN_LOG = 'Log Edit';
var MEDAN = ['soalan', 'soalan_jawi', 'arab_jawi', 'pilihan_A', 'pilihan_B', 'pilihan_C', 'pilihan_D', 'pilihan_E', 'jawapan',
  'urutan_1', 'urutan_2', 'urutan_3', 'urutan_4', 'urutan_5', 'urutan_6', 'penjelasan', 'ms', 'kbat', 'aras', 'aktif'];

function doGet() { return jawab_({ ok: true, app: 'jejak-ilmu-edit-soalan', versi: 1 }); }

function doPost(e) {
  var d;
  try { d = JSON.parse(e.postData.contents); } catch (x) { return jawab_({ ok: false, ralat: 'json' }); }
  if (!d || d.aksi !== 'edit' || !d.id) return jawab_({ ok: false, ralat: 'permintaan' });
  if (!sahGuru_(d.nama, d.kelas, d.pin)) return jawab_({ ok: false, ralat: 'pin' });
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(HELAIAN);
    if (!sh) return jawab_({ ok: false, ralat: 'helaian' });
    var data = sh.getDataRange().getDisplayValues();
    var head = data[0].map(function (h) { return String(h).trim(); });
    var cId = head.indexOf('id'); if (cId < 0) return jawab_({ ok: false, ralat: 'helaian' });
    var r = -1;
    for (var i = 1; i < data.length; i++) if (String(data[i][cId]).trim() === String(d.id).trim()) { r = i; break; }
    if (r < 0) return jawab_({ ok: false, ralat: 'tiada' });
    var asal = d.asal || {}, baru = d.baru || {};
    // Konflik: nilai yang guru nampak dalam app mesti sama dengan nilai semasa dalam Sheet.
    var konflik = [];
    Object.keys(baru).forEach(function (k) {
      if (MEDAN.indexOf(k) < 0) return; var c = head.indexOf(k);
      var kini = c < 0 ? '' : String(data[r][c]).trim();
      if (kini !== String(asal[k] == null ? '' : asal[k]).trim()) konflik.push({ medan: k, sheet: kini });
    });
    if (konflik.length) return jawab_({ ok: false, ralat: 'konflik', konflik: konflik });
    var log = [], masa = new Date();
    Object.keys(baru).forEach(function (k) {
      if (MEDAN.indexOf(k) < 0) return;
      var c = head.indexOf(k);
      if (c < 0) { c = head.length; head.push(k); sh.getRange(1, c + 1).setValue(k); }   // lajur pilihan (cth. aras) belum wujud
      var v = String(baru[k] == null ? '' : baru[k]).slice(0, 3000);
      var lama = r < data.length && c < data[r].length ? String(data[r][c]) : '';
      if (v.trim() === lama.trim()) return;
      sh.getRange(r + 1, c + 1).setValue(/^[=+\-@]/.test(v) ? "'" + v : v);   // jangan jadikan formula
      log.push([masa, d.id, k, lama, v, String(d.nama || '')]);
    });
    if (log.length) {
      var lg = ss.getSheetByName(HELAIAN_LOG);
      if (!lg) { lg = ss.insertSheet(HELAIAN_LOG); lg.appendRow(['masa', 'id', 'medan', 'lama', 'baru', 'oleh']); }
      lg.getRange(lg.getLastRow() + 1, 1, log.length, 6).setValues(log);
    }
    return jawab_({ ok: true, id: d.id, diubah: log.length });
  } finally { lock.releaseLock(); }
}

function sahGuru_(nama, kelas, pin) {
  if (!nama || !kelas || !pin) return false;
  var h = { apikey: SUPABASE_KEY }; if (/^eyJ/.test(SUPABASE_KEY)) h.Authorization = 'Bearer ' + SUPABASE_KEY;
  var res = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/rpc/semak_pin', {
    method: 'post', contentType: 'application/json', headers: h, muteHttpExceptions: true,
    payload: JSON.stringify({ p_nama: String(nama), p_kelas: String(kelas), p_pin: String(pin) })
  });
  if (res.getResponseCode() !== 200) return false;
  try { var j = JSON.parse(res.getContentText()); return !!(j && j.ok && j.guru); } catch (x) { return false; }
}

function jawab_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
