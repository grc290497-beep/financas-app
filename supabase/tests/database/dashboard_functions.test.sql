-- month_summary / category_spend: correct totals, and only the caller's rows.
-- Run with `npm run test:rls` (pgTAP on the linked project; everything is rolled back).
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(7);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000000a', 'rls-a@example.test', '{"display_name":"A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'rls-b@example.test', '{"display_name":"B"}');

-- A, financial month 25/10 -> 24/11: salary, paid rent, planned internet,
-- a grocery run, and one grocery run outside the period.
insert into public.recurring_items (id, user_id, type, name, category_id, amount_cents, currency, frequency, day_of_month, start_on)
select '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', 'expense', 'Aluguel', id, 100000, 'EUR', 'monthly', 1, '2026-01-01'
from public.categories where user_id = '00000000-0000-0000-0000-00000000000a' and name = 'Aluguel';

insert into public.transactions (user_id, type, category_id, amount_cents, currency, amount_primary_cents, occurred_on, status, recurring_item_id)
select '00000000-0000-0000-0000-00000000000a', v.type, c.id, v.cents, 'EUR', v.cents, v.day::date, v.status, v.item::uuid
from (values
  ('income',  'Salário',          300000, '2026-10-25', 'confirmed', null),
  ('expense', 'Aluguel',          100000, '2026-11-01', 'confirmed', '00000000-0000-0000-0000-0000000000a1'),
  ('expense', 'Internet/Celular',  20000, '2026-11-05', 'planned',   null),
  ('expense', 'Mercado',            5000, '2026-11-10', 'confirmed', null),
  ('expense', 'Mercado',            9999, '2026-11-25', 'confirmed', null)
) as v(type, category, cents, day, status, item)
join public.categories c on c.user_id = '00000000-0000-0000-0000-00000000000a' and c.name = v.category;

-- B has a huge expense in the same period.
insert into public.transactions (user_id, type, category_id, amount_cents, currency, amount_primary_cents, occurred_on)
select '00000000-0000-0000-0000-00000000000b', 'expense', id, 999999, 'EUR', 999999, '2026-11-10'
from public.categories where user_id = '00000000-0000-0000-0000-00000000000b' and name = 'Mercado';

update public.categories set monthly_budget_cents = 6000
where user_id = '00000000-0000-0000-0000-00000000000a' and name = 'Mercado';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select results_eq(
  $$ select income_cents, expense_cents, fixed_planned_cents, variable_spent_cents
     from public.month_summary('2026-10-25', '2026-11-24') $$,
  $$ values (300000::bigint, 105000::bigint, 100000::bigint, 5000::bigint) $$,
  'month_summary totals only A''s confirmed rows in the period; fixed counts recurring items'
);

select results_eq(
  $$ select spent_cents, planned_cents, budget_cents from public.category_spend('2026-10-25', '2026-11-24') where name = 'Mercado' $$,
  $$ values (5000::bigint, 0::bigint, 6000::bigint) $$,
  'category_spend sums A''s Mercado in the period, with its budget'
);

select results_eq(
  $$ select planned_cents from public.category_spend('2026-10-25', '2026-11-24') where name = 'Internet/Celular' $$,
  $$ values (20000::bigint) $$,
  'planned expenses are reported apart from spending'
);

select is(
  (select count(*)::int from public.category_spend('2026-10-25', '2026-11-24') where kind = 'income'),
  0,
  'income categories are left out'
);

select is(
  (select count(*)::int from public.category_spend('2026-10-25', '2026-11-24')),
  15,
  'every active expense category is listed, spent or not'
);

-- B sees only B.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select results_eq(
  $$ select expense_cents from public.month_summary('2026-10-25', '2026-11-24') $$,
  $$ values (999999::bigint) $$,
  'B''s summary does not include A''s rows'
);

reset role;
set local role anon;
select throws_ok(
  $$ select * from public.month_summary('2026-10-25', '2026-11-24') $$,
  '42501',
  null,
  'anon cannot call the dashboard functions'
);

select * from finish();
rollback;
