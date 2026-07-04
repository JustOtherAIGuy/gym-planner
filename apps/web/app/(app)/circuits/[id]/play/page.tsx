"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, SkipForward, X } from "lucide-react";
import type { TCircuitSpecV1 } from "@gym-planner/core/schemas";
import { createClient } from "../../../../../lib/supabase/client";
import { useQuery } from "../../../../../lib/useQuery";
import { useWakeLock } from "../../../../../lib/useWakeLock";
import { NumberStepper } from "../../../../../components/NumberStepper";
import { Button } from "../../../../../components/Button";
import { ConfirmSheet } from "../../../../../components/ConfirmSheet";

type Phase =
  | { kind: "idle" }
  | { kind: "work"; station: number; rotation: number; left: number }
  | { kind: "rest"; station: number; rotation: number; left: number }
  | { kind: "transition"; station: number; rotation: number; left: number }
  | { kind: "done" };

export default function CircuitPlayer({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: circuitId } = use(params);
  const db = useMemo(() => createClient(), []);
  const router = useRouter();
  useWakeLock();

  const circuit = useQuery(async () => {
    const { data, error } = await db
      .from("circuit_workouts")
      .select("*")
      .eq("id", circuitId)
      .single();
    if (error) throw error;
    return data as { id: string; name: string; spec: TCircuitSpecV1 };
  }, [circuitId]);

  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [paused, setPaused] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const spec = circuit.data?.spec;

  // One ticking interval drives the whole state machine.
  useEffect(() => {
    if (!spec || paused) return;
    const id = setInterval(() => {
      const p = phaseRef.current;
      if (p.kind === "idle" || p.kind === "done") return;
      if (p.left > 1) {
        setPhase({ ...p, left: p.left - 1 });
        return;
      }
      setPhase(nextPhase(p, spec));
    }, 1000);
    return () => clearInterval(id);
  }, [spec, paused]);

  function nextPhase(
    p: Exclude<Phase, { kind: "idle" | "done" }>,
    s: TCircuitSpecV1,
  ): Phase {
    const station = s.stations[p.station]!;
    if (p.kind === "work" && (station.rest_sec ?? 0) > 0) {
      return {
        kind: "rest",
        station: p.station,
        rotation: p.rotation,
        left: station.rest_sec!,
      };
    }
    // Advance to the next station (or rotation, or finish).
    const lastStation = p.station === s.stations.length - 1;
    const lastRotation = p.rotation === s.rotations - 1;
    if (lastStation && lastRotation) return { kind: "done" };
    const nStation = lastStation ? 0 : p.station + 1;
    const nRotation = lastStation ? p.rotation + 1 : p.rotation;
    if (s.transition_sec > 0) {
      return {
        kind: "transition",
        station: nStation,
        rotation: nRotation,
        left: s.transition_sec,
      };
    }
    return startStation(nStation, nRotation, s);
  }

  function startStation(
    station: number,
    rotation: number,
    s: TCircuitSpecV1,
  ): Phase {
    const st = s.stations[station]!;
    // Rep-based stations get a nominal 60s window; user skips ahead when done.
    return {
      kind: "work",
      station,
      rotation,
      left: st.work_sec ?? 60,
    };
  }

  function skip() {
    if (!spec) return;
    const p = phaseRef.current;
    if (p.kind === "idle" || p.kind === "done") return;
    if (p.kind === "transition") {
      setPhase(startStation(p.station, p.rotation, spec));
    } else {
      // work → rest (or next station); rest → next station.
      setPhase(nextPhase(p, spec));
    }
  }

  if (!circuit.data || !spec) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-faint">{circuit.error ?? "Loading…"}</p>
      </main>
    );
  }

  if (phase.kind === "done") {
    return (
      <ConfirmLog
        circuit={circuit.data}
        onSaved={() => router.push("/circuits")}
      />
    );
  }

  if (phase.kind === "idle") {
    return (
      <main className="flex min-h-dvh flex-col justify-center gap-6 px-6 pb-24">
        <h1 className="font-display text-3xl tracking-tight">
          {circuit.data.name}
        </h1>
        <ul className="flex flex-col gap-2 text-sm text-muted">
          {spec.stations.map((s) => (
            <li key={s.index} className="flex justify-between">
              <span>{s.label}</span>
              <span className="tabular-nums text-faint">
                {s.work_sec
                  ? `${s.work_sec}s on / ${s.rest_sec ?? 0}s off`
                  : `${s.reps} reps`}
                {s.load_hint_kg ? ` · ${s.load_hint_kg}kg` : ""}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-faint">
          {spec.rotations} rotations · {spec.transition_sec}s transitions
        </p>
        <Button
          variant="primary"
          size="lg"
          className="h-16 text-2xl"
          onClick={() => setPhase(startStation(0, 0, spec))}
        >
          START
        </Button>
      </main>
    );
  }

  const station = spec.stations[phase.station]!;
  const isWork = phase.kind === "work";
  const nextIdx = (phase.station + 1) % spec.stations.length;
  const next = spec.stations[nextIdx]!;

  const bg =
    phase.kind === "work"
      ? "bg-[#101d03]"
      : phase.kind === "rest"
        ? "bg-[#241705]"
        : "bg-[#081527]";
  const label =
    phase.kind === "work"
      ? "WORK"
      : phase.kind === "rest"
        ? "REST"
        : "MOVE TO";

  return (
    <main
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 ${bg} px-6 transition-colors duration-500`}
    >
      {/* Exit — standalone PWAs have no system back. Mid-circuit exits pause
          the clock and confirm, since nothing is saved until ConfirmLog. */}
      <button
        type="button"
        aria-label="Exit circuit"
        className="absolute left-4 z-10 flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-muted"
        style={{ top: "max(env(safe-area-inset-top), 1rem)" }}
        onClick={() => {
          setPaused(true);
          setConfirmExit(true);
        }}
      >
        <X className="h-5 w-5" />
      </button>

      {confirmExit && (
        <ConfirmSheet
          title="Leave circuit?"
          body="Progress isn't saved."
          confirmLabel="Leave"
          cancelLabel="Keep going"
          onConfirm={() => router.push("/circuits")}
          onClose={() => {
            setConfirmExit(false);
            setPaused(false);
          }}
        />
      )}

      {/* Round dots */}
      <div className="absolute inset-x-0 flex justify-center gap-1.5"
        style={{ top: "max(env(safe-area-inset-top), 1.25rem)" }}
      >
        {Array.from({ length: spec.rotations }, (_, r) => (
          <span
            key={r}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              r < phase.rotation
                ? "w-4 bg-accent"
                : r === phase.rotation
                  ? "w-6 bg-accent shadow-glow-sm"
                  : "w-4 bg-white/15"
            }`}
          />
        ))}
      </div>

      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-muted">
        Round {phase.rotation + 1}/{spec.rotations} · {label}
      </p>

      <h1 className="text-center font-display text-5xl leading-tight tracking-tight">
        {station.label}
      </h1>
      {station.load_hint_kg ? (
        <p className="text-2xl font-bold text-warn">
          {station.load_hint_kg} kg
        </p>
      ) : null}
      {!station.work_sec && isWork ? (
        <p className="text-2xl font-bold">{station.reps} reps</p>
      ) : null}

      <p
        className={`font-display leading-none tabular-nums ${
          phase.left <= 5 ? "text-warn" : ""
        }`}
        style={{ fontSize: "9rem" }}
      >
        {phase.left}
      </p>

      <p className="text-sm text-muted">
        next: {phase.kind === "transition" ? station.label : next.label}
      </p>

      <div className="mt-4 flex gap-3">
        <Button size="lg" onClick={() => setPaused((p) => !p)}>
          {paused ? (
            <Play className="h-5 w-5" />
          ) : (
            <Pause className="h-5 w-5" />
          )}
          {paused ? "Resume" : "Pause"}
        </Button>
        <Button size="lg" onClick={skip}>
          <SkipForward className="h-5 w-5" />
          Skip
        </Button>
      </div>
    </main>
  );
}

