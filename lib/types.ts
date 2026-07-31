import { CategoryName } from "./categories";

export type TransactionKind = "spend" | "income" | "transfer";

export type Account = {
  id: string;
  name: string;
  starting_balance: number;
  total_spent: number;
  total_income: number;
  total_transferred_in: number;
  total_transferred_out: number;
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
  /** The account the money leaves — the source side of a transfer. */
  account_id: string;
  account_name: string;
  /** Destination, set only on transfers. */
  to_account_id: string | null;
  to_account_name: string | null;
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
  /** Moved in from another account of yours. */
  transferIn: number;
  /** Moved out to another account of yours. */
  transferOut: number;
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

/** A monthly cap for one category. Absent from the map means "no cap set". */
export type Budget = {
  category: CategoryName;
  amount: number;
};

export type BudgetRow = {
  category: CategoryName;
  /** 0 when no cap is set for this category. */
  budget: number;
  spent: number;
  /** budget − spent; negative means over. Meaningless when budget is 0. */
  remaining: number;
  /** spent ÷ budget, uncapped so 1.4 reads as 40% over. 0 when unbudgeted. */
  ratio: number;
  color: string;
};

export type BudgetReport = {
  /** Categories with a cap set, most-consumed first. */
  budgeted: BudgetRow[];
  /** Spending in categories with no cap, largest first. */
  unbudgeted: BudgetRow[];
  totalBudget: number;
  /** Spending inside budgeted categories only — the figure totalBudget caps. */
  totalSpentBudgeted: number;
  /** Spending outside them, kept separate so the total can't mislead. */
  totalSpentUnbudgeted: number;
};
