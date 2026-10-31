// Sediakan keluaran baharu untuk SEMUA tingkatan sekaligus, sebelum git commit/push.
//   node tools/terbit.mjs            → versi automatik (tarikh hari ini + huruf), HANYA jika kod dikongsi berubah
//   node tools/terbit.mjs 2026-11-02a   → versi ini (dipaksa)
//   node tools/terbit.mjs --paksa       → naikkan versi walaupun kod dikongsi tidak berubah
// 1. Naikkan APP_VERSION (app/jejak.js), docs/version.json dan ?v= dalam setiap index.html → telefon murid SEMUA tingkatan nampak banner "Versi baharu".
//    Perubahan config/imej/Sheet satu tingkatan sahaja TIDAK menaikkan versi: banner tidak dipaparkan kepada tingkatan lain tanpa sebab.
// 2. Salin docs/panduan.html ke setiap folder tingkatan (satu sumber; teks ikut config folder itu).
// 3. Semak setiap js/config.js: id unik, medan wajib, imej ayat hafazan wujud.
import { readFileSync, writeFileSync, existsSync, readdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); const DOCS = join(ROOT, 'docs');
const JS = join(DOCS, 'app/jejak.js');
const lama = (readFileSync(JS, 'utf8').match(/const APP_VERSION='([^']+)'/) || [])[1];
const hari = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);   // waktu Malaysia
const arg = process.argv.slice(2), paksa = arg.includes('--paksa');
let v = arg.find(x => !x.startsWith('--'));
// Cap jari kod dikongsi (baris APP_VERSION diabaikan). Sama seperti keluaran lalu = tiada sebab untuk banner "Versi baharu".
const KONGSI = ['app/jejak.js', 'app/jejak.css', 'js/laporan-pdf.js', ...readdirSync(join(DOCS, 'js/vendor')).sort().map(f => 'js/vendor/' + f)];
const kod = createHash('sha256').update(KONGSI.map(f => readFileSync(join(DOCS, f), 'utf8').replace(/const APP_VERSION='[^']+'/, '')).join('\u0000')).digest('hex').slice(0, 16);
let vj = {}; try { vj = JSON.parse(readFileSync(join(DOCS, 'version.json'), 'utf8')); } catch (e) {}
const naik = paksa || !!v || (vj.kod ? vj.kod !== kod : false);
if (!naik) v = lama;
else if (!v) { const h = lama && lama.startsWith(hari) ? lama.slice(10) : ''; v = hari + (h ? String.fromCharCode(h.charCodeAt(0) + 1) : 'a'); }
if (!/^[\w.-]{4,24}$/.test(v)) { console.error('Versi tidak sah:', v); process.exit(1); }

const folder = ['', ...readdirSync(DOCS, { withFileTypes: true }).filter(d => d.isDirectory() && /^t\d$/.test(d.name)).map(d => d.name)];
const masalah = []; const ids = new Map();
for (const f of folder) {
  const dir = join(DOCS, f), nama = f || '(akar, Tingkatan 2)';
  const cfgPath = join(dir, 'js/config.js');
  if (!existsSync(cfgPath)) { masalah.push(`${nama}: tiada js/config.js`); continue; }
  const ctx = { window: {} }; try { vm.runInNewContext(readFileSync(cfgPath, 'utf8'), ctx); } catch (e) { masalah.push(`${nama}: js/config.js ralat sintaks: ${e.message}`); continue; }
  const C = ctx.window.JEJAK_CONFIG || {};
  const id = C.id || 't' + (C.tingkatan || 2);
  if (ids.has(id)) masalah.push(`${nama}: id '${id}' sama dengan ${ids.get(id)} (storan telefon akan bercampur)`); ids.set(id, nama);
  if (f && C.asas !== '../') masalah.push(`${nama}: asas mesti '../'`);
  if (f && +C.tingkatan !== +f.slice(1)) masalah.push(`${nama}: tingkatan (${C.tingkatan}) tidak sepadan dengan nama folder`);
  if (f && C.kelasAwalan !== f.slice(1) + ' ') masalah.push(`${nama}: kelasAwalan sepatutnya '${f.slice(1)} '`);
  for (const h of C.hafazan || []) { const p = String(h.img || '').split('?')[0]; if (p && !existsSync(join(dir, p))) masalah.push(`${nama}: imej ayat tiada: ${p}`); if (!h.id || !h.rujukan) masalah.push(`${nama}: ayat hafazan perlu id dan rujukan`); }
  const kurang = ['bankCsvUrl', ...(f ? ['spCsvUrl', 'pelajaranCsvUrl'] : [])].filter(k => !C[k]);
  console.log(`${nama.padEnd(22)} T${C.tingkatan}  ${(C.hafazan || []).length} ayat hafazan  ${kurang.length ? 'BELUM SEDIA (' + kurang.join(', ') + ' kosong; murid nampak "sedang disediakan")' : 'Sheet disambung'}`);
  // versi dalam shell
  const idx = join(dir, 'index.html'); if (existsSync(idx)) writeFileSync(idx, readFileSync(idx, 'utf8').replace(/(app\/jejak\.(?:css|js)\?v=)[\w.-]+/g, '$1' + v));
  if (f) copyFileSync(join(DOCS, 'panduan.html'), join(dir, 'panduan.html'));
}
writeFileSync(JS, readFileSync(JS, 'utf8').replace(/const APP_VERSION='[^']+'/, `const APP_VERSION='${v}'`));
writeFileSync(join(DOCS, 'version.json'), JSON.stringify({ v, kod }) + '\n');
console.log(naik ? `\nVersi: ${lama} → ${v} (kod dikongsi berubah: banner "Versi baharu" untuk SEMUA tingkatan)`
  : `\nVersi kekal ${v}: kod dikongsi tidak berubah${vj.kod ? '' : ' (cap jari kod direkod buat kali pertama)'}, jadi tiada banner. Guna --paksa jika perlu.`);
if (masalah.length) { console.log('\nPERLU DIBETULKAN:\n- ' + masalah.join('\n- ')); process.exit(2); }
console.log('Semua semakan lulus. Seterusnya: git add -A && git commit && git push');
