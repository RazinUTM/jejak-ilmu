-- Jejak Ilmu · Reaksi emoji positif pada "Pesanan hari ini". Jalankan SELEPAS liga.sql. Selamat dijalankan semula.
-- Setiap murid boleh beri SATU reaksi bagi setiap pesanan (boleh tukar atau tarik balik).
-- Murid hanya nampak jumlah; Ustazah boleh lihat siapa yang memberi respon.

create table if not exists public.pesanan_reaksi (
  kunci     text not null,                 -- 'p:<id pesanan suara>' atau 'sheet:<hash teks Sheets>'
  akaun_id  bigint not null references public.akaun(id) on delete cascade,
  reaksi    text not null check (reaksi in ('suka','sayang','senyum','bunga','aamiin','semangat')),
  at        timestamptz not null default now(),
  primary key (kunci, akaun_id)
);
create index if not exists pesanan_reaksi_kunci_idx on public.pesanan_reaksi (kunci);
alter table public.pesanan_reaksi enable row level security;

-- Dalaman: kiraan bagi satu pesanan + reaksi akaun ini.
create or replace function public._reaksi_kira(p_kunci text, p_akaun bigint) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('ok', true, 'kunci', p_kunci,
    'jumlah', (select count(*) from public.pesanan_reaksi where kunci = p_kunci),
    'kiraan', coalesce((select json_object_agg(reaksi, n) from (select reaksi, count(*) as n from public.pesanan_reaksi where kunci = p_kunci group by reaksi) x), '{}'::json),
    'saya', (select reaksi from public.pesanan_reaksi where kunci = p_kunci and akaun_id = p_akaun));
$$;
revoke all on function public._reaksi_kira(text, bigint) from public, anon, authenticated;

-- Murid: beri / tukar / tarik balik reaksi (p_reaksi kosong = tarik balik).
create or replace function public.reaksi_pesanan(p_nama text, p_kelas text, p_pin text, p_kunci text, p_reaksi text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare a public.akaun;
begin
  a := public._akaun(p_nama, p_kelas, p_pin);
  if a.id is null or a.guru then return json_build_object('ok', false); end if;
  if p_kunci is null or length(p_kunci) > 80 or p_kunci !~ '^(p|sheet):[A-Za-z0-9]+$' then return json_build_object('ok', false, 'ralat', 'kunci'); end if;
  if coalesce(p_reaksi, '') = '' then
    delete from public.pesanan_reaksi where kunci = p_kunci and akaun_id = a.id;
  elsif p_reaksi in ('suka','sayang','senyum','bunga','aamiin','semangat') then
    insert into public.pesanan_reaksi (kunci, akaun_id, reaksi) values (p_kunci, a.id, p_reaksi)
    on conflict (kunci, akaun_id) do update set reaksi = excluded.reaksi, at = now();
  else
    return json_build_object('ok', false, 'ralat', 'reaksi');
  end if;
  return public._reaksi_kira(p_kunci, a.id);
end $$;

-- Murid / guru: kiraan semasa.
create or replace function public.reaksi_kiraan(p_nama text, p_kelas text, p_pin text, p_kunci text) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare a public.akaun;
begin
  a := public._akaun(p_nama, p_kelas, p_pin);
  if a.id is null then return json_build_object('ok', false); end if;
  return public._reaksi_kira(p_kunci, a.id);
end $$;

-- Guru: kiraan dan senarai nama bagi beberapa pesanan sekaligus.
create or replace function public.guru_reaksi(p_nama text, p_kelas text, p_pin text, p_kunci text[]) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare g public.akaun;
begin
  g := public._akaun(p_nama, p_kelas, p_pin);
  if g.id is null or not g.guru then return json_build_object('ok', false); end if;
  return json_build_object('ok', true, 'data', coalesce((
    select json_object_agg(k.kunci, k.v) from (
      select r.kunci, json_build_object('jumlah', count(*),
        'kiraan', (select json_object_agg(x.reaksi, x.n) from (select reaksi, count(*) n from public.pesanan_reaksi where kunci = r.kunci group by reaksi) x),
        'murid', json_agg(json_build_object('nama', a.nama, 'kelas', a.kelas, 'reaksi', r.reaksi) order by a.kelas, a.nama)) as v
      from public.pesanan_reaksi r join public.akaun a on a.id = r.akaun_id
      where r.kunci = any(p_kunci)
      group by r.kunci) k), '{}'::json));
end $$;

grant execute on function public.reaksi_pesanan(text, text, text, text, text) to anon, authenticated;
grant execute on function public.reaksi_kiraan(text, text, text, text)        to anon, authenticated;
grant execute on function public.guru_reaksi(text, text, text, text[])        to anon, authenticated;
