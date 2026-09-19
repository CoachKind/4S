-- 4S sessions: one row per simulation. Setup (including confirmed assessment
-- data), the transcript, and the debrief are stored as JSON so the schema
-- can evolve with the prompts without migrations.
--
-- The server talks to this table with the service role key. No RLS policies
-- are defined for anonymous access; Phase 4 (coach dashboard) will add auth.

create table if not exists public.sessions (
  id uuid primary key,
  status text not null check (status in ('active', 'debriefed')),
  setup jsonb not null,
  transcript jsonb not null default '[]'::jsonb,
  debrief jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sessions_created_at_idx on public.sessions (created_at desc);

alter table public.sessions enable row level security;
