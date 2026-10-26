-- Jejak Ilmu · Pesanan suara guru. Jalankan SELEPAS liga.sql. Selamat dijalankan semula.

create table if not exists public.pesanan_guru (
  id          bigint generated always as identity primary key,
  guru_id     bigint references public.akaun(id) on delete set null,
  kelas       text,                       -- null = semua kelas
  teks        text,
  mime        text,
  durasi_s    int,
  audio       bytea,
  created_at  timestamptz not null default now()
);
create index if not exists pesanan_guru_masa_idx on public.pesanan_guru (created_at desc);

create table if not exists public.pesanan_dengar (
  pesanan_id  bigint not null references public.pesanan_guru(id) on delete cascade,
  akaun_id    bigint not null references public.akaun(id) on delete cascade,
  at          timestamptz not null default now(),
  primary key (pesanan_id, akaun_id)
);
alter table public.pesanan_guru   enable row level security;
alter table public.pesanan_dengar enable row level security;

-- Guru: hantar pesanan (teks dan/atau suara, maks 3 MB).
create or replace function public.guru_pesanan_hantar(p_nama text, p_kelas text, p_pin text,
  p_kelas_sasar text, p_teks text, p_mime text default null, p_durasi int default null, p_audio_b64 text default null) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare g public.akaun; bin bytea; new_id bigint;
begin
  g := public._akaun(p_nama, p_kelas, p_pin);
  if g.id is null or not g.guru then return json_build_object('ok', false, 'ralat', 'bukan_guru'); end if;
  if coalesce(btrim(p_teks), '') = '' and p_audio_b64 is null then return json_build_object('ok', false, 'ralat', 'kosong'); end if;
  if p_audio_b64 is not null then
    if length(p_audio_b64) > 4200000 then return json_build_object('ok', false, 'ralat', 'saiz'); end if;
    bin := decode(p_audio_b64, 'base64');
  end if;
  insert into public.pesanan_guru (guru_id, kelas, teks, mime, durasi_s, audio)
  values (g.id, nullif(btrim(p_kelas_sasar), ''), left(btrim(p_teks), 600), left(p_mime, 40), p_durasi, bin)
  returning id into new_id;
  return json_build_object('ok', true, 'id', new_id);
end $$;

-- Murid: pesanan terkini untuk kelasnya (14 hari terakhir).
create or replace function public.pesanan_terkini(p_nama text, p_kelas text, p_pin text) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare a public.akaun; m public.pesanan_guru;
begin
  a := public._akaun(p_nama, p_kelas, p_pin);
  if a.id is null then return json_build_object('ok', false); end if;
  select * into m from public.pesanan_guru
    where (kelas is null or kelas = a.kelas) and created_at >= now() - interval '14 days'
    order by created_at desc limit 1;
  if m.id is null then return json_build_object('ok', true, 'ada', false); end if;
  return json_build_object('ok', true, 'ada', true, 'id', m.id, 'teks', m.teks, 'durasi_s', m.durasi_s,
    'ada_audio', m.audio is not null, 'created_at', m.created_at,
    'didengar', exists (select 1 from public.pesanan_dengar d where d.pesanan_id = m.id and d.akaun_id = a.id));
end $$;

-- Murid: ambil audio pesanan (direkod sebagai "didengar").
create or replace function public.pesanan_audio(p_nama text, p_kelas text, p_pin text, p_id bigint) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare a public.akaun; m public.pesanan_guru;
begin
  a := public._akaun(p_nama, p_kelas, p_pin);
  if a.id is null then return json_build_object('ok', false); end if;
  select * into m from public.pesanan_guru where id = p_id and (kelas is null or kelas = a.kelas);
  if m.id is null or m.audio is null then return json_build_object('ok', false); end if;
  if not a.guru then
    insert into public.pesanan_dengar (pesanan_id, akaun_id) values (m.id, a.id) on conflict do nothing;
  end if;
  return json_build_object('ok', true, 'mime', m.mime, 'b64', encode(m.audio, 'base64'));
end $$;

-- Guru: senarai pesanan + bilangan murid yang sudah mendengar.
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
         (select count(*)::int from public.akaun a where not a.guru and (m.kelas is null or a.kelas = m.kelas))
  from public.pesanan_guru m order by m.created_at desc limit 30;
end $$;

-- Guru: dengar semula / padam.
create or replace function public.guru_pesanan_audio(p_nama text, p_kelas text, p_pin text, p_id bigint) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare g public.akaun; m public.pesanan_guru;
begin
  g := public._akaun(p_nama, p_kelas, p_pin);
  if g.id is null or not g.guru then return json_build_object('ok', false); end if;
  select * into m from public.pesanan_guru where id = p_id;
  if m.id is null or m.audio is null then return json_build_object('ok', false); end if;
  return json_build_object('ok', true, 'mime', m.mime, 'b64', encode(m.audio, 'base64'));
end $$;

create or replace function public.guru_pesanan_padam(p_nama text, p_kelas text, p_pin text, p_id bigint) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare g public.akaun;
begin
  g := public._akaun(p_nama, p_kelas, p_pin);
  if g.id is null or not g.guru then return json_build_object('ok', false); end if;
  delete from public.pesanan_guru where id = p_id;
  return json_build_object('ok', found);
end $$;

grant execute on function public.guru_pesanan_hantar(text, text, text, text, text, text, int, text) to anon, authenticated;
grant execute on function public.pesanan_terkini(text, text, text)                                  to anon, authenticated;
grant execute on function public.pesanan_audio(text, text, text, bigint)                            to anon, authenticated;
grant execute on function public.guru_pesanan_senarai(text, text, text)                             to anon, authenticated;
grant execute on function public.guru_pesanan_audio(text, text, text, bigint)                       to anon, authenticated;
grant execute on function public.guru_pesanan_padam(text, text, text, bigint)                       to anon, authenticated;
