// SQL 13 (akaun_kunci.sql): had cubaan PIN untuk akaun guru dan murid.
import { makeDB, callRpc, GURU } from './mock.mjs';
const G = GURU;
let ok = true; const cek = (nama, got, exp) => { const g = JSON.stringify(got), e = JSON.stringify(exp); const pass = g === e; ok &&= pass; console.log(pass ? 'PASS' : 'FAIL', nama, pass ? '' : `\n  got ${g}\n  exp ${e}`); };
const salah = { ...G, p_pin: '123456' };
const semak = a => callRpc(DB, 'semak_pin', a);
const lepasMasa = async min => DB.query(`update public.akaun_cubaan set kunci_hingga = now() - interval '1 second', gagal_terakhir = gagal_terakhir - make_interval(mins => $1)`, [min]);

for (const [label, opt] of [['all SQL files (1–13)', {}], ['without file 13 (liga.sql alone carries the lockout)', { tanpa: ['akaun_kunci.sql'] }]]) {
  console.log(`-- ${label}`);
  var DB = await makeDB(opt);
  const nv = (await DB.query(`select count(*)::int as n from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.prosrc like '%public._akaun(%' and p.proname not in ('_akaun','_akaun_dikunci') and p.provolatile <> 'v'`)).rows[0].n;
  cek('no non-volatile function calls _akaun', nv, 0);
  cek('correct teacher PIN works', (await semak(G)).ok, true);
  const r = []; for (let i = 0; i < 5; i++) r.push((await semak(salah)).dikunci);
  cek('5 wrong PINs: locked after the 5th', r, [false, false, false, false, true]);
  cek('correct PIN refused while locked', [(await semak(G)).ok, (await semak(G)).dikunci], [false, true]);
  cek('teacher RPC refused while locked', (await callRpc(DB, 'guru_senarai', G)).ok ?? false, false);
  await lepasMasa(0);
  cek('after lock expires, correct PIN works and resets count', [(await semak(G)).ok, (await DB.query(`select gagal from public.akaun_cubaan`)).rows[0].gagal], [true, 0]);
  for (let i = 0; i < 5; i++) await semak(salah); await lepasMasa(0); await semak(salah);
  const d6 = (await DB.query(`select round(extract(epoch from kunci_hingga - now()) / 60) as m from public.akaun_cubaan`)).rows[0].m;
  await lepasMasa(0); await semak(salah);
  const d7 = (await DB.query(`select round(extract(epoch from kunci_hingga - now()) / 60) as m from public.akaun_cubaan`)).rows[0].m;
  cek('backoff 6th → 5 min, 7th → 15 min', [Number(d6), Number(d7)], [5, 15]);
  // PIN ditukar membuang kunci (murid)
  await callRpc(DB, 'guru_import', { ...G, p_rows: [{ nama: 'Ali Ujian', kelas: '2 Arif', pin: '1111' }] }).catch(() => null);
  await DB.query(`update public.akaun_cubaan set kunci_hingga = null, gagal = 0`); await lepasMasa(0);
  await semak(G);
  const M = { p_nama: 'Tetamu', p_kelas: 'Lain-lain' };
  for (let i = 0; i < 5; i++) await semak({ ...M, p_pin: '9999' });
  cek('student locked too', (await semak({ ...M, p_pin: '0000' })).dikunci, true);
  await DB.query(`update public.akaun set pin_hash = extensions.crypt('0001', extensions.gen_salt('bf')) where nama = 'Tetamu'`);
  cek('changing PIN clears the lock', (await semak({ ...M, p_pin: '0001' })).ok, true);
  cek('unknown name: no counter row created', [(await semak({ p_nama: 'Tiada', p_kelas: 'X', p_pin: '1' })).ok, (await DB.query(`select count(*)::int as n from public.akaun_cubaan a join public.akaun k on k.id = a.akaun_id where k.nama = 'Tiada'`)).rows[0].n], [false, 0]);
  cek('old failures (> 24 h) start again from 1', await (async () => { await semak(salah); await DB.query(`update public.akaun_cubaan set gagal = 4, gagal_terakhir = now() - interval '25 hours'`); await semak(salah); return (await DB.query(`select gagal from public.akaun_cubaan c join public.akaun a on a.id = c.akaun_id where a.guru`)).rows[0].gagal; })(), 1);
  cek('_akaun not callable directly', (await DB.query(`select has_function_privilege('anon', 'public._akaun(text,text,text)', 'execute') as x`).catch(() => ({ rows: [{ x: 'no anon role' }] }))).rows[0].x !== true, true);
}
console.log(ok ? 'ALL PASS' : 'SOME FAILED'); process.exit(ok ? 0 : 1);
