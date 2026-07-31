# Ledger — expense tracker

Three accounts (Nana, Sai, SBI) with live balances, a username/password login, a
spending dashboard, and category breakdowns. Built with Next.js + Supabase,
deployed on Vercel, designed for a phone.

- **Login** — one username and password, held in environment variables. Nothing
  is reachable signed out.
- **Spend, add or move money** — every entry is money out, money in, or a
  transfer between two of your own accounts.
- **Edit anything** — tap an entry to change any field, including switching what
  kind of entry it is.
- **Budgets** — a monthly cap per category, with what's left and what that comes
  to per remaining day.
- **Copy a balance** — tap the copy icon on any account (or the total).
- **Monthly summary** — spent, added and entry count for any month.
- **Category split** — where the month's money went.
- **Auto-categorising** — OpenAI picks the category from what you typed; you can
  always override it, and it falls back to keyword matching without a key.

> Upgrading from an earlier version? Re-run `supabase/schema.sql` before
> starting the app — transfers and budgets both need new columns and a rebuilt
> balance view. The app says so on screen if you forget.

## 1. Set up Supabase

1. supabase.com → **New project** (free tier is fine).
2. **SQL Editor → New query** → paste all of `supabase/schema.sql` → **Run**.
   Edit the opening balances near the bottom of that file first if they've
   changed. The script is safe to re-run.
3. **Project Settings → API** — copy the **Project URL** and the
   **`service_role`** key.

> The app uses the `service_role` key, not the anon key. The schema turns on RLS
> with no policies, so the database refuses every browser-side request; only
> Next.js server code gets through. The anon key is now useless on its own,
> which is the point.

## 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

| Variable | What it is |
|---|---|
| `SUPABASE_URL` | Project URL from step 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | **service_role** key from step 1 |
| `APP_USERNAME` | the username you'll type to sign in |
| `APP_PASSWORD_HASH` | scrypt hash of your password — run `npm run hash-password` |
| `SESSION_SECRET` | random string, 16+ chars — `openssl rand -base64 32` |
| `OPENAI_API_KEY` | optional; without it categories use keyword matching |

None of these are `NEXT_PUBLIC_`, so none of them reach the browser.

### The password

Your password is never stored anywhere, in this repo or in your environment —
only a scrypt hash of it is. Generate the hash with:

```bash
npm run hash-password
```

It prompts twice without echoing, verifies the hash round-trips, and prints the
`APP_PASSWORD_HASH=…` line to paste into `.env.local` and Vercel.

scrypt is used rather than PBKDF2 or a bare SHA because it is *memory-hard*:
each attempt costs ~64MB, which blunts the GPU and ASIC parallelism that makes
offline cracking cheap. Verifying costs about 150ms — unnoticeable when you sign
in, expensive for anyone guessing.

Forgotten it? There's no recovery step and none is needed: run
`npm run hash-password` again and replace the value.

## 3. Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000 and sign in.

## 4. Deploy to Vercel

1. Push to GitHub (`.gitignore` already excludes `.env.local`):
   ```bash
   git init && git add . && git commit -m "Initial commit"
   gh repo create expense-tracker --private --source=. --push
   ```
2. vercel.com → **Add New → Project** → import the repo.
3. Add all six environment variables from the table above.
4. **Deploy**, then open the `.vercel.app` URL on your phone and use
   **Add to Home Screen**.

## How the numbers work

`accounts.starting_balance` is the opening balance. The `account_balances` view
keeps each account current:

```
current_balance = starting_balance
                + sum(money in)      − sum(money out)
                + sum(transfers in)  − sum(transfers out)
```

Category totals count **spending only** — neither a salary credit nor a
transfer is a budget line, and either would otherwise swamp every real
category.

### Transfers

Moving money between your own accounts is **one row**, not two: `account_id` is
the source and `to_account_id` the destination. Logging it as a spend plus an
income would inflate both the month's spending and the category split with
money you never actually spent.

Because one row has to move two accounts in opposite directions, the balance
view first expands each transaction into the per-account movements it causes
(see the `movement` CTE), rather than joining on `account_id` alone. A database
constraint requires every transfer to name a destination that isn't its own
source — that's what stops a half-written transfer from making money vanish.

In the statement table, transfers appear as a signed **Moved** column that nets
to zero across your accounts, which is correct: shifting money between them
changes no total.

### Budgets

One cap per category in the `budgets` table, applying to every month. "No cap"
is stored as the absence of a row rather than a zero, so it can never be
confused with "capped at ₹0".

Spending in capped categories and spending in uncapped ones are reported
separately. Rolling them into a single "spent vs budget" figure would put you
over budget because of a category you never capped, which is the usual way
these screens mislead.

## Notes on the charts

Category colors live in `lib/categories.ts` and were checked with a palette
validator against this app's paper surface: colorblind separation, chroma and
lightness all pass, and every category is labelled in text so nothing is
communicated by color alone. If you change a color, re-check it rather than
eyeballing it.

The month breakdown is a share bar plus ranked bars rather than a pie — nine
categories in a donut is unreadable at phone width.
