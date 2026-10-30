// Berbilang tingkatan: folder T4 (docs/t4/) di sebelah T2 (docs/) dengan satu Supabase. OLD_SQL=1 = sebelum SQL 12.
// Jalankan: cd tests && npm install && node tingkatan.mjs   (Playwright + Chromium mesti tersedia)
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { makeDB, makeHandler, callRpc, claudeLog, GURU, FIX, ROOT, HERE, serveDocs } from './mock.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const OUT=HERE+'/out/'; (await import('node:fs')).mkdirSync(OUT,{recursive:true}); const srv=await serveDocs(); const BASE=srv.base; const HOSTRE=BASE.replace(/^https?:\/\//,'').replace(/\/$/,'');
const OLD=!!process.env.OLD_SQL;   // simulate Supabase before SQL 12 is run
const db=await makeDB(); const G=GURU;
if(OLD){ for (const f of ['pesanan.sql','laporan_v2.sql']) await db.exec(readFileSync(ROOT+'/supabase/'+f,'utf8')); }
await callRpc(db,'guru_import',{...G,p_rows:[{nama:'Ali Ujian',kelas:'2 Arif',pin:'1111'},{nama:'Siti Empat',kelas:'4 Adil',pin:'4444'},{nama:'Ahmad Empat',kelas:'4 Adil',pin:'4545'},{nama:'Aminah Empat',kelas:'4 Bestari',pin:'4646'}],p_ganti:false});
const fnHandler=await makeHandler(db);
const b=await chromium.launch(); const errors=[]; let pass=0, fail=0;
const cek=(nama,ok,info='')=>{ ok?pass++:fail++; console.log(ok?'PASS':'FAIL', nama, ok?'':String(info).slice(0,400)); };
const T4CFG=(extra='')=>`window.JEJAK_CONFIG={id:'t4',tingkatan:4,subjek:'Pendidikan Islam',tajuk:'Pendidikan Islam Tingkatan 4 (KSSM)',kelasAwalan:'4 ',asas:'../',guruNama:'Ustazah Nafisah',demo:false,
  hafazan:[{id:'2-255',surah:'Al-Baqarah',no:2,ayat:255,label:'255',pel:1,ms:'m.s. 2–4',rujukan:'Surah Al-Baqarah 2:255',img:'img/ayat/ujian-255.png'},{id:'2-256',surah:'Al-Baqarah',no:2,ayat:256,label:'256',pel:2,ms:'m.s. 11–12',rujukan:'Surah Al-Baqarah 2:256',img:'img/ayat/ujian-256.png'}],
  bankCsvUrl:'/soalan4.csv',spCsvUrl:'/sp4.csv',pelajaranCsvUrl:'/pelajaran4.csv',harian:{mudah:3,sederhana:1,kbat:1},progressVersion:1,ai:true,supabaseUrl:'https://fake.supabase.co',supabaseKey:'sb_publishable_x'${extra}};`;
const T2CFG="window.JEJAK_CONFIG={bankCsvUrl:'/soalan2.csv',spCsvUrl:'/sp2.csv',pelajaranCsvUrl:'/pelajaran2.csv',harian:{mudah:3,sederhana:1,kbat:1},progressVersion:2,ai:true,supabaseUrl:'https://fake.supabase.co',supabaseKey:'sb_publishable_x'};";
const notFound=[];
async function newCtx(w=390,h=844,t4cfg=T4CFG()){
  const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:1,timezoneId:'Asia/Kuala_Lumpur',acceptDownloads:true});
  await ctx.route('**/t4/js/config.js', r=>r.fulfill({contentType:'application/javascript', body:t4cfg}));
  await ctx.route(u=>u.href===BASE+'js/config.js', r=>r.fulfill({contentType:'application/javascript', body:T2CFG}));
  for (const [u,f] of [['soalan2','soalan'],['sp2','sp'],['pelajaran2','pelajaran'],['soalan4','soalan4'],['sp4','sp4'],['pelajaran4','pelajaran4']]) await ctx.route('**/'+u+'.csv', r=>r.fulfill({contentType:'text/csv',body:FIX((f.endsWith('4')?f:f+'2')+'.csv')}));
  await ctx.route('**/t4/img/ayat/ujian-*.png', r=>r.fulfill({contentType:'image/png',body:readFileSync(ROOT+'/docs/img/ayat/ali-imran-3-8.png')}));
  await ctx.route('https://fake.supabase.co/rest/v1/rpc/*', async r=>{ const fn=r.request().url().split('/').pop(); try{ const out=await callRpc(db,fn,JSON.parse(r.request().postData()||'{}')); await r.fulfill({contentType:'application/json',body:JSON.stringify(out)}); }catch(e){ console.log('SQL ERR',fn,e.message); await r.fulfill({status:400,body:'{}'}); } });
  await ctx.route('https://fake.supabase.co/functions/v1/ulasan-ai', async r=>{ const req=r.request(); const res=await fnHandler(new Request(req.url(),{method:req.method(),headers:req.headers(),body:req.method()==='POST'?req.postData():undefined})); await r.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:await res.text()}); });
  return ctx;
}
async function open(ctx,url){ const p=await ctx.newPage();
  p.on('pageerror',e=>errors.push(e.message)); p.on('console',mm=>{ if(mm.type()==='error'&&!/googleapis|gstatic|favicon|TUNNEL/.test(mm.text())) errors.push(mm.text()); }); p.on('dialog',d=>d.accept());
  p.on('response',r=>{ if(r.status()>=400&&r.url().startsWith(BASE)) notFound.push(r.status()+' '+r.url()); });
  await p.goto(BASE+url); await p.waitForTimeout(1800); return p; }
