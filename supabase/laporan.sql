-- Jejak Ilmu · Kad Laporan disegerakkan, Ulasan Ustazah (disahkan guru) dan Laporan Harian PdP.
-- Jalankan SELEPAS liga.sql, tasmik_import.sql dan jawapan.sql. Selamat dijalankan semula.

-- ===================== KAD LAPORAN IKUT MURID =====================
-- Salinan kemajuan murid (XP tempatan, usaha, lencana, misi, dll.) supaya sama di mana-mana telefon.
create table if not exists public.kemajuan (
  akaun_id    bigint primary key references public.akaun(id) on delete cascade,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);
alter table public.kemajuan enable row level security;

create or replace function public.simpan_kemajuan(p_nama text, p_kelas text, p_pin text, p_data json) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare a public.akaun;
begin
  a := public._akaun(p_nama, p_kelas, p_pin);
  if a.id is null or a.guru then return json_build_object('ok', false); end if;
  if p_data is null or length(p_data::text) > 200000 then return json_build_object('ok', false, 'ralat', 'saiz'); end if;
  insert into public.kemajuan (akaun_id, data, updated_at) values (a.id, p_data::jsonb, now())
  on conflict (akaun_id) do update set data = excluded.data, updated_at = now();
  return json_build_object('ok', true);
end $$;

-- Ulasan Ustazah yang telah disahkan (sumber: 'guru' ditulis sendiri, 'ai' draf AI yang disemak dan disahkan guru).
create table if not exists public.ulasan (
  id           bigint generated always as identity primary key,
  akaun_id     bigint not null references public.akaun(id) on delete cascade,
  teks         text not null,
  sumber       text not null default 'guru',
  guru_id      bigint references public.akaun(id) on delete set null,
  disahkan_at  timestamptz not null default now()
);
create index if not exists ulasan_akaun_idx on public.ulasan (akaun_id, disahkan_at desc);
alter table public.ulasan enable row level security;

-- Murid: ambil salinan kemajuan + penguasaan SP dari log jawapan (sama di semua telefon) + ulasan terkini.
create or replace function public.ambil_kemajuan(p_nama text, p_kelas text, p_pin text) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare a public.akaun; k public.kemajuan; u public.ulasan; sp json;
begin
  a := public._akaun(p_nama, p_kelas, p_pin);
  if a.id is null then return json_build_object('ok', false); end if;
  select * into k from public.kemajuan where akaun_id = a.id;
  select * into u from public.ulasan where akaun_id = a.id order by disahkan_at desc limit 1;
  select coalesce(json_object_agg(s.sp_kod, json_build_object('m', s.m, 'c', s.c)), '{}'::json) into sp from (
    select r.sp_kod,
           round(100 * sum(case when r.betul then power(0.7, r.k - 1) else 0 end) / sum(power(0.7, r.k - 1)))::int as m,
           count(*)::int as c
    from (select j.sp_kod, j.betul, row_number() over (partition by j.sp_kod order by j.created_at desc) as k
          from public.jawapan_rekod j where j.akaun_id = a.id and j.sp_kod is not null) r
    where r.k <= 12 group by r.sp_kod) s;
  return json_build_object('ok', true,
    'data', k.data, 'updated_at', k.updated_at, 'sp', sp,
    'xp', (select coalesce(sum(xp), 0) from public.xp_rekod where akaun_id = a.id),
    'jawapan', (select count(*) from public.jawapan_rekod where akaun_id = a.id),
    'tasmik', (select count(*) from public.tasmik_rekod where akaun_id = a.id),
    'ulasan', case when u.id is null then null else json_build_object('teks', u.teks, 'disahkan_at', u.disahkan_at) end);
end $$;

