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

-- Dalaman: cari akaun jika PIN betul, dengan had cubaan (13 · akaun_kunci.sql).
-- 5 PIN salah berturut-turut → akaun dikunci 1 minit; salah ke-6 → 5 minit; ke-7 dan seterusnya → 15 minit setiap kali.
-- PIN betul (selepas kunci tamat) atau PIN ditukar → kiraan kosong semula. Kiraan lama (> 24 jam) bermula semula dari 1.
-- Semua fungsi yang memanggil _akaun mesti VOLATILE: PostgREST menjalankan fungsi STABLE dalam transaksi read-only.
create table if not exists public.akaun_cubaan (
  akaun_id       bigint primary key references public.akaun(id) on delete cascade,
  gagal          int not null default 0,
  gagal_terakhir timestamptz,
  kunci_hingga   timestamptz
);
alter table public.akaun_cubaan enable row level security;

create or replace function public._akaun_dikunci(p_nama text, p_kelas text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.akaun a join public.akaun_cubaan c on c.akaun_id = a.id
                 where a.nama = p_nama and a.kelas = p_kelas and c.kunci_hingga > now());
$$;

create or replace function public._akaun(p_nama text, p_kelas text, p_pin text) returns public.akaun
language plpgsql security definer set search_path = public, extensions as $$
declare a public.akaun; c public.akaun_cubaan; n int;
begin
  select * into a from public.akaun where nama = p_nama and kelas = p_kelas limit 1;
  if a.id is null then return null; end if;
  select * into c from public.akaun_cubaan where akaun_id = a.id;
  if c.kunci_hingga is not null and c.kunci_hingga > now() then return null; end if;
  if a.pin_hash = extensions.crypt(coalesce(p_pin, ''), a.pin_hash) then
    if coalesce(c.gagal, 0) > 0 then update public.akaun_cubaan set gagal = 0, kunci_hingga = null where akaun_id = a.id; end if;
    return a;
  end if;
  insert into public.akaun_cubaan as t (akaun_id, gagal, gagal_terakhir) values (a.id, 1, now())
  on conflict (akaun_id) do update set
    gagal = case when t.gagal_terakhir < now() - interval '24 hours' then 1 else t.gagal + 1 end,
    gagal_terakhir = now()
  returning gagal into n;
  if n >= 5 then
    update public.akaun_cubaan
      set kunci_hingga = now() + case when n = 5 then interval '1 minute' when n = 6 then interval '5 minutes' else interval '15 minutes' end
      where akaun_id = a.id;
  end if;
  return null;
end $$;

-- PIN ditukar (guru_urus 'pin' / import) → kunci dan kiraan dibuang.
create or replace function public._akaun_pin_baru() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.pin_hash is distinct from old.pin_hash then delete from public.akaun_cubaan where akaun_id = new.id; end if;
  return new;
end $$;
drop trigger if exists akaun_pin_baru on public.akaun;
create trigger akaun_pin_baru after update of pin_hash on public.akaun
  for each row execute function public._akaun_pin_baru();

revoke all on function public._akaun(text, text, text)        from public, anon, authenticated;
revoke all on function public._akaun_dikunci(text, text)       from public, anon, authenticated;
revoke all on function public._akaun_pin_baru()                from public, anon, authenticated;

-- 3) RPC: semak PIN semasa log masuk.
create or replace function public.semak_pin(p_nama text, p_kelas text, p_pin text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare a public.akaun;
begin
  a := public._akaun(p_nama, p_kelas, p_pin);
  if a.id is null then return json_build_object('ok', false, 'dikunci', public._akaun_dikunci(p_nama, p_kelas)); end if;
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
language plpgsql security definer set search_path = public, extensions as $$
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