async function login(p,n,k,pin){ await p.evaluate(()=>{ if(state.user){ save(); state.user=null; save(); } showGate(); }); await p.waitForTimeout(300); if(k==='Guru'){ await p.click('[data-act="g-guru"]'); } else { await p.click(`[data-act="g-kelas"][data-v="${k}"]`); await p.click(`[data-act="g-nama"][data-v="${n}"]`); } await p.fill('#g-pin',pin); await p.click('[data-act="g-login"]'); await p.waitForTimeout(1800); }
async function play(p,key){ await p.evaluate(k=>startQuiz(k),key); await p.waitForTimeout(100); const n=await p.evaluate(()=>quiz.items.length); for(let i=0;i<n;i++){ await p.evaluate(i=>{ const it=quiz.items[quiz.i]; answer(i%2===0?it.ans:(it.ans+1)%4); },i); await p.evaluate(()=>nextQ()); } await p.waitForTimeout(300); await p.evaluate(()=>closeQuiz()); await p.waitForTimeout(700); }
const txt=p=>p.evaluate(()=>document.body.innerText.replace(/\s+/g,' '));

// ===== 1. Student phone: Form 4 and Form 2 on the same phone =====
const phone=await newCtx();
const P4=await open(phone,'t4/index.html');
const chips=await P4.evaluate(()=>[...document.querySelectorAll('[data-act="g-kelas"]')].map(b=>b.dataset.v));
cek('T4 gate lists only Form 4 classes (+Lain-lain)', chips.filter(k=>!/lain/i.test(k)).join()==='4 Adil,4 Bestari', chips);
cek('T4 gate subtitle', /Pendidikan Islam Tingkatan 4/.test(await txt(P4)), (await txt(P4)).slice(0,200));
await login(P4,'Siti Empat','4 Adil','4444');
const home=await txt(P4);
cek('home: Ayat Hafazan Tingkatan 4', /Ayat Hafazan Tingkatan 4/.test(home), home.slice(0,300));
cek('home: no Ali Imran / Tingkatan 2 text', !/Ali Imran|Tingkatan 2/.test(home), (home.match(/.{40}(Ali Imran|Tingkatan 2).{40}/)||[''])[0]);
const img=await P4.evaluate(()=>{ const i=document.querySelector('.ayat-img'); const u=document.querySelector('img.ust'); return {ayat:i&&i.src, ok:i&&i.complete&&i.naturalWidth>0, ust:u&&u.src, ustOk:u&&u.complete&&u.naturalWidth>0}; });
cek('verse image from t4/img/ayat and loads', img.ok&&/\/t4\/img\/ayat\/ujian-255\.png$/.test(img.ayat), JSON.stringify(img));
cek('shared teacher image from ../img loads', img.ustOk&&img.ust===BASE+'img/bust.webp', JSON.stringify(img));
await P4.evaluate(()=>openTasmik()); await P4.waitForTimeout(400); const ch=await P4.evaluate(()=>[...document.querySelectorAll('.hz-chips button')].map(b=>b.textContent.trim()).join()); cek('tasmik chips 255, 256', /255/.test(ch)&&/256/.test(ch), ch); await P4.evaluate(()=>closeQuiz()); await P4.waitForTimeout(300);
await play(P4,'harian'); await play(P4,'kuiz1');
const st4=await P4.evaluate(()=>({xp:state.xp,ls:Object.keys(localStorage).sort(),sets:Object.keys(SETS).sort().join(),misi:misiItems().map(m=>m.t).join(' | ')}));
cek('T4 storage keys suffixed -t4', st4.ls.filter(k=>k.startsWith('jejak-ilmu')).every(k=>k.startsWith('jejak-ilmu-v1-t4')) && st4.ls.includes('jejak-bank-cache-t4'), st4.ls.join(' '));
cek('T4 XP earned', st4.xp>0, st4.xp);
cek('T4 sets from Form 4 sheet (no lesson 16, sirah from bidang)', !/kuiz16,|kuiz4,/.test(st4.sets+',')&&/kuiz1,kuiz2,kuiz3,kuiz5/.test(st4.sets)&&/sirah/.test(st4.sets), st4.sets);
cek('mission mentions Tingkatan 4 or 2 ayat', /Tingkatan 4|ayat|Rakam/.test(st4.misi)&&!/Tingkatan 2/.test(st4.misi), st4.misi);
await P4.click('[data-act="nav"][data-v="peta"]'); await P4.waitForTimeout(600);
const peta=await txt(P4);
cek('Peta: 6 pelajaran, Ibadah label, Form 4 book', /6 pelajaran/.test(peta)&&/Ibadah/.test(peta)&&!/Fiqah/.test(peta)&&/Tingkatan 4/.test(peta), peta.slice(0,400));
await P4.evaluate(()=>sheetLesson(4)); await P4.waitForTimeout(300); cek('lesson 4 locked, no tayamum note', !/Nota Ustazah|tayamum/i.test(await txt(P4)), ''); await P4.evaluate(()=>closeSheet());
await P4.click('[data-act="nav"][data-v="cabaran"]'); await P4.waitForTimeout(1500);
const cab=await txt(P4);
cek('Cabaran: Hafiz Al-Baqarah badge, 2 ayat Tingkatan 4', /Hafiz Al-Baqarah/.test(cab)&&/Kedua-dua ayat hafazan T4/.test(cab), (cab.match(/.{60}Hafiz.{80}/)||[cab.slice(0,200)])[0]);
const liga=await P4.evaluate(async()=>{ await refreshLiga?.(); return document.body.innerText; }).catch(()=>'');
// switch the same phone to Form 2
const P2=await open(phone,'index.html');
const st2a=await P2.evaluate(()=>({user:state.user,chips:[...document.querySelectorAll('[data-act="g-kelas"]')].map(b=>b.dataset.v)}));
cek('T2 on same phone: not logged in as T4 student', !st2a.user, JSON.stringify(st2a.user));
cek('T2 gate shows only Form 2 classes', st2a.chips.length>0&&st2a.chips.filter(k=>!/lain/i.test(k)).every(k=>k.startsWith('2 ')), st2a.chips.join());
await login(P2,'Ali Ujian','2 Arif','1111'); await play(P2,'harian');
const p2home=await txt(P2);
cek('T2 home unchanged: Ayat Hafazan Tingkatan 2 + Ali Imran', /Ayat Hafazan Tingkatan 2/.test(p2home)&&/Ali Imran/.test(p2home), p2home.slice(0,200));
await P4.reload(); await P4.waitForTimeout(2000);
const st4b=await P4.evaluate(()=>({nama:state.nama,xp:state.xp}));
cek('T4 still logged in as Siti with same XP after using T2', st4b.nama==='Siti Empat'&&st4b.xp>=st4.xp, JSON.stringify(st4b));

