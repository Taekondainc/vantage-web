-- Billing: plan on the user, Polar ids, monthly usage meters.

alter table public.vantage_users
  add column if not exists plan text not null default 'free';

alter table public.vantage_users
  add column if not exists polar_customer_id text;

alter table public.vantage_users
  add column if not exists polar_subscription_id text;

alter table public.vantage_users
  add column if not exists plan_period_end timestamptz;

alter table public.vantage_users drop constraint if exists vantage_users_plan_check;
alter table public.vantage_users
  add constraint vantage_users_plan_check check (plan in ('free', 'paid'));

create unique index if not exists vantage_users_polar_customer_idx
  on public.vantage_users (polar_customer_id)
  where polar_customer_id is not null;

create table if not exists public.vantage_usage (
  user_id uuid not null references public.vantage_users (id) on delete cascade,
  period text not null,
  reports int not null default 0,
  ai_actions int not null default 0,
  evidence_packs int not null default 0,
  primary key (user_id, period)
);

alter table public.vantage_usage enable row level security;
