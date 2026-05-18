import { computeTargetWorkingWeight } from "@gym-planner/core/forecast";

export default function Home() {
  const example = computeTargetWorkingWeight({
    baseline: { weeks: 0, value: 80 },
    targets: [
      { weeks: 12, value: 100 },
      { weeks: 24, value: 115 },
    ],
    curve: "linear",
    weeksFromBaseline: 4,
    targetReps: 5,
  });

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Gym Planner</h1>
        <p className="text-sm text-[color:var(--color-muted)]">
          Foundation scaffolded. v0 screens come next.
        </p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-sm uppercase tracking-wider text-[color:var(--color-muted)]">
          Forecast smoke test
        </h2>
        <p className="mt-2 text-lg">
          Baseline 80&nbsp;kg → 100&nbsp;kg @ 12w → 115&nbsp;kg @ 24w
        </p>
        <p className="mt-1 text-sm text-[color:var(--color-muted)]">
          At week 4, target top set × 5:
        </p>
        <p className="mt-1 text-4xl font-bold tabular-nums">
          {example.workingWeightKg} kg
        </p>
        <p className="mt-1 text-xs text-[color:var(--color-muted)]">
          Estimated 1RM target: {example.targetOneRepMaxKg.toFixed(1)} kg
        </p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm leading-relaxed text-[color:var(--color-muted)]">
        <p>
          Next steps: Supabase project + magic-link auth + programs UI +
          session runner. See <code>README.md</code>.
        </p>
      </section>
    </main>
  );
}
