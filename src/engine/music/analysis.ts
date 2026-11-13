import type { Arrangement } from "./schema";
import { buildTimeline, beatsToSeconds } from "./timeline";

export type Difficulty = "Novice" | "Apprentice" | "Adept";

export interface ArrangementStats {
  noteCount: number;
  uniquePitches: string[];
  lowestMidi: number;
  highestMidi: number;
  /** Largest melodic leap in semitones. */
  maxLeap: number;
  durationSec: number;
  difficulty: Difficulty;
  /** 0–100 score behind the label. */
  difficultyScore: number;
}

/**
 * Difficulty is computed from the notes (length, distinct fingerings,
 * leaps, range) rather than typed in, so it stays truthful as data changes.
 */
export function analyze(arr: Arrangement): ArrangementStats | null {
  if (arr.status === "needs-transcription") return null;
  const t = buildTimeline(arr);
  if (t.notes.length === 0) return null;

  const midis = t.notes.map((n) => n.midi);
  let maxLeap = 0;
  let leapSum = 0;
  for (let i = 1; i < midis.length; i++) {
    const leap = Math.abs(midis[i] - midis[i - 1]);
    maxLeap = Math.max(maxLeap, leap);
    leapSum += leap;
  }
  const unique = [...new Set(t.notes.map((n) => n.pitch))];
  const lowest = Math.min(...midis);
  const highest = Math.max(...midis);
  const avgLeap = midis.length > 1 ? leapSum / (midis.length - 1) : 0;

  const score = Math.min(
    100,
    Math.round(
      t.notes.length * 2.5 + // passage length
        unique.length * 6 + // distinct fingerings to memorise
        avgLeap * 2.5 + // average hand movement
        maxLeap * 1 + // hardest jump
        (highest - lowest) * 0.6, // range
    ),
  );
  const difficulty: Difficulty = score < 52 ? "Novice" : score < 62 ? "Apprentice" : "Adept";

  return {
    noteCount: t.notes.length,
    uniquePitches: unique,
    lowestMidi: lowest,
    highestMidi: highest,
    maxLeap,
    durationSec: beatsToSeconds(t.totalBeats, arr.tempoBpm),
    difficulty,
    difficultyScore: score,
  };
}

export function formatDuration(sec: number): string {
  if (sec < 60) return `${Math.max(1, Math.round(sec))} s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
