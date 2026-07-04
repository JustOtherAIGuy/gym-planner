"use client";

import { Button } from "./Button";

export type CompletionStats =
  | { kind: "session"; durationMin: number; sets: number; volumeKg: number }
  | { kind: "circuit"; rounds: number; stations: number };

// Deterministic confetti layout — no randomness in render.
const CONFETTI = Array.from({ length: 16 }, (_, i) => ({
  left: (i * 61) % 100,
  delay: ((i * 137) % 900) / 1000,
  duration: 2.2 + ((i * 53) % 140) / 100,
  color: i % 4 === 0 ? "#4c9fff" : i % 3 === 0 ? "#f7f7f8" : "#bfff38",
  width: i % 2 === 0 ? 5 : 8,
}));

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-display text-3xl tabular-nums leading-none">
        {value}
      </span>
      <span className="mt-1.5 text-[10px] uppercase tracking-[0.18em] text-faint">
        {label}
      </span>
    </div>
  );
}

/** Full-screen finish moment: volt burst, confetti, the numbers that matter. */
export function WorkoutComplete({
  stats,
  onClose,
}: {
  stats: CompletionStats;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden bg-bg px-6">
      {/* burst rings */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 animate-[burst_.9s_ease-out_both] rounded-full border-2 border-accent/60"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 animate-[burst_1.2s_.15s_ease-out_both] rounded-full border border-accent/40"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/15 blur-[90px]"
      />

      {/* confetti */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {CONFETTI.map((c, i) => (
          <span
            key={i}
            className="absolute top-0 rounded-[2px]"
            style={{
              left: `${c.left}%`,
              width: c.width,
              height: c.width * 2.4,
              backgroundColor: c.color,
              animation: `confetti-fall ${c.duration}s ${c.delay}s cubic-bezier(.3,.1,.6,1) both`,
            }}
          />
        ))}
      </div>

      <p className="animate-[pop-in_.35s_ease-out_both] text-center">
        <span className="font-display text-[72px] leading-none tracking-tight">
          DONE
        </span>
      </p>
      <p className="mt-2 animate-[fade-up_.4s_.15s_ease-out_both] text-sm text-muted">
        {stats.kind === "session"
          ? "Another brick on the bar."
          : "Circuit banked."}
      </p>

      <div className="mt-10 flex animate-[fade-up_.4s_.3s_ease-out_both] items-start gap-10">
        {stats.kind === "session" ? (
          <>
            <Stat value={`${stats.durationMin}`} label="minutes" />
            <Stat value={`${stats.sets}`} label="sets" />
            {stats.volumeKg > 0 && (
              <Stat
                value={stats.volumeKg.toLocaleString()}
                label="kg volume"
              />
            )}
          </>
        ) : (
          <>
            <Stat value={`${stats.rounds}`} label="rounds" />
            <Stat value={`${stats.stations}`} label="stations" />
          </>
        )}
      </div>

      <Button
        variant="primary"
        size="lg"
        className="mt-12 w-full max-w-xs animate-[fade-up_.4s_.45s_ease-out_both]"
        onClick={onClose}
      >
        Back home
      </Button>
    </div>
  );
}
