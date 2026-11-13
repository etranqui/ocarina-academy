/**
 * Turns an imported melody into an Arrangement for the target ocarina:
 * picks the octave that makes the most notes playable, splits it into
 * phrases of N bars, and reports anything that still can't be fingered.
 * Status is never upgraded automatically: "verified" requires every note
 * to be playable AND the user confirming the file is the complete song.
 */
import { midiToPitch } from "../music/pitch";
import type { Arrangement, MusicEvent, Phrase } from "../music/schema";
import { getFingering, DEFAULT_PROFILE } from "../fingering/engine";
import type { ImportedMelody } from "./types";

export interface FitReport {
  octaveShift: number;
  noteCount: number;
  barCount: number;
  phraseCount: number;
  unplayable: { pitch: string; count: number }[];
  lowest: string;
  highest: string;
}

export function bestOctaveShift(midis: number[], profile = DEFAULT_PROFILE): number {
  let best = 0;
  let bestScore = -1;
  for (const shift of [0, 12, -12, 24, -24, 36, -36]) {
    const score = midis.filter((m) => getFingering(midiToPitch(m + shift), profile)).length;
    if (score > bestScore) {
      best = shift;
      bestScore = score;
    }
  }
  return best;
}

export interface FitOptions {
  barsPerPhrase?: number;
  /** Override the automatic octave choice (semitones, multiple of 12). */
  octaveShift?: number;
  sourceKind: "musicxml" | "midi";
  fileName: string;
  /** User confirms this file is the whole song. */
  complete: boolean;
}

export function fitArrangement(melody: ImportedMelody, opts: FitOptions, profile = DEFAULT_PROFILE): { arrangement: Arrangement; report: FitReport } {
  const midis = melody.events.filter((e) => e.midi !== null).map((e) => e.midi!) as number[];
  const shift = opts.octaveShift ?? bestOctaveShift(midis, profile);
  const barsPerPhrase = Math.max(1, opts.barsPerPhrase ?? 4);

  // Phrase boundaries in beats: every N bars.
  const starts = melody.barStarts.length ? melody.barStarts : [0];
  const boundaries = starts.filter((_, i) => i % barsPerPhrase === 0).slice(1);

  const phrases: Phrase[] = [];
  let current: MusicEvent[] = [];
  let beat = 0;
  let b = 0;
  const flush = () => {
    if (current.length && current.some((e) => e.type === "note")) {
      const n = phrases.length + 1;
      phrases.push({ id: `p${n}`, label: `Phrase ${n}`, events: current });
    } else if (current.length && phrases.length) {
      phrases[phrases.length - 1].events.push(...current); // trailing rests join previous phrase
    }
    current = [];
  };

  const unplayable = new Map<string, number>();
  for (const e of melody.events) {
    if (b < boundaries.length && beat >= boundaries[b] - 1e-6) {
      flush();
      while (b < boundaries.length && beat >= boundaries[b] - 1e-6) b++;
    }
    if (e.midi === null) current.push({ type: "rest", beats: e.beats });
    else {
      const pitch = midiToPitch(e.midi + shift);
      if (!getFingering(pitch, profile)) unplayable.set(pitch, (unplayable.get(pitch) ?? 0) + 1);
      current.push({ type: "note", pitch, beats: e.beats, ...(e.tie ? { tie: true } : {}) });
    }
    beat += e.beats;
  }
  flush();

  const allPlayable = unplayable.size === 0;
  const shifted = midis.map((m) => m + shift);
  const report: FitReport = {
    octaveShift: shift,
    noteCount: midis.length,
    barCount: melody.barStarts.length,
    phraseCount: phrases.length,
    unplayable: [...unplayable].map(([pitch, count]) => ({ pitch, count })),
    lowest: midiToPitch(Math.min(...shifted)),
    highest: midiToPitch(Math.max(...shifted)),
  };

  const shiftNote = shift === 0 ? "" : ` Transposed ${shift > 0 ? "up" : "down"} ${Math.abs(shift) / 12} octave${Math.abs(shift) > 12 ? "s" : ""} to fit the Alto C range.`;
  const playNote = allPlayable ? "" : ` ${report.unplayable.length} pitch(es) have no verified fingering yet.`;

  const arrangement: Arrangement = {
    kind: "full",
    status: opts.complete && allPlayable ? "verified" : "partial",
    source: {
      kind: opts.sourceKind,
      note: `Imported from ${opts.fileName}${opts.complete ? " (marked complete by you)" : ""}.${shiftNote}${playNote}`,
      rhythm: "exact",
    },
    tempoBpm: melody.bpm,
    beatUnit: 4,
    timeSignature: melody.timeSignature,
    phrases,
  };
  return { arrangement, report };
}
