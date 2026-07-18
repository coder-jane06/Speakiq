-- One row is reserved before each scheduled email, preventing duplicate sends
-- when a scheduler retries or multiple workers overlap.
create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('daily_practice')),
  delivery_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, kind, delivery_date)
);

alter table public.notification_deliveries enable row level security;

create index if not exists notification_deliveries_user_date_idx
  on public.notification_deliveries (user_id, delivery_date desc);
