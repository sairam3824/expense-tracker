"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveBudgets, type BudgetState } from "@/app/actions";
import { CATEGORIES } from "@/lib/categories";
import { formatINR } from "@/lib/format";
import type { Budget, BudgetReport, BudgetRow } from "@/lib/types";

/**
 * Caps are per category and carry across every month, so the figures here are
 * "this month against the standing cap" — which is why the panel says which
 * month it is showing whenever that isn't the current one.
 */
export default function BudgetPanel({
  report,
  budgets,
  monthLabel,
  daysLeft,
}: {
  report: BudgetReport;
  budgets: Budget[];
  monthLabel: string;
  /** null when the selected month isn't the one in progress. */
  daysLeft: number | null;
}) {
  const [editing, setEditing] = useState(false);

  const {
    budgeted,
    unbudgeted,
    totalBudget,
    totalSpentBudgeted,
    totalSpentUnbudgeted,
  } = report;

  if (editing) {
    return (
      <BudgetForm budgets={budgets} onDone={() => setEditing(false)} />
    );
  }

  if (budgeted.length === 0) {
    return (
      <div className="rounded-lg border border-rule/60 bg-card px-4 py-8 text-center">
        <p className="font-body text-[13px] text-ink-soft">
          No caps set yet. Give the categories you want to watch a monthly
          limit and this becomes a &ldquo;how much is left&rdquo; screen.
        </p>
        {totalSpentUnbudgeted > 0 && (
          <p className="mt-2 font-body text-[12px] text-ink-soft">
            {formatINR(totalSpentUnbudgeted)} spent in {monthLabel}.
          </p>
        )}
        <button
          onClick={() => setEditing(true)}
          className="mt-4 rounded-md bg-ink px-4 py-2.5 text-[13px] font-medium text-paper"
        >
          Set budgets
        </button>
      </div>
    );
  }

  const left = totalBudget - totalSpentBudgeted;
  const perDay = daysLeft && left > 0 ? left / daysLeft : null;

  return (
    <div className="space-y-4">
      {/* ── The headline: what's left, and what that is per day ─────── */}
      <div className="rounded-lg border border-rule/60 bg-card px-4 py-4">
        <p className="font-body text-[10px] uppercase tracking-[0.1em] text-ink-soft">
          {left >= 0 ? "Left to spend" : "Over budget by"}
        </p>
        <p
          className={`mt-1 font-ledger text-[30px] font-semibold leading-tight ${
            left >= 0 ? "text-ink" : "text-stamp-red"
          }`}
        >
          {formatINR(Math.abs(left))}
        </p>

        <p className="mt-1.5 font-body text-[12px] text-ink-soft">
          {formatINR(totalSpentBudgeted)} of {formatINR(totalBudget)} used
          {daysLeft === null && ` in ${monthLabel}`}
        </p>

        {perDay !== null && daysLeft !== null && (
          <p className="mt-2 border-t border-dashed border-rule pt-2 font-ledger text-[12px] text-ink">
            {formatINR(perDay)} a day for the {daysLeft}{" "}
            {daysLeft === 1 ? "day" : "days"} left
          </p>
        )}

        {totalSpentUnbudgeted > 0 && (
          <p className="mt-2 font-body text-[11px] text-ink-soft">
            Plus {formatINR(totalSpentUnbudgeted)} in categories with no cap —
            not counted above.
          </p>
        )}
      </div>

      {/* ── Per category ────────────────────────────────────────────── */}
      <ul className="space-y-3.5">
        {budgeted.map((row) => (
          <li key={row.category}>
            <BudgetBar row={row} />
          </li>
        ))}
      </ul>

      {unbudgeted.length > 0 && (
        <div className="rounded-lg border border-rule/60 bg-card px-4 py-3">
          <p className="font-body text-[10px] uppercase tracking-[0.1em] text-ink-soft">
            No cap set
          </p>
          <ul className="mt-2 space-y-1.5">
            {unbudgeted.map((row) => (
              <li
                key={row.category}
                className="flex items-baseline gap-2 text-[13px]"
              >
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-[3px]"
                  style={{ background: row.color }}
                />
                <span className="font-body text-ink">{row.category}</span>
                <span className="ml-auto font-ledger tabular-nums text-ink-soft">
                  {formatINR(row.spent)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={() => setEditing(true)}
        className="w-full rounded-md border border-rule py-2.5 font-body text-[13px] text-ink-soft"
      >
        Edit budgets
      </button>
    </div>
  );
}

/**
 * One category's progress. Over-budget is stated in words as well as colour —
 * the amount over is written out, so the row never depends on noticing that a
 * bar turned red.
 */
function BudgetBar({ row }: { row: BudgetRow }) {
  const over = row.remaining < 0;
  const filled = Math.min(row.ratio, 1) * 100;

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span
          aria-hidden
          className="h-2.5 w-2.5 shrink-0 translate-y-[-1px] rounded-[3px]"
          style={{ background: row.color }}
        />
        <span className="truncate font-body text-[13px] text-ink">
          {row.category}
        </span>
        <span className="ml-auto shrink-0 font-ledger text-[13px] tabular-nums text-ink">
          {formatINR(row.spent)}
          <span className="text-ink-soft"> / {formatINR(row.budget)}</span>
        </span>
      </div>

      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-rule/30">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(filled, 2)}%`,
            background: over ? "var(--color-stamp-red)" : row.color,
          }}
        />
      </div>

      <p
        className={`mt-1 font-body text-[11px] ${
          over ? "text-stamp-red" : "text-ink-soft"
        }`}
      >
        {over
          ? `Over by ${formatINR(-row.remaining)}`
          : `${formatINR(row.remaining)} left`}
      </p>
    </div>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 rounded-md bg-ink py-3 text-[14px] font-medium text-paper disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save budgets"}
    </button>
  );
}

function BudgetForm({
  budgets,
  onDone,
}: {
  budgets: Budget[];
  onDone: () => void;
}) {
  const current = new Map(budgets.map((b) => [b.category, b.amount]));

  const [state, formAction] = useActionState<BudgetState, FormData>(
    saveBudgets,
    { error: null, ok: false }
  );

  // Keyed on the whole state object, not on state.ok: useActionState hands
  // back a fresh object per submit, so a second successful save still fires
  // this — whereas `[state.ok]` would see true→true and never run again.
  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={formAction} className="rounded-lg border border-rule/60 bg-card p-4">
      <p className="font-body text-[12px] leading-relaxed text-ink-soft">
        A monthly cap per category. Leave one blank for no cap — it still gets
        tracked, just not measured against anything.
      </p>

      <ul className="mt-4 space-y-2.5">
        {CATEGORIES.map((c) => (
          <li key={c.name} className="flex items-center gap-3">
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
              style={{ background: c.color }}
            />
            <label
              htmlFor={`budget-${c.name}`}
              className="flex-1 truncate font-body text-[13px] text-ink"
            >
              {c.name}
            </label>
            <input
              id={`budget-${c.name}`}
              name={`budget:${c.name}`}
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              placeholder="—"
              defaultValue={current.get(c.name) ?? ""}
              /* 16px minimum, or iOS zooms the page in on focus */
              className="w-28 rounded-md border border-rule bg-paper px-3 py-2.5 text-right font-ledger text-[16px] text-ink focus:outline-none focus:ring-2 focus:ring-ink/40"
            />
          </li>
        ))}
      </ul>

      {state.error && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-stamp-red/40 bg-stamp-red/10 px-3 py-2 font-body text-[12px] text-stamp-red"
        >
          {state.error}
        </p>
      )}

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-rule px-4 py-3 font-body text-[14px] text-ink-soft"
        >
          Cancel
        </button>
        <SaveButton />
      </div>
    </form>
  );
}
