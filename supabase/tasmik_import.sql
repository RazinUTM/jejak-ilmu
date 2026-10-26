-- Jejak Ilmu · Tasmik sebenar + import pukal murid. Jalankan SELEPAS liga.sql dan urus_murid.sql. Selamat dijalankan semula.

-- =========================== TASMIK ===========================
-- Audio disimpan dalam jadual (bytea) supaya setiap hantaran dan dengaran disemak PIN melalui fungsi.
create table if not exists public.tasmik_rekod (
  id          bigint generated always as identity primary key,
  akaun_id    bigint not null references public.akaun(id) on delete cascade,
  rujukan     text,
  durasi_s    int,
  intai       int not null default 0,
  mime        text,
  saiz        int,
  audio       bytea,
  gred        text,
  komen       text,
  disemak_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists tasmik_rekod_akaun_idx on public.tasmik_rekod (akaun_id, created_at desc);
create index if not exists tasmik_rekod_belum_idx on public.tasmik_rekod (created_at desc) where disemak_at is null;
alter table public.tasmik_rekod enable row level security;

-- Murid hantar rakaman (maks 2 MB, 12 sehari).
create or replace function public.hantar_tasmik(p_nama text, p_kelas text, p_pin text,
  p_rujukan text, p_durasi int, p_intai int, p_mime text, p_audio_b64 text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare a public.akaun; bin bytea; n int; new_id bigint;
begin
  a := public._akaun(p_nama, p_kelas, p_pin);
  if a.id is null then return json_build_object('ok', false, 'ralat', 'pin'); end if;
  if p_audio_b64 is null or length(p_audio_b64) > 2900000 then return json_build_object('ok', false, 'ralat', 'saiz'); end if;
  select count(*) into n from public.tasmik_rekod where akaun_id = a.id and created_at >= public._awal_hari();
  if n >= 12 then return json_build_object('ok', false, 'ralat', 'had_harian'); end if;
  bin := decode(p_audio_b64, 'base64');
  insert into public.tasmik_rekod (akaun_id, rujukan, durasi_s, intai, mime, saiz, audio)
  values (a.id, left(p_rujukan, 120), greatest(0, least(coalesce(p_durasi, 0), 600)), greatest(0, coalesce(p_intai, 0)),
          left(coalesce(p_mime, 'audio/webm'), 40), length(bin), bin)
  returning id into new_id;
  return json_build_object('ok', true, 'id', new_id);
end $$;

-- Murid lihat tasmik sendiri + gred/komen Ustazah.
create or replace function public.tasmik_saya(p_nama text, p_kelas text, p_pin text)
returns table (id bigint, rujukan text, durasi_s int, intai int, gred text, komen text, created_at timestamptz, disemak_at timestamptz)
language plpgsql stable security definer set search_path = public, extensions as $$
declare a public.akaun;
begin
  a := public._akaun(p_nama, p_kelas, p_pin);
  if a.id is null then return; end if;
  return query select t.id, t.rujukan, t.durasi_s, t.intai, t.gred, t.komen, t.created_at, t.disemak_at
    from public.tasmik_rekod t where t.akaun_id = a.id order by t.created_at desc limit 30;
end $$;

-- Guru: senarai (tanpa audio).
create or replace function public.guru_tasmik(p_nama text, p_kelas text, p_pin text, p_kelas_tapis text default null)
returns table (id bigint, nama text, kelas text, rujukan text, durasi_s int, intai int, saiz int, ada_audio boolean,
               gred text, komen text, created_at timestamptz, disemak_at timestamptz)
language plpgsql stable security definer set search_path = public, extensions as $$
declare g public.akaun;
begin
  g := public._akaun(p_nama, p_kelas, p_pin);
  if g.id is null or not g.guru then return; end if;
  return query select t.id, a.nama, a.kelas, t.rujukan, t.durasi_s, t.intai, t.saiz, t.audio is not null,
                      t.gred, t.komen, t.created_at, t.disemak_at
    from public.tasmik_rekod t join public.akaun a on a.id = t.akaun_id
    where p_kelas_tapis is null or a.kelas = p_kelas_tapis
    order by (t.disemak_at is null) desc, t.created_at desc
    limit 200;
end $$;

-- Guru: ambil audio satu rakaman.
create or replace function public.guru_tasmik_audio(p_nama text, p_kelas text, p_pin text, p_id bigint) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare g public.akaun; t public.tasmik_rekod;
begin
  g := public._akaun(p_nama, p_kelas, p_pin);
  if g.id is null or not g.guru then return json_build_object('ok', false); end if;
  select * into t from public.tasmik_rekod where id = p_id;
  if t.id is null or t.audio is null then return json_build_object('ok', false, 'ralat', 'tiada'); end if;
  return json_build_object('ok', true, 'mime', t.mime, 'b64', encode(t.audio, 'base64'));
end $$;

-- Guru: gred + komen.
create or replace function public.guru_tasmik_gred(p_nama text, p_kelas text, p_pin text, p_id bigint, p_gred text, p_komen text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare g public.akaun;
begin
  g := public._akaun(p_nama, p_kelas, p_pin);
  if g.id is null or not g.guru then return json_build_object('ok', false); end if;
  update public.tasmik_rekod set gred = left(p_gred, 20), komen = left(p_komen, 500), disemak_at = now() where id = p_id;
  return json_build_object('ok', found);
end $$;

-- Guru: kosongkan audio rakaman yang sudah disemak dan lebih lama daripada N hari (gred/komen kekal).
create or replace function public.guru_tasmik_kemas(p_nama text, p_kelas text, p_pin text, p_hari int default 30) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare g public.akaun; n int;
begin
  g := public._akaun(p_nama, p_kelas, p_pin);
  if g.id is null or not g.guru then return json_build_object('ok', false); end if;
  update public.tasmik_rekod set audio = null
    where audio is not null and disemak_at is not null and created_at < now() - make_interval(days => greatest(p_hari, 7));
  get diagnostics n = row_count;
  return json_build_object('ok', true, 'dikosongkan', n,
    'mb_audio', round((select coalesce(sum(saiz), 0) from public.tasmik_rekod where audio is not null) / 1048576.0, 1));
end $$;

-- ======================== IMPORT PUKAL ========================
-- p_rows: [{"nama":"..","kelas":"..","pin":"1234"}, ...] (pin boleh kosong untuk murid sedia ada = PIN tidak berubah).
-- p_ganti = true: murid dalam kelas yang ADA dalam senarai tetapi tiada dalam senarai itu akan dipadam (untuk senarai tahun baharu).
create or replace function public.guru_import(p_nama text, p_kelas text, p_pin text, p_rows json, p_ganti boolean default false) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare g public.akaun; r json; n text; k text; pin text; baru int := 0; kemas int := 0; padam int := 0; ralat json := '[]'::json; kelas_set text[] := '{}';
begin
  g := public._akaun(p_nama, p_kelas, p_pin);
  if g.id is null or not g.guru then return json_build_object('ok', false, 'ralat', 'bukan_guru'); end if;
  for r in select * from json_array_elements(p_rows) loop
    n := btrim(coalesce(r->>'nama', '')); k := btrim(coalesce(r->>'kelas', '')); pin := btrim(coalesce(r->>'pin', ''));
    if n = '' or k = '' or (pin <> '' and pin !~ '^[0-9]{4,8}$') then
      ralat := (ralat::jsonb || jsonb_build_array(n || ' (' || k || ')'))::json; continue;
    end if;
    kelas_set := array_append(kelas_set, k);
    if exists (select 1 from public.akaun where nama = n and kelas = k) then
      if pin <> '' then update public.akaun set pin_hash = extensions.crypt(pin, extensions.gen_salt('bf')) where nama = n and kelas = k and not guru; kemas := kemas + 1; end if;
    else
      if pin = '' then ralat := (ralat::jsonb || jsonb_build_array(n || ' (' || k || '): murid baharu perlu PIN'))::json; continue; end if;
      insert into public.akaun (nama, kelas, pin_hash) values (n, k, extensions.crypt(pin, extensions.gen_salt('bf'))); baru := baru + 1;
    end if;
  end loop;
  if p_ganti then
    delete from public.akaun a
      where not a.guru and a.kelas = any(kelas_set)
        and not exists (select 1 from json_array_elements(p_rows) x where btrim(x->>'nama') = a.nama and btrim(x->>'kelas') = a.kelas);
    get diagnostics padam = row_count;
  end if;
  return json_build_object('ok', true, 'baru', baru, 'pin_dikemas', kemas, 'dipadam', padam, 'ralat', ralat);
end $$;

grant execute on function public.hantar_tasmik(text, text, text, text, int, int, text, text)      to anon, authenticated;
grant execute on function public.tasmik_saya(text, text, text)                                     to anon, authenticated;
grant execute on function public.guru_tasmik(text, text, text, text)                               to anon, authenticated;
grant execute on function public.guru_tasmik_audio(text, text, text, bigint)                       to anon, authenticated;
grant execute on function public.guru_tasmik_gred(text, text, text, bigint, text, text)            to anon, authenticated;
grant execute on function public.guru_tasmik_kemas(text, text, text, int)                          to anon, authenticated;
grant execute on function public.guru_import(text, text, text, json, boolean)                      to anon, authenticated;
