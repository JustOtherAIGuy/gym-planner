"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { CircuitSpecV1, type TCircuitSpecV1 } from "@gym-planner/core/schemas";
import { createClient } from "../lib/supabase/client";
import { NumberStepper } from "./NumberStepper";
import { Button } from "./Button";
import { Card } from "./Card";
import { PageHeader } from "./PageHeader";

type StationDraft = {
  label: string;
  mode: "timed" | "reps";
  work_sec: number;
  rest_sec: number;
  reps: number;
  load_hint_kg: number;
};

const DEFAULT_STATION: StationDraft = {
  label: "",
  mode: "timed",
  work_sec: 40,
  rest_sec: 20,
  reps: 12,
  load_hint_kg: 0,
};

/** Circuit create/edit form. With `initial`, saving UPDATEs the row. */
export function CircuitBuilder({
  initial,
  onDone,
  onCancel,
}: {
  initial?: { id: string; name: string; spec: TCircuitSpecV1 };
  onDone: () => void;
  onCancel: () => void;
}) {
  const db = useMemo(() => createClient(), []);
  const [name, setName] = useState(initial?.name ?? "");
  const [rotations, setRotations] = useState(initial?.spec.rotations ?? 4);
  const [transition, setTransition] = useState(
    initial?.spec.transition_sec ?? 15,
  );
  const [partner, setPartner] = useState(initial?.spec.partner_mode ?? false);
  const [stations, setStations] = useState<StationDraft[]>(
    initial
      ? initial.spec.stations.map((s) => ({
          label: s.label,
          mode: s.work_sec != null ? "timed" : "reps",
          work_sec: s.work_sec ?? 40,
          rest_sec: s.rest_sec ?? 20,
          reps: s.reps ?? 12,
          load_hint_kg: s.load_hint_kg ?? 0,
        }))
      : [{ ...DEFAULT_STATION, label: "Station 1" }],
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  function updateStation(i: number, patch: Partial<StationDraft>) {
    setStations((s) => s.map((st, j) => (j === i ? { ...st, ...patch } : st)));
  }

  async function save() {
    setSaveError(null);
    const perStationSec =
      stations.reduce(
        (acc, s) => acc + (s.mode === "timed" ? s.work_sec + s.rest_sec : 60),
        0,
      ) + transition * stations.length;
    const durationMin = Math.max(
      1,
      Math.round((perStationSec * rotations) / 60),
    );

    const spec = {
      version: 1 as const,
      duration_min: durationMin,
      rotations,
      transition_sec: transition,
      partner_mode: partner,
      stations: stations.map((s, i) => ({
        index: i,
        label: s.label || `Station ${i + 1}`,
        exercise_slug: null,
        work_sec: s.mode === "timed" ? s.work_sec : null,
        rest_sec: s.mode === "timed" ? s.rest_sec : null,
        reps: s.mode === "reps" ? s.reps : null,
        load_hint_kg: s.load_hint_kg > 0 ? s.load_hint_kg : null,
        partner_role: null,
      })),
    };

    const parsed = CircuitSpecV1.safeParse(spec);
    if (!parsed.success) {
      setSaveError(parsed.error.issues[0]?.message ?? "Invalid circuit");
      return;
    }

    const row = {
      name: name.trim() || "Untitled circuit",
      duration_min: durationMin,
      rotations,
      partner_mode: partner,
      spec: parsed.data,
    };

    let error: { message: string } | null;
    if (initial) {
      ({ error } = await db
        .from("circuit_workouts")
        .update(row)
        .eq("id", initial.id));
    } else {
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!user) return;
      ({ error } = await db.from("circuit_workouts").insert({
        user_id: user.id,
        source: "manual",
        schema_version: 1,
        ...row,
      }));
    }
    if (error) {
      setSaveError(error.message);
      return;
    }
    onDone();
  }

  return (
    <main className="flex flex-col gap-5">
      <PageHeader
        title={initial ? "Edit circuit" : "New circuit"}
        backHref="/circuits"
        right={
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        }
      />

      <input
        type="text"
        placeholder="Circuit name (e.g. FitFactory Friday)"
        className="h-12 rounded-xl bg-surface-2 px-4 outline-none placeholder:text-faint"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-muted">
        <label className="flex items-center gap-2">
          rotations
          <NumberStepper
            value={rotations}
            min={1}
            max={20}
            onChange={setRotations}
            ariaLabel="rotations"
          />
        </label>
        <label className="flex items-center gap-2">
          transition
          <NumberStepper
            value={transition}
            min={0}
            max={120}
            step={5}
            suffix="s"
            onChange={setTransition}
            ariaLabel="transition seconds"
          />
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={partner}
            onChange={(e) => setPartner(e.target.checked)}
            className="h-5 w-5 accent-[#bfff38]"
          />
          partner mode
        </label>
      </div>

      {stations.map((s, i) => (
        <Card key={i} className="p-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder={`Station ${i + 1} (e.g. KB Swings)`}
              className="h-11 flex-1 rounded-lg bg-surface-2 px-3 outline-none placeholder:text-faint"
              value={s.label}
              onChange={(e) => updateStation(i, { label: e.target.value })}
            />
            <button
              type="button"
              aria-label="Remove station"
              className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-2 text-danger"
              onClick={() => setStations((st) => st.filter((_, j) => j !== i))}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex gap-1 rounded-lg bg-surface-2 p-0.5 text-xs">
            {(["timed", "reps"] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={`flex-1 rounded-md px-3 py-2 font-medium transition-colors duration-100 ${
                  s.mode === m ? "bg-accent text-black" : "text-faint"
                }`}
                onClick={() => updateStation(i, { mode: m })}
              >
                {m === "timed" ? "Work / Rest" : "Rep target"}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-faint">
            {s.mode === "timed" ? (
              <>
                <label className="flex items-center gap-2">
                  work
                  <NumberStepper
                    value={s.work_sec}
                    min={5}
                    max={600}
                    step={5}
                    suffix="s"
                    onChange={(v) => updateStation(i, { work_sec: v })}
                    ariaLabel={`station ${i + 1} work seconds`}
                  />
                </label>
                <label className="flex items-center gap-2">
                  rest
                  <NumberStepper
                    value={s.rest_sec}
                    min={0}
                    max={600}
                    step={5}
                    suffix="s"
                    onChange={(v) => updateStation(i, { rest_sec: v })}
                    ariaLabel={`station ${i + 1} rest seconds`}
                  />
                </label>
              </>
            ) : (
              <label className="flex items-center gap-2">
                reps
                <NumberStepper
                  value={s.reps}
                  min={1}
                  max={100}
                  onChange={(v) => updateStation(i, { reps: v })}
                  ariaLabel={`station ${i + 1} reps`}
                />
              </label>
            )}
            <label className="flex items-center gap-2">
              load
              <NumberStepper
                value={s.load_hint_kg}
                min={0}
                max={200}
                step={2.5}
                suffix="kg"
                onChange={(v) => updateStation(i, { load_hint_kg: v })}
                ariaLabel={`station ${i + 1} load`}
              />
            </label>
          </div>
        </Card>
      ))}

      <Button onClick={() => setStations((s) => [...s, { ...DEFAULT_STATION }])}>
        <Plus className="h-4 w-4" />
        Add station
      </Button>

      {saveError && <p className="text-sm text-danger">{saveError}</p>}

      <Button variant="primary" size="lg" onClick={save}>
        Save circuit
      </Button>
    </main>
  );
}
