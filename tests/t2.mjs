// Regresi Tingkatan 2 dengan config SEBENAR docs/js/config.js (pautan Google diganti fixtures).
// Semak: tiada tema, warna asal, kuiz (termasuk butang ‹ lihat semula), XP, papan guru, laporan, kad kongsi, lebar telefon.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { makeDB, callRpc, GURU, FIX, HERE, serveDocs } from './mock.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const OUT = HERE + '/out/'; mkdirSync(OUT, { recursive: true });
const srv = await serveDocs(); const BASE = srv.base;
const db = await makeDB();
await callRpc(db, 'guru_import', { ...GURU, p_rows: [{ nama: 'Ali Ujian', kelas: '2 Arif', pin: '1111' }, { nama: 'Abu Ujian', kelas: '2 Arif', pin: '2222' }, { nama: 'Siti Empat', kelas: '4 Arif', pin: '4444' }], p_ganti: false });
const b = await chromium.launch(); const errors = []; let pass = 0, fail = 0;
const cek = (n, ok, info = '') => { ok ? pass++ : fail++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : String(info).slice(0, 400)); };
const gid = { '1565894710': 'soalan2.csv', '666182641': 'sp2.csv', '35581945': 'pelajaran2.csv' };
async function page(w = 390, h = 844, dark = false) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, timezoneId: 'Asia/Kuala_Lumpur', colorScheme: dark ? 'dark' : 'light', acceptDownloads: true });
  await ctx.route('https://docs.google.com/**', r => { const g = (r.request().url().match(/gid=(\d+)/) || [])[1]; return r.fulfill({ contentType: 'text/csv', body: gid[g] ? FIX(gid[g]) : 'tarikh,teks\n' }); });
  await ctx.route('https://pkuxiyabmxmksvccepra.supabase.co/rest/v1/rpc/*', async r => { const fn = r.request().url().split('/').pop(); try { await r.fulfill({ contentType: 'application/json', body: JSON.stringify(await callRpc(db, fn, JSON.parse(r.request().postData() || '{}'))) }); } catch (e) { console.log('SQL ERR', fn, e.message); await r.fulfill({ status: 400, body: '{}' }); } });
  await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); p.on('dialog', d => d.accept());
  await p.goto(BASE + 'index.html'); await p.waitForTimeout(1800); return p;
}
async function login(p, n, k, pin) { if (k === 'Guru') await p.click('[data-act="g-guru"]'); else { await p.click(`[data-act="g-kelas"][data-v="${k}"]`); await p.click(`[data-act="g-nama"][data-v="${n}"]`); } await p.fill('#g-pin', pin); await p.click('[data-act="g-login"]'); await p.waitForTimeout(1800); }
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);