// ===== 2. Teacher in the Form 4 app =====
const tctx=await newCtx(1280,900);
const T=await open(tctx,'t4/index.html'); await login(T,G.p_nama,'Guru',G.p_pin);
await T.click('[data-act="nav"][data-v="guru"]'); await T.waitForTimeout(2500);
const gkls=await T.evaluate(()=>[...document.querySelectorAll('[data-act="gd-kelas"]')].map(b=>b.dataset.v));
cek('teacher class chips only Form 4', gkls.length&&gkls.every(k=>k.startsWith('4 ')), gkls.join());
const gtxt=await txt(T);
cek('teacher liga/overview has no Form 2 class', !/2 Arif|2 Amanah/.test(gtxt), (gtxt.match(/.{30}2 (Arif|Amanah).{30}/)||[''])[0]);
await T.click('[data-act="pv-baru"]'); await T.waitForTimeout(300);
const pvOpts=await T.evaluate(()=>[...document.querySelectorAll('#pv-kelas option')].map(o=>o.value+'='+o.textContent).join(' | '));
cek('message target: Semua kelas Tingkatan 4 + Form 4 classes only', /=Semua kelas Tingkatan 4/.test(pvOpts)&&!/2 Arif/.test(pvOpts), pvOpts);
await T.fill('#pv-teks','Assalamualaikum Tingkatan 4, selamat datang.'); await T.click('[data-act="pv-hantar"]'); await T.waitForTimeout(1500);
const row=(await db.query(`select kelas, teks from public.pesanan_guru order by id desc limit 1`)).rows[0];
cek('message stored with scope T4', row&&row.kelas==='T4', JSON.stringify(row));
const sees=async(n,k,p)=>{ const r=await callRpc(db,'pesanan_terkini',{p_nama:n,p_kelas:k,p_pin:p}); return r.ada?r.teks:''; };
const s4=await sees('Aminah Empat','4 Bestari','4646'), s2=await sees('Ali Ujian','2 Arif','1111');
if(!OLD){ cek('Form 4 student receives it', /Tingkatan 4/.test(s4), s4); cek('Form 2 student does not', !/Tingkatan 4/.test(s2), s2); }
else { await T.evaluate(()=>{ gP.t=0; return refreshGP(); }); await T.waitForTimeout(800); const w=await txt(T); cek('OLD SQL: teacher warned message not delivered', /jalankan fail SQL 12/.test(w), (w.match(/.{80}Tingkatan 4, selamat.{120}/)||[''])[0]); }
// student sees it in app
if(!OLD){ await P4.click('[data-act="nav"][data-v="utama"]'); await P4.waitForTimeout(500); await P4.evaluate(()=>{ pS.t=0; return refreshPS(); }); await P4.waitForTimeout(1200); cek('T4 app shows the message', /selamat datang/.test(await txt(P4)), ''); }

