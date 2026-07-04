"use client";

import { useMemo, useState } from "react";
import {
  Beef,
  CalendarCheck,
  ChevronDown,
  ChevronRight,
  Footprints,
  Scale,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  epleyOneRepMax,
  linearCurve,
  weeksBetween,
  computeTargetWorkingWeight,
  type CurveKind,
} from "@gym-planner/core/forecast";
import {
  formatPace,
  liftAim,
  nextRunKm,
  weekSlice,
  weekStartWithOffset,
  type ReviewInputs,
} from "@gym-planner/core/hyrox";
import type {
  TExercise,
  TForecastAnchor,
  TForecastTarget,
  TMetricKey,
  TMetricTarget,
} from "@gym-planner/core/schemas";
import type { ReviewData, ReviewSetRow } from "../lib/data";
import { todayISO } from "../lib/data";
import { Card, CardLabel } from "./Card";
import { SkeletonCard } from "./Skeleton";
import { MovementChip } from "./pictograms/MovementChip";

type TargetsMap = Partial<Record<TMetricKey, TMetricTarget>>;

/** Persona plan rule (Plan tab): 3 sessions is the floor, 4 when fresh. */
const SESSIONS_AIM = { low: 3, label: "3–4" };
const PROTEIN_DAYS_AIM = 6;

// ─── shared derivations ──────────────────────────────────────────────────────

function toInputs(data: ReviewData, targets: TargetsMap | null): ReviewInputs {
  const floor = Number(targets?.protein_g?.target_low ?? 0);
  return {
    sessions: data.sessions,
    sets: data.sets,
    cardio: data.cardio,
    daily: data.daily,
    weights: data.weights,
    proteinFloorG: floor > 0 ? floor : null,
  };
}

type BestSet = {
  exerciseId: string;
  name: string;
  slug: string;
  modality: TExercise["modality"];
  weightKg: number;
  reps: number;
  e1: number;
};

/** Best non-warmup set (by e1RM) per exercise inside one Monday week. */
function bestSetsByExercise(
  sets: ReviewSetRow[],
  weekStartISO: string,
): Map<string, BestSet> {
  const best = new Map<string, BestSet>();
  for (const s of sets) {
    if (s.is_warmup || !s.exercises) continue;
    if (weekStartWithOffset(s.completed_at, 0) !== weekStartISO) continue;
    const w = Number(s.weight_kg);
    const e1 = epleyOneRepMax(w, s.reps);
    const prev = best.get(s.exercises.id);
    if (!prev || e1 > prev.e1) {
      best.set(s.exercises.id, {
        exerciseId: s.exercises.id,
        name: s.exercises.name,
        slug: s.exercises.slug,
        modality: s.exercises.modality,
        weightKg: w,
        reps: s.reps,
        e1,
      });
    }
  }
  return best;
}

/** Plan-line body weight at a given date, from the trajectory target. */
function weightAimAt(bw: TMetricTarget | undefined, dateISO: string): number | null {
  if (!bw?.baseline_date || bw.baseline_value == null || !bw.targets?.length) {
    return null;
  }
  const anchors = [
    { weeks: 0, value: Number(bw.baseline_value) },
    ...bw.targets.map((t) => ({ weeks: t.at_weeks, value: t.value })),
  ];
  const w = weeksBetween(bw.baseline_date, dateISO);
  return linearCurve(Math.max(0, w), anchors);
}

const fmtKg = (v: number) =>
  v >= 10000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v).toLocaleString();
const fmtSteps = (v: number) => `${(v / 1000).toFixed(1)}k`;
const setStr = (b: BestSet) =>
  `${Number(b.weightKg.toFixed(1))}×${b.reps}`;
const weekLabelOf = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

// ─── 1. Week review table ────────────────────────────────────────────────────

type ReviewRow = {
  label: string;
  last: string;
  cur: string;
  aim: string;
  met: boolean;
  trend: "up" | "down" | null;
};

