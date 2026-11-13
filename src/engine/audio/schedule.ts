/**
 * Pure timing helpers shared by the audio transport and the UI. No Web Audio
 * here, so all of it is unit-tested.
 */
import type { Timeline, TimelineNote } from "../music/timeline";

export interface PlayRange {
  startBeat: number;
  endBeat: number;
}

/** A sounding event: tied notes are merged into one breath. */
export interface SoundEvent {
  /** Note indices covered by this event (more than one when tied). */
  indices: number[];
  hz: number;
  startBeat: number;
  beats: number;
  /** True when the next sounding note starts right after with no rest (legato hint). */
  connected: boolean;
  /** Previous event flows into this one (no re-attack). */
  legatoIn: boolean;
}

export const fullRange = (t: Timeline): PlayRange => ({ startBeat: 0, endBeat: t.totalBeats });

export function sectionRange(t: Timeline, formIndex: number): PlayRange {
  const s = t.sections[formIndex];
  return { startBeat: s.startBeat, endBeat: s.endBeat };
}

/** Sounding events whose start lies inside the range, with ties merged. */
export function soundEvents(t: Timeline, range: PlayRange): SoundEvent[] {
  const notes = t.notes.filter((n) => n.startBeat >= range.startBeat - 1e-9 && n.startBeat < range.endBeat - 1e-9);
  const out: SoundEvent[] = [];
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    const ev: SoundEvent = { indices: [n.index], hz: n.hz, startBeat: n.startBeat, beats: n.beats, connected: false, legatoIn: false };
    let cur: TimelineNote = n;
    while (cur.tie && i + 1 < notes.length && notes[i + 1].midi === cur.midi) {
      i++;
      cur = notes[i];
      ev.indices.push(cur.index);
      ev.beats += cur.beats;
    }
    // Never let a note ring past the end of the range (phrase loops).
    ev.beats = Math.min(ev.beats, range.endBeat - ev.startBeat);
    out.push(ev);
  }
  for (let i = 0; i < out.length - 1; i++) {
    out[i].connected = Math.abs(out[i].startBeat + out[i].beats - out[i + 1].startBeat) < 1e-6;
    out[i + 1].legatoIn = out[i].connected;
  }
  return out;
}

/** Whole-beat metronome ticks inside the range; accent = downbeat of a bar. */
export function metronomeTicks(range: PlayRange, beatsPerBar: number): { beat: number; accent: boolean }[] {
  const out: { beat: number; accent: boolean }[] = [];
  for (let b = Math.ceil(range.startBeat - 1e-9); b < range.endBeat - 1e-9; b++) {
    out.push({ beat: b, accent: ((b % beatsPerBar) + beatsPerBar) % beatsPerBar === 0 });
  }
  return out;
}

export interface NotePosition {
  /** Note sounding at this beat, or null during a rest. */
  current: number | null;
  /** Next note to be played after this beat. */
  upcoming: number | null;
}

export function noteAt(t: Timeline, beat: number): NotePosition {
  // Binary search for the last note starting at or before `beat`.
  let lo = 0;
  let hi = t.notes.length - 1;
  let last = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (t.notes[mid].startBeat <= beat + 1e-9) {
      last = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  const n = last >= 0 ? t.notes[last] : null;
  const sounding = n && beat < n.startBeat + n.beats - 1e-9 ? last : null;
  const upcoming = last + 1 < t.notes.length ? last + 1 : null;
  return { current: sounding, upcoming };
}

/** Beats per bar in quarter-note beats for a time signature. */
export const beatsPerBar = ([num, den]: [number, number]) => (num * 4) / den;
