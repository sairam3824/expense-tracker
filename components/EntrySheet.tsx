"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveEntry, suggestCategory, type EntryState } from "@/app/actions";
import { CATEGORIES, type CategoryName } from "@/lib/categories";
import { todayISO } from "@/lib/format";
import type { Account, Transaction, TransactionKind } from "@/lib/types";

const KIND_LABEL: Record<TransactionKind, string> = {
  spend: "Spent",
  income: "Added",
  transfer: "Moved",
};

function SubmitButton({
  kind,
  editing,
}: {
  kind: TransactionKind;
  editing: boolean;
}) {
  const { pending } = useFormStatus();

  const label = editing
    ? "Save changes"
    : kind === "income"
      ? "Add money"
      : kind === "transfer"
        ? "Move money"
        : "Log expense";

  return (
    <button
      type="submit"
      disabled={pending}
      className={`mt-5 w-full rounded-md py-3.5 text-[15px] font-medium text-paper transition-opacity active:opacity-80 disabled:opacity-60 ${
        kind === "income" ? "bg-stamp-green" : "bg-ink"
      }`}
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

const fieldClass =
  /* 16px minimum, or iOS zooms the page in when the field is focused */
  "mt-1 w-full rounded-md border border-rule bg-paper px-3 py-3 text-[16px] text-ink focus:outline-none focus:ring-2 focus:ring-ink/40";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] uppercase tracking-[0.1em] text-ink-soft">
      {children}
    </span>
  );
}

/**
 * Rendered only while open — the parent unmounts it to reset the form, which
 * is also what keeps the uncontrolled fields (amount, date) in step when it is
 * reopened against a different entry.
 *
 * Pass `entry` to edit that row instead of creating a new one.
 */
