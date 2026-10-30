// Cipta folder tingkatan baharu daripada templat/tingkatan.
//   node tools/tingkatan-baru.mjs 4          → docs/t4/ (URL: .../jejak-ilmu/t4/)
// Selepas itu: isi docs/t4/js/config.js (pautan CSV Sheet, ayat hafazan), kemudian `node tools/terbit.mjs`.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const n = +process.argv[2];
if (!Number.isInteger(n) || n < 1 || n > 6) { console.error('Guna: node tools/tingkatan-baru.mjs <1-6>'); process.exit(1); }
if (n === 2) { console.error('Tingkatan 2 sudah berada di akar docs/ (URL asal). Tiada folder t2 dicipta.'); process.exit(1); }
const dest = join(ROOT, 'docs', 't' + n);
if (existsSync(dest)) { console.error(`${dest} sudah wujud. Padam dahulu jika mahu cipta semula.`); process.exit(1); }

const v = (readFileSync(join(ROOT, 'docs/app/jejak.js'), 'utf8').match(/const APP_VERSION='([^']+)'/) || [])[1] || '1';
const src = join(ROOT, 'templat', 'tingkatan');
(function salin(a, b) {
  mkdirSync(b, { recursive: true });
  for (const f of readdirSync(a)) {
    const pa = join(a, f), pb = join(b, f);
    if (statSync(pa).isDirectory()) { salin(pa, pb); continue; }
    if (/\.(html|js|webmanifest|txt|json)$/.test(f)) writeFileSync(pb, readFileSync(pa, 'utf8').replaceAll('{{N}}', String(n)).replaceAll('{{V}}', v));
    else copyFileSync(pa, pb);
  }
})(src, dest);
copyFileSync(join(ROOT, 'docs', 'panduan.html'), join(dest, 'panduan.html'));   // panduan murid dikongsi; teks ikut config folder
console.log(`Siap: docs/t${n}/  →  https://razinutm.github.io/jejak-ilmu/t${n}/`);
console.log(`Seterusnya: isi docs/t${n}/js/config.js, letak imej ayat dalam docs/t${n}/img/ayat/, kemudian: node tools/terbit.mjs`);
