// Pure rollup helpers, shared by the server loader and the client dashboard.
// Deliberately free of `server-only` and of any Supabase import so the client
// components can re-slice data by month without another round trip.

import { CATEGORIES, categoryColor, type CategoryName } from "./categories";
import type {
  Account,
  Budget,
  BudgetReport,
  BudgetRow,
  CategoryTotal,
  MonthLedger,
  MonthLedgerRow,
  MonthSummary,
  Transaction,
} from "./types";

/** "2026-07-30" → "2026-07". String maths, so no timezone drift. */
export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

/**
 * How one transaction moves one account's balance, signed.
 *
 * A transfer touches two accounts in opposite directions, so its effect can't
 * be read off `account_id` alone — it debits its source and credits its
 * destination. Anything that doesn't involve this account returns 0.
 */
export function netForAccount(t: Transaction, accountId: string): number {
  if (t.kind === "transfer") {
    if (t.account_id === accountId) return -t.amount;
    if (t.to_account_id === accountId) return t.amount;
    return 0;
  }
  if (t.account_id !== accountId) return 0;
  return t.kind === "income" ? t.amount : -t.amount;
}

/** Does this row move the given account at all, on either side? */
export function touchesAccount(t: Transaction, accountId: string): boolean {
  return t.account_id === accountId || t.to_account_id === accountId;
}

/**
 * Every month that has at least one entry, newest first.
 *
 * Transfers move money without spending or earning it, so they add to the
 * entry count but to neither total — otherwise shifting ₹5,000 from SBI to
 * Nana would report a ₹5,000 spending month.
 */
export function buildMonths(transactions: Transaction[]): MonthSummary[] {
  const totals = new Map<string, MonthSummary>();

  for (const t of transactions) {
    const key = monthKey(t.date);
    let month = totals.get(key);
    if (!month) {
      month = { key, label: monthLabel(key), spent: 0, income: 0, count: 0 };
      totals.set(key, month);
    }
    if (t.kind === "income") month.income += t.amount;
    else if (t.kind === "spend") month.spent += t.amount;
    month.count += 1;
  }

  return [...totals.values()].sort((a, b) => b.key.localeCompare(a.key));
}

/**
 * Opening and closing balance per account for one month — the statement view
 * the spreadsheet had, where each month opens with the previous month's close.
 *
 * Derived by anchoring on the *current* balance and unwinding backwards:
 *
 *   closing(M) = current − (net movement in every month after M)
 *   opening(M) = closing(M) − (net movement during M)
 *
 * Working backwards rather than forwards from starting_balance matters: the
 * transaction query is capped, so the oldest rows can fall outside the window,
 * and summing forwards would then silently understate the opening. Everything
 * from the selected month onward is guaranteed to be loaded, because the month
 * list is built from that same set of rows.
 */
export function monthLedger(
  accounts: Account[],
  transactions: Transaction[],
  month: string
): MonthLedger {
  const rows: MonthLedgerRow[] = accounts.map((account) => {
    const mine = transactions.filter((t) => touchesAccount(t, account.id));

    const movedSince = mine
      .filter((t) => monthKey(t.date) > month)
      .reduce((sum, t) => sum + netForAccount(t, account.id), 0);

    const during = mine.filter((t) => monthKey(t.date) === month);

    let spent = 0;
    let income = 0;
    let transferIn = 0;
    let transferOut = 0;

    for (const t of during) {
      if (t.kind === "spend") spent += t.amount;
      else if (t.kind === "income") income += t.amount;
      else if (t.account_id === account.id) transferOut += t.amount;
      else transferIn += t.amount;
    }

    const closing = account.current_balance - movedSince;

    return {
      id: account.id,
      name: account.name,
      // The same identity the statement table renders, run backwards.
      opening: closing - (income - spent + transferIn - transferOut),
      spent,
      income,
      transferIn,
      transferOut,
      closing,
    };
  });

  const sum = (pick: (row: MonthLedgerRow) => number) =>
    rows.reduce((total, row) => total + pick(row), 0);

  return {
    rows,
    total: {
      opening: sum((r) => r.opening),
      spent: sum((r) => r.spent),
      income: sum((r) => r.income),
      // Each transfer is counted once out and once in, so these are equal in
      // the total row and cancel — correct, since moving money between your
      // own accounts changes no total.
      transferIn: sum((r) => r.transferIn),
      transferOut: sum((r) => r.transferOut),
      closing: sum((r) => r.closing),
    },
  };
}

/**
 * Category split for a set of transactions. Income and transfers are both
 * excluded — neither is a budget line, and a salary credit or an account
 * top-up would swamp every real category.
 * Returns only categories with spending, largest first.
 */
export function categoryTotals(transactions: Transaction[]): CategoryTotal[] {
  const totals = new Map<string, number>();
  let overall = 0;

  for (const t of transactions) {
    if (t.kind !== "spend") continue;
    totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount);
    overall += t.amount;
  }

  return CATEGORIES.map((c) => c.name)
    .map((category) => ({
      category,
      amount: totals.get(category) ?? 0,
      share: overall > 0 ? (totals.get(category) ?? 0) / overall : 0,
      color: categoryColor(category),
    }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount) as CategoryTotal[];
}

/**
 * A month's spending measured against the caps.
 *
 * Budgeted and unbudgeted spending stay separate on purpose: rolling them into
 * one "spent vs budget" figure would put you over budget because of a category
 * you never capped, which is the usual way these screens mislead.
 */
export function budgetProgress(
  transactions: Transaction[],
  budgets: Budget[]
): BudgetReport {
  const caps = new Map<CategoryName, number>(
    budgets.filter((b) => b.amount > 0).map((b) => [b.category, b.amount])
  );

  const spentBy = new Map<CategoryName, number>();
  for (const t of transactions) {
    if (t.kind !== "spend") continue;
    spentBy.set(t.category, (spentBy.get(t.category) ?? 0) + t.amount);
  }

  const budgeted: BudgetRow[] = [];
  const unbudgeted: BudgetRow[] = [];

  for (const { name } of CATEGORIES) {
    const budget = caps.get(name) ?? 0;
    const spent = spentBy.get(name) ?? 0;
    const row: BudgetRow = {
      category: name,
      budget,
      spent,
      remaining: budget - spent,
      ratio: budget > 0 ? spent / budget : 0,
      color: categoryColor(name),
    };

    if (budget > 0) budgeted.push(row);
    else if (spent > 0) unbudgeted.push(row);
  }

  budgeted.sort((a, b) => b.ratio - a.ratio || b.spent - a.spent);
  unbudgeted.sort((a, b) => b.spent - a.spent);

  return {
    budgeted,
    unbudgeted,
    totalBudget: budgeted.reduce((s, r) => s + r.budget, 0),
    totalSpentBudgeted: budgeted.reduce((s, r) => s + r.spent, 0),
    totalSpentUnbudgeted: unbudgeted.reduce((s, r) => s + r.spent, 0),
  };
}

/**
 * Days remaining in `month` counting today, or null when that isn't the month
 * we're currently in — a "left per day" figure means nothing for a month that
 * has already closed.
 */
export function daysLeftInMonth(month: string, today: string): number | null {
  if (monthKey(today) !== month) return null;

  const [year, monthNumber] = month.split("-").map(Number);
  // Day 0 of the next month is the last day of this one.
  const lastDay = new Date(year, monthNumber, 0).getDate();
  const currentDay = Number(today.slice(8, 10));

  return Math.max(lastDay - currentDay + 1, 1);
}
