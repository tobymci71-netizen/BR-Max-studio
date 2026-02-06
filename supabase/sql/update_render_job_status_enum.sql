-- Backward-compatible: production already has enum render_tatus with
--   queued, processing, done, failed, cancelled.
-- Add NEW values only; do NOT change or migrate existing data.
-- Existing rows keep: queued, processing, done, failed, cancelled.
-- New flow uses new values; UI and API accept both old and new statuses.

-- Add new enum values (PG 10+: IF NOT EXISTS avoids error if value already added)
alter type public.render_tatus add value if not exists 'audio_generation';
alter type public.render_tatus add value if not exists 'audio_uploaded';
alter type public.render_tatus add value if not exists 'awaiting_to_start_render';
alter type public.render_tatus add value if not exists 'video_generation';
alter type public.render_tatus add value if not exists 'video_generated';

-- Do NOT update existing rows: leave queued, processing, done, failed, cancelled as-is.
