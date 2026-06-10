create extension if not exists pgcrypto;

create type competition_status as enum (
  'Draft',
  'Submissions Open',
  'Submissions Closed',
  'Judging Live',
  'Judging Locked',
  'Finalized',
  'Archived'
);

create type moderation_status as enum (
  'Pending',
  'Playback Verified',
  'Approved',
  'Rejected'
);

create table admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now()
);

create table competitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status competition_status not null default 'Draft',
  shared_event_password text not null,
  notification_email text null,
  backup_notification_email text null,
  email_notifications_enabled boolean not null default false,
  current_playback_entry_id uuid null,
  tie_break_method text not null default 'YouTube Live Chat Poll',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null
);

create table judge_slots (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  code text not null,
  pin text not null,
  label text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (competition_id, code)
);

create table entries (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  entrant_name text not null,
  entrant_email text not null,
  title text not null,
  youtube_url text not null,
  youtube_video_id text not null,
  notes text,
  moderation_status moderation_status not null default 'Pending',
  playback_verified boolean not null default false,
  moderation_notes text,
  status_token text unique,
  running_order int null,
  final_rank int null,
  created_at timestamptz not null default now(),
  approved_at timestamptz null
);
create index if not exists idx_entries_status_token on entries (status_token);

alter table competitions
  add constraint competitions_current_playback_entry_id_fkey
  foreign key (current_playback_entry_id) references entries(id) on delete set null;

create table scores (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  entry_id uuid not null references entries(id) on delete cascade,
  judge_slot_id uuid not null references judge_slots(id) on delete cascade,
  score numeric(3,1) not null check (score >= 1.0 and score <= 10.0),
  updated_at timestamptz not null default now(),
  unique (entry_id, judge_slot_id)
);

create table manual_tie_break_records (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  winner_entry_id uuid not null references entries(id) on delete cascade,
  method text not null default 'YouTube Live Chat Poll',
  notes text,
  resolved_by uuid null references admin_profiles(id) on delete set null,
  resolved_at timestamptz not null default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid null references competitions(id) on delete set null,
  actor_admin_id uuid null references admin_profiles(id) on delete set null,
  action text not null,
  target_table text not null,
  target_id uuid null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table competition_archives (
  id uuid primary key default gen_random_uuid(),
  archived_competition_id uuid not null,
  competition_name text not null,
  archived_snapshot jsonb not null,
  archived_by uuid null references admin_profiles(id) on delete set null,
  archived_at timestamptz not null default now()
);

create index idx_entries_competition_status on entries (competition_id, moderation_status);
create index idx_scores_competition_entry on scores (competition_id, entry_id);
create index idx_judge_slots_competition on judge_slots (competition_id);
create index idx_audit_logs_competition on audit_logs (competition_id, created_at desc);

alter table competitions enable row level security;
alter table judge_slots enable row level security;
alter table entries enable row level security;
alter table scores enable row level security;
alter table audit_logs enable row level security;
alter table competition_archives enable row level security;
alter table manual_tie_break_records enable row level security;
alter table admin_profiles enable row level security;

create policy "public can submit entries"
  on entries for insert
  to anon, authenticated
  with check (true);

create policy "public can view approved entries"
  on entries for select
  to anon, authenticated
  using (moderation_status = 'Approved');

create policy "admins manage everything"
  on competitions for all
  to authenticated
  using (exists (select 1 from admin_profiles where admin_profiles.id = auth.uid()))
  with check (exists (select 1 from admin_profiles where admin_profiles.id = auth.uid()));

create policy "admins manage judge slots"
  on judge_slots for all
  to authenticated
  using (exists (select 1 from admin_profiles where admin_profiles.id = auth.uid()))
  with check (exists (select 1 from admin_profiles where admin_profiles.id = auth.uid()));

create policy "admins manage entries"
  on entries for all
  to authenticated
  using (exists (select 1 from admin_profiles where admin_profiles.id = auth.uid()))
  with check (exists (select 1 from admin_profiles where admin_profiles.id = auth.uid()));

create policy "admins manage scores"
  on scores for all
  to authenticated
  using (exists (select 1 from admin_profiles where admin_profiles.id = auth.uid()))
  with check (exists (select 1 from admin_profiles where admin_profiles.id = auth.uid()));

create policy "admins manage archives"
  on competition_archives for all
  to authenticated
  using (exists (select 1 from admin_profiles where admin_profiles.id = auth.uid()))
  with check (exists (select 1 from admin_profiles where admin_profiles.id = auth.uid()));

create policy "admins manage audit logs"
  on audit_logs for all
  to authenticated
  using (exists (select 1 from admin_profiles where admin_profiles.id = auth.uid()))
  with check (exists (select 1 from admin_profiles where admin_profiles.id = auth.uid()));

create policy "admins manage tie breaks"
  on manual_tie_break_records for all
  to authenticated
  using (exists (select 1 from admin_profiles where admin_profiles.id = auth.uid()))
  with check (exists (select 1 from admin_profiles where admin_profiles.id = auth.uid()));

create policy "admins view admin profiles"
  on admin_profiles for select
  to authenticated
  using (exists (select 1 from admin_profiles ap where ap.id = auth.uid()));
