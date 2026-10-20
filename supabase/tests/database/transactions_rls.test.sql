-- RLS and integrity for transactions and fx_rates.
-- Run with `npm run test:rls` (pgTAP on the linked project; everything is rolled back).
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(13);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000000a', 'rls-a@example.test', '{"display_name":"A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'rls-b@example.test', '{"display_name":"B"}');

-- B already has one expense.
insert into public.transactions
  (user_id, type, category_id, amount_cents, currency, fx_rate, amount_primary_cents, occurred_on)
select '00000000-0000-0000-0000-00000000000b', 'expense', id, 8000, 'BRL', 0.177497, 1420, '2026-10-20'
from public.categories
where user_id = '00000000-0000-0000-0000-00000000000b' and name = 'Mercado';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select is((select count(*)::int from public.transactions), 0, 'A cannot read B''s transactions');

select lives_ok(
  $$ insert into public.transactions (type, category_id, amount_cents, currency, amount_primary_cents, occurred_on)
     select 'expense', id, 1250, 'EUR', 1250, '2026-10-20' from public.categories where name = 'Mercado' $$,
  'A can add a transaction in its own category'
);

select is((select count(*)::int from public.transactions), 1, 'A sees only its own transaction');

select throws_ok(
  $$ insert into public.transactions (user_id, type, category_id, amount_cents, currency, amount_primary_cents, occurred_on)
     select '00000000-0000-0000-0000-00000000000b', 'expense', id, 100, 'EUR', 100, '2026-10-20'
     from public.categories where name = 'Mercado' $$,
  '42501',
  null,
  'A cannot insert a transaction owned by B'
);

select throws_ok(
  $$ insert into public.transactions (type, category_id, amount_cents, currency, amount_primary_cents, occurred_on)
     values ('expense', null, 100, 'EUR', 100, '2026-10-20') $$,
  '23502',
  null,
  'a transaction needs a category'
);

-- B's category id is invisible to A, so take it as the table owner and pass it in.
reset role;
select set_config('rls.b_category', (
  select id::text from public.categories
  where user_id = '00000000-0000-0000-0000-00000000000b' and name = 'Mercado'
), true);
set local role authenticated;

select throws_ok(
  $$ insert into public.transactions (type, category_id, amount_cents, currency, amount_primary_cents, occurred_on)
     values ('expense', current_setting('rls.b_category')::uuid, 100, 'EUR', 100, '2026-10-20') $$,
  '23503',
  null,
  'A cannot attach a transaction to B''s category'
);

select is_empty(
  $$ update public.transactions set amount_cents = 1
     where user_id = '00000000-0000-0000-0000-00000000000b' returning id $$,
  'A cannot update B''s transactions'
);

select is_empty(
  $$ delete from public.transactions
     where user_id = '00000000-0000-0000-0000-00000000000b' returning id $$,
  'A cannot delete B''s transactions'
);

select throws_ok(
  $$ update public.transactions set user_id = '00000000-0000-0000-0000-00000000000b' $$,
  '42501',
  null,
  'A cannot hand its transaction over to B'
);

select throws_ok(
  $$ update public.transactions set amount_cents = 0 $$,
  '23514',
  null,
  'amounts must be positive'
);

select throws_ok(
  $$ insert into public.fx_rates (date, base, quote, rate) values ('2026-10-20', 'EUR', 'BRL', 99) $$,
  '42501',
  null,
  'users cannot write the FX cache'
);

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is((select count(*)::int from public.transactions), 0, 'anon sees no transactions');

reset role;

select is(
  (select amount_cents from public.transactions where user_id = '00000000-0000-0000-0000-00000000000b'),
  8000::bigint,
  'B''s transaction is unchanged'
);

select * from finish();
rollback;
