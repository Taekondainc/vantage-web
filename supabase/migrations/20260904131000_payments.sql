-- Payments, Polar invoice/receipt copies, billing email on the user.

alter table public.vantage_users
  add column if not exists email text;

create table if not exists public.vantage_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.vantage_users (id) on delete set null,
  polar_order_id text not null unique,
  polar_customer_id text,
  polar_subscription_id text,
  status text not null default 'pending',
  billing_reason text,
  amount_cents int not null default 0,
  currency text not null default 'usd',
  invoice_number text,
  receipt_number text,
  paid_at timestamptz,
  refunded_at timestamptz,
  polar_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vantage_payments drop constraint if exists vantage_payments_status_check;
alter table public.vantage_payments
  add constraint vantage_payments_status_check
  check (status in ('pending', 'paid', 'refunded', 'canceled'));

create index if not exists vantage_payments_user_idx
  on public.vantage_payments (user_id, created_at desc);

create table if not exists public.vantage_payment_documents (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.vantage_payments (id) on delete cascade,
  user_id uuid references public.vantage_users (id) on delete set null,
  kind text not null,
  name text not null,
  mime text not null default 'application/pdf',
  size_bytes bigint not null default 0,
  storage_path text,
  url text,
  polar_url text,
  created_at timestamptz not null default now(),
  unique (payment_id, kind)
);

alter table public.vantage_payment_documents drop constraint if exists vantage_payment_documents_kind_check;
alter table public.vantage_payment_documents
  add constraint vantage_payment_documents_kind_check
  check (kind in ('invoice', 'receipt'));

create index if not exists vantage_payment_documents_user_idx
  on public.vantage_payment_documents (user_id, created_at desc);

alter table public.vantage_payments enable row level security;
alter table public.vantage_payment_documents enable row level security;
