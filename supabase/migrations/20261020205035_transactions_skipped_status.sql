-- A planned occurrence of a recurring item the user removed is kept as
-- 'skipped' instead of being deleted: the row keeps its slot in
-- unique (recurring_item_id, occurred_on), so generation does not bring it
-- back. Skipped rows are hidden in the app and never counted.

alter table public.transactions drop constraint transactions_status_check;
alter table public.transactions
  add constraint transactions_status_check check (status in ('planned', 'confirmed', 'skipped'));

-- fixed_planned_cents summed recurring expenses of any status; leave skipped ones out.
-- (category_spend already sums only 'confirmed' and 'planned'.)
create or replace function public.month_summary(p_start date, p_end date)
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
    coalesce(sum(amount_primary_cents) filter (where type = 'expense' and recurring_item_id is not null and status <> 'skipped'), 0)::bigint,
    coalesce(sum(amount_primary_cents) filter (where type = 'expense' and status = 'confirmed' and recurring_item_id is null), 0)::bigint
  from public.transactions
  where user_id = (select auth.uid())
    and occurred_on between p_start and p_end;
$$;