// overall report
await T.selectOption('#lh-skop','*'); await T.click('[data-act="lh-julat"][data-v="7"]'); await T.click('[data-act="lh-buka"]'); await T.waitForTimeout(2500);
const LHs=await T.evaluate(()=>({kelas:LH.kelas,err:LH.err,k:[...new Set((LH.d&&LH.d.murid||[]).map(m=>m.kelas))].sort()}));
cek('overall report: Semua kelas Tingkatan 4, only Form 4 classes', LHs.kelas==='Semua kelas Tingkatan 4'&&!LHs.err&&LHs.k.length&&LHs.k.every(k=>k.startsWith('4 ')||/lain/i.test(k)), JSON.stringify(LHs));
await T.click('[data-act="lh-ai"]'); await T.waitForTimeout(2000);
const rp=claudeLog.at(-1); const rpu=rp.messages[0].content;
cek('AI refleksi prompt: semua kelas Tingkatan 4, no Form 2 class', /semua kelas Tingkatan 4/.test(rpu)&&/4 Adil/.test(rpu)&&!/- 2 /.test(rpu)&&/Tingkatan 4/.test(rp.system), rpu.slice(0,300)+' || '+String(rp.system).slice(0,120));
const [dl]=await Promise.all([T.waitForEvent('download',{timeout:30000}), T.click('[data-act="lh-pdf"]')]); const pdf=OUT+'t4-semua.pdf'; await dl.saveAs(pdf);
const pt=execSync(`pdftotext -layout ${pdf} -`).toString();
cek('PDF filename + content are Form 4 only', /T4/.test(dl.suggestedFilename())&&/Tingkatan 4/.test(pt)&&/4 Adil/.test(pt)&&!/2 Arif|Ali Imran|Tingkatan 2/.test(pt), dl.suggestedFilename()+' '+(pt.match(/.{40}(2 Arif|Ali Imran|Tingkatan 2).{40}/)||[''])[0]);
await T.evaluate(()=>closeSheet()); await T.waitForTimeout(300);
// AI ulasan drafts for 4 Adil
await T.click('[data-act="gd-kelas"][data-v="4 Adil"]'); await T.waitForTimeout(1500);
await T.click('[data-act="ul-buka"]'); await T.waitForTimeout(1200); await T.click('[data-act="ul-ai-semua"]'); await T.waitForTimeout(3000);
const up=claudeLog.at(-1);
cek('AI ulasan prompt: Tingkatan 4 + Al-Baqarah hafazan, no names', /Tingkatan 4/.test(up.system+up.messages[0].content)&&/Al-Baqarah/.test(up.messages[0].content)&&!/Siti|Ahmad/.test(JSON.stringify(up)), String(up.system).slice(0,200)+' || '+up.messages[0].content.slice(0,200));
await T.evaluate(()=>closeSheet());
// import warning for wrong-form class
await T.evaluate(()=>{ imp.teks='nama\tkelas\tpin\nBudi\t2 Arif\t1234\nCik Empat\t4 Adil\t1234'; sheetImport(); }); await T.waitForTimeout(300);
cek('import warns about non-Form-4 class', /tidak bermula dengan "4 "/.test(await txt(T)), ''); await T.evaluate(()=>closeSheet());

