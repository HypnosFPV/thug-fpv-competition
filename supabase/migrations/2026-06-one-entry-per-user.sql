-- Enforce one entry per user per competition.
-- Run this once in Supabase SQL editor.
create unique index if not exists uniq_entries_user_competition
  on entries (competition_id, user_id)
  where user_id is not null;
