"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/**
 * Screen header with a real back button — iOS standalone PWAs have no
 * system back, so every sub-screen must provide its own way out.
 */
export function PageHeader({
  title,
  titleNode,
  backHref,
  right,
}: {
  title: string;
  /** Replaces the plain title text (e.g. an InlineEdit) — title stays for a11y. */
  titleNode?: React.ReactNode;
  backHref?: string;
  right?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <header className="flex items-center gap-2">
      {backHref !== undefined && (
        <button
          type="button"
          aria-label="Back"
          className="-ml-2 flex h-11 w-11 items-center justify-center rounded-xl text-muted active:bg-surface-2"
          onClick={() =>
            backHref ? router.push(backHref) : router.back()
          }
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      <h1 className="min-w-0 flex-1 truncate font-display text-2xl tracking-tight">
        {titleNode ?? title}
      </h1>
      {right}
    </header>
  );
}
