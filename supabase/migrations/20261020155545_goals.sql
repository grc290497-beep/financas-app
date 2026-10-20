-- Phase 5: savings goals and their contributions (lib/goals.ts).

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  target_cents bigint not null check (target_cents > 0),
  currency text not null check (currency in ('EUR', 'BRL')),
  initial_cents bigint not null default 0 check (initial_cents >= 0),
  deadline date not null,
  icon text,
  color text check (color ~ '^#[0-9a-fA-F]{6}$'),
  status text not null default 'active' check (status in ('active', 'done', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index goals_user_idx on public.goals (user_id, status);

alter table public.goals enable row level security;

create policy "goals: owner can read"
  on public.goals for select to authenticated
  using (user_id = (select auth.uid()));
create policy "goals: owner can insert"
  on public.goals for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "goals: owner can update"
  on public.goals for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "goals: owner can delete"
  on public.goals for delete to authenticated
  using (user_id = (select auth.uid()));

create trigger goals_set_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

-- Deposits are positive, withdrawals negative. amount_goal_cents is the
-- amount converted into the goal's currency at fx_rate, frozen when saved.
create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  goal_id uuid not null,
  amount_cents bigint not null check (amount_cents <> 0),
  currency text not null check (currency in ('EUR', 'BRL')),
  fx_rate numeric(18, 6) not null default 1 check (fx_rate > 0),
  amount_goal_cents bigint not null,
  contributed_on date not null,
  note text check (char_length(note) <= 140),
  created_at timestamptz not null default now(),
  -- Composite key: a contribution can only point at its owner's goal.
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete cascade
);

create index goal_contributions_goal_idx on public.goal_contributions (goal_id, contributed_on);

alter table public.goal_contributions enable row level security;

create policy "goal_contributions: owner can read"
  on public.goal_contributions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "goal_contributions: owner can insert"
  on public.goal_contributions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "goal_contributions: owner can update"
  on public.goal_contributions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "goal_contributions: owner can delete"
  on public.goal_contributions for delete to authenticated
  using (user_id = (select auth.uid()));
