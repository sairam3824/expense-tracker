"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { addEntry, suggestCategory, type EntryState } from "@/app/actions";
import { CATEGORIES, type CategoryName } from "@/lib/categories";
import { todayISO } from "@/lib/format";
import type { Account, TransactionKind } from "@/lib/types";

function SubmitButton({ kind }: { kind: TransactionKind }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`mt-5 w-full rounded-md py-3.5 text-[15px] font-medium text-paper transition-opacity active:opacity-80 disabled:opacity-60 ${
        kind === "income" ? "bg-stamp-green" : "bg-ink"
      }`}
    >
      {pending ? "Saving…" : kind === "income" ? "Add money" : "Log expense"}
    </button>
  );
}

/** Rendered only while open — the parent unmounts it to reset the form. */
export default function AddEntrySheet({
  accounts,
  onClose,
}: {
  accounts: Account[];
  onClose: () => void;
}) {
  const [kind, setKind] = useState<TransactionKind>("spend");
  const [expense, setExpense] = useState("");
  const [category, setCategory] = useState<CategoryName>("Other");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestedFor, setSuggestedFor] = useState<string | null>(null);
  const [touchedCategory, setTouchedCategory] = useState(false);

  const [state, formAction] = useActionState<EntryState, FormData>(addEntry, {
    error: null,
    ok: false,
  });

  // Mirrors touchedCategory so the in-flight request can read the current
  // value without re-running the effect and cancelling its own timer.
  const touchedRef = useRef(false);

  // Close once the server confirms the insert. The parent unmounts this
  // component when it closes, so every field resets on its own.
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  // Ask for a category once the description settles. Debounced so a normal
  // typing burst is one request, and skipped entirely once you pick manually.
  useEffect(() => {
    const text = expense.trim();
    if (kind === "income" || touchedRef.current || text.length < 3) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setSuggesting(true);
      try {
        const guess = await suggestCategory(text);
        // Drop a late reply if the description moved on, or if a category was
        // picked by hand while the request was in flight.
        if (cancelled || touchedRef.current) return;
        setCategory(guess.category);
        setSuggestedFor(guess.category);
      } finally {
        if (!cancelled) setSuggesting(false);
      }
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [expense, kind]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 backdrop-blur-[1px]"
      />

      <form
        action={formAction}
        className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border-t border-rule bg-card px-5 pb-8 pt-4 shadow-xl"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-rule" />

        {/* Spend / add money */}
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-paper p-1">
          {(["spend", "income"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setKind(option)}
              className={`rounded-md py-2.5 text-[13px] font-medium transition-colors ${
                kind === option
                  ? option === "income"
                    ? "bg-stamp-green text-paper"
                    : "bg-ink text-paper"
                  : "text-ink-soft"
              }`}
            >
              {option === "spend" ? "Spent" : "Added"}
            </button>
          ))}
        </div>
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="category" value={category} />

        <div className="space-y-3.5">
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.1em] text-ink-soft">
              {kind === "income" ? "What came in" : "What for"}
            </span>
            <input
              name="expense"
              type="text"
              value={expense}
              onChange={(e) => setExpense(e.target.value)}
              placeholder={kind === "income" ? "e.g. Salary" : "e.g. Room cleaning"}
              required
              className="mt-1 w-full rounded-md border border-rule bg-paper px-3 py-3 text-[16px] text-ink font-body focus:outline-none focus:ring-2 focus:ring-ink/40"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                Amount
              </span>
              <input
                name="amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0"
                required
                className="mt-1 w-full rounded-md border border-rule bg-paper px-3 py-3 text-[16px] text-ink font-ledger focus:outline-none focus:ring-2 focus:ring-ink/40"
              />
            </label>

            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                Date
              </span>
              <input
                name="date"
                type="date"
                defaultValue={todayISO()}
                required
                /* 16px minimum, or iOS zooms the page in when it's focused */
                className="mt-1 w-full rounded-md border border-rule bg-paper px-3 py-3 text-[16px] text-ink font-ledger focus:outline-none focus:ring-2 focus:ring-ink/40"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.1em] text-ink-soft">
              Account
            </span>
            <select
              name="account_id"
              defaultValue={accounts[0]?.id ?? ""}
              required
              className="mt-1 w-full rounded-md border border-rule bg-paper px-3 py-3 text-[16px] text-ink font-body focus:outline-none focus:ring-2 focus:ring-ink/40"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>

          {kind === "spend" && (
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                  Category
                </span>
                <span className="text-[10px] text-ink-soft font-body">
                  {suggesting
                    ? "Working it out…"
                    : suggestedFor && !touchedCategory
                      ? "Suggested — tap to change"
                      : ""}
                </span>
              </div>

              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {CATEGORIES.map((c) => {
                  const selected = category === c.name;
                  return (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => {
                        setCategory(c.name);
                        setTouchedCategory(true);
                        touchedRef.current = true;
                      }}
                      aria-pressed={selected}
                      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-2 text-[12px] transition-colors ${
                        selected
                          ? "border-ink bg-ink text-paper"
                          : "border-rule bg-paper text-ink-soft"
                      }`}
                    >
                      <span
                        aria-hidden
                        className="h-2 w-2 rounded-full"
                        style={{ background: c.color }}
                      />
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {state.error && (
          <p
            role="alert"
            className="mt-4 rounded-md border border-stamp-red/40 bg-stamp-red/10 px-3 py-2 text-[12px] text-stamp-red font-body"
          >
            {state.error}
          </p>
        )}

        <SubmitButton kind={kind} />
      </form>
    </div>
  );
}
