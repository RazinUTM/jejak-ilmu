/* Jejak Ilmu · Laporan PdP (PDF): satu kelas atau keseluruhan, dengan infografik dan analisis statistik.
   Dimuat hanya bila guru menekan "Muat turun PDF". Perlu jsPDF + jspdf-autotable dimuat terlebih dahulu.
   API: JejakPDF.bina(data, ctx) -> jsPDF doc;  JejakPDF.ST (fungsi statistik, untuk ujian). */
(function () {
  'use strict';

  // ---------------- Statistik ----------------
  const ST = {
    mean: a => a.reduce((s, x) => s + x, 0) / a.length,
    sd(a) { if (a.length < 2) return 0; const m = ST.mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); },
    q(a, p) { const s = [...a].sort((x, y) => x - y); const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); },
    tcrit(df) { const T = [0, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093, 2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042]; return df <= 30 ? T[Math.max(1, df)] : 1.96 + 2.4 / df; },
    ci(a) { const n = a.length; if (n < 2) return null; const m = ST.mean(a), h = ST.tcrit(n - 1) * ST.sd(a) / Math.sqrt(n); return [m - h, m + h]; },
    ranks(a) { const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const r = new Array(a.length); let i = 0; while (i < idx.length) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; const avg = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k][1]] = avg; i = j + 1; } return r; },
    pearson(x, y) { const mx = ST.mean(x), my = ST.mean(y); let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; } return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0; },
    lnGamma(z) { const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]; let x = z, y = z, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (const c of g) s += c / ++y; return -t + Math.log(2.5066282746310005 * s / x); },
    gammaQ(a, x) { // regularised upper incomplete gamma
      if (x <= 0) return 1; const gln = ST.lnGamma(a);
      if (x < a + 1) { let ap = a, sum = 1 / a, del = sum; for (let n = 0; n < 200; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-12) break; } return 1 - sum * Math.exp(-x + a * Math.log(x) - gln); }
      let b = x + 1 - a, c = 1e300, d = 1 / b, h = d; for (let i = 1; i < 200; i++) { const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300; c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-12) break; } return Math.exp(-x + a * Math.log(x) - gln) * h;
    },
    betacf(a, b, x) { let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < 1e-300) d = 1e-300; d = 1 / d; let h = d;
      for (let m = 1; m <= 200; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300; c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; h *= d * c;
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300; c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-12) break; } return h; },
    betai(a, b, x) { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(ST.lnGamma(a + b) - ST.lnGamma(a) - ST.lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x)); return x < (a + 1) / (a + b + 2) ? bt * ST.betacf(a, b, x) / a : 1 - bt * ST.betacf(b, a, 1 - x) / b; },
    tTwoSided(t, df) { return ST.betai(df / 2, 0.5, df / (df + t * t)); },
    spearman(x, y) { const n = x.length; if (n < 4) return null; const r = ST.pearson(ST.ranks(x), ST.ranks(y)); const rr = Math.min(0.999999, Math.abs(r)); const t = rr * Math.sqrt((n - 2) / (1 - rr * rr)); return { r, n, p: ST.tTwoSided(t, n - 2) }; },
    kruskal(groups) { // groups: [[values]], returns {H, df, p, eps2, N}
      const g = groups.filter(a => a.length); const all = g.flat(); const N = all.length; if (g.length < 2 || N < 6) return null;
      const r = ST.ranks(all); let k = 0, sum = 0; for (const a of g) { let R = 0; for (let i = 0; i < a.length; i++) R += r[k++]; sum += R * R / a.length; }
      let H = 12 / (N * (N + 1)) * sum - 3 * (N + 1);
      const cnt = {}; for (const v of all) cnt[v] = (cnt[v] || 0) + 1; const tie = Object.values(cnt).reduce((s, t) => s + (t ** 3 - t), 0); const C = 1 - tie / (N ** 3 - N); if (C > 0) H /= C;
      const df = g.length - 1; return { H, df, p: ST.gammaQ(df / 2, H / 2), eps2: H / (N - 1), N };
    },
  };

  // ---------------- Warna & teks ----------------
  const C = {
    ink: [11, 11, 11], ink2: [82, 81, 78], muted: [137, 135, 129], grid: [225, 224, 217], base: [195, 194, 183],
    brand: [91, 61, 201], brandSoft: [246, 243, 255], brandLine: [220, 214, 245],
    s1: [42, 120, 214], ord: [[134, 182, 239], [42, 120, 214], [16, 66, 129]], neutral: [232, 231, 226],
    seq: ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b'],
  };
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const asc = s => String(s == null ? '' : s).replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/→/g, '->').replace(/≈/g, '~').replace(/ρ/g, 'rho').replace(/ε/g, 'eps')
    .replace(/[^\x00-\xFF–—‘’“”•]/g, '');
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
  const f1 = x => (Math.round(x * 10) / 10).toFixed(1);
  const pTxt = p => p == null ? 'p = -' : p < 0.001 ? 'p < 0.001' : 'p = ' + p.toFixed(3);
  const kuatRho = r => { const a = Math.abs(r); return a < 0.1 ? 'amat lemah' : a < 0.3 ? 'lemah' : a < 0.5 ? 'sederhana' : 'kuat'; };
  const kesanEps = e => e < 0.01 ? 'sangat kecil' : e < 0.08 ? 'kecil' : e < 0.26 ? 'sederhana' : 'besar';

  function bina(d, ctx) {
    const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const AT = o => (window.autoTable ? window.autoTable(doc, o) : doc.autoTable(o));
    const W = 210, L = 14, R = 14, CW = W - L - R, BOT = 280;
    let y = 0;
    const T = (txt, x, yy, o = {}) => { doc.setFont('helvetica', o.b ? 'bold' : 'normal'); doc.setFontSize(o.s || 8); doc.setTextColor(...(o.c || C.ink)); doc.text(asc(txt), x, yy, o.opt || {}); };
    const ensure = h => { if (y + h > BOT) { doc.addPage(); y = 20; } };
    const tajuk = (t, sub) => { ensure(18); T(t, L, y, { b: 1, s: 11.5, c: C.brand }); y += 1.5; if (sub) { T(sub, L, y + 3.6, { s: 7.6, c: C.muted }); y += 4.5; } y += 3; };
    const para = (txt, o = {}) => { doc.setFont('helvetica', o.b ? 'bold' : 'normal'); doc.setFontSize(o.s || 8.6); doc.setTextColor(...(o.c || C.ink)); for (const ln of doc.splitTextToSize(asc(txt), o.w || CW)) { ensure(5); doc.text(ln, o.x || L, y); y += (o.lh || 4.3); } };

    // ---------- data ----------
    const semua = !!d.semua;
    const M = (d.murid || []).filter(m => !semua || !/lain/i.test(m.kelas)).map(m => {
      const akt = m.jawapan > 0 || (m.tasmik || []).length > 0; const acc = m.jawapan >= 5 ? m.betul / m.jawapan * 100 : null;
      const H = ctx.hafazan(m.hafazan || []);
      return { ...m, akt, acc, tp: acc == null ? null : acc < 40 ? 1 : acc < 55 ? 2 : 3, hz: H };
    });
    const kelasList = [...new Set(M.map(m => m.kelas))].sort((a, b) => a.localeCompare(b));
    const K = kelasList.map(k => {
      const ms = M.filter(m => m.kelas === k), ak = ms.filter(m => m.akt), accs = ms.filter(m => m.acc != null).map(m => m.acc);
      const jaw = ms.reduce((s, m) => s + m.jawapan, 0), bet = ms.reduce((s, m) => s + m.betul, 0);
      return { k, ms, n: ms.length, aktif: ak.length, jaw, bet, tas: ms.reduce((s, m) => s + (m.tasmik || []).length, 0), accs,
        mean: accs.length ? ST.mean(accs) : null, sd: accs.length > 1 ? ST.sd(accs) : null, med: accs.length ? ST.q(accs, 0.5) : null,
        q1: accs.length ? ST.q(accs, 0.25) : null, q3: accs.length ? ST.q(accs, 0.75) : null, ci: ST.ci(accs),
        p70: accs.length ? pct(accs.filter(a => a >= 70).length, accs.length) : null,
        hz: ms.length ? ST.mean(ms.map(m => m.hz.pct)) : 0, tp: [1, 2, 3].map(t => ms.filter(m => m.tp === t).length), spa: ak.length ? jaw / ak.length : 0 };
    });
    const all = { n: M.length, aktif: M.filter(m => m.akt).length, jaw: M.reduce((s, m) => s + m.jawapan, 0), bet: M.reduce((s, m) => s + m.betul, 0), tas: M.reduce((s, m) => s + (m.tasmik || []).length, 0) };
    const accs = M.filter(m => m.acc != null).map(m => m.acc);
    const sp = {}; for (const r of (d.sp || [])) { if (semua && /lain/i.test(r.kelas)) continue; const o = sp[r.sp_kod] = sp[r.sp_kod] || { kod: r.sp_kod, cubaan: 0, betul: 0, murid: 0, k: {} }; o.cubaan += r.cubaan; o.betul += r.betul; o.murid += r.murid; o.k[r.kelas] = r; }
    const SP = Object.values(sp).sort((a, b) => a.kod.localeCompare(b.kod, undefined, { numeric: true }));
    const satuHari = ctx.dari === ctx.hingga;
    const tajukSkop = semua ? `Semua kelas (${kelasList.length} kelas)` : d.kelas;

    // ---------- carta ----------
    function panel(x, yy, w, h, title, sub) { T(title, x, yy + 3.2, { b: 1, s: 8.8 }); if (sub) T(sub, x, yy + 7, { s: 6.8, c: C.muted }); return { x, y: yy + (sub ? 10.5 : 6.5), w, h: h - (sub ? 10.5 : 6.5) }; }
    function hbar(a, rows, o = {}) {
      const max = o.max || 100, lw = o.labelW || 20, px = a.x + lw, pw = a.w - lw - (o.valW || 15); const n = rows.length; const rowH = Math.min(7, (a.h - 5) / Math.max(1, n)); const bh = Math.min(4, rowH * 0.6);
      doc.setLineWidth(0.15); doc.setDrawColor(...C.grid);
      for (const t of (o.ticks || [0, 25, 50, 75, 100])) { const gx = px + pw * t / max; doc.line(gx, a.y, gx, a.y + n * rowH); T(o.tickFmt ? o.tickFmt(t) : t + (o.unit || ''), gx, a.y + n * rowH + 3.2, { s: 6, c: C.muted, opt: { align: 'center' } }); }
      if (o.target != null) { const gx = px + pw * o.target / max; doc.setDrawColor(...C.ink2); doc.setLineDashPattern([0.8, 0.8], 0); doc.line(gx, a.y - 1, gx, a.y + n * rowH); doc.setLineDashPattern([], 0); T(o.targetLabel || '', gx + 0.8, a.y - 0.4, { s: 5.8, c: C.ink2 }); }
      rows.forEach((r, i) => {
        const cy = a.y + i * rowH + rowH / 2; T(r.label, px - 1.5, cy + 1.1, { s: 6.8, c: C.ink2, opt: { align: 'right' } });
        const v = Math.max(0, Math.min(max, r.v || 0)), bw = pw * v / max;
        if (bw > 0.3) { doc.setFillColor(...(r.color || o.color || C.s1)); doc.roundedRect(px, cy - bh / 2, bw, bh, 0.5, 0.5, 'F'); }
        let end = px + bw;
        if (r.lo != null && r.hi != null) { const x1 = px + pw * Math.max(0, r.lo) / max, x2 = px + pw * Math.min(max, r.hi) / max; doc.setDrawColor(...C.ink); doc.setLineWidth(0.3); doc.line(x1, cy, x2, cy); doc.line(x1, cy - 1.3, x1, cy + 1.3); doc.line(x2, cy - 1.3, x2, cy + 1.3); end = Math.max(end, x2); }
        T(r.txt != null ? r.txt : Math.round(v) + (o.unit || ''), end + 1.5, cy + 1.1, { s: 6.6, c: C.ink });
      });
      doc.setDrawColor(...C.base); doc.setLineWidth(0.25); doc.line(px, a.y, px, a.y + n * rowH);
    }
    function vbar(a, items, o = {}) {
      if (o.yLabel) { T(o.yLabel, a.x, a.y + 1.2, { s: 5.8, c: C.muted }); a = { ...a, y: a.y + 3.5, h: a.h - 3.5 }; }
      const n = items.length; const lw = 8; const px = a.x + lw, pw = a.w - lw, ph = a.h - 6; const max = o.max || Math.max(1, ...items.map(i => i.v)); const nice = niceMax(max);
      doc.setLineWidth(0.15); doc.setDrawColor(...C.grid);
      const dv = [4, 5, 2, 1].find(k => Number.isInteger(nice / k)) || 4; for (let t = 0; t <= dv; t++) { const v = nice * t / dv, gy = a.y + ph - ph * v / nice; doc.line(px, gy, px + pw, gy); T(String(Math.round(v)), px - 1.2, gy + 1, { s: 5.8, c: C.muted, opt: { align: 'right' } }); }
      const cw = pw / n, bw = Math.max(0.8, cw * 0.72);
      items.forEach((it, i) => { const h = ph * it.v / nice; const x = px + i * cw + (cw - bw) / 2; if (h > 0.2) { doc.setFillColor(...(o.color || C.s1)); doc.roundedRect(x, a.y + ph - h, bw, h, 0.4, 0.4, 'F'); doc.rect(x, a.y + ph - Math.min(h, 0.6), bw, Math.min(h, 0.6), 'F'); }
        if (it.lbl) T(it.lbl, x + bw / 2, a.y + ph + 3.4, { s: 5.8, c: C.muted, opt: { align: 'center' } });
        if (o.valueLabels && it.v > 0) T(String(it.v), x + bw / 2, a.y + ph - h - 0.8, { s: 5.6, c: C.ink2, opt: { align: 'center' } }); });
      doc.setDrawColor(...C.base); doc.setLineWidth(0.25); doc.line(px, a.y + ph, px + pw, a.y + ph);
    }
    function niceMax(m) { if (m <= 5) return 5; const p = Math.pow(10, Math.floor(Math.log10(m))); for (const s of [1, 2, 2.5, 5, 10]) if (s * p >= m) return s * p; return 10 * p; }
    function stack100(a, rows, colors, legend, o = {}) {
      const lw = o.labelW || 20, px = a.x + lw, pw = a.w - lw - 2; let lx = px; // legend
      legend.forEach((t, i) => { doc.setFillColor(...colors[i]); doc.rect(lx, a.y, 2.6, 2.6, 'F'); T(t, lx + 3.4, a.y + 2.3, { s: 6.4, c: C.ink2 }); lx += 4.6 + doc.getTextWidth(asc(t)) * 1.0 + 2; });
      const y0 = a.y + 5.5, n = rows.length, rowH = Math.min(7.5, (a.h - 6) / Math.max(1, n)), bh = Math.min(4.6, rowH * 0.66);
      rows.forEach((r, i) => { const cy = y0 + i * rowH + rowH / 2; T(r.label, px - 1.5, cy + 1.1, { s: 6.8, c: C.ink2, opt: { align: 'right' } });
        const tot = r.parts.reduce((s, v) => s + v, 0); if (!tot) { T(o.empty || 'tiada data', px, cy + 1.1, { s: 6.4, c: C.muted }); return; }
        let x = px; r.parts.forEach((v, j) => { const w = pw * v / tot; if (w <= 0) return; doc.setFillColor(...colors[j]); doc.rect(x, cy - bh / 2, Math.max(0.2, w - 0.5), bh, 'F');
          const p = Math.round(v / tot * 100); if (w >= 9) { const dark = j > 0 || o.darkFirst; T(p + '%', x + (w - 0.5) / 2, cy + 1.1, { s: 6.2, b: 1, c: (o.inkOn && o.inkOn[j]) || (dark ? [255, 255, 255] : C.ink), opt: { align: 'center' } }); } x += w; }); });
    }

    // ---------- halaman 1: kepala ----------
    doc.setFillColor(...C.brand); doc.rect(0, 0, W, 24, 'F');
    T(semua ? 'LAPORAN PdP KESELURUHAN' : (satuHari ? 'LAPORAN HARIAN PdP' : 'LAPORAN PdP'), L, 11, { b: 1, s: 14, c: [255, 255, 255] });
    T('Pendidikan Islam Tingkatan 2 (KSSM) · Jejak Ilmu', L, 17, { s: 9.5, c: [255, 255, 255] });
    T(ctx.ust, W - R, 11, { s: 9, c: [255, 255, 255], opt: { align: 'right' } });
    T('Dijana: ' + ctx.sekarang, W - R, 17, { s: 9, c: [255, 255, 255], opt: { align: 'right' } });
    AT({ startY: 29, theme: 'plain', styles: { fontSize: 9, cellPadding: 1.1, textColor: C.ink }, columnStyles: { 0: { fontStyle: 'bold', cellWidth: 36 } }, margin: { left: L, right: R },
      body: [['Skop', asc(tajukSkop)], ['Tarikh', asc(ctx.tarikhLabel)], ['Pelajaran semasa', asc(ctx.pelajaran || '-')], ['Standard Pembelajaran', asc(ctx.spCur || '-')],
        ['Kaedah', 'PdPr / aktiviti dalam aplikasi Jejak Ilmu: kuiz formatif, Cabaran Harian, mod cabaran dan tasmik hafazan']] });
    y = doc.lastAutoTable.finalY + 3;

    // KPI
    const hzAll = M.length ? Math.round(ST.mean(M.map(m => m.hz.pct))) : 0;
    const kpi = [[`${all.aktif}/${all.n}`, `murid aktif (${pct(all.aktif, all.n)}%)`], [String(all.jaw), 'soalan dijawab'], [all.aktif ? f1(all.jaw / all.aktif) : '-', 'soalan / murid aktif'],
      [accs.length ? Math.round(ST.q(accs, 0.5)) + '%' : '-', 'ketepatan median'], [String(all.tas), 'tasmik diterima'], [hzAll + '%', 'kemajuan hafazan T2']];
    const bw = (CW - 5 * 2.4) / 6;
    kpi.forEach(([v, t], i) => { const x = L + i * (bw + 2.4); doc.setDrawColor(...C.brandLine); doc.setFillColor(...C.brandSoft); doc.roundedRect(x, y, bw, 15.5, 1.8, 1.8, 'FD'); T(v, x + bw / 2, y + 7.2, { b: 1, s: 12.5, c: C.brand, opt: { align: 'center' } }); T(t, x + bw / 2, y + 12.3, { s: 6.3, c: C.muted, opt: { align: 'center' } }); });
    y += 21;

    const ayat = ctx.ayat; // [{id,label}]
    const hzRows = rows => ayat.map(a => { const c = { lulus: 0, proses: 0, belum: 0 }; for (const m of rows) { const s = m.hz.st[a.id].s; if (s === 'lulus') c.lulus++; else if (s === 'belum') c.belum++; else c.proses++; } return { label: 'Ayat ' + a.label, parts: [c.lulus, c.proses, c.belum] }; });
    const HZC = [C.ord[2], C.ord[0], C.neutral], HZL = ['Lulus (TP' + ctx.lulusTP + '+)', 'Dalam proses', 'Belum'];
    const aktivitiChart = (a, kelasFilter) => {
      if (satuHari) { const by = {}; for (const r of (d.jam || [])) { if (kelasFilter && r.kelas !== kelasFilter) continue; if (semua && /lain/i.test(r.kelas)) continue; by[r.jam] = (by[r.jam] || 0) + r.jawapan; }
        const items = []; for (let h = 6; h <= 23; h++) items.push({ v: by[h] || 0, lbl: h % 3 === 0 ? (h === 12 ? '12PM' : h > 12 ? (h - 12) + 'PM' : h + 'AM') : '' }); vbar(a, items, { yLabel: 'soalan' }); }
      else { const by = {}; for (const r of (d.harian || [])) { if (kelasFilter && r.kelas !== kelasFilter) continue; if (semua && /lain/i.test(r.kelas)) continue; by[r.hari] = (by[r.hari] || 0) + r.murid; }
        const items = []; const d0 = new Date(ctx.dari + 'T00:00:00'), d1 = new Date(ctx.hingga + 'T00:00:00'); const nd = Math.round((d1 - d0) / 864e5) + 1; const step = Math.ceil(nd / 10);
        for (let i = 0; i < nd; i++) { const dt = new Date(d0); dt.setDate(dt.getDate() + i); const k = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0'); items.push({ v: by[k] || 0, lbl: i % step === 0 ? String(dt.getDate()).padStart(2, '0') + '/' + String(dt.getMonth() + 1).padStart(2, '0') : '' }); }
        vbar(a, items, { yLabel: 'murid aktif', valueLabels: nd <= 10 }); }
    };
    const PW = (CW - 8) / 2, PH = 58;

    if (!semua) {
      // ---------- A. Infografik kelas ----------
      tajuk('A. Infografik', 'Ketepatan dikira bagi murid yang menjawab sekurang-kurangnya 5 soalan dalam tempoh ini.');
      ensure(PH * 2 + 8);
      const bins = [0, 0, 0, 0, 0]; for (const a of accs) bins[Math.min(4, Math.floor(a / 20))]++;
      vbar(panel(L, y, PW, PH, 'Taburan ketepatan murid', `n = ${accs.length} murid · median ${accs.length ? Math.round(ST.q(accs, .5)) : '-'}%`), bins.map((v, i) => ({ v, lbl: `${i * 20}-${i * 20 + 20}%` })), { yLabel: 'murid', valueLabels: true });
      const K0 = K[0] || { tp: [0, 0, 0] };
      const tpPanel = panel(L + PW + 8, y, PW, PH * 0.42, 'Taburan ~TP (cadangan daripada kuiz)', '~TP1 < 40% · ~TP2 40-54% · ~TP3 >= 55% ketepatan');
      stack100(tpPanel, [{ label: d.kelas, parts: K0.tp }], C.ord, ['~TP1', '~TP2', '~TP3'], { labelW: 14, inkOn: [C.ink] });
      const hzP = panel(L + PW + 8, y + PH * 0.46, PW, PH * 0.54, 'Ayat Hafazan T2 (kumulatif)', '% murid mengikut status setiap ayat');
      stack100(hzP, hzRows(M), HZC, HZL, { labelW: 16, inkOn: [null, C.ink, C.ink] });
      y += PH + 6;
      aktivitiChart(panel(L, y, CW, PH - 4, satuHari ? 'Aktiviti mengikut jam' : 'Murid aktif setiap hari', satuHari ? 'Bilangan soalan dijawab mengikut jam (waktu Malaysia): bukti PdPr di luar waktu kelas' : 'Bilangan murid yang menjawab sekurang-kurangnya satu soalan'), null);
      y += PH + 2;
    } else {
      // ---------- A. Perbandingan kelas ----------
      tajuk('A. Perbandingan kelas', 'Ketepatan: murid dengan sekurang-kurangnya 5 jawapan. CI 95% = selang keyakinan min (taburan t).');
      AT({ startY: y, margin: { left: L, right: R }, theme: 'grid', styles: { fontSize: 7.4, cellPadding: 1.3, lineColor: [225, 225, 232], halign: 'right' }, headStyles: { fillColor: C.brand, textColor: 255, halign: 'center' },
        columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
        head: [['Kelas', 'Murid', 'Aktif', 'Soalan', 'Soalan/ aktif', 'Ketepatan min ± SD', 'Median (IQR)', '>= 70%', 'Tasmik', 'Hafazan T2']],
        body: K.map(k => [k.k, k.n, `${k.aktif} (${pct(k.aktif, k.n)}%)`, k.jaw, f1(k.spa), k.mean != null ? `${Math.round(k.mean)} ± ${Math.round(k.sd || 0)}%` : '-', k.med != null ? `${Math.round(k.med)}% (${Math.round(k.q1)}-${Math.round(k.q3)})` : '-', k.p70 != null ? k.p70 + '%' : '-', k.tas, Math.round(k.hz) + '%'])
          .concat([['Keseluruhan', all.n, `${all.aktif} (${pct(all.aktif, all.n)}%)`, all.jaw, all.aktif ? f1(all.jaw / all.aktif) : '-', accs.length ? `${Math.round(ST.mean(accs))} ± ${Math.round(ST.sd(accs))}%` : '-', accs.length ? `${Math.round(ST.q(accs, .5))}% (${Math.round(ST.q(accs, .25))}-${Math.round(ST.q(accs, .75))})` : '-', accs.length ? pct(accs.filter(a => a >= 70).length, accs.length) + '%' : '-', all.tas, hzAll + '%']]),
        didParseCell: h => { if (h.section === 'body' && h.row.index === K.length) { h.cell.styles.fontStyle = 'bold'; h.cell.styles.fillColor = C.brandSoft; } } });
      y = doc.lastAutoTable.finalY + 7;
      tajuk('B. Infografik');
      const rowsH = Math.max(PH, 14 + K.length * 7);
      ensure(rowsH * 2 + 10);
      hbar(panel(L, y, PW, rowsH, 'Penyertaan mengikut kelas', '% murid aktif dalam tempoh ini'), K.map(k => ({ label: k.k, v: pct(k.aktif, k.n), txt: `${pct(k.aktif, k.n)}% (${k.aktif}/${k.n})` })), { unit: '%', valW: 17 });
      hbar(panel(L + PW + 8, y, PW, rowsH, 'Ketepatan purata mengikut kelas', 'Min dengan CI 95% · garis putus = sasaran 70%'), K.map(k => ({ label: k.k, v: k.mean || 0, lo: k.ci ? k.ci[0] : null, hi: k.ci ? k.ci[1] : null, txt: k.mean != null ? Math.round(k.mean) + '%' : '-' })), { unit: '%', target: 70, valW: 10 });
      y += rowsH + 4;
      stack100(panel(L, y, PW, rowsH, 'Taburan ~TP mengikut kelas', '~TP1 < 40% · ~TP2 40-54% · ~TP3 >= 55% ketepatan'), K.map(k => ({ label: k.k, parts: k.tp })), C.ord, ['~TP1', '~TP2', '~TP3'], { inkOn: [C.ink] });
      hbar(panel(L + PW + 8, y, PW, rowsH, 'Kemajuan Ayat Hafazan T2', 'Purata % hafazan murid (lulus = 1, dalam proses = 0.5)'), K.map(k => ({ label: k.k, v: k.hz, txt: Math.round(k.hz) + '%' })), { unit: '%', color: C.ord[2] });
      y += rowsH + 4;
      ensure(PH);
      aktivitiChart(panel(L, y, CW, PH - 6, satuHari ? 'Aktiviti mengikut jam (semua kelas)' : 'Murid aktif setiap hari (semua kelas)', satuHari ? 'Bilangan soalan dijawab mengikut jam (waktu Malaysia)' : 'Jumlah murid yang menjawab sekurang-kurangnya satu soalan'), null);
      y += PH;
    }

    // ---------- Analisis statistik ----------
    tajuk(semua ? 'C. Analisis statistik' : 'B. Analisis statistik', 'Inferens bersifat indikatif: data formatif, murid memilih bila menjawab (bukan sampel rawak).');
    const desc = (a) => a.length ? [a.length, Math.round(Math.min(...a)) + '%', Math.round(ST.q(a, .25)) + '%', Math.round(ST.q(a, .5)) + '%', Math.round(ST.q(a, .75)) + '%', Math.round(Math.max(...a)) + '%', f1(ST.mean(a)) + '%', a.length > 1 ? f1(ST.sd(a)) : '-', ST.ci(a) ? `${Math.round(ST.ci(a)[0])}-${Math.round(ST.ci(a)[1])}%` : '-'] : [0, '-', '-', '-', '-', '-', '-', '-', '-'];
    const effort = M.filter(m => m.acc != null);
    const sp1 = ST.spearman(effort.map(m => m.jawapan), effort.map(m => m.acc));
    const spa = M.filter(m => m.akt).map(m => m.jawapan);
    AT({ startY: y, margin: { left: L, right: R }, theme: 'grid', styles: { fontSize: 7.4, cellPadding: 1.3, lineColor: [225, 225, 232], halign: 'right' }, headStyles: { fillColor: [240, 236, 252], textColor: [60, 40, 140], halign: 'center' },
      columnStyles: { 0: { halign: 'left', cellWidth: 40 } },
      head: [['Pemboleh ubah', 'n', 'Terendah', 'Q1', 'Median', 'Q3', 'Tertinggi', 'Min (purata)', 'SD', 'CI 95% bagi min']],
      body: [['Ketepatan murid (%)', ...desc(accs)],
        ['Soalan / murid aktif', spa.length, ...(spa.length ? [Math.min(...spa), f1(ST.q(spa, .25)), f1(ST.q(spa, .5)), f1(ST.q(spa, .75)), Math.max(...spa), f1(ST.mean(spa)), f1(ST.sd(spa)), ST.ci(spa) ? `${f1(ST.ci(spa)[0])}-${f1(ST.ci(spa)[1])}` : '-'] : ['-', '-', '-', '-', '-', '-', '-', '-'])],
        ['Kemajuan hafazan T2 (%)', M.length, ...(M.length ? (a => [Math.min(...a) + '%', Math.round(ST.q(a, .25)) + '%', Math.round(ST.q(a, .5)) + '%', Math.round(ST.q(a, .75)) + '%', Math.max(...a) + '%', f1(ST.mean(a)) + '%', f1(ST.sd(a)), ST.ci(a) ? `${Math.round(ST.ci(a)[0])}-${Math.round(ST.ci(a)[1])}%` : '-'])(M.map(m => m.hz.pct)) : ['-', '-', '-', '-', '-', '-', '-', '-'])]] });
    y = doc.lastAutoTable.finalY + 5;
    const ayatSt = [];
    if (sp1) ayatSt.push(`Hubungan usaha dan ketepatan: korelasi Spearman antara bilangan soalan dijawab dan ketepatan, rho = ${sp1.r.toFixed(2)} (${kuatRho(sp1.r)}, ${sp1.r >= 0 ? 'positif' : 'negatif'}), ${pTxt(sp1.p)}, n = ${sp1.n}. ${sp1.p < 0.05 ? 'Hubungan ini signifikan secara statistik pada aras 0.05' : 'Hubungan ini tidak signifikan pada aras 0.05'}; korelasi tidak membuktikan sebab-akibat.`);
    else ayatSt.push('Hubungan usaha dan ketepatan: data belum mencukupi (perlu sekurang-kurangnya 4 murid dengan 5 jawapan atau lebih).');
    if (semua) {
      const kw = ST.kruskal(K.filter(k => k.accs.length >= 3).map(k => k.accs));
      if (kw) ayatSt.push(`Perbezaan antara kelas: ujian Kruskal-Wallis ke atas ketepatan murid, H(${kw.df}) = ${kw.H.toFixed(2)}, ${pTxt(kw.p)}, saiz kesan epsilon^2 = ${kw.eps2.toFixed(3)} (${kesanEps(kw.eps2)}), N = ${kw.N}. ${kw.p < 0.05 ? 'Terdapat perbezaan ketepatan yang signifikan antara sekurang-kurangnya dua kelas; semak jadual A dan carta ketepatan untuk kelas yang berbeza.' : 'Tiada bukti perbezaan ketepatan yang signifikan antara kelas dalam tempoh ini.'}`);
      else ayatSt.push('Perbezaan antara kelas: belum cukup data untuk ujian Kruskal-Wallis (perlu sekurang-kurangnya dua kelas dengan 3 murid yang menjawab 5 soalan atau lebih).');
    }
    if (accs.length) ayatSt.push(`Ketepatan median ${Math.round(ST.q(accs, .5))}% (julat antara kuartil ${Math.round(ST.q(accs, .25))}-${Math.round(ST.q(accs, .75))}%); ${pct(accs.filter(a => a >= 70).length, accs.length)}% murid mencapai sekurang-kurangnya 70%.`);
    for (const t of ayatSt) { para('• ' + t, { s: 8.2, lh: 4 }); y += 1; }
    y += 3;

    // ---------- SP ----------
    const spHuruf = semua ? 'D' : 'C';
    tajuk(`${spHuruf}. Pencapaian mengikut Standard Pembelajaran`, semua ? '% jawapan betul. Sel kosong: kurang daripada 5 cubaan. Warna lebih gelap = pencapaian lebih tinggi.' : '% jawapan betul dalam tempoh ini; garis menegak = sasaran 70%.');
    if (semua) {
      const cols = kelasList;
      const body = SP.map(s => [s.kod, asc(ctx.spNama(s.kod) || ''), ...cols.map(k => { const r = s.k[k]; return r && r.cubaan >= 5 ? Math.round(r.betul / r.cubaan * 100) : ''; }), s.cubaan >= 5 ? Math.round(s.betul / s.cubaan * 100) : '']);
      AT({ startY: y, margin: { left: L, right: R }, theme: 'grid', head: [['SP', 'Huraian', ...cols, 'Semua']], body: body.length ? body : [['-', 'Tiada jawapan dalam tempoh ini', ...cols.map(() => ''), '']],
        styles: { fontSize: 7.2, cellPadding: 1.3, lineColor: [255, 255, 255], lineWidth: 0.4, halign: 'center' }, headStyles: { fillColor: C.brand, textColor: 255 },
        columnStyles: { 0: { cellWidth: 14, halign: 'left' }, 1: { halign: 'left', cellWidth: 52 } },
        didParseCell: h => { if (h.section === 'body' && h.column.index >= 2 && h.cell.raw !== '' && h.cell.raw != null && !isNaN(+h.cell.raw)) { const v = +h.cell.raw; const i = Math.max(0, Math.min(12, Math.round(v / 100 * 12))); h.cell.styles.fillColor = hex(C.seq[i]); h.cell.styles.textColor = i >= 7 ? [255, 255, 255] : C.ink; h.cell.text = [v + '%']; } } });
    } else {
      const rows = SP.map(s => [s.kod, asc(ctx.spNama(s.kod) || ''), s.murid, s.cubaan, Math.round(s.betul / Math.max(1, s.cubaan) * 100) + '%', '']);
      AT({ startY: y, margin: { left: L, right: R }, theme: 'grid', head: [['SP', 'Huraian', 'Murid', 'Cubaan', '% betul', '']], body: rows.length ? rows : [['-', 'Tiada jawapan direkod dalam tempoh ini', '', '', '', '']],
        styles: { fontSize: 7.8, cellPadding: 1.5, lineColor: [225, 225, 232] }, headStyles: { fillColor: C.brand, textColor: 255 },
        columnStyles: { 0: { cellWidth: 16 }, 2: { cellWidth: 13, halign: 'right' }, 3: { cellWidth: 14, halign: 'right' }, 4: { cellWidth: 15, halign: 'right' }, 5: { cellWidth: 36 } },
        didDrawCell: h => { if (h.section === 'body' && h.column.index === 5 && SP[h.row.index]) { const s = SP[h.row.index], p = s.betul / Math.max(1, s.cubaan); const c = h.cell, bw2 = c.width - 4, cy = c.y + c.height / 2;
          doc.setFillColor(...C.neutral); doc.rect(c.x + 2, cy - 1.4, bw2, 2.8, 'F'); doc.setFillColor(...C.s1); doc.rect(c.x + 2, cy - 1.4, bw2 * p, 2.8, 'F'); doc.setDrawColor(...C.ink); doc.setLineWidth(0.3); doc.line(c.x + 2 + bw2 * 0.7, cy - 2, c.x + 2 + bw2 * 0.7, cy + 2); } } });
    }
    y = doc.lastAutoTable.finalY + 7;

    // ---------- Murid perlu perhatian ----------
    const huruf = semua ? ['E', 'F', 'Lampiran'] : ['D', 'E', 'F'];
    const perhatian = M.filter(m => !m.akt).map(m => [m, 'Tidak aktif dalam tempoh ini', 'Hubungi / bimbing'])
      .concat(M.filter(m => m.acc != null && m.acc < 50).map(m => [m, `Ketepatan ${Math.round(m.acc)}% (${m.jawapan} soalan)`, 'Latihan pengukuhan']))
      .concat(M.filter(m => (m.tasmik || []).some(t => t.intai >= 3)).map(m => [m, 'Tasmik dengan intai teks >= 3 kali', 'Bimbing hafazan']))
      .sort((a, b) => String(a[0].kelas).localeCompare(String(b[0].kelas)) || String(a[0].nama).localeCompare(String(b[0].nama)));
    if (!semua) {
      tajuk(`${huruf[0]}. Keputusan individu (bukti aktiviti bertarikh masa)`, satuHari ? 'Masa = jawapan pertama hingga terakhir pada hari ini.' : 'Terakhir = masa jawapan terakhir dalam tempoh ini.');
      individu(M);
      y = doc.lastAutoTable.finalY + 7;
      tajuk(`${huruf[1]}. Murid perlu perhatian`);
    } else tajuk(`${huruf[0]}. Murid perlu perhatian`);
    AT({ startY: y, margin: { left: L, right: R }, theme: 'grid', styles: { fontSize: 7.6, cellPadding: 1.3, lineColor: [225, 225, 232] }, headStyles: { fillColor: [240, 236, 252], textColor: [60, 40, 140] },
      head: [semua ? ['Kelas', 'Nama', 'Pemerhatian', 'Tindakan susulan'] : ['Nama', 'Pemerhatian', 'Tindakan susulan']],
      body: perhatian.length ? perhatian.map(([m, o, t]) => semua ? [m.kelas, asc(m.nama), o, t] : [asc(m.nama), o, t]) : [semua ? ['-', '-', 'Tiada', '-'] : ['-', 'Tiada', '-']] });
    y = doc.lastAutoTable.finalY + 7;

    // ---------- Refleksi + tandatangan ----------
    tajuk(`${semua ? huruf[1] : huruf[2]}. Refleksi`);
    para(ctx.refleksi || '-', { s: 9.2, lh: 4.7 });
    y += 6; ensure(30);
    doc.setFontSize(9); doc.setTextColor(...C.ink); doc.setDrawColor(150, 150, 160); doc.setLineWidth(0.2);
    doc.line(L, y + 12, L + 70, y + 12); T('Disediakan oleh:', L, y, { s: 9 }); T(ctx.ust, L, y + 17, { s: 9 }); T('Tarikh:', L, y + 22, { s: 9 });
    doc.line(W - R - 70, y + 12, W - R, y + 12); T('Disemak oleh (Pentadbir):', W - R - 70, y, { s: 9 }); T('Nama & cop:', W - R - 70, y + 17, { s: 9 }); T('Tarikh:', W - R - 70, y + 22, { s: 9 });
    y += 28;

    // ---------- Lampiran (keseluruhan): keputusan individu setiap kelas ----------
    if (semua) {
      for (const k of K) {
        doc.addPage(); y = 20;
        T(`Lampiran · Keputusan individu: ${k.k}`, L, y, { b: 1, s: 11.5, c: C.brand }); y += 5;
        T(`${k.aktif}/${k.n} murid aktif · ${k.jaw} soalan · ketepatan median ${k.med != null ? Math.round(k.med) + '%' : '-'} · tasmik ${k.tas} · hafazan T2 ${Math.round(k.hz)}%`, L, y, { s: 8, c: C.ink2 }); y += 4;
        individu(k.ms);
      }
    }

    function individu(rows) {
      const head = ['Bil', 'Nama murid', satuHari ? 'Masa' : 'Terakhir', ...(satuHari ? [] : ['Hari']), 'Aktiviti', 'Soalan', 'Betul', '~TP', 'XP', 'Hafazan', 'Tasmik (tempoh ini)'];
      const body = rows.map((m, i) => { const t = (m.tasmik || []).map(x => `${String(x.rujukan || '').replace(/^Surah Ali Imran /, '').split(' · ')[0]}${x.gred ? ' [' + x.gred + ']' : ''}${x.intai ? ' intai ' + x.intai : ''}`).join('; ');
        return [i + 1, asc(m.nama), m.akt && m.mula ? (satuHari ? `${ctx.jam(m.mula)}-${ctx.jam(m.akhir)}` : ctx.tarikhJam(m.akhir)) : '-', ...(satuHari ? [] : [m.hari_aktif || 0]), asc((m.set_kod || []).map(ctx.setNama).join(', ')) || '-', m.jawapan, m.jawapan ? Math.round(m.betul / m.jawapan * 100) + '%' : '-', m.tp ? 'TP' + m.tp : '-', m.xp || 0, m.hz.pct + '%', asc(t) || '-']; });
      const cs = satuHari ? { 0: { cellWidth: 7, halign: 'right' }, 1: { cellWidth: 33 }, 2: { cellWidth: 25 }, 3: { cellWidth: 25 }, 4: { cellWidth: 11, halign: 'right' }, 5: { cellWidth: 11, halign: 'right' }, 6: { cellWidth: 9 }, 7: { cellWidth: 9, halign: 'right' }, 8: { cellWidth: 13, halign: 'right' } }
        : { 0: { cellWidth: 7, halign: 'right' }, 1: { cellWidth: 32 }, 2: { cellWidth: 22 }, 3: { cellWidth: 9, halign: 'right' }, 4: { cellWidth: 22 }, 5: { cellWidth: 11, halign: 'right' }, 6: { cellWidth: 11, halign: 'right' }, 7: { cellWidth: 9 }, 8: { cellWidth: 9, halign: 'right' }, 9: { cellWidth: 13, halign: 'right' } };
      AT({ startY: y, head: [head], body, theme: 'striped', margin: { left: L, right: R }, styles: { fontSize: 6.9, cellPadding: 1.2, overflow: 'linebreak' }, headStyles: { fillColor: C.brand, textColor: 255, fontSize: 6.9 }, alternateRowStyles: { fillColor: [248, 247, 252] }, columnStyles: cs,
        didParseCell: h => { if (h.section === 'body') { const m = rows[h.row.index]; if (m && !m.akt) h.cell.styles.textColor = [150, 150, 160]; } } });
    }

    // ---------- kaki & kepala berjalan ----------
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) { doc.setPage(i);
      if (i > 1) { T(`Laporan PdP · ${tajukSkop} · ${ctx.tarikhLabel}`, L, 10, { s: 7.5, c: C.muted }); doc.setDrawColor(...C.grid); doc.setLineWidth(0.2); doc.line(L, 12, W - R, 12); }
      T('Dijana oleh Jejak Ilmu daripada log aktiviti bertarikh masa (waktu Malaysia). Data kuiz ialah penilaian formatif; ~TP ialah cadangan, bukan pentaksiran rasmi.', L, 290, { s: 6.2, c: C.muted, opt: { maxWidth: CW - 22 } });
      T(`Halaman ${i}/${n}`, W - R, 290, { s: 7.5, c: C.muted, opt: { align: 'right' } }); }
    return doc;
  }

  window.JejakPDF = { bina, ST };
})();