export function WeekReviewSection({
  data,
  targets,
  weekLabel,
}: {
  data: ReviewData | null;
  targets: TargetsMap | null;
  weekLabel: string | null;
}) {
  const [showPast, setShowPast] = useState(false);
  const today = todayISO();

  const slices = useMemo(() => {
    if (!data) return null;
    const inputs = toInputs(data, targets);
    return Array.from({ length: 6 }, (_, i) =>
      weekSlice(inputs, weekStartWithOffset(today, -i)),
    );
  }, [data, targets, today]);

  if (!slices) return <SkeletonCard lines={5} />;

  const [cur, last] = [slices[0]!, slices[1]!];
  const runBand = targets?.weekly_run_km;
  const stepBand = targets?.steps;
  const proteinLow = Number(targets?.protein_g?.target_low ?? 0);
  const weekEnd = weekStartWithOffset(today, 1);
  const bwAim = weightAimAt(targets?.bodyweight, weekEnd);

  const trend = (a: number | null, b: number | null): "up" | "down" | null => {
    if (a == null || b == null || a === b) return null;
    return b > a ? "up" : "down";
  };

  const anyRun = runBand || slices.some((s) => s.runKm > 0);
  const anyStations = slices.some((s) => s.stationEfforts > 0);
  const anyProtein = proteinLow > 0 || slices.some((s) => s.proteinDaysLogged > 0);
  const anySteps = slices.some((s) => s.avgSteps != null);
  const anyWeight = slices.some((s) => s.avgWeightKg != null);

  const rows: ReviewRow[] = [
    {
      label: "Sessions",
      last: String(last.sessions),
      cur: String(cur.sessions),
      aim: SESSIONS_AIM.label,
      met: cur.sessions >= SESSIONS_AIM.low,
      trend: trend(last.sessions, cur.sessions),
    },
    {
      label: "Strength sets",
      last: String(last.sets),
      cur: String(cur.sets),
      aim: "–",
      met: false,
      trend: trend(last.sets, cur.sets),
    },
    {
      label: "Volume (kg)",
      last: fmtKg(last.volumeKg),
      cur: fmtKg(cur.volumeKg),
      aim: "–",
      met: false,
      trend: trend(last.volumeKg, cur.volumeKg),
    },
    ...(anyRun
      ? [
          {
            label: "Running (km)",
            last: last.runKm ? String(last.runKm) : "0",
            cur: cur.runKm ? String(cur.runKm) : "0",
            aim: runBand
              ? `${Number(runBand.target_low)}–${Number(runBand.target_high)}`
              : "–",
            met:
              runBand != null && cur.runKm >= Number(runBand.target_low),
            trend: trend(last.runKm, cur.runKm),
          } satisfies ReviewRow,
        ]
      : []),
    ...(anyStations
      ? [
          {
            label: "Ergs & stations",
            last: String(last.stationEfforts),
            cur: String(cur.stationEfforts),
            aim: "–",
            met: false,
            trend: trend(last.stationEfforts, cur.stationEfforts),
          } satisfies ReviewRow,
        ]
      : []),
    ...(anyProtein
      ? [
          {
            label: "Protein days",
            last: `${last.proteinDaysHit}/${last.proteinDaysLogged}`,
            cur: `${cur.proteinDaysHit}/${cur.proteinDaysLogged}`,
            aim: `${PROTEIN_DAYS_AIM}+`,
            met: cur.proteinDaysHit >= PROTEIN_DAYS_AIM,
            trend: trend(last.proteinDaysHit, cur.proteinDaysHit),
          } satisfies ReviewRow,
        ]
      : []),
    ...(anySteps
      ? [
          {
            label: "Steps (avg)",
            last: last.avgSteps != null ? fmtSteps(last.avgSteps) : "–",
            cur: cur.avgSteps != null ? fmtSteps(cur.avgSteps) : "–",
            aim: stepBand
              ? `${Number(stepBand.target_low) / 1000}–${Number(stepBand.target_high) / 1000}k`
              : "–",
            met:
              stepBand != null &&
              cur.avgSteps != null &&
              cur.avgSteps >= Number(stepBand.target_low),
            trend: trend(last.avgSteps, cur.avgSteps),
          } satisfies ReviewRow,
        ]
      : []),
    ...(anyWeight
      ? [
          {
            label: "Weight (kg)",
            last: last.avgWeightKg != null ? last.avgWeightKg.toFixed(1) : "–",
            cur: cur.avgWeightKg != null ? cur.avgWeightKg.toFixed(1) : "–",
            aim: bwAim != null ? bwAim.toFixed(1) : "–",
            met:
              bwAim != null &&
              cur.avgWeightKg != null &&
              cur.avgWeightKg <= bwAim + 0.05,
            trend: trend(last.avgWeightKg, cur.avgWeightKg),
          } satisfies ReviewRow,
        ]
      : []),
  ];

  const pastWeeks = slices
    .slice(1, 6)
    .filter(
      (s) =>
        s.sessions ||
        s.sets ||
        s.runKm ||
        s.stationEfforts ||
        s.proteinDaysLogged ||
        s.avgWeightKg != null,
    );

  return (
    <Card glow className="p-4">
      <div className="flex items-baseline justify-between">
        <CardLabel>Your week</CardLabel>
        {weekLabel && (
          <span className="font-display text-sm">{weekLabel}</span>
        )}
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-line">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-surface-2 text-[10px] uppercase tracking-wide text-faint">
              <th className="px-2.5 py-2 font-bold">&nbsp;</th>
              <th className="px-2 py-2 text-right font-bold">Last wk</th>
              <th className="px-2 py-2 text-right font-bold text-fg">
                This wk
              </th>
              <th className="px-2.5 py-2 text-right font-bold text-accent">
                Aim
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-line">
                <td className="px-2.5 py-2 font-semibold text-muted">
                  {r.label}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-faint">
                  {r.last}
                </td>
                <td
                  className={`px-2 py-2 text-right font-bold tabular-nums ${
                    r.met ? "text-accent" : "text-fg"
                  }`}
                >
                  <span className="inline-flex items-center gap-1">
                    {r.trend === "up" && (
                      <TrendingUp className="h-3 w-3 text-faint" />
                    )}
                    {r.trend === "down" && (
                      <TrendingDown className="h-3 w-3 text-faint" />
                    )}
                    {r.cur}
                  </span>
                </td>
                <td className="px-2.5 py-2 text-right tabular-nums text-faint">
                  {r.aim}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-faint">
        Monday-to-Sunday weeks · volt = target hit
        {cur.runPaceSecPerKm
          ? ` · run pace this wk ${formatPace(cur.runPaceSecPerKm)}/km`
          : ""}
      </p>

      {pastWeeks.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-faint underline-offset-2 active:underline"
            onClick={() => setShowPast((v) => !v)}
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-150 ${
                showPast ? "rotate-180" : ""
              }`}
            />
            {showPast ? "Hide past weeks" : "Past weeks"}
          </button>
          {showPast && (
            <ul className="mt-1 flex flex-col">
              {pastWeeks.map((s) => (
                <li
                  key={s.weekStartISO}
                  className="flex items-center gap-2 border-t border-line py-1.5 text-xs first:border-t-0"
                >
                  <span className="w-14 shrink-0 text-faint">
                    {weekLabelOf(s.weekStartISO)}
                  </span>
                  <span className="min-w-0 flex-1 truncate tabular-nums text-muted">
                    {s.sessions} sess · {s.sets} sets · {s.runKm} km
                    {s.proteinDaysLogged > 0
                      ? ` · ${s.proteinDaysHit}/${s.proteinDaysLogged} prot`
                      : ""}
                    {s.avgWeightKg != null
                      ? ` · ${s.avgWeightKg.toFixed(1)} kg`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── 2. Next week targets ────────────────────────────────────────────────────

type AimItem = {
  key: string;
  visual: React.ReactNode;
  title: string;
  sub: string;
  onTap?: () => void;
};

export function NextWeekSection({
  data,
  targets,
  forecasts,
  onPickLift,
}: {
  data: ReviewData | null;
  targets: TargetsMap | null;
  forecasts: TForecastTarget[] | null;
  onPickLift: (exerciseId: string) => void;
}) {
  const today = todayISO();

  const items = useMemo<AimItem[] | null>(() => {
    if (!data) return null;
    const inputs = toInputs(data, targets);
    const cur = weekSlice(inputs, weekStartWithOffset(today, 0));
    const last = weekSlice(inputs, weekStartWithOffset(today, -1));
    const out: AimItem[] = [];

    // Sessions
    out.push({
      key: "sessions",
      visual: <IconBadge icon={<CalendarCheck className="h-4 w-4" />} />,
      title: `Train ${SESSIONS_AIM.label} sessions`,
      sub: `${cur.sessions} done this week · ${last.sessions} last week`,
    });

    // Running (+10% rule)
    const runBand = targets?.weekly_run_km;
    const low = runBand ? Number(runBand.target_low) : null;
    const high = runBand ? Number(runBand.target_high) : null;
    const baseKm = Math.max(cur.runKm, last.runKm);
    const aimKm = nextRunKm(baseKm, low, high);
    if (aimKm > 0) {
      out.push({
        key: "run",
        visual: <MovementChip kind="run" label="run" modality="cardio" />,
        title: `Run ${aimKm} km`,
        sub:
          baseKm > 0
            ? `+10% on your ${baseKm} km${high != null ? `, capped at ${high}` : ""}`
            : `start of your ${low}–${high} km/wk build`,
      });
    }

    // Lifts: best of the last two weeks per exercise, forecast first.
    const merged = new Map<string, BestSet>();
    for (const wk of [-1, 0]) {
      for (const [id, b] of bestSetsByExercise(
        data.sets,
        weekStartWithOffset(today, wk),
      )) {
        const prev = merged.get(id);
        if (!prev || b.e1 > prev.e1) merged.set(id, b);
      }
    }
    const ranked = [...merged.values()].sort((a, b) => {
      const fa = forecasts?.some((f) => f.exercise_id === a.exerciseId) ? 1 : 0;
      const fb = forecasts?.some((f) => f.exercise_id === b.exerciseId) ? 1 : 0;
      return fb - fa || b.e1 - a.e1;
    });
    for (const b of ranked.slice(0, 3)) {
      const f = forecasts?.find((x) => x.exercise_id === b.exerciseId);
      let title: string;
      let sub: string;
      if (f) {
        const { workingWeightKg } = computeTargetWorkingWeight({
          baseline: { weeks: 0, value: f.baseline_value },
          targets: (f.targets as TForecastAnchor[]).map((t) => ({
            weeks: t.at_weeks,
            value: t.value,
          })),
          curve: f.curve as CurveKind,
          weeksFromBaseline: weeksBetween(f.baseline_date, today) + 1,
          targetReps: 5,
        });
        title = `${b.name} ${workingWeightKg} kg × 5`;
        sub = `forecast · best ${setStr(b)}`;
      } else {
        const aim = liftAim({ weightKg: b.weightKg, reps: b.reps });
        title = `${b.name} ${aim.weightKg} kg × ${aim.reps}`;
        sub = `best ${setStr(b)} · +1 rep / +2.5 kg rule`;
      }
      out.push({
        key: b.exerciseId,
        visual: (
          <MovementChip slug={b.slug} label={b.name} modality={b.modality} />
        ),
        title,
        sub,
        onTap: () => onPickLift(b.exerciseId),
      });
    }

    // Protein
    const proteinLow = Number(targets?.protein_g?.target_low ?? 0);
    if (proteinLow > 0) {
      const ref = cur.proteinDaysLogged > 0 ? cur : last;
      const when = cur.proteinDaysLogged > 0 ? "this wk" : "last wk";
      out.push({
        key: "protein",
        visual: <IconBadge icon={<Beef className="h-4 w-4" />} />,
        title: `${proteinLow} g protein on ${PROTEIN_DAYS_AIM}+ days`,
        sub:
          ref.proteinDaysLogged > 0
            ? `hit ${ref.proteinDaysHit} of ${ref.proteinDaysLogged} logged ${when}`
            : "log macros from Home to track this",
      });
    }

    // Steps
    const stepBand = targets?.steps;
    const stepsRef = cur.avgSteps ?? last.avgSteps;
    if (stepBand && stepsRef != null) {
      out.push({
        key: "steps",
        visual: <IconBadge icon={<Footprints className="h-4 w-4" />} />,
        title: `${Number(stepBand.target_low) / 1000}–${Number(stepBand.target_high) / 1000}k steps a day`,
        sub: `avg ${fmtSteps(stepsRef)} ${cur.avgSteps != null ? "this wk" : "last wk"}`,
      });
    }

    // Body weight (plan line at end of next week)
    const nowKg = cur.avgWeightKg ?? last.avgWeightKg;
    const bwAimNext = weightAimAt(
      targets?.bodyweight,
      weekStartWithOffset(today, 2),
    );
    if (bwAimNext != null && nowKg != null) {
      out.push({
        key: "weight",
        visual: <IconBadge icon={<Scale className="h-4 w-4" />} />,
        title: `~${bwAimNext.toFixed(1)} kg by Sunday`,
        sub: `plan line · ${nowKg.toFixed(1)} kg now`,
      });
    }

    return out;
  }, [data, targets, forecasts, today, onPickLift]);

  if (!items) return <SkeletonCard lines={4} />;
  if (items.length === 0) return null;

  return (
    <Card className="p-4">
      <CardLabel>Next week, aim for</CardLabel>
      <ul className="mt-2 flex flex-col">
        {items.map((it) => {
          const inner = (
            <>
              <span className="shrink-0">{it.visual}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {it.title}
                </span>
                <span className="block truncate text-xs text-faint">
                  {it.sub}
                </span>
              </span>
              {it.onTap && (
                <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
              )}
            </>
          );
          return (
            <li key={it.key} className="border-t border-line first:border-t-0">
              {it.onTap ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-3 py-2.5 text-left"
                  onClick={it.onTap}
                >
                  {inner}
                </button>
              ) : (
                <div className="flex items-center gap-3 py-2.5">{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-faint">
        Deterministic rules — runs +10% capped at your band · lifts follow
        your forecast, otherwise double progression.
      </p>
    </Card>
  );
}

function IconBadge({ icon }: { icon: React.ReactNode }) {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-muted">
      {icon}
    </span>
  );
}

// ─── 3. Lifts: last week vs this week ────────────────────────────────────────

export function LiftsSection({
  data,
  onOpen,
}: {
  data: ReviewData | null;
  onOpen: (exerciseId: string) => void;
}) {
  const today = todayISO();

  const rows = useMemo(() => {
    if (!data) return null;
    const lastBest = bestSetsByExercise(
      data.sets,
      weekStartWithOffset(today, -1),
    );
    const curBest = bestSetsByExercise(
      data.sets,
      weekStartWithOffset(today, 0),
    );
    const ids = new Set([...lastBest.keys(), ...curBest.keys()]);
    return [...ids]
      .map((id) => {
        const last = lastBest.get(id) ?? null;
        const cur = curBest.get(id) ?? null;
        const ref = (cur ?? last)!;
        return { id, last, cur, ref, top: Math.max(last?.e1 ?? 0, cur?.e1 ?? 0) };
      })
      .sort((a, b) => b.top - a.top);
  }, [data, today]);

  if (!rows || rows.length === 0) return null;

  return (
    <Card className="p-4">
      <div className="flex items-baseline justify-between">
        <CardLabel>Lifts · last 2 weeks</CardLabel>
        <span className="text-[10px] uppercase tracking-wide text-faint">
          best set
        </span>
      </div>
      <ul className="mt-2 flex flex-col">
        <li className="flex items-center gap-3 pb-1 text-[10px] uppercase tracking-wide text-faint">
          <span className="w-9" />
          <span className="min-w-0 flex-1" />
          <span className="w-16 text-right">Last wk</span>
          <span className="w-16 text-right">This wk</span>
          <span className="w-4" />
        </li>
        {rows.map((r) => (
          <li key={r.id} className="border-t border-line">
            <button
              type="button"
              className="flex w-full items-center gap-3 py-2.5 text-left"
              onClick={() => onOpen(r.id)}
            >
              <MovementChip
                slug={r.ref.slug}
                label={r.ref.name}
                modality={r.ref.modality}
              />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {r.ref.name}
              </span>
              <span className="w-16 text-right text-xs tabular-nums text-faint">
                {r.last ? setStr(r.last) : "–"}
              </span>
              <span
                className={`w-16 text-right text-xs font-bold tabular-nums ${
                  r.cur && r.last && r.cur.e1 > r.last.e1
                    ? "text-accent"
                    : "text-fg"
                }`}
              >
                {r.cur ? setStr(r.cur) : "–"}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-faint">
        weight × reps · volt = beat last week · tap a lift for its forecast
      </p>
    </Card>
  );
}
