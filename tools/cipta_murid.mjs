// Create student accounts (name + class + 4-digit PIN) from the "Murid" sheet exported as CSV.
//   node cipta_murid.mjs --csv murid.csv
// Login in the app = synthetic email <slug>.<kelas>@murid.jejak-ilmu.local + password = PIN + PIN_SUFFIX (Supabase needs ≥6 chars).
// Re-running updates the PIN for existing accounts. Never publish the Murid sheet to the web.
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'node:fs';
import { sb } from './_client.mjs';

const PIN_SUFFIX = process.env.PIN_SUFFIX || '-ji';   // must match docs/js/config.js pinSuffix
const file = process.argv[process.argv.indexOf('--csv') + 1];
const rows = parse(readFileSync(file, 'utf8'), { columns: true, skip_empty_lines: true, bom: true, trim: true });
const slug = s => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const emailFor = (nama, kelas) => `${slug(nama)}.${slug(kelas)}@murid.jejak-ilmu.local`;

for (const r of rows) {
  const pin = (r.pin_4_digit || r.pin_6_digit || '').trim();
  if (!r.nama || !r.kelas || !/^\d{4,6}$/.test(pin)) { console.log(`langkau: ${JSON.stringify(r)} (perlu nama, kelas, pin 4 digit)`); continue; }
  const kelasId = r.kelas.replace(/\s+/g, '').toUpperCase().replace(/^(\d)([A-Z])\w*$/, '$1$2'); // '2 Amanah' → '2A'
  await sb.from('kelas').upsert({ id: kelasId, nama: r.kelas });
  const email = emailFor(r.nama, r.kelas);
  const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users.find(u => u.email === email);
  let uid;
  if (existing) { uid = existing.id; await sb.auth.admin.updateUserById(uid, { password: pin + PIN_SUFFIX }); }
  else { const { data, error } = await sb.auth.admin.createUser({ email, password: pin + PIN_SUFFIX, email_confirm: true, user_metadata: { nama: r.nama, kelas: r.kelas } }); if (error) { console.log(`gagal ${r.nama}: ${error.message}`); continue; } uid = data.user.id; }
  await sb.from('murid').upsert({ id: uid, nama: r.nama, kelas_id: kelasId, peranan: /guru/i.test(r.catatan || '') ? 'guru' : 'murid' });
  console.log(`${existing ? 'kemas kini' : 'cipta'}: ${r.nama} (${r.kelas})`);
}
