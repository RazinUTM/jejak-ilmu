-- Jejak Ilmu · Liga kelas dengan bilangan lencana ("lencana bahu"). Jalankan SELEPAS laporan.sql. Selamat dijalankan semula.
-- Murid nampak XP dan bilangan lencana rakan sekelas (tiada data lain didedahkan).
create or replace function public.liga_kelas_v2(p_kelas text)
returns table (nama text, xp_minggu bigint, xp_jumlah bigint, lencana int)
language sql stable security definer set search_path = public as $$
  select a.nama,
         coalesce(sum(r.xp) filter (where r.created_at >= public._awal_minggu()), 0) as xp_minggu,
         coalesce(sum(r.xp), 0) as xp_jumlah,
         coalesce((select count(*)::int from public.kemajuan k, jsonb_object_keys(k.data->'lencana')
                   where k.akaun_id = a.id and jsonb_typeof(k.data->'lencana') = 'object'), 0) as lencana
  from public.akaun a
  left join public.xp_rekod r on r.akaun_id = a.id
  where a.kelas = p_kelas and not a.guru
  group by a.id, a.nama
  order by xp_minggu desc, xp_jumlah desc, a.nama;
$$;
grant execute on function public.liga_kelas_v2(text) to anon, authenticated;
