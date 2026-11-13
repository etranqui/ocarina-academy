/** Intermediate, format-neutral melody produced by the MusicXML and MIDI readers. */
export interface MelodyEvent {
  /** MIDI number, or null for a rest. */
  midi: number | null;
  /** Duration in quarter-note beats. */
  beats: number;
  tie?: boolean;
}

export interface ImportedMelody {
  title?: string;
  events: MelodyEvent[];
  bpm: number;
  timeSignature: [number, number];
  /** Beat positions where each bar starts (after repeats are expanded). */
  barStarts: number[];
  warnings: string[];
}

export interface MidiTrackInfo {
  index: number;
  name: string;
  noteCount: number;
  lowest: number;
  highest: number;
  percussion: boolean;
}
