// Ujian tempatan tanpa Supabase sebenar: PGlite (Postgres dalam Node) + pelayan statik untuk docs/ + Claude palsu.
// Data ujian SAHAJA: guru ujian dengan PIN ujian. Jangan sekali-kali letak akaun atau PIN sebenar di sini.
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, '..');
export const FIX = n => readFileSync(join(HERE, 'fixtures', n), 'utf8');
export const GURU = { p_nama: 'Ustazah Nafisah', p_kelas: 'Guru', p_pin: '999999' };   // akaun ujian sahaja
export const SQL = ['liga.sql','urus_murid.sql','tasmik_import.sql','jawapan.sql','pesanan.sql','laporan.sql','laporan_v2.sql','liga_lencana.sql','reaksi.sql','tingkatan.sql'];
export const TABLE_FNS = new Set(['liga_kelas','liga_semua','senarai_murid','guru_senarai','tasmik_saya','guru_tasmik','guru_penguasaan','guru_aktiviti','guru_soalan_sukar','guru_pesanan_senarai','guru_ulasan_senarai','liga_kelas_v2']);

export async function makeDB({ tanpa = [] } = {}) {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`create schema if not exists extensions; create role anon; create role authenticated;`);
  for (const f of SQL.filter(f => !tanpa.includes(f))) await db.exec(readFileSync(join(ROOT, 'supabase', f), 'utf8'));
  await db.query(`insert into public.akaun (nama, kelas, pin_hash, guru) values ($1, 'Guru', extensions.crypt($2, extensions.gen_salt('bf')), true), ('Tetamu', 'Lain-lain', extensions.crypt('0000', extensions.gen_salt('bf')), false)`, [GURU.p_nama, GURU.p_pin]);
  return db;
}
export async function callRpc(db, fn, args) {
  const keys = Object.keys(args);
  const ph = keys.map((k, i) => `${k} => $${i + 1}${k === 'p_rows' || k === 'p_data' ? '::json' : Array.isArray(args[k]) ? '::text[]' : ''}`).join(', ');
  const sql = TABLE_FNS.has(fn) ? `select * from public.${fn}(${ph})` : `select public.${fn}(${ph}) as j`;
  const res = (await db.query(sql, keys.map(k => (k === 'p_rows' || k === 'p_data') ? JSON.stringify(args[k]) : args[k]))).rows;
  return TABLE_FNS.has(fn) ? res : res[0].j;
}

// Pelayan statik untuk docs/ (seperti GitHub Pages). Pulangkan URL asas, cth. http://localhost:43123/
export function serveDocs() {
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain' };
  const srv = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    const f = join(ROOT, 'docs', p);
    if (!f.startsWith(join(ROOT, 'docs')) || !existsSync(f)) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
  });
  return new Promise(r => srv.listen(0, () => r({ base: `http://localhost:${srv.address().port}/`, close: () => srv.close() })));
}

// Fungsi Edge ulasan-ai dijalankan dalam Node dengan Deno + Supabase + Claude palsu.
export const claudeLog = [];
export async function makeHandler(db, env = { ANTHROPIC_API_KEY: 'sk-test', SUPABASE_URL: 'https://fake.supabase.co' }) {
  const out = join(HERE, '.build'); mkdirSync(out, { recursive: true });
  await build({ entryPoints: [join(ROOT, 'supabase/functions/ulasan-ai/index.ts')], outfile: join(out, 'fn-ulasan.mjs'), format: 'esm', platform: 'neutral', logLevel: 'error' });
  let handler = null; globalThis.Deno = { env: { get: k => env[k] }, serve: h => { handler = h; } };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opt = {}) => {
    url = String(url);
    if (url.includes('/rest/v1/rpc/')) { const fn = url.split('/').pop(); try { return new Response(JSON.stringify(await callRpc(db, fn, JSON.parse(opt.body || '{}'))), { status: 200, headers: { 'content-type': 'application/json' } }); } catch (e) { return new Response('{}', { status: 400 }); } }
    if (url.startsWith('https://api.anthropic.com/')) {
      const b = JSON.parse(opt.body); claudeLog.push(b); const u = b.messages[0].content;
      if (/Data murid/.test(u)) { const ids = [...u.matchAll(/Murid #(\d+)/g)].map(m => +m[1]); const draf = ids.map(id => ({ id, ulasan: `{nama}, kamu aktif dan rajin mencuba (draf ujian #${id}).` }));
        return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ draf }) }], stop_reason: 'end_turn' }), { status: 200 }); }
      return new Response(JSON.stringify({ content: [{ type: 'text', text: 'Refleksi ujian: ' + ((u.match(/Murid aktif: [^.]+/) || [''])[0]) + '.' }] }), { status: 200 });
    }
    return realFetch(url, opt);
  };
  await import(join(out, 'fn-ulasan.mjs') + '?' + Date.now());
  return handler;
}
