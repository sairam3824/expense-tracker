-- Ledger schema
-- Run this once in Supabase: Project → SQL Editor → New query → paste → Run.
-- Safe to re-run: every statement is idempotent.

-- ─────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  starting_balance numeric not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  expense text not null,
  account_id uuid not null references accounts(id) on delete cascade,
  amount numeric not null check (amount > 0),
  -- 'spend'    = money out
  -- 'income'   = money in (salary, transfer received from outside, top-up)
  -- 'transfer' = money moved between two of your own accounts. One row, not
  --              two: account_id is the source, to_account_id the destination.
  --              Logging it as a spend + an income would inflate both the
  --              month's spending and the category split with money you never
  --              actually spent.
  kind text not null default 'spend' check (kind in ('spend', 'income', 'transfer')),
  to_account_id uuid references accounts(id) on delete cascade,
  category text not null default 'Other',
  created_at timestamptz not null default now()
);

-- If you already ran an earlier version of this file, these add the new
-- columns in place instead of forcing you to start over.
alter table transactions add column if not exists kind text not null default 'spend';
alter table transactions add column if not exists category text not null default 'Other';
alter table transactions add column if not exists to_account_id uuid references accounts(id) on delete cascade;
alter table accounts add column if not exists sort_order integer not null default 0;

-- Dropped and re-added rather than guarded with an exception handler: the
-- earlier version of this file created a 'spend'/'income'-only constraint
-- under this same name, and that one has to go for transfers to insert.
alter table transactions drop constraint if exists transactions_kind_check;
alter table transactions add constraint transactions_kind_check
  check (kind in ('spend', 'income', 'transfer'));

-- A transfer must name a destination that isn't its own source; nothing else
-- may name one at all. This is what stops a half-written transfer from
-- silently vanishing money: without the destination the amount would leave the
-- source account and never arrive anywhere.
alter table transactions drop constraint if exists transactions_transfer_target_check;
alter table transactions add constraint transactions_transfer_target_check
  check (
    (kind = 'transfer' and to_account_id is not null and to_account_id <> account_id)
    or (kind <> 'transfer' and to_account_id is null)
  );

create index if not exists transactions_date_idx on transactions (date desc);
create index if not exists transactions_account_idx on transactions (account_id);
create index if not exists transactions_to_account_idx on transactions (to_account_id);
create index if not exists transactions_category_idx on transactions (category);

-- ─────────────────────────────────────────────────────────────
-- Monthly budgets — one cap per category, carried across every month.
--
-- Category is plain text for the same reason it is on transactions: the app's
-- category list is the source of truth and validates the value on write, so
-- adding a category never needs a migration here.
-- ─────────────────────────────────────────────────────────────

create table if not exists budgets (
  category text primary key,
  amount numeric not null check (amount >= 0),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Live balance per account
--   current = starting + money in − money out − transfers out + transfers in
--
-- A transfer row has to move two accounts in opposite directions, which a
-- single join on account_id can't express. `movement` expands each row into
-- the per-account movements it causes: every row credits or debits its
-- account_id, and a transfer emits one extra row crediting its destination.
-- ─────────────────────────────────────────────────────────────

drop view if exists account_balances;

create view account_balances as
with movement as (
  select
    account_id,
    case when kind = 'income'   then amount else 0 end as income,
    case when kind = 'spend'    then amount else 0 end as spent,
    case when kind = 'transfer' then amount else 0 end as transferred_out,
    0::numeric                                        as transferred_in
  from transactions

  union all

  select
    to_account_id as account_id,
    0::numeric,
    0::numeric,
    0::numeric,
    amount as transferred_in
  from transactions
  where kind = 'transfer' and to_account_id is not null
)
select
  a.id,
  a.name,
  a.starting_balance,
  a.sort_order,
  a.created_at,
  coalesce(sum(m.spent), 0)            as total_spent,
  coalesce(sum(m.income), 0)           as total_income,
  coalesce(sum(m.transferred_out), 0)  as total_transferred_out,
  coalesce(sum(m.transferred_in), 0)   as total_transferred_in,
  a.starting_balance
    + coalesce(sum(m.income), 0)
    - coalesce(sum(m.spent), 0)
    + coalesce(sum(m.transferred_in), 0)
    - coalesce(sum(m.transferred_out), 0) as current_balance
from accounts a
left join movement m on m.account_id = a.id
group by a.id;

-- Make the view respect the caller's RLS rather than the view owner's rights.
alter view account_balances set (security_invoker = on);

-- ─────────────────────────────────────────────────────────────
-- Create the three accounts, all opening at zero.
--
-- No real balances or expenses live in this file on purpose — this repo
-- describes the *structure*, your money stays in the database. Set your
-- opening balances from the SQL editor once (see supabase/seed.example.sql),
-- or just log entries in the app.
-- ─────────────────────────────────────────────────────────────

insert into accounts (name, starting_balance, sort_order) values
  ('Nana', 0, 1),
  ('Sai',  0, 2),
  ('SBI',  0, 3)
on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────
-- Row Level Security — deny everything to the public roles.
--
-- The app never talks to Supabase from the browser. All reads and writes go
-- through Next.js server code using the service_role key, which bypasses RLS.
-- Enabling RLS with NO policies means anon/authenticated get nothing, so even
-- if a key leaked the database stays shut.
-- ─────────────────────────────────────────────────────────────

alter table accounts enable row level security;
alter table transactions enable row level security;
alter table budgets enable row level security;

-- Drop the permissive policies from the earlier version of this file.
drop policy if exists "public read accounts"       on accounts;
drop policy if exists "public update accounts"     on accounts;
drop policy if exists "public read transactions"   on transactions;
drop policy if exists "public insert transactions" on transactions;
drop policy if exists "public delete transactions" on transactions;

revoke all on accounts         from anon, authenticated;
revoke all on transactions     from anon, authenticated;
revoke all on budgets          from anon, authenticated;
revoke all on account_balances from anon, authenticated;
