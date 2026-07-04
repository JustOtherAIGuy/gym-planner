"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Plus,
  TrendingUp,
  Trash2,
  X,
} from "lucide-react";
import type { TExercise, TProgramExercise } from "@gym-planner/core/schemas";
import { createClient } from "../../../../lib/supabase/client";
import { useQuery } from "../../../../lib/useQuery";
import {
  fetchExercises,
  fetchPhases,
  fetchProgramDays,
  swapDayIndices,
  swapExerciseOrder,
  type ProgramDayWithExercises,
} from "../../../../lib/data";
import { ExercisePicker } from "../../../../components/ExercisePicker";
import { NumberStepper } from "../../../../components/NumberStepper";
import { Button } from "../../../../components/Button";
import { Card } from "../../../../components/Card";
import { PageHeader } from "../../../../components/PageHeader";
import { SkeletonCard } from "../../../../components/Skeleton";
import { InlineEdit } from "../../../../components/InlineEdit";
import { NoteSheet } from "../../../../components/NoteSheet";
import { ConfirmSheet } from "../../../../components/ConfirmSheet";
import { Sheet } from "../../../../components/Sheet";
import { MovementChip } from "../../../../components/pictograms/MovementChip";

export default function ProgramDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: programId } = use(params);
  const db = useMemo(() => createClient(), []);
  const router = useRouter();

  const program = useQuery(async () => {
    const { data, error } = await db
      .from("programs")
      .select("*")
      .eq("id", programId)
      .single();
    if (error) throw error;
    return data as { id: string; name: string };
  }, [programId]);

  const days = useQuery(() => fetchProgramDays(db, programId), [programId]);
  const phases = useQuery(() => fetchPhases(db, programId), [programId]);
  const exercises = useQuery(() => fetchExercises(db), []);

  // Phased programs render their days grouped under phase headers.
  const phaseName = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of phases.data ?? []) m.set(p.id, p.name);
    return m;
  }, [phases.data]);

  const [pickerForDay, setPickerForDay] = useState<string | null>(null);
  const [dayName, setDayName] = useState("");
  const [noteFor, setNoteFor] = useState<{
    pe: TProgramExercise & { exercises: TExercise };
  } | null>(null);
  const [phaseFor, setPhaseFor] = useState<ProgramDayWithExercises | null>(
    null,
  );
  const [confirmDeleteDay, setConfirmDeleteDay] =
    useState<ProgramDayWithExercises | null>(null);
  const [confirmDeleteProgram, setConfirmDeleteProgram] = useState(false);

  // day_index has a unique constraint per program — after deletions,
  // days.length can collide with a surviving index, so always go past the max.
  const nextDayIndex = () =>
    (days.data ?? []).reduce((m, d) => Math.max(m, d.day_index), -1) + 1;

  async function addDay(e: React.FormEvent) {
    e.preventDefault();
    if (!dayName.trim()) return;
    await db.from("program_days").insert({
      program_id: programId,
      day_index: nextDayIndex(),
      name: dayName.trim(),
    });
    setDayName("");
    days.refetch();
  }

  async function duplicateDay(day: ProgramDayWithExercises) {
    const { data: newDay, error } = await db
      .from("program_days")
      .insert({
        program_id: programId,
        day_index: nextDayIndex(),
        name: `${day.name} (copy)`,
      })
      .select("id")
      .single();
    if (error || !newDay) return;
    if (day.program_exercises.length > 0) {
      await db.from("program_exercises").insert(
        day.program_exercises.map((pe) => ({
          program_day_id: newDay.id,
          exercise_id: pe.exercise_id,
          order_index: pe.order_index,
          target_sets: pe.target_sets,
          target_reps_low: pe.target_reps_low,
          target_reps_high: pe.target_reps_high,
          target_rpe: pe.target_rpe,
        })),
      );
    }
    days.refetch();
  }

  async function removeDay(dayId: string) {
    await db.from("program_days").delete().eq("id", dayId);
    days.refetch();
  }

  async function addExercise(dayId: string, ex: TExercise) {
    const day = days.data?.find((d) => d.id === dayId);
    await db.from("program_exercises").insert({
      program_day_id: dayId,
      exercise_id: ex.id,
      order_index: day?.program_exercises.length ?? 0,
      target_sets: 3,
      target_reps_low: 8,
      target_reps_high: 12,
    });
    setPickerForDay(null);
    days.refetch();
  }

  async function updateExercise(
    peId: string,
    patch: Partial<{
      target_sets: number;
      target_reps_low: number;
      target_reps_high: number;
    }>,
  ) {
    await db.from("program_exercises").update(patch).eq("id", peId);
    days.refetch();
  }

  async function removeExercise(peId: string) {
    await db.from("program_exercises").delete().eq("id", peId);
    days.refetch();
  }

  return (
    <main className="flex flex-col gap-5">
      <PageHeader
        title={program.data?.name ?? "…"}
        titleNode={
          program.data ? (
            <InlineEdit
              value={program.data.name}
              ariaLabel="program name"
              className="font-display text-2xl tracking-tight"
              onSave={async (name) => {
                await db.from("programs").update({ name }).eq("id", programId);
                program.refetch();
              }}
            />
          ) : undefined
        }
        backHref="/programs"
      />

      <form onSubmit={addDay} className="flex gap-2">
        <input
          type="text"
          placeholder="Add day (e.g. Push A)"
          className="h-11 flex-1 rounded-xl bg-surface-2 px-4 outline-none placeholder:text-faint"
          value={dayName}
          onChange={(e) => setDayName(e.target.value)}
        />
        <Button variant="primary" type="submit" disabled={!dayName.trim()}>
          Add
        </Button>
      </form>

      {days.loading && <SkeletonCard lines={3} />}

      {(days.data ?? []).map((day, i, all) => (
        <div key={day.id} className="flex flex-col gap-2">
          {day.phase_id &&
            phaseName.has(day.phase_id) &&
            all[i - 1]?.phase_id !== day.phase_id && (
              <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
                {phaseName.get(day.phase_id)}
              </p>
            )}
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2">
            <InlineEdit
              value={day.name}
              ariaLabel={`day ${day.name}`}
              maxLength={64}
              className="min-w-0 flex-1 font-display text-lg"
              onSave={async (name) => {
                await db.from("program_days").update({ name }).eq("id", day.id);
                days.refetch();
              }}
            />
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                aria-label="Move day up"
                disabled={i === 0}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-muted disabled:opacity-30"
                onClick={async () => {
                  const prev = all[i - 1];
                  if (!prev) return;
                  await swapDayIndices(db, programId, day, prev);
                  days.refetch();
                }}
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Move day down"
                disabled={i === all.length - 1}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-muted disabled:opacity-30"
                onClick={async () => {
                  const next = all[i + 1];
                  if (!next) return;
                  await swapDayIndices(db, programId, day, next);
                  days.refetch();
                }}
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Duplicate day"
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-muted"
                onClick={() => duplicateDay(day)}
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Delete day"
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-danger"
                onClick={() => setConfirmDeleteDay(day)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {(phases.data ?? []).length > 0 && (
            <button
              type="button"
              className="mt-1.5 rounded-md bg-surface-2 px-2 py-1 text-xs text-muted"
              onClick={() => setPhaseFor(day)}
            >
              {day.phase_id
                ? (phaseName.get(day.phase_id) ?? "Unknown phase")
                : "No phase"}
            </button>
          )}

          <ul className="mt-3 flex flex-col gap-4">
            {day.program_exercises.map((pe, j, list) => (
              <li key={pe.id} className="border-t border-line pt-3">
                <div className="flex items-center justify-between">
                  <p className="flex min-w-0 items-center gap-2 font-medium">
                    <MovementChip
                      slug={pe.exercises.slug}
                      modality={pe.exercises.modality}
                    />
                    <span className="truncate">{pe.exercises.name}</span>
                  </p>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      aria-label={`move ${pe.exercises.name} up`}
                      disabled={j === 0}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-faint disabled:opacity-30"
                      onClick={async () => {
                        const prev = list[j - 1];
                        if (!prev) return;
                        await swapExerciseOrder(db, pe, prev);
                        days.refetch();
                      }}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`move ${pe.exercises.name} down`}
                      disabled={j === list.length - 1}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-faint disabled:opacity-30"
                      onClick={async () => {
                        const next = list[j + 1];
                        if (!next) return;
                        await swapExerciseOrder(db, pe, next);
                        days.refetch();
                      }}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <Link
                      href={`/progress?exercise=${pe.exercise_id}`}
                      aria-label="Forecast"
                      className="flex h-9 items-center gap-1.5 rounded-lg bg-accent/10 px-2.5 text-xs font-semibold text-accent"
                    >
                      <TrendingUp className="h-3.5 w-3.5" />
                      Forecast
                    </Link>
                    <button
                      type="button"
                      aria-label="Remove exercise"
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-faint"
                      onClick={() => removeExercise(pe.id)}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  className={`mt-1 block w-full text-left text-xs ${
                    pe.notes ? "text-accent/80" : "text-faint"
                  }`}
                  onClick={() => setNoteFor({ pe })}
                >
                  {pe.notes ?? "+ note"}
                </button>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-faint">
                  <div className="flex items-center gap-2">
                    sets
                    <NumberStepper
                      value={pe.target_sets}
                      min={1}
                      max={10}
                      onChange={(v) => updateExercise(pe.id, { target_sets: v })}
                      ariaLabel={`${pe.exercises.name} sets`}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    reps
                    <NumberStepper
                      value={pe.target_reps_low}
                      min={1}
                      max={pe.target_reps_high}
                      onChange={(v) =>
                        updateExercise(pe.id, { target_reps_low: v })
                      }
                      ariaLabel={`${pe.exercises.name} reps low`}
                    />
                    –
                    <NumberStepper
                      value={pe.target_reps_high}
                      min={pe.target_reps_low}
                      max={50}
                      onChange={(v) =>
                        updateExercise(pe.id, { target_reps_high: v })
                      }
                      ariaLabel={`${pe.exercises.name} reps high`}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <Button
            className="mt-3 w-full"
            onClick={() => setPickerForDay(day.id)}
          >
            <Plus className="h-4 w-4" />
            Add exercise
          </Button>
        </Card>
        </div>
      ))}

      {days.data?.length === 0 && (
        <p className="rounded-card border border-line p-8 text-center text-sm text-muted">
          Add your first day above — e.g. Push A, Pull A, Legs.
        </p>
      )}

      {(days.data ?? []).length > 0 && (
        <Button
          variant="ghost"
          className="w-full text-danger"
          onClick={() => setConfirmDeleteProgram(true)}
        >
          <Trash2 className="h-4 w-4" />
          Delete program
        </Button>
      )}

      {pickerForDay && exercises.data && (
        <ExercisePicker
          exercises={exercises.data}
          onPick={(ex) => addExercise(pickerForDay, ex)}
          onClose={() => setPickerForDay(null)}
        />
      )}

      {noteFor && (
        <NoteSheet
          title={noteFor.pe.exercises.name}
          initial={noteFor.pe.notes}
          onSave={async (notes) => {
            await db
              .from("program_exercises")
              .update({ notes })
              .eq("id", noteFor.pe.id);
            days.refetch();
          }}
          onClose={() => setNoteFor(null)}
        />
      )}

      {phaseFor && (
        <Sheet title="Assign phase" onClose={() => setPhaseFor(null)}>
          <ul className="p-2 pb-4">
            {[...(phases.data ?? []), null].map((p) => (
              <li key={p?.id ?? "none"}>
                <button
                  type="button"
                  className={`w-full rounded-xl px-4 py-3.5 text-left active:bg-surface-2 ${
                    (p?.id ?? null) === phaseFor.phase_id
                      ? "font-bold text-accent"
                      : ""
                  }`}
                  onClick={async () => {
                    await db
                      .from("program_days")
                      .update({ phase_id: p?.id ?? null })
                      .eq("id", phaseFor.id);
                    setPhaseFor(null);
                    days.refetch();
                  }}
                >
                  {p?.name ?? "No phase"}
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
      )}

      {confirmDeleteDay && (
        <ConfirmSheet
          title={`Delete "${confirmDeleteDay.name}"?`}
          body="Its exercises are removed too."
          confirmLabel="Delete day"
          onConfirm={async () => {
            await removeDay(confirmDeleteDay.id);
            setConfirmDeleteDay(null);
          }}
          onClose={() => setConfirmDeleteDay(null)}
        />
      )}

      {confirmDeleteProgram && program.data && (
        <ConfirmSheet
          title={`Delete "${program.data.name}"?`}
          body="Days and exercises are removed. Logged workout history is kept (sessions will show 'Deleted day')."
          confirmLabel="Delete program"
          onConfirm={async () => {
            await db.from("programs").delete().eq("id", programId);
            router.replace("/programs");
          }}
          onClose={() => setConfirmDeleteProgram(false)}
        />
      )}
    </main>
  );
}
