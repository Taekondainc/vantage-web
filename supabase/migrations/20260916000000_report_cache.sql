-- Persists the GitHub month report and its AI code review so they survive
-- server restarts/deploys instead of living only in the short-lived
-- in-memory Map the API used before. Past (completed) months are treated as
-- immutable by the app; the AI analysis is never silently regenerated once
-- saved, since it costs AI quota — only an explicit "Re-run" bypasses it.

create table if not exists public.vantage_report_cache (
  user_id uuid not null references public.vantage_users (id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  report jsonb,
  report_updated_at timestamptz,
  analysis jsonb,
  analysis_updated_at timestamptz,
  primary key (user_id, year, month)
);

alter table public.vantage_report_cache enable row level security;
