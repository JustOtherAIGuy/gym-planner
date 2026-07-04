"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, Flag, MapPin, Plus } from "lucide-react";
import {
  FINISH_LADDER,
  formatHMS,
  formatMS,
  HYROX_STATION_SPECS,
  ladderTier,
} from "@gym-planner/core/hyrox";
import type { TCardioKind, TCardioLog } from "@gym-planner/core/schemas";
import { createClient } from "../../../lib/supabase/client";
import { useQuery } from "../../../lib/useQuery";
import { fetchCardioLogs, fetchRaces, todayISO } from "../../../lib/data";
import { Card, CardLabel } from "../../../components/Card";
import { SkeletonCard } from "../../../components/Skeleton";
import { Button } from "../../../components/Button";
import { RaceFormSheet } from "../../../components/RaceFormSheet";

const STATUS_STYLE: Record<string, string> = {
  waitlist: "bg-warn/15 text-warn",
  registered: "bg-accent/15 text-accent",
  backup: "bg-surface-2 text-muted",
  completed: "bg-info/15 text-info",
};

/** Best logged effort per station kind, for the benchmarks table. */
function bestEffort(logs: TCardioLog[], kind: TCardioKind): string | null {
  const rows = logs.filter((l) => l.kind === kind);
  if (rows.length === 0) return null;
  if (kind === "ski" || kind === "row") {
    // Best 1000 m time (the race distance).
    const km = rows.filter(
      (l) =>
        l.distance_m != null &&
        l.distance_m >= 950 &&
        l.distance_m <= 1100 &&
        l.duration_sec,
    );
    if (km.length === 0) return null;
    const best = Math.min(...km.map((l) => l.duration_sec!));
    return formatMS(best);
  }
  if (kind === "burpee_broad_jump") {
    const timed = rows.filter((l) => l.duration_sec);
    if (timed.length === 0) return null;
    return formatMS(Math.min(...timed.map((l) => l.duration_sec!)));
  }
  // Loaded stations: heaviest load handled.
  const loaded = rows.filter((l) => l.load_kg != null);
  if (loaded.length === 0) return null;
  return `${Math.max(...loaded.map((l) => Number(l.load_kg)))} kg`;
}

