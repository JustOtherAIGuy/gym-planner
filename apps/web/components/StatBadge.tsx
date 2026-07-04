import { TrendingDown, TrendingUp } from "lucide-react";

/** Ahead/behind delta chip — key-lift strip, progress header. */
export function StatBadge({
  label,
  deltaKg,
  suffix = "kg",
}: {
  label: string;
  deltaKg: number;
  suffix?: string;
}) {
  const ahead = deltaKg >= 0;
  return (
    <div className="min-w-36 shrink-0 rounded-2xl border border-line bg-surface-1 px-4 py-3">
      <p className="truncate text-xs text-muted">{label}</p>
      <p
        className={`mt-0.5 flex items-center gap-1 text-sm font-bold tabular-nums ${
          ahead ? "text-accent" : "text-warn"
        }`}
      >
        {ahead ? (
          <TrendingUp className="h-3.5 w-3.5" />
        ) : (
          <TrendingDown className="h-3.5 w-3.5" />
        )}
        {Math.abs(deltaKg).toFixed(1)} {suffix}{" "}
        <span className="font-medium text-faint">
          {ahead ? "ahead" : "behind"}
        </span>
      </p>
    </div>
  );
}
