"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronRight,
  KeyRound,
  LogOut,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  epleyOneRepMax,
  linearCurve,
  sessionE1RM,
  type CurveKind,
} from "@gym-planner/core/forecast";
import { curveByKind } from "@gym-planner/core/forecast";
import {
  formatMS,
  formatPace,
  planTotalWeeks,
  planWeekNumber,
  proteinHitRate,
  weeklyRunAgg,
} from "@gym-planner/core/hyrox";
import type {
  TExercise,
  TForecastAnchor,
  TForecastTarget,
} from "@gym-planner/core/schemas";
import { createClient } from "../../../lib/supabase/client";
import { useQuery } from "../../../lib/useQuery";
import {
  discardSession,
  fetchBodyWeights,
  fetchCardioLogs,
  fetchDailyLogs,
  fetchExercises,
  fetchForecasts,
  fetchMetricTargets,
  fetchPhases,
  fetchPrograms,
  fetchReviewData,
  fetchSessionSummaries,
  fetchSetLogsForExercise,
  fetchWeeklyMuscleCounts,
  sampleMetricCurve,
  todayISO,
} from "../../../lib/data";
import { BodyHeatMap } from "../../../components/BodyHeatMap";
import {
  LiftsSection,
  NextWeekSection,
  WeekReviewSection,
} from "../../../components/WeekReview";
import { ConfirmSheet } from "../../../components/ConfirmSheet";
import { MovementChip } from "../../../components/pictograms/MovementChip";
import { BarChart } from "../../../components/BarChart";
import { LineChart, type Series } from "../../../components/LineChart";
import { NumberStepper } from "../../../components/NumberStepper";
import { ExercisePicker } from "../../../components/ExercisePicker";
import { Button } from "../../../components/Button";
import { Card, CardLabel } from "../../../components/Card";
import { ProgressRing } from "../../../components/ProgressRing";

const WEEK_MS = 7 * 24 * 3600 * 1000;

