-- Adds an optional max video length (in seconds) per competition.
-- NULL means no limit.

alter table competitions
  add column if not exists max_video_seconds integer;

comment on column competitions.max_video_seconds is
  'Maximum allowed YouTube video duration in seconds. NULL means no limit.';
