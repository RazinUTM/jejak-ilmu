// Copy to config.js and fill in from Supabase → Project Settings → API. The anon key is safe in the browser (RLS protects data).
window.JEJAK_CONFIG = {
  supabaseUrl: 'https://YOUR-PROJECT.supabase.co',
  supabaseAnonKey: 'YOUR-ANON-KEY',
  emailDomain: 'murid.jejak-ilmu.local',   // must match tools/cipta_murid.mjs
  pinSuffix: '-ji',                        // appended to the 4-digit PIN; must match PIN_SUFFIX in tools
};
