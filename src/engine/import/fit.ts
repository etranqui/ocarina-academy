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

/** Share of notes (0–1) that have a fingering after shifting by `shift` semitones. */
export function playableShare(midis: number[], shift: number, profile = DEFAULT_PROFILE): number {
  if (!midis.length) return 0;
  return midis.filter((m) => getFingering(midiToPitch(m + shift), profile)).length / midis.length;
}

/**
 * Best transposition in any key (-36…+36 semitones). Whole octaves win ties,
 * then the smallest move, so a melody is only put in a new key when that
 * makes more of its notes playable.
 */
export function bestTransposition(midis: number[], profile = DEFAULT_PROFILE): number {
  let best = 0;
  let bestScore = -1;
  const candidates = Array.from({ length: 73 }, (_, i) => i - 36).sort(
    (a, b) => Number(a % 12 !== 0) - Number(b % 12 !== 0) || Math.abs(a) - Math.abs(b),
  );
  for (const shift of candidates) {
    const score = midis.filter((m) => getFingering(midiToPitch(m + shift), profile)).length;
    if (score > bestScore) {
      best = shift;
      bestScore = score;
    }
  }
  return best;
}

/** Human description of a transposition, e.g. "up 1 octave" or "down 3 semitones". */
export function describeShift(shift: number): string {
  const dir = shift > 0 ? "up" : "down";
  const a = Math.abs(shift);
  if (a % 12 === 0) return `${dir} ${a / 12} octave${a > 12 ? "s" : ""}`;
  return `${dir} ${a} semitone${a > 1 ? "s" : ""}`;
}

export interface FitOptions {
  barsPerPhrase?: number;
  /** Override the automatic octave choice (semitones; a multiple of 12 keeps the key). */
  octaveShift?: number;
  /** Auto mode may move the melody to another key, not just another octave. */
  anyKey?: boolean;
  sourceKind: "musicxml" | "midi";
  fileName: string;
  /** User confirms this file is the whole song. */
  complete: boolean;
}

export function fitArrangement(melody: ImportedMelody, opts: FitOptions, profile = DEFAULT_PROFILE): { arrangement: Arrangement; report: FitReport } {
  const midis = melody.events.filter((e) => e.midi !== null).map((e) => e.midi!) as number[];
  const shift = opts.octaveShift ?? (opts.anyKey ? bestTransposition(midis, profile) : bestOctaveShift(midis, profile));
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

  const shiftNote = shift === 0 ? "" : ` Transposed ${describeShift(shift)} to fit the Alto C range.`;
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
    ...(shift % 12 !== 0 ? { keyNote: `Moved ${describeShift(shift)} from the file so more notes fit the ocarina.` } : {}),
    beatUnit: 4,
    timeSignature: melody.timeSignature,
    phrases,
  };
  return { arrangement, report };
}
