-- Jejak Ilmu · Supabase schema (Postgres)
-- Run once in the Supabase SQL editor, then run policies.sql.
-- Conventions: table names in Malay to match the app; UUID users come from Supabase Auth.

create extension if not exists pgcrypto;

-- ---------- Reference content (synced from Google Sheets) ----------
create table if not exists pelajaran (
  n        int primary key check (n between 1 and 28),
  bidang   text not null,
  rumi     text not null,
  jawi     text,
  ms       text,
  status   text not null default 'kunci' check (status in ('siap','sedang','buka','kunci')),
  updated_at timestamptz not null default now()
);

create table if not exists sp (
  kod        text primary key,            -- e.g. '4.10.1', 'JAWI'
  pelajaran_n int references pelajaran(n),
  nama       text not null,
  nama_jawi  text
);

create table if not exists soalan (
  id          text primary key,           -- e.g. 'P16-Q01' (from the sheet)
  pelajaran_n int references pelajaran(n),
  sp_kod      text not null references sp(kod),
  jenis       text not null check (jenis in ('mcq','tf','order','tajwid','fill','jawi')),
  soalan      text,
  soalan_jawi text,
  arab_jawi   text,                        -- tajwid/fill/jawi text; [..] marks highlight, ____ marks blank
  pilihan     jsonb,                       -- ["..","..",..] (null for order/tajwid)
  jawapan     int,                         -- 0-based index into pilihan (tajwid: 0..4 fixed list)
  urutan      jsonb,                       -- correct sequence for 'order'
  penjelasan  text,
  ms          int,
  kbat        boolean not null default false,
  aras        text check (aras in ('mudah','sederhana','kbat')),
  aktif       boolean not null default true,
  updated_at  timestamptz not null default now()
);
create index if not exists soalan_sp_idx on soalan(sp_kod) where aktif;

-- ---------- People ----------
create table if not exists kelas (
  id    text primary key,                  -- '2A'
  nama  text not null                      -- '2 Amanah'
);

create table if not exists murid (
  id        uuid primary key references auth.users(id) on delete cascade,
  nama      text not null,
  kelas_id  text references kelas(id),
  peranan   text not null default 'murid' check (peranan in ('murid','guru')),
  created_at timestamptz not null default now()
);

-- ---------- Activity log (append-only; everything else is derived) ----------
create table if not exists percubaan (
  id         bigint generated always as identity primary key,
  murid_id   uuid not null references murid(id) on delete cascade,
  soalan_id  text references soalan(id),
  sp_kod     text not null,
  set_kod    text,                         -- 'harian','kuiz16','tajwid',...
  sesi       uuid,                         -- groups one quiz run
  betul      boolean not null,
  masa_ms    int,                          -- time to answer (integrity signal)
  peranti    text,                         -- short device fingerprint hash (integrity signal)
  created_at timestamptz not null default now()
);
create index if not exists percubaan_murid_idx on percubaan(murid_id, created_at desc);
create index if not exists percubaan_sp_idx on percubaan(sp_kod);

create table if not exists xp_log (
  id         bigint generated always as identity primary key,
  murid_id   uuid not null references murid(id) on delete cascade,
  sebab      text not null,                -- 'betul','usaha','harian','sempurna','tasmik','tugasan'
  xp         int not null,
  rujukan    text,                         -- sesi / tasmik id
  created_at timestamptz not null default now()
);
create index if not exists xp_log_murid_idx on xp_log(murid_id, created_at desc);

create table if not exists tasmik (
  id         bigint generated always as identity primary key,
  murid_id   uuid not null references murid(id) on delete cascade,
  ayat       text not null,
  fail       text not null,                -- storage path: tasmik/<murid_id>/<uuid>.webm
  durasi_s   int,
  intai      int not null default 0,       -- how many times the text was peeked
  gred       text,                         -- teacher: 'TP1'..'TP6' or free text
  komen      text,
  komen_audio text,                        -- storage path of teacher's voice reply
  created_at timestamptz not null default now(),
  disemak_at timestamptz
);

create table if not exists pesanan (
  id         bigint generated always as identity primary key,
  guru_id    uuid not null references murid(id),
  kelas_id   text references kelas(id),    -- null = all classes
  teks       text not null,
  audio      text,                         -- storage path: pesanan/<uuid>.webm
  created_at timestamptz not null default now()
);

create table if not exists tugasan (
  id         bigint generated always as identity primary key,
  guru_id    uuid not null references murid(id),
  kelas_id   text references kelas(id),
  tajuk      text not null,
  set_kod    text not null,                -- which quiz/set
  sp_kod     text,                         -- optional focus SP
  xp         int not null default 30,
  tarikh_akhir date,
  created_at timestamptz not null default now()
);

create table if not exists liga_minggu (
  minggu     date not null,                -- Monday of the week
  murid_id   uuid not null references murid(id) on delete cascade,
  liga       text not null check (liga in ('pelita','purnama','suria')),
  kumpulan   int not null,                 -- group number within the league (10 per group)
  xp         int not null default 0,       -- XP earned this week (updated by the app or nightly job)
  primary key (minggu, murid_id)
);

-- ---------- Derived views ----------
-- Mastery per SP: exponentially-weighted recent accuracy (newest attempt weighs most).
create or replace view penguasaan as
with r as (
  select murid_id, sp_kod, betul,
         row_number() over (partition by murid_id, sp_kod order by created_at desc) as k
  from percubaan
)
select murid_id, sp_kod,
       round(100 * sum((case when betul then 1 else 0 end) * power(0.7, k-1)) / sum(power(0.7, k-1)))::int as mastery,
       count(*) as cubaan
from r where k <= 12
group by murid_id, sp_kod;

-- Effort metrics per student for the current month.
create or replace view usaha_bulan as
select m.id as murid_id,
       count(distinct date(p.created_at)) as hari_aktif,
       count(p.id) as dicuba,
       (select count(*) from tasmik t where t.murid_id = m.id and t.created_at >= date_trunc('month', now())) as tasmik
from murid m left join percubaan p on p.murid_id = m.id and p.created_at >= date_trunc('month', now())
group by m.id;

-- XP totals.
create or replace view xp_jumlah as
select murid_id, sum(xp) as xp,
       sum(xp) filter (where created_at >= date_trunc('week', now())) as xp_minggu
from xp_log group by murid_id;

-- Who am I / role helper used by RLS.
create or replace function is_guru() returns boolean language sql stable as $$
  select exists (select 1 from murid where id = auth.uid() and peranan = 'guru');
$$;
