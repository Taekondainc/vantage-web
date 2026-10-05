-- File metadata only. Blobs live on Cloudinary; Supabase stores the link.

create table if not exists public.vantage_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.vantage_projects (id) on delete cascade,
  author_user_id uuid not null references public.vantage_users (id) on delete cascade,
  report_id uuid references public.vantage_reports (id) on delete set null,
  year int,
  month int,
  name text not null,
  storage_path text not null unique,
  resource_type text not null default 'raw',
  url text not null default '',
  mime text not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now()
);

alter table public.vantage_files add column if not exists resource_type text;
alter table public.vantage_files add column if not exists url text;

update public.vantage_files set resource_type = 'raw' where resource_type is null;
update public.vantage_files set url = '' where url is null;

alter table public.vantage_files alter column resource_type set default 'raw';
alter table public.vantage_files alter column url set default '';

create index if not exists vantage_files_project_idx
  on public.vantage_files (project_id, created_at desc);

create index if not exists vantage_files_author_idx
  on public.vantage_files (author_user_id, created_at desc);

alter table public.vantage_files enable row level security;
