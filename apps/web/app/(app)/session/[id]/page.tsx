"use client";

import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { formatPace, paceSecPerKm } from "@gym-planner/core/hyrox";
import type { TCardioKind, TCardioStyle } from "@gym-planner/core/schemas";
import { createClient } from "../../../../lib/supabase/client";
import { useQuery } from "../../../../lib/useQuery";
import {
  discardSession,
  fetchForecasts,
  fetchLastSessionCardio,
  fetchLastSessionSets,
  fetchProgramDays,
  prescribeToday,
} from "../../../../lib/data";
import {
  appendBuffered,
  clearBuffer,
  legacyBufferKey,
  readBuffer,
  removeBuffered,
  writeBuffer,
  type PendingRecord,
  type PendingSet,
} from "../../../../lib/sessionBuffer";
import { useWakeLock } from "../../../../lib/useWakeLock";
import { NumberStepper } from "../../../../components/NumberStepper";
import { DurationInput } from "../../../../components/DurationInput";
import { RestTimer } from "../../../../components/RestTimer";
import { Button } from "../../../../components/Button";
import { Card } from "../../../../components/Card";
import { SkeletonCard } from "../../../../components/Skeleton";
import { PageHeader } from "../../../../components/PageHeader";
import { ConfirmSheet } from "../../../../components/ConfirmSheet";

type Row = {
  key: string;
  exerciseId: string;
  exerciseName: string;
  orderIndex: number;
  setIndex: number;
  modality: "strength" | "cardio" | "station";
  kind: TCardioKind | null;
  style: TCardioStyle | null;
  notes: string | null;
  // strength fields
  reps: number;
  weightKg: number;
  // cardio/station fields
  distanceM: number;
  durationSec: number;
  loadKg: number;
  done: boolean;
  /** id of the inserted log row (online completes) — enables undo */
  logId: string | null;
  /** buffer clientKey (offline completes) — enables undo before flush */
  pendingKey: string | null;
  /** transient undo failure message */
  undoError: boolean;
};

/** exercises.slug → cardio_logs.kind (null = log as strength). */
const SLUG_TO_KIND: Record<string, TCardioKind> = {
  run: "run",
  skierg: "ski",
  "rowing-erg": "row",
  "sled-push": "sled_push",
  "sled-pull": "sled_pull",
  "burpee-broad-jump": "burpee_broad_jump",
  "farmer-carry": "farmers_carry",
  "sandbag-lunge": "sandbag_lunge",
};

function styleFromNotes(notes: string | null): TCardioStyle | null {
  if (!notes) return null;
  const n = notes.toLowerCase();
  if (n.includes("test") || n.includes("time trial")) return "test";
  if (n.includes("interval") || n.includes("repeat")) return "intervals";
  if (n.includes("run/walk") || n.includes("run-walk")) return "run_walk";
  if (n.includes("race pace") || n.includes("race-pace")) return "race_pace";
  if (n.includes("long")) return "long";
  if (n.includes("easy") || n.includes("zone 2") || n.includes("zone-2"))
    return "easy";
  return null;
}

/** First "400 m" / "6 km" style token in the prescription → meters. */
function distanceFromNotes(notes: string | null): number {
  if (!notes) return 0;
  const m = /(\d+(?:\.\d+)?)\s*(km|m)\b/i.exec(notes);
  if (!m) return 0;
  const n = Number(m[1]);
  return m[2]!.toLowerCase() === "km" ? Math.round(n * 1000) : Math.round(n);
}

