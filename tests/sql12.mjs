// SQL 12 (tingkatan.sql): skop pesanan dan laporan T2 / T4 / satu kelas / semua.
import { makeDB, callRpc, GURU } from './mock.mjs';
const db=await makeDB(); const G=GURU;
const imp=await callRpc(db,'guru_import',{...G,p_rows:[{nama:'Ali Ujian',kelas:'2 Arif',pin:'1111'},{nama:'Siti Empat',kelas:'4 Adil',pin:'4444'},{nama:'Ahmad Empat',kelas:'4 Bestari',pin:'4545'},{nama:'Zaid Empat Belas',kelas:'14 X',pin:'1414'}],p_ganti:false});
console.log('import', JSON.stringify(imp).slice(0,120));
const S=[['Ali Ujian','2 Arif','1111'],['Siti Empat','4 Adil','4444'],['Ahmad Empat','4 Bestari','4545'],['Zaid Empat Belas','14 X','1414']];
const hantar=async (k,t)=>callRpc(db,'guru_pesanan_hantar',{...G,p_kelas_sasar:k,p_teks:t,p_mime:null,p_durasi:null,p_audio_b64:null});
const lihat=async()=>{ const o={}; for(const [n,k,p] of S){ const r=await callRpc(db,'pesanan_terkini',{p_nama:n,p_kelas:k,p_pin:p}); o[k]=r.ada?r.teks:'-'; } return o; };
let ok=true; const cek=(nama,got,exp)=>{ const g=JSON.stringify(got), e=JSON.stringify(exp); const pass=g===e; ok&&=pass; console.log(pass?'PASS':'FAIL', nama, pass?'':`\n  got ${g}\n  exp ${e}`); };
await hantar('T4','m-T4'); cek('T4 message reaches only Form 4', await lihat(), {'2 Arif':'-','4 Adil':'m-T4','4 Bestari':'m-T4','14 X':'-'});
await hantar('T2','m-T2'); cek('T2 message reaches only Form 2 (T4 keeps its own)', await lihat(), {'2 Arif':'m-T2','4 Adil':'m-T4','4 Bestari':'m-T4','14 X':'-'});
await hantar('4 Adil','m-4Adil'); cek('single class', await lihat(), {'2 Arif':'m-T2','4 Adil':'m-4Adil','4 Bestari':'m-T4','14 X':'-'});
await hantar(null,'m-null'); cek('null = everyone (legacy)', await lihat(), {'2 Arif':'m-null','4 Adil':'m-null','4 Bestari':'m-null','14 X':'m-null'});
const L=await callRpc(db,'guru_pesanan_senarai',G); cek('sasaran counts', L.map(r=>[r.kelas,r.sasaran]), [[null,5],['4 Adil',1],['T2',1],['T4',2]].map(x=>x));
// audio access respects scope
const aud=await db.query(`select id, kelas from public.pesanan_guru order by id`); const idT4=aud.rows.find(r=>r.kelas==='T4').id;
await db.query(`update public.pesanan_guru set audio='\\x01'::bytea, mime='audio/webm' where id=$1`,[idT4]);
const a1=await callRpc(db,'pesanan_audio',{p_nama:'Siti Empat',p_kelas:'4 Adil',p_pin:'4444',p_id:idT4}); const a2=await callRpc(db,'pesanan_audio',{p_nama:'Ali Ujian',p_kelas:'2 Arif',p_pin:'1111',p_id:idT4});
cek('audio T4: F4 yes, F2 no', [a1.ok,a2.ok], [true,false]);
// reports
const rep=async k=>{ const r=await callRpc(db,'guru_laporan_harian',{...G,p_kelas_tapis:k,p_dari:'2026-10-30',p_hingga:'2026-10-30'}); return [r.ok,r.semua,r.kelas,[...new Set(r.murid.map(m=>m.kelas))].sort()]; };
cek('report T4', await rep('T4'), [true,true,'T4',['4 Adil','4 Bestari']]);
const r2=await rep('T2'); cek('report T2 has only Form 2 classes', [r2[0],r2[1],r2[2],r2[3].every(k=>k.startsWith('2 '))], [true,true,'T2',true]);
const rs=await rep('*'); cek('report * = all incl. T4 and 14', [rs[1],rs[3].includes('4 Adil'),rs[3].includes('14 X')], [true,true,true]);
cek('report one class', await rep('4 Adil'), [true,false,'4 Adil',['4 Adil']]);
cek('report T1 (no "14 X" leakage)', await rep('T1'), [true,true,'T1',[]]);
const bad=await callRpc(db,'guru_laporan_harian',{p_nama:'Siti Empat',p_kelas:'4 Adil',p_pin:'4444',p_kelas_tapis:'T4',p_dari:'2026-10-30',p_hingga:null}); cek('student cannot get report', bad.ok, false);
console.log(ok?'ALL PASS':'SOME FAILED'); process.exit(ok?0:1);
