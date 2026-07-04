"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Copy, Pencil, Play, Plus, Timer, Trash2 } from "lucide-react";
import { type TCircuitSpecV1 } from "@gym-planner/core/schemas";
import { createClient } from "../../../lib/supabase/client";
import { useQuery } from "../../../lib/useQuery";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { SkeletonCard } from "../../../components/Skeleton";
import { CircuitBuilder } from "../../../components/CircuitBuilder";
import { ConfirmSheet } from "../../../components/ConfirmSheet";

type CircuitRow = {
  id: string;
  name: string;
  duration_min: number;
  rotations: number;
  partner_mode: boolean;
  spec: TCircuitSpecV1;
};

export default function CircuitsPage() {
  const db = useMemo(() => createClient(), []);
  const circuits = useQuery(async () => {
    const { data, error } = await db
      .from("circuit_workouts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as CircuitRow[];
  }, []);

  const [building, setBuilding] = useState(false);
  const [editing, setEditing] = useState<CircuitRow | null>(null);
  const [deleting, setDeleting] = useState<CircuitRow | null>(null);

  async function duplicate(c: CircuitRow) {
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return;
    await db.from("circuit_workouts").insert({
      user_id: user.id,
      name: `${c.name} (copy)`,
      source: "manual",
      duration_min: c.duration_min,
      rotations: c.rotations,
      partner_mode: c.partner_mode,
      schema_version: 1,
      spec: c.spec,
    });
    circuits.refetch();
  }

  if (building || editing) {
    return (
      <CircuitBuilder
        initial={editing ?? undefined}
        onDone={() => {
          setBuilding(false);
          setEditing(null);
          circuits.refetch();
        }}
        onCancel={() => {
          setBuilding(false);
          setEditing(null);
        }}
      />
    );
  }

  return (
    <main className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl tracking-tight">Circuits</h1>
        <Button variant="primary" onClick={() => setBuilding(true)}>
          <Plus className="h-4 w-4" />
          New
        </Button>
      </header>

      <p className="text-xs text-faint">
        FitFactory-style station circuits. AI generation lands in v0.5 — for
        now, build them by hand and the player does the timing.
      </p>

      {circuits.loading && <SkeletonCard lines={2} />}

      <ul className="flex flex-col gap-3">
        {(circuits.data ?? []).map((c) => (
          <li key={c.id}>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{c.name}</p>
                  <p className="text-xs text-faint">
                    {c.spec.stations.length} stations · {c.rotations} rounds ·
                    ~{c.duration_min} min{c.partner_mode ? " · partner" : ""}
                  </p>
                </div>
                <Link href={`/circuits/${c.id}/play`} className="shrink-0">
                  <Button variant="primary">
                    <Play className="h-4 w-4" />
                    Play
                  </Button>
                </Link>
              </div>
              <div className="mt-3 flex gap-1 border-t border-line pt-3">
                <button
                  type="button"
                  aria-label={`edit ${c.name}`}
                  className="flex h-9 items-center gap-1.5 rounded-lg bg-surface-2 px-3 text-xs text-muted"
                  onClick={() => setEditing(c)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  type="button"
                  aria-label={`duplicate ${c.name}`}
                  className="flex h-9 items-center gap-1.5 rounded-lg bg-surface-2 px-3 text-xs text-muted"
                  onClick={() => duplicate(c)}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Duplicate
                </button>
                <button
                  type="button"
                  aria-label={`delete ${c.name}`}
                  className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-danger"
                  onClick={() => setDeleting(c)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          </li>
        ))}
        {circuits.data?.length === 0 && (
          <li className="flex flex-col items-center gap-3 rounded-card border border-line p-8 text-center">
            <Timer className="h-8 w-8 text-faint" />
            <p className="text-sm text-muted">
              No circuits yet — hit New to build your first one.
            </p>
          </li>
        )}
      </ul>

      {deleting && (
        <ConfirmSheet
          title={`Delete "${deleting.name}"?`}
          body="Logged circuit sessions are kept."
          confirmLabel="Delete circuit"
          onConfirm={async () => {
            await db.from("circuit_workouts").delete().eq("id", deleting.id);
            setDeleting(null);
            circuits.refetch();
          }}
          onClose={() => setDeleting(null)}
        />
      )}
    </main>
  );
}
