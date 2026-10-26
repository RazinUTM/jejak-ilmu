-- Jejak Ilmu · Liga Kelas (Fasa 2A)
-- Tampal SELURUH fail ini dalam Supabase → SQL Editor → New query → Run. Selamat dijalankan semula.
-- Reka bentuk: murid kekal log masuk dengan nama + PIN. Supabase menyemak PIN dan menyimpan XP melalui
-- fungsi RPC (security definer). Jadual tidak boleh dibaca terus melalui kunci awam; PIN disimpan sebagai bcrypt.

create extension if not exists pgcrypto with schema extensions;

-- 1) Kunci semua jadual sedia ada dalam schema public (RLS tanpa polisi = tiada akses melalui kunci awam).
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- 2) Akaun (nama + kelas + PIN) dan rekod XP.
create table if not exists public.akaun (
  id         bigint generated always as identity primary key,
  nama       text not null,
  kelas      text not null,
  pin_hash   text not null,
  guru       boolean not null default false,
  created_at timestamptz not null default now(),
  unique (nama, kelas)
);

create table if not exists public.xp_rekod (
  id         bigint generated always as identity primary key,
  akaun_id   bigint not null references public.akaun(id) on delete cascade,
  xp         int not null check (xp >= 0),
  sebab      text,
  created_at timestamptz not null default now()
);
create index if not exists xp_rekod_akaun_idx on public.xp_rekod (akaun_id, created_at desc);

alter table public.akaun    enable row level security;
alter table public.xp_rekod enable row level security;

-- Awal minggu (Isnin 00:00) dan awal hari, waktu Malaysia.
create or replace function public._awal_minggu() returns timestamptz
language sql stable as $$
  select date_trunc('week', now() at time zone 'Asia/Kuala_Lumpur') at time zone 'Asia/Kuala_Lumpur';
$$;
create or replace function public._awal_hari() returns timestamptz
language sql stable as $$
  select date_trunc('day', now() at time zone 'Asia/Kuala_Lumpur') at time zone 'Asia/Kuala_Lumpur';
$$;

-- Dalaman: cari akaun jika PIN betul.
create or replace function public._akaun(p_nama text, p_kelas text, p_pin text) returns public.akaun
language sql stable security definer set search_path = public, extensions as $$
  select * from public.akaun
  where nama = p_nama and kelas = p_kelas and pin_hash = extensions.crypt(p_pin, pin_hash)
  limit 1;
$$;

-- 3) RPC: semak PIN semasa log masuk.
create or replace function public.semak_pin(p_nama text, p_kelas text, p_pin text) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare a public.akaun;
begin
  a := public._akaun(p_nama, p_kelas, p_pin);
  if a.id is null then return json_build_object('ok', false); end if;
  return json_build_object(
    'ok', true,
    'guru', a.guru,
    'xp', (select coalesce(sum(xp), 0) from public.xp_rekod where akaun_id = a.id),
    'migrasi', exists (select 1 from public.xp_rekod where akaun_id = a.id and sebab = 'migrasi')
  );
end $$;

-- 4) RPC: catat XP. Had: 200 sekali hantar, 3000 sehari; 'migrasi' (XP sebelum liga dibuka) sekali sahaja, maks 5000.
create or replace function public.catat_xp(p_nama text, p_kelas text, p_pin text, p_xp int, p_sebab text default null) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare a public.akaun; hari int;
begin
  a := public._akaun(p_nama, p_kelas, p_pin);
  if a.id is null then return json_build_object('ok', false, 'ralat', 'pin'); end if;
  if p_sebab = 'migrasi' then
    if exists (select 1 from public.xp_rekod where akaun_id = a.id and sebab = 'migrasi') then
      return json_build_object('ok', true, 'dilangkau', true);
    end if;
    if p_xp < 0 or p_xp > 5000 then return json_build_object('ok', false, 'ralat', 'had'); end if;
  else
    if p_xp < 0 or p_xp > 200 then return json_build_object('ok', false, 'ralat', 'had'); end if;
    select coalesce(sum(xp), 0) into hari from public.xp_rekod
      where akaun_id = a.id and sebab is distinct from 'migrasi' and created_at >= public._awal_hari();
    if hari + p_xp > 3000 then return json_build_object('ok', false, 'ralat', 'had_harian'); end if;
  end if;
  insert into public.xp_rekod (akaun_id, xp, sebab) values (a.id, p_xp, left(p_sebab, 40));
  return json_build_object('ok', true);
end $$;

-- 5) RPC: liga satu kelas (nama + XP sahaja; dipaparkan kepada murid kelas itu).
create or replace function public.liga_kelas(p_kelas text)
returns table (nama text, xp_minggu bigint, xp_jumlah bigint)
language sql stable security definer set search_path = public as $$
  select a.nama,
         coalesce(sum(r.xp) filter (where r.created_at >= public._awal_minggu()), 0) as xp_minggu,
         coalesce(sum(r.xp), 0) as xp_jumlah
  from public.akaun a
  left join public.xp_rekod r on r.akaun_id = a.id
  where a.kelas = p_kelas and not a.guru
  group by a.id, a.nama
  order by xp_minggu desc, xp_jumlah desc, a.nama;
$$;

-- 6) RPC: semua kelas, untuk guru sahaja (PIN guru disemak).
create or replace function public.liga_semua(p_nama text, p_kelas text, p_pin text)
returns table (kelas text, nama text, xp_minggu bigint, xp_jumlah bigint, aktif_terakhir timestamptz)
language plpgsql stable security definer set search_path = public, extensions as $$
declare g public.akaun;
begin
  g := public._akaun(p_nama, p_kelas, p_pin);
  if g.id is null or not g.guru then return; end if;
  return query
    select a.kelas, a.nama,
           coalesce(sum(r.xp) filter (where r.created_at >= public._awal_minggu()), 0),
           coalesce(sum(r.xp), 0),
           max(r.created_at)
    from public.akaun a
    left join public.xp_rekod r on r.akaun_id = a.id
    where not a.guru
    group by a.id, a.kelas, a.nama
    order by a.kelas, 3 desc, a.nama;
end $$;

-- Kebenaran: hanya empat RPC ini boleh dipanggil dengan kunci awam.
revoke all on function public._akaun(text, text, text) from public, anon, authenticated;
grant execute on function public.semak_pin(text, text, text)               to anon, authenticated;
grant execute on function public.catat_xp(text, text, text, int, text)     to anon, authenticated;
grant execute on function public.liga_kelas(text)                          to anon, authenticated;
grant execute on function public.liga_semua(text, text, text)              to anon, authenticated;

-- Selesai. Seterusnya jalankan fail akaun (senarai murid + PIN) yang dihantar secara berasingan.
