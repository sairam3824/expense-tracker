"use client";

import { useMemo, useState } from "react";
import { categoryTotals, monthKey } from "@/lib/aggregate";
import { formatINR } from "@/lib/format";
import type { Account, MonthSummary, Transaction } from "@/lib/types";

import AccountCard from "./AccountCard";
import AddEntrySheet from "./AddEntrySheet";
import CopyButton from "./CopyButton";
import StampButton from "./StampButton";
import TransactionList from "./TransactionList";
import CategoryBreakdown from "./charts/CategoryBreakdown";
import MonthlyTrend from "./charts/MonthlyTrend";
import { logout } from "@/app/actions";

type Tab = "home" | "charts" | "entries";

const TABS: { id: Tab; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "charts", label: "Charts" },
  { id: "entries", label: "Entries" },
];

export default function Dashboard({
  accounts,
  transactions,
  months,
  error,
}: {
  accounts: Account[];
  transactions: Transaction[];
  months: MonthSummary[];
  error: string | null;
}) {
  const [tab, setTab] = useState<Tab>("home");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(
    () => months[0]?.key ?? monthKey(new Date().toISOString().slice(0, 10))
  );

  const total = accounts.reduce((sum, a) => sum + a.current_balance, 0);

  const monthTransactions = useMemo(
    () => transactions.filter((t) => monthKey(t.date) === selectedMonth),
    [transactions, selectedMonth]
  );

  const totals = useMemo(
    () => categoryTotals(monthTransactions),
    [monthTransactions]
  );

  const summary = useMemo(
    () =>
      months.find((m) => m.key === selectedMonth) ?? {
        key: selectedMonth,
        label: "This month",
        spent: 0,
        income: 0,
        count: 0,
      },
    [months, selectedMonth]
  );

  const monthSpent = totals.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className="min-h-dvh pb-24">
      <main className="mx-auto max-w-md">
        {/* ── Header ─────────────────────────────────────────── */}
        <header className="px-5 pb-4 pt-8">
          <div className="flex items-center justify-between">
            <span className="font-display text-[13px] tracking-wide text-ink-soft">
              Ledger
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="text-[10px] uppercase tracking-[0.14em] text-ink-soft font-body active:opacity-60"
              >
                Sign out
              </button>
            </form>
          </div>

          <p className="mt-4 font-body text-[11px] uppercase tracking-[0.12em] text-ink-soft">
            Total across accounts
          </p>
          <div className="flex items-center gap-1">
            {/* Hero figure — proportional figures, not tabular */}
            <p className="font-ledger text-[40px] font-semibold leading-tight text-ink">
              {formatINR(total)}
            </p>
            <CopyButton amount={total} label="total" />
          </div>
        </header>

        {error && (
          <p
            role="alert"
            className="mx-5 mb-3 rounded-md border border-stamp-red/40 bg-stamp-red/10 px-3 py-2 font-body text-[12px] text-stamp-red"
          >
            {error}
          </p>
        )}

        {/* ── Account stubs ──────────────────────────────────── */}
        <section
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1"
          aria-label="Account balances"
        >
          {accounts.map((a) => (
            <div key={a.id} className="snap-start">
              <AccountCard account={a} />
            </div>
          ))}
        </section>

        {/* ── Tabs ───────────────────────────────────────────── */}
        <nav className="mt-6 px-5" aria-label="Sections">
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-card p-1 border border-rule/60">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
                className={`rounded-md py-2.5 text-[13px] font-medium transition-colors ${
                  tab === t.id ? "bg-ink text-paper" : "text-ink-soft"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Month filter — one row, above everything it scopes */}
        {tab !== "entries" && months.length > 0 && (
          <div
            className="mt-4 flex gap-2 overflow-x-auto px-5"
            role="group"
            aria-label="Choose month"
          >
            {months.map((m) => (
              <button
                key={m.key}
                onClick={() => setSelectedMonth(m.key)}
                aria-pressed={selectedMonth === m.key}
                className={`shrink-0 rounded-full border px-3 py-2 text-[12px] transition-colors ${
                  selectedMonth === m.key
                    ? "border-ink bg-ink text-paper"
                    : "border-rule bg-card text-ink-soft"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Home ───────────────────────────────────────────── */}
        {tab === "home" && (
          <>
            <section className="mt-5 grid grid-cols-3 gap-2 px-5">
              <StatTile label="Spent" value={summary.spent} tone="red" />
              <StatTile label="Added" value={summary.income} tone="green" />
              <StatTile label="Entries" value={summary.count} tone="plain" />
            </section>

            <section className="mt-6 px-5">
              <SectionTitle>Recent entries</SectionTitle>
              <TransactionList items={transactions.slice(0, 8)} />
              {transactions.length > 8 && (
                <button
                  onClick={() => setTab("entries")}
                  className="mt-3 w-full rounded-md border border-rule py-2.5 font-body text-[13px] text-ink-soft"
                >
                  See all {transactions.length} entries
                </button>
              )}
            </section>
          </>
        )}

        {/* ── Charts ─────────────────────────────────────────── */}
        {tab === "charts" && (
          <>
            <section className="mt-5 px-5">
              <SectionTitle>Spending by month</SectionTitle>
              <div className="rounded-lg border border-rule/60 bg-card p-4">
                <MonthlyTrend
                  months={months}
                  selected={selectedMonth}
                  onSelect={setSelectedMonth}
                />
              </div>
            </section>

            <section className="mt-6 px-5">
              <SectionTitle>Where {summary.label} went</SectionTitle>
              <div className="rounded-lg border border-rule/60 bg-card p-4">
                <CategoryBreakdown totals={totals} total={monthSpent} />
              </div>
            </section>
          </>
        )}

        {/* ── Entries ────────────────────────────────────────── */}
        {tab === "entries" && (
          <section className="mt-5 px-5">
            <SectionTitle>All entries</SectionTitle>
            <TransactionList items={transactions} />
          </section>
        )}
      </main>

      <StampButton onClick={() => setSheetOpen(true)} />
      {/* Mounted only while open, so the form starts blank every time */}
      {sheetOpen && (
        <AddEntrySheet
          accounts={accounts}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 font-body text-[11px] uppercase tracking-[0.12em] text-ink-soft">
      {children}
    </p>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "red" | "green" | "plain";
}) {
  const color =
    tone === "red"
      ? "text-stamp-red"
      : tone === "green"
        ? "text-stamp-green"
        : "text-ink";

  return (
    <div className="rounded-lg border border-rule/60 bg-card px-3 py-3">
      <p className="font-body text-[10px] uppercase tracking-[0.1em] text-ink-soft">
        {label}
      </p>
      <p className={`mt-1 font-ledger text-[16px] font-semibold ${color}`}>
        {tone === "plain" ? value : formatINR(value)}
      </p>
    </div>
  );
}
