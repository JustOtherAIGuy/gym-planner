/** Shimmer placeholder — use instead of "Loading…" text anywhere data loads. */
export function Skeleton({
  className = "h-4 w-full",
}: {
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={`animate-[shimmer_1.6s_linear_infinite] rounded-lg bg-[linear-gradient(100deg,transparent_20%,rgba(255,255,255,0.06)_50%,transparent_80%)] bg-[length:200%_100%] bg-surface-2 ${className}`}
    />
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-line bg-surface-1 p-5">
      <Skeleton className="h-3 w-24" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={i === lines - 1 ? "h-4 w-1/2" : "h-4"} />
      ))}
    </div>
  );
}
