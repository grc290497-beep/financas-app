-- Phase 3: fixed costs and recurring income.

create table public.recurring_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  type text not null check (type in ('income', 'expense')),
  name text not null check (char_length(name) between 1 and 60),
  category_id uuid not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null check (currency in ('EUR', 'BRL')),
  frequency text not null check (frequency in ('weekly', 'monthly', 'yearly')),
  -- Monthly only; short months fall on their last day (lib/recurring.ts).
  day_of_month int check (day_of_month between 1 and 31),
  start_on date not null,
  end_on date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (frequency <> 'monthly' or day_of_month is not null),
  check (end_on is null or end_on >= start_on),
  unique (id, user_id),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete restrict
);

create index recurring_items_user_idx on public.recurring_items (user_id, active);

alter table public.recurring_items enable row level security;

create policy "recurring_items: owner can read"
  on public.recurring_items for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "recurring_items: owner can insert"
  on public.recurring_items for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "recurring_items: owner can update"
  on public.recurring_items for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "recurring_items: owner can delete"
  on public.recurring_items for delete
  to authenticated
  using (user_id = (select auth.uid()));

create trigger recurring_items_set_updated_at
  before update on public.recurring_items
  for each row execute function public.set_updated_at();

-- Transactions generated from a recurring item. The composite key keeps a
-- row from pointing at someone else's item (foreign keys bypass RLS);
-- deleting the item keeps paid history and only clears the link.
alter table public.transactions
  add column recurring_item_id uuid,
  add constraint transactions_recurring_item_fkey
    foreign key (recurring_item_id, user_id)
    references public.recurring_items (id, user_id)
    on delete set null (recurring_item_id),
  -- Idempotent generation: one transaction per item and due date.
  add constraint transactions_recurring_item_occurred_on_key
    unique (recurring_item_id, occurred_on);

create index transactions_user_status_idx on public.transactions (user_id, status, occurred_on);