-- ===================== ULASAN (GURU) =====================
-- Senarai murid satu kelas + ringkasan 14 hari (untuk draf AI dan semakan guru) + ulasan terkini.
create or replace function public.guru_ulasan_senarai(p_nama text, p_kelas text, p_pin text, p_kelas_tapis text)
returns table (akaun_id bigint, nama text, hari_aktif int, jawapan int, betul int, tasmik int, tasmik_intai int,
               xp_14h int, sp_kuat json, sp_lemah json, ulasan text, ulasan_sumber text, ulasan_at timestamptz)
language plpgsql stable security definer set search_path = public, extensions as $$
declare g public.akaun;
begin
  g := public._akaun(p_nama, p_kelas, p_pin);
  if g.id is null or not g.guru then return; end if;
  return query
  with m as (
    select r.akaun_id, r.sp_kod,
           round(100 * sum(case when r.betul then power(0.7, r.k - 1) else 0 end) / sum(power(0.7, r.k - 1)))::int as mas,
           count(*)::int as c
    from (select j.akaun_id, j.sp_kod, j.betul, row_number() over (partition by j.akaun_id, j.sp_kod order by j.created_at desc) as k
          from public.jawapan_rekod j join public.akaun a on a.id = j.akaun_id
          where a.kelas = p_kelas_tapis and j.sp_kod is not null) r
    where r.k <= 12 group by r.akaun_id, r.sp_kod
  )
  select a.id, a.nama,
    (select count(distinct (j.created_at at time zone 'Asia/Kuala_Lumpur')::date)::int from public.jawapan_rekod j where j.akaun_id = a.id and j.created_at >= now() - interval '14 days'),
    (select count(*)::int from public.jawapan_rekod j where j.akaun_id = a.id and j.created_at >= now() - interval '14 days'),
    (select count(*)::int from public.jawapan_rekod j where j.akaun_id = a.id and j.created_at >= now() - interval '14 days' and j.betul),
    (select count(*)::int from public.tasmik_rekod t where t.akaun_id = a.id and t.created_at >= now() - interval '14 days'),
    (select coalesce(sum(t.intai), 0)::int from public.tasmik_rekod t where t.akaun_id = a.id and t.created_at >= now() - interval '14 days'),
    (select coalesce(sum(x.xp), 0)::int from public.xp_rekod x where x.akaun_id = a.id and x.created_at >= now() - interval '14 days' and x.sebab is distinct from 'migrasi'),
    (select coalesce(json_agg(json_build_object('k', m.sp_kod, 'm', m.mas, 'c', m.c) order by m.mas desc), '[]'::json)
       from (select * from m where m.akaun_id = a.id and m.mas >= 70 and m.c >= 2 order by m.mas desc limit 2) m),
    (select coalesce(json_agg(json_build_object('k', m.sp_kod, 'm', m.mas, 'c', m.c) order by m.mas), '[]'::json)
       from (select * from m where m.akaun_id = a.id and m.mas < 60 and m.c >= 2 order by m.mas limit 2) m),
    u.teks, u.sumber, u.disahkan_at
  from public.akaun a
  left join lateral (select * from public.ulasan x where x.akaun_id = a.id order by x.disahkan_at desc limit 1) u on true
  where a.kelas = p_kelas_tapis and not a.guru
  order by a.nama;
end $$;

-- Guru mengesahkan ulasan (teks akhir; boleh berasal daripada draf AI yang telah disunting).
create or replace function public.guru_ulasan_sahkan(p_nama text, p_kelas text, p_pin text, p_akaun_id bigint, p_teks text, p_sumber text default 'guru') returns json
language plpgsql security definer set search_path = public, extensions as $$
declare g public.akaun;
begin
  g := public._akaun(p_nama, p_kelas, p_pin);
  if g.id is null or not g.guru then return json_build_object('ok', false, 'ralat', 'bukan_guru'); end if;
  if coalesce(btrim(p_teks), '') = '' then return json_build_object('ok', false, 'ralat', 'kosong'); end if;
  if not exists (select 1 from public.akaun where id = p_akaun_id and not guru) then return json_build_object('ok', false, 'ralat', 'tiada'); end if;
  insert into public.ulasan (akaun_id, teks, sumber, guru_id)
  values (p_akaun_id, left(btrim(p_teks), 800), case when p_sumber = 'ai' then 'ai' else 'guru' end, g.id);
  return json_build_object('ok', true);
