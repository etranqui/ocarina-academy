/**
 * Music data schema — the single source of truth for every song.
 *
 * Song → Arrangement (game sequence | full) → Phrase → Event (note | rest).
 * Audio playback, the score, fingering diagrams, practice and pitch
 * validation all consume the flattened timeline built from this data
 * (timeline.ts) and never keep their own copies of the notes.
 */
import type { PitchName } from "./pitch";

export type SongId =
  | "zeldas-lullaby"
  | "eponas-song"
  | "sarias-song"
  | "suns-song"
  | "song-of-time"
  | "song-of-storms"
  | "minuet-of-forest"
  | "bolero-of-fire"
  | "serenade-of-water"
  | "requiem-of-spirit"
  | "nocturne-of-shadow"
  | "prelude-of-light";

export interface NoteEvent {
  type: "note";
  pitch: PitchName;
  /** Duration in beats (beat unit = Arrangement.beatUnit). */
  beats: number;
  /** Tied into the next note of the same pitch (sustained, not re-tongued). */
  tie?: boolean;
}

export interface RestEvent {
  type: "rest";
  beats: number;
}

export type MusicEvent = NoteEvent | RestEvent;

export interface Phrase {
  id: string;
  label: string;
  events: MusicEvent[];
}

export type ArrangementKind = "game-sequence" | "full";

/**
 * verified            – complete and checked against its source.
 * partial             – real, sourced content, but incomplete (phrases or rhythm missing).
 * needs-transcription – no authorised note data yet; nothing is presented as playable.
 */
export type ArrangementStatus = "verified" | "partial" | "needs-transcription";

export interface ArrangementSource {
  kind: "game-reference" | "user-supplied" | "musicxml" | "midi" | "none";
  /** Provenance shown to the user. */
  note: string;
  /** Whether durations are real or a uniform placeholder pulse. */
  rhythm: "exact" | "uniform" | "unknown";
  /** Where the rhythm came from, when it differs from the pitch source. */
  rhythmNote?: string;
}

export interface Arrangement {
  kind: ArrangementKind;
  status: ArrangementStatus;
  source: ArrangementSource;
  tempoBpm: number;
  /** Note value that gets one beat (4 = quarter). */
  beatUnit: 4 | 8;
  timeSignature: [number, number];
  phrases: Phrase[];
  /** Playback order of phrase ids (allows repeats). Defaults to phrases in order. */
  form?: string[];
  /** Shown prominently when the arrangement is in a different key from the game sequence. */
  keyNote?: string;
}

export type EmblemId =
  | "harp"
  | "horseshoe"
  | "leaf-flute"
  | "sun"
  | "hourglass"
  | "storm"
  | "leaf"
  | "flame"
  | "wave"
  | "dune"
  | "moon"
  | "rays";

export interface SongTheme {
  /** Accent colour for artwork and highlights. */
  color: string;
  /** Deeper companion colour for gradients. */
  deep: string;
  emblem: EmblemId;
}

export interface Song {
  id: SongId;
  title: string;
  order: number;
  group: "melody" | "warp";
  theme: SongTheme;
  /** Short original description (no game text reproduced). */
  blurb: string;
  arrangements: {
    game: Arrangement;
    full: Arrangement;
  };
}
