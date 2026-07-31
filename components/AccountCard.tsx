import { Account } from "@/lib/types";
import { formatINR } from "@/lib/format";
import CopyButton from "./CopyButton";

export default function AccountCard({ account }: { account: Account }) {
  const isLow = account.current_balance < 500;

  return (
    <div className="shrink-0 w-[176px] rounded-t-md bg-card border border-rule/70 shadow-sm">
      <div className="p-3.5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-ink text-[11px] font-display text-ink">
            {account.name.slice(0, 1)}
          </span>
          <span className="text-[11px] uppercase tracking-[0.12em] text-ink-soft font-body">
            {account.name}
          </span>
          <CopyButton
            amount={account.current_balance}
            label={account.name}
            className="-mr-1.5 ml-auto"
          />
        </div>

        <div
          className={`font-ledger text-[22px] font-semibold mt-2.5 leading-none ${
            isLow ? "text-stamp-red" : "text-ink"
          }`}
        >
          {formatINR(account.current_balance)}
        </div>

        <div className="mt-2.5 space-y-0.5 text-[10px] font-ledger">
          <div className="text-ink-soft">
            opening {formatINR(account.starting_balance)}
          </div>
          <div className="flex gap-2">
            <span className="text-stamp-red/80">
              −{formatINR(account.total_spent)}
            </span>
            {account.total_income > 0 && (
              <span className="text-stamp-green">
                +{formatINR(account.total_income)}
              </span>
            )}
          </div>
        </div>
      </div>
      {/* perforated tear-off edge */}
      <div className="stub-perforation" />
    </div>
  );
}
