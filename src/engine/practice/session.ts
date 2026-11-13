/**
 * Practice session state machine. Pure (no Web Audio, no React): it consumes
 * pitch frames and decides when each expected note has been played, so it
 * is fully unit-tested with synthetic frames.
 *
 *   beginner      one note at a time, waits until it is right (unlimited retries)
 *   intermediate  short chunks of 2–4 notes within a phrase, each heard first
 *   advanced      the whole selection in one go; mistakes are counted, not blocking
 */
import type { TimelineNote } from "../music/timeline";
import { classify, medianHz, type FeedbackKind, type PitchFrame } from "../pitch/classify";

export type Difficulty = "beginner" | "intermediate" | "advanced";

export interface PracticeNote {
  /** Index in the full timeline. */
  index: number;
  pitch: string;
  midi: number;
  hz: number;
  /** Section (form entry) this note belongs to. */
  section: number;
  phraseId: string;
}

export type NoteStatus = "pending" | "correct" | "missed";

export interface NoteResult {
  status: NoteStatus;
  /** Wrong notes played while this note was expected. */
  mistakes: number;
}

export interface Feedback {
  kind: FeedbackKind;
  cents?: number;
  heard?: string;
  /** 0..1 progress of holding the correct note. */
  hold: number;
  /** Same pitch as the previous note: needs a fresh breath/tongue before it counts. */
  rearticulate?: boolean;
}

export interface SessionOptions {
  difficulty: Difficulty;
  toleranceCents: number;
  tuningCents: number;
  /** How long the correct pitch must be held. Defaults depend on difficulty. */
  holdMs?: number;
  /** Silence this long shows the "no sound" warning. */
  silentMs?: number;
}

export interface SessionState {
  phase: "listen" | "play" | "done";
  chunks: [number, number][];
  chunk: number;
  cursor: number;
  results: NoteResult[];
  feedback: Feedback;
}

const HOLD_MS: Record<Difficulty, number> = { beginner: 300, intermediate: 180, advanced: 110 };

export function toPracticeNotes(notes: TimelineNote[], sectionOf: (n: TimelineNote) => number): PracticeNote[] {
  return notes.map((n) => ({ index: n.index, pitch: n.pitch, midi: n.midi, hz: n.hz, section: sectionOf(n), phraseId: n.phraseId }));
}

/** Split notes into practice chunks according to difficulty, never crossing a phrase boundary. */
export function makeChunks(notes: PracticeNote[], difficulty: Difficulty): [number, number][] {
  if (!notes.length) return [];
  if (difficulty === "advanced") return [[0, notes.length]];
  if (difficulty === "beginner") return notes.map((_, i) => [i, i + 1]);
  const chunks: [number, number][] = [];
  let start = 0;
  for (let i = 1; i <= notes.length; i++) {
    if (i === notes.length || notes[i].section !== notes[start].section) {
      const n = i - start;
      const parts = Math.ceil(n / 4);
      const size = Math.ceil(n / parts);
      for (let s = start; s < i; s += size) chunks.push([s, Math.min(i, s + size)]);
      start = i;
    }
  }
  return chunks;
}

export class PracticeSession {
  readonly notes: PracticeNote[];
  readonly opts: Required<SessionOptions>;
  state: SessionState;

  private history: PitchFrame[] = [];
  private holdStart: number | null = null;
  private lastGood = 0;
  private silenceSince: number | null = null;
  private wrongHeard: string | null = null;
  private wrongStart = 0;
  private wrongCounted = false;
  private needRelease = false;
  private peakRms = 0;
  private lastFeedbackAt = 0;
  /** Milliseconds spent actively playing (for practice-time tracking). */
  playedMs = 0;

