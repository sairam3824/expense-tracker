import "server-only";

import { supabase, supabaseConfigured } from "./supabase-server";
import { isCategory } from "./categories";
import { buildMonths } from "./aggregate";
import type {
  Account,
  Budget,
  MonthSummary,
  Transaction,
  TransactionKind,
} from "./types";

export type LedgerData = {
  accounts: Account[];
  transactions: Transaction[];
  months: MonthSummary[];
  budgets: Budget[];
  error: string | null;
};

type TransactionRow = {
  id: string;
  date: string;
  expense: string;
  amount: number | string;
  kind: string;
  category: string;
  account_id: string;
  to_account_id: string | null;
};

function readKind(value: string): TransactionKind {
  if (value === "income") return "income";
  if (value === "transfer") return "transfer";
  return "spend";
}

/**
 * Missing columns and missing tables both mean the same thing in practice —
 * the SQL file has moved on since it was last run — and the raw Postgres text
 * doesn't say what to do about it.
 */
function withSchemaHint(message: string): string {
  return /does not exist|schema cache/i.test(message)
    ? `${message} — re-run supabase/schema.sql in the Supabase SQL editor.`
    : message;
}

export async function getLedgerData(): Promise<LedgerData> {
  const empty = { accounts: [], transactions: [], months: [], budgets: [] };

  if (!supabaseConfigured) {
    return {
      ...empty,
      error:
        "Supabase isn't configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    };
  }

  const [accountsRes, transactionsRes, budgetsRes] = await Promise.all([
    supabase
      .from("account_balances")
      .select(
        "id,name,starting_balance,total_spent,total_income,total_transferred_in,total_transferred_out,current_balance,sort_order,created_at"
      )
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    // No embedded accounts(name) here: transactions now has two foreign keys
    // into accounts, which makes an unqualified embed ambiguous. The account
    // list is already in hand, so both names are resolved from it below.
    supabase
      .from("transactions")
      .select(
        "id,date,expense,amount,kind,category,account_id,to_account_id"
      )
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("budgets").select("category,amount"),
  ]);

  const error =
    accountsRes.error?.message ?? transactionsRes.error?.message ?? null;
  if (error) return { ...empty, error: withSchemaHint(error) };

  // Supabase returns numeric columns as strings; coerce once here so every
  // consumer can treat them as numbers.
  const accounts = (accountsRes.data ?? []).map((a) => ({
    ...a,
    starting_balance: Number(a.starting_balance),
    total_spent: Number(a.total_spent),
    total_income: Number(a.total_income),
    total_transferred_in: Number(a.total_transferred_in),
    total_transferred_out: Number(a.total_transferred_out),
    current_balance: Number(a.current_balance),
  })) as Account[];

  const nameById = new Map(accounts.map((a) => [a.id, a.name]));

  const transactions: Transaction[] = (
    (transactionsRes.data ?? []) as unknown as TransactionRow[]
  ).map((row) => ({
    id: row.id,
    date: row.date,
    expense: row.expense,
    amount: Number(row.amount),
    kind: readKind(row.kind),
    category: isCategory(row.category) ? row.category : "Other",
    account_id: row.account_id,
    account_name: nameById.get(row.account_id) ?? "—",
    to_account_id: row.to_account_id,
    to_account_name: row.to_account_id
      ? (nameById.get(row.to_account_id) ?? "—")
      : null,
  }));

  const budgets: Budget[] = (budgetsRes.data ?? [])
    .filter((b) => isCategory(b.category))
    .map((b) => ({
      category: b.category as Budget["category"],
      amount: Number(b.amount),
    }));

  return {
    accounts,
    transactions,
    months: buildMonths(transactions),
    budgets,
    // Budgets are the one non-essential read: a missing budgets table should
    // report itself without taking the balances and entries down with it.
    error: budgetsRes.error ? withSchemaHint(budgetsRes.error.message) : null,
  };
}
