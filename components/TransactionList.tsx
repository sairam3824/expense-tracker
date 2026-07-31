"use client";

import { useState, useTransition } from "react";
import { Transaction } from "@/lib/types";
import { formatINR, formatDate } from "@/lib/format";
import { categoryColor } from "@/lib/categories";
import { deleteEntry } from "@/app/actions";

export default function TransactionList({
  items,
  emptyMessage = "No entries yet. Tap the stamp below to log your first one.",
}: {
  items: Transaction[];
  emptyMessage?: string;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (items.length === 0) {
    return (
      <p className="py-10 text-center text-[13px] text-ink-soft font-body">
        {emptyMessage}
      </p>
    );
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteEntry(id);
      setConfirming(null);
    });
  }

  return (
    <ul>
      {items.map((t) => {
        const isIncome = t.kind === "income";
        return (
          <li
            key={t.id}
            className="flex items-center gap-3 border-b border-dashed border-rule py-3"
          >
            <span className="w-10 shrink-0 font-ledger text-[11px] text-ink-soft">
              {formatDate(t.date)}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate font-body text-[14px] text-ink">
                {t.expense}
              </p>
              <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                {!isIncome && (
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: categoryColor(t.category) }}
                  />
                )}
                {isIncome ? t.account_name : `${t.account_name} · ${t.category}`}
              </span>
            </div>

            <span
              className={`shrink-0 font-ledger text-[14px] tabular-nums ${
                isIncome ? "text-stamp-green" : "text-stamp-red"
              }`}
            >
              {isIncome ? "+" : "−"}
              {formatINR(t.amount)}
            </span>

            {confirming === t.id ? (
              <span className="flex shrink-0 gap-1">
                <button
                  onClick={() => remove(t.id)}
                  disabled={pending}
                  className="min-h-11 rounded-md bg-stamp-red px-2.5 text-[11px] text-paper disabled:opacity-60"
                >
                  {pending ? "…" : "Delete"}
                </button>
                <button
                  onClick={() => setConfirming(null)}
                  className="min-h-11 rounded-md border border-rule px-2.5 text-[11px] text-ink-soft"
                >
                  No
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirming(t.id)}
                aria-label={`Delete ${t.expense}`}
                /* 44px hit area — the icon stays 13px */
                className="-mr-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-soft/60 active:bg-ink/10"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
