-- Vantage cloud store. Run in the Supabase SQL editor, or via `supabase db push`.
-- The Hono API uses the service role key and bypasses RLS.

create table if not exists public.vantage_users (
  id uuid primary key default gen_random_uuid(),
  github_id bigint not null unique,
  login text not null,
  name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create index if not exists vantage_users_login_lc_idx
  on public.vantage_users (lower(login));

create table if not exists public.vantage_sessions (
  token text primary key,
  user_id uuid not null references public.vantage_users (id) on delete cascade,
  expires_at timestamptz not null
);

create index if not exists vantage_sessions_user_idx
  on public.vantage_sessions (user_id);

create index if not exists vantage_sessions_expires_idx
  on public.vantage_sessions (expires_at);

create table if not exists public.vantage_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  lead_user_id uuid not null references public.vantage_users (id),
  created_at timestamptz not null default now()
);

create table if not exists public.vantage_memberships (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.vantage_projects (id) on delete cascade,
  user_id uuid references public.vantage_users (id) on delete set null,
  github_login text not null,
  github_login_lc text generated always as (lower(github_login)) stored,
  role text not null check (role in ('lead', 'member')),
  status text not null check (status in ('invited', 'active')),
  invited_at timestamptz not null default now(),
  unique (project_id, github_login_lc)
);

create index if not exists vantage_memberships_user_idx
  on public.vantage_memberships (user_id);

create index if not exists vantage_memberships_project_idx
  on public.vantage_memberships (project_id);

create table if not exists public.vantage_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.vantage_projects (id) on delete cascade,
  author_user_id uuid not null references public.vantage_users (id) on delete cascade,
  year int not null check (year >= 2000 and year <= 2100),
  month int not null check (month >= 1 and month <= 12),
  markdown text not null,
  stats jsonb not null default '{}'::jsonb,
  merged_prs jsonb not null default '[]'::jsonb,
  submitted_at timestamptz not null default now(),
  unique (project_id, author_user_id, year, month)
);

create index if not exists vantage_reports_project_idx
  on public.vantage_reports (project_id, year, month);

create table if not exists public.vantage_recommendations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.vantage_projects (id) on delete cascade,
  author_user_id uuid not null references public.vantage_users (id),
  target_user_id uuid not null references public.vantage_users (id),
  report_id uuid references public.vantage_reports (id) on delete set null,
  year int not null check (year >= 2000 and year <= 2100),
  month int not null check (month >= 1 and month <= 12),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vantage_recommendations_project_idx
  on public.vantage_recommendations (project_id, year, month);

create index if not exists vantage_recommendations_target_idx
  on public.vantage_recommendations (target_user_id, year, month);

alter table public.vantage_users enable row level security;
alter table public.vantage_sessions enable row level security;
alter table public.vantage_projects enable row level security;
alter table public.vantage_memberships enable row level security;
alter table public.vantage_reports enable row level security;
alter table public.vantage_recommendations enable row level security;
