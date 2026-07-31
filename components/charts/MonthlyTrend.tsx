"use client";

import type { MonthSummary } from "@/lib/types";
import { formatINR, formatCompactINR } from "@/lib/format";

// One series (money spent per month), so no legend box — the heading names it.
// Tapping a column selects that month for the whole dashboard, which makes this
// both the trend chart and the month filter.

const BAR = "#1f6ea6"; // categorical slot 1
const BAR_MUTED = "#b9c4cc";

/** Rounded top corners, square at the baseline. */
function barPath(x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h);
  return [
    `M ${x} ${y + h}`,
    `L ${x} ${y + radius}`,
    `Q ${x} ${y} ${x + radius} ${y}`,
    `L ${x + w - radius} ${y}`,
    `Q ${x + w} ${y} ${x + w} ${y + radius}`,
    `L ${x + w} ${y + h}`,
    "Z",
  ].join(" ");
}

export default function MonthlyTrend({
  months,
  selected,
  onSelect,
}: {
  months: MonthSummary[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  // Oldest → newest reads naturally left-to-right; cap at 6 for phone width.
  const data = [...months].reverse().slice(-6);

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-[13px] text-ink-soft font-body">
        No entries yet.
      </p>
    );
  }

  const max = Math.max(...data.map((m) => m.spent), 1);

  const width = 320;
  const plotHeight = 104;
  const labelBand = 30; // reserve room so x labels are never clipped
  const height = plotHeight + labelBand;
  const slot = width / data.length;
  const barWidth = Math.min(24, slot * 0.5);

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height: "auto" }}
        role="img"
        aria-label={`Spending by month: ${data
          .map((m) => `${m.label} ${formatINR(m.spent)}`)
          .join(", ")}`}
      >
        {/* Recessive hairline baseline */}
        <line
          x1={0}
          y1={plotHeight}
          x2={width}
          y2={plotHeight}
          stroke="#cfc7ab"
          strokeWidth={1}
        />

        {data.map((month, i) => {
          const isSelected = month.key === selected;
          const barHeight = Math.max((month.spent / max) * (plotHeight - 20), 2);
          const x = i * slot + (slot - barWidth) / 2;
          const y = plotHeight - barHeight;

          return (
            <g key={month.key}>
              <path
                d={barPath(x, y, barWidth, barHeight, 4)}
                fill={isSelected ? BAR : BAR_MUTED}
              />

              {/* Value on the cap of the selected column only — selective
                  labelling; the rest are reachable by tapping. */}
              {isSelected && (
                <text
                  x={x + barWidth / 2}
                  y={y - 6}
                  textAnchor="middle"
                  className="font-ledger"
                  fontSize={10}
                  fill="#1d3557"
                >
                  {formatCompactINR(month.spent)}
                </text>
              )}

              <text
                x={x + barWidth / 2}
                y={plotHeight + 14}
                textAnchor="middle"
                fontSize={9}
                fill={isSelected ? "#1d3557" : "#4a6178"}
              >
                {month.label.split(" ")[0]}
              </text>
              <text
                x={x + barWidth / 2}
                y={plotHeight + 25}
                textAnchor="middle"
                fontSize={8}
                fill="#4a6178"
              >
                {month.label.split(" ")[1]}
              </text>

              {/* Hit target spans the full slot, well past the 24px minimum */}
              <rect
                x={i * slot}
                y={0}
                width={slot}
                height={height}
                fill="transparent"
                className="cursor-pointer"
                onClick={() => onSelect(month.key)}
              >
                <title>{`${month.label}: ${formatINR(month.spent)} spent`}</title>
              </rect>
            </g>
          );
        })}
      </svg>

      <div className="sr-only">
        <table>
          <caption>Spending by month</caption>
          <tbody>
            {data.map((m) => (
              <tr key={m.key}>
                <th scope="row">{m.label}</th>
                <td>{formatINR(m.spent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
