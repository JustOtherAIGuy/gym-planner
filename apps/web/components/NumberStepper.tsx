"use client";

import { Minus, Plus } from "lucide-react";

/** Big-thumb numeric input: tap steppers in the gym, type when planning. */
export function NumberStepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 1000,
  suffix,
  ariaLabel,
  size = "md",
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  ariaLabel?: string;
  size?: "md" | "lg";
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  // Show decimals only when the value has them (52.5 must not render as 53).
  const display = Number.isInteger(value) ? String(value) : value.toFixed(1);
  const btn =
    size === "lg" ? "h-12 w-12 rounded-xl" : "h-11 w-11 rounded-lg";
  const well =
    size === "lg" ? "h-12 min-w-[4.5rem] text-xl" : "h-11 min-w-16 text-lg";

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label={`decrease ${ariaLabel ?? ""}`}
        className={`flex items-center justify-center bg-surface-2 text-muted transition-transform duration-100 active:scale-95 active:text-fg ${btn}`}
        onClick={() => onChange(clamp(Number((value - step).toFixed(1))))}
      >
        <Minus className="h-5 w-5" />
      </button>
      <div
        className={`flex items-center justify-center rounded-lg bg-surface-1 px-2 ${well}`}
      >
        <input
          type="text"
          inputMode="decimal"
          aria-label={ariaLabel}
          className="w-14 bg-transparent text-center font-semibold tabular-nums outline-none"
          value={display}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isNaN(n)) onChange(clamp(n));
          }}
        />
        {suffix && <span className="text-xs text-faint">{suffix}</span>}
      </div>
      <button
        type="button"
        aria-label={`increase ${ariaLabel ?? ""}`}
        className={`flex items-center justify-center bg-surface-2 text-muted transition-transform duration-100 active:scale-95 active:text-fg ${btn}`}
        onClick={() => onChange(clamp(Number((value + step).toFixed(1))))}
      >
        <Plus className="h-5 w-5" />
      </button>
    </div>
  );
}
