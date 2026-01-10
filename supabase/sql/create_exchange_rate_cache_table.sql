-- Create table to store cached USD exchange rates.
-- Row Level Security is enabled to align with Supabase best practices,
-- policies can be defined later if needed.

create table if not exists public.exchange_rate_cache (
  id text primary key,
  rates jsonb not null,
  cached_at timestamptz not null default now()
);

alter table public.exchange_rate_cache enable row level security;
