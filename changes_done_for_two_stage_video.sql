create type public.render_job_stage as enum (
  'audio',
  'video'
);

comment on type public.render_job_stage is 'Generation phase: audio (preview/confirm) then video (final render)';

alter table public.render_jobs
  add column if not exists stage render_job_stage not null default 'audio';

comment on column public.render_jobs.stage is 'Which phase this job is in: audio generation or video generation';

-- Above add enum for the stage

update public.render_jobs set stage = 'video' where stage = 'audio';

