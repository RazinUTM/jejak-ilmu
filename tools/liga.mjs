// Weekly league assignment. Run every Monday (GitHub Actions cron) or by hand: node liga.mjs
// Rules: rank by XP earned last week within each league; top 3 of a group go up, bottom 2 go down
// (no demotion from Pelita, no promotion from Suria). Groups of 10 by similar XP. New students start in Pelita.
import { sb } from './_client.mjs';

const monday = d => { d = new Date(d); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d; };
const thisWeek = monday(new Date()), lastWeek = new Date(thisWeek); lastWeek.setUTCDate(lastWeek.getUTCDate() - 7);
const iso = d => d.toISOString().slice(0, 10);
const ORDER = ['pelita', 'purnama', 'suria'];

const { data: murid } = await sb.from('murid').select('id').eq('peranan', 'murid');
const { data: prev } = await sb.from('liga_minggu').select('murid_id, liga, kumpulan').eq('minggu', iso(lastWeek));
const { data: xp } = await sb.from('xp_log').select('murid_id, xp').gte('created_at', lastWeek.toISOString()).lt('created_at', thisWeek.toISOString());
const xpBy = {}; for (const r of xp || []) xpBy[r.murid_id] = (xpBy[r.murid_id] || 0) + r.xp;
const prevBy = Object.fromEntries((prev || []).map(r => [r.murid_id, r]));

// 1) decide next league per student
const next = {};
const groups = {};
for (const m of murid || []) { const p = prevBy[m.id] || { liga: 'pelita', kumpulan: 0 }; (groups[p.liga + '#' + p.kumpulan] ||= []).push({ id: m.id, liga: p.liga, xp: xpBy[m.id] || 0 }); }
for (const g of Object.values(groups)) {
  g.sort((a, b) => b.xp - a.xp);
  g.forEach((s, i) => {
    let li = ORDER.indexOf(s.liga);
    if (i < 3 && s.xp > 0) li = Math.min(2, li + 1);
    else if (i >= g.length - 2 && g.length >= 6) li = Math.max(0, li - 1);
    next[s.id] = ORDER[li];
  });
}
// 2) regroup each league into groups of 10 (sorted by last week's XP so similar effort sits together)
const rows = [];
for (const liga of ORDER) {
  const ids = Object.keys(next).filter(id => next[id] === liga).sort((a, b) => (xpBy[b] || 0) - (xpBy[a] || 0));
  ids.forEach((id, i) => rows.push({ minggu: iso(thisWeek), murid_id: id, liga, kumpulan: Math.floor(i / 10) + 1, xp: 0 }));
}
if (rows.length) { const { error } = await sb.from('liga_minggu').upsert(rows); if (error) throw error; }
console.log(`liga ${iso(thisWeek)}: ${rows.length} murid → ` + ORDER.map(l => `${l} ${rows.filter(r => r.liga === l).length}`).join(', '));