// ===== 3. Placeholder when the Sheet is not connected =====
const ectx=await newCtx(390,844,T4CFG(",bankCsvUrl:'',spCsvUrl:'',pelajaranCsvUrl:''"));
const E=await open(ectx,'t4/index.html');
const et=await txt(E);
cek('unconnected T4 shows "sedang disediakan", no Form 2 demo', /sedang disediakan/.test(et)&&!/Tayamum|Ali Imran/.test(et), et.slice(0,200));

// ===== 4. Student guide per form =====
const G4=await open(phone,'t4/panduan.html'); await G4.waitForTimeout(800);
const g4=await G4.evaluate(()=>({t:document.title,body:document.body.innerText.replace(/\s+/g,' '),qr:!!document.querySelector('#qr svg'),url:document.getElementById('url').textContent,imgs:[...document.images].map(i=>i.naturalWidth>0)}));
cek('T4 guide: title/text Form 4, QR, URL, images', /T4/.test(g4.t)&&/Pendidikan Islam Tingkatan 4/.test(g4.body)&&/Ayat Hafazan Tingkatan 4/.test(g4.body)&&/2 ayat.*Al-Baqarah: ayat 255 dan 256 \(buku teks m\.s\. 2–12\)/.test(g4.body)&&/Hafiz Al-Baqarah/.test(g4.body)&&!/Ali Imran|Tingkatan 2|2 Amanah/.test(g4.body)&&g4.qr&&g4.url===HOSTRE+'/t4'&&g4.imgs.every(Boolean), JSON.stringify({...g4,body:g4.body.slice(0,300)}));
const G2=await open(phone,'panduan.html'); await G2.waitForTimeout(800);
const g2=await G2.evaluate(()=>({body:document.body.innerText.replace(/\s+/g,' '),qr:!!document.querySelector('#qr svg'),url:document.getElementById('url').textContent,imgs:[...document.images].map(i=>i.naturalWidth>0)}));
cek('T2 guide unchanged text', /4 ayat daripada Surah Ali Imran: ayat 8, 18, 26 dan 27 \(buku teks m\.s\. 2–12\)/.test(g2.body)&&/Hafiz Ali Imran/.test(g2.body)&&/Keempat-empat ayat hafazan Tingkatan 2 lulus/.test(g2.body)&&/2 Amanah/.test(g2.body)&&g2.qr&&g2.imgs.every(Boolean), g2.body.slice(0,300));
const ectx2=await newCtx(390,844,T4CFG(",hafazan:[]"));
const G0=await open(ectx2,'t4/panduan.html'); await G0.waitForTimeout(500);
cek('guide with no hafazan hides section and badges', await G0.evaluate(()=>document.getElementById('hz').hidden&&[...document.querySelectorAll('tr[data-hz]')].every(r=>r.hidden)), '');
await P2.screenshot({path:OUT+'t2-home.png'}); await P4.click('[data-act="nav"][data-v="utama"]').catch(()=>{}); await P4.waitForTimeout(500); await P4.screenshot({path:OUT+'t4-home.png'}); await E.screenshot({path:OUT+'t4-kosong.png'}); await G4.screenshot({path:OUT+'t4-panduan.png'});
await b.close(); srv.close();
const nf=notFound.filter(u=>!/favicon/.test(u));
cek('no 404s for app assets', !nf.length, nf.join(' '));
console.log(`\n${OLD?'[OLD SQL] ':''}${pass} pass, ${fail} fail`); console.log('ERRORS:', errors.length?errors:'none'); process.exit(fail||errors.length?1:0);
