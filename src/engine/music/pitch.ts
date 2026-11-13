/**
 * Pitch utilities. Pitches are written in scientific pitch notation at
 * sounding (concert) pitch, e.g. "C5" = 523.25 Hz, the lowest main-hole note
 * of an Alto C ocarina. A4 = 440 Hz unless overridden by calibration.
 */

export type PitchName = string; // validated at runtime by parsePitch

const STEP_TO_SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

export interface ParsedPitch {
  step: string;
  alter: -1 | 0 | 1;
  octave: number;
  midi: number;
}

const PITCH_RE = /^([A-G])(#|b)?(-?\d)$/;

export function parsePitch(name: PitchName): ParsedPitch {
  const m = PITCH_RE.exec(name);
  if (!m) throw new Error(`Invalid pitch name: "${name}"`);
  const [, step, acc, oct] = m;
  const alter = acc === "#" ? 1 : acc === "b" ? -1 : 0;
  const octave = Number(oct);
  const midi = (octave + 1) * 12 + STEP_TO_SEMITONE[step] + alter;
  return { step, alter, octave, midi };
}

export const isPitchName = (name: string) => PITCH_RE.test(name);

export const toMidi = (name: PitchName) => parsePitch(name).midi;

/** Canonical sharp spelling for a MIDI number, e.g. 70 → "A#4". */
export function midiToPitch(midi: number): PitchName {
  const octave = Math.floor(midi / 12) - 1;
  return `${SHARP_NAMES[((midi % 12) + 12) % 12]}${octave}`;
}

/** Normalise any spelling (Bb5, A#5) to the canonical sharp spelling. */
export const canonicalPitch = (name: PitchName) => midiToPitch(toMidi(name));

export const midiToHz = (midi: number, a4 = 440) => a4 * Math.pow(2, (midi - 69) / 12);

export const pitchToHz = (name: PitchName, a4 = 440) => midiToHz(toMidi(name), a4);

/** Continuous (fractional) MIDI value for a frequency. */
export const hzToMidiFloat = (hz: number, a4 = 440) => 69 + 12 * Math.log2(hz / a4);

/** Signed distance in cents from target to hz (positive = sharp). */
export const centsBetween = (hz: number, targetHz: number) => 1200 * Math.log2(hz / targetHz);

/** UI label, e.g. "B♭5", "F♯5", "D6". */
export function displayPitch(name: PitchName, opts: { octave?: boolean } = {}): string {
  const { step, alter, octave } = parsePitch(name);
  const acc = alter === 1 ? "♯" : alter === -1 ? "♭" : "";
  return `${step}${acc}${opts.octave === false ? "" : octave}`;
}

/** Inclusive chromatic range between two pitches (sharp spelling). */
export function chromaticRange(low: PitchName, high: PitchName): PitchName[] {
  const out: PitchName[] = [];
  for (let m = toMidi(low); m <= toMidi(high); m++) out.push(midiToPitch(m));
  return out;
}
