"use client";

import { useMemo, useState } from "react";
import { Flame, Footprints, NotebookPen } from "lucide-react";
import { createClient } from "../lib/supabase/client";
import { useQuery } from "../lib/useQuery";
import {
  fetchDailyLogs,
  fetchMetricTargets,
  todayISO,
  upsertDailyLog,
} from "../lib/data";
import { Button } from "./Button";
import { Card, CardLabel } from "./Card";
import { NumberStepper } from "./NumberStepper";

type Draft = {
  calories: number;
  protein_g: number;
  fat_g: number;
  steps: number;
};

/** One-tap daily quick log: calories, protein, fat, steps — one row per day. */
export function DailyLogCard() {
  const db = useMemo(() => createClient(), []);
  const logs = useQuery(() => fetchDailyLogs(db, 30), []);
  const targets = useQuery(() => fetchMetricTargets(db), []);

  const today = logs.data?.find((l) => l.logged_at === todayISO());
  const latest = logs.data?.[0];

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  function openForm() {
    const fallback = today ?? latest;
    setDraft({
      calories:
        fallback?.calories ??
        Number(targets.data?.calories_rest?.target_low ?? 2300),
      protein_g:
        fallback?.protein_g ??
        Number(targets.data?.protein_g?.target_low ?? 150),
      fat_g: fallback?.fat_g ?? Number(targets.data?.fat_g?.target_low ?? 65),
      steps: fallback?.steps ?? 8000,
    });
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    const {
      data: { user },
    } = await db.auth.getUser();
    if (user) {
      await upsertDailyLog(db, user.id, { logged_at: todayISO(), ...draft });
      logs.refetch();
    }
    setSaving(false);
    setDraft(null);
  }

  const proteinLow = Number(targets.data?.protein_g?.target_low ?? 0);
  const stepsLow = Number(targets.data?.steps?.target_low ?? 0);

  const chips: { label: string; value: string; hit?: boolean }[] = today
    ? [
        {
          label: "kcal",
          value: today.calories != null ? String(today.calories) : "–",
        },
        {
          label: "protein",
          value: today.protein_g != null ? `${today.protein_g} g` : "–",
          hit:
            today.protein_g != null && proteinLow > 0
              ? today.protein_g >= proteinLow
              : undefined,
        },
        {
          label: "fat",
          value: today.fat_g != null ? `${today.fat_g} g` : "–",
        },
        {
          label: "steps",
          value:
            today.steps != null ? today.steps.toLocaleString() : "–",
          hit:
            today.steps != null && stepsLow > 0
              ? today.steps >= stepsLow
              : undefined,
        },
      ]
    : [];

  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardLabel>Fuel &amp; steps</CardLabel>
        {today && draft === null && (
          <button
            type="button"
            className="text-xs text-faint underline-offset-2 active:underline"
            onClick={openForm}
          >
            Edit
          </button>
        )}
      </div>

      {draft === null ? (
        today ? (
          <div className="mt-3 grid grid-cols-4 gap-2">
            {chips.map((c) => (
              <div
                key={c.label}
                className="flex flex-col items-center rounded-lg bg-surface-2 px-1 py-2"
              >
                <span
                  className={`text-sm font-bold tabular-nums ${
                    c.hit === undefined
                      ? "text-fg"
                      : c.hit
                        ? "text-accent"
                        : "text-warn"
                  }`}
                >
                  {c.value}
                </span>
                <span className="text-[10px] text-faint">{c.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <Button className="mt-3 w-full" onClick={openForm}>
            <NotebookPen className="h-4 w-4" />
            Log today&apos;s fuel &amp; steps
          </Button>
        )
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {(
            [
              {
                key: "calories",
                label: "Calories",
                icon: <Flame className="h-4 w-4 text-faint" />,
                step: 50,
                max: 10000,
                suffix: "kcal",
                hint: targets.data?.calories_rest
                  ? `${Number(targets.data.calories_rest.target_low)} rest · ${Number(
                      targets.data.calories_training?.target_low ?? 0,
                    )} training`
                  : undefined,
              },
              {
                key: "protein_g",
                label: "Protein",
                icon: null,
                step: 5,
                max: 500,
                suffix: "g",
                hint: targets.data?.protein_g
                  ? `target ${Number(targets.data.protein_g.target_low)}–${Number(
                      targets.data.protein_g.target_high,
                    )} g`
                  : undefined,
              },
              {
                key: "fat_g",
                label: "Fat",
                icon: null,
                step: 5,
                max: 500,
                suffix: "g",
                hint: targets.data?.fat_g
                  ? `target ${Number(targets.data.fat_g.target_low)}–${Number(
                      targets.data.fat_g.target_high,
                    )} g`
                  : undefined,
              },
              {
                key: "steps",
                label: "Steps",
                icon: <Footprints className="h-4 w-4 text-faint" />,
                step: 500,
                max: 100000,
                suffix: undefined,
                hint: targets.data?.steps
                  ? `${Number(targets.data.steps.target_low) / 1000}–${
                      Number(targets.data.steps.target_high) / 1000
                    }k on off days`
                  : undefined,
              },
            ] as const
          ).map((row) => (
            <div key={row.key} className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="flex items-center gap-1.5 text-sm text-muted">
                  {row.icon}
                  {row.label}
                </span>
                {row.hint && (
                  <span className="text-[10px] text-faint">{row.hint}</span>
                )}
              </div>
              <NumberStepper
                value={draft[row.key]}
                onChange={(v) => setDraft({ ...draft, [row.key]: v })}
                step={row.step}
                min={0}
                max={row.max}
                suffix={row.suffix}
                ariaLabel={row.label}
              />
            </div>
          ))}
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              disabled={saving}
              onClick={save}
            >
              Save
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
