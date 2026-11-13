/**
 * Playback transport: schedules a Timeline on the AudioContext clock with a
 * look-ahead scheduler and reports the audible position, so the score and
 * fingering diagrams follow exactly what is heard.
 */
import type { Timeline } from "../music/timeline";
import { OcarinaSynth } from "./synth";
import { fullRange, metronomeTicks, soundEvents, type PlayRange, type SoundEvent } from "./schedule";

export type TransportState = "stopped" | "playing" | "paused";

export interface TransportSettings {
  bpm: number;
  /** 0.5 | 0.75 | 1 … */
  tempoFactor: number;
  loop: boolean;
  metronome: boolean;
  beatsPerBar: number;
  range: PlayRange;
}

interface Pass {
  startTime: number;
  startBeat: number;
}

const LOOKAHEAD_S = 0.2;
const TICK_MS = 25;

let sharedCtx: AudioContext | null = null;

/** One AudioContext for the whole app; created on first user gesture (iOS). */
export function getAudioContext(): AudioContext {
  if (!sharedCtx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedCtx = new Ctor({ latencyHint: "interactive" });
  }
  return sharedCtx;
}

let sharedSynth: OcarinaSynth | null = null;

/** One synth (with its reverb and compressor) shared by playback, previews and practice. */
export function getSynth(): OcarinaSynth {
  if (!sharedSynth) {
    const ctx = getAudioContext();
    const out = ctx.createDynamicsCompressor();
    out.threshold.value = -14;
    out.ratio.value = 3;
    out.connect(ctx.destination);
    sharedSynth = new OcarinaSynth(ctx, out);
  }
  return sharedSynth;
}

/**
 * Play a short reference phrase (practice "Listen" step). Resolves once the
 * sound — including the reverb tail — has died away, so the microphone
 * doesn't hear the app's own audio.
 */
export async function playReference(notes: { hz: number; sec: number }[], signal?: AbortSignal): Promise<void> {
  const ctx = getAudioContext();
  if (ctx.state !== "running") await ctx.resume();
  const synth = getSynth();
  synth.silence();
  let t = ctx.currentTime + 0.06;
  notes.forEach((n, i) => {
    const gap = Math.min(0.06, n.sec * 0.12);
    synth.note(n.hz, t, { duration: n.sec - gap, legato: i > 0 });
    t += n.sec;
  });
  const tailMs = (t - ctx.currentTime) * 1000 + 450;
  await new Promise<void>((resolve) => {
    const id = setTimeout(resolve, tailMs);
    signal?.addEventListener("abort", () => {
      clearTimeout(id);
      synth.silence();
      resolve();
    });
  });
}

export class Transport {
  private ctx: AudioContext;
  private synth: OcarinaSynth;
  private timeline: Timeline;
  private settings: TransportSettings;
  private events: SoundEvent[] = [];
  private ticks: { beat: number; accent: boolean }[] = [];
  private state: TransportState = "stopped";
  private passes: Pass[] = [];
  private cursorBeat = 0;
  private pausedBeat: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private endTime = Infinity;
  private listeners = new Set<(s: TransportState) => void>();

  constructor(timeline: Timeline, settings: TransportSettings) {
    this.ctx = getAudioContext();
    this.synth = getSynth();
    this.timeline = timeline;
    this.settings = { ...settings };
    this.pausedBeat = settings.range.startBeat;
    this.rebuild();
  }

  get playbackState() {
    return this.state;
  }

