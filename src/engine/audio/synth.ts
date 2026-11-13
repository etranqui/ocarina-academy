/**
 * Synthetic ocarina built directly on the Web Audio API (no Tone.js needed:
 * fewer bytes, and sample-accurate sync with the shared AudioContext clock).
 *
 * Timbre: an ocarina is a Helmholtz resonator, so the tone is nearly a pure
 * sine with faint 2nd/3rd harmonics, a breathy noise layer, a short "chiff"
 * on the attack and a gentle delayed vibrato. A small generated reverb gives
 * a stone-hall ambience.
 */

export interface VoiceOptions {
  /** Seconds the note is held (before release). */
  duration: number;
  /** Smoothly continue from the previous note (no re-attack chiff). */
  legato?: boolean;
  velocity?: number;
}

const INPUT_GAIN = 0.55;

export class OcarinaSynth {
  readonly ctx: AudioContext;
  readonly input: GainNode;
  private noise: AudioBuffer;
  private live = new Set<AudioScheduledSourceNode>();

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.noise = makeNoise(ctx, 2);

    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 7000;
    tone.Q.value = 0.3;

    const dry = ctx.createGain();
    dry.gain.value = 0.85;
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    const reverb = ctx.createConvolver();
    reverb.buffer = makeImpulse(ctx, 1.8, 2.6);

    this.input = ctx.createGain();
    this.input.gain.value = INPUT_GAIN;
    this.input.connect(tone);
    tone.connect(dry).connect(destination);
    tone.connect(reverb).connect(wet).connect(destination);
  }

  /** Schedule one note. Returns the time at which it is fully silent. */
  note(hz: number, when: number, opts: VoiceOptions): number {
    const { ctx } = this;
    const vel = opts.velocity ?? 1;
    const attack = opts.legato ? 0.018 : 0.035;
    const release = 0.07;
    const end = when + Math.max(0.03, opts.duration);
    const stopAt = end + release * 6;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(0.9 * vel, when + attack);
    env.gain.setTargetAtTime(0.75 * vel, when + attack, 0.25);
    env.gain.setTargetAtTime(0, end, release / 3);
    env.connect(this.input);

    // Harmonic stack
    const partials: [number, number][] = [
      [1, 1],
      [2, 0.06],
      [3, 0.025],
    ];
    const vibrato = ctx.createOscillator();
    vibrato.frequency.value = 5.3;
    const vibDepth = ctx.createGain();
    vibDepth.gain.setValueAtTime(0, when);
    // Vibrato only blooms on longer notes, as players do.
    vibDepth.gain.linearRampToValueAtTime(0, when + 0.28);
    vibDepth.gain.linearRampToValueAtTime(hz * 0.0045, when + 0.7);
    vibrato.connect(vibDepth);

    for (const [mult, amp] of partials) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      // Tiny pitch scoop on attack (breath settling into the note).
      const f = hz * mult;
      osc.frequency.setValueAtTime(opts.legato ? f : f * 0.985, when);
      osc.frequency.exponentialRampToValueAtTime(f, when + 0.05);
      const vibScale = ctx.createGain();
      vibScale.gain.value = mult;
      vibDepth.connect(vibScale).connect(osc.frequency);
      const g = ctx.createGain();
      g.gain.value = amp;
      osc.connect(g).connect(env);
      this.start(osc, when, stopAt);
    }
    this.start(vibrato, when, stopAt);

    // Breath noise, band-passed around the note
    const breath = ctx.createBufferSource();
    breath.buffer = this.noise;
    breath.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = hz * 1.5;
    bp.Q.value = 0.9;
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0, when);
    bg.gain.linearRampToValueAtTime(opts.legato ? 0.02 : 0.09, when + 0.012);
    bg.gain.setTargetAtTime(0.018, when + 0.03, 0.05);
    bg.gain.setTargetAtTime(0, end, release / 3);
    breath.connect(bp).connect(bg).connect(env);
    this.start(breath, when, stopAt, Math.random() * 1.5, () => {
      // All of this voice's sources stop together; release the rest of its graph.
      for (const n of [env, vibDepth, bp, bg]) n.disconnect();
    });

    return stopAt;
  }

  /** Short metronome click. */
  click(when: number, accent: boolean) {
    const { ctx } = this;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = accent ? 1760 : 1320;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(accent ? 0.35 : 0.22, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    osc.connect(g).connect(this.ctx.destination);
    this.start(osc, when, when + 0.06);
  }

  /** Silence everything (pause/stop/seek) with a 15 ms fade so it doesn't click. */
  silence() {
    if (!this.live.size) return;
    const now = this.ctx.currentTime;
    const g = this.input.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + 0.015);
    g.setValueAtTime(INPUT_GAIN, now + 0.03); // back to normal for whatever plays next
    for (const n of this.live) {
      try {
        n.stop(now + 0.02);
      } catch {
        /* already stopped */
      }
    }
    this.live.clear();
  }

  /** Number of sounding/scheduled sources (diagnostics and tests). */
  get activeSources() {
    return this.live.size;
  }

  private start(node: AudioScheduledSourceNode, when: number, stopAt: number, offset?: number, onDone?: () => void) {
    this.live.add(node);
    node.onended = () => {
      this.live.delete(node);
      node.disconnect();
      onDone?.();
    };
    if (offset !== undefined && node instanceof AudioBufferSourceNode) node.start(when, offset);
    else node.start(when);
    node.stop(stopAt);
  }
}

function makeNoise(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function makeImpulse(ctx: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}
