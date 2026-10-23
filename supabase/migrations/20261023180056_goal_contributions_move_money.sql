-- Goal contributions move money: a deposit is also an expense, a withdrawal an
-- income, in a savings category, so "Disponível agora" drops when money is set
-- aside. The contribution points at its transaction; deleting the transaction
-- (from Lançamentos) takes the contribution with it, and the app deletes the
-- transaction when a contribution or goal is deleted.

alter table public.transactions
  add constraint transactions_id_user_id_key unique (id, user_id);

alter table public.goal_contributions
  add column transaction_id uuid unique,
  -- Composite key: a contribution can only point at its owner's transaction.
  add constraint goal_contributions_transaction_fkey
    foreign key (transaction_id, user_id) references public.transactions (id, user_id)
    on delete cascade;

-- Existing contributions get their transaction now, in the user's first savings
-- category, converted to the primary currency through the goal (or 1:1 when the
-- contribution already is in it). Combinations needing another rate are left
-- unlinked; there are none today.
create temp table _conversion as
select
  gc.id as contribution_id,
  gen_random_uuid() as transaction_id,
  gc.user_id,
  case when gc.amount_cents > 0 then 'expense' else 'income' end as type,
  (
    select c.id from public.categories c
    where c.user_id = gc.user_id and c.kind = 'savings'
    order by c.archived, c.sort_order
    limit 1
  ) as category_id,
  left('Meta · ' || g.name, 140) as description,
  abs(gc.amount_cents) as amount_cents,
  gc.currency,
  case when gc.currency = p.primary_currency then 1 else gc.fx_rate end as fx_rate,
  case
    when gc.currency = p.primary_currency then abs(gc.amount_cents)
    else abs(gc.amount_goal_cents)
  end as amount_primary_cents,
  gc.contributed_on
from public.goal_contributions gc
join public.goals g on g.id = gc.goal_id
join public.profiles p on p.id = gc.user_id
where gc.transaction_id is null
  and (gc.currency = p.primary_currency or g.currency = p.primary_currency);

delete from _conversion where category_id is null;

insert into public.transactions
  (id, user_id, type, category_id, description, amount_cents, currency, fx_rate,
   amount_primary_cents, occurred_on, status)
select transaction_id, user_id, type, category_id, description, amount_cents, currency,
       fx_rate, amount_primary_cents, contributed_on, 'confirmed'
from _conversion;

update public.goal_contributions gc
set transaction_id = c.transaction_id
from _conversion c
where gc.id = c.contribution_id;

drop table _conversion;
