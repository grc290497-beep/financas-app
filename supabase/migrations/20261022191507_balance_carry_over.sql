-- "Disponível agora" can carry what was left in earlier months, starting from
-- an opening balance (what was in the bank before using the app), in the
-- primary currency. Off by default: each month stands alone.

alter table public.profiles
  add column carry_over boolean not null default false,
  add column opening_balance_cents bigint not null default 0
    check (opening_balance_cents between -100000000000 and 100000000000);

-- Confirmed income minus confirmed expenses before a date, in the primary currency.
create function public.balance_before(p_before date)
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(case when type = 'income' then amount_primary_cents else -amount_primary_cents end), 0)::bigint
  from public.transactions
  where user_id = (select auth.uid())
    and status = 'confirmed'
    and occurred_on < p_before;
$$;

revoke execute on function public.balance_before(date) from public, anon;
grant execute on function public.balance_before(date) to authenticated;
