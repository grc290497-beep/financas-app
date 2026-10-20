-- RLS: user A can neither read nor modify user B's rows.
-- Run with `npm run test:rls` (pgTAP on the linked project; everything is rolled back).
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(17);

-- Two users. The signup trigger creates their profiles and default categories.
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000000a', 'rls-a@example.test', '{"display_name":"A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'rls-b@example.test', '{"display_name":"B"}');

select is(
  (select count(*)::int from public.profiles
    where id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b')),
  2,
  'signup trigger creates one profile per user'
);

select is(
  (select count(*)::int from public.categories where user_id = '00000000-0000-0000-0000-00000000000b'),
  18,
  'signup trigger seeds the 18 default categories'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'RLS is enabled on profiles'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.categories'::regclass),
  'RLS is enabled on categories'
);

-- Act as user A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select is((select count(*)::int from public.profiles), 1, 'A sees only one profile');
select is((select id from public.profiles), '00000000-0000-0000-0000-00000000000a'::uuid, 'the profile A sees is its own');
select is((select count(*)::int from public.categories), 18, 'A sees only its own 18 categories');
select is(
  (select count(*)::int from public.categories where user_id = '00000000-0000-0000-0000-00000000000b'),
  0,
  'A cannot read B''s categories'
);

select is_empty(
  $$ update public.profiles set display_name = 'hacked'
     where id = '00000000-0000-0000-0000-00000000000b' returning id $$,
  'A cannot update B''s profile'
);

select is_empty(
  $$ update public.categories set name = 'hacked'
     where user_id = '00000000-0000-0000-0000-00000000000b' returning id $$,
  'A cannot update B''s categories'
);

select is_empty(
  $$ delete from public.categories
     where user_id = '00000000-0000-0000-0000-00000000000b' returning id $$,
  'A cannot delete B''s categories'
);

select throws_ok(
  $$ insert into public.categories (user_id, name, kind)
     values ('00000000-0000-0000-0000-00000000000b', 'Injected', 'variable') $$,
  '42501',
  null,
  'A cannot insert a category owned by B'
);

select throws_ok(
  $$ update public.categories set user_id = '00000000-0000-0000-0000-00000000000b'
     where user_id = '00000000-0000-0000-0000-00000000000a' $$,
  '42501',
  null,
  'A cannot hand its own category over to B'
);

select lives_ok(
  $$ update public.profiles set primary_currency = 'BRL', month_start_day = 25
     where id = '00000000-0000-0000-0000-00000000000a' $$,
  'A can update its own profile'
);

-- Anonymous visitors see nothing.
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is((select count(*)::int from public.categories), 0, 'anon sees no categories');

-- Back as the owner of the tables: B's data is untouched.
reset role;

select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
  'B',
  'B''s profile is unchanged'
);

select is(
  (select count(*)::int from public.categories
    where user_id = '00000000-0000-0000-0000-00000000000b' and name <> 'hacked'),
  18,
  'B still has its 18 unmodified categories'
);

select * from finish();
rollback;
