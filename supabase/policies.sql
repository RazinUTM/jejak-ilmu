-- Row Level Security · students see/write only their own rows; teachers (peranan='guru') see everything.
alter table pelajaran  enable row level security;
alter table sp         enable row level security;
alter table soalan     enable row level security;
alter table kelas      enable row level security;
alter table murid      enable row level security;
alter table percubaan  enable row level security;
alter table xp_log     enable row level security;
alter table tasmik     enable row level security;
alter table pesanan    enable row level security;
alter table tugasan    enable row level security;
alter table liga_minggu enable row level security;

-- Reference content: readable by any signed-in user; written only by the service role (import script).
create policy "baca pelajaran" on pelajaran for select to authenticated using (true);
create policy "baca sp"        on sp        for select to authenticated using (true);
create policy "baca soalan"    on soalan    for select to authenticated using (aktif);
create policy "baca kelas"     on kelas     for select to authenticated using (true);

-- murid: own row, or teacher sees all. Role column can only be changed by service role.
create policy "murid sendiri"  on murid for select to authenticated using (id = auth.uid() or is_guru());
create policy "murid kemaskini nama" on murid for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and peranan = 'murid');

-- percubaan / xp_log: insert own, read own; teacher reads all.
create policy "cubaan masuk"   on percubaan for insert to authenticated with check (murid_id = auth.uid());
create policy "cubaan baca"    on percubaan for select to authenticated using (murid_id = auth.uid() or is_guru());
create policy "xp masuk"       on xp_log    for insert to authenticated with check (murid_id = auth.uid() and xp between 0 and 100);
create policy "xp baca"        on xp_log    for select to authenticated using (murid_id = auth.uid() or is_guru());

-- tasmik: student inserts own; teacher updates (grade/comment) and reads all.
create policy "tasmik masuk"   on tasmik for insert to authenticated with check (murid_id = auth.uid());
create policy "tasmik baca"    on tasmik for select to authenticated using (murid_id = auth.uid() or is_guru());
create policy "tasmik gred"    on tasmik for update to authenticated using (is_guru()) with check (is_guru());

-- pesanan / tugasan: teacher writes; students read their class (or all-class) items.
create policy "pesanan tulis"  on pesanan for insert to authenticated with check (is_guru() and guru_id = auth.uid());
create policy "pesanan baca"   on pesanan for select to authenticated using (is_guru() or kelas_id is null or kelas_id = (select kelas_id from murid where id = auth.uid()));
create policy "tugasan tulis"  on tugasan for insert to authenticated with check (is_guru() and guru_id = auth.uid());
create policy "tugasan baca"   on tugasan for select to authenticated using (is_guru() or kelas_id is null or kelas_id = (select kelas_id from murid where id = auth.uid()));

-- liga: everyone signed in can read the whole table (students may browse other leagues); written by the weekly job.
create policy "liga baca"      on liga_minggu for select to authenticated using (true);

-- ---------- Storage buckets (create them in Dashboard → Storage first: 'tasmik' private, 'pesanan' private) ----------
create policy "tasmik upload sendiri" on storage.objects for insert to authenticated
  with check (bucket_id = 'tasmik' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "tasmik baca sendiri/guru" on storage.objects for select to authenticated
  using (bucket_id = 'tasmik' and ((storage.foldername(name))[1] = auth.uid()::text or is_guru()));
create policy "pesanan guru tulis" on storage.objects for insert to authenticated
  with check (bucket_id = 'pesanan' and is_guru());
create policy "pesanan semua dengar" on storage.objects for select to authenticated
  using (bucket_id = 'pesanan');
