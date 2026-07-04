"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Check, ChevronRight, Moon, Play } from "lucide-react";
import {
  currentPhase,
  planTotalWeeks,
  planWeekNumber,
} from "@gym-planner/core/hyrox";
import { createClient } from "../../../lib/supabase/client";
import { useQuery } from "../../../lib/useQuery";
import {
  fetchChecklist,
  fetchPhases,
  fetchProgramDays,
  fetchPrograms,
  startOfWeekISO,
  startProgramDaySession,
  todayISO,
  toggleChecklistItem,
} from "../../../lib/data";
import { Card, CardLabel } from "../../../components/Card";
import { SkeletonCard } from "../../../components/Skeleton";
import { PhaseTimeline } from "../../../components/PhaseTimeline";
import { ProgressRing } from "../../../components/ProgressRing";
import { Button } from "../../../components/Button";
import { ConfirmSheet } from "../../../components/ConfirmSheet";

export default function PlanPage() {
  const db = useMemo(() => createClient(), []);
  const router = useRouter();
  const today = todayISO();
  const [resumePrompt, setResumePrompt] = useState<string | null>(null);

  async function startDay(dayId: string) {
    const result = await startProgramDaySession(db, dayId);
    if (result.kind === "started") {
      router.push(`/session/${result.id}`);
    } else {
      setResumePrompt(result.session.id);
    }
  }

  const programs = useQuery(() => fetchPrograms(db), []);
  const activeProgram = programs.data?.find((p) => p.status === "active");

  const phases = useQuery(
    () =>
      activeProgram
        ? fetchPhases(db, activeProgram.id)
        : Promise.resolve([]),
    [activeProgram?.id],
  );
  const days = useQuery(
    () =>
      activeProgram
        ? fetchProgramDays(db, activeProgram.id)
        : Promise.resolve([]),
    [activeProgram?.id],
  );

  // Which program days were trained this week (done dots).
  const trainedThisWeek = useQuery(async () => {
    const { data } = await db
      .from("workout_sessions")
      .select("source_id")
      .eq("source_type", "program_day")
      .gte("started_at", startOfWeekISO());
    return new Set((data ?? []).map((s) => s.source_id as string));
  }, []);

  const phase =
    phases.data && phases.data.length > 0
      ? currentPhase(phases.data, today)
      : null;
  const phaseDays = (days.data ?? []).filter(
    (d) => phase && d.phase_id === phase.id,
  );

  const totalWeeks =
    activeProgram && phases.data && phases.data.length > 0
      ? planTotalWeeks(
          phases.data[0]!.start_date,
          phases.data[phases.data.length - 1]!.end_date,
        )
      : null;
  const weekNum =
    activeProgram && totalWeeks
      ? Math.min(planWeekNumber(activeProgram.start_date, today), totalWeeks)
      : null;

  return (
    <main className="flex flex-col gap-5">
      <h1 className="font-display text-2xl tracking-tight">Plan</h1>

      {programs.loading || phases.loading ? (
        <SkeletonCard lines={4} />
      ) : !activeProgram ? (
        <Card>
          <p className="text-sm text-muted">
            No active program. Build one to see your plan here.
          </p>
          <Link href="/programs">
            <Button variant="primary" size="lg" className="mt-4 w-full">
              Build a program
            </Button>
          </Link>
        </Card>
      ) : (
        <>
          {/* Timeline */}
          <Card glow className="relative overflow-hidden">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent/10 blur-3xl"
            />
            <div className="flex items-baseline justify-between">
              <CardLabel>{activeProgram.name}</CardLabel>
              {weekNum && totalWeeks && (
                <span className="font-display text-sm">
                  Week {weekNum}{" "}
                  <span className="text-faint">of {totalWeeks}</span>
                </span>
              )}
            </div>
            {phases.data && phases.data.length > 0 ? (
              <div className="mt-4">
                <PhaseTimeline phases={phases.data} todayISO={today} />
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">
                This program has no phases — days rotate in order.
              </p>
            )}
            {phase && (
              <div className="mt-4">
                <p className="font-display text-[22px] leading-tight">
                  {phase.name}
                </p>
                {phase.focus && (
                  <p className="mt-1 text-sm text-muted">{phase.focus}</p>
                )}
                <p className="mt-1 text-xs text-faint">
                  {new Date(
                    `${phase.start_date}T00:00:00`,
                  ).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  –{" "}
                  {new Date(`${phase.end_date}T00:00:00`).toLocaleDateString(
                    undefined,
                    { month: "short", day: "numeric" },
                  )}
                </p>
              </div>
            )}
          </Card>

          {/* This week's sessions */}
          {phaseDays.length > 0 && (
            <Card>
              <CardLabel>This week</CardLabel>
              <ul className="mt-3 flex flex-col gap-2">
                {phaseDays.map((d) => {
                  const done = trainedThisWeek.data?.has(d.id);
                  return (
                    <li
                      key={d.id}
                      className={`flex items-center gap-3 rounded-xl p-3 ${
                        done ? "bg-accent/10" : "bg-surface-2/50"
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                          done
                            ? "bg-accent text-black"
                            : d.rest_day
                              ? "bg-surface-2 text-faint"
                              : "border border-line-strong text-faint"
                        }`}
                      >
                        {done ? (
                          <Check className="h-4 w-4" strokeWidth={3} />
                        ) : d.rest_day ? (
                          <Moon className="h-3.5 w-3.5" />
                        ) : null}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {d.name}
                        </p>
                        {!d.rest_day && (
                          <p className="text-xs text-faint">
                            {d.program_exercises.length} movement
                            {d.program_exercises.length === 1 ? "" : "s"}
                          </p>
                        )}
                      </div>
                      {!d.rest_day && (
                        <button
                          type="button"
                          aria-label={`start ${d.name}`}
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform duration-100 active:scale-95 ${
                            done
                              ? "bg-surface-2 text-muted"
                              : "bg-accent text-black shadow-glow-sm"
                          }`}
                          onClick={() => startDay(d.id)}
                        >
                          <Play className="ml-0.5 h-5 w-5" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-xs text-faint">
                3 sessions is the floor, 4 when fresh.
              </p>
            </Card>
          )}

          <ChecklistSection />

          <Link
            href="/programs"
            className="flex items-center justify-between rounded-xl bg-surface-1 p-4 text-sm text-muted"
          >
            Manage programs
            <ChevronRight className="h-4 w-4 text-faint" />
          </Link>
        </>
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
    </main>
  );
}

function ChecklistSection() {
  const db = useMemo(() => createClient(), []);
  const items = useQuery(() => fetchChecklist(db), []);

  if (!items.data || items.data.length === 0) return null;
  const doneCount = items.data.filter((i) => i.done).length;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardLabel>Pro-ready checklist</CardLabel>
        <ProgressRing
          progress={doneCount / items.data.length}
          size={40}
          stroke={4}
        >
          <span className="text-[10px] font-bold tabular-nums">
            {doneCount}/{items.data.length}
          </span>
        </ProgressRing>
      </div>
      <ul className="mt-3 flex flex-col">
        {items.data.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="flex w-full items-center gap-3 border-t border-line py-3 text-left first:border-t-0"
              onClick={async () => {
                await toggleChecklistItem(db, item.id, !item.done);
                items.refetch();
              }}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors duration-100 ${
                  item.done
                    ? "bg-accent text-black"
                    : "border border-line-strong"
                }`}
              >
                {item.done && <Check className="h-4 w-4" strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-sm ${
                    item.done ? "text-faint line-through" : "text-fg"
                  }`}
                >
                  {item.label}
                </span>
                {item.target_text && (
                  <span className="block text-xs text-faint">
                    {item.target_text}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-faint">
        The long game — check these off as they land on the road to Pro.
      </p>
    </Card>
  );
}