end $$;

-- ===================== LAPORAN HARIAN PdP =====================
-- Bukti aktiviti setiap murid dalam satu kelas bagi julat tarikh (waktu Malaysia), termasuk murid yang tidak aktif.
create or replace function public.guru_laporan_harian(p_nama text, p_kelas text, p_pin text, p_kelas_tapis text, p_dari date, p_hingga date default null) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare g public.akaun; t0 timestamptz; t1 timestamptz; out json;
begin
  g := public._akaun(p_nama, p_kelas, p_pin);
  if g.id is null or not g.guru then return json_build_object('ok', false); end if;
  t0 := p_dari::timestamp at time zone 'Asia/Kuala_Lumpur';
  t1 := (coalesce(p_hingga, p_dari) + 1)::timestamp at time zone 'Asia/Kuala_Lumpur';
  if t1 - t0 > interval '62 days' then return json_build_object('ok', false, 'ralat', 'julat'); end if;
  select json_build_object('ok', true, 'kelas', p_kelas_tapis, 'dari', p_dari, 'hingga', coalesce(p_hingga, p_dari),
    'murid', coalesce((select json_agg(x order by x.nama) from (
       select a.nama,
              count(j.id)::int as jawapan,
              (count(j.id) filter (where j.betul))::int as betul,
              min(j.created_at) as mula, max(j.created_at) as akhir,
              (percentile_cont(0.5) within group (order by j.masa_ms))::int as masa_median_ms,
              (select coalesce(json_agg(distinct j2.set_kod), '[]'::json) from public.jawapan_rekod j2
                 where j2.akaun_id = a.id and j2.created_at >= t0 and j2.created_at < t1 and j2.set_kod is not null) as set_kod,
              (select coalesce(sum(xr.xp), 0)::int from public.xp_rekod xr
                 where xr.akaun_id = a.id and xr.created_at >= t0 and xr.created_at < t1 and xr.sebab is distinct from 'migrasi') as xp,
              (select coalesce(json_agg(json_build_object('rujukan', t.rujukan, 'durasi_s', t.durasi_s, 'intai', t.intai, 'gred', t.gred, 'at', t.created_at) order by t.created_at), '[]'::json)
                 from public.tasmik_rekod t where t.akaun_id = a.id and t.created_at >= t0 and t.created_at < t1) as tasmik
       from public.akaun a
       left join public.jawapan_rekod j on j.akaun_id = a.id and j.created_at >= t0 and j.created_at < t1
       where a.kelas = p_kelas_tapis and not a.guru
       group by a.id, a.nama) x), '[]'::json),
    'sp', coalesce((select json_agg(s order by s.sp_kod) from (
       select j.sp_kod, count(*)::int as cubaan, (count(*) filter (where j.betul))::int as betul, count(distinct j.akaun_id)::int as murid
       from public.jawapan_rekod j join public.akaun a on a.id = j.akaun_id
       where a.kelas = p_kelas_tapis and j.created_at >= t0 and j.created_at < t1 and j.sp_kod is not null
       group by j.sp_kod) s), '[]'::json)
  ) into out;
  return out;
end $$;

grant execute on function public.simpan_kemajuan(text, text, text, json)                     to anon, authenticated;
grant execute on function public.ambil_kemajuan(text, text, text)                            to anon, authenticated;
grant execute on function public.guru_ulasan_senarai(text, text, text, text)                 to anon, authenticated;
grant execute on function public.guru_ulasan_sahkan(text, text, text, bigint, text, text)    to anon, authenticated;
grant execute on function public.guru_laporan_harian(text, text, text, text, date, date)     to anon, authenticated;
