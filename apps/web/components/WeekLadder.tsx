"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Pencil } from "lucide-react";
import { planWeekWindow, type PlanWeekActuals } from "@gym-planner/core/hyrox";
import type { TProgramWeek, TWeekFlag } from "@gym-planner/core/schemas";
import { Card, CardLabel } from "./Card";
import { NumberStepper } from "./NumberStepper";
import { NoteSheet } from "./NoteSheet";

const FLAG_LABEL: Record<TWeekFlag, string> = {
  "5k_test": "5k test",
  cutback: "Cut-back",
  half_sim: "Half-sim",
  dress_rehearsal: "Dress rehearsal",
  race_week: "Race week",
};

export type WeekPatch = Partial<
  Pick<TProgramWeek, "run_km" | "long_run_km" | "note">
>;

export type WeekLiftRx = { label: string; kg: number };

function fmtRange(startDate: string, weekIndex: number): string {
  const { startISO, endISO } = planWeekWindow(startDate, weekIndex);
  const s = new Date(`${startISO}T00:00:00`);
  const e = new Date(`${endISO}T00:00:00`);
  e.setDate(e.getDate() - 1); // half-open → inclusive display
  const opts = { month: "short", day: "numeric" } as const;
  const sTxt = s.toLocaleDateString(undefined, opts);
  const eTxt =
    s.getMonth() === e.getMonth()
      ? String(e.getDate())
      : e.toLocaleDateString(undefined, opts);
  return `${sTxt}–${eTxt}`;
}

const num = (v: number | string | null): number | null =>
  v == null ? null : Number(v);

/**
 * The whole journey, week by week: scrollable ladder of fixed targets with
 * the user's actuals overlaid. Run km / long run / note are editable; edits
 * persist debounced and live in local drafts (no refetch churn).
 */
