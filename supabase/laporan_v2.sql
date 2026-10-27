-- Jejak Ilmu · Laporan PdP v2: satu kelas ATAU semua kelas ('*'), dengan data untuk infografik dan analisis.
-- Jalankan SELEPAS laporan.sql. Menggantikan guru_laporan_harian (tandatangan sama). Selamat dijalankan semula.

create or replace function public.guru_laporan_harian(p_nama text, p_kelas text, p_pin text, p_kelas_tapis text, p_dari date, p_hingga date default null) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare g public.akaun; t0 timestamptz; t1 timestamptz; semua boolean; out json;
begin
  g := public._akaun(p_nama, p_kelas, p_pin);
  if g.id is null or not g.guru then return json_build_object('ok', false); end if;
  t0 := p_dari::timestamp at time zone 'Asia/Kuala_Lumpur';
  t1 := (coalesce(p_hingga, p_dari) + 1)::timestamp at time zone 'Asia/Kuala_Lumpur';
  if t1 - t0 > interval '62 days' then return json_build_object('ok', false, 'ralat', 'julat'); end if;
  semua := coalesce(btrim(p_kelas_tapis), '') in ('', '*');

  with m as (select a.id, a.nama, a.kelas from public.akaun a where not a.guru and (semua or a.kelas = p_kelas_tapis)),
  j as (select j.* from public.jawapan_rekod j join m on m.id = j.akaun_id where j.created_at >= t0 and j.created_at < t1)
  select json_build_object('ok', true, 'semua', semua, 'kelas', case when semua then '*' else p_kelas_tapis end,
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

grant execute on function public.guru_laporan_harian(text, text, text, text, date, date) to anon, authenticated;
