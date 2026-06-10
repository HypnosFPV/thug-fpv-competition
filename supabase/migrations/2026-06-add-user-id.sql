-- Run this once in Supabase SQL editor to tie entries to authenticated users.
alter table entries
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_entries_user_id on entries (user_id);

-- Allow each authenticated user to read only their own entries.
drop policy if exists "users can view their own entries" on entries;
create policy "users can view their own entries"
  on entries for select
  to authenticated
  using (user_id = auth.uid());

-- Allow authenticated users to insert entries tied to themselves.
drop policy if exists "users can insert their own entries" on entries;
create policy "users can insert their own entries"
  on entries for insert
  to authenticated
  with check (user_id = auth.uid());
