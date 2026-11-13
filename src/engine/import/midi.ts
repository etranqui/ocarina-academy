/**
 * Standard MIDI file → ImportedMelody. Picks one track, reduces it to a
 * single melodic line (highest note wins on overlaps) and quantises to a
 * 16th-note grid so the score stays readable.
 */
import { Midi } from "@tonejs/midi";
import type { ImportedMelody, MelodyEvent, MidiTrackInfo } from "./types";
import { mergeRests } from "./musicxml";

export function readMidi(data: ArrayBuffer | Uint8Array): Midi {
  try {
    return new Midi(data);
  } catch {
    throw new Error("This file is not a valid MIDI file.");
  }
}

export function midiTracks(midi: Midi): MidiTrackInfo[] {
  return midi.tracks
    .map((t, index) => ({
      index,
      name: t.name || t.instrument?.name || `Track ${index + 1}`,
      noteCount: t.notes.length,
      lowest: t.notes.length ? Math.min(...t.notes.map((n) => n.midi)) : 0,
      highest: t.notes.length ? Math.max(...t.notes.map((n) => n.midi)) : 0,
      percussion: t.channel === 9 || !!t.instrument?.percussion,
    }))
    .filter((t) => t.noteCount > 0);
}

/** Best default track: most notes, not percussion. */
export function defaultTrack(tracks: MidiTrackInfo[]): number {
  const melodic = tracks.filter((t) => !t.percussion);
  const pool = melodic.length ? melodic : tracks;
  return pool.reduce((best, t) => (t.noteCount > best.noteCount ? t : best), pool[0]).index;
}

export function parseMidi(midi: Midi, trackIndex: number, gridPerBeat = 4): ImportedMelody {
  const track = midi.tracks[trackIndex];
  if (!track || !track.notes.length) throw new Error("Selected track has no notes.");
  const warnings: string[] = [];
  const ppq = midi.header.ppq;
  const grid = ppq / gridPerBeat;
  const q = (ticks: number) => Math.round(ticks / grid);

  // Quantise, then reduce to a monophonic line.
  const sorted = track.notes
    .map((n) => ({ midi: n.midi, start: q(n.ticks), end: Math.max(q(n.ticks) + 1, q(n.ticks + n.durationTicks)) }))
    .sort((a, b) => a.start - b.start || b.midi - a.midi);

  const line: { midi: number; start: number; end: number }[] = [];
  let polyphony = false;
  for (const n of sorted) {
    const last = line[line.length - 1];
    if (last && n.start === last.start) {
      polyphony = true;
      continue; // lower note of a chord
    }
    if (last && n.start < last.end) {
      polyphony = true;
      last.end = n.start; // cut the overlap
    }
    line.push({ ...n });
  }
  if (polyphony) warnings.push("Overlapping notes were reduced to a single melody line (highest note kept).");

  const events: MelodyEvent[] = [];
  let cursor = 0;
  for (const n of line) {
    if (n.start > cursor) events.push({ midi: null, beats: (n.start - cursor) / gridPerBeat });
    events.push({ midi: n.midi, beats: (n.end - n.start) / gridPerBeat });
    cursor = n.end;
  }

  const ts = midi.header.timeSignatures[0]?.timeSignature;
  const timeSignature: [number, number] = ts && ts.length >= 2 ? [ts[0], ts[1]] : [4, 4];
  const bpm = midi.header.tempos[0]?.bpm ?? 120;
  if (!midi.header.tempos.length) warnings.push("No tempo in file; using 120 bpm.");
  if (midi.header.tempos.length > 1) warnings.push("Tempo changes were flattened to the opening tempo.");

  const total = cursor / gridPerBeat;
  const barLen = (timeSignature[0] * 4) / timeSignature[1];
  const barStarts: number[] = [];
  for (let b = 0; b < total - 1e-9; b += barLen) barStarts.push(b);

  return {
    title: midi.name || undefined,
    events: mergeRests(events),
    bpm: Math.round(bpm),
    timeSignature,
    barStarts,
    warnings,
  };
}
