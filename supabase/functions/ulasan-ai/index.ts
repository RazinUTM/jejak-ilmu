// Jejak Ilmu · ulasan-ai (Supabase Edge Function)
// Draf "Ulasan Ustazah" untuk kad laporan dan draf refleksi Laporan Harian PdP, menggunakan Claude API.
//
// Keselamatan dan privasi:
// - Setiap panggilan mesti membawa nama + kelas + PIN guru; fungsi menyemaknya melalui RPC semak_pin.
// - Data murid diambil oleh fungsi ini sendiri daripada pangkalan data (bukan daripada pelayar).
// - TIADA nama murid dihantar kepada AI: murid dikenal pasti dengan nombor; aplikasi menggantikan {nama} sendiri.
// - Hasil AI hanyalah DRAF. Murid hanya nampak ulasan selepas guru menyemak dan menekan "Sahkan".
//
// Secrets (Supabase → Edge Functions → Secrets):
//   ANTHROPIC_API_KEY  (wajib)   kunci daripada console.anthropic.com
//   ULASAN_MODEL       (pilihan) lalai claude-sonnet-5-5; claude-haiku-5-5 lebih murah
// Tetapan fungsi: matikan "Verify JWT with legacy secret" (fungsi ini membuat semakan PIN guru sendiri).

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const MODEL = Deno.env.get('ULASAN_MODEL') || 'claude-sonnet-5-5';
const API_KEY = Deno.env.get('ANTHROPIC_API_KEY') || '';
const SB_URL = (Deno.env.get('SUPABASE_URL') || '').replace(/\/+$/, '');

const reply = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const clean = (v: unknown, n = 120) => String(v ?? '').replace(/[\r\n\t]+/g, ' ').replace(/[{}<>]/g, '').trim().slice(0, n);

function publicKey(req: Request): string {
  const h = req.headers.get('apikey');
  if (h) return h;
  try {
    const o = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}');
    const v = o.default || Object.values(o)[0];
    if (v) return String(v);
  } catch (_) { /* ignore */ }
  return Deno.env.get('SUPABASE_ANON_KEY') || '';
}

async function rpc(key: string, fn: string, args: Record<string, unknown>) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', apikey: key };
  if (key.startsWith('eyJ')) headers.Authorization = 'Bearer ' + key;
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(args) });
  if (!r.ok) throw new Error(`rpc_${fn}_${r.status}`);
  return await r.json();
}

async function claude(system: string, user: string, maxTokens: number): Promise<string> {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.error('Claude API', r.status, j?.error?.type, j?.error?.message); throw new Error(`claude_${r.status}: ${clean(j?.error?.message, 200)}`); }
  return (j.content || []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('');
}

// Output berstruktur (structured outputs): jawapan sentiasa JSON yang sah mengikut skema ini.
// Nota: Sonnet 5.5 / Opus 5.5 menolak "forced tool use" dengan ralat 400, jadi kita guna output_config.format.
const SKEMA_DRAF = {
  type: 'object',
  properties: {
    draf: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'integer' }, ulasan: { type: 'string' } },
        required: ['id', 'ulasan'],
        additionalProperties: false,
      },
    },
  },
  required: ['draf'],
  additionalProperties: false,
};

async function panggilClaude(body: Record<string, unknown>) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) console.error('Claude API', r.status, j?.error?.type, j?.error?.message);
  return { r, j };
}

