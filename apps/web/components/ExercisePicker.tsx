"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { TExercise } from "@gym-planner/core/schemas";

export function ExercisePicker({
  exercises,
  onPick,
  onClose,
}: {
  exercises: TExercise[];
  onPick: (e: TExercise) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return exercises;
    return exercises.filter(
      (e) =>
        e.name.toLowerCase().includes(needle) ||
        e.primary_muscle.toLowerCase().includes(needle) ||
        e.equipment.toLowerCase().includes(needle),
    );
  }, [q, exercises]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm">
      <div className="flex h-[88dvh] animate-[fade-up_.22s_ease-out] flex-col rounded-t-3xl border-t border-line bg-surface-1">
        {/* grab handle */}
        <div className="flex justify-center pt-3">
          <div className="h-1 w-10 rounded-full bg-line-strong" />
        </div>

        <div className="flex items-center gap-2 p-4 pb-3">
          <div className="flex h-12 flex-1 items-center gap-2 rounded-xl bg-surface-2 px-3">
            <Search className="h-4 w-4 shrink-0 text-faint" />
            <input
              autoFocus
              type="search"
              placeholder="Search exercises…"
              className="h-full flex-1 bg-transparent outline-none placeholder:text-faint"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button
            type="button"
            aria-label="Close"
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2 text-muted"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <ul className="flex-1 overflow-y-auto pb-safe">
          {filtered.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between border-b border-line px-5 py-3.5 text-left active:bg-surface-2"
                onClick={() => onPick(e)}
              >
                <span className="font-medium">{e.name}</span>
                <span className="text-xs text-faint">
                  {e.primary_muscle} · {e.equipment}
                </span>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="p-6 text-center text-sm text-faint">
              Nothing matches “{q}”.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