function ProgressContent() {
  const db = useMemo(() => createClient(), []);
  const params = useSearchParams();

  const exercises = useQuery(() => fetchExercises(db), []);
  const forecasts = useQuery(() => fetchForecasts(db), []);
  const review = useQuery(() => fetchReviewData(db), []);
  const targets = useQuery(() => fetchMetricTargets(db), []);

  // "Week N of M" chip, from the active program's phase span.
  const programs = useQuery(() => fetchPrograms(db), []);
  const activeProgram = programs.data?.find((p) => p.status === "active");
  const phases = useQuery(
    () =>
      activeProgram ? fetchPhases(db, activeProgram.id) : Promise.resolve([]),
    [activeProgram?.id],
  );
  let weekLabel: string | null = null;
  if (activeProgram && phases.data && phases.data.length > 0) {
    const total = planTotalWeeks(
      phases.data[0]!.start_date,
      phases.data[phases.data.length - 1]!.end_date,
    );
    const n = Math.min(planWeekNumber(activeProgram.start_date, todayISO()), total);
    weekLabel = `Week ${n} of ${total}`;
  }

  const [pickedId, setPickedId] = useState<string | null>(
    params.get("exercise"),
  );
  const [showPicker, setShowPicker] = useState(false);

  function openLift(exerciseId: string) {
    setPickedId(exerciseId);
    requestAnimationFrame(() => {
      document
        .getElementById("lift-progress")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const selected: TExercise | undefined =
    exercises.data?.find((e) => e.id === pickedId) ??
    exercises.data?.find((e) =>
      forecasts.data?.some((f) => f.exercise_id === e.id),
    );

  const forecast = forecasts.data?.find(
    (f) => f.exercise_id === selected?.id,
  );

  return (
    <main className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl tracking-tight">Progress</h1>
        <button
          type="button"
          aria-label="Sign out"
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2 text-faint"
          onClick={async () => {
            await db.auth.signOut();
            window.location.href = "/login";
          }}
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      <WeekReviewSection
        data={review.data ?? null}
        targets={targets.data ?? null}
        weekLabel={weekLabel}
      />

      <NextWeekSection
        data={review.data ?? null}
        targets={targets.data ?? null}
        forecasts={forecasts.data ?? null}
        onPickLift={openLift}
      />

      <WeeklyLoadSection />

      <LiftsSection data={review.data ?? null} onOpen={openLift} />

      {/* Exercise progress: forecast vs actual */}
      <Card id="lift-progress" className="scroll-mt-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            {selected && (
              <MovementChip slug={selected.slug} modality={selected.modality} />
            )}
            <CardLabel>Lift progress</CardLabel>
          </span>
          <Button size="md" onClick={() => setShowPicker(true)}>
            {selected ? selected.name : "Pick exercise"}
          </Button>
        </div>

        {selected ? (
          forecast ? (
            <ForecastVsActual
              key={selected.id}
              exercise={selected}
              forecast={forecast}
              onChanged={forecasts.refetch}
            />
          ) : (
            <ForecastForm
              key={selected.id}
              exercise={selected}
              onSaved={forecasts.refetch}
            />
          )
        ) : (
          <p className="mt-3 text-sm text-muted">
            Pick an exercise to set a forecast and see progress against it.
          </p>
        )}
      </Card>

      <HistorySection />

      <RunningSection />

      <BodyWeightSection />

      <NutritionSection />

      <AccountSection />

      {showPicker && exercises.data && (
        <ExercisePicker
          exercises={exercises.data}
          onPick={(e) => {
            setPickedId(e.id);
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </main>
  );
}

function ForecastVsActual({
  exercise,
  forecast,
  onChanged,
}: {
  exercise: TExercise;
  forecast: TForecastTarget;
  onChanged: () => void;
}) {
  const db = useMemo(() => createClient(), []);
  const sets = useQuery(
    () => fetchSetLogsForExercise(db, exercise.id),
    [exercise.id],
  );
  const [editing, setEditing] = useState(false);

  const baselineMs = Date.parse(forecast.baseline_date);
  const anchors = forecast.targets as TForecastAnchor[];
  const lastWeek = Math.max(...anchors.map((a) => a.at_weeks));

  // Forecast line: weekly samples from baseline to the last anchor.
  const curveFn = curveByKind[forecast.curve as CurveKind];
  const curveAnchors = [
    { weeks: 0, value: forecast.baseline_value },
    ...anchors.map((a) => ({ weeks: a.at_weeks, value: a.value })),
  ];
  const forecastPoints = Array.from({ length: lastWeek + 1 }, (_, w) => ({
    x: baselineMs + w * WEEK_MS,
    y: curveFn(w, curveAnchors),
  }));

  // Actual line: one point per session (deterministic rule in core).
  const actualPoints = useMemo(() => {
    if (!sets.data) return [];
    const bySession = new Map<
      string,
      { reps: number; weightKg: number; isWarmup: boolean }[]
    >();
    const sessionDate = new Map<string, number>();
    for (const s of sets.data) {
      const arr = bySession.get(s.session_id) ?? [];
      arr.push({
        reps: s.reps,
        weightKg: Number(s.weight_kg),
        isWarmup: s.is_warmup,
      });
      bySession.set(s.session_id, arr);
      sessionDate.set(s.session_id, Date.parse(s.completed_at));
    }
    const pts: { x: number; y: number }[] = [];
    for (const [sid, ss] of bySession) {
      const e = sessionE1RM(ss);
      if (e !== null) pts.push({ x: sessionDate.get(sid)!, y: e });
    }
    return pts.sort((a, b) => a.x - b.x);
  }, [sets.data]);

  const now = Date.now();
  const latest = actualPoints[actualPoints.length - 1];
  const targetNow = curveFn((now - baselineMs) / WEEK_MS, curveAnchors);
  const delta = latest ? latest.y - targetNow : null;

  const series: Series[] = [
    {
      points: forecastPoints,
      color: "rgba(255,255,255,0.35)",
      dashed: true,
      label: "forecast",
    },
    {
      points: actualPoints,
      color: "var(--color-accent)",
      dots: true,
      area: true,
      label: "actual",
    },
  ];

  if (editing) {
    return (
      <ForecastForm
        exercise={exercise}
        existing={forecast}
        onSaved={() => {
          setEditing(false);
          onChanged();
        }}
      />
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
      {delta !== null ? (
        <p
          className={`flex items-center gap-1.5 text-sm font-bold ${
            delta >= 0 ? "text-accent" : "text-warn"
          }`}
        >
          {delta >= 0 ? (
            <TrendingUp className="h-4 w-4" />
          ) : (
            <TrendingDown className="h-4 w-4" />
          )}
          {Math.abs(delta).toFixed(1)} kg{" "}
          {delta >= 0 ? "ahead of" : "behind"} plan
        </p>
      ) : (
        <p className="text-sm text-muted">
          No logged sessions yet — the dashed line is your plan.
        </p>
      )}

      <LineChart
        series={series}
        yUnit=""
        todayX={now}
        markers={anchors.map((a) => ({
          x: baselineMs + a.at_weeks * WEEK_MS,
          label: `${a.at_weeks}w`,
        }))}
      />
      <p className="text-xs text-faint">
        dashed = forecast e1RM · dots = actual (best non-warmup set ≤12 reps
        per session)
      </p>
      <Button size="md" onClick={() => setEditing(true)}>
        Edit forecast
      </Button>
    </div>
  );
}

function ForecastForm({
  exercise,
  existing,
  onSaved,
}: {
  exercise: TExercise;
  existing?: TForecastTarget;
  onSaved: () => void;
}) {
  const db = useMemo(() => createClient(), []);
  const ex = existing?.targets as TForecastAnchor[] | undefined;

  // Persona rule: he thinks "100 for 5", never "e1RM 116.7" — enter
  // weight×reps everywhere, we do the Epley math.
  const [baseW, setBaseW] = useState(
    existing ? Math.round(existing.baseline_value / 1.1667 / 2.5) * 2.5 : 60,
  );
  const [baseR, setBaseR] = useState(5);
  const [t3W, setT3W] = useState(
    ex?.[0] ? Math.round(ex[0].value / 1.1667 / 2.5) * 2.5 : 70,
  );
  const [t6W, setT6W] = useState(
    ex?.[1] ? Math.round(ex[1].value / 1.1667 / 2.5) * 2.5 : 80,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseline = epleyOneRepMax(baseW, baseR);
  const t3 = epleyOneRepMax(t3W, baseR);
  const t6 = epleyOneRepMax(t6W, baseR);

  const aggressive = t3 > baseline * 1.25 || t6 > baseline * 1.5;

  const preview: Series[] = [
    {
      points: Array.from({ length: 25 }, (_, w) => ({
        x: w,
        y: curveByKind.linear(w, [
          { weeks: 0, value: baseline },
          { weeks: 12, value: t3 },
          { weeks: 24, value: t6 },
        ]),
      })),
      color: "var(--color-accent)",
      area: true,
    },
  ];

  async function save() {
    setSaving(true);
    setError(null);
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return;
    const row = {
      user_id: user.id,
      exercise_id: exercise.id,
      metric: "1rm",
      baseline_value: Number(baseline.toFixed(1)),
      baseline_date: existing?.baseline_date ?? todayISO(),
      targets: [
        { at_weeks: 12, value: Number(t3.toFixed(1)) },
        { at_weeks: 24, value: Number(t6.toFixed(1)) },
      ],
      curve: "linear",
    };
    const { error: e } = await db
      .from("forecast_targets")
      .upsert(row, { onConflict: "user_id,exercise_id,metric" });
    if (e) {
      setError(e.message);
      setSaving(false);
      return;
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="mt-3 flex flex-col gap-4">
      <p className="text-sm">
        {existing ? "Edit" : "Set"} forecast for <b>{exercise.name}</b>
      </p>

      <div className="flex flex-col gap-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted">Today I lift</span>
          <div className="flex items-center gap-2">
            <NumberStepper
              value={baseW}
              step={2.5}
              min={0}
              max={400}
              suffix="kg"
              onChange={setBaseW}
              ariaLabel="baseline weight"
            />
            ×
            <NumberStepper
              value={baseR}
              min={1}
              max={10}
              onChange={setBaseR}
              ariaLabel="baseline reps"
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted">In 3 months</span>
          <NumberStepper
            value={t3W}
            step={2.5}
            min={0}
            max={400}
            suffix="kg"
            onChange={setT3W}
            ariaLabel="3 month target weight"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted">In 6 months</span>
          <NumberStepper
            value={t6W}
            step={2.5}
            min={0}
            max={400}
            suffix="kg"
            onChange={setT6W}
            ariaLabel="6 month target weight"
          />
        </div>
      </div>

      <p className="text-xs text-faint">
        e1RM:{" "}
        <span className="font-display text-sm text-fg">
          {baseline.toFixed(0)}
        </span>{" "}
        → <span className="font-display text-sm text-fg">{t3.toFixed(0)}</span>{" "}
        kg @12w →{" "}
        <span className="font-display text-sm text-accent">
          {t6.toFixed(0)}
        </span>{" "}
        kg @24w (all at ×{baseR})
        {aggressive && (
          <span className="text-warn">
            {" "}
            · that ramp is aggressive — most lifters add 10–25% to e1RM in 6
            months
          </span>
        )}
      </p>

      <LineChart series={preview} height={110} />

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button variant="primary" size="lg" disabled={saving} onClick={save}>
        Save forecast
      </Button>
    </div>
  );
}

function BodyWeightSection() {
  const db = useMemo(() => createClient(), []);
  const weights = useQuery(() => fetchBodyWeights(db), []);
  const targets = useQuery(() => fetchMetricTargets(db), []);
  const [rangeDays, setRangeDays] = useState(90);

  const cutoff = Date.now() - rangeDays * 24 * 3600 * 1000;
  const pts = (weights.data ?? [])
    .map((w) => ({ x: Date.parse(w.logged_at), y: Number(w.weight_kg) }))
    .filter((p) => p.x >= cutoff);

  // 7-day rolling average over the raw dots.
  const avg = pts.map((p, i) => {
    const windowStart = p.x - 7 * 24 * 3600 * 1000;
    const win = pts.filter((q, j) => j <= i && q.x >= windowStart);
    return { x: p.x, y: win.reduce((a, q) => a + q.y, 0) / win.length };
  });

  const first = pts[0];
  const last = pts[pts.length - 1];

  // Target trajectory (e.g. 91 → 85 by race → 77): dashed overlay clipped to
  // the visible window, plus a slight future runway so the line has direction.
  const bwTarget = targets.data?.bodyweight;
  const now = Date.now();
  const trajectory = (bwTarget ? sampleMetricCurve(bwTarget) : []).filter(
    (p) => p.x >= cutoff && p.x <= now + rangeDays * 0.25 * 24 * 3600 * 1000,
  );

  // Ahead/behind the plan line (losing weight: below the line = ahead).
  let planDelta: number | null = null;
  if (bwTarget?.baseline_date && bwTarget.baseline_value != null && last) {
    const anchors = [
      { weeks: 0, value: Number(bwTarget.baseline_value) },
      ...(bwTarget.targets ?? []).map((t) => ({
        weeks: t.at_weeks,
        value: t.value,
      })),
    ];
    const weeksNow =
      (now - Date.parse(`${bwTarget.baseline_date}T00:00:00`)) /
      (7 * 24 * 3600 * 1000);
    planDelta = last.y - linearCurve(Math.max(0, weeksNow), anchors);
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <CardLabel>Body weight</CardLabel>
        <div className="flex gap-1 rounded-lg bg-surface-2 p-0.5 text-xs">
          {[30, 90, 180, 365].map((d) => (
            <button
              key={d}
              type="button"
              className={`rounded-md px-2.5 py-1 font-medium transition-colors duration-100 ${
                rangeDays === d ? "bg-accent text-black" : "text-faint"
              }`}
              onClick={() => setRangeDays(d)}
            >
              {d === 30 ? "1M" : d === 90 ? "3M" : d === 180 ? "6M" : "1Y"}
            </button>
          ))}
        </div>
      </div>

      {first && last && pts.length > 1 && (
        <p className="mt-2 flex items-baseline gap-2 text-sm">
          <span className="font-display text-lg tabular-nums">
            {last.y.toFixed(1)} kg
          </span>{" "}
          <span
            className={`text-xs ${
              last.y - first.y <= 0 ? "text-accent" : "text-warn"
            }`}
          >
            {last.y - first.y >= 0 ? "+" : ""}
            {(last.y - first.y).toFixed(1)} kg over{" "}
            {rangeDays === 365 ? "1 year" : `${rangeDays} days`}
          </span>
          {planDelta !== null && (
            <span
              className={`text-xs font-bold ${
                planDelta <= 0 ? "text-accent" : "text-warn"
              }`}
            >
              · {Math.abs(planDelta).toFixed(1)} kg{" "}
              {planDelta <= 0 ? "ahead of" : "behind"} plan
            </span>
          )}
        </p>
      )}

      <div className="mt-3">
        <LineChart
          series={[
            ...(trajectory.length > 1
              ? [
                  {
                    points: trajectory,
                    color: "rgba(255,255,255,0.35)",
                    dashed: true,
                    label: "target",
                  },
                ]
              : []),
            { points: pts, color: "rgba(155,155,164,0.6)", dots: true },
            { points: avg, color: "var(--color-accent)", area: true },
          ]}
          height={140}
          todayX={trajectory.length > 1 ? now : undefined}
        />
      </div>
      <p className="mt-1 text-xs text-faint">
        dots = daily weigh-ins · line = 7-day average
        {trajectory.length > 1 ? " · dashed = target trajectory" : ""} · log
        from Home
      </p>

      {(weights.data ?? []).length > 0 && (
        <RecentEntries
          rows={[...(weights.data ?? [])]
            .slice(-7)
            .reverse()
            .map((w) => ({
              id: w.id,
              label: new Date(`${w.logged_at}T00:00:00`).toLocaleDateString(
                undefined,
                { day: "numeric", month: "short" },
              ),
              value: `${Number(w.weight_kg).toFixed(1)} kg`,
            }))}
          onDelete={async (id) => {
            await db.from("body_weight_logs").delete().eq("id", id);
            weights.refetch();
          }}
        />
      )}
    </Card>
  );
}

/** Collapsible last-N list with per-row delete (fix a fat-fingered log). */
function RecentEntries({
  rows,
  onDelete,
}: {
  rows: { id: string; label: string; value: string }[];
  onDelete: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        type="button"
        className="text-xs text-faint underline-offset-2 active:underline"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Hide entries" : "Edit entries"}
      </button>
      {open && (
        <ul className="mt-1 flex flex-col">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-2 border-t border-line py-1.5 text-sm first:border-t-0"
            >
              <span className="w-16 text-xs text-faint">{r.label}</span>
              <span className="flex-1 tabular-nums">{r.value}</span>
              <button
                type="button"
                aria-label={`delete entry ${r.label}`}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-faint active:bg-surface-2"
                onClick={() => onDelete(r.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RunningSection() {
  const db = useMemo(() => createClient(), []);
  const runs = useQuery(async () => {
    const since = new Date(Date.now() - 180 * 24 * 3600 * 1000).toISOString();
    return fetchCardioLogs(db, { kind: "run", sinceISO: since });
  }, []);
  const targets = useQuery(() => fetchMetricTargets(db), []);

  const weeks = useMemo(
    () =>
      weeklyRunAgg(
        (runs.data ?? []).map((r) => ({
          kind: r.kind,
          distance_m: r.distance_m,
          duration_sec: r.duration_sec,
          logged_at: r.logged_at,
        })),
      ).slice(-8),
    [runs.data],
  );

  const kmTarget = targets.data?.weekly_run_km;

  // Monthly 5 km tests: style='test' runs near 5000 m.
  const tests = (runs.data ?? []).filter(
    (r) =>
      r.style === "test" &&
      r.distance_m != null &&
      r.distance_m >= 4800 &&
      r.distance_m <= 5200 &&
      r.duration_sec != null &&
      r.duration_sec > 0,
  );
  const testPoints = tests.map((t) => ({
    x: Date.parse(t.logged_at),
    y: (t.duration_sec ?? 0) / 60,
  }));
  const run5k = targets.data?.run_5k_sec;
  const raceAnchor = run5k?.targets?.[0];

  if ((runs.data ?? []).length === 0 && !kmTarget) return null;

  return (
    <Card className="p-4">
      <CardLabel>Running</CardLabel>

      {weeks.length > 0 ? (
        <div className="mt-3">
          <BarChart
            bars={weeks.map((w) => ({
              label: new Date(`${w.weekStartISO}T00:00:00`).toLocaleDateString(
                undefined,
                { month: "short", day: "numeric" },
              ),
              value: Math.round(w.km * 10) / 10,
              sub: w.avgPaceSecPerKm
                ? `${formatPace(w.avgPaceSecPerKm)}/km`
                : undefined,
            }))}
            targetY={kmTarget ? Number(kmTarget.target_low) : undefined}
            targetLabel={
              kmTarget
                ? `${Number(kmTarget.target_low)}–${Number(kmTarget.target_high)} km/wk`
                : undefined
            }
          />
          <p className="mt-1 text-xs text-faint">
            weekly km · label = avg pace
            {kmTarget
              ? ` · build to ${Number(kmTarget.target_low)}–${Number(kmTarget.target_high)} km/wk`
              : ""}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">
          No runs logged yet — running sessions land here automatically.
        </p>
      )}

      <div className="mt-4 border-t border-line pt-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold">5 km test</p>
          {raceAnchor && (
            <span className="text-xs text-faint">
              target {formatMS(raceAnchor.value)} by race
            </span>
          )}
        </div>
        {testPoints.length > 0 ? (
          <>
            <p className="mt-1 text-sm">
              <span className="font-display text-lg tabular-nums">
                {formatMS((tests[tests.length - 1]!.duration_sec ?? 0))}
              </span>{" "}
              <span className="text-xs text-faint">latest</span>
            </p>
            {testPoints.length > 1 && (
              <div className="mt-2">
                <LineChart
                  series={[
                    {
                      points: testPoints,
                      color: "var(--color-accent)",
                      dots: true,
                      area: true,
                    },
                  ]}
                  height={100}
                  yUnit="m"
                />
              </div>
            )}
          </>
        ) : (
          <p className="mt-1 text-xs text-muted">
            No test yet — run a timed 5 km once a month (log it as a
            &ldquo;test&rdquo; run) to track this.
          </p>
        )}
      </div>
    </Card>
  );
}

function NutritionSection() {
  const db = useMemo(() => createClient(), []);
  const logs = useQuery(() => fetchDailyLogs(db, 90), []);
  const targets = useQuery(() => fetchMetricTargets(db), []);

  const proteinLow = Number(targets.data?.protein_g?.target_low ?? 0);
  const proteinHigh = Number(targets.data?.protein_g?.target_high ?? 0);
  const hitRate =
    logs.data && proteinLow > 0
      ? proteinHitRate(
          logs.data.map((l) => ({
            logged_at: l.logged_at,
            protein_g: l.protein_g,
          })),
          proteinLow,
          28,
        )
      : null;

  // 7 most recent logged days for the calories average.
  const recent = (logs.data ?? [])
    .filter((l) => l.calories != null)
    .slice(0, 7);
  const avgCalories =
    recent.length > 0
      ? Math.round(
          recent.reduce((a, l) => a + (l.calories ?? 0), 0) / recent.length,
        )
      : null;
  const calRest = Number(targets.data?.calories_rest?.target_low ?? 0);
  const calTrain = Number(targets.data?.calories_training?.target_low ?? 0);

  if (!logs.data || logs.data.length === 0) return null;

  return (
    <Card className="p-4">
      <CardLabel>Nutrition</CardLabel>
      <div className="mt-3 flex items-center gap-4">
        <ProgressRing
          progress={hitRate ? hitRate.rate : 0}
          size={84}
          stroke={7}
        >
          <span className="font-display text-lg tabular-nums">
            {hitRate ? `${Math.round(hitRate.rate * 100)}%` : "–"}
          </span>
        </ProgressRing>
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-bold">Protein hit-rate</p>
          <p className="text-muted">
            {hitRate
              ? `${hitRate.hit} of ${hitRate.logged} logged days at ${proteinLow} g+`
              : "Set a protein target to track adherence"}
            {proteinLow > 0 && proteinHigh > 0 && (
              <span className="text-faint">
                {" "}
                (target {proteinLow}–{proteinHigh} g)
              </span>
            )}
          </p>
          {avgCalories !== null && (
            <p className="text-xs text-faint">
              7-day avg{" "}
              <span className="font-bold text-fg tabular-nums">
                {avgCalories} kcal
              </span>
              {calRest > 0 && calTrain > 0 && (
                <>
                  {" "}
                  · target {calRest} rest / {calTrain} training
                </>
              )}
            </p>
          )}
        </div>
      </div>

      <RecentEntries
        rows={(logs.data ?? []).slice(0, 7).map((l) => ({
          id: l.id,
          label: new Date(`${l.logged_at}T00:00:00`).toLocaleDateString(
            undefined,
            { day: "numeric", month: "short" },
          ),
          value: [
            l.calories != null ? `${l.calories} kcal` : null,
            l.protein_g != null ? `${l.protein_g} g protein` : null,
            l.steps != null ? `${l.steps.toLocaleString()} steps` : null,
          ]
            .filter(Boolean)
            .join(" · "),
        }))}
        onDelete={async (id) => {
          await db.from("daily_logs").delete().eq("id", id);
          logs.refetch();
        }}
      />
    </Card>
  );
}

function WeeklyLoadSection() {
  const db = useMemo(() => createClient(), []);
  const counts = useQuery(() => fetchWeeklyMuscleCounts(db), []);

  const total = Object.values(counts.data ?? {}).reduce<number>(
    (a, v) => a + (v ?? 0),
    0,
  );

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <CardLabel>This week&apos;s load</CardLabel>
        <span className="text-xs tabular-nums text-faint">
          {total} set{total === 1 ? "" : "s"}
        </span>
      </div>
      <div className="mt-4">
        <BodyHeatMap counts={counts.data ?? {}} />
      </div>
      <p className="mt-3 text-center text-xs text-faint">
        {total > 0
          ? "brighter = more sets this week"
          : "Log strength sets and the body lights up"}
      </p>
    </Card>
  );
}

function HistorySection() {
  const db = useMemo(() => createClient(), []);
  const router = useRouter();
  const sessions = useQuery(() => fetchSessionSummaries(db, 20), []);
  const [discarding, setDiscarding] = useState<string | null>(null);

  if (!sessions.data || sessions.data.length === 0) return null;

  return (
    <Card className="p-4">
      <CardLabel>Recent workouts</CardLabel>
      <ul className="mt-2 flex flex-col">
        {sessions.data.map((s) => {
          const started = new Date(s.started_at);
          const mins = s.ended_at
            ? Math.max(
                1,
                Math.round(
                  (Date.parse(s.ended_at) - started.getTime()) / 60000,
                ),
              )
            : null;
          const counts =
            s.stationCount > 0
              ? `${s.stationCount} station${s.stationCount === 1 ? "" : "s"}`
              : `${s.setCount + s.cardioCount} set${
                  s.setCount + s.cardioCount === 1 ? "" : "s"
                }`;
          const meta = [
            started.toLocaleDateString(undefined, {
              weekday: "short",
              day: "numeric",
              month: "short",
            }),
            mins !== null ? `${mins} min` : null,
            counts,
          ]
            .filter(Boolean)
            .join(" · ");
          const inProgress = !s.ended_at;

          return (
            <li
              key={s.id}
              className="flex items-center gap-2 border-t border-line py-3 first:border-t-0"
            >
              {inProgress ? (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <span
                        className={
                          s.sourceName ? "truncate" : "italic text-faint"
                        }
                      >
                        {s.sourceName ?? "Deleted day"}
                      </span>
                      <span className="rounded bg-warn/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-warn">
                        In progress
                      </span>
                    </p>
                    <p className="text-xs text-faint">{meta}</p>
                  </div>
                  <Button
                    variant="primary"
                    onClick={() => router.push(`/session/${s.id}`)}
                  >
                    Resume
                  </Button>
                  <Button variant="danger" onClick={() => setDiscarding(s.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Link
                  href={`/history/${s.id}`}
                  className="flex min-w-0 flex-1 items-center gap-2"
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-sm font-semibold ${
                        s.sourceName ? "" : "italic text-faint"
                      }`}
                    >
                      {s.sourceName ?? "Deleted day"}
                    </span>
                    <span className="block text-xs text-faint">{meta}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      {discarding && (
        <ConfirmSheet
          title="Discard workout?"
          body="All sets logged in this session will be deleted."
          confirmLabel="Discard workout"
          onConfirm={async () => {
            await discardSession(db, discarding);
            setDiscarding(null);
            sessions.refetch();
          }}
          onClose={() => setDiscarding(null)}
        />
      )}
    </Card>
  );
}

function AccountSection() {
  const db = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    if (pw.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (pw !== pw2) {
      setError("Passwords don't match.");
      return;
    }
    setSaving(true);
    const { error: e2 } = await db.auth.updateUser({ password: pw });
    setSaving(false);
    if (e2) {
      setError(e2.message);
      return;
    }
    setPw("");
    setPw2("");
    setOpen(false);
    setMsg(
      "Password set — use “Use password instead” on the login screen from now on.",
    );
  }

  return (
    <Card className="p-4">
      <CardLabel>Account</CardLabel>
      {msg && <p className="mt-2 text-sm text-accent">{msg}</p>}
      {!open ? (
        <Button className="mt-3 w-full" onClick={() => setOpen(true)}>
          <KeyRound className="h-4 w-4" />
          Set a password
        </Button>
      ) : (
        <form onSubmit={save} className="mt-3 flex flex-col gap-3">
          <input
            type="password"
            autoComplete="new-password"
            placeholder="New password (min 8 characters)"
            className="h-12 rounded-xl bg-surface-2 px-4 outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-accent"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Repeat password"
            className="h-12 rounded-xl bg-surface-2 px-4 outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-accent"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <Button
              type="button"
              className="flex-1"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              disabled={saving || pw.length === 0}
            >
              Save password
            </Button>
          </div>
          <p className="text-xs text-faint">
            After this you can sign in with email + password — no more waiting
            on magic-link emails.
          </p>
        </form>
      )}
    </Card>
  );
}

export default function ProgressPage() {
  return (
    <Suspense>
      <ProgressContent />
    </Suspense>
  );
}
