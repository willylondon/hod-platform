"use client";

/**
 * Lightweight localStorage-backed persistence so the app stays fully
 * functional when Supabase is not configured yet. Remote (Supabase) data
 * is merged with local overrides; deletions are tracked via tombstones.
 */

export const LS_KEYS = {
  tasks: "hod.tasks",
  templates: "hod.workflow_templates",
  steps: "hod.workflow_steps",
  instances: "hod.workflow_instances",
  checklist: "hod.checklist_items",
} as const;

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readLocal<T>(key: string): T[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function writeLocal<T>(key: string, items: T[]): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // storage full / unavailable — ignore
  }
}

export function upsertLocal<T extends { id: string }>(key: string, item: T): void {
  const items = readLocal<T>(key);
  const idx = items.findIndex((i) => i.id === item.id);
  if (idx >= 0) items[idx] = item;
  else items.push(item);
  writeLocal(key, items);
}

/** Remove locally and record a tombstone so a remote/mock copy stays hidden. */
export function deleteLocal(key: string, id: string): void {
  writeLocal(key, readLocal<{ id: string }>(key).filter((i) => i.id !== id));
  const tombstones = readLocal<string>(`${key}.deleted`);
  if (!tombstones.includes(id)) {
    tombstones.push(id);
    writeLocal(`${key}.deleted`, tombstones);
  }
}

/**
 * Merge remote rows with local rows (local wins on conflict) and apply
 * deletion tombstones. Pass mock data as `remote` when Supabase is empty.
 */
export function mergeWithLocal<T extends { id: string }>(key: string, remote: T[]): T[] {
  const deleted = new Set(readLocal<string>(`${key}.deleted`));
  const map = new Map<string, T>();
  for (const row of remote) {
    if (!deleted.has(row.id)) map.set(row.id, row);
  }
  for (const row of readLocal<T>(key)) {
    if (!deleted.has(row.id)) map.set(row.id, row);
  }
  return Array.from(map.values());
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
