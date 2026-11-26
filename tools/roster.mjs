// Jana docs/js/roster.js daripada helaian Murid (CSV): nama, kelas, pin_4_digit, catatan.
//   node roster.mjs --csv murid.csv [--guru "Ustazah Nafisah:482913"] [--out ../docs/js/roster.js]
// Fail ini AWAM (GitHub Pages): ia hanya mengandungi nama + kelas, TANPA hash PIN. PIN disemak oleh Supabase
// (semak_pin, dengan had cubaan). Hash PIN dalam fail awam boleh diteka di luar talian dalam beberapa minit,
// jadi jangan tambah semula. Lajur PIN dalam CSV hanya disemak formatnya di sini.
import { parse } from 'csv-parse/sync';
import { readFileSync, writeFileSync } from 'node:fs';
const arg = k => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : null; };
const csv = arg('--csv'); if (!csv) { console.error('Guna: node roster.mjs --csv murid.csv [--guru "Nama:PIN"]'); process.exit(1); }
const out = arg('--out') || new URL('../docs/js/roster.js', import.meta.url).pathname;
const rows = parse(readFileSync(csv, 'utf8'), { columns: true, skip_empty_lines: true, bom: true, trim: true });
const murid = [];
for (const r of rows) {
  const pin = (r.pin_4_digit || r.pin || '').trim(), nama = (r.nama || '').trim(), kelas = (r.kelas || '').trim();
  if (!nama || !kelas || !/^\d{4,8}$/.test(pin)) { console.log(`langkau: ${nama || '?'} (${kelas || '?'}) — perlu nama, kelas, PIN 4–8 digit`); continue; }
  murid.push({ n: nama, k: kelas, g: /guru/i.test(r.catatan || '') });
}
for (const g of process.argv.filter((a, i, arr) => arr[i - 1] === '--guru')) { const [nama, pin] = g.split(':'); if (nama && /^\d{4,8}$/.test(pin || '')) murid.push({ n: nama.trim(), k: 'Guru', g: true }); }
const seen = new Map(); for (const m of murid) { const key = m.k + '|' + m.n; if (seen.has(key)) console.log(`amaran: nama berulang dalam kelas yang sama: ${m.n} (${m.k})`); seen.set(key, 1); }
writeFileSync(out, `// Dijana oleh tools/roster.mjs pada ${new Date().toISOString()}. Jangan edit tangan; jana semula daripada helaian Murid.\nwindow.JEJAK_ROSTER=${JSON.stringify({ murid })};\n`);
console.log(`roster.js: ${murid.length} akaun (${murid.filter(m => m.g).length} guru) → ${out}`);
