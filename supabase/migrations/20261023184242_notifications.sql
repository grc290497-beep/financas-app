-- Push notifications: budgets at 80% / over the limit, and the goal
-- installment reminder. One subscription per device; the daily job
-- (/api/cron/notifications, service role) reads them and logs what it sent.

alter table public.profiles
  add column notify_budget boolean not null default true,
  add column notify_goals boolean not null default true;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  endpoint text not null unique check (char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions: owner can read"
  on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "push_subscriptions: owner can insert"
  on public.push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "push_subscriptions: owner can delete"
  on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

-- What was already sent, so each alert goes out once (e.g. "budget80:<category>:<period>").
create table public.notification_log (
  user_id uuid not null references auth.users on delete cascade,
  key text not null check (char_length(key) <= 200),
  sent_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.notification_log enable row level security;

-- Written only by the daily job (service role); users may read their own.
create policy "notification_log: owner can read"
  on public.notification_log for select to authenticated
  using (user_id = (select auth.uid()));
