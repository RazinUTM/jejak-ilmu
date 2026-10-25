import { createClient } from '@supabase/supabase-js';
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE;
if (!url || !key) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE (service role key, never ship it to the browser).'); process.exit(1); }
export const sb = createClient(url, key, { auth: { persistSession: false } });
