-- Jejak Ilmu · Berbilang tingkatan dalam SATU projek Supabase. Jalankan SELEPAS pesanan.sql dan laporan_v2.sql. Selamat dijalankan semula.
-- Skop 'T4' bermaksud "semua kelas Tingkatan 4" (kelas yang namanya bermula dengan "4 ").
-- Pesanan "Semua kelas" dari app Tingkatan 4 dihantar sebagai 'T4', jadi murid Tingkatan 2 tidak menerimanya.
-- Laporan "Semua kelas" dari app Tingkatan 4 meminta 'T4', jadi hanya kelas Tingkatan 4 dikira.

create or replace function public.pesanan_terkini(p_nama text, p_kelas text, p_pin text) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare a public.akaun; m public.pesanan_guru;
begin
  a := public._akaun(p_nama, p_kelas, p_pin);
  if a.id is null then return json_build_object('ok', false); end if;
  select * into m from public.pesanan_guru
    where (kelas is null or kelas = a.kelas or (kelas ~ '^T[0-9]+$' and a.kelas like substr(kelas, 2) || ' %')) and created_at >= now() - interval '14 days'
    order by created_at desc limit 1;
  if m.id is null then return json_build_object('ok', true, 'ada', false); end if;
  return json_build_object('ok', true, 'ada', true, 'id', m.id, 'teks', m.teks, 'durasi_s', m.durasi_s,
    'ada_audio', m.audio is not null, 'created_at', m.created_at,
    'didengar', exists (select 1 from public.pesanan_dengar d where d.pesanan_id = m.id and d.akaun_id = a.id));
end $$;

create or replace function public.pesanan_audio(p_nama text, p_kelas text, p_pin text, p_id bigint) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare a public.akaun; m public.pesanan_guru;
begin
  a := public._akaun(p_nama, p_kelas, p_pin);
  if a.id is null then return json_build_object('ok', false); end if;
  select * into m from public.pesanan_guru where id = p_id and (kelas is null or kelas = a.kelas or (kelas ~ '^T[0-9]+$' and a.kelas like substr(kelas, 2) || ' %'));
  if m.id is null or m.audio is null then return json_build_object('ok', false); end if;
  if not a.guru then
    insert into public.pesanan_dengar (pesanan_id, akaun_id) values (m.id, a.id) on conflict do nothing;
  end if;
  return json_build_object('ok', true, 'mime', m.mime, 'b64', encode(m.audio, 'base64'));
end $$;

create or replace function public.guru_pesanan_senarai(p_nama text, p_kelas text, p_pin text)
returns table (id bigint, kelas text, teks text, durasi_s int, ada_audio boolean, created_at timestamptz, didengar int, sasaran int)
language plpgsql stable security definer set search_path = public, extensions as $$
declare g public.akaun;
begin
  g := public._akaun(p_nama, p_kelas, p_pin);
  if g.id is null or not g.guru then return; end if;
  return query
  select m.id, m.kelas, m.teks, m.durasi_s, m.audio is not null, m.created_at,
         (select count(*)::int from public.pesanan_dengar d where d.pesanan_id = m.id),
         (select count(*)::int from public.akaun a where not a.guru and (m.kelas is null or a.kelas = m.kelas or (m.kelas ~ '^T[0-9]+$' and a.kelas like substr(m.kelas, 2) || ' %')))
  from public.pesanan_guru m order by m.created_at desc limit 30;
end $$;

