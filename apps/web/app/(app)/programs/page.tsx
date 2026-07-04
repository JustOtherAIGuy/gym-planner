"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Archive, ChevronRight } from "lucide-react";
import type { TProgram } from "@gym-planner/core/schemas";
import { EmptyState } from "../../../components/EmptyState";
import { createClient } from "../../../lib/supabase/client";
import { useQuery } from "../../../lib/useQuery";
import { activateProgram, fetchPrograms, todayISO } from "../../../lib/data";
import { Button } from "../../../components/Button";
import { ConfirmSheet } from "../../../components/ConfirmSheet";
import { SkeletonCard } from "../../../components/Skeleton";

export default function ProgramsPage() {
  const db = useMemo(() => createClient(), []);
  const programs = useQuery(() => fetchPrograms(db), []);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [activating, setActivating] = useState<TProgram | null>(null);

  const currentActive = programs.data?.find((p) => p.status === "active");

  async function createProgram(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    const {
      data: { user },
    } = await db.auth.getUser();
    if (user) {
      const { data } = await db
        .from("programs")
        .insert({
          user_id: user.id,
          name: name.trim(),
          start_date: todayISO(),
        })
        .select("id")
        .single();
      // A new program starts active — make that exclusive, never a second one.
      if (data) await activateProgram(db, data.id as string);
      setName("");
      programs.refetch();
    }
    setCreating(false);
  }

  async function archive(id: string) {
    await db.from("programs").update({ status: "archived" }).eq("id", id);
    programs.refetch();
  }

  return (
    <main className="flex flex-col gap-5">
      <h1 className="font-display text-2xl tracking-tight">Programs</h1>

      <form onSubmit={createProgram} className="flex gap-2">
        <input
          type="text"
          placeholder="New program (e.g. PPL Fall Block)"
          className="h-12 flex-1 rounded-xl bg-surface-2 px-4 outline-none placeholder:text-faint"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button
          variant="primary"
          size="lg"
          type="submit"
          disabled={creating || !name.trim()}
          className="h-12"
        >
          Add
        </Button>
      </form>

      {programs.error && (
        <p className="text-sm text-danger">{programs.error}</p>
      )}

      {programs.loading && <SkeletonCard lines={2} />}

      <ul className="flex flex-col gap-3">
        {(programs.data ?? []).map((p) => (
          <li
            key={p.id}
            className={`flex items-center rounded-card border bg-surface-1 p-4 ${
              p.status === "active" ? "border-accent/40" : "border-line"
            }`}
          >
            <Link
              href={`/programs/${p.id}`}
              className="flex min-w-0 flex-1 items-center gap-2"
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2">
                  <span className="truncate font-semibold">{p.name}</span>
                  {p.status === "active" && (
                    <span className="shrink-0 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-accent">
                      Active
                    </span>
                  )}
                </p>
                <p className="text-xs text-faint">
                  {p.status === "active"
                    ? "drives Home & Plan"
                    : "on the shelf"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
            </Link>
            {p.status === "active" ? (
              <button
                type="button"
                aria-label={`archive ${p.name}`}
                className="ml-2 flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2 text-muted"
                onClick={() => archive(p.id)}
              >
                <Archive className="h-4 w-4" />
              </button>
            ) : (
              <Button className="ml-2" onClick={() => setActivating(p)}>
                Activate
              </Button>
            )}
          </li>
        ))}
        {programs.data?.length === 0 && (
          <li>
            <EmptyState
              glyph="squat"
              title="No programs yet"
              hint="Name one above and build out its days."
            />
          </li>
        )}
      </ul>

      {activating && (
        <ConfirmSheet
          title={`Switch to "${activating.name}"?`}
          body={
            currentActive
              ? `Home and Plan will follow it. "${currentActive.name}" moves to the shelf — nothing is deleted, switch back anytime.`
              : "Home and Plan will follow it."
          }
          confirmLabel="Make active"
          confirmVariant="primary"
          onConfirm={async () => {
            await activateProgram(db, activating.id);
            setActivating(null);
            programs.refetch();
          }}
          onClose={() => setActivating(null)}
        />
      )}
    </main>
  );
}