  onStateChange(fn: (s: TransportState) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private secPerBeat() {
    return 60 / (this.settings.bpm * this.settings.tempoFactor);
  }

  private rebuild() {
    const r = this.settings.range;
    this.events = soundEvents(this.timeline, r);
    this.ticks = metronomeTicks(r, this.settings.beatsPerBar);
  }

  /** Audible beat position right now (compensates output latency). */
  position(): number {
    if (this.state !== "playing") return this.pausedBeat;
    const latency = (this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0);
    const t = this.ctx.currentTime - latency;
    let pass = this.passes[0];
    for (const p of this.passes) if (p.startTime <= t) pass = p;
    const beat = pass.startBeat + (t - pass.startTime) / this.secPerBeat();
    return Math.max(pass.startBeat, Math.min(beat, this.settings.range.endBeat));
  }

  async play() {
    if (this.state === "playing") return;
    if (this.ctx.state !== "running") await this.ctx.resume();
    const { startBeat, endBeat } = this.settings.range;
    let from = this.pausedBeat;
    if (from < startBeat || from >= endBeat - 1e-6) from = startBeat;
    const startTime = this.ctx.currentTime + 0.08;
    this.passes = [{ startTime, startBeat: from }];
    this.cursorBeat = from;
    this.endTime = Infinity;
    this.setState("playing");
    this.schedule();
    this.timer = setInterval(() => this.schedule(), TICK_MS);
  }

  pause() {
    if (this.state !== "playing") return;
    this.pausedBeat = this.position();
    this.halt();
    this.setState("paused");
  }

  stop() {
    this.halt();
    this.pausedBeat = this.settings.range.startBeat;
    this.setState("stopped");
  }

  /** Jump to a beat; keeps playing if currently playing. */
  seek(beat: number) {
    const wasPlaying = this.state === "playing";
    this.halt();
    this.pausedBeat = beat;
    if (wasPlaying) {
      this.state = "paused";
      void this.play();
    } else if (this.state === "stopped") this.setState("paused");
  }

  /** Change tempo/loop/metronome/range; restarts seamlessly from the current beat. */
  update(patch: Partial<TransportSettings>) {
    const beat = this.position();
    const wasPlaying = this.state === "playing";
    this.halt();
    this.settings = { ...this.settings, ...patch };
    this.rebuild();
    const r = this.settings.range;
    this.pausedBeat = beat >= r.startBeat && beat < r.endBeat ? beat : r.startBeat;
    if (wasPlaying) {
      this.state = "paused";
      void this.play();
    }
  }

  setTimeline(t: Timeline, range = fullRange(t)) {
    this.timeline = t;
    this.stop();
    this.update({ range });
  }

  /** True once playback has reached the end (non-looping). Call from the UI frame loop. */
  checkFinished(): boolean {
    if (this.state === "playing" && this.ctx.currentTime >= this.endTime) {
      this.stop();
      return true;
    }
    return false;
  }

  dispose() {
    this.halt();
    this.listeners.clear();
  }

  private halt() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.synth.silence();
  }

  private setState(s: TransportState) {
    this.state = s;
    this.listeners.forEach((l) => l(s));
  }

  private schedule() {
    const spb = this.secPerBeat();
    const { startBeat, endBeat } = this.settings.range;
    const horizon = this.ctx.currentTime + LOOKAHEAD_S;

    // Guard against loops of zero length.
    for (let guard = 0; guard < 64; guard++) {
      const pass = this.passes[this.passes.length - 1];
      const passEnd = pass.startTime + (endBeat - pass.startBeat) * spb;
      const untilBeat = pass.startBeat + (Math.min(horizon, passEnd) - pass.startTime) / spb;
      const toTime = (b: number) => pass.startTime + (b - pass.startBeat) * spb;

      for (const ev of this.events) {
        if (ev.startBeat >= this.cursorBeat - 1e-9 && ev.startBeat < untilBeat - 1e-9) {
          const gap = ev.connected ? Math.min(0.035, ev.beats * spb * 0.08) : Math.min(0.06, ev.beats * spb * 0.12);
          this.synth.note(ev.hz, toTime(ev.startBeat), { duration: ev.beats * spb - gap, legato: ev.legatoIn });
        }
      }
      if (this.settings.metronome) {
        for (const tk of this.ticks) {
          if (tk.beat >= this.cursorBeat - 1e-9 && tk.beat < untilBeat - 1e-9) this.synth.click(toTime(tk.beat), tk.accent);
        }
      }
      this.cursorBeat = untilBeat;

      if (horizon < passEnd) break;
      if (!this.settings.loop) {
        this.endTime = passEnd;
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
        break;
      }
      // Loop: next pass starts exactly where this one ends.
      this.passes.push({ startTime: passEnd, startBeat });
      if (this.passes.length > 4) this.passes.shift();
      this.cursorBeat = startBeat;
    }
  }
}
