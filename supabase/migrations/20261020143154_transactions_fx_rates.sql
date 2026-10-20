-- Phase 2: transactions and the FX rate cache.

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------

-- Lets transactions reference (category, owner) so a user can never attach a
-- row to someone else's category: foreign keys are not subject to RLS.
alter table public.categories
  add constraint categories_id_user_id_key unique (id, user_id);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  type text not null check (type in ('income', 'expense')),
  category_id uuid not null,
  description text check (char_length(description) <= 140),
  -- Original amount, in the currency it was entered in.
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null check (currency in ('EUR', 'BRL')),
  -- Frozen at entry time: currency -> primary currency, and the converted amount.
  fx_rate numeric(18, 6) not null default 1 check (fx_rate > 0),
  amount_primary_cents bigint not null check (amount_primary_cents >= 0),
  occurred_on date not null,
  status text not null default 'confirmed' check (status in ('planned', 'confirmed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete restrict
);

create index transactions_user_occurred_idx on public.transactions (user_id, occurred_on desc);
create index transactions_user_category_idx on public.transactions (user_id, category_id);

alter table public.transactions enable row level security;

create policy "transactions: owner can read"
  on public.transactions for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "transactions: owner can insert"
  on public.transactions for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "transactions: owner can update"
  on public.transactions for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "transactions: owner can delete"
  on public.transactions for delete
  to authenticated
  using (user_id = (select auth.uid()));

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- fx_rates: EUR -> BRL cache (lib/fx.ts). Public read, written only by the
-- server with the service role (which bypasses RLS).
-- ---------------------------------------------------------------------------
create table public.fx_rates (
  date date not null,
  base text not null check (base in ('EUR', 'BRL')),
  quote text not null check (quote in ('EUR', 'BRL')),
  rate numeric(18, 6) not null check (rate > 0),
  created_at timestamptz not null default now(),
  primary key (date, base, quote),
  check (base <> quote)
);

alter table public.fx_rates enable row level security;

create policy "fx_rates: anyone can read"
  on public.fx_rates for select
  to anon, authenticated
  using (true);
