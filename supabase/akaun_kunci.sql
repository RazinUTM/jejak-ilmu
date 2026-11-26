-- Jejak Ilmu · 13 · Had cubaan PIN (akaun guru dan murid)
-- Tampal SELURUH fail ini dalam Supabase → SQL Editor → New query → Run. Selamat dijalankan semula.
-- Jalankan SEKALI LAGI selepas menjalankan semula mana-mana fail 1–12, kerana fail lama mungkin menulis
-- semula _akaun atau fungsi STABLE. (Fail 1–12 dalam repo sudah dikemas kini, tetapi salinan lama mungkin tidak.)

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

-- 3) semak_pin: beritahu app jika akaun sedang dikunci (supaya mesej "tunggu beberapa minit" dipaparkan).
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
grant execute on function public.semak_pin(text, text, text) to anon, authenticated;

-- 4) Semua fungsi yang memanggil _akaun → VOLATILE (kiraan cubaan perlu ditulis; PostgREST menjalankan
--    fungsi STABLE dalam transaksi read-only, jadi tulisan itu akan gagal).
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.provolatile <> 'v' and p.prosrc like '%public._akaun(%'
             and p.proname not in ('_akaun', '_akaun_dikunci') loop
    execute format('alter function %s volatile', f.sig);
  end loop;
end $$;

-- Selesai. Semak: select count(*) from pg_proc where prosrc like '%public._akaun(%' and provolatile <> 'v';  → 0
