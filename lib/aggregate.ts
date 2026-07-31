// Pure rollup helpers, shared by the server loader and the client dashboard.
// Deliberately free of `server-only` and of any Supabase import so the client
// components can re-slice data by month without another round trip.

import { CATEGORIES, categoryColor } from "./categories";
import type { CategoryTotal, MonthSummary, Transaction } from "./types";

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
