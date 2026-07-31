import { getLedgerData } from "@/lib/data";
import Dashboard from "@/components/Dashboard";

// Balances must always reflect the latest write, so never serve this from the
// static or full-route cache.
export const dynamic = "force-dynamic";

export default async function Home() {
  const { accounts, transactions, months, budgets, overallBudget, error } =
    await getLedgerData();

  return (
    <Dashboard
      accounts={accounts}
      transactions={transactions}
      months={months}
      budgets={budgets}
      overallBudget={overallBudget}
      error={error}
    />
  );
}
