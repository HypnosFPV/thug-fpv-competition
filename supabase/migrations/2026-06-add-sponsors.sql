-- Sponsors per competition with logo uploads.
-- Public form writes here; admin approves; logos render on /playback marquee.

create table if not exists sponsors (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  sponsor_name text not null,
  contact_name text,
  contact_email text,
  website_url text,
  prize_description text,
  logo_path text not null,
  logo_url text,
  approved boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sponsors_competition_id on sponsors (competition_id);
create index if not exists idx_sponsors_approved on sponsors (approved);

-- Storage bucket for logos. Run once.
insert into storage.buckets (id, name, public)
values ('sponsor-logos', 'sponsor-logos', true)
on conflict (id) do nothing;

-- Anyone can read approved logos (public banner display).
drop policy if exists "Public read sponsor logos" on storage.objects;
create policy "Public read sponsor logos"
  on storage.objects for select
  to public
  using (bucket_id = 'sponsor-logos');

-- Authenticated users can upload (form requires login? we keep it open via service role).
-- The server action uses the service role key, so no row-level upload policy is needed.
