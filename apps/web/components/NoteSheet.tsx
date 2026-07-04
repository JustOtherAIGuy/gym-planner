"use client";

import { useState } from "react";
import { Button } from "./Button";
import { Sheet } from "./Sheet";

/** Bottom-sheet textarea for prescriptions/notes. Empty saves null. */
export function NoteSheet({
  title,
  initial,
  maxLength = 280,
  onSave,
  onClose,
}: {
  title: string;
  initial: string | null;
  maxLength?: number;
  onSave: (v: string | null) => Promise<void>;
  onClose: () => void;
}) {
  const [text, setText] = useState(initial ?? "");
  const [saving, setSaving] = useState(false);

  return (
    <Sheet title={title} onClose={onClose}>
      <div className="flex flex-col gap-3 p-5">
        <textarea
          autoFocus
          rows={4}
          maxLength={maxLength}
          placeholder="e.g. 6–8×400 m @ ~5:00/km, 90 s jog recovery"
          className="w-full resize-none rounded-xl bg-surface-2 p-3 outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-accent"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <p className="text-right text-xs tabular-nums text-faint">
          {text.length}/{maxLength}
        </p>
        <Button
          variant="primary"
          size="lg"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            await onSave(text.trim() === "" ? null : text.trim());
            setSaving(false);
            onClose();
          }}
        >
          Save
        </Button>
        <Button variant="ghost" size="lg" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Sheet>
  );
}
