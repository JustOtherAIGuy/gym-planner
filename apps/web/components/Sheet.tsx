"use client";

/**
 * Shared bottom-sheet shell (same visual language as ExercisePicker):
 * dark scrim (tap to close), rounded-top surface panel, grab handle.
 * `tall` pins the panel to 88dvh for scrollable pickers; otherwise the
 * panel hugs its content (confirms, small forms).
 */
export function Sheet({
  title,
  onClose,
  children,
  tall = false,
}: {
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  tall?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`flex animate-[fade-up_.22s_ease-out] flex-col rounded-t-3xl border-t border-line bg-surface-1 pb-safe ${
          tall ? "h-[88dvh]" : ""
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3">
          <div className="h-1 w-10 rounded-full bg-line-strong" />
        </div>
        {title && (
          <h2 className="px-5 pt-4 font-display text-xl tracking-tight">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );
}