async function claudeJSON(system: string, user: string, maxTokens: number): Promise<{ draf: Array<{ id: number; ulasan: string }>; stop: string }> {
  const asas = { model: MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] };
  let { r, j } = await panggilClaude({ ...asas, output_config: { format: { type: 'json_schema', schema: SKEMA_DRAF } } });
  // Sandaran: model lama yang tidak menyokong structured outputs -> minta JSON biasa
  if (!r.ok && r.status === 400 && /output_config|json_schema|structured/i.test(String(j?.error?.message || ''))) {
    ({ r, j } = await panggilClaude(asas));
  }
  if (!r.ok) throw new Error(`claude_${r.status}: ${clean(j?.error?.message, 200)}`);
  if (j.stop_reason === 'refusal') throw new Error('ditolak_ai');
  const text = (j.content || []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('');
  try { const o = JSON.parse(text); return { draf: Array.isArray(o) ? o : o.draf, stop: j.stop_reason }; } catch (_) { /* cuba ekstrak */ }
  const a = text.indexOf('['), z = text.lastIndexOf(']');
  try { return { draf: JSON.parse(text.slice(a, z + 1)), stop: j.stop_reason }; } catch (_) { throw new Error(j.stop_reason === 'max_tokens' ? 'terpotong' : 'format_ai'); }
}

type SpInfo = Record<string, { n?: string; p?: number | null }>;
type SpRow = { k: string; m: number; c: number };

const SISTEM_ULASAN = `Anda membantu Ustazah Nafisah, guru Pendidikan Islam Tingkatan 2 (KSSM) di Malaysia, menulis DRAF ulasan ringkas untuk kad laporan murid dalam aplikasi pembelajaran Jejak Ilmu. Ustazah akan membaca, menyunting dan mengesahkan setiap draf.

Peraturan:
- Bahasa Melayu yang mesra, hangat dan jujur, seperti seorang ustazah bercakap kepada murid berumur 14 tahun. Gunakan "kamu".
- 2 hingga 3 ayat, maksimum 55 patah perkataan. Mulakan dengan {nama}, (tulis tepat "{nama}" sebagai pemegang tempat; jangan reka nama).
- Hargai USAHA dahulu (hari aktif, bilangan soalan dicuba, tasmik), bukan markah semata-mata.
- Sebut satu kekuatan (SP kuat) jika ada, dan satu fokus seterusnya (SP perlu ulang) dengan tindakan konkrit dalam aplikasi: contohnya ulang Kuiz Pelajaran N, Cabaran Harian 5 minit, atau rakam tasmik hafazan.
- Jika murid tidak aktif atau sangat sedikit aktiviti, ajak dengan lembut tanpa menyalahkan.
- Jika "jumlah intai teks" tasmik tinggi, galakkan menghafaz tanpa melihat teks, secara positif.
- Guna HANYA fakta dalam data. Jangan reka markah, tarikh, peristiwa atau perangai. Jangan bandingkan dengan murid lain. Jangan labelkan murid secara negatif.
- Boleh akhiri dengan doa atau kata semangat pendek (contoh: "Semoga Allah mudahkan."). Jangan petik ayat al-Quran atau hadis.
- Kod SP seperti 4.10.5 boleh disebut bersama huraiannya jika ada; jika tiada huraian, sebut "SP 4.10.5".

Balas dalam JSON: {"draf": [{"id": <nombor murid>, "ulasan": "<teks>"}, ...]}, satu item bagi setiap murid yang diberi.`;

function spText(arr: SpRow[] | null, info: SpInfo): string {
  if (!arr || !arr.length) return 'tiada';
  return arr.map((x) => {
    const i = info[x.k] || {};
    return `${clean(x.k, 20)}${i.n ? ' ' + clean(i.n) : ''}${i.p ? ` (Pelajaran ${Number(i.p)})` : ''}: ${x.m}% daripada ${x.c} cubaan`;
  }).join('; ');
}

