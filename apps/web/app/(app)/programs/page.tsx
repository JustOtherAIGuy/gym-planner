"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Archive, ArchiveRestore, ChevronRight, Dumbbell } from "lucide-react";
import { createClient } from "../../../lib/supabase/client";
import { useQuery } from "../../../lib/useQuery";
import { fetchPrograms, todayISO } from "../../../lib/data";
import { Button } from "../../../components/Button";
import { SkeletonCard } from "../../../components/Skeleton";

export default function ProgramsPage() {
  const db = useMemo(() => createClient(), []);
  const programs = useQuery(() => fetchPrograms(db), []);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function createProgram(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    const {
      data: { user },
    } = await db.auth.getUser();
    if (user) {
      await db.from("programs").insert({
        user_id: user.id,
        name: name.trim(),
        start_date: todayISO(),
      });
      setName("");
      programs.refetch();
    }
    setCreating(false);
  }

  async function setStatus(id: string, status: "active" | "archived") {
    await db.from("programs").update({ status }).eq("id", id);
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
            className="flex items-center rounded-card border border-line bg-surface-1 p-4"
          >
            <Link
              href={`/programs/${p.id}`}
              className="flex flex-1 items-center gap-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.name}</p>
                <p className="text-xs text-faint">
                  started {p.start_date}
                  {p.status === "archived" && " · archived"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
            </Link>
            <button
              type="button"
              aria-label={p.status === "active" ? "Archive" : "Activate"}
              className="ml-2 flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2 text-muted"
              onClick={() =>
                setStatus(p.id, p.status === "active" ? "archived" : "active")
              }
            >
              {p.status === "active" ? (
                <Archive className="h-4 w-4" />
              ) : (
                <ArchiveRestore className="h-4 w-4" />
              )}
            </button>
          </li>
        ))}
        {programs.data?.length === 0 && (
          <li className="flex flex-col items-center gap-3 rounded-card border border-line p-8 text-center">
            <Dumbbell className="h-8 w-8 text-faint" />
            <p className="text-sm text-muted">
              No programs yet — name one above and build out its days.
            </p>
          </li>
        )}
      </ul>
    </main>
  );
}
