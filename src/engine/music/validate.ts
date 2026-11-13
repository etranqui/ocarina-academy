import type { Song } from "./schema";
import { buildTimeline } from "./timeline";
import { getFingering, DEFAULT_PROFILE } from "../fingering/engine";

export interface ValidationIssue {
  songId: string;
  arrangement: "game" | "full";
  message: string;
}

/**
 * Guarantees the "single source of truth" contract: every note in every
 * non-empty arrangement parses, has a positive duration and has a defined
 * fingering on the target instrument. Run in tests and at import time.
 */
export function validateSong(song: Song, profile = DEFAULT_PROFILE): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const key of ["game", "full"] as const) {
    const arr = song.arrangements[key];
    if (arr.status === "needs-transcription") {
      if (arr.phrases.length > 0)
        issues.push({ songId: song.id, arrangement: key, message: "Marked needs-transcription but contains notes" });
      continue;
    }
    try {
      const t = buildTimeline(arr);
      if (t.notes.length === 0) issues.push({ songId: song.id, arrangement: key, message: "No notes" });
      for (const n of t.notes) {
        if (!getFingering(n.pitch, profile))
          issues.push({ songId: song.id, arrangement: key, message: `No verified fingering for ${n.pitch} (note ${n.index + 1})` });
      }
    } catch (e) {
      issues.push({ songId: song.id, arrangement: key, message: (e as Error).message });
    }
  }
  return issues;
}
