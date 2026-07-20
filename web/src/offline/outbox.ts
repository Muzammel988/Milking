import { api } from "../api/client";
import type { BreedingEventType, HealthEventType, MilkSession } from "../api/types";

export type OutboxAction =
  | { kind: "milk"; payload: { farmId: string; animalId?: string; recordDate: string; session: MilkSession; yieldLiters: number; fatPct?: number; proteinPct?: number } }
  | { kind: "breeding"; payload: { animalId: string; type: BreedingEventType; eventDate: string; notes?: string; result?: "POSITIVE" | "NEGATIVE" | "INCONCLUSIVE" } }
  | { kind: "health"; payload: { animalId: string; type: HealthEventType; eventDate: string; medicineId?: string; vaccineId?: string; notes?: string } };

export interface OutboxEntry {
  id: string;
  action: OutboxAction;
  createdAt: string;
  status: "pending" | "syncing" | "failed";
  lastError?: string;
  label: string;
}

const STORAGE_KEY = "milking.outbox";
type Listener = (entries: OutboxEntry[]) => void;
const listeners = new Set<Listener>();

function read(): OutboxEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function write(entries: OutboxEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  listeners.forEach((l) => l(entries));
}

export function subscribeOutbox(listener: Listener): () => void {
  listeners.add(listener);
  listener(read());
  return () => listeners.delete(listener);
}

export function getOutbox(): OutboxEntry[] {
  return read();
}

export function enqueue(action: OutboxAction, label: string): OutboxEntry {
  const entry: OutboxEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action,
    createdAt: new Date().toISOString(),
    status: "pending",
    label,
  };
  write([...read(), entry]);
  void flushOutbox();
  return entry;
}

async function send(action: OutboxAction): Promise<void> {
  switch (action.kind) {
    case "milk":
      await api.createMilkRecord(action.payload);
      return;
    case "breeding":
      await api.createBreedingEvent(action.payload);
      return;
    case "health":
      await api.createHealthEvent(action.payload);
      return;
  }
}

let flushing = false;

/** Attempts to send every pending entry; entries that fail (network down, server rejects) stay queued for the next flush. */
export async function flushOutbox(): Promise<void> {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  try {
    let entries = read();
    for (const entry of entries) {
      if (entry.status === "syncing") continue;
      entries = entries.map((e) => (e.id === entry.id ? { ...e, status: "syncing" as const } : e));
      write(entries);
      try {
        await send(entry.action);
        entries = read().filter((e) => e.id !== entry.id);
        write(entries);
      } catch (err) {
        entries = read().map((e) =>
          e.id === entry.id ? { ...e, status: "failed" as const, lastError: err instanceof Error ? err.message : String(err) } : e
        );
        write(entries);
      }
    }
  } finally {
    flushing = false;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => void flushOutbox());
  // Retry failed entries periodically too (e.g. a 409 that becomes valid once other data syncs).
  setInterval(() => void flushOutbox(), 30_000);
}
