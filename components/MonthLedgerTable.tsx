import type { MonthLedger } from "@/lib/types";
import { formatINR } from "@/lib/format";

// The statement view: what each account opened the month with, what moved, and
// what it closed at. A real table rather than a chart — these are exact figures
// to be read and reconciled, not magnitudes to be compared at a glance.

export default function MonthLedgerTable({
  ledger,
  hasIncome,
}: {
  ledger: MonthLedger;
  hasIncome: boolean;
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
            <td className="py-2 text-right font-semibold text-ink">
              {formatINR(total.closing)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