export default function RacePage() {
  const db = useMemo(() => createClient(), []);
  const races = useQuery(() => fetchRaces(db), []);
  const efforts = useQuery(() => fetchCardioLogs(db, { limit: 2000 }), []);
  const [adding, setAdding] = useState(false);

  const today = todayISO();
  const upcoming = (races.data ?? []).filter(
    (r) => r.status !== "completed" && r.event_date >= today,
  );
  const nextRace = upcoming[0];
  const daysOut = nextRace
    ? Math.max(
        0,
        Math.round(
          (Date.parse(`${nextRace.event_date}T00:00:00`) -
            Date.parse(`${today}T00:00:00`)) /
            (24 * 3600 * 1000),
        ),
      )
    : null;

  const bestFinish = (races.data ?? [])
    .filter((r) => r.status === "completed" && r.finish_sec)
    .map((r) => r.finish_sec!)
    .sort((a, b) => a - b)[0];
  const tier = bestFinish ? ladderTier(bestFinish) : null;

  return (
    <main className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl tracking-tight">Race</h1>
        <Button variant="primary" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      {races.loading ? (
        <SkeletonCard lines={4} />
      ) : (
        <>
          {/* Countdown hero */}
          {nextRace && daysOut !== null && (
            <Card glow className="relative overflow-hidden text-center">
              <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-0 h-40 w-64 -translate-x-1/2 rounded-full bg-accent/10 blur-3xl"
              />
              <CardLabel>Next race</CardLabel>
              <p className="mt-2 font-display text-[64px] leading-none text-accent">
                {daysOut}
              </p>
              <p className="text-sm text-muted">
                day{daysOut === 1 ? "" : "s"} to {nextRace.name}
              </p>
              <p className="mt-1 flex items-center justify-center gap-1 text-xs text-faint">
                <MapPin className="h-3 w-3" />
                {nextRace.location ?? "TBC"} ·{" "}
                {new Date(
                  `${nextRace.event_date}T00:00:00`,
                ).toLocaleDateString(undefined, {
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </Card>
          )}

          {/* Race list */}
          {(races.data ?? []).length > 0 ? (
            <Card>
              <CardLabel>Events</CardLabel>
              <ul className="mt-2 flex flex-col">
                {(races.data ?? []).map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/race/${r.id}`}
                      className="flex items-center gap-3 border-t border-line py-3 first:border-t-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {r.name}
                        </p>
                        <p className="text-xs text-faint">
                          {new Date(
                            `${r.event_date}T00:00:00`,
                          ).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}{" "}
                          · {r.division}
                          {r.finish_sec
                            ? ` · ${formatHMS(r.finish_sec)}`
                            : ""}
                        </p>
                      </div>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                          STATUS_STYLE[r.status] ?? "bg-surface-2 text-muted"
                        }`}
                      >
                        {r.status}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <Card className="text-center">
              <Flag className="mx-auto h-6 w-6 text-faint" />
              <p className="mt-2 text-sm text-muted">
                No races yet — add your first event above.
              </p>
            </Card>
          )}

          {adding && (
            <RaceFormSheet
              onSaved={() => races.refetch()}
              onClose={() => setAdding(false)}
            />
          )}

          {/* Station benchmarks */}
          <Card>
            <CardLabel>Station benchmarks</CardLabel>
            <div className="mt-3 overflow-hidden rounded-xl border border-line">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-surface-2 text-[10px] uppercase tracking-wide text-faint">
                    <th className="px-2.5 py-2 font-bold">Station</th>
                    <th className="px-2 py-2 font-bold">Open</th>
                    <th className="px-2 py-2 font-bold">Pro</th>
                    <th className="px-2 py-2 font-bold text-accent">You</th>
                  </tr>
                </thead>
                <tbody>
                  {HYROX_STATION_SPECS.map((s) => {
                    const best = s.cardio_kind
                      ? bestEffort(efforts.data ?? [], s.cardio_kind)
                      : null;
                    return (
                      <tr key={s.station} className="border-t border-line">
                        <td className="px-2.5 py-2">
                          <p className="font-semibold text-fg">{s.station}</p>
                          <p className="text-[10px] text-faint">
                            {s.distance}
                          </p>
                        </td>
                        <td className="px-2 py-2 tabular-nums text-muted">
                          {s.open}
                        </td>
                        <td className="px-2 py-2 tabular-nums text-muted">
                          {s.pro}
                        </td>
                        <td className="px-2 py-2 font-bold tabular-nums text-accent">
                          {best ?? "–"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-faint">
              Sled loads include the sled itself. &ldquo;You&rdquo; = best
              logged effort (station work logs automatically from sessions).
            </p>
          </Card>

          {/* Finish-time ladder */}
          <Card>
            <CardLabel>Finish-time ladder (men)</CardLabel>
            <ul className="mt-2 flex flex-col">
              {[...FINISH_LADDER].reverse().map((t) => {
                const active = tier?.label === t.label;
                return (
                  <li
                    key={t.label}
                    className={`flex items-center justify-between border-t border-line py-2.5 text-sm first:border-t-0 ${
                      active ? "-mx-2 rounded-lg bg-accent/10 px-2" : ""
                    }`}
                  >
                    <span
                      className={
                        active ? "font-bold text-accent" : "text-muted"
                      }
                    >
                      {t.label}
                      {active && bestFinish
                        ? ` — you (${formatHMS(bestFinish)})`
                        : ""}
                    </span>
                    <span className="tabular-nums text-faint">
                      sub-{formatHMS(t.maxSec)}
                    </span>
                  </li>
                );
              })}
            </ul>
            {!tier && (
              <p className="mt-2 text-xs text-faint">
                Finish your first race and your tier lights up here. Men&apos;s
                Pro world record: 51:59.
              </p>
            )}
          </Card>
        </>
      )}
    </main>
  );
}
