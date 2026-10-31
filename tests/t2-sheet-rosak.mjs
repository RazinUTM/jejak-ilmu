// Google Sheet T2 rosak: pautan Pelajaran dan SP memberi tab Soalan (tab dipadam/dicipta semula → gid berubah).
// App mesti kekal boleh guna (pelajaran terbina / salinan baik), dan guru nampak amaran.
import { createRequire } from 'node:module';
import { makeDB, callRpc, GURU, FIX, serveDocs } from './mock.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const srv = await serveDocs(); const db = await makeDB();
await callRpc(db, 'guru_import', { ...GURU, p_rows: [{ nama: 'Ali Ujian', kelas: '2 Arif', pin: '1111' }], p_ganti: false });
const b = await chromium.launch(); const errors = []; let pass = 0, fail = 0;
const cek = (n, ok, info = '') => { ok ? pass++ : fail++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : String(info).slice(0, 300)); };
async function page(rosak) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const gid = { '1565894710': 'soalan2.csv', '666182641': rosak ? 'soalan2.csv' : 'sp2.csv', '35581945': rosak ? 'soalan2.csv' : 'pelajaran2.csv' };
  await ctx.route('https://docs.google.com/**', r => { const g = (r.request().url().match(/gid=(\d+)/) || [])[1]; return r.fulfill({ contentType: 'text/csv', body: gid[g] ? FIX(gid[g]) : 'tarikh,teks\n' }); });
  await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await ctx.route('https://pkuxiyabmxmksvccepra.supabase.co/rest/v1/rpc/*', async r => { const fn = r.request().url().split('/').pop(); try { await r.fulfill({ contentType: 'application/json', body: JSON.stringify(await callRpc(db, fn, JSON.parse(r.request().postData() || '{}'))) }); } catch (e) { await r.fulfill({ status: 400, body: '{}' }); } });
  return ctx;
}
async function login(p, n, k, pin) { if (k === 'Guru') await p.click('[data-act="g-guru"]'); else { await p.click(`[data-act="g-kelas"][data-v="${k}"]`); await p.click(`[data-act="g-nama"][data-v="${n}"]`); } await p.fill('#g-pin', pin); await p.click('[data-act="g-login"]'); await p.waitForTimeout(1800); }
// 1) telefon yang pernah memuat Sheet yang baik, kemudian Sheet rosak
const baik = await page(false); let p = await baik.newPage(); p.on('pageerror', e => errors.push(e.message));
await p.goto(srv.base + 'index.html'); await p.waitForTimeout(1800); await login(p, 'Ali Ujian', '2 Arif', '1111');
const spBaik = await p.evaluate(() => Object.keys(SP_NAMA).length);
await baik.unroute('https://docs.google.com/**');
await baik.route('https://docs.google.com/**', r => r.fulfill({ contentType: 'text/csv', body: FIX('soalan2.csv') }));
await p.reload(); await p.waitForTimeout(2200);
for (const v of ['laporan', 'peta', 'utama']) { await p.click(`[data-act="nav"][data-v="${v}"]`); await p.waitForTimeout(300); }
const s1 = await p.evaluate(() => ({ view: state.view, pel: PELAJARAN.length, sp: Object.keys(SP_NAMA).length, kuiz: Object.keys(SETS).filter(k => /^kuiz\d/.test(k)).length, amaran: BANK_AMARAN.join() }));
cek('telefon lama: tab Utama/Laporan boleh diklik, pelajaran + SP daripada salinan baik', s1.view === 'utama' && s1.pel === 28 && s1.sp === spBaik && s1.kuiz > 0, JSON.stringify(s1));
// 2) telefon baharu (tiada salinan baik) + guru nampak amaran
const baru = await page(true); p = await baru.newPage(); p.on('pageerror', e => errors.push(e.message));
await p.goto(srv.base + 'index.html'); await p.waitForTimeout(1800); await login(p, GURU.p_nama, 'Guru', GURU.p_pin);
for (const v of ['laporan', 'peta', 'utama']) { await p.click(`[data-act="nav"][data-v="${v}"]`); await p.waitForTimeout(300); }
const s2 = await p.evaluate(() => ({ view: state.view, pel: PELAJARAN.length, amaran: BANK_AMARAN.join() }));
cek('telefon baharu: app tidak tergendala, 28 pelajaran terbina T2', s2.view === 'utama' && s2.pel === 28, JSON.stringify(s2));
await p.click('[data-act="nav"][data-v="guru"]'); await p.waitForTimeout(1500);
const t = await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
cek('guru nampak amaran Google Sheet (Pelajaran, SP)', /Google Sheet perlu disemak/.test(t) && /SP, Pelajaran|Pelajaran/.test(s2.amaran), s2.amaran);
await b.close(); srv.close();
console.log(`\n${pass} pass, ${fail} fail`); console.log('ERRORS:', errors.length ? errors : 'none'); process.exit(fail || errors.length ? 1 : 0);