// ---- murid ----
const A = await page();
const asal = await A.evaluate(() => ({ tema: document.documentElement.getAttribute('data-tema'), accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(), chips: [...document.querySelectorAll('[data-act="g-kelas"]')].map(x => x.dataset.v) }));
cek('T2: tiada data-tema, accent ungu asal', !asal.tema && asal.accent === '#6d4cc4', JSON.stringify(asal));
cek('T2: kelas 4 tidak muncul di gate', asal.chips.every(k => !k.startsWith('4 ')), asal.chips.join());
await login(A, 'Ali Ujian', '2 Arif', '1111');
const home = await A.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
cek('T2: home Ayat Hafazan Tingkatan 2 + Ali Imran', /Ayat Hafazan Tingkatan 2/.test(home) && /Ali Imran/.test(home), home.slice(0, 200));
cek('T2: home lebar telefon tanpa overflow', (await overflow(A)) <= 0, await overflow(A));
await A.screenshot({ path: OUT + 't2-home.png' });
// kuiz: jawab 2, kembali ‹, cuba tekan pilihan (mesti dikunci), maju, habiskan
await A.evaluate(() => startQuiz('kuiz16')); await A.waitForTimeout(200);
const n = await A.evaluate(() => quiz.items.length); const xp0 = await A.evaluate(() => state.xp);
const jawab = async (betul) => A.evaluate(b => { const it = quiz.items[quiz.i]; if (it.type === 'order') { quiz.order = b ? it.items.slice() : it.items.slice().reverse(); answer(null); } else answer(b ? it.ans : (it.ans + 1) % Math.max(2, (it.opts || [0, 0]).length)); }, betul);
await jawab(true); await A.click('[data-act="next"]'); await jawab(false);
cek('butang ‹ ada pada soalan 2', await A.locator('[data-act="prev"]').count() === 1, '');
await A.click('[data-act="prev"]'); await A.waitForTimeout(100);
const lihat = await A.evaluate(() => ({ i: quiz.i, dis: [...document.querySelectorAll('#layer [data-act="pick"],#layer [data-act="place"]')].every(x => x.disabled || x.dataset.act === 'place' && false), note: /Lihat semula sahaja/.test(document.getElementById('layer').innerText) }));
cek('lihat semula: soalan 1, pilihan dikunci', lihat.i === 0 && lihat.dis && lihat.note, JSON.stringify(lihat));
await A.click('[data-act="next"]'); await A.waitForTimeout(100);
cek('kembali ke soalan 2 yang sudah dijawab', await A.evaluate(() => quiz.i === 1 && quiz.answers[1] != null), '');
await A.click('[data-act="next"]');
for (let i = 2; i < n; i++) { await jawab(i % 2 === 0); await A.evaluate(() => nextQ()); }
await A.waitForTimeout(400);
const xp1 = await A.evaluate(() => state.xp); const ans = await A.evaluate(() => lastRun ? lastRun.ids.length : null);
const betul = 1 + [...Array(n).keys()].filter(i => i >= 2 && i % 2 === 0).length; const jangka = betul * 10 + (n - betul) * 3 + (betul === n ? 20 : 0);
cek(`XP kuiz tepat sekali (${n} soalan, ${betul} betul)`, xp1 - xp0 === jangka, `dapat ${xp1 - xp0}, jangka ${jangka}`);
await A.evaluate(() => closeQuiz()); await A.waitForTimeout(500);
// timed jawi: tinggalkan & kembali
const adaJawi = await A.evaluate(() => !!SETS.jawi);
if (adaJawi) { await A.evaluate(() => startQuiz('jawi')); await A.waitForTimeout(1300); await A.evaluate(() => answer(quiz.items[0].ans)); await A.click('[data-act="next"]'); await A.waitForTimeout(2100); const t1 = await A.evaluate(() => quiz.tleft); await A.click('[data-act="prev"]'); await A.waitForTimeout(1500); await A.click('[data-act="next"]'); await A.waitForTimeout(300); const t2 = await A.evaluate(() => quiz.tleft); cek('Jawi bermasa: baki masa disambung, tidak mula semula', t2 <= t1 && t2 >= t1 - 1, `${t1} → ${t2}`); await A.evaluate(() => closeQuiz()); }
await A.click('[data-act="nav"][data-v="laporan"]'); await A.waitForTimeout(800);
cek('Laporan tanpa overflow', (await overflow(A)) <= 0, await overflow(A));
await A.screenshot({ path: OUT + 't2-laporan.png' });
const kad = await A.evaluate(async () => { const bl = await binaKad(); const im = await createImageBitmap(bl); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(20, 20, 1, 1).data; return [d[0], d[1], d[2]]; });
cek('Kad laporan: band ungu asal (bukan pink)', kad[2] > kad[1] && kad[0] < 200, kad.join());
// mod gelap
const D = await page(390, 844, true); await login(D, 'Abu Ujian', '2 Arif', '2222');
const dk = await D.evaluate(() => getComputedStyle(document.body).backgroundColor);
cek('Mod gelap T2: latar gelap ungu asal', dk === 'rgb(19, 15, 30)', dk); await D.screenshot({ path: OUT + 't2-dark.png' });
// ---- guru ----
const T = await page(390, 844); await login(T, GURU.p_nama, 'Guru', GURU.p_pin);
await T.click('[data-act="nav"][data-v="guru"]'); await T.waitForTimeout(2500);
const g = await T.evaluate(() => ({ kelas: [...document.querySelectorAll('[data-act="gd-kelas"]')].map(x => x.dataset.v), pel: GD.pel, semak: !!document.getElementById('gsemak'), txt: document.body.innerText.replace(/\s+/g, ' ') }));
cek('Guru T2: kelas Tingkatan 2 sahaja', g.kelas.length && g.kelas.every(k => k.startsWith('2 ')), g.kelas.join());
cek('Guru T2: pelajaran lalai 16', g.pel === 16, g.pel);
cek('Guru T2: tiada kelas 4 dalam papan', !/4 Arif/.test(g.txt), '');
cek('Guru T2 tanpa overflow', (await overflow(T)) <= 0, await overflow(T));
await T.screenshot({ path: OUT + 't2-guru.png', fullPage: true });
await b.close(); srv.close();
console.log(`\n${pass} pass, ${fail} fail`); console.log('ERRORS:', errors.length ? errors : 'none'); process.exit(fail || errors.length ? 1 : 0);
