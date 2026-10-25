// Import the question bank from the Google Sheet (CSV export) into Supabase.
//   node import_bank.mjs --csv bank.csv            (File → Download → CSV of sheet "Soalan")
//   node import_bank.mjs --url "$BANK_CSV_URL"     (File → Share → Publish to web → sheet "Soalan" → CSV link)
// Optional: --sp sp.csv --pelajaran pelajaran.csv to sync those sheets too (same two input modes).
//           --dry  = validate and report only, write nothing (safe to run anytime).
// Rows that fail validation are reported and skipped; valid rows are upserted by id.
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'node:fs';
import { sb } from './_client.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true] : []).filter(Boolean));
async function loadCsv(src) {
  const text = /^https?:/.test(src) ? await (await fetch(src)).text() : readFileSync(src, 'utf8');
  return parse(text, { columns: true, skip_empty_lines: true, bom: true, trim: true });
}
const JENIS = ['mcq', 'tf', 'order', 'tajwid', 'fill', 'jawi'];
const LETTER = { A: 0, B: 1, C: 2, D: 3, E: 4 };

function rowToSoalan(r, spSet) {
  const err = [];
  const id = (r.id || '').trim(); if (!id) err.push('id kosong');
  const jenis = (r.jenis || '').trim().toLowerCase(); if (!JENIS.includes(jenis)) err.push(`jenis "${r.jenis}" tidak sah`);
  const pelajaran = Number(r.pelajaran); if (!(pelajaran >= 0 && pelajaran <= 28)) err.push('pelajaran bukan 0–28');
  const sp = (r.sp_kod || '').trim(); if (spSet && !spSet.has(sp)) err.push(`sp_kod "${sp}" tiada dalam helaian SP`);
  const pil = ['A', 'B', 'C', 'D', 'E'].map(L => (r['pilihan_' + L] || '').trim()).filter(Boolean);
  const urutan = [1, 2, 3, 4, 5, 6].map(k => (r['urutan_' + k] || '').trim()).filter(Boolean);
  let jawapan = null;
  if (jenis === 'order') { if (urutan.length < 3) err.push('order perlukan ≥3 urutan'); }
  else {
    const L = (r.jawapan || '').trim().toUpperCase(); jawapan = LETTER[L];
    if (jawapan === undefined) err.push('jawapan mesti A–E');
    if (jenis === 'tajwid') { if (jawapan > 4) err.push('tajwid: jawapan A–E sahaja'); }
    else if (jawapan >= pil.length) err.push(`jawapan ${L} menunjuk pilihan kosong`);
    if (jenis !== 'tajwid' && pil.length < 2) err.push('perlukan ≥2 pilihan');
  }
  if (['tajwid', 'fill', 'jawi'].includes(jenis) && !(r.arab_jawi || '').trim()) err.push('arab_jawi kosong');
  return { err, row: {
    id, pelajaran_n: pelajaran || null, sp_kod: sp, jenis,
    soalan: r.soalan || null, soalan_jawi: r.soalan_jawi || null, arab_jawi: r.arab_jawi || null,
    pilihan: jenis === 'order' || jenis === 'tajwid' ? null : pil, jawapan, urutan: jenis === 'order' ? urutan : null,
    penjelasan: r.penjelasan || null, ms: r.ms ? Number(r.ms) : null,
    kbat: /^y/i.test(r.kbat || '') || /kbat/i.test(r.aras || ''), aras: /kbat/i.test(r.aras || '') || /^y/i.test(r.kbat || '') ? 'kbat' : /sederhana/i.test(r.aras || '') ? 'sederhana' : 'mudah', aktif: !/^n/i.test(r.aktif || 'Y'), updated_at: new Date().toISOString(),
  } };
}

async function main() {
  if (args.pelajaran && !args.dry) {
    const rows = (await loadCsv(args.pelajaran)).map(r => ({ n: Number(r.n), bidang: r.bidang, rumi: r.rumi, jawi: r.jawi || null, ms: r.ms || null, status: r.status || 'kunci' }));
    const { error } = await sb.from('pelajaran').upsert(rows); if (error) throw error; console.log(`pelajaran: ${rows.length} baris`);
  }
  let spSet = null;
  if (args.sp && !args.dry) {
    const rows = (await loadCsv(args.sp)).map(r => ({ kod: r.kod, pelajaran_n: Number(r.pelajaran) || null, nama: r.nama, nama_jawi: r.nama_jawi || null }));
    const { error } = await sb.from('sp').upsert(rows); if (error) throw error; console.log(`sp: ${rows.length} baris`);
    spSet = new Set(rows.map(r => r.kod));
  } else if (args.sp) {
    spSet = new Set((await loadCsv(args.sp)).map(r => r.kod));
  } else if (!args.dry) {
    const { data } = await sb.from('sp').select('kod'); spSet = new Set((data || []).map(r => r.kod));
  }
  const src = args.csv || args.url || process.env.BANK_CSV_URL;
  if (!src) { console.error('Beri --csv fail.csv atau --url pautan (atau env BANK_CSV_URL)'); process.exit(1); }
  const raw = await loadCsv(src);
  const good = [], bad = [], seen = new Set();
  for (const [i, r] of raw.entries()) {
    const { err, row } = rowToSoalan(r, spSet);
    if (seen.has(row.id)) err.push('id berulang'); seen.add(row.id);
    (err.length ? bad : good).push(err.length ? { baris: i + 2, id: row.id, err } : row);
  }
  if (good.length && !args.dry) { const { error } = await sb.from('soalan').upsert(good); if (error) throw error; }
  console.log(`soalan: ${good.length} ${args.dry ? 'sah (dry run, tiada yang ditulis)' : 'dimuat naik'}, ${bad.length} ditolak`);
  for (const b of bad) console.log(`  baris ${b.baris} (${b.id || '?'}): ${b.err.join('; ')}`);
  if (bad.length && process.env.CI) process.exitCode = 2;   // make the nightly job show a warning
}
main().catch(e => { console.error(e); process.exit(1); });
