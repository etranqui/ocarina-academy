"use client";

import { isProgressState, readProgress, replaceProgress, type ProgressState } from "./progress";
import { isUserLibrary, readUserLibrary, replaceUserLibrary, type UserLibrary } from "./userSongs";

/**
 * Backup file: progress plus "Your songs" and collections.
 * Older backups were the bare progress state; those still restore
 * (and leave your songs as they are).
 */
export interface Backup {
  app: "ocarina-academy";
  version: 2;
  progress: ProgressState;
  library: UserLibrary;
}

export function exportBackup(): string {
  const b: Backup = { app: "ocarina-academy", version: 2, progress: readProgress(), library: readUserLibrary() };
  return JSON.stringify(b, null, 2);
}

/** Reads a backup file, either format. Throws on anything that isn't one. */
export function parseBackup(json: string): { progress: ProgressState; library?: UserLibrary } {
  let v: unknown;
  try {
    v = JSON.parse(json);
  } catch {
    throw new Error("This file isn't an Ocarina Academy backup.");
  }
  const b = v as Partial<Backup>;
  if (b?.app === "ocarina-academy" && b.version === 2 && isProgressState(b.progress) && isUserLibrary(b.library)) {
    return { progress: b.progress, library: b.library };
  }
  if (isProgressState(v)) return { progress: v };
  throw new Error("This file isn't an Ocarina Academy backup.");
}

/** Restores a backup. Returns how many of your songs it contained (undefined for an old, progress-only backup). */
export function restoreBackup(json: string): number | undefined {
  const { progress, library } = parseBackup(json);
  replaceProgress(progress);
  if (library) replaceUserLibrary(library);
  return library ? Object.keys(library.songs).length : undefined;
}
