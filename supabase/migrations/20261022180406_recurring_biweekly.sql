-- Fortnightly items (a salary paid every two weeks): every 14 days from start_on.
alter table public.recurring_items drop constraint recurring_items_frequency_check;
alter table public.recurring_items
  add constraint recurring_items_frequency_check
  check (frequency in ('weekly', 'biweekly', 'monthly', 'yearly'));
