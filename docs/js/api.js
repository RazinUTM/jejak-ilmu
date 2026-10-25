// Thin data layer for the real app. Load after:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>
// <script src="js/config.js"></script>
// Every function returns plain objects; the UI code from the prototype calls these instead of reading demo constants.
(function () {
  const C = window.JEJAK_CONFIG; const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey);
  const slug = s => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const emailFor = (nama, kelas) => `${slug(nama)}.${slug(kelas)}@${C.emailDomain}`;
  // short, stable-ish device hash for integrity signals (not tracking): UA + screen + timezone
  const peranti = () => { const s = [navigator.userAgent, screen.width, screen.height, Intl.DateTimeFormat().resolvedOptions().timeZone].join('|'); let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h.toString(36); };

  const api = {
    sb, emailFor,
    // ---- auth ----
    loginPin: (nama, kelas, pin) => sb.auth.signInWithPassword({ email: emailFor(nama, kelas), password: pin + (C.pinSuffix || '-ji') }),
    loginGoogle: () => sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } }),
    tukarPin: pin => sb.auth.updateUser({ password: pin + (C.pinSuffix || '-ji') }),
    logout: () => sb.auth.signOut(),
    onAuth: cb => sb.auth.onAuthStateChange((_e, s) => cb(s?.user || null)),
    me: async () => { const { data: { user } } = await sb.auth.getUser(); if (!user) return null; const { data } = await sb.from('murid').select('*, kelas(nama)').eq('id', user.id).single(); return data; },
    // ---- content ----
    bank: async () => {
      const [p, s, q] = await Promise.all([sb.from('pelajaran').select('*').order('n'), sb.from('sp').select('*'), sb.from('soalan').select('*').eq('aktif', true)]);
      return { pelajaran: p.data || [], sp: s.data || [], soalan: q.data || [] };
    },
    // ---- quiz logging: items = quiz.items, answers = quiz.answers (prototype shapes) ----
    logSesi: async ({ setKod, items, answers, timings = [], xpEntries = [] }) => {
      const { data: { user } } = await sb.auth.getUser(); if (!user) throw new Error('belum log masuk');
      const sesi = crypto.randomUUID(); const dev = peranti();
      const rows = items.map((it, k) => ({ murid_id: user.id, soalan_id: it.id, sp_kod: it.sp, set_kod: setKod, sesi, betul: !!answers[k]?.ok, masa_ms: timings[k] || null, peranti: dev }));
      const { error } = await sb.from('percubaan').insert(rows); if (error) throw error;
      if (xpEntries.length) await sb.from('xp_log').insert(xpEntries.map(e => ({ murid_id: user.id, sebab: e.sebab, xp: e.xp, rujukan: sesi })));
      return sesi;
    },
    // ---- derived ----
    mastery: async () => { const { data: { user } } = await sb.auth.getUser(); const { data } = await sb.from('penguasaan').select('*').eq('murid_id', user.id); return Object.fromEntries((data || []).map(r => [r.sp_kod, r.mastery])); },
    usaha: async () => { const { data: { user } } = await sb.auth.getUser(); const { data } = await sb.from('usaha_bulan').select('*').eq('murid_id', user.id).single(); return data; },
    xp: async () => { const { data: { user } } = await sb.auth.getUser(); const { data } = await sb.from('xp_jumlah').select('*').eq('murid_id', user.id).single(); return data || { xp: 0, xp_minggu: 0 }; },
    liga: async () => { const { data } = await sb.from('liga_minggu').select('liga,kumpulan,xp,murid:murid_id(nama,kelas_id)').order('xp', { ascending: false }); return data || []; },
    pesanan: async () => { const { data } = await sb.from('pesanan').select('*').order('created_at', { ascending: false }).limit(1); const p = data?.[0]; if (p?.audio) { const { data: u } = await sb.storage.from('pesanan').createSignedUrl(p.audio, 3600); p.audioUrl = u?.signedUrl; } return p || null; },
    // ---- teacher ----
    heatmap: async (kelasId) => {
      const { data: murid } = await sb.from('murid').select('id,nama').eq('kelas_id', kelasId).eq('peranan', 'murid').order('nama');
      const ids = (murid || []).map(m => m.id);
      const { data: pg } = await sb.from('penguasaan').select('*').in('murid_id', ids);
      const { data: last } = await sb.from('percubaan').select('murid_id, created_at').in('murid_id', ids).order('created_at', { ascending: false });
      const lastBy = {}; for (const r of last || []) lastBy[r.murid_id] ||= r.created_at;
      return (murid || []).map(m => ({ ...m, sp: Object.fromEntries((pg || []).filter(r => r.murid_id === m.id).map(r => [r.sp_kod, r.mastery])), aktif: lastBy[m.id] || null }));
    },
    hantarPesanan: async ({ kelasId, teks, blob }) => {
      const { data: { user } } = await sb.auth.getUser(); let audio = null;
      if (blob) { audio = `${crypto.randomUUID()}.webm`; const { error } = await sb.storage.from('pesanan').upload(audio, blob, { contentType: blob.type || 'audio/webm' }); if (error) throw error; }
      return sb.from('pesanan').insert({ guru_id: user.id, kelas_id: kelasId, teks, audio });
    },
    // ---- tasmik ----
    hantarTasmik: async ({ blob, ayat, durasi, intai }) => {
      const { data: { user } } = await sb.auth.getUser(); const path = `${user.id}/${crypto.randomUUID()}.webm`;
      const { error } = await sb.storage.from('tasmik').upload(path, blob, { contentType: blob.type || 'audio/webm' }); if (error) throw error;
      await sb.from('tasmik').insert({ murid_id: user.id, ayat, fail: path, durasi_s: durasi, intai });
      await sb.from('xp_log').insert({ murid_id: user.id, sebab: 'tasmik', xp: 30, rujukan: path });
      return path;
    },
    petiTasmik: async () => { const { data } = await sb.from('tasmik').select('*, murid:murid_id(nama,kelas_id)').order('created_at', { ascending: false }).limit(50); return data || []; },
    urlTasmik: async path => (await sb.storage.from('tasmik').createSignedUrl(path, 3600)).data?.signedUrl,
    gredTasmik: (id, gred, komen) => sb.from('tasmik').update({ gred, komen, disemak_at: new Date().toISOString() }).eq('id', id),
  };
  window.jejak = api;
})();
