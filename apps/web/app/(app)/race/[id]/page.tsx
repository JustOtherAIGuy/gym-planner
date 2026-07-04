"use client";

import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  formatHMS,
  HYROX_LEGS,
  ladderTier,
  sumSplits,
} from "@gym-planner/core/hyrox";
import { createClient } from "../../../../lib/supabase/client";
import { useQuery } from "../../../../lib/useQuery";
import { deleteRace, fetchRaces, upsertRaceSplits } from "../../../../lib/data";
import { Button } from "../../../../components/Button";
import { Card, CardLabel } from "../../../../components/Card";
import { ConfirmSheet } from "../../../../components/ConfirmSheet";
import { DurationInput } from "../../../../components/DurationInput";
import { PageHeader } from "../../../../components/PageHeader";
import { RaceFormSheet } from "../../../../components/RaceFormSheet";
import { SkeletonCard } from "../../../../components/Skeleton";

export default function RaceDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: raceId } = use(params);
  const db = useMemo(() => createClient(), []);
  const router = useRouter();

  const races = useQuery(() => fetchRaces(db), []);
  const race = races.data?.find((r) => r.id === raceId);

  const [entering, setEntering] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [finishSec, setFinishSec] = useState(0);
  const [roxzoneSec, setRoxzoneSec] = useState(0);
  const [splits, setSplits] = useState<number[]>(
    Array(HYROX_LEGS.length).fill(0),
  );
  const [saving, setSaving] = useState(false);

  /** (Re)seed the form from the saved result — initial load AND cancel. */
  const resetFromRace = useCallback(() => {
    if (!race) return;
    setFinishSec(race.finish_sec ?? 0);
    setRoxzoneSec(race.roxzone_sec ?? 0);
    const next = Array<number>(HYROX_LEGS.length).fill(0);
    for (const s of race.race_splits) {
      if (s.leg_index < next.length) next[s.leg_index] = s.duration_sec;
    }
    setSplits(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [race?.id, race?.finish_sec, race?.roxzone_sec]);

  useEffect(() => {
    resetFromRace();
  }, [resetFromRace]);

  const splitsTotal =
    sumSplits(splits.filter((s) => s > 0).map((duration_sec) => ({ duration_sec }))) +
    roxzoneSec;
  const mismatch =
    finishSec > 0 && splitsTotal > 0
      ? splitsTotal - finishSec
      : null;

  async function save() {
    if (!race || finishSec <= 0) return;
    setSaving(true);
    await db
      .from("races")
      .update({
        finish_sec: finishSec,
        roxzone_sec: roxzoneSec > 0 ? roxzoneSec : null,
        status: "completed",
      })
      .eq("id", race.id);
    const filled = HYROX_LEGS.filter((leg) => splits[leg.leg_index]! > 0).map(
      (leg) => ({
        leg_index: leg.leg_index,
        kind: leg.kind,
        label: leg.label,
        duration_sec: splits[leg.leg_index]!,
        load_kg: null,
      }),
    );
    if (filled.length > 0) await upsertRaceSplits(db, race.id, filled);
    setSaving(false);
    setEntering(false);
    races.refetch();
    router.push("/race");
  }

  const tier = finishSec > 0 ? ladderTier(finishSec) : null;

  return (
    <main className="flex flex-col gap-4">
      <PageHeader
        title={race?.name ?? "Race"}
        backHref="/race"
        right={
          race ? (
            <button
              type="button"
              aria-label="Edit race"
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2 text-muted"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-4 w-4" />
            </button>
          ) : undefined
        }
      />

      {!race ? (
        <SkeletonCard lines={4} />
      ) : (
        <>
          <Card>
            <div className="flex items-center justify-between">
              <CardLabel>
                {new Date(`${race.event_date}T00:00:00`).toLocaleDateString(
                  undefined,
                  { month: "long", day: "numeric", year: "numeric" },
                )}{" "}
                · {race.division}
              </CardLabel>
              <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[10px] font-bold uppercase text-muted">
                {race.status}
              </span>
            </div>
            {race.note && (
              <p className="mt-2 text-sm text-muted">{race.note}</p>
            )}
            {race.finish_sec ? (
              <>
                <p className="mt-3">
                  <span className="font-display text-[40px] leading-none text-accent">
                    {formatHMS(race.finish_sec)}
                  </span>
                  <span className="ml-2 text-xs text-faint">
                    {ladderTier(race.finish_sec).label}
                  </span>
                </p>
                {!entering && (
                  <Button
                    className="mt-4 w-full"
                    onClick={() => setEntering(true)}
                  >
                    Edit result
                  </Button>
                )}
              </>
            ) : !entering ? (
              <Button
                variant="primary"
                size="lg"
                className="mt-4 w-full"
                onClick={() => setEntering(true)}
              >
                Log race result
              </Button>
            ) : null}
          </Card>

          {entering && (
            <Card>
              <CardLabel>Result</CardLabel>
              <div className="mt-3 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Finish time</span>
                  <DurationInput
                    valueSec={finishSec}
                    onChange={setFinishSec}
                    stepSec={60}
                    ariaLabel="finish time"
                  />
                </div>
                {tier && (
                  <p className="text-right text-xs font-bold text-accent">
                    {tier.label}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">
                    Roxzone (transitions)
                  </span>
                  <DurationInput
                    valueSec={roxzoneSec}
                    onChange={setRoxzoneSec}
                    stepSec={30}
                    ariaLabel="roxzone time"
                  />
                </div>
              </div>

              <div className="mt-4 border-t border-line pt-3">
                <p className="text-xs font-bold uppercase tracking-wide text-faint">
                  Splits (optional)
                </p>
                <ul className="mt-2 flex flex-col gap-2">
                  {HYROX_LEGS.map((leg) => (
                    <li
                      key={leg.leg_index}
                      className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 ${
                        leg.kind === "run" ? "bg-info/5" : "bg-accent/5"
                      }`}
                    >
                      <span
                        className={`text-xs ${
                          leg.kind === "run" ? "text-info" : "text-accent"
                        }`}
                      >
                        {leg.label}
                      </span>
                      <DurationInput
                        valueSec={splits[leg.leg_index]!}
                        onChange={(v) =>
                          setSplits((prev) => {
                            const next = [...prev];
                            next[leg.leg_index] = v;
                            return next;
                          })
                        }
                        ariaLabel={`${leg.label} split`}
                      />
                    </li>
                  ))}
                </ul>
                {mismatch !== null && Math.abs(mismatch) > 60 && (
                  <p className="mt-2 text-xs text-warn">
                    Splits + roxzone sum to {formatHMS(splitsTotal)} —{" "}
                    {Math.abs(Math.round(mismatch / 60))} min{" "}
                    {mismatch > 0 ? "over" : "under"} the finish time.
                  </p>
                )}
              </div>

              <Button
                variant="primary"
                size="lg"
                className="mt-4 w-full"
                disabled={saving || finishSec <= 0}
                onClick={save}
              >
                Save result
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="mt-2 w-full"
                onClick={() => {
                  resetFromRace();
                  setEntering(false);
                }}
              >
                Cancel
              </Button>
            </Card>
          )}

          <Button
            variant="ghost"
            className="w-full text-danger"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete race
          </Button>
        </>
      )}

      {editing && race && (
        <RaceFormSheet
          initial={race}
          onSaved={() => races.refetch()}
          onClose={() => setEditing(false)}
        />
      )}

      {confirmDelete && race && (
        <ConfirmSheet
          title={`Delete "${race.name}"?`}
          body="Splits and result are removed."
          confirmLabel="Delete race"
          onConfirm={async () => {
            await deleteRace(db, race.id);
            router.replace("/race");
          }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </main>
  );
}
