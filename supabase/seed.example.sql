-- Optional, and NOT run automatically.
--
-- schema.sql creates the three accounts opening at zero. Use this file as a
-- template if you want to set real opening balances or bulk-import history
-- from a spreadsheet — copy it, put your own numbers in, and run it in the
-- Supabase SQL editor.
--
-- The numbers below are placeholders. Keep your real figures out of the repo:
-- they belong in the database, not in version control.

-- ── Opening balances ────────────────────────────────────────────────────────
update accounts set starting_balance = 1000 where name = 'Nana';
update accounts set starting_balance = 1000 where name = 'Sai';
update accounts set starting_balance = 1000 where name = 'SBI';

-- ── Back-fill past entries ──────────────────────────────────────────────────
-- The casts matter: inside a UNION the literals don't inherit the target
-- column types, so an uncast date would arrive as text and the insert fails.
--
-- Valid `kind` values:     'spend' | 'income'
-- Valid `category` values: Groceries, Food & Dining, Shopping, Transport,
--                         Bills & Recharge, Health, Home, Entertainment, Other
--                         (must match lib/categories.ts exactly)

insert into transactions (date, expense, account_id, amount, kind, category)
select '2026-01-15'::date, 'Example expense'::text, id, 250::numeric, 'spend'::text,  'Groceries'::text from accounts where name = 'SBI'
union all
select '2026-01-01'::date, 'Example salary'::text,  id, 5000::numeric, 'income'::text, 'Other'::text     from accounts where name = 'SBI';
