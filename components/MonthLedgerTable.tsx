import type { MonthLedger } from "@/lib/types";
import { formatINR } from "@/lib/format";

// The statement view: what each account opened the month with, what moved, and
// what it closed at. A real table rather than a chart — these are exact figures
// to be read and reconciled, not magnitudes to be compared at a glance.
//
// Every column shown must be one you need to get from opening to closing:
//   closing = opening + in − spent + moved
// so the In and Moved columns appear only in months that actually have them,
// and the row still adds up when they don't.

export default function MonthLedgerTable({
  ledger,
  hasIncome,
  hasTransfers,
}: {
  ledger: MonthLedger;
  hasIncome: boolean;
  hasTransfers: boolean;
}) {
  const { rows, total } = ledger;

  return (
    // Scrolls within its own container so the page body never scrolls sideways
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[300px] border-collapse">
        <thead>
          <tr className="text-[10px] uppercase tracking-[0.1em] text-ink-soft">
            <th scope="col" className="py-1.5 text-left font-normal">
              Account
            </th>
            <th scope="col" className="py-1.5 text-right font-normal">
              Opening
            </th>
            {hasIncome && (
              <th scope="col" className="py-1.5 text-right font-normal">
                In
              </th>
            )}
            <th scope="col" className="py-1.5 text-right font-normal">
              Spent
            </th>
            {hasTransfers && (
              <th scope="col" className="py-1.5 text-right font-normal">
                Moved
              </th>
            )}
            <th scope="col" className="py-1.5 text-right font-normal">
              Closing
            </th>
          </tr>
        </thead>

        <tbody className="font-ledger text-[12px] tabular-nums">
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-dashed border-rule">
              <th
                scope="row"
                className="py-2 text-left font-body text-[12px] font-normal text-ink"
              >
                {row.name}
              </th>
              <td className="py-2 text-right text-ink-soft">
                {formatINR(row.opening)}
              </td>
              {hasIncome && (
                <td className="py-2 text-right text-stamp-green">
                  {row.income > 0 ? `+${formatINR(row.income)}` : "—"}
                </td>
              )}
              <td className="py-2 text-right text-stamp-red">
                {row.spent > 0 ? `−${formatINR(row.spent)}` : "—"}
              </td>
              {hasTransfers && (
                <MovedCell inward={row.transferIn} outward={row.transferOut} />
              )}
              <td className="py-2 text-right font-semibold text-ink">
                {formatINR(row.closing)}
              </td>
            </tr>
          ))}
        </tbody>

        <tfoot className="font-ledger text-[12px] tabular-nums">
          <tr className="border-t-2 border-rule">
            <th
              scope="row"
              className="py-2 text-left font-body text-[11px] font-normal uppercase tracking-[0.1em] text-ink-soft"
            >
              Total
            </th>
            <td className="py-2 text-right text-ink-soft">
              {formatINR(total.opening)}
            </td>
            {hasIncome && (
              <td className="py-2 text-right text-stamp-green">
                {total.income > 0 ? `+${formatINR(total.income)}` : "—"}
              </td>
            )}
            <td className="py-2 text-right text-stamp-red">
              {total.spent > 0 ? `−${formatINR(total.spent)}` : "—"}
            </td>
            {hasTransfers && (
              /* Always a dash: each transfer leaves one account and arrives at
                 another, so the column nets to zero across your accounts. */
              <td className="py-2 text-right text-ink-soft">—</td>
            )}
            <td className="py-2 text-right font-semibold text-ink">
              {formatINR(total.closing)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Net movement between your own accounts, signed. */
function MovedCell({ inward, outward }: { inward: number; outward: number }) {
  const net = inward - outward;

  if (net === 0) {
    return <td className="py-2 text-right text-ink-soft">—</td>;
  }

  return (
    <td className="py-2 text-right text-ink-soft">
      {net > 0 ? "+" : "−"}
      {formatINR(Math.abs(net))}
    </td>
  );
}
