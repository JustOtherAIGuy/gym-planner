"use client";

import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { formatHMS, formatMS } from "@gym-planner/core/hyrox";

/**
 * mm:ss duration input with ±step steppers — same footprint and styling as
 * NumberStepper so cardio rows line up with strength rows.
 * Typing accepts "1:27:43" (h:min:sec), "22:15" (min:sec), or a bare number
 * of minutes. Displays h:mm:ss once over an hour.
 */
export function DurationInput({
  valueSec,
  onChange,
  stepSec = 15,
  maxSec = 36000,
  ariaLabel,
}: {
  valueSec: number;
  onChange: (sec: number) => void;
  stepSec?: number;
  maxSec?: number;
  ariaLabel?: string;
}) {
  const fmt = (v: number) => (v >= 3600 ? formatHMS(v) : formatMS(v));
  const [text, setText] = useState(valueSec > 0 ? fmt(valueSec) : "");
  useEffect(() => {
    setText(valueSec > 0 ? fmt(valueSec) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueSec]);

  const clamp = (v: number) => Math.min(maxSec, Math.max(0, v));

  function commit(raw: string) {
    const t = raw.trim();
    if (t === "") {
      onChange(0);
      return;
    }
    const hms = /^(\d+):(\d{1,2}):(\d{1,2})$/.exec(t);
    if (hms) {
      onChange(
        clamp(Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3])),
      );
      return;
    }
    const ms = /^(\d+):(\d{1,2})$/.exec(t);
    if (ms) {
      onChange(clamp(Number(ms[1]) * 60 + Number(ms[2])));
      return;
    }
    const n = Number(t);
    if (!Number.isNaN(n)) onChange(clamp(Math.round(n * 60)));
    else setText(valueSec > 0 ? fmt(valueSec) : "");
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label={`decrease ${ariaLabel ?? "duration"}`}
        className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-2 text-muted transition-transform duration-100 active:scale-95 active:text-fg"
        onClick={() => onChange(clamp(valueSec - stepSec))}
      >
        <Minus className="h-5 w-5" />
      </button>
      <div className="flex h-11 min-w-16 items-center justify-center rounded-lg bg-surface-1 px-2 text-lg">
        <input
          type="text"
          inputMode="numeric"
          aria-label={ariaLabel ?? "duration minutes:seconds"}
          placeholder="m:ss"
          className="w-14 bg-transparent text-center font-semibold tabular-nums outline-none placeholder:text-faint"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
          }}
        />
      </div>
      <button
        type="button"
        aria-label={`increase ${ariaLabel ?? "duration"}`}
        className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-2 text-muted transition-transform duration-100 active:scale-95 active:text-fg"
        onClick={() => onChange(clamp(valueSec + stepSec))}
      >
        <Plus className="h-5 w-5" />
      </button>
    </div>
  );
}