async function ulasan(key: string, cred: Record<string, string>, b: Record<string, unknown>) {
  const rows = await rpc(key, 'guru_ulasan_senarai', { ...cred, p_kelas_tapis: clean(b.kelas, 40) });
  if (!Array.isArray(rows)) return { ok: false, ralat: 'data' };
  const want = new Set((Array.isArray(b.ids) ? b.ids : []).map(Number));
  const pick = rows.filter((r: { akaun_id: number }) => want.has(Number(r.akaun_id))).slice(0, 8);
  if (!pick.length) return { ok: true, draf: [] };
  const info = (b.sp_info && typeof b.sp_info === 'object' ? b.sp_info : {}) as SpInfo;
  const data = pick.map((r: Record<string, any>) => {
    const pct = r.jawapan ? ` (${Math.round((r.betul / r.jawapan) * 100)}% betul)` : '';
    return `Murid #${r.akaun_id}: 14 hari terakhir: ${r.hari_aktif} hari aktif; ${r.jawapan} soalan dicuba${pct}; ${r.xp_14h} XP; ` +
      `${r.tasmik} tasmik dihantar${r.tasmik ? ` (jumlah intai teks ${r.tasmik_intai})` : ''}. ` +
      `SP kuat: ${spText(r.sp_kuat, info)}. SP perlu ulang: ${spText(r.sp_lemah, info)}.`;
  }).join('\n');
  const user = `Ayat hafazan buku teks: Surah Ali Imran ayat 8, 18, 26 dan 27.\n\nData murid:\n${data}\n\nTulis satu draf ulasan bagi setiap murid di atas.`;
  const { draf: arr, stop } = await claudeJSON(SISTEM_ULASAN, user, 600 + 350 * pick.length);
  const ids = new Set(pick.map((r: { akaun_id: number }) => Number(r.akaun_id)));
  const draf = arr.filter((x) => x && ids.has(Number(x.id)) && typeof x.ulasan === 'string')
    .map((x) => ({ id: Number(x.id), ulasan: x.ulasan.trim().slice(0, 700) }));
  return { ok: true, draf, model: MODEL, lengkap: stop !== 'max_tokens' };
}

const SISTEM_REFLEKSI = `Anda membantu seorang guru Pendidikan Islam Tingkatan 2 di Malaysia menulis DRAF refleksi PdP (seperti ruangan refleksi dalam Rancangan Pengajaran Harian) berdasarkan data aktiviti murid dalam aplikasi Jejak Ilmu. Guru akan menyemak dan menyunting.

Peraturan:
- Bahasa Melayu formal dan ringkas, 3 hingga 5 ayat, tanpa tajuk dan tanpa senarai.
- Nyatakan penglibatan (berapa murid aktif daripada jumlah), pencapaian objektif mengikut SP (yang kukuh dan yang perlu pengukuhan), tasmik hafazan, dan tindakan susulan (pengukuhan, pemulihan, bimbingan murid tidak aktif).
- Guna HANYA angka dalam data. Jangan reka angka atau peristiwa. Jangan sebut nama murid.
- Data kuiz ialah penilaian formatif dalam aplikasi, bukan peperiksaan.
- Jika data merangkumi beberapa kelas, nyatakan gambaran keseluruhan dahulu, kemudian bandingkan penyertaan dan ketepatan antara kelas secara ringkas (sebut kelas tertinggi dan yang memerlukan perhatian), dan cadangkan tindakan susulan mengikut kelas. Untuk laporan keseluruhan, boleh tulis sehingga 6 ayat.
Balas dengan teks refleksi sahaja.`;