  constructor(notes: PracticeNote[], opts: SessionOptions) {
    this.notes = notes;
    this.opts = {
      holdMs: HOLD_MS[opts.difficulty],
      silentMs: 5000,
      ...opts,
    } as Required<SessionOptions>;
    this.state = {
      phase: notes.length ? "listen" : "done",
      chunks: makeChunks(notes, opts.difficulty),
      chunk: 0,
      cursor: 0,
      results: notes.map(() => ({ status: "pending", mistakes: 0 })),
      feedback: { kind: "listening", hold: 0 },
    };
  }

  get current(): PracticeNote | null {
    return this.state.phase === "done" ? null : (this.notes[this.state.cursor] ?? null);
  }

  get currentChunk(): [number, number] | null {
    return this.state.chunks[this.state.chunk] ?? null;
  }

  /** Reference audio has finished: start listening to the player. */
  beginPlay(t: number) {
    if (this.state.phase !== "listen") return;
    this.resetDetection(t);
    this.needRelease = false;
    this.set({ phase: "play", feedback: { kind: "listening", hold: 0 } });
  }

  /** Feed one microphone frame. Returns true when the visible state changed. */
  push(frame: PitchFrame): boolean {
    if (this.state.phase !== "play") return false;
    const target = this.current;
    if (!target) return false;
    const t = frame.t;
    this.playedMs += this.history.length ? Math.min(100, t - this.history[this.history.length - 1].t) : 0;
    this.history.push(frame);
    if (this.history.length > 8) this.history.shift();
    this.peakRms = Math.max(frame.rms, this.peakRms * 0.97);

    const hz = frame.hz === null ? null : (medianHz(this.history, 3) ?? frame.hz);

    // Repeated pitch: wait for a breath/tongue break before counting the next one.
    if (this.needRelease && (frame.hz === null || frame.rms < this.peakRms * 0.5)) this.needRelease = false;

    if (hz === null) {
      this.silenceSince ??= t;
      if (t - this.lastGood > 90) this.holdStart = null;
      this.wrongHeard = null;
      this.wrongCounted = false;
      const silent = t - this.silenceSince > this.opts.silentMs;
      if (silent) return this.feedback({ kind: "silent", hold: 0 });
      if (t - this.lastFeedbackAt > 300) return this.feedback({ kind: "listening", hold: 0 });
      return false;
    }
    this.silenceSince = null;

    const c = classify(hz, target.hz, this.opts);
    this.lastFeedbackAt = t;

    if (c.kind === "correct") {
      this.wrongHeard = null;
      this.wrongCounted = false;
      if (this.needRelease) return this.feedback({ kind: "correct", cents: c.cents, heard: c.heard, hold: 0, rearticulate: true });
      this.lastGood = t;
      this.holdStart ??= t;
      const hold = Math.min(1, (t - this.holdStart) / this.opts.holdMs);
      if (hold >= 1) {
        this.pass(t);
        return true;
      }
      return this.feedback({ kind: "correct", cents: c.cents, heard: c.heard, hold });
    }

    if (t - this.lastGood > 90) this.holdStart = null;

    if (c.kind === "wrong" || c.kind === "octave") {
      if (c.heard !== this.wrongHeard) {
        this.wrongHeard = c.heard;
        this.wrongStart = t;
        this.wrongCounted = false;
      } else if (!this.wrongCounted && t - this.wrongStart >= Math.max(250, this.opts.holdMs * 1.5)) {
        this.wrongCounted = true;
        if (this.opts.difficulty === "advanced" && this.skipAheadIfNext(c.heard, t)) return true;
        this.state.results[this.state.cursor].mistakes++;
      }
    } else {
      this.wrongHeard = null;
    }
    return this.feedback({ kind: c.kind, cents: c.cents, heard: c.heard, hold: 0 });
  }

  /** Give up on the current note and move on. */
  skip(t = 0) {
    if (this.state.phase === "done" || !this.current) return;
    this.state.results[this.state.cursor].status = "missed";
    this.advance(t);
  }

