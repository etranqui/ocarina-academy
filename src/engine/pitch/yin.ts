/**
 * YIN fundamental-frequency estimator (de Cheveigné & Kawahara, 2002).
 *
 * Ocarinas are close to pure sine tones with weak harmonics, which YIN
 * handles well. The lag search is limited to the instrument's range
 * (with margin), which also prevents most octave errors.
 */

export interface YinOptions {
  /** Absolute threshold on the normalised difference (lower = stricter). */
  threshold?: number;
  minHz?: number;
  maxHz?: number;
}

export interface YinResult {
  hz: number;
  /** 0..1, how periodic the signal is (1 = perfectly periodic). */
  clarity: number;
}

export function yin(buf: Float32Array, sampleRate: number, opts: YinOptions = {}): YinResult | null {
  const threshold = opts.threshold ?? 0.12;
  const minHz = opts.minHz ?? 380;
  const maxHz = opts.maxHz ?? 1900;

  const tauMax = Math.min(Math.floor(sampleRate / minHz), Math.floor(buf.length / 2));
  const tauMin = Math.max(2, Math.floor(sampleRate / maxHz));
  const W = buf.length - tauMax;
  if (W <= 0 || tauMin >= tauMax) return null;

  // Difference function d(τ)
  const d = new Float32Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0;
    for (let j = 0; j < W; j++) {
      const diff = buf[j] - buf[j + tau];
      sum += diff * diff;
    }
    d[tau] = sum;
  }

  // Cumulative mean normalised difference d'(τ)
  const cmnd = new Float32Array(tauMax + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    running += d[tau];
    cmnd[tau] = running > 0 ? (d[tau] * tau) / running : 1;
  }

  // First dip below threshold, then follow it to its local minimum.
  let tau = -1;
  for (let t = tauMin; t < tauMax; t++) {
    if (cmnd[t] < threshold) {
      while (t + 1 < tauMax && cmnd[t + 1] < cmnd[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) return null;

  // Parabolic interpolation for sub-sample precision.
  let better = tau;
  if (tau > 1 && tau < tauMax) {
    const s0 = cmnd[tau - 1];
    const s1 = cmnd[tau];
    const s2 = cmnd[tau + 1];
    const denom = 2 * (2 * s1 - s2 - s0);
    if (denom !== 0) better = tau + (s2 - s0) / denom;
  }
  return { hz: sampleRate / better, clarity: Math.max(0, Math.min(1, 1 - cmnd[tau])) };
}

export function rms(buf: Float32Array): number {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / buf.length);
}
