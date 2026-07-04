"use client";

import { Glyph, type GlyphName } from "./pictograms/glyphs";

/** Illustrated empty state: pictogram in a dashed volt ring. */
export function EmptyState({
  glyph,
  title,
  hint,
  action,
}: {
  glyph: GlyphName;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-line p-8 text-center">
      <span className="flex h-20 w-20 animate-[pulse-glow_5s_ease-in-out_infinite] items-center justify-center rounded-full border border-dashed border-accent/40">
        <Glyph name={glyph} className="h-9 w-9 text-accent" />
      </span>
      <p className="text-sm font-semibold">{title}</p>
      {hint && <p className="-mt-1 text-sm text-muted">{hint}</p>}
      {action}
    </div>
  );
}
