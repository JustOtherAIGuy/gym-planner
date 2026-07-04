"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

/**
 * Tap-to-rename text. Renders the value with a faint pencil; tapping swaps to
 * an input (select-all). Enter/blur saves trimmed non-empty text, Esc cancels.
 */
export function InlineEdit({
  value,
  onSave,
  ariaLabel,
  maxLength = 96,
  className = "",
}: {
  value: string;
  onSave: (v: string) => Promise<void> | void;
  ariaLabel: string;
  maxLength?: number;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  async function commit() {
    const v = draft.trim();
    setEditing(false);
    if (v && v !== value) await onSave(v);
    else setDraft(value);
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="text"
        aria-label={ariaLabel}
        maxLength={maxLength}
        className={`w-full min-w-0 rounded-lg bg-surface-2 px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-accent ${className}`}
        value={draft}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      aria-label={`rename ${ariaLabel}`}
      className={`flex min-w-0 items-center gap-1.5 text-left ${className}`}
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
    >
      <span className="truncate">{value}</span>
      <Pencil className="h-3.5 w-3.5 shrink-0 text-faint" />
    </button>
  );
}
