-- Personal Tasks and Objectives/Targets, synced per-user so either the web
-- app or the desktop app reads/writes the same data. Unlike projects/reports,
-- these are never shared with other users — every row is scoped to owner_user_id.

create table if not exists public.vantage_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.vantage_users (id) on delete cascade,
  title text not null,
  description text,
  status text not null check (status in ('todo', 'in-progress', 'reviewing', 'done')),
  repo text,
  branch_name text,
  source text not null default 'local' check (source in ('local', 'linear', 'jira', 'github', 'asana')),
  issue_key text,
  created_at timestamptz not null default now(),
  expected_finish_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists vantage_tasks_owner_idx
  on public.vantage_tasks (owner_user_id);

create table if not exists public.vantage_objective_sets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.vantage_users (id) on delete cascade,
  kind text not null check (kind in ('objective', 'target')),
  title text not null,
  source_name text,
  repo text,
  branch_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vantage_objective_sets_owner_idx
  on public.vantage_objective_sets (owner_user_id);

create table if not exists public.vantage_objective_items (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.vantage_objective_sets (id) on delete cascade,
  text text not null,
  status text not null check (status in ('not-started', 'in-progress', 'met')),
  jira_issue_key text,
  jira_url text,
  sort_order int not null default 0
);

create index if not exists vantage_objective_items_set_idx
  on public.vantage_objective_items (set_id, sort_order);

alter table public.vantage_tasks enable row level security;
alter table public.vantage_objective_sets enable row level security;
alter table public.vantage_objective_items enable row level security;
