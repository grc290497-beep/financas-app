-- 'skipped' occurrences of a recurring item: never regenerated, never counted.
-- Run with `npm run test:rls` (pgTAP on the linked project; everything is rolled back).
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(5);

insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000c1', 'skip@example.test', '{"display_name":"C"}');

insert into public.recurring_items (id, user_id, type, name, category_id, amount_cents, currency, frequency, day_of_month, start_on)
select '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c1', 'expense', 'Internet', id, 3000, 'EUR', 'monthly', 5, '2026-01-01'
from public.categories where user_id = '00000000-0000-0000-0000-0000000000c1' and name = 'Internet/Celular';

insert into public.transactions (user_id, type, category_id, amount_cents, currency, amount_primary_cents, occurred_on, status, recurring_item_id)
select '00000000-0000-0000-0000-0000000000c1', 'expense', id, 3000, 'EUR', 3000, v.day::date, v.status, '00000000-0000-0000-0000-0000000000c2'
from public.categories, (values ('2026-11-05', 'skipped'), ('2026-12-05', 'planned')) as v(day, status)
where user_id = '00000000-0000-0000-0000-0000000000c1' and name = 'Internet/Celular';

-- What generation does (lib/recurring-store.ts): upsert ignoring duplicates.
insert into public.transactions (user_id, type, category_id, amount_cents, currency, amount_primary_cents, occurred_on, status, recurring_item_id)
select '00000000-0000-0000-0000-0000000000c1', 'expense', id, 3000, 'EUR', 3000, '2026-11-05', 'planned', '00000000-0000-0000-0000-0000000000c2'
from public.categories where user_id = '00000000-0000-0000-0000-0000000000c1' and name = 'Internet/Celular'
on conflict (recurring_item_id, occurred_on) do nothing;

select is(
  (select status from public.transactions where recurring_item_id = '00000000-0000-0000-0000-0000000000c2' and occurred_on = '2026-11-05'),
  'skipped',
  'generation does not bring a skipped occurrence back'
);

select throws_ok(
  $$ update public.transactions set status = 'deleted' where recurring_item_id = '00000000-0000-0000-0000-0000000000c2' $$,
  '23514',
  null,
  'statuses other than planned, confirmed and skipped are rejected'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';

select is(
  (select fixed_planned_cents from public.month_summary('2026-11-01', '2026-11-30')),
  0::bigint,
  'a skipped fixed cost is not planned'
);
select is(
  (select fixed_planned_cents from public.month_summary('2026-12-01', '2026-12-31')),
  3000::bigint,
  'a planned fixed cost still is'
);
select is(
  (select sum(spent_cents + planned_cents) from public.category_spend('2026-11-01', '2026-11-30')),
  0::numeric,
  'category_spend ignores skipped rows'
);

select * from finish();
rollback;
