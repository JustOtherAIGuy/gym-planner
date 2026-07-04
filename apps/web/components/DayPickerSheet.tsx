"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { currentPhase } from "@gym-planner/core/hyrox";
import type { TProgramPhase } from "@gym-planner/core/schemas";
import { todayISO, type ProgramDayWithExercises } from "../lib/data";
import { Sheet } from "./Sheet";

function DayRow({
  day,
  suggested,
  trained,
  onPick,
}: {
  day: ProgramDayWithExercises;
  suggested: boolean;
  trained: boolean;
  onPick: () => void;
}) {
  const n = day.program_exercises.length;
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 border-b border-line px-5 py-3.5 text-left active:bg-surface-2"
      onClick={onPick}
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-semibold">{day.name}</span>
          {suggested && (
            <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-accent">
              Suggested
            </span>
          )}
        </span>
        <span className="text-xs text-faint">
          {n} movement{n === 1 ? "" : "s"}
        </span>
      </span>
      {trained && (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/15 text-accent">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

/** Bottom-sheet session chooser: current phase's days first, rest on demand. */
export function DayPickerSheet({
  days,
  phases,
  suggestedId,
  trainedThisWeek,
  onPick,
  onClose,
}: {
  days: ProgramDayWithExercises[];
  phases: TProgramPhase[];
  suggestedId?: string;
  trainedThisWeek?: Set<string>;
  onPick: (day: ProgramDayWithExercises) => void;
  onClose: () => void;
}) {
  const [showAll, setShowAll] = useState(false);

  const phase = useMemo(
    () => (phases.length > 0 ? currentPhase(phases, todayISO()) : null),
    [phases],
  );
  const trainable = days.filter((d) => !d.rest_day);
  const inPhase = phase
    ? trainable.filter((d) => d.phase_id === phase.id)
    : trainable;
  const others = phase
    ? trainable.filter((d) => d.phase_id !== phase.id)
    : [];
  const phaseName = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of phases) m.set(p.id, p.name);
    return m;
  }, [phases]);

  return (
    <Sheet tall title="Pick a session" onClose={onClose}>
      <ul className="mt-2 flex-1 overflow-y-auto">
        {inPhase.map((d) => (
          <li key={d.id}>
            <DayRow
              day={d}
              suggested={d.id === suggestedId}
              trained={trainedThisWeek?.has(d.id) ?? false}
              onPick={() => onPick(d)}
            />
          </li>
        ))}
        {others.length > 0 && (
          <li>
            <button
              type="button"
              className="flex w-full items-center gap-1.5 px-5 py-3.5 text-left text-sm text-faint"
              onClick={() => setShowAll((v) => !v)}
            >
              All days
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-150 ${showAll ? "rotate-180" : ""}`}
              />
            </button>
          </li>
        )}
        {showAll &&
          others.map((d, i) => {
            const prev = others[i - 1];
            const header =
              d.phase_id &&
              phaseName.has(d.phase_id) &&
              prev?.phase_id !== d.phase_id
                ? phaseName.get(d.phase_id)
                : null;
            return (
              <li key={d.id}>
                {header && (
                  <p className="px-5 pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
                    {header}
                  </p>
                )}
                <DayRow
                  day={d}
                  suggested={false}
                  trained={trainedThisWeek?.has(d.id) ?? false}
                  onPick={() => onPick(d)}
                />
              </li>
            );
          })}
      </ul>
    </Sheet>
  );
}
