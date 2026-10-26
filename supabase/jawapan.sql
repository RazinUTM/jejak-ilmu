-- Jejak Ilmu · Log jawapan + papan guru sebenar. Jalankan SELEPAS liga.sql. Selamat dijalankan semula.

create table if not exists public.jawapan_rekod (
  id          bigint generated always as identity primary key,
  akaun_id    bigint not null references public.akaun(id) on delete cascade,
  soalan_id   text not null,
  sp_kod      text,
  pel         int,
  set_kod     text,
  betul       boolean not null,
  masa_ms     int,
  peranti     text,
  created_at  timestamptz not null default now()
);
create index if not exists jawapan_akaun_masa_idx on public.jawapan_rekod (akaun_id, created_at desc);
create index if not exists jawapan_akaun_sp_idx   on public.jawapan_rekod (akaun_id, sp_kod, created_at desc);
create index if not exists jawapan_soalan_idx     on public.jawapan_rekod (soalan_id);
alter table public.jawapan_rekod enable row level security;

-- Murid: hantar jawapan secara berkelompok (maks 60 sekali, 1500 sehari).
create or replace function public.catat_jawapan(p_nama text, p_kelas text, p_pin text, p_rows json, p_peranti text default null) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare a public.akaun; n int; hari int;
begin
  a := public._akaun(p_nama, p_kelas, p_pin);
  if a.id is null then return json_build_object('ok', false, 'ralat', 'pin'); end if;
  n := coalesce(json_array_length(p_rows), 0);
  if n = 0 then return json_build_object('ok', true, 'n', 0); end if;
  if n > 60 then return json_build_object('ok', false, 'ralat', 'had'); end if;
  select count(*) into hari from public.jawapan_rekod where akaun_id = a.id and created_at >= public._awal_hari();
  if hari + n > 1500 then return json_build_object('ok', false, 'ralat', 'had_harian'); end if;
  insert into public.jawapan_rekod (akaun_id, soalan_id, sp_kod, pel, set_kod, betul, masa_ms, peranti)
  select a.id, left(coalesce(x->>'s', '?'), 40), left(x->>'sp', 20),
         case when (x->>'p') ~ '^[0-9]{1,3}$' then (x->>'p')::int end,
         left(x->>'set', 20), coalesce((x->>'b')::boolean, false),
         case when (x->>'ms') ~ '^[0-9]{1,9}$' then least((x->>'ms')::int, 3600000) end,
         left(p_peranti, 16)
  from json_array_elements(p_rows) x;
  return json_build_object('ok', true, 'n', n);
end $$;

-- Guru: penguasaan murid × SP (purata berwajaran 12 cubaan terkini; cubaan terbaharu paling berat).
create or replace function public.guru_penguasaan(p_nama text, p_kelas text, p_pin text, p_kelas_tapis text, p_pel int default null)
returns table (nama text, sp_kod text, mastery int, cubaan int)
language plpgsql stable security definer set search_path = public, extensions as $$
declare g public.akaun;
begin
  g := public._akaun(p_nama, p_kelas, p_pin);
  if g.id is null or not g.guru then return; end if;
  return query
  with r as (
    select a.nama, j.sp_kod, j.betul,
           row_number() over (partition by j.akaun_id, j.sp_kod order by j.created_at desc) as k
    from public.jawapan_rekod j join public.akaun a on a.id = j.akaun_id
    where a.kelas = p_kelas_tapis and j.sp_kod is not null and (p_pel is null or j.pel = p_pel)
  )
  select r.nama, r.sp_kod,
         round(100 * sum(case when r.betul then power(0.7, r.k - 1) else 0 end) / sum(power(0.7, r.k - 1)))::int,
         count(*)::int
  from r where r.k <= 12 group by r.nama, r.sp_kod;
end $$;

-- Guru: aktiviti setiap murid dalam kelas (termasuk yang belum pernah menjawab).
create or replace function public.guru_aktiviti(p_nama text, p_kelas text, p_pin text, p_kelas_tapis text)
returns table (nama text, terakhir timestamptz, jawapan_7h int, betul_7h int, hari_aktif_7h int, sp_lemah int, masa_median_ms int)
language plpgsql stable security definer set search_path = public, extensions as $$
declare g public.akaun;
begin
  g := public._akaun(p_nama, p_kelas, p_pin);
  if g.id is null or not g.guru then return; end if;
  return query
  with m as (
    select j.akaun_id, j.sp_kod,
           sum(case when j.betul then power(0.7, j.k - 1) else 0 end) / sum(power(0.7, j.k - 1)) as mas, count(*) as c
    from (select j.*, row_number() over (partition by j.akaun_id, j.sp_kod order by j.created_at desc) as k
          from public.jawapan_rekod j join public.akaun a on a.id = j.akaun_id where a.kelas = p_kelas_tapis) j
    where j.k <= 12 and j.sp_kod is not null group by j.akaun_id, j.sp_kod
  )
  select a.nama,
         max(j.created_at),
         (count(j.id) filter (where j.created_at >= now() - interval '7 days'))::int,
         (count(j.id) filter (where j.created_at >= now() - interval '7 days' and j.betul))::int,
         (count(distinct (j.created_at at time zone 'Asia/Kuala_Lumpur')::date) filter (where j.created_at >= now() - interval '7 days'))::int,
         (select count(*)::int from m where m.akaun_id = a.id and m.c >= 2 and m.mas < 0.5),
         (percentile_cont(0.5) within group (order by j.masa_ms) filter (where j.created_at >= now() - interval '7 days'))::int
  from public.akaun a left join public.jawapan_rekod j on j.akaun_id = a.id
  where a.kelas = p_kelas_tapis and not a.guru
  group by a.id, a.nama
  order by a.nama;
end $$;

-- Guru: soalan paling banyak dijawab salah (min 3 cubaan).
create or replace function public.guru_soalan_sukar(p_nama text, p_kelas text, p_pin text, p_kelas_tapis text, p_pel int default null)
returns table (soalan_id text, sp_kod text, cubaan int, salah int)
language plpgsql stable security definer set search_path = public, extensions as $$
declare g public.akaun;
begin
  g := public._akaun(p_nama, p_kelas, p_pin);
  if g.id is null or not g.guru then return; end if;
  return query
  select j.soalan_id, max(j.sp_kod), count(*)::int, (count(*) filter (where not j.betul))::int
  from public.jawapan_rekod j join public.akaun a on a.id = j.akaun_id
  where (p_kelas_tapis is null or a.kelas = p_kelas_tapis) and (p_pel is null or j.pel = p_pel)
  group by j.soalan_id
  having count(*) >= 3
  order by (count(*) filter (where not j.betul))::float / count(*) desc, count(*) desc
  limit 10;
end $$;

grant execute on function public.catat_jawapan(text, text, text, json, text)               to anon, authenticated;
grant execute on function public.guru_penguasaan(text, text, text, text, int)              to anon, authenticated;
grant execute on function public.guru_aktiviti(text, text, text, text)                     to anon, authenticated;
grant execute on function public.guru_soalan_sukar(text, text, text, text, int)            to anon, authenticated;
