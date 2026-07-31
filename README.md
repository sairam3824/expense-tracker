<div align="center">

# Ledger

**A private, phone-first expense tracker for three accounts.**

Live balances, budgets, transfers and category breakdowns — behind a single
login, with nothing sensitive ever reaching the browser.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ecf8e?logo=supabase&logoColor=white)](https://supabase.com)

</div>

---

## Contents

- [What it does](#what-it-does)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
  - [1. Set up Supabase](#1-set-up-supabase)
  - [2. Configure environment variables](#2-configure-environment-variables)
  - [3. Run it](#3-run-it)
  - [4. Deploy to Vercel](#4-deploy-to-vercel)
- [How the numbers work](#how-the-numbers-work)
- [Security model](#security-model)
- [Project structure](#project-structure)
- [Scripts](#scripts)
- [Notes on the charts](#notes-on-the-charts)
- [License](#license)

---

## What it does

Three accounts (Nana, Sai, SBI) with live balances, a username/password login, a
spending dashboard and category breakdowns. Built with Next.js + Supabase,
deployed on Vercel, designed for a phone.

| | |
|---|---|
| **Login** | One username and password, held in environment variables. Nothing is reachable signed out. |
| **Spend, add or move money** | Every entry is money out, money in, or a transfer between two of your own accounts. |
| **Edit anything** | Tap an entry to change any field, including switching what kind of entry it is. |
| **Budgets** | A monthly cap per category, with what's left and what that comes to per remaining day. |
| **Copy a balance** | Tap the copy icon on any account (or the total). |
| **Monthly summary** | Spent, added and entry count for any month. |
| **Category split** | Where the month's money went, as a share bar plus ranked bars. |
| **Auto-categorising** | OpenAI picks the category from what you typed; you can always override it, and it falls back to keyword matching without a key. |
| **Installable** | A web app manifest and icons, so **Add to Home Screen** gives you a real app. |

> [!IMPORTANT]
> Upgrading from an earlier version? Re-run `supabase/schema.sql` before
> starting the app — transfers and budgets both need new columns and a rebuilt
> balance view. The app says so on screen if you forget.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Server Components, Server Actions) |
| UI | React 19, Tailwind CSS 4 |
| Database | Supabase (Postgres) with RLS locked shut |
| Auth | Single user, scrypt-hashed password, signed session cookie |
| Categorising | OpenAI `gpt-4o-mini`, with a local keyword fallback |
| Hosting | Vercel |

No client-side data library, no ORM, no component kit: reads and writes are
plain SQL through the Supabase client, all of it on the server.

---

## Getting started

**Prerequisites:** Node.js 20+, a free Supabase project, and (optionally) an
OpenAI API key.

### 1. Set up Supabase

1. [supabase.com](https://supabase.com) → **New project** (free tier is fine).
2. **SQL Editor → New query** → paste all of `supabase/schema.sql` → **Run**.
   The script is idempotent, so it's safe to re-run.
3. **Project Settings → API** — copy the **Project URL** and the
   **`service_role`** key.

Accounts are created opening at zero. To set real opening balances or bulk-import
past entries, copy `supabase/seed.example.sql`, put your own numbers in, and run
that in the SQL editor. Neither file carries real figures on purpose — this repo
describes the *structure*; your money stays in the database.

> [!NOTE]
> The app uses the `service_role` key, not the anon key. The schema turns on RLS
> with no policies, so the database refuses every browser-side request; only
> Next.js server code gets through. The anon key is useless on its own, which is
> the point.

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

| Variable | Required | What it is |
|---|:---:|---|
| `SUPABASE_URL` | ✅ | Project URL from step 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | **service_role** key from step 1 |
| `APP_USERNAME` | ✅ | The username you'll type to sign in |
| `APP_PASSWORD_HASH` | ✅ | scrypt hash of your password — run `npm run hash-password` |
| `SESSION_SECRET` | ✅ | Random string, 16+ chars — `openssl rand -base64 32` |
| `OPENAI_API_KEY` | — | Without it, categories use keyword matching |

None of these are `NEXT_PUBLIC_`, so none of them reach the browser.

#### The password

Your password is never stored anywhere, in this repo or in your environment —
only a scrypt hash of it is. Generate the hash with:

```bash
npm run hash-password
```

It prompts twice without echoing, verifies the hash round-trips, and prints the
`APP_PASSWORD_HASH=…` line to paste into `.env.local` and Vercel.

scrypt is used rather than PBKDF2 or a bare SHA because it is *memory-hard*:
each attempt costs ~64 MB, which blunts the GPU and ASIC parallelism that makes
offline cracking cheap. Verifying costs about 150 ms — unnoticeable when you
sign in, expensive for anyone guessing.

Forgotten it? There's no recovery step and none is needed: run
`npm run hash-password` again and replace the value.

### 3. Run it

```bash
npm install
npm run dev
```

Open <http://localhost:3000> and sign in.

### 4. Deploy to Vercel

1. Push to GitHub (`.gitignore` already excludes `.env.local`):
   ```bash
   git init && git add . && git commit -m "Initial commit"
   gh repo create expense-tracker --private --source=. --push
   ```
2. [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
3. Add the environment variables from the table above.
4. **Deploy**, then open the `.vercel.app` URL on your phone and use
   **Add to Home Screen**.

---

## How the numbers work

`accounts.starting_balance` is the opening balance. The `account_balances` view
keeps each account current:

```
current_balance = starting_balance
                + sum(money in)      − sum(money out)
                + sum(transfers in)  − sum(transfers out)
```

Category totals count **spending only** — neither a salary credit nor a transfer
is a budget line, and either would otherwise swamp every real category.

### Transfers

Moving money between your own accounts is **one row**, not two: `account_id` is
the source and `to_account_id` the destination. Logging it as a spend plus an
income would inflate both the month's spending and the category split with money
you never actually spent.

Because one row has to move two accounts in opposite directions, the balance view
first expands each transaction into the per-account movements it causes (see the
`movement` CTE), rather than joining on `account_id` alone. A database constraint
requires every transfer to name a destination that isn't its own source — that's
what stops a half-written transfer from making money vanish.

In the statement table, transfers appear as a signed **Moved** column that nets
to zero across your accounts, which is correct: shifting money between them
changes no total.

### Budgets

One cap per category in the `budgets` table, applying to every month. "No cap" is
stored as the absence of a row rather than a zero, so it can never be confused
with "capped at ₹0".

Spending in capped categories and spending in uncapped ones are reported
separately. Rolling them into a single "spent vs budget" figure would put you
over budget because of a category you never capped, which is the usual way these
screens mislead.

---

## Security model

For a single-user app holding real balances, the goal is simple: a leaked key or
a stray request should get nothing.

- **The browser never talks to Supabase.** Every read and write goes through
  Server Components and Server Actions. There is no anon key in the bundle
  because there is no client-side Supabase client.
- **RLS on, policies none.** `anon` and `authenticated` are revoked on every
  table and the balance view, so the database answers browser-side requests with
  nothing at all.
- **The password exists only as a scrypt hash**, compared in constant time.
- **The session is a signed, HTTP-only cookie**; every page and action checks it
  before touching data.
- **No real figures in version control** — `schema.sql` opens accounts at zero
  and `seed.example.sql` ships placeholders.

## Project structure

```
app/
  actions.ts          Server Actions — every write, plus auth checks
  page.tsx            The dashboard (Server Component)
  login/              Sign-in page
  icon.tsx  apple-icon.tsx  manifest.ts   PWA metadata
components/
  Dashboard.tsx       Client shell that ties the panels together
  AccountCard.tsx     Balance card with copy-to-clipboard
  EntrySheet.tsx      Add/edit sheet for spends, income and transfers
  BudgetPanel.tsx     Monthly caps, what's left, per-remaining-day
  MonthLedgerTable.tsx  Statement view with the signed "Moved" column
  TransactionList.tsx
  charts/             CategoryBreakdown, MonthlyTrend
lib/
  data.ts             All Supabase queries
  aggregate.ts        Month totals, category splits, budget maths
  auth.ts             Session cookie sign/verify
  password.ts         scrypt hash and constant-time verify
  categories.ts       Category list, keywords and chart colors
  categorize.ts       OpenAI classification with keyword fallback
  format.ts  types.ts  supabase-server.ts
scripts/
  hash-password.mjs   Interactive scrypt hash generator
supabase/
  schema.sql          Tables, constraints, indexes, balance view, RLS
  seed.example.sql    Optional template for opening balances and history
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run hash-password` | Generate `APP_PASSWORD_HASH` |

## Notes on the charts

Category colors live in `lib/categories.ts` and were checked with a palette
validator against this app's paper surface: colorblind separation, chroma and
lightness all pass, and every category is labelled in text so nothing is
communicated by color alone. If you change a color, re-check it rather than
eyeballing it.

The month breakdown is a share bar plus ranked bars rather than a pie — nine
categories in a donut is unreadable at phone width.

---

## License

Released under the [MIT License](LICENSE). © 2026 Sai Rama Linga Reddy Maruri.
