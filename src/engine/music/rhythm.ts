import type { Arrangement, MusicEvent } from "./schema";

/**
 * A rhythm for an existing note sequence: one entry per note (per phrase),
 * with an optional rest after it. Pitches are never changed by a rhythm.
 */
export interface NoteRhythm {
  beats: number;
  restAfter: number;
  /** The note this length belongs to, so a rhythm survives edits to the phrase's notes. */
  pitch?: string;
}

export interface RhythmOverride {
  timeSignature: [number, number];
  tempoBpm: number;
  phrases: Record<string, NoteRhythm[]>;
  updatedAt: number;
}

/** Read the current rhythm of an arrangement (what the editor starts from). */
export function extractRhythm(arr: Arrangement): RhythmOverride {
  const phrases: Record<string, NoteRhythm[]> = {};
  for (const p of arr.phrases) {
    const list: NoteRhythm[] = [];
    for (const ev of p.events) {
      if (ev.type === "note") list.push({ beats: ev.beats, restAfter: 0, pitch: ev.pitch });
      else if (list.length) list[list.length - 1].restAfter += ev.beats;
    }
    phrases[p.id] = list;
  }
  return { timeSignature: arr.timeSignature, tempoBpm: arr.tempoBpm, phrases, updatedAt: 0 };
}

/**
 * Fit a saved rhythm to the arrangement's current notes. If a phrase's notes
 * changed since the rhythm was saved, lengths stay on the notes they were set
 * for (matched by pitch, in order) and new notes keep their original length.
 * Entries saved without pitches can only be matched by position.
 * Returns the fitted rhythm and the ids of phrases that needed fitting.
 */
export function alignRhythm(arr: Arrangement, r: RhythmOverride): { rhythm: RhythmOverride; changed: string[] } {
  const phrases: Record<string, NoteRhythm[]> = {};
  const changed: string[] = [];
  for (const p of arr.phrases) {
    const notes = p.events.filter((e) => e.type === "note") as { pitch: string; beats: number }[];
    const saved = r.phrases[p.id] ?? [];
    const fresh = (n: { pitch: string; beats: number }): NoteRhythm => ({ beats: n.beats, restAfter: 0, pitch: n.pitch });
    const sameLength = saved.length === notes.length;
    const pitchesKnown = saved.length > 0 && saved.every((e) => e.pitch);
    if (sameLength && (!pitchesKnown || saved.every((e, i) => e.pitch === notes[i].pitch))) {
      phrases[p.id] = saved.map((e, i) => ({ ...e, pitch: notes[i].pitch }));
      continue;
    }
    if (saved.length) changed.push(p.id);
    if (!pitchesKnown) {
      phrases[p.id] = notes.map((n, i) => (saved[i] ? { ...saved[i], pitch: n.pitch } : fresh(n)));
      continue;
    }
    // Longest common subsequence of pitches: matched notes keep their saved length.
    const a = saved.map((e) => e.pitch!);
    const b = notes.map((n) => n.pitch);
    const L = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
    for (let i = a.length - 1; i >= 0; i--)
      for (let j = b.length - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const out: NoteRhythm[] = [];
    let i = 0;
    let j = 0;
    while (j < b.length) {
      if (i < a.length && a[i] === b[j] && L[i][j] === L[i + 1][j + 1] + 1) out.push({ ...saved[i++], pitch: b[j++] });
      else if (i < a.length && L[i + 1][j] >= L[i][j + 1]) i++;
      else out.push(fresh(notes[j++]));
    }
    phrases[p.id] = out;
  }
  return { rhythm: { ...r, phrases }, changed };
}

/** Apply a rhythm to an arrangement's notes (fitted to the current notes first). */
export function applyRhythm(arr: Arrangement, saved: RhythmOverride, note: string): Arrangement {
  const r = alignRhythm(arr, saved).rhythm;
  return {
    ...arr,
    tempoBpm: r.tempoBpm,
    timeSignature: r.timeSignature,
    source: { ...arr.source, rhythm: "exact", rhythmNote: note },
    phrases: arr.phrases.map((p) => {
      const rhythm = r.phrases[p.id] ?? [];
      const events: MusicEvent[] = [];
      let i = 0;
      for (const ev of p.events) {
        if (ev.type !== "note") continue; // rests come from the rhythm
        const nr = rhythm[i++];
        events.push({ ...ev, beats: nr?.beats ?? ev.beats });
        if (nr && nr.restAfter > 0) events.push({ type: "rest", beats: nr.restAfter });
      }
      return { ...p, events };
    }),
  };
}

/** Durations offered in the editor, in quarter-note beats. */
export const DURATIONS: { beats: number; label: string }[] = [
  { beats: 4, label: "Whole" },
  { beats: 3, label: "Dotted half" },
  { beats: 2, label: "Half" },
  { beats: 1.5, label: "Dotted quarter" },
  { beats: 1, label: "Quarter" },
  { beats: 0.75, label: "Dotted eighth" },
  { beats: 0.5, label: "Eighth" },
  { beats: 0.25, label: "Sixteenth" },
];

/**
 * Convert tap times (ms, one per note onset, plus an optional final tap
 * marking the end of the last note) to beats on a grid.
 */
export function tapsToBeats(tapsMs: number[], bpm: number, grid = 0.25): number[] {
  const out: number[] = [];
  for (let i = 1; i < tapsMs.length; i++) {
    const beats = ((tapsMs[i] - tapsMs[i - 1]) / 1000) * (bpm / 60);
    out.push(Math.max(grid, Math.round(beats / grid) * grid));
  }
  return out;
}
