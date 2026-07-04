import type { TCardioKind, TCardioStyle } from "@gym-planner/core/schemas";

// Offline logging buffer for the session runner. Records that fail to insert
// (gym dead zones) are queued here and flushed on the next action/visit.

export type PendingSet = {
  session_id: string;
  exercise_id: string;
  order_index: number;
  set_index: number;
  reps: number;
  weight_kg: number;
  is_warmup: boolean;
  completed_at: string;
};

export type PendingCardio = {
  user_id: string;
  session_id: string;
  exercise_id: string;
  kind: TCardioKind;
  style: TCardioStyle | null;
  distance_m: number | null;
  duration_sec: number | null;
  load_kg: number | null;
  order_index: number;
  set_index: number;
  logged_at: string;
};

// clientKey lives on the wrapper (never inserted) so a buffered record can be
// undone before it flushes. Old entries without a key still flush fine.
export type PendingRecord =
  | { table: "set_logs"; record: PendingSet; clientKey?: string }
  | { table: "cardio_logs"; record: PendingCardio; clientKey?: string };

// v2 buffer holds both log tables; v1 held bare set_logs rows.
export const bufferKey = (sessionId: string) =>
  `gym-planner:pending2:${sessionId}`;
export const legacyBufferKey = (sessionId: string) =>
  `gym-planner:pending:${sessionId}`;

export function readBuffer(sessionId: string): PendingRecord[] {
  const raw = localStorage.getItem(bufferKey(sessionId));
  return raw ? (JSON.parse(raw) as PendingRecord[]) : [];
}

export function writeBuffer(sessionId: string, records: PendingRecord[]): void {
  if (records.length === 0) {
    localStorage.removeItem(bufferKey(sessionId));
  } else {
    localStorage.setItem(bufferKey(sessionId), JSON.stringify(records));
  }
}

export function appendBuffered(sessionId: string, rec: PendingRecord): void {
  writeBuffer(sessionId, [...readBuffer(sessionId), rec]);
}

/** Remove one buffered record by clientKey. Returns false if already flushed. */
export function removeBuffered(sessionId: string, clientKey: string): boolean {
  const records = readBuffer(sessionId);
  const next = records.filter((r) => r.clientKey !== clientKey);
  if (next.length === records.length) return false;
  writeBuffer(sessionId, next);
  return true;
}

/** Drop everything buffered for a session (v2 and legacy v1). */
export function clearBuffer(sessionId: string): void {
  localStorage.removeItem(bufferKey(sessionId));
  localStorage.removeItem(legacyBufferKey(sessionId));
}
