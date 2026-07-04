"use client";

import { Glyph } from "./glyphs";
import { resolveGlyph } from "./map";

const SIZE = {
  sm: { chip: "h-7 w-7 rounded-md", icon: "h-4.5 w-4.5" },
  md: { chip: "h-9 w-9 rounded-lg", icon: "h-5.5 w-5.5" },
  lg: { chip: "h-11 w-11 rounded-xl", icon: "h-7 w-7" },
} as const;

const TINT = {
  strength: "bg-surface-2 text-muted",
  cardio: "bg-info/10 text-info",
  station: "bg-accent/10 text-accent",
} as const;

/**
 * Exercise pictogram in a modality-tinted chip — the app's movement
 * identity mark. Resolves the glyph from slug → cardio kind → free label.
 */
export function MovementChip({
  slug,
  kind,
  label,
  modality = "strength",
  size = "sm",
  className = "",
}: {
  slug?: string | null;
  kind?: string | null;
  label?: string | null;
  modality?: "strength" | "cardio" | "station";
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const s = SIZE[size];
  return (
    <span
      className={`flex shrink-0 items-center justify-center ${s.chip} ${TINT[modality]} ${className}`}
    >
      <Glyph name={resolveGlyph({ slug, kind, label })} className={s.icon} />
    </span>
  );
}