  /** Start the current chunk again (results in it are cleared). */
  retryChunk(t = 0) {
    const ch = this.currentChunk ?? this.state.chunks[this.state.chunks.length - 1];
    if (!ch) return;
    for (let i = ch[0]; i < ch[1]; i++) this.state.results[i] = { status: "pending", mistakes: this.state.results[i].mistakes };
    this.resetDetection(t);
    this.set({ phase: "listen", chunk: this.state.chunks.indexOf(ch), cursor: ch[0], feedback: { kind: "listening", hold: 0 } });
  }

  summary() {
    const correct = this.state.results.filter((r) => r.status === "correct").length;
    const missed = this.state.results.filter((r) => r.status === "missed").length;
    const mistakes = this.state.results.reduce((s, r) => s + r.mistakes, 0);
    const attempted = correct + missed + mistakes;
    const bySection = new Map<number, { phraseId: string; correct: number; missed: number; mistakes: number; total: number }>();
    this.notes.forEach((n, i) => {
      const r = this.state.results[i];
      const s = bySection.get(n.section) ?? { phraseId: n.phraseId, correct: 0, missed: 0, mistakes: 0, total: 0 };
      s.total++;
      if (r.status === "correct") s.correct++;
      if (r.status === "missed") s.missed++;
      s.mistakes += r.mistakes;
      bySection.set(n.section, s);
    });
    const sections = [...bySection].map(([section, s]) => {
      const att = s.correct + s.missed + s.mistakes;
      const accuracy = att ? s.correct / att : 0;
      const finished = s.correct + s.missed === s.total;
      const completed = finished && (this.opts.difficulty === "advanced" ? accuracy >= 0.8 : s.missed === 0);
      return { section, ...s, attempted: att, accuracy, completed };
    });
    return { correct, missed, mistakes, attempted, accuracy: attempted ? correct / attempted : 0, sections, playedMs: this.playedMs };
  }

  // ── internals ──────────────────────────────────────────────

  private pass(t: number) {
    this.state.results[this.state.cursor].status = "correct";
    this.advance(t);
  }

  private advance(t: number) {
    const prev = this.current;
    const cursor = this.state.cursor + 1;
    const chunk = this.currentChunk!;
    this.resetDetection(t);
    const next = this.notes[cursor];
    this.needRelease = !!next && !!prev && next.midi === prev.midi;
    if (cursor >= chunk[1]) {
      const nextChunk = this.state.chunk + 1;
      if (nextChunk >= this.state.chunks.length) {
        this.set({ phase: "done", cursor, chunk: nextChunk, feedback: { kind: "correct", hold: 1 } });
      } else {
        this.set({ phase: "listen", cursor, chunk: nextChunk, feedback: { kind: "correct", hold: 1 } });
      }
    } else {
      this.set({ cursor, feedback: { kind: "correct", hold: 1 } });
    }
  }

  /** Advanced mode: player skipped ahead to the next expected note. */
  private skipAheadIfNext(heard: string, t: number): boolean {
    const next = this.notes[this.state.cursor + 1];
    const chunk = this.currentChunk!;
    if (!next || this.state.cursor + 1 >= chunk[1] || next.pitch !== heard) return false;
    this.state.results[this.state.cursor].status = "missed";
    this.set({ cursor: this.state.cursor + 1 });
    this.pass(t);
    return true;
  }

  private resetDetection(t: number) {
    this.history = [];
    this.holdStart = null;
    this.lastGood = 0;
    this.silenceSince = t;
    this.wrongHeard = null;
    this.wrongCounted = false;
  }

  private feedback(f: Feedback): boolean {
    const prev = this.state.feedback;
    const changed =
      prev.kind !== f.kind ||
      prev.heard !== f.heard ||
      prev.rearticulate !== f.rearticulate ||
      Math.abs((prev.cents ?? 0) - (f.cents ?? 0)) > 1 ||
      Math.abs(prev.hold - f.hold) > 0.02;
    if (changed) this.state = { ...this.state, feedback: f };
    return changed;
  }

  private set(patch: Partial<SessionState>) {
    this.state = { ...this.state, ...patch, results: [...this.state.results] };
  }
}
