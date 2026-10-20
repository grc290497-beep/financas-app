-- Phase 4: per-period totals for the dashboard and budgets, in the primary
-- currency. security invoker: RLS applies, and the user is always the caller.

create function public.month_summary(p_start date, p_end date)
returns table (
  income_cents bigint,
  expense_cents bigint,
  fixed_planned_cents bigint,
  variable_spent_cents bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(sum(amount_primary_cents) filter (where type = 'income' and status = 'confirmed'), 0)::bigint,
    coalesce(sum(amount_primary_cents) filter (where type = 'expense' and status = 'confirmed'), 0)::bigint,
    coalesce(sum(amount_primary_cents) filter (where type = 'expense' and recurring_item_id is not null), 0)::bigint,
    coalesce(sum(amount_primary_cents) filter (where type = 'expense' and status = 'confirmed' and recurring_item_id is null), 0)::bigint
  from public.transactions
  where user_id = (select auth.uid())
    and occurred_on between p_start and p_end;
$$;

-- Every active expense category (so budgets show even with nothing spent),
-- with what was paid and what is still planned in the period.
create function public.category_spend(p_start date, p_end date)
returns table (
  category_id uuid,
  name text,
  kind text,
  icon text,
  color text,
  budget_cents bigint,
  spent_cents bigint,
  planned_cents bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id,
    c.name,
    c.kind,
    c.icon,
    c.color,
    c.monthly_budget_cents,
    coalesce(sum(t.amount_primary_cents) filter (where t.status = 'confirmed'), 0)::bigint,
    coalesce(sum(t.amount_primary_cents) filter (where t.status = 'planned'), 0)::bigint
  from public.categories c
  left join public.transactions t
    on t.category_id = c.id
   and t.type = 'expense'
   and t.occurred_on between p_start and p_end
  where c.user_id = (select auth.uid())
    and c.kind <> 'income'
    and not c.archived
  group by c.id
  order by 7 desc, c.kind, c.sort_order;
$$;

revoke execute on function public.month_summary(date, date) from public, anon;
revoke execute on function public.category_spend(date, date) from public, anon;
grant execute on function public.month_summary(date, date) to authenticated;
grant execute on function public.category_spend(date, date) to authenticated;
