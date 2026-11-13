import type { Arrangement, Phrase } from "./schema";
import { pitchToHz, toMidi, type PitchName } from "./pitch";

export interface TimelineNote {
  /** Position among notes only (rests excluded), 0-based. */
  index: number;
  pitch: PitchName;
  midi: number;
  hz: number;
  startBeat: number;
  beats: number;
  tie: boolean;
  phraseId: string;
  /** Which entry of the form this note belongs to (0-based). */
  formIndex: number;
}

export interface TimelineRest {
  startBeat: number;
  beats: number;
  phraseId: string;
  formIndex: number;
}

export interface TimelineSection {
  phraseId: string;
  label: string;
  formIndex: number;
  startBeat: number;
  endBeat: number;
  /** [first, end) note indices. */
  noteRange: [number, number];
}

export interface Timeline {
  notes: TimelineNote[];
  rests: TimelineRest[];
  totalBeats: number;
  sections: TimelineSection[];
}

export function phraseOrder(arr: Arrangement): Phrase[] {
  const byId = new Map(arr.phrases.map((p) => [p.id, p]));
  const ids = arr.form ?? arr.phrases.map((p) => p.id);
  return ids.map((id) => {
    const p = byId.get(id);
    if (!p) throw new Error(`Form references unknown phrase "${id}"`);
    return p;
  });
}

/**
 * Flatten an arrangement into absolute beat positions. This is the one
 * representation every engine (audio, score, fingering, practice) reads.
 */
export function buildTimeline(arr: Arrangement, a4 = 440): Timeline {
  const notes: TimelineNote[] = [];
  const rests: TimelineRest[] = [];
  const sections: TimelineSection[] = [];
  let beat = 0;

  phraseOrder(arr).forEach((phrase, formIndex) => {
    const startBeat = beat;
    const firstNote = notes.length;
    for (const ev of phrase.events) {
      if (!(ev.beats > 0)) throw new Error(`Non-positive duration in phrase "${phrase.id}"`);
      if (ev.type === "note") {
        notes.push({
          index: notes.length,
          pitch: ev.pitch,
          midi: toMidi(ev.pitch),
          hz: pitchToHz(ev.pitch, a4),
          startBeat: beat,
          beats: ev.beats,
          tie: !!ev.tie,
          phraseId: phrase.id,
          formIndex,
        });
      } else {
        rests.push({ startBeat: beat, beats: ev.beats, phraseId: phrase.id, formIndex });
      }
      beat += ev.beats;
    }
    sections.push({
      phraseId: phrase.id,
      label: phrase.label,
      formIndex,
      startBeat,
      endBeat: beat,
      noteRange: [firstNote, notes.length],
    });
  });

  return { notes, rests, totalBeats: beat, sections };
}

/** Seconds for a number of beats (tempoFactor 0.5 = half speed). */
export const beatsToSeconds = (beats: number, bpm: number, tempoFactor = 1) =>
  (beats * 60) / (bpm * tempoFactor);
