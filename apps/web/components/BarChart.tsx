"use client";

/**
 * Compact SVG bar chart in the LineChart visual language — volt bars on
 * hairline grid, value labels on top, optional dashed target line.
 */
export function BarChart({
  bars,
  height = 140,
  yUnit = "",
  targetY,
  targetLabel,
}: {
  bars: { label: string; value: number; sub?: string }[];
  height?: number;
  yUnit?: string;
  targetY?: number;
  targetLabel?: string;
}) {
  const W = 340;
  const PAD_TOP = 18;
  const PAD_BOTTOM = 26;
  const plotH = height - PAD_TOP - PAD_BOTTOM;

  const maxVal = Math.max(...bars.map((b) => b.value), 1);
  // Include the target line when it's within reach (≤2× current max).
  const yMax =
    targetY !== undefined && targetY <= maxVal * 2
      ? Math.max(maxVal, targetY) * 1.1
      : maxVal * 1.15;

  const slot = W / Math.max(bars.length, 1);
  const barW = Math.min(36, slot * 0.55);

  const y = (v: number) => PAD_TOP + plotH - (v / yMax) * plotH;

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      className="w-full"
      role="img"
      aria-label="bar chart"
    >
      {targetY !== undefined && targetY <= yMax && (
        <>
          <line
            x1={0}
            x2={W}
            y1={y(targetY)}
            y2={y(targetY)}
            stroke="rgba(255,255,255,0.35)"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          {targetLabel && (
            <text
              x={W - 2}
              y={y(targetY) - 4}
              textAnchor="end"
              className="fill-[rgba(255,255,255,0.4)] text-[9px]"
            >
              {targetLabel}
            </text>
          )}
        </>
      )}
      {bars.map((b, i) => {
        const cx = slot * i + slot / 2;
        const barH = Math.max(2, (b.value / yMax) * plotH);
        return (
          <g key={b.label + i}>
            <rect
              x={cx - barW / 2}
              y={PAD_TOP + plotH - barH}
              width={barW}
              height={barH}
              rx={4}
              className="fill-accent"
              style={{
                filter: "drop-shadow(0 0 6px rgba(191,255,56,0.25))",
              }}
            />
            {b.value > 0 && (
              <text
                x={cx}
                y={PAD_TOP + plotH - barH - 5}
                textAnchor="middle"
                className="fill-fg text-[10px] font-bold tabular-nums"
              >
                {b.value}
                {yUnit}
              </text>
            )}
            <text
              x={cx}
              y={height - 12}
              textAnchor="middle"
              className="fill-[rgba(155,155,164,0.8)] text-[9px]"
            >
              {b.label}
            </text>
            {b.sub && (
              <text
                x={cx}
                y={height - 2}
                textAnchor="middle"
                className="fill-[rgba(155,155,164,0.5)] text-[8px] tabular-nums"
              >
                {b.sub}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
