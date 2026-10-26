-- Jejak Ilmu · Urus murid dari aplikasi (tab Guru). Jalankan SELEPAS liga.sql. Selamat dijalankan semula.
-- Supabase menjadi sumber tunggal nama, kelas dan PIN. Guru mengurus akaun melalui app (PIN guru disemak).

-- Senarai nama untuk muka depan (tiada PIN, tiada guru).
create or replace function public.senarai_murid()
returns table (nama text, kelas text)
language sql stable security definer set search_path = public as $$
  select nama, kelas from public.akaun where not guru order by kelas, nama;
$$;

-- Senarai penuh untuk guru (dengan id).
create or replace function public.guru_senarai(p_nama text, p_kelas text, p_pin text)
returns table (id bigint, nama text, kelas text, guru boolean)
language plpgsql stable security definer set search_path = public, extensions as $$
declare g public.akaun;
begin
  g := public._akaun(p_nama, p_kelas, p_pin);
  if g.id is null or not g.guru then return; end if;
  return query select a.id, a.nama, a.kelas, a.guru from public.akaun a order by a.guru desc, a.kelas, a.nama;
end $$;

-- Tindakan guru: 'tambah' | 'ubah' (nama/kelas) | 'pin' | 'padam'.
create or replace function public.guru_urus(
  p_nama text, p_kelas text, p_pin text,
  p_tindakan text, p_id bigint default null,
  p_nama_baru text default null, p_kelas_baru text default null, p_pin_baru text default null)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare g public.akaun; t public.akaun; n text := btrim(coalesce(p_nama_baru, '')); k text := btrim(coalesce(p_kelas_baru, ''));
begin
  g := public._akaun(p_nama, p_kelas, p_pin);
  if g.id is null or not g.guru then return json_build_object('ok', false, 'ralat', 'bukan_guru'); end if;
  if p_pin_baru is not null and p_pin_baru !~ '^[0-9]{4,8}$' then return json_build_object('ok', false, 'ralat', 'pin_format'); end if;

  if p_tindakan = 'tambah' then
    if n = '' or k = '' or p_pin_baru is null then return json_build_object('ok', false, 'ralat', 'tak_lengkap'); end if;
    insert into public.akaun (nama, kelas, pin_hash) values (n, k, extensions.crypt(p_pin_baru, extensions.gen_salt('bf')));
    return json_build_object('ok', true);
  end if;

  select * into t from public.akaun where id = p_id;
  if t.id is null then return json_build_object('ok', false, 'ralat', 'tiada'); end if;
  if t.guru and t.id <> g.id then return json_build_object('ok', false, 'ralat', 'akaun_guru'); end if;

  if p_tindakan = 'ubah' then
    update public.akaun set nama = coalesce(nullif(n, ''), nama), kelas = coalesce(nullif(k, ''), kelas) where id = t.id;
    if p_pin_baru is not null then update public.akaun set pin_hash = extensions.crypt(p_pin_baru, extensions.gen_salt('bf')) where id = t.id; end if;
    return json_build_object('ok', true);
  elsif p_tindakan = 'pin' then
    if p_pin_baru is null then return json_build_object('ok', false, 'ralat', 'tak_lengkap'); end if;
    update public.akaun set pin_hash = extensions.crypt(p_pin_baru, extensions.gen_salt('bf')) where id = t.id;
    return json_build_object('ok', true);
  elsif p_tindakan = 'padam' then
    if t.guru then return json_build_object('ok', false, 'ralat', 'akaun_guru'); end if;
    delete from public.akaun where id = t.id;
    return json_build_object('ok', true);
  end if;
  return json_build_object('ok', false, 'ralat', 'tindakan');
exception when unique_violation then
  return json_build_object('ok', false, 'ralat', 'nama_wujud');
end $$;

grant execute on function public.senarai_murid()                                                        to anon, authenticated;
grant execute on function public.guru_senarai(text, text, text)                                         to anon, authenticated;
grant execute on function public.guru_urus(text, text, text, text, bigint, text, text, text)           to anon, authenticated;