export default function SessionRunner({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: sessionId } = use(params);
  const db = useMemo(() => createClient(), []);
  const router = useRouter();
  useWakeLock();

  const me = useQuery(async () => {
    const {
      data: { user },
    } = await db.auth.getUser();
    return user?.id ?? null;
  }, []);

  const session = useQuery(async () => {
    const { data, error } = await db
      .from("workout_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();
    if (error) throw error;
    return data as {
      id: string;
      source_id: string | null;
      started_at: string;
      ended_at: string | null;
    };
  }, [sessionId]);

  const day = useQuery(async () => {
    if (!session.data?.source_id) return null;
    const { data: d, error } = await db
      .from("program_days")
      .select("program_id")
      .eq("id", session.data.source_id)
      .single();
    if (error) throw error;
    const days = await fetchProgramDays(db, d.program_id);
    return days.find((x) => x.id === session.data!.source_id) ?? null;
  }, [session.data?.source_id]);

  const forecasts = useQuery(() => fetchForecasts(db), []);
  const lastSets = useQuery(
    () =>
      session.data?.source_id
        ? fetchLastSessionSets(db, session.data.source_id)
        : Promise.resolve([]),
    [session.data?.source_id],
  );
  const lastCardio = useQuery(
    () =>
      session.data?.source_id
        ? fetchLastSessionCardio(db, session.data.source_id)
        : Promise.resolve([]),
    [session.data?.source_id],
  );

  const [rows, setRows] = useState<Row[] | null>(null);
  const [resting, setResting] = useState(false);
  const [restKey, setRestKey] = useState(0);
  const [finishing, setFinishing] = useState(false);

  // Build rows once all inputs land.
  useEffect(() => {
    if (
      rows !== null ||
      !day.data ||
      !forecasts.data ||
      !lastSets.data ||
      !lastCardio.data
    )
      return;
    const built: Row[] = [];
    for (const pe of day.data.program_exercises) {
      const kind = SLUG_TO_KIND[pe.exercises.slug] ?? null;
      const modality =
        kind !== null && pe.exercises.modality !== "strength"
          ? pe.exercises.modality
          : "strength";

      if (modality === "strength") {
        // Prefill: forecast weight → last-session → 0.
        const f = forecasts.data.find(
          (x) => x.exercise_id === pe.exercise_id,
        );
        const rx = f ? prescribeToday(f, pe.target_reps_high) : null;
        const lastForExercise = lastSets.data.filter(
          (s) => s.exercise_id === pe.exercise_id && !s.is_warmup,
        );
        for (let i = 0; i < pe.target_sets; i++) {
          const last = lastForExercise[i];
          built.push({
            key: `${pe.id}-${i}`,
            exerciseId: pe.exercise_id,
            exerciseName: pe.exercises.name,
            orderIndex: pe.order_index,
            setIndex: i,
            modality: "strength",
            kind: null,
            style: null,
            notes: pe.notes,
            reps: last?.reps ?? pe.target_reps_high,
            weightKg:
              rx?.workingWeightKg ?? (last ? Number(last.weight_kg) : 0),
            distanceM: 0,
            durationSec: 0,
            loadKg: 0,
            done: false,
            logId: null,
            pendingKey: null,
            undoError: false,
          });
        }
      } else {
        // Prefill: last session's matching effort → prescription distance.
        const lastForExercise = lastCardio.data.filter(
          (c) => c.exercise_id === pe.exercise_id,
        );
        const rxDistance = distanceFromNotes(pe.notes);
        for (let i = 0; i < pe.target_sets; i++) {
          const last = lastForExercise[i];
          built.push({
            key: `${pe.id}-${i}`,
            exerciseId: pe.exercise_id,
            exerciseName: pe.exercises.name,
            orderIndex: pe.order_index,
            setIndex: i,
            modality,
            kind,
            style: styleFromNotes(pe.notes),
            notes: pe.notes,
            reps: 0,
            weightKg: 0,
            distanceM: last?.distance_m ?? rxDistance,
            durationSec: last?.duration_sec ?? 0,
            loadKg: last?.load_kg != null ? Number(last.load_kg) : 0,
            done: false,
            logId: null,
            pendingKey: null,
            undoError: false,
          });
        }
      }
    }
    setRows(built);
  }, [rows, day.data, forecasts.data, lastSets.data, lastCardio.data]);

  // Flush anything a previous dead zone left behind (v2 + legacy v1 buffers).
  const flushBuffer = useCallback(async () => {
    // One-time drain of the v1 buffer into the v2 shape.
    const legacyRaw = localStorage.getItem(legacyBufferKey(sessionId));
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as PendingSet[];
      const pending = readBuffer(sessionId);
      for (const record of legacy) pending.push({ table: "set_logs", record });
      writeBuffer(sessionId, pending);
      localStorage.removeItem(legacyBufferKey(sessionId));
    }

    const pending = readBuffer(sessionId);
    if (pending.length === 0) return;
    const sets = pending.filter((p) => p.table === "set_logs");
    const cardio = pending.filter((p) => p.table === "cardio_logs");
    if (sets.length > 0) {
      const { error } = await db
        .from("set_logs")
        .insert(sets.map((p) => p.record));
      if (error) return;
    }
    if (cardio.length > 0) {
      const { error } = await db
        .from("cardio_logs")
        .insert(cardio.map((p) => p.record));
      if (error) return;
    }
    clearBuffer(sessionId);
  }, [db, sessionId]);

  useEffect(() => {
    void flushBuffer();
  }, [flushBuffer]);

  /** Insert a log; on failure buffer it. Returns undo handles. */
  async function persist(
    entry: PendingRecord,
  ): Promise<{ logId: string | null; pendingKey: string | null }> {
    const { data, error } =
      entry.table === "set_logs"
        ? await db.from("set_logs").insert(entry.record).select("id").single()
        : await db
            .from("cardio_logs")
            .insert(entry.record)
            .select("id")
            .single();
    if (error) {
      // Dead zone in the gym: buffer locally, retry on next action/visit.
      const pendingKey = crypto.randomUUID();
      appendBuffered(sessionId, { ...entry, clientKey: pendingKey });
      return { logId: null, pendingKey };
    }
    void flushBuffer();
    return { logId: (data?.id as string) ?? null, pendingKey: null };
  }

  async function completeRow(row: Row) {
    setRows(
      (rs) =>
        rs?.map((r) => (r.key === row.key ? { ...r, done: true } : r)) ?? null,
    );
    setResting(true);
    setRestKey((k) => k + 1); // remount → timer restarts per completed set

    let handles: { logId: string | null; pendingKey: string | null } | null =
      null;
    if (row.modality === "strength") {
      handles = await persist({
        table: "set_logs",
        record: {
          session_id: sessionId,
          exercise_id: row.exerciseId,
          order_index: row.orderIndex,
          set_index: row.setIndex,
          reps: row.reps,
          weight_kg: row.weightKg,
          is_warmup: false,
          completed_at: new Date().toISOString(),
        },
      });
    } else if (row.kind && me.data) {
      handles = await persist({
        table: "cardio_logs",
        record: {
          user_id: me.data,
          session_id: sessionId,
          exercise_id: row.exerciseId,
          kind: row.kind,
          style: row.style,
          distance_m: row.distanceM > 0 ? row.distanceM : null,
          duration_sec: row.durationSec > 0 ? row.durationSec : null,
          load_kg: row.loadKg > 0 ? row.loadKg : null,
          order_index: row.orderIndex,
          set_index: row.setIndex,
          logged_at: new Date().toISOString(),
        },
      });
    }
    if (handles) {
      const { logId, pendingKey } = handles;
      setRows(
        (rs) =>
          rs?.map((r) =>
            r.key === row.key ? { ...r, logId, pendingKey } : r,
          ) ?? null,
      );
    }
  }

  /** Tap a done row's check again → delete its log and reopen the row. */
  async function undoRow(row: Row) {
    const table = row.modality === "strength" ? "set_logs" : "cardio_logs";
    let ok = false;
    if (row.pendingKey && removeBuffered(sessionId, row.pendingKey)) {
      ok = true;
    } else if (row.logId) {
      const { error } = await db.from(table).delete().eq("id", row.logId);
      ok = !error;
    } else {
      // Buffered record already flushed under us — target it by identity.
      const { error } = await db
        .from(table)
        .delete()
        .eq("session_id", sessionId)
        .eq("exercise_id", row.exerciseId)
        .eq("order_index", row.orderIndex)
        .eq("set_index", row.setIndex);
      ok = !error;
    }
    setRows(
      (rs) =>
        rs?.map((r) =>
          r.key === row.key
            ? ok
              ? {
                  ...r,
                  done: false,
                  logId: null,
                  pendingKey: null,
                  undoError: false,
                }
              : { ...r, undoError: true }
            : r,
        ) ?? null,
    );
    if (ok) setResting(false);
  }

  function updateRow(
    key: string,
    patch: Partial<
      Pick<Row, "reps" | "weightKg" | "distanceM" | "durationSec" | "loadKg">
    >,
  ) {
    setRows(
      (rs) => rs?.map((r) => (r.key === key ? { ...r, ...patch } : r)) ?? null,
    );
  }

  const [confirming, setConfirming] = useState<
    null | "discard" | "empty-finish"
  >(null);

  async function finish() {
    // Finishing with nothing logged would save an empty workout that pollutes
    // week dots and "last time" prefills — offer discard instead.
    if (rows && rows.every((r) => !r.done)) {
      setConfirming("empty-finish");
      return;
    }
    setFinishing(true);
    await flushBuffer();
    await db
      .from("workout_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", sessionId);
    router.push("/");
  }

  async function discard() {
    setFinishing(true);
    await discardSession(db, sessionId);
    router.replace("/");
  }

  const lastByExercise = useMemo(() => {
    const m = new Map<string, string>();
    if (lastSets.data) {
      for (const s of lastSets.data) {
        if (s.is_warmup) continue;
        const prev = m.get(s.exercise_id);
        const bit = `${Number(s.weight_kg)}×${s.reps}`;
        m.set(s.exercise_id, prev ? `${prev}, ${bit}` : bit);
      }
    }
    if (lastCardio.data) {
      for (const c of lastCardio.data) {
        if (!c.exercise_id || m.has(c.exercise_id)) continue;
        const pace = formatPace(paceSecPerKm(c.distance_m, c.duration_sec));
        const bits = [
          c.distance_m ? `${(c.distance_m / 1000).toFixed(1)} km` : null,
          pace !== "–" ? `${pace}/km` : null,
          c.load_kg != null ? `${Number(c.load_kg)} kg` : null,
        ].filter(Boolean);
        if (bits.length > 0) m.set(c.exercise_id, bits.join(" · "));
      }
    }
    return m;
  }, [lastSets.data, lastCardio.data]);

  const grouped = useMemo(() => {
    if (!rows) return [];
    const order: string[] = [];
    const byExercise = new Map<string, Row[]>();
    for (const r of rows) {
      if (!byExercise.has(r.exerciseId)) {
        byExercise.set(r.exerciseId, []);
        order.push(r.exerciseId);
      }
      byExercise.get(r.exerciseId)!.push(r);
    }
    return order.map((id) => byExercise.get(id)!);
  }, [rows]);

  const doneCount = rows?.filter((r) => r.done).length ?? 0;
  const total = rows?.length ?? 0;

  return (
    <main className="flex flex-col gap-4">
      {/* Sticky header: back + title + progress + finish */}
      <div className="sticky top-0 z-30 -mx-4 flex flex-col gap-3 bg-bg/90 px-4 pb-3 pt-safe backdrop-blur-xl">
        <PageHeader
          title={day.data?.name ?? "Session"}
          backHref="/"
          right={
            <Button variant="primary" disabled={finishing} onClick={finish}>
              Finish
            </Button>
          }
        />
        <div className="flex items-center gap-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent shadow-glow-sm transition-[width] duration-300"
              style={{ width: total ? `${(doneCount / total) * 100}%` : "0%" }}
            />
          </div>
          <span className="text-xs tabular-nums text-faint">
            {doneCount}/{total}
          </span>
        </div>
      </div>

      {!rows && (
        <>
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </>
      )}

      {grouped.map((sets) => {
        const first = sets[0]!;
        const last = lastByExercise.get(first.exerciseId);
        return (
          <Card key={first.exerciseId} className="p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">{first.exerciseName}</h2>
              {last && (
                <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[11px] tabular-nums text-muted">
                  last {last}
                </span>
              )}
            </div>
            {first.modality !== "strength" && first.notes && (
              <p className="mt-1 text-xs text-accent/80">{first.notes}</p>
            )}
            <ul className="mt-3 flex flex-col gap-2">
              {sets.map((row) => (
                <li
                  key={row.key}
                  className={`flex flex-col gap-2 rounded-xl p-2 transition-colors duration-150 ${
                    row.done ? "bg-accent/10 opacity-60" : "bg-surface-2/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 text-center text-xs text-faint">
                      {row.setIndex + 1}
                    </span>
                    {row.modality === "strength" ? (
                      <>
                        <NumberStepper
                          value={row.weightKg}
                          step={2.5}
                          min={0}
                          max={500}
                          suffix="kg"
                          ariaLabel={`${row.exerciseName} set ${row.setIndex + 1} weight`}
                          onChange={(v) => updateRow(row.key, { weightKg: v })}
                        />
                        <NumberStepper
                          value={row.reps}
                          step={1}
                          min={0}
                          max={50}
                          ariaLabel={`${row.exerciseName} set ${row.setIndex + 1} reps`}
                          onChange={(v) => updateRow(row.key, { reps: v })}
                        />
                      </>
                    ) : row.modality === "cardio" ? (
                      <>
                        <NumberStepper
                          value={row.distanceM}
                          step={100}
                          min={0}
                          max={42000}
                          suffix="m"
                          ariaLabel={`${row.exerciseName} rep ${row.setIndex + 1} distance`}
                          onChange={(v) => updateRow(row.key, { distanceM: v })}
                        />
                        <DurationInput
                          valueSec={row.durationSec}
                          ariaLabel={`${row.exerciseName} rep ${row.setIndex + 1} time`}
                          onChange={(v) =>
                            updateRow(row.key, { durationSec: v })
                          }
                        />
                      </>
                    ) : (
                      <>
                        <NumberStepper
                          value={row.distanceM}
                          step={5}
                          min={0}
                          max={1000}
                          suffix="m"
                          ariaLabel={`${row.exerciseName} set ${row.setIndex + 1} distance`}
                          onChange={(v) => updateRow(row.key, { distanceM: v })}
                        />
                        <NumberStepper
                          value={row.loadKg}
                          step={2.5}
                          min={0}
                          max={300}
                          suffix="kg"
                          ariaLabel={`${row.exerciseName} set ${row.setIndex + 1} load`}
                          onChange={(v) => updateRow(row.key, { loadKg: v })}
                        />
                      </>
                    )}
                    <button
                      type="button"
                      aria-label={`${row.done ? "undo" : "complete"} ${row.exerciseName} set ${row.setIndex + 1}`}
                      className={`ml-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform duration-100 active:scale-95 ${
                        row.done
                          ? "bg-transparent text-accent"
                          : "bg-accent text-black shadow-glow-sm"
                      }`}
                      onClick={() =>
                        row.done ? undoRow(row) : completeRow(row)
                      }
                    >
                      <Check
                        className={`h-6 w-6 ${row.done ? "animate-[pop-in_.18s_ease-out]" : ""}`}
                        strokeWidth={3}
                      />
                    </button>
                  </div>
                  {row.undoError && (
                    <p className="pl-7 text-xs text-danger">
                      Couldn&apos;t undo offline — try again.
                    </p>
                  )}
                  {row.modality === "cardio" &&
                    row.distanceM > 0 &&
                    row.durationSec > 0 && (
                      <p className="pl-7 text-xs tabular-nums text-faint">
                        pace{" "}
                        <span className="font-bold text-fg">
                          {formatPace(
                            paceSecPerKm(row.distanceM, row.durationSec),
                          )}
                          /km
                        </span>
                      </p>
                    )}
                </li>
              ))}
            </ul>
          </Card>
        );
      })}

      {/* Discard lives at the bottom, away from mid-set thumbs */}
      {rows && (
        <Button
          variant="ghost"
          className="w-full text-danger"
          disabled={finishing}
          onClick={() => setConfirming("discard")}
        >
          <Trash2 className="h-4 w-4" />
          Discard workout
        </Button>
      )}

      {confirming === "discard" && (
        <ConfirmSheet
          title="Discard workout?"
          body="All sets logged in this session will be deleted."
          confirmLabel="Discard workout"
          onConfirm={discard}
          onClose={() => setConfirming(null)}
        />
      )}
      {confirming === "empty-finish" && (
        <ConfirmSheet
          title="Nothing logged"
          body="Finishing now would save an empty workout — discard it instead?"
          confirmLabel="Discard workout"
          cancelLabel="Keep training"
          onConfirm={discard}
          onClose={() => setConfirming(null)}
        />
      )}

      {/* Rest ring floats in the thumb zone above the nav */}
      {resting && (
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-30 flex justify-center pb-safe">
          <RestTimer
            key={restKey}
            seconds={90}
            onDone={() => setTimeout(() => setResting(false), 4000)}
          />
        </div>
      )}
    </main>
  );
}
