"use client";

import { useState } from "react";
import { Button } from "./Button";
import { Sheet } from "./Sheet";

/**
 * In-app confirmation sheet — the app never uses browser confirm().
 * One confirm action (danger by default) + a ghost cancel.
 */
export function ConfirmSheet({
  title,
  body,
  confirmLabel,
  confirmVariant = "danger",
  cancelLabel = "Cancel",
  onConfirm,
  onClose,
}: {
  title: string;
  body?: string;
  confirmLabel: string;
  confirmVariant?: "danger" | "primary";
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <Sheet title={title} onClose={onClose}>
      <div className="flex flex-col gap-3 p-5">
        {body && <p className="text-sm text-muted">{body}</p>}
        <Button
          variant={confirmVariant}
          size="lg"
          className="w-full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
            } finally {
              setBusy(false);
            }
          }}
        >
          {confirmLabel}
        </Button>
        <Button variant="ghost" size="lg" className="w-full" onClick={onClose}>
          {cancelLabel}
        </Button>
      </div>
    </Sheet>
  );
}
