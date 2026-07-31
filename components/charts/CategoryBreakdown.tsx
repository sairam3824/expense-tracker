"use client";

import { useState } from "react";
import type { CategoryTotal } from "@/lib/types";
import { formatINR } from "@/lib/format";

// Part-to-whole with nine possible classes. A donut would put nine unreadable
// slice labels on a phone screen, so this is a share bar for the at-a-glance
// split plus ranked bars underneath. The ranked rows are simultaneously the
// legend, the direct labels and the table view — every amount is readable as
// text, so nothing is encoded by color alone.

export default function CategoryBreakdown({
  totals,
  total,
}: {
  totals: CategoryTotal[];
  total: number;
}) {
  const [active, setActive] = useState<string | null>(null);

  if (totals.length === 0) {
    return (
      <p className="py-8 text-center text-[13px] text-ink-soft font-body">
        No spending logged this month yet.
      </p>
    );
  }

  const max = totals[0].amount;

  return (
    <div>
      {/* Share bar — the whole month in one line */}
      <div
        className="flex h-3 w-full overflow-hidden rounded-full"
        role="img"
        aria-label={`Spending split: ${totals
          .map((t) => `${t.category} ${Math.round(t.share * 100)}%`)
          .join(", ")}`}
      >
        {totals.map((row, i) => (
          <div
            key={row.category}
            style={{
              width: `${row.share * 100}%`,
              background: row.color,
              // 2px surface gap between segments, never a border
              marginLeft: i === 0 ? 0 : 2,
              opacity: active && active !== row.category ? 0.35 : 1,
            }}
            className="h-full transition-opacity"
          />
        ))}
      </div>

      <p className="mt-2 text-[11px] text-ink-soft font-body">
        {formatINR(total)} across {totals.length}{" "}
        {totals.length === 1 ? "category" : "categories"}
      </p>

      {/* Ranked bars — legend + direct labels + table view in one */}
      <ul className="mt-4 space-y-3">
        {totals.map((row) => (
          <li key={row.category}>
            <button
              type="button"
              onClick={() =>
                setActive(active === row.category ? null : row.category)
              }
              className="w-full text-left min-h-11 py-0.5"
              aria-pressed={active === row.category}
            >
              <div className="flex items-baseline gap-2">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-[3px] translate-y-[-1px]"
                  style={{ background: row.color }}
                />
                <span className="text-[13px] text-ink font-body truncate">
                  {row.category}
                </span>
                <span className="ml-auto shrink-0 font-ledger text-[13px] text-ink tabular-nums">
                  {formatINR(row.amount)}
                </span>
                <span className="w-9 shrink-0 text-right font-ledger text-[11px] text-ink-soft tabular-nums">
                  {Math.round(row.share * 100)}%
                </span>
              </div>

              <div className="mt-1.5 h-1.5 w-full rounded-full bg-rule/30">
                <div
                  className="h-full rounded-full transition-opacity"
                  style={{
                    width: `${Math.max((row.amount / max) * 100, 2)}%`,
                    background: row.color,
                    opacity: active && active !== row.category ? 0.35 : 1,
                  }}
                />
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
