"use client";

import { useEffect, useRef, useState } from "react";
import { ProgressRing } from "./ProgressRing";

/**
 * Auto-starts on mount (i.e. when a set is completed). A draining ring +
 * big countdown — iOS Safari has no vibration API, so color and size carry
 * the signal.
 */
export function RestTimer({
  seconds = 90,
  onDone,
}: {
  seconds?: number;
  onDone?: () => void;
}) {
  const [left, setLeft] = useState(seconds);
  const doneRef = useRef(false);

  useEffect(() => {
    setLeft(seconds);
    doneRef.current = false;
    const startedAt = Date.now();
    const id = setInterval(() => {
      const remaining = seconds - Math.floor((Date.now() - startedAt) / 1000);
      setLeft(Math.max(0, remaining));
      if (remaining <= 0 && !doneRef.current) {
        doneRef.current = true;
        onDone?.();
        clearInterval(id);
      }
    }, 250);
    return () => clearInterval(id);
  }, [seconds, onDone]);

  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");
  const urgent = left <= 10 && left > 0;
  const done = left === 0;

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-bg/85 p-1.5 backdrop-blur-xl ${
        done ? "animate-[pulse-glow_1.2s_ease-in-out_infinite]" : ""
      }`}
      role="timer"
      aria-live="polite"
    >
      <ProgressRing
        progress={left / seconds}
        size={84}
        stroke={5}
        color={
          done
            ? "var(--color-accent)"
            : urgent
              ? "var(--color-warn)"
              : "var(--color-accent)"
        }
      >
        <div className="flex flex-col items-center leading-none">
          <span
            className={`font-display text-xl tabular-nums ${
              done ? "text-accent" : urgent ? "text-warn" : ""
            }`}
          >
            {done ? "GO" : `${mm}:${ss}`}
          </span>
          {!done && <span className="mt-0.5 text-[9px] text-faint">REST</span>}
        </div>
      </ProgressRing>
    </div>
  );
}
