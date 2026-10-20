-- RLS and integrity for goals and goal_contributions.
-- Run with `npm run test:rls` (pgTAP on the linked project; everything is rolled back).
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(10);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000000a', 'rls-a@example.test', '{"display_name":"A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'rls-b@example.test', '{"display_name":"B"}');

insert into public.goals (id, user_id, name, target_cents, currency, deadline)
values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000b', 'Viagem B', 500000, 'EUR', '2027-06-30');
insert into public.goal_contributions (user_id, goal_id, amount_cents, currency, amount_goal_cents, contributed_on)
values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 10000, 'EUR', 10000, '2026-10-01');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select is((select count(*)::int from public.goals), 0, 'A cannot read B''s goals');
select is((select count(*)::int from public.goal_contributions), 0, 'A cannot read B''s contributions');

select lives_ok(
  $$ insert into public.goals (id, name, target_cents, currency, deadline)
     values ('00000000-0000-0000-0000-0000000000a1', 'Reserva de emergência', 600000, 'EUR', '2027-12-31') $$,
  'A can create a goal'
);

select lives_ok(
  $$ insert into public.goal_contributions (goal_id, amount_cents, currency, amount_goal_cents, contributed_on)
     values ('00000000-0000-0000-0000-0000000000a1', -5000, 'EUR', -5000, '2026-10-20') $$,
  'A can record a withdrawal (negative contribution)'
);

select throws_ok(
  $$ insert into public.goal_contributions (goal_id, amount_cents, currency, amount_goal_cents, contributed_on)
     values ('00000000-0000-0000-0000-0000000000b1', 100, 'EUR', 100, '2026-10-20') $$,
  '23503',
  null,
  'A cannot contribute to B''s goal'
);

select throws_ok(
  $$ insert into public.goal_contributions (goal_id, amount_cents, currency, amount_goal_cents, contributed_on)
     values ('00000000-0000-0000-0000-0000000000a1', 0, 'EUR', 0, '2026-10-20') $$,
  '23514',
  null,
  'a contribution cannot be zero'
);

select is_empty(
  $$ update public.goals set target_cents = 1 where id = '00000000-0000-0000-0000-0000000000b1' returning id $$,
  'A cannot update B''s goal'
);

select is_empty(
  $$ delete from public.goals where id = '00000000-0000-0000-0000-0000000000b1' returning id $$,
  'A cannot delete B''s goal'
);

select lives_ok(
  $$ delete from public.goals where id = '00000000-0000-0000-0000-0000000000a1' $$,
  'A can delete its goal'
);

reset role;
select is(
  (select count(*)::int from public.goal_contributions where user_id = '00000000-0000-0000-0000-00000000000a'),
  0,
  'deleting a goal deletes its contributions'
);

select * from finish();
rollback;
