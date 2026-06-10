-- Run this once in Supabase SQL editor if your database was created before status tokens existed.
alter table entries
  add column if not exists status_token text unique;

create index if not exists idx_entries_status_token on entries (status_token);