async function refleksi(key: string, cred: Record<string, string>, b: Record<string, unknown>) {
  const dari = clean(b.dari, 10), hingga = clean(b.hingga || b.dari, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dari) || !/^\d{4}-\d{2}-\d{2}$/.test(hingga)) return { ok: false, ralat: 'tarikh' };
  const kelas = clean(b.kelas, 40); const semua = kelas === '*';
  const d = await rpc(key, 'guru_laporan_harian', { ...cred, p_kelas_tapis: kelas, p_dari: dari, p_hingga: hingga });
  if (!d || !d.ok) return { ok: false, ralat: d?.ralat || 'data' };
  const info = (b.sp_info && typeof b.sp_info === 'object' ? b.sp_info : {}) as SpInfo;
  const murid = (d.murid as Array<Record<string, any>>).filter((m) => !semua || !/lain/i.test(String(m.kelas || '')));
  const isAktif = (m: Record<string, any>) => m.jawapan > 0 || (m.tasmik || []).length > 0;
  const perKelas = semua ? [...new Set(murid.map((m) => String(m.kelas)))].sort().map((k) => {
    const ms = murid.filter((m) => m.kelas === k); const j = ms.reduce((s, m) => s + m.jawapan, 0), bt = ms.reduce((s, m) => s + m.betul, 0);
    return `- ${clean(k, 30)}: ${ms.filter(isAktif).length}/${ms.length} murid aktif, ${j} soalan, ketepatan ${j ? Math.round((bt / j) * 100) : 0}%, tasmik ${ms.reduce((s, m) => s + (m.tasmik || []).length, 0)}`;
  }).join('\n') : '';
  const n = murid.length;
  const aktif = murid.filter(isAktif).length;
  const jaw = murid.reduce((s, m) => s + m.jawapan, 0), bet = murid.reduce((s, m) => s + m.betul, 0);
  const tas = murid.reduce((s, m) => s + (m.tasmik || []).length, 0);
  const rendah = murid.filter((m) => m.jawapan >= 5 && m.betul / m.jawapan < 0.5).length;
  const spAgg: Record<string, { cubaan: number; betul: number; murid: number }> = {};
  for (const r of d.sp as Array<Record<string, any>>) { if (semua && /lain/i.test(String(r.kelas || ''))) continue; const o = spAgg[r.sp_kod] = spAgg[r.sp_kod] || { cubaan: 0, betul: 0, murid: 0 }; o.cubaan += r.cubaan; o.betul += r.betul; o.murid += r.murid; }
  const sp = Object.entries(spAgg).map(([k, s]) =>
    `${clean(k, 20)}${info[k]?.n ? ' ' + clean(info[k].n) : ''}: ${s.murid} murid, ${s.cubaan} cubaan, ${Math.round((s.betul / Math.max(1, s.cubaan)) * 100)}% betul`).join('\n') || 'tiada';
  const user = `Skop: ${semua ? 'semua kelas' : 'kelas ' + kelas}. Tarikh: ${dari}${hingga !== dari ? ' hingga ' + hingga : ''}. Pelajaran semasa: ${clean(b.pelajaran, 160) || '-'}.
Murid aktif: ${aktif} daripada ${n}. Soalan dijawab: ${jaw}, ketepatan purata ${jaw ? Math.round((bet / jaw) * 100) : 0}%.
Tasmik hafazan diterima: ${tas}. Murid dengan ketepatan bawah 50% (sekurang-kurangnya 5 soalan): ${rendah}. Murid tidak aktif: ${n - aktif}.
Pencapaian mengikut SP:
${sp}${semua ? `\nMengikut kelas:\n${perKelas}` : ''}`;
  const text = await claude(SISTEM_REFLEKSI, user, semua ? 900 : 600);
  return { ok: true, refleksi: text.trim().slice(0, 1500), model: MODEL };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply({ ok: false, ralat: 'kaedah' }, 405);
  if (!API_KEY) return reply({ ok: false, ralat: 'tiada_kunci_api' }, 500);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch (_) { return reply({ ok: false, ralat: 'json' }, 400); }
  const cred = { p_nama: clean(b.p_nama, 80), p_kelas: clean(b.p_kelas, 40), p_pin: clean(b.p_pin, 12) };
  const key = publicKey(req);
  try {
    const s = await rpc(key, 'semak_pin', cred);
    if (!s || !s.ok || !s.guru) return reply({ ok: false, ralat: 'bukan_guru' }, 403);
    if (b.mod === 'ulasan') return reply(await ulasan(key, cred, b));
    if (b.mod === 'refleksi') return reply(await refleksi(key, cred, b));
    return reply({ ok: false, ralat: 'mod' }, 400);
  } catch (e) {
    console.error('ulasan-ai', (e as Error).message || e);
    return reply({ ok: false, ralat: clean((e as Error).message || e, 240) }, 502);
  }
});
