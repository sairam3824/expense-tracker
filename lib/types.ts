import { CategoryName } from "./categories";

export type TransactionKind = "spend" | "income";

export type Account = {
  id: string;
  name: string;
  starting_balance: number;
  total_spent: number;
  total_income: number;
  current_balance: number;
  sort_order?: number;
  created_at?: string;
};

export type Transaction = {
  id: string;
  date: string;
  expense: string;
  amount: number;
  kind: TransactionKind;
  category: CategoryName;
  account_id: string;
  account_name: string;
};

/** One month's rollup, newest first in the arrays the dashboard receives. */
export type MonthSummary = {
  /** "2026-07" */
  key: string;
  /** "Jul 2026" */
  label: string;
  spent: number;
  income: number;
  count: number;
};

/** One account's position across a single month, statement style. */
export type MonthLedgerRow = {
  id: string;
  name: string;
  opening: number;
  spent: number;
  income: number;
  closing: number;
};

export type MonthLedger = {
  rows: MonthLedgerRow[];
  total: Omit<MonthLedgerRow, "id" | "name">;
};

export type CategoryTotal = {
  category: CategoryName;
  amount: number;
  /** 0–1 share of the month's spending. */
  share: number;
  color: string;
};