export function WeekLadder({
  weeks,
  actualsByIndex,
  currentWeek,
  startDate,
  liftRxByWeek,
  onPatch,
}: {
  weeks: TProgramWeek[];
  actualsByIndex: Map<number, PlanWeekActuals>;
  currentWeek: number;
  startDate: string;
  liftRxByWeek: Map<number, WeekLiftRx[]>;
  onPatch: (id: string, patch: WeekPatch) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState<number | null>(currentWeek);
  const [drafts, setDrafts] = useState<Record<string, WeekPatch>>({});
  const [noteFor, setNoteFor] = useState<TProgramWeek | null>(null);
  const pending = useRef<Record<string, WeekPatch>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const containerRef = useRef<HTMLUListElement | null>(null);
  const currentRef = useRef<HTMLLIElement | null>(null);
  const scrolled = useRef(false);

  // Center the current week inside the ladder once, without page jumps.
  useEffect(() => {
    if (scrolled.current || weeks.length === 0) return;
    const c = containerRef.current;
    const r = currentRef.current;
    if (!c || !r) return;
    c.scrollTop = Math.max(
      0,
      r.offsetTop - c.clientHeight / 2 + r.clientHeight / 2,
    );
    scrolled.current = true;
  }, [weeks.length]);

  function edit(week: TProgramWeek, patch: WeekPatch) {
    setDrafts((d) => ({ ...d, [week.id]: { ...d[week.id], ...patch } }));
    pending.current[week.id] = { ...pending.current[week.id], ...patch };
    const t = timers.current[week.id];
    if (t) clearTimeout(t);
    timers.current[week.id] = setTimeout(() => {
      const p = pending.current[week.id];
      delete pending.current[week.id];
      if (p) void onPatch(week.id, p);
    }, 600);
  }

  if (weeks.length === 0) return null;

  return (
    <Card className="p-4">
      <div className="flex items-baseline justify-between">
        <CardLabel>Week by week</CardLabel>
        <span className="text-xs tabular-nums text-faint">
          you are in week {currentWeek}
        </span>
      </div>

      <ul
        ref={containerRef}
        className="-mx-1 mt-3 flex max-h-[26rem] flex-col gap-2 overflow-y-auto px-1"
      >
        {weeks.map((w0) => {
          const w = { ...w0, ...drafts[w0.id] };
          const n = w.week_index;
          const isCurrent = n === currentWeek;
          const isPast = n < currentWeek;
          const isOpen = expanded === n;
          const actual = n <= currentWeek ? actualsByIndex.get(n) : undefined;
          const runTarget = num(w.run_km);
          const longTarget = num(w.long_run_km);
          const runHit =
            actual != null && runTarget != null && actual.runKm >= runTarget;
          const rx = liftRxByWeek.get(n) ?? [];

          return (
            <li
              key={w.id}
              ref={isCurrent ? currentRef : undefined}
              className={`rounded-xl ${
                isCurrent ? "bg-accent/10" : "bg-surface-2/50"
              }`}
            >
              {/* Compact header row */}
              <button
                type="button"
                className="flex w-full items-center gap-3 p-3 text-left"
                onClick={() => setExpanded(isOpen ? null : n)}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
                    isCurrent
                      ? "bg-accent text-black"
                      : isPast
                        ? "bg-accent/30 text-fg"
                        : "border border-line-strong text-faint"
                  }`}
                >
                  {n}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="text-xs text-faint">
                      {fmtRange(startDate, n)}
                    </span>
                    {w.flags.map((f) => (
                      <span
                        key={f}
                        className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent"
                      >
                        {FLAG_LABEL[f]}
                      </span>
                    ))}
                  </span>
                  <span className="block truncate text-sm font-semibold">
                    {w.run_focus ?? `Week ${n}`}
                  </span>
                </span>
                <span
                  className={`shrink-0 text-sm font-bold tabular-nums ${
                    actual
                      ? runHit
                        ? "text-accent"
                        : "text-fg"
                      : "text-faint"
                  }`}
                >
                  {actual && runTarget != null
                    ? `${actual.runKm}/${runTarget} km`
                    : runTarget != null
                      ? `${runTarget} km`
                      : "—"}
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-faint transition-transform duration-150 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Expanded detail */}
              {isOpen && (
                <div className="flex flex-col gap-3 border-t border-line px-3 pb-3 pt-3">
                  {/* Editable targets */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-faint">
                        Run
                      </span>
                      <NumberStepper
                        value={runTarget ?? 0}
                        step={0.5}
                        min={0}
                        max={200}
                        suffix="km"
                        ariaLabel={`week ${n} run target`}
                        onChange={(v) => edit(w0, { run_km: v })}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-faint">
                        Long
                      </span>
                      <NumberStepper
                        value={longTarget ?? 0}
                        step={0.5}
                        min={0}
                        max={100}
                        suffix="km"
                        ariaLabel={`week ${n} long run target`}
                        onChange={(v) => edit(w0, { long_run_km: v })}
                      />
                    </div>
                  </div>

                  {/* Actuals so far */}
                  {actual && (
                    <p
                      className={`text-xs ${
                        runHit ? "text-accent" : "text-muted"
                      }`}
                    >
                      {isCurrent ? "So far: " : "You did: "}
                      <span className="font-bold tabular-nums">
                        {actual.runKm} km
                      </span>
                      {actual.longestRunKm > 0 && (
                        <> · longest {actual.longestRunKm} km</>
                      )}{" "}
                      · {actual.sessions} session
                      {actual.sessions === 1 ? "" : "s"}
                      {actual.stationEfforts > 0 && (
                        <> · {actual.stationEfforts} station efforts</>
                      )}
                    </p>
                  )}

                  {/* Intent lines */}
                  {w.strength_focus && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-faint">
                        Strength
                      </p>
                      <p className="mt-0.5 text-sm text-muted">
                        {w.strength_focus}
                      </p>
                      {rx.length > 0 && (
                        <p className="mt-1 flex flex-wrap gap-1.5">
                          {rx.map((r) => (
                            <span
                              key={r.label}
                              className="rounded-md bg-surface-2 px-2 py-0.5 text-xs tabular-nums text-fg"
                            >
                              {r.label}{" "}
                              <span className="font-bold">{r.kg} kg</span>
                            </span>
                          ))}
                        </p>
                      )}
                    </div>
                  )}
                  {w.station_focus && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-faint">
                        Stations
                      </p>
                      <p className="mt-0.5 text-sm text-muted">
                        {w.station_focus}
                      </p>
                    </div>
                  )}

                  {/* Note */}
                  <button
                    type="button"
                    className="flex items-start gap-2 text-left"
                    onClick={() => setNoteFor(w0)}
                  >
                    <Pencil className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" />
                    <span
                      className={`text-xs ${
                        w.note ? "text-muted" : "text-faint"
                      }`}
                    >
                      {w.note ?? "Add a note for this week…"}
                    </span>
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-2 text-xs text-faint">
        volt = run target hit · lift weights follow your forecasts (×5 top
        set) · tap a week to tweak its targets
      </p>

      {noteFor && (
        <NoteSheet
          title={`Week ${noteFor.week_index} note`}
          initial={
            (drafts[noteFor.id]?.note as string | null | undefined) ??
            noteFor.note
          }
          onSave={async (v) => {
            setDrafts((d) => ({
              ...d,
              [noteFor.id]: { ...d[noteFor.id], note: v },
            }));
            await onPatch(noteFor.id, { note: v });
          }}
          onClose={() => setNoteFor(null)}
        />
      )}
    </Card>
  );
}
