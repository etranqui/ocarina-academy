/**
 * Microphone input → PitchFrame stream (browser only).
 * Browser voice processing (echo cancellation, noise suppression, auto gain)
 * is turned off: it distorts sustained tones like an ocarina's.
 */
import { getAudioContext } from "../audio/transport";
import { rms, yin } from "./yin";
import type { PitchFrame } from "./classify";

export type MicError = "unsupported" | "insecure" | "denied" | "no-device" | "busy" | "unknown";

export class MicStartError extends Error {
  constructor(readonly code: MicError, message: string) {
    super(message);
  }
}

export function micSupport(): MicError | null {
  if (typeof window === "undefined") return "unsupported";
  if (!window.isSecureContext) return "insecure";
  if (!navigator.mediaDevices?.getUserMedia) return "unsupported";
  return null;
}

export const MIC_MESSAGES: Record<MicError, string> = {
  unsupported: "This browser can't use the microphone. Try a recent Chrome, Edge, Safari or Firefox.",
  insecure: "The microphone only works over HTTPS (or on localhost). Open the app from a secure address.",
  denied: "Microphone access was blocked. Allow it in your browser's site settings (the icon next to the address bar), then try again.",
  "no-device": "No microphone was found. Connect one and try again.",
  busy: "The microphone is being used by another app. Close it and try again.",
  unknown: "The microphone couldn't start.",
};

export class MicInput {
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private buf = new Float32Array(2048);
  /** RMS below this is treated as silence. Set from calibration. */
  noiseGate = 0.01;

  get active() {
    return !!this.stream;
  }

  async start(): Promise<void> {
    const unsupported = micSupport();
    if (unsupported) throw new MicStartError(unsupported, MIC_MESSAGES[unsupported]);
    const ctx = getAudioContext();
    if (ctx.state !== "running") await ctx.resume();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
      });
    } catch (e) {
      const name = (e as DOMException).name;
      const code: MicError =
        name === "NotAllowedError" || name === "SecurityError"
          ? "denied"
          : name === "NotFoundError" || name === "OverconstrainedError"
            ? "no-device"
            : name === "NotReadableError"
              ? "busy"
              : "unknown";
      throw new MicStartError(code, MIC_MESSAGES[code]);
    }
    this.source = ctx.createMediaStreamSource(this.stream);
    // Cut rumble and handling noise well below the ocarina's lowest note.
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 300;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.buf = new Float32Array(this.analyser.fftSize);
    this.source.connect(hp).connect(this.analyser);
  }

  /** Analyse the most recent ~43 ms of audio. */
  read(): PitchFrame {
    const t = performance.now();
    if (!this.analyser) return { hz: null, rms: 0, t };
    this.analyser.getFloatTimeDomainData(this.buf);
    const level = rms(this.buf);
    if (level < this.noiseGate) return { hz: null, rms: level, t };
    const r = yin(this.buf, this.analyser.context.sampleRate);
    return { hz: r && r.clarity > 0.8 ? r.hz : null, rms: level, t };
  }

  stop() {
    this.stream?.getTracks().forEach((tr) => tr.stop());
    this.source?.disconnect();
    this.stream = null;
    this.source = null;
    this.analyser = null;
  }
}
