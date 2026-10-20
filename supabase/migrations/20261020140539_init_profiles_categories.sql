-- Phase 1: user profile, categories and the signup trigger that seeds them.
-- RLS: every row belongs to auth.uid(). (select auth.uid()) is used so the
-- function runs once per statement instead of once per row.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  primary_currency text not null default 'EUR' check (primary_currency in ('EUR', 'BRL')),
  month_start_day int not null default 1 check (month_start_day between 1 and 28),
  locale text not null default 'pt-BR',
  onboarding_done boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: owner can read"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "profiles: owner can update"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No insert policy: rows are created by handle_new_user() (security definer).
-- No delete policy: a profile goes away with its auth.users row (cascade).

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  kind text not null check (kind in ('income', 'fixed', 'variable', 'savings')),
  icon text,
  color text check (color ~ '^#[0-9a-fA-F]{6}$'),
  monthly_budget_cents bigint check (monthly_budget_cents >= 0),
  archived boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, kind, name)
);

create index categories_user_id_idx on public.categories (user_id, kind, sort_order);

alter table public.categories enable row level security;

create policy "categories: owner can read"
  on public.categories for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "categories: owner can insert"
  on public.categories for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "categories: owner can update"
  on public.categories for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "categories: owner can delete"
  on public.categories for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Signup: create the profile and the default categories (PLAN.md section 4)
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''));

  insert into public.categories (user_id, name, kind, icon, color, sort_order)
  values
    (new.id, 'Salário',               'income',   'banknote',       '#16a34a', 1),
    (new.id, 'Renda extra',           'income',   'hand-coins',     '#22c55e', 2),
    (new.id, 'Outros',                'income',   'circle-plus',    '#84cc16', 3),
    (new.id, 'Aluguel',               'fixed',    'house',          '#6366f1', 1),
    (new.id, 'Contas da casa',        'fixed',    'lightbulb',      '#8b5cf6', 2),
    (new.id, 'Internet/Celular',      'fixed',    'wifi',           '#0ea5e9', 3),
    (new.id, 'Transporte',            'fixed',    'bus',            '#14b8a6', 4),
    (new.id, 'Seguros',               'fixed',    'shield-check',   '#64748b', 5),
    (new.id, 'Assinaturas',           'fixed',    'repeat',         '#a855f7', 6),
    (new.id, 'Mercado',               'variable', 'shopping-cart',  '#f97316', 1),
    (new.id, 'Restaurantes/Delivery', 'variable', 'utensils',       '#ef4444', 2),
    (new.id, 'Lazer',                 'variable', 'party-popper',   '#ec4899', 3),
    (new.id, 'Compras',               'variable', 'shopping-bag',   '#f43f5e', 4),
    (new.id, 'Saúde',                 'variable', 'heart-pulse',    '#e11d48', 5),
    (new.id, 'Viagens',               'variable', 'plane',          '#06b6d4', 6),
    (new.id, 'Imprevistos',           'variable', 'triangle-alert', '#eab308', 7),
    (new.id, 'Reserva',               'savings',  'piggy-bank',     '#10b981', 1),
    (new.id, 'Investimentos',         'savings',  'trending-up',    '#059669', 2);

  return new;
end;
$$;

-- Only the trigger may call it.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
