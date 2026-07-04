"use client";

import { useMemo, useState } from "react";
import type { TRace } from "@gym-planner/core/schemas";
import { createClient } from "../lib/supabase/client";
import { todayISO } from "../lib/data";
import { Button } from "./Button";
import { Sheet } from "./Sheet";

const DIVISIONS = ["open", "pro", "doubles", "relay"] as const;
const STATUSES = ["waitlist", "registered", "backup"] as const;

function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex gap-1 rounded-lg bg-surface-2 p-0.5 text-xs"
    >
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          className={`flex-1 rounded-md px-2 py-2 font-medium capitalize transition-colors duration-100 ${
            value === o ? "bg-accent text-black" : "text-faint"
          }`}
          onClick={() => onChange(o)}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

/** Add/edit a race. `completed` status is only ever set by result entry. */
export function RaceFormSheet({
  initial,
  onSaved,
  onClose,
}: {
  initial?: TRace;
  onSaved: () => void;
  onClose: () => void;
}) {
  const db = useMemo(() => createClient(), []);
  const [name, setName] = useState(initial?.name ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [eventDate, setEventDate] = useState(
    initial?.event_date ?? todayISO(),
  );
  const [division, setDivision] = useState<(typeof DIVISIONS)[number]>(
    (initial?.division as (typeof DIVISIONS)[number]) ?? "open",
  );
  const [status, setStatus] = useState<(typeof STATUSES)[number]>(
    initial && initial.status !== "completed"
      ? (initial.status as (typeof STATUSES)[number])
      : "registered",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim() || !eventDate) return;
    setSaving(true);
    setError(null);
    const row = {
      name: name.trim(),
      location: location.trim() === "" ? null : location.trim(),
      event_date: eventDate,
      division,
      // Editing a completed race keeps its completed status.
      ...(initial?.status === "completed" ? {} : { status }),
    };
    let e: { message: string } | null;
    if (initial) {
      ({ error: e } = await db
        .from("races")
        .update(row)
        .eq("id", initial.id));
    } else {
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!user) return;
      ({ error: e } = await db
        .from("races")
        .insert({ ...row, user_id: user.id }));
    }
    setSaving(false);
    if (e) {
      setError(e.message);
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <Sheet title={initial ? "Edit race" : "Add race"} onClose={onClose}>
      <div className="flex flex-col gap-3 p-5">
        <input
          autoFocus={!initial}
          type="text"
          placeholder="Race name (e.g. HYROX Toronto)"
          maxLength={96}
          className="h-12 rounded-xl bg-surface-2 px-4 outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-accent"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="text"
          placeholder="Location (optional)"
          maxLength={96}
          className="h-12 rounded-xl bg-surface-2 px-4 outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-accent"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <input
          type="date"
          aria-label="event date"
          className="h-12 rounded-xl bg-surface-2 px-4 outline-none focus-visible:ring-2 focus-visible:ring-accent"
          style={{ colorScheme: "dark" }}
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
        />
        <Segmented
          options={DIVISIONS}
          value={division}
          onChange={setDivision}
          ariaLabel="division"
        />
        {initial?.status !== "completed" && (
          <Segmented
            options={STATUSES}
            value={status}
            onChange={setStatus}
            ariaLabel="status"
          />
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button
          variant="primary"
          size="lg"
          disabled={saving || !name.trim()}
          onClick={save}
        >
          Save race
        </Button>
        <Button variant="ghost" size="lg" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Sheet>
  );
}
