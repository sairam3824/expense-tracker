// Pure rollup helpers, shared by the server loader and the client dashboard.
// Deliberately free of `server-only` and of any Supabase import so the client
// components can re-slice data by month without another round trip.

import { CATEGORIES, categoryColor } from "./categories";
import type {
  Account,
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

/** Every month that has at least one entry, newest first. */
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
    else month.spent += t.amount;
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
  const net = (t: Transaction) => (t.kind === "income" ? t.amount : -t.amount);

  const rows: MonthLedgerRow[] = accounts.map((account) => {
    const mine = transactions.filter((t) => t.account_id === account.id);

    const movedSince = mine
      .filter((t) => monthKey(t.date) > month)
      .reduce((sum, t) => sum + net(t), 0);

    const during = mine.filter((t) => monthKey(t.date) === month);
    const spent = during
      .filter((t) => t.kind === "spend")
      .reduce((sum, t) => sum + t.amount, 0);
    const income = during
      .filter((t) => t.kind === "income")
      .reduce((sum, t) => sum + t.amount, 0);

    const closing = account.current_balance - movedSince;

    return {
      id: account.id,
      name: account.name,
      opening: closing - (income - spent),
      spent,
      income,
      closing,
    };
  });

  return {
    rows,
    total: {
      opening: rows.reduce((s, r) => s + r.opening, 0),
      spent: rows.reduce((s, r) => s + r.spent, 0),
      income: rows.reduce((s, r) => s + r.income, 0),
      closing: rows.reduce((s, r) => s + r.closing, 0),
    },
  };
}

/**
 * Category split for a set of transactions. Income is excluded — a salary
 * credit is not a budget line and would swamp every real category.
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