/** 15-second post-workout log: confirm loads/rounds, one tap to save. */
function ConfirmLog({
  circuit,
  onSaved,
}: {
  circuit: { id: string; name: string; spec: TCircuitSpecV1 };
  onSaved: () => void;
}) {
  const db = useMemo(() => createClient(), []);
  const [rounds, setRounds] = useState(circuit.spec.rotations);
  const [loads, setLoads] = useState<number[]>(
    circuit.spec.stations.map((s) => s.load_hint_kg ?? 0),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const router = useRouter();

  async function save() {
    setSaving(true);
    setError(null);
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return;
    const { data: session, error: e1 } = await db
      .from("workout_sessions")
      .insert({
        user_id: user.id,
        source_type: "circuit",
        source_id: circuit.id,
        ended_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (e1 || !session) {
      setError(e1?.message ?? "Could not save session");
      setSaving(false);
      return;
    }
    const rows = [];
    for (let r = 0; r < rounds; r++) {
      for (const s of circuit.spec.stations) {
        rows.push({
          session_id: session.id,
          station_index: s.index,
          rotation_index: r,
          exercise_label: s.label,
          reps: s.reps,
          weight_kg: loads[s.index] || null,
          duration_sec: s.work_sec,
          partner_role: s.partner_role,
        });
      }
    }
    const { error: e2 } = await db.from("circuit_station_logs").insert(rows);
    if (e2) {
      setError(e2.message);
      setSaving(false);
      return;
    }
    onSaved();
  }

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 overflow-hidden px-6 pb-24">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-accent/15 blur-[100px]"
      />
      <h1 className="relative font-display text-4xl tracking-tight">
        Done <span className="text-accent">💪</span>
      </h1>
      <p className="text-sm text-muted">
        Confirm what you actually did — pre-filled from the plan.
      </p>

      <label className="flex items-center justify-between text-sm">
        Rounds completed
        <NumberStepper
          value={rounds}
          min={0}
          max={circuit.spec.rotations}
          onChange={setRounds}
          ariaLabel="rounds completed"
        />
      </label>

      {circuit.spec.stations.map((s) => (
        <label
          key={s.index}
          className="flex items-center justify-between text-sm"
        >
          {s.label}
          <NumberStepper
            value={loads[s.index] ?? 0}
            min={0}
            max={300}
            step={2.5}
            suffix="kg"
            onChange={(v) =>
              setLoads((l) => l.map((x, i) => (i === s.index ? v : x)))
            }
            ariaLabel={`${s.label} load`}
          />
        </label>
      ))}

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button
        variant="primary"
        size="lg"
        className="h-14 text-lg"
        disabled={saving}
        onClick={save}
      >
        Save workout
      </Button>
      <Button
        variant="ghost"
        className="w-full text-danger"
        onClick={() => setConfirmDiscard(true)}
      >
        Discard workout
      </Button>

      {confirmDiscard && (
        <ConfirmSheet
          title="Exit without saving?"
          body="You'll lose this circuit's log."
          confirmLabel="Discard"
          onConfirm={() => router.push("/circuits")}
          onClose={() => setConfirmDiscard(false)}
        />
      )}
    </main>
  );
}
