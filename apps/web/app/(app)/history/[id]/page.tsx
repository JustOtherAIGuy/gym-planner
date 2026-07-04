"use client";

import { useRouter } from "next/navigation";
import { use, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { formatMS, formatPace, paceSecPerKm } from "@gym-planner/core/hyrox";
import { createClient } from "../../../../lib/supabase/client";
import { useQuery } from "../../../../lib/useQuery";
import { discardSession, fetchSessionDetail } from "../../../../lib/data";
import { Button } from "../../../../components/Button";
import { Card, CardLabel } from "../../../../components/Card";
import { ConfirmSheet } from "../../../../components/ConfirmSheet";
import { PageHeader } from "../../../../components/PageHeader";
import { SkeletonCard } from "../../../../components/Skeleton";
import { MovementChip } from "../../../../components/pictograms/MovementChip";

function DeleteLogButton({ onDelete }: { onDelete: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      aria-label="Delete entry"
      disabled={busy}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-faint active:bg-surface-2 disabled:opacity-40"
      onClick={async () => {
        setBusy(true);
        await onDelete();
      }}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

export default function HistoryDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: sessionId } = use(params);
  const db = useMemo(() => createClient(), []);
  const router = useRouter();
  const detail = useQuery(() => fetchSessionDetail(db, sessionId), [sessionId]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const d = detail.data;

  // Group strength sets by exercise, preserving order.
  const setGroups = useMemo(() => {
    if (!d) return [];
    const order: string[] = [];
    const byName = new Map<string, typeof d.sets>();
    for (const s of d.sets) {
      const name = s.exercises.name;
      if (!byName.has(name)) {
        byName.set(name, []);
        order.push(name);
      }
      byName.get(name)!.push(s);
    }
    return order.map((name) => ({
      name,
      slug: byName.get(name)![0]!.exercises.slug,
      sets: byName.get(name)!,
    }));
  }, [d]);

  const started = d ? new Date(d.session.started_at) : null;
  const mins =
    d?.session.ended_at && started
      ? Math.max(
          1,
          Math.round(
            (Date.parse(d.session.ended_at) - started.getTime()) / 60000,
          ),
        )
      : null;

  return (
    <main className="flex flex-col gap-4">
      <PageHeader
        title={d?.sourceName ?? "Workout"}
        backHref="/progress"
      />
      {started && (
        <p className="-mt-2 text-xs text-faint">
          {started.toLocaleDateString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
          {mins !== null ? ` · ${mins} min` : ""}
        </p>
      )}

      {!d ? (
        <SkeletonCard lines={4} />
      ) : (
        <>
          {setGroups.map((g) => (
            <Card key={g.name} className="p-4">
              <div className="flex items-center gap-2">
                <MovementChip slug={g.slug} />
                <CardLabel>{g.name}</CardLabel>
              </div>
              <ul className="mt-2 flex flex-col">
                {g.sets.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-2 border-t border-line py-2 first:border-t-0"
                  >
                    <span className="w-5 text-center text-xs text-faint">
                      {s.set_index + 1}
                    </span>
                    <span className="flex-1 text-sm tabular-nums">
                      {Number(s.weight_kg)} kg × {s.reps}
                    </span>
                    <DeleteLogButton
                      onDelete={async () => {
                        await db.from("set_logs").delete().eq("id", s.id);
                        detail.refetch();
                      }}
                    />
                  </li>
                ))}
              </ul>
            </Card>
          ))}

          {d.cardio.length > 0 && (
            <Card className="p-4">
              <CardLabel>Cardio &amp; stations</CardLabel>
              <ul className="mt-2 flex flex-col">
                {d.cardio.map((c) => {
                  const pace = formatPace(
                    paceSecPerKm(c.distance_m, c.duration_sec),
                  );
                  const bits = [
                    c.exercises?.name ?? c.kind,
                    c.distance_m
                      ? c.distance_m >= 1000
                        ? `${(c.distance_m / 1000).toFixed(1)} km`
                        : `${c.distance_m} m`
                      : null,
                    c.duration_sec ? formatMS(c.duration_sec) : null,
                    pace !== "–" ? `${pace}/km` : null,
                    c.load_kg != null ? `${Number(c.load_kg)} kg` : null,
                  ].filter(Boolean);
                  return (
                    <li
                      key={c.id}
                      className="flex items-center gap-2 border-t border-line py-2 first:border-t-0"
                    >
                      <MovementChip
                        kind={c.kind}
                        modality={
                          c.kind === "run" || c.kind === "row" || c.kind === "ski"
                            ? "cardio"
                            : "station"
                        }
                      />
                      <span className="flex-1 text-sm tabular-nums">
                        {bits.join(" · ")}
                      </span>
                      <DeleteLogButton
                        onDelete={async () => {
                          await db.from("cardio_logs").delete().eq("id", c.id);
                          detail.refetch();
                        }}
                      />
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {d.stations.length > 0 && (
            <Card className="p-4">
              <CardLabel>Circuit stations</CardLabel>
              <ul className="mt-2 flex flex-col">
                {d.stations.map((st) => (
                  <li
                    key={st.id}
                    className="flex items-center gap-2 border-t border-line py-2 first:border-t-0"
                  >
                    <span className="w-8 text-xs text-faint">
                      R{st.rotation_index + 1}
                    </span>
                    <MovementChip label={st.exercise_label} modality="station" />
                    <span className="flex-1 text-sm">
                      {st.exercise_label}
                      <span className="text-faint">
                        {st.reps != null ? ` · ${st.reps} reps` : ""}
                        {st.weight_kg != null
                          ? ` · ${Number(st.weight_kg)} kg`
                          : ""}
                        {st.duration_sec != null
                          ? ` · ${formatMS(st.duration_sec)}`
                          : ""}
                      </span>
                    </span>
                    <DeleteLogButton
                      onDelete={async () => {
                        await db
                          .from("circuit_station_logs")
                          .delete()
                          .eq("id", st.id);
                        detail.refetch();
                      }}
                    />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {setGroups.length === 0 &&
            d.cardio.length === 0 &&
            d.stations.length === 0 && (
              <p className="rounded-card border border-line p-8 text-center text-sm text-muted">
                Nothing was logged in this workout.
              </p>
            )}

          <Button
            variant="ghost"
            className="w-full text-danger"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete workout
          </Button>
        </>
      )}

      {confirmDelete && (
        <ConfirmSheet
          title="Delete this workout?"
          body="All its sets and efforts are deleted. This can't be undone."
          confirmLabel="Delete workout"
          onConfirm={async () => {
            await discardSession(db, sessionId);
            router.replace("/progress");
          }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </main>
  );
}