export default function EntrySheet({
  accounts,
  entry = null,
  onClose,
}: {
  accounts: Account[];
  entry?: Transaction | null;
  onClose: () => void;
}) {
  const editing = entry !== null;

  // A transfer needs somewhere to move money to.
  const canTransfer = accounts.length >= 2;
  const kinds: TransactionKind[] = canTransfer
    ? ["spend", "income", "transfer"]
    : ["spend", "income"];

  const [kind, setKind] = useState<TransactionKind>(entry?.kind ?? "spend");
  const [expense, setExpense] = useState(entry?.expense ?? "");
  const [category, setCategory] = useState<CategoryName>(
    entry?.category ?? "Other"
  );
  const [accountId, setAccountId] = useState(
    entry?.account_id ?? accounts[0]?.id ?? ""
  );
  const [toAccountId, setToAccountId] = useState(entry?.to_account_id ?? "");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestedFor, setSuggestedFor] = useState<string | null>(null);
  const [touchedCategory, setTouchedCategory] = useState(editing);

  const [state, formAction] = useActionState<EntryState, FormData>(saveEntry, {
    error: null,
    ok: false,
  });

  // Mirrors touchedCategory so the in-flight request can read the current
  // value without re-running the effect and cancelling its own timer. An entry
  // being edited starts out "already chosen": re-suggesting would quietly
  // overwrite a category that was set on purpose.
  const touchedRef = useRef(editing);

  // Close once the server confirms the write. The parent unmounts this
  // component when it closes, so every field resets on its own.
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  // Ask for a category once the description settles. Debounced so a normal
  // typing burst is one request, and skipped entirely once one is picked.
  useEffect(() => {
    const text = expense.trim();
    if (kind !== "spend" || touchedRef.current || text.length < 3) return;

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

  // The two ends of a transfer are kept distinct as they change, rather than
  // letting the same account be picked twice and rejecting it on submit.
  function chooseKind(next: TransactionKind) {
    setKind(next);
    if (next === "transfer" && (!toAccountId || toAccountId === accountId)) {
      setToAccountId(accounts.find((a) => a.id !== accountId)?.id ?? "");
    }
  }

  function chooseSource(next: string) {
    setAccountId(next);
    if (kind === "transfer" && next === toAccountId) {
      setToAccountId(accounts.find((a) => a.id !== next)?.id ?? "");
    }
  }

  function chooseDestination(next: string) {
    setToAccountId(next);
    if (next === accountId) {
      setAccountId(accounts.find((a) => a.id !== next)?.id ?? "");
    }
  }

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

        {editing && (
          <>
            <input type="hidden" name="id" value={entry.id} />
            <p className="mb-3 text-center font-body text-[11px] uppercase tracking-[0.12em] text-ink-soft">
              Edit entry
            </p>
          </>
        )}

        {/* Spend / add money / move between accounts */}
        <div
          className={`mb-5 grid gap-1 rounded-lg bg-paper p-1 ${
            canTransfer ? "grid-cols-3" : "grid-cols-2"
          }`}
        >
          {kinds.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => chooseKind(option)}
              aria-pressed={kind === option}
              className={`rounded-md py-2.5 text-[13px] font-medium transition-colors ${
                kind === option
                  ? option === "income"
                    ? "bg-stamp-green text-paper"
                    : "bg-ink text-paper"
                  : "text-ink-soft"
              }`}
            >
              {KIND_LABEL[option]}
            </button>
          ))}
        </div>
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="category" value={category} />

        <div className="space-y-3.5">
          <label className="block">
            <FieldLabel>
              {kind === "income"
                ? "What came in"
                : kind === "transfer"
                  ? "Note (optional)"
                  : "What for"}
            </FieldLabel>
            <input
              name="expense"
              type="text"
              value={expense}
              onChange={(e) => setExpense(e.target.value)}
              placeholder={
                kind === "income"
                  ? "e.g. Salary"
                  : kind === "transfer"
                    ? "e.g. Topped up for the week"
                    : "e.g. Room cleaning"
              }
              // A transfer is described by its two accounts, so it is the one
              // kind that doesn't need this filled in.
              required={kind !== "transfer"}
              className={`${fieldClass} font-body`}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <FieldLabel>Amount</FieldLabel>
              <input
                name="amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0"
                defaultValue={entry?.amount ?? ""}
                required
                className={`${fieldClass} font-ledger`}
              />
            </label>

            <label className="block">
              <FieldLabel>Date</FieldLabel>
              <input
                name="date"
                type="date"
                defaultValue={entry?.date ?? todayISO()}
                required
                className={`${fieldClass} font-ledger`}
              />
            </label>
          </div>

          {kind === "transfer" ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <FieldLabel>From</FieldLabel>
                <select
                  name="account_id"
                  value={accountId}
                  onChange={(e) => chooseSource(e.target.value)}
                  required
                  className={`${fieldClass} font-body`}
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <FieldLabel>To</FieldLabel>
                <select
                  name="to_account_id"
                  value={toAccountId}
                  onChange={(e) => chooseDestination(e.target.value)}
                  required
                  className={`${fieldClass} font-body`}
                >
                  {accounts
                    .filter((a) => a.id !== accountId)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>
          ) : (
            <label className="block">
              <FieldLabel>Account</FieldLabel>
              <select
                name="account_id"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                required
                className={`${fieldClass} font-body`}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {kind === "transfer" && (
            <p className="font-body text-[11px] leading-relaxed text-ink-soft">
              Moving money between your own accounts. It won&rsquo;t count as
              spending or income, and won&rsquo;t reach the budget split.
            </p>
          )}

          {kind === "spend" && (
            <div>
              <div className="flex items-baseline justify-between">
                <FieldLabel>Category</FieldLabel>
                <span className="font-body text-[10px] text-ink-soft">
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
            className="mt-4 rounded-md border border-stamp-red/40 bg-stamp-red/10 px-3 py-2 font-body text-[12px] text-stamp-red"
          >
            {state.error}
          </p>
        )}

        <SubmitButton kind={kind} editing={editing} />
      </form>
    </div>
  );
}