create or replace function public.guru_laporan_harian(p_nama text, p_kelas text, p_pin text, p_kelas_tapis text, p_dari date, p_hingga date default null) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare g public.akaun; t0 timestamptz; t1 timestamptz; semua boolean; awalan text; out json;
begin
  g := public._akaun(p_nama, p_kelas, p_pin);
  if g.id is null or not g.guru then return json_build_object('ok', false); end if;
  t0 := p_dari::timestamp at time zone 'Asia/Kuala_Lumpur';
  t1 := (coalesce(p_hingga, p_dari) + 1)::timestamp at time zone 'Asia/Kuala_Lumpur';
  if t1 - t0 > interval '62 days' then return json_build_object('ok', false, 'ralat', 'julat'); end if;
  awalan := case when p_kelas_tapis ~ '^T[0-9]+$' then substr(p_kelas_tapis, 2) || ' ' end;   -- 'T4' = semua kelas Tingkatan 4
  semua := coalesce(btrim(p_kelas_tapis), '') in ('', '*') or awalan is not null;

  with m as (select a.id, a.nama, a.kelas from public.akaun a where not a.guru and (case when awalan is not null then a.kelas like awalan || '%' when semua then true else a.kelas = p_kelas_tapis end)),
  j as (select j.* from public.jawapan_rekod j join m on m.id = j.akaun_id where j.created_at >= t0 and j.created_at < t1)
  select json_build_object('ok', true, 'semua', semua, 'kelas', case when awalan is not null then p_kelas_tapis when semua then '*' else p_kelas_tapis end,
    'dari', p_dari, 'hingga', coalesce(p_hingga, p_dari),
    'murid', coalesce((select json_agg(x order by x.kelas, x.nama) from (
       select m.kelas, m.nama,
              count(j.id)::int as jawapan,
              (count(j.id) filter (where j.betul))::int as betul,
              min(j.created_at) as mula, max(j.created_at) as akhir,
              count(distinct (j.created_at at time zone 'Asia/Kuala_Lumpur')::date)::int as hari_aktif,
              (percentile_cont(0.5) within group (order by j.masa_ms))::int as masa_median_ms,
              (select coalesce(json_agg(distinct j2.set_kod), '[]'::json) from j j2 where j2.akaun_id = m.id and j2.set_kod is not null) as set_kod,
              (select coalesce(sum(xr.xp), 0)::int from public.xp_rekod xr
                 where xr.akaun_id = m.id and xr.created_at >= t0 and xr.created_at < t1 and xr.sebab is distinct from 'migrasi') as xp,
              (select coalesce(json_agg(json_build_object('rujukan', t.rujukan, 'durasi_s', t.durasi_s, 'intai', t.intai, 'gred', t.gred, 'at', t.created_at) order by t.created_at), '[]'::json)
                 from public.tasmik_rekod t where t.akaun_id = m.id and t.created_at >= t0 and t.created_at < t1) as tasmik,
              -- Kemajuan hafazan kumulatif (semua masa, sehingga akhir tempoh laporan)
              (select coalesce(json_agg(json_build_object('rujukan', t.rujukan, 'gred', t.gred, 'disemak', t.disemak_at is not null, 'intai', t.intai)), '[]'::json)
                 from public.tasmik_rekod t where t.akaun_id = m.id and t.created_at < t1) as hafazan
       from m left join j on j.akaun_id = m.id
       group by m.id, m.kelas, m.nama) x), '[]'::json),
    'sp', coalesce((select json_agg(s order by s.kelas, s.sp_kod) from (
       select m.kelas, j.sp_kod, count(*)::int as cubaan, (count(*) filter (where j.betul))::int as betul, count(distinct j.akaun_id)::int as murid
       from j join m on m.id = j.akaun_id where j.sp_kod is not null group by m.kelas, j.sp_kod) s), '[]'::json),
    'harian', coalesce((select json_agg(h order by h.kelas, h.hari) from (
       select m.kelas, (j.created_at at time zone 'Asia/Kuala_Lumpur')::date as hari, count(distinct j.akaun_id)::int as murid, count(*)::int as jawapan
       from j join m on m.id = j.akaun_id group by m.kelas, 2) h), '[]'::json),
    'jam', coalesce((select json_agg(h order by h.kelas, h.jam) from (
       select m.kelas, extract(hour from j.created_at at time zone 'Asia/Kuala_Lumpur')::int as jam, count(*)::int as jawapan
       from j join m on m.id = j.akaun_id group by m.kelas, 2) h), '[]'::json)
  ) into out;
  return out;
end $$;

grant execute on function public.pesanan_terkini(text, text, text)                    to anon, authenticated;
grant execute on function public.pesanan_audio(text, text, text, bigint)              to anon, authenticated;
grant execute on function public.guru_pesanan_senarai(text, text, text)               to anon, authenticated;
grant execute on function public.guru_laporan_harian(text, text, text, text, date, date) to anon, authenticated;
