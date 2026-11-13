import { centsBetween, hzToMidiFloat, midiToPitch, type PitchName } from "../music/pitch";

/** One analysis frame from the microphone. hz is null when below the noise gate or aperiodic. */
export interface PitchFrame {
  hz: number | null;
  rms: number;
  /** Milliseconds (monotonic). */
  t: number;
}

export type FeedbackKind = "listening" | "silent" | "correct" | "sharp" | "flat" | "wrong" | "octave";

export interface Classification {
  kind: "correct" | "sharp" | "flat" | "wrong" | "octave";
  /** Cents from the target (after tuning offset); for wrong notes, from the heard note. */
  cents: number;
  /** Nearest equal-tempered note actually heard. */
  heard: PitchName;
}

export interface MatchOptions {
  /** ± cents counted as in tune. */
  toleranceCents: number;
  /** Instrument tuning offset from calibration (positive = instrument plays sharp). */
  tuningCents: number;
  /** Beyond tolerance but within this many cents → "sharp"/"flat" rather than "wrong note". */
  nearCents?: number;
}

/** Compare a detected frequency with the expected one. */
export function classify(hz: number, targetHz: number, o: MatchOptions): Classification {
  const near = o.nearCents ?? 65;
  // Remove the instrument's systematic offset before judging.
  const cents = centsBetween(hz, targetHz) - o.tuningCents;
  const heardMidi = Math.round(hzToMidiFloat(hz) - o.tuningCents / 100);
  const heard = midiToPitch(heardMidi);
  if (Math.abs(cents) <= o.toleranceCents) return { kind: "correct", cents, heard };
  if (Math.abs(cents) <= near) return { kind: cents > 0 ? "sharp" : "flat", cents, heard };
  // Same note name, different octave
  const octaveOff = Math.abs(Math.abs(cents) - 1200) <= near || Math.abs(Math.abs(cents) - 2400) <= near;
  return { kind: octaveOff ? "octave" : "wrong", cents, heard };
}

/** Median of the last n non-null frequencies — removes single-frame glitches. */
export function medianHz(frames: PitchFrame[], n = 3): number | null {
  const vals = frames
    .slice(-n)
    .map((f) => f.hz)
    .filter((h): h is number => h !== null)
    .sort((a, b) => a - b);
  if (vals.length < Math.ceil(n / 2)) return null;
  return vals[Math.floor(vals.length / 2)];
}
