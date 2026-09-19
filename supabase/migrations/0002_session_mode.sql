-- Voice mode: each session records how the conversation happens.
alter table public.sessions
  add column if not exists mode text not null default 'text' check (mode in ('text', 'voice'));
