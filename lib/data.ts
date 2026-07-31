import "server-only";

import { supabase, supabaseConfigured } from "./supabase-server";
import { isCategory } from "./categories";
import { buildMonths } from "./aggregate";
import type { Account, MonthSummary, Transaction } from "./types";

export type LedgerData = {
  accounts: Account[];
  transactions: Transaction[];
  months: MonthSummary[];
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
  accounts: { name: string } | { name: string }[] | null;
};

function accountName(row: TransactionRow): string {
  if (Array.isArray(row.accounts)) return row.accounts[0]?.name ?? "—";
  return row.accounts?.name ?? "—";
}

export async function getLedgerData(): Promise<LedgerData> {
  const empty = { accounts: [], transactions: [], months: [] };

  if (!supabaseConfigured) {
    return {
      ...empty,
      error:
        "Supabase isn't configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    };
  }

  const [accountsRes, transactionsRes] = await Promise.all([
    supabase
      .from("account_balances")
      .select(
        "id,name,starting_balance,total_spent,total_income,current_balance,sort_order,created_at"
      )
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("transactions")
      .select("id,date,expense,amount,kind,category,account_id,accounts(name)")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const error =
    accountsRes.error?.message ?? transactionsRes.error?.message ?? null;
  if (error) return { ...empty, error };

  // Supabase returns numeric columns as strings; coerce once here so every
  // consumer can treat them as numbers.
  const accounts = (accountsRes.data ?? []).map((a) => ({
    ...a,
    starting_balance: Number(a.starting_balance),
    total_spent: Number(a.total_spent),
    total_income: Number(a.total_income),
    current_balance: Number(a.current_balance),
  })) as Account[];

  const transactions: Transaction[] = (
    (transactionsRes.data ?? []) as unknown as TransactionRow[]
  ).map((row) => ({
    id: row.id,
    date: row.date,
    expense: row.expense,
    amount: Number(row.amount),
    kind: row.kind === "income" ? "income" : "spend",
    category: isCategory(row.category) ? row.category : "Other",
    account_id: row.account_id,
    account_name: accountName(row),
  }));

  return {
    accounts,
    transactions,
    months: buildMonths(transactions),
    error: null,
  };
}
