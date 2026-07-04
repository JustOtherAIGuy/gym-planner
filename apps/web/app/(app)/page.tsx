"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Flag, Repeat, Scale } from "lucide-react";
import { sessionE1RM } from "@gym-planner/core/forecast";
import { currentPhase } from "@gym-planner/core/hyrox";
import type { TForecastTarget } from "@gym-planner/core/schemas";
import { createClient } from "../../lib/supabase/client";
import { useQuery } from "../../lib/useQuery";
import {
  discardSession,
  fetchBodyWeights,
  fetchForecasts,
  fetchInProgressSession,
  fetchPhases,
  fetchProgramDays,
  fetchPrograms,
  fetchRaces,
  prescribeToday,
  startOfWeekISO,
  startProgramDaySession,
  todayISO,
  type ProgramDayWithExercises,
} from "../../lib/data";
import { DayPickerSheet } from "../../components/DayPickerSheet";
import { ConfirmSheet } from "../../components/ConfirmSheet";
import { NumberStepper } from "../../components/NumberStepper";
import { LineChart } from "../../components/LineChart";
import { Button } from "../../components/Button";
import { Card, CardLabel } from "../../components/Card";
import { SkeletonCard } from "../../components/Skeleton";
import { StatBadge } from "../../components/StatBadge";
import { DailyLogCard } from "../../components/DailyLogCard";

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Late night";
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
}

