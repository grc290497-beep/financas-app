-- RLS, idempotency and integrity for recurring_items.
-- Run with `npm run test:rls` (pgTAP on the linked project; everything is rolled back).
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(11);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000000a', 'rls-a@example.test', '{"display_name":"A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'rls-b@example.test', '{"display_name":"B"}');

-- B pays rent on the 1st.
insert into public.recurring_items (id, user_id, type, name, category_id, amount_cents, currency, frequency, day_of_month, start_on)
select '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000b', 'expense', 'Aluguel', id, 120000, 'EUR', 'monthly', 1, '2026-01-01'
from public.categories where user_id = '00000000-0000-0000-0000-00000000000b' and name = 'Aluguel';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select is((select count(*)::int from public.recurring_items), 0, 'A cannot read B''s recurring items');

select lives_ok(
  $$ insert into public.recurring_items (id, type, name, category_id, amount_cents, currency, frequency, day_of_month, start_on)
     select '00000000-0000-0000-0000-0000000000a1', 'expense', 'Aluguel', id, 90000, 'EUR', 'monthly', 1, '2026-01-01'
     from public.categories where name = 'Aluguel' $$,
  'A can create its own recurring item'
);

select throws_ok(
  $$ insert into public.recurring_items (user_id, type, name, category_id, amount_cents, currency, frequency, day_of_month, start_on)
     select '00000000-0000-0000-0000-00000000000b', 'expense', 'X', id, 100, 'EUR', 'monthly', 1, '2026-01-01'
     from public.categories where name = 'Aluguel' $$,
  '42501',
  null,
  'A cannot create a recurring item owned by B'
);

select is_empty(
  $$ update public.recurring_items set amount_cents = 1
     where id = '00000000-0000-0000-0000-0000000000b1' returning id $$,
  'A cannot update B''s recurring item'
);

select is_empty(
  $$ delete from public.recurring_items where id = '00000000-0000-0000-0000-0000000000b1' returning id $$,
  'A cannot delete B''s recurring item'
);

select throws_ok(
  $$ insert into public.recurring_items (type, name, category_id, amount_cents, currency, frequency, start_on)
     select 'expense', 'Sem dia', id, 100, 'EUR', 'monthly', '2026-01-01'
     from public.categories where name = 'Aluguel' $$,
  '23514',
  null,
  'a monthly item needs a day of the month'
);

-- Generation: the planned rent for October, twice.
select lives_ok(
  $$ insert into public.transactions (type, category_id, amount_cents, currency, amount_primary_cents, occurred_on, status, recurring_item_id)
     select 'expense', category_id, amount_cents, currency, amount_cents, '2026-10-01', 'planned', id
     from public.recurring_items where id = '00000000-0000-0000-0000-0000000000a1' $$,
  'A can generate a planned transaction from its item'
);

select throws_ok(
  $$ insert into public.transactions (type, category_id, amount_cents, currency, amount_primary_cents, occurred_on, status, recurring_item_id)
     select 'expense', category_id, amount_cents, currency, amount_cents, '2026-10-01', 'planned', id
     from public.recurring_items where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '23505',
  null,
  'the same item cannot generate the same date twice'
);

select throws_ok(
  $$ insert into public.transactions (type, category_id, amount_cents, currency, amount_primary_cents, occurred_on, recurring_item_id)
     select 'expense', id, 100, 'EUR', 100, '2026-10-02', '00000000-0000-0000-0000-0000000000b1'
     from public.categories where name = 'Aluguel' $$,
  '23503',
  null,
  'A cannot link a transaction to B''s recurring item'
);

-- Deleting the item keeps the transaction and clears the link.
select lives_ok(
  $$ delete from public.recurring_items where id = '00000000-0000-0000-0000-0000000000a1' $$,
  'A can delete its recurring item'
);

select is(
  (select count(*)::int from public.transactions where occurred_on = '2026-10-01' and recurring_item_id is null),
  1,
  'its transactions stay, unlinked'
);

select * from finish();
rollback;
