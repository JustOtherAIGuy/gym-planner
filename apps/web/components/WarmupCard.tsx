"use client";

import { useState } from "react";
import { ChevronDown, Flame } from "lucide-react";
import {
  WARMUP_LABEL,
  WARMUP_ROUTINES,
  type RampSet,
  type WarmupDayKind,
} from "@gym-planner/core/hyrox";
import { Card } from "./Card";

/**
 * Tailored warm-up riding on top of the day's session: a tickable routine for
 * the day type plus a computed bar ramp for the first main lift. Ticks are
 * local-only — warm-ups guide the session, they aren't training data.
 */
export function WarmupCard({
  dayKind,
  ramp,
  rampLabel,
  startCollapsed = false,
}: {
  dayKind: WarmupDayKind;
  ramp: RampSet[];
  rampLabel?: string;
  startCollapsed?: boolean;
}) {
  const [open, setOpen] = useState(!startCollapsed);
  const [done, setDone] = useState<Set<number>>(new Set());
  const steps = WARMUP_ROUTINES[dayKind];

  return (
    <Card className="p-4">
      <button
        type="button"
        className="flex w-full items-center gap-2.5 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <Flame className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Warm-up</span>
          <span className="block text-xs text-faint">
            {WARMUP_LABEL[dayKind]} · {steps.length} moves
            {ramp.length > 0 ? " + bar ramp" : ""}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-faint transition-transform duration-150 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-1 border-t border-line pt-3">
          {steps.map((s, i) => {
            const checked = done.has(i);
            return (
              <button
                key={s.label}
                type="button"
                className="flex items-start gap-3 rounded-lg px-1 py-1.5 text-left"
                onClick={() =>
                  setDone((d) => {
                    const next = new Set(d);
                    if (checked) next.delete(i);
                    else next.add(i);
                    return next;
                  })
                }
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${
                    checked
                      ? "bg-accent text-black"
                      : "border border-line-strong text-transparent"
                  }`}
                >
                  ✓
                </span>
                <span className="min-w-0">
                  <span
                    className={`text-sm font-semibold ${
                      checked ? "text-faint line-through" : ""
                    }`}
                  >
                    {s.label}
                  </span>{" "}
                  <span
                    className={`text-sm ${
                      checked ? "text-faint line-through" : "text-muted"
                    }`}
                  >
                    {s.detail}
                  </span>
                </span>
              </button>
            );
          })}

          {ramp.length > 0 && (
            <div className="mt-2 rounded-xl bg-surface-2/60 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-faint">
                Bar ramp{rampLabel ? ` · ${rampLabel}` : ""}
              </p>
              <p className="mt-1 text-sm tabular-nums">
                {ramp.map((r, i) => (
                  <span key={r.weightKg}>
                    {i > 0 && <span className="text-faint"> → </span>}
                    <span className="font-bold">{r.weightKg}</span>
                    <span className="text-muted">×{r.reps}</span>
                  </span>
                ))}
                <span className="text-faint"> → working sets</span>
              </p>
              <p className="mt-1 text-xs text-faint">
                kg · rest ~30–45 s between ramp sets, don&apos;t grind them
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