export default function Home() {
  const db = useMemo(() => createClient(), []);
  const router = useRouter();

  const me = useQuery(async () => {
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return null;
    const { data: profile } = await db
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();
    return {
      name:
        profile?.display_name ??
        user.email?.split("@")[0]?.replace(/[._]/g, " ") ??
        "athlete",
    };
  }, []);

  const programs = useQuery(() => fetchPrograms(db), []);
  const activeProgram = programs.data?.find((p) => p.status === "active");

  const days = useQuery(
    () =>
      activeProgram
        ? fetchProgramDays(db, activeProgram.id)
        : Promise.resolve([] as ProgramDayWithExercises[]),
    [activeProgram?.id],
  );
  const phases = useQuery(
    () =>
      activeProgram ? fetchPhases(db, activeProgram.id) : Promise.resolve([]),
    [activeProgram?.id],
  );
  const forecasts = useQuery(() => fetchForecasts(db), []);
  const weights = useQuery(() => fetchBodyWeights(db), []);
  const races = useQuery(() => fetchRaces(db), []);

  const nextRace = races.data?.find(
    (r) => r.status !== "completed" && r.event_date >= todayISO(),
  );
  const raceDaysOut = nextRace
    ? Math.max(
        0,
        Math.round(
          (Date.parse(`${nextRace.event_date}T00:00:00`) -
            Date.parse(`${todayISO()}T00:00:00`)) /
            (24 * 3600 * 1000),
        ),
      )
    : null;

  // This week's sessions: weekday dots for the strip + trained day ids for
  // the session chooser.
  const weekDots = useQuery(async () => {
    const { data } = await db
      .from("workout_sessions")
      .select("started_at, source_id")
      .gte("started_at", startOfWeekISO())
      .not("ended_at", "is", null);
    const dots = new Set<number>();
    const dayIds = new Set<string>();
    for (const s of data ?? []) {
      dots.add((new Date(s.started_at).getDay() + 6) % 7);
      if (s.source_id) dayIds.add(s.source_id as string);
    }
    return { dots, dayIds };
  }, []);

  // A dangling session (backed out mid-workout) — resume or discard.
  const inProgress = useQuery(() => fetchInProgressSession(db), []);
  const inProgressDayName = useQuery(async () => {
    if (!inProgress.data?.source_id) return null;
    const { data } = await db
      .from("program_days")
      .select("name")
      .eq("id", inProgress.data.source_id)
      .maybeSingle();
    return (data?.name as string | undefined) ?? null;
  }, [inProgress.data?.source_id]);

  // Next day = the one after the most recently trained day of this program.
  // Phased programs (e.g. the 13-week HYROX plan) only cycle the CURRENT
  // phase's days — week 1 must never prescribe week 9's work.
  const nextDay = useQuery(async () => {
    if (!activeProgram || !days.data || days.data.length === 0) return null;
    if (!phases.data) return null; // still loading — wait for phase info
    const phase =
      phases.data.length > 0 ? currentPhase(phases.data, todayISO()) : null;
    const pool = phase
      ? days.data.filter((d) => d.phase_id === phase.id)
      : days.data;
    const trainable = pool.filter((d) => !d.rest_day);
    if (trainable.length === 0) return null;
    const { data: last } = await db
      .from("workout_sessions")
      .select("source_id")
      .eq("source_type", "program_day")
      .order("started_at", { ascending: false })
      .limit(1);
    const lastDayId = last?.[0]?.source_id as string | undefined;
    const idx = trainable.findIndex((d) => d.id === lastDayId);
    return trainable[(idx + 1) % trainable.length] ?? null;
  }, [activeProgram?.id, days.data?.length, phases.data?.length]);

  const [logWeight, setLogWeight] = useState<number | null>(null);
  const [savingWeight, setSavingWeight] = useState(false);
  const lastWeight = weights.data?.[weights.data.length - 1];

  // One-shot session choice — rotation self-heals from the last session's
  // source_id, so nothing is persisted.
  const [overrideDay, setOverrideDay] =
    useState<ProgramDayWithExercises | null>(null);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [resumePrompt, setResumePrompt] = useState<string | null>(null);
  const [discardPrompt, setDiscardPrompt] = useState(false);
  const displayDay = overrideDay ?? nextDay.data ?? null;

  async function saveWeight() {
    if (logWeight === null) return;
    setSavingWeight(true);
    const {
      data: { user },
    } = await db.auth.getUser();
    if (user) {
      await db.from("body_weight_logs").upsert(
        {
          user_id: user.id,
          logged_at: todayISO(),
          weight_kg: logWeight,
        },
        { onConflict: "user_id,logged_at" },
      );
      weights.refetch();
    }
    setSavingWeight(false);
    setLogWeight(null);
  }

  async function startSession(dayId: string) {
    const result = await startProgramDaySession(db, dayId);
    if (result.kind === "started") {
      router.push(`/session/${result.id}`);
    } else {
      setResumePrompt(result.session.id);
    }
  }

  const weightPoints = (weights.data ?? []).map((w) => ({
    x: Date.parse(w.logged_at),
    y: Number(w.weight_kg),
  }));

  const todayDow = (new Date().getDay() + 6) % 7;

  return (
    <main className="flex flex-col gap-5">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-sm text-muted">{greeting()},</p>
          <h1 className="font-display text-[26px] capitalize leading-tight tracking-tight">
            {me.data?.name ?? "…"}
          </h1>
        </div>
        {/* Week strip */}
        <div className="flex gap-1.5 pb-1">
          {DAY_LETTERS.map((l, i) => {
            const trained = weekDots.data?.dots.has(i);
            const isToday = i === todayDow;
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <span
                  className={`text-[9px] ${isToday ? "text-fg" : "text-faint"}`}
                >
                  {l}
                </span>
                <span
                  className={`h-2 w-2 rounded-full ${
                    trained
                      ? "bg-accent shadow-glow-sm"
                      : isToday
                        ? "border border-line-strong"
                        : "bg-surface-2"
                  }`}
                />
              </div>
            );
          })}
        </div>
      </header>

      {/* Race countdown chip */}
      {nextRace && raceDaysOut !== null && (
        <Link
          href="/race"
          className="flex items-center gap-2 self-start rounded-full bg-surface-1 px-3 py-1.5 text-xs"
        >
          <Flag className="h-3.5 w-3.5 text-accent" />
          <span className="font-bold tabular-nums text-accent">
            {raceDaysOut} days
          </span>
          <span className="text-muted">· {nextRace.name}</span>
        </Link>
      )}

      {/* In-progress banner: a session was started but never finished */}
      {inProgress.data && (
        <Card className="border-l-2 border-l-accent">
          <CardLabel>In progress</CardLabel>
          <p className="mt-1 font-display text-lg leading-tight">
            {inProgressDayName.data ?? "Workout"}
          </p>
          <p className="text-xs text-faint">
            started{" "}
            {Math.max(
              1,
              Math.round(
                (Date.now() - Date.parse(inProgress.data.started_at)) / 60000,
              ),
            )}{" "}
            min ago
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => router.push(`/session/${inProgress.data!.id}`)}
            >
              Resume
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => setDiscardPrompt(true)}
            >
              Discard
            </Button>
          </div>
        </Card>
      )}

      {/* Today card */}
      {programs.loading || (activeProgram && (days.loading || nextDay.loading)) ? (
        <SkeletonCard lines={4} />
      ) : (
        <Card glow={!!displayDay} className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent/10 blur-3xl"
          />
          <div className="flex items-center justify-between">
            <CardLabel>Today</CardLabel>
            {(days.data ?? []).filter((d) => !d.rest_day).length > 1 && (
              <button
                type="button"
                className="-m-2 flex items-center gap-1 p-2 text-xs text-muted"
                onClick={() => setShowDayPicker(true)}
              >
                <Repeat className="h-3.5 w-3.5" />
                Change
              </button>
            )}
          </div>
          {!activeProgram ? (
            <div className="mt-3 flex flex-col gap-4">
              <p className="text-sm text-muted">
                No active program yet — build one and Overload will prescribe
                every workout.
              </p>
              <Link href="/programs">
                <Button variant="primary" size="lg" className="w-full">
                  Build your program
                </Button>
              </Link>
            </div>
          ) : displayDay ? (
            <div className="mt-2 flex flex-col gap-4">
              <p className="font-display text-[28px] leading-tight">
                {displayDay.name}
              </p>
              <ul className="flex flex-col gap-2 text-sm">
                {displayDay.program_exercises.map((pe) => {
                  const f = forecasts.data?.find(
                    (ft) => ft.exercise_id === pe.exercise_id,
                  );
                  const rx = f ? prescribeToday(f, pe.target_reps_high) : null;
                  return (
                    <li
                      key={pe.id}
                      className="flex items-center justify-between"
                    >
                      <span className="text-muted">{pe.exercises.name}</span>
                      <span className="flex items-center gap-2 tabular-nums">
                        <span className="text-faint">
                          {pe.target_sets}×{pe.target_reps_low}–
                          {pe.target_reps_high}
                        </span>
                        {rx && (
                          <span className="rounded-md bg-accent/15 px-2 py-0.5 font-bold text-accent">
                            {rx.workingWeightKg} kg
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <Button
                variant="primary"
                size="lg"
                onClick={() => startSession(displayDay.id)}
              >
                START WORKOUT
              </Button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">
              Add days to your program first.
            </p>
          )}
        </Card>
      )}

      {/* Key lift status vs forecast */}
      <KeyLiftStrip forecasts={forecasts.data ?? []} />

      {/* Body weight quick-log + sparkline */}
      <Card>
        <div className="flex items-center justify-between">
          <CardLabel>Body weight</CardLabel>
          {lastWeight && (
            <span className="text-xs text-faint">
              last {Number(lastWeight.weight_kg).toFixed(1)} kg
            </span>
          )}
        </div>
        {logWeight === null ? (
          <Button
            className="mt-3 w-full"
            onClick={() =>
              setLogWeight(lastWeight ? Number(lastWeight.weight_kg) : 80)
            }
          >
            <Scale className="h-4 w-4" />
            {lastWeight?.logged_at === todayISO()
              ? "Edit today's weight"
              : "Log today's weight"}
          </Button>
        ) : (
          <div className="mt-3 flex items-center justify-between gap-2">
            <NumberStepper
              value={logWeight}
              onChange={setLogWeight}
              step={0.1}
              min={30}
              max={250}
              suffix="kg"
              ariaLabel="body weight"
            />
            <Button
              variant="primary"
              disabled={savingWeight}
              onClick={saveWeight}
            >
              Save
            </Button>
          </div>
        )}
        {weightPoints.length > 1 && (
          <div className="mt-3">
            <LineChart
              series={[
                {
                  points: weightPoints.slice(-30),
                  color: "var(--color-accent)",
                  dots: true,
                  area: true,
                },
              ]}
              height={90}
            />
          </div>
        )}
      </Card>

      {/* Nutrition + steps quick-log */}
      <DailyLogCard />

      {showDayPicker && days.data && (
        <DayPickerSheet
          days={days.data}
          phases={phases.data ?? []}
          suggestedId={nextDay.data?.id}
          trainedThisWeek={weekDots.data?.dayIds}
          onPick={(d) => {
            setOverrideDay(d);
            setShowDayPicker(false);
          }}
          onClose={() => setShowDayPicker(false)}
        />
      )}

      {resumePrompt && (
        <ConfirmSheet
          title="Workout already in progress"
          body="Finish or discard it before starting a new one."
          confirmLabel="Resume workout"
          confirmVariant="primary"
          cancelLabel="Not now"
          onConfirm={() => router.push(`/session/${resumePrompt}`)}
          onClose={() => setResumePrompt(null)}
        />
      )}

      {discardPrompt && inProgress.data && (
        <ConfirmSheet
          title="Discard workout?"
          body="All sets logged in this session will be deleted."
          confirmLabel="Discard workout"
          onConfirm={async () => {
            await discardSession(db, inProgress.data!.id);
            setDiscardPrompt(false);
            inProgress.refetch();
            weekDots.refetch();
            nextDay.refetch();
          }}
          onClose={() => setDiscardPrompt(false)}
        />
      )}
    </main>
  );
}

function KeyLiftStrip({ forecasts }: { forecasts: TForecastTarget[] }) {
  const db = useMemo(() => createClient(), []);
  const status = useQuery(async () => {
    if (forecasts.length === 0) return [];
    const out: { name: string; deltaKg: number }[] = [];
    for (const f of forecasts.slice(0, 4)) {
      const { data: ex } = await db
        .from("exercises")
        .select("name")
        .eq("id", f.exercise_id)
        .single();
      const { data: sets } = await db
        .from("set_logs")
        .select("reps, weight_kg, is_warmup, completed_at")
        .eq("exercise_id", f.exercise_id)
        .order("completed_at", { ascending: false })
        .limit(15);
      const actual = sessionE1RM(
        (sets ?? []).map((s) => ({
          reps: s.reps,
          weightKg: Number(s.weight_kg),
          isWarmup: s.is_warmup,
        })),
      );
      if (actual !== null && ex) {
        const target = prescribeToday(f, 1).targetOneRepMaxKg;
        out.push({ name: ex.name, deltaKg: actual - target });
      }
    }
    return out;
  }, [forecasts.length]);

  if (!status.data || status.data.length === 0) return null;

  return (
    <section className="-mx-4 flex gap-2 overflow-x-auto px-4">
      {status.data.map((s) => (
        <StatBadge key={s.name} label={s.name} deltaKg={s.deltaKg} />
      ))}
    </section>
  );
}
