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
  -- 'spend' = money out, 'income' = money in (salary, transfer received, top-up)
  kind text not null default 'spend' check (kind in ('spend', 'income')),
  category text not null default 'Other',
  created_at timestamptz not null default now()
);

-- If you already ran the earlier version of this file, these add the new
-- columns in place instead of forcing you to start over.
alter table transactions add column if not exists kind text not null default 'spend';
alter table transactions add column if not exists category text not null default 'Other';
alter table accounts add column if not exists sort_order integer not null default 0;

do $$ begin
  alter table transactions add constraint transactions_kind_check
    check (kind in ('spend', 'income'));
exception when duplicate_object then null;
end $$;

create index if not exists transactions_date_idx on transactions (date desc);
create index if not exists transactions_account_idx on transactions (account_id);
create index if not exists transactions_category_idx on transactions (category);

-- ─────────────────────────────────────────────────────────────
-- Live balance per account
--   current = starting + money in − money out
-- ─────────────────────────────────────────────────────────────

drop view if exists account_balances;

create view account_balances as
select
  a.id,
  a.name,
  a.starting_balance,
  a.sort_order,
  a.created_at,
  coalesce(sum(t.amount) filter (where t.kind = 'spend'), 0)  as total_spent,
  coalesce(sum(t.amount) filter (where t.kind = 'income'), 0) as total_income,
  a.starting_balance
    + coalesce(sum(t.amount) filter (where t.kind = 'income'), 0)
    - coalesce(sum(t.amount) filter (where t.kind = 'spend'), 0) as current_balance
from accounts a
left join transactions t on t.account_id = a.id
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

-- Drop the permissive policies from the earlier version of this file.
drop policy if exists "public read accounts"       on accounts;
drop policy if exists "public update accounts"     on accounts;
drop policy if exists "public read transactions"   on transactions;
drop policy if exists "public insert transactions" on transactions;
drop policy if exists "public delete transactions" on transactions;

revoke all on accounts         from anon, authenticated;
revoke all on transactions     from anon, authenticated;
revoke all on account_balances from anon, authenticated;
