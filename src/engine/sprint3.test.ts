import { describe, expect, it } from "vitest";
import { yin, rms } from "./pitch/yin";
import { classify, type PitchFrame } from "./pitch/classify";
import { centsBetween, pitchToHz } from "./music/pitch";
import { makeChunks, PracticeSession, type PracticeNote } from "./practice/session";

const SR = 48000;

function tone(hz: number, { n = 2048, harmonics = [1, 0.06, 0.02], noise = 0, phase = 0 } = {}) {
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = 0;
    harmonics.forEach((a, k) => (v += a * Math.sin((2 * Math.PI * hz * (k + 1) * i) / SR + phase)));
    b[i] = 0.4 * v + noise * (Math.random() * 2 - 1);
  }
  return b;
}

describe("YIN", () => {
  it.each(["A4", "C5", "D5", "F5", "A5", "B5", "D6", "F6"])("detects %s within 3 cents", (p) => {
    const hz = pitchToHz(p);
    const r = yin(tone(hz), SR)!;
    expect(Math.abs(centsBetween(r.hz, hz))).toBeLessThan(3);
    expect(r.clarity).toBeGreaterThan(0.9);
  });

  it("copes with breath noise", () => {
    const hz = pitchToHz("E5");
    const r = yin(tone(hz, { noise: 0.08 }), SR)!;
    expect(Math.abs(centsBetween(r.hz, hz))).toBeLessThan(8);
  });

  it("does not jump an octave on a strong 2nd harmonic", () => {
    const hz = pitchToHz("C5");
    const r = yin(tone(hz, { harmonics: [1, 0.6, 0.2] }), SR)!;
    expect(Math.abs(centsBetween(r.hz, hz))).toBeLessThan(5);
  });

  it("rejects pure noise", () => {
    const b = new Float32Array(2048).map(() => Math.random() * 2 - 1);
    expect(yin(b, SR)).toBeNull();
    expect(rms(b)).toBeGreaterThan(0.5);
  });
});

describe("classify", () => {
  const o = { toleranceCents: 30, tuningCents: 0 };
  const a5 = pitchToHz("A5");
  const at = (cents: number) => a5 * Math.pow(2, cents / 1200);

  it("labels in-tune, sharp, flat, wrong and octave", () => {
    expect(classify(at(10), a5, o).kind).toBe("correct");
    expect(classify(at(45), a5, o).kind).toBe("sharp");
    expect(classify(at(-45), a5, o).kind).toBe("flat");
    expect(classify(pitchToHz("B5"), a5, o)).toMatchObject({ kind: "wrong", heard: "B5" });
    expect(classify(pitchToHz("A4"), a5, o).kind).toBe("octave");
  });

  it("applies the calibration offset", () => {
    // Instrument plays 40 cents sharp across the board → that is "in tune" for it.
    expect(classify(at(40), a5, { toleranceCents: 30, tuningCents: 40 }).kind).toBe("correct");
    expect(classify(at(0), a5, { toleranceCents: 30, tuningCents: 40 }).kind).toBe("flat");
  });
});

const N = (pitch: string, section = 0, index = 0): PracticeNote => ({
  index,
  pitch,
  midi: 0,
  hz: pitchToHz(pitch),
  section,
  phraseId: `p${section}`,
});
const notes = (spec: string, section = 0) => spec.split(" ").map((p, i) => ({ ...N(p, section, i), midi: Math.round(69 + 12 * Math.log2(pitchToHz(p) / 440)) }));

/** Feed `ms` of frames at 20 ms spacing. */
function play(s: PracticeSession, pitch: string | null, ms: number, t0: number, rmsLevel = 0.2): number {
  let t = t0;
  for (; t < t0 + ms; t += 20) {
    const f: PitchFrame = { hz: pitch ? pitchToHz(pitch) : null, rms: pitch ? rmsLevel : 0.001, t };
    s.push(f);
  }
  return t;
}

describe("practice chunks", () => {
  it("splits by difficulty without crossing phrases", () => {
    const ns = [...notes("D5 F5 A5 B5 D6 A5", 0), ...notes("B5 A5 F5", 1)];
    expect(makeChunks(ns, "beginner")).toHaveLength(9);
    expect(makeChunks(ns, "intermediate")).toEqual([[0, 3], [3, 6], [6, 9]]);
    expect(makeChunks(ns, "advanced")).toEqual([[0, 9]]);
  });
});

describe("practice session", () => {
  const opts = { toleranceCents: 30, tuningCents: 0 };

  it("beginner: waits for the right note, counts wrong ones, then advances", () => {
    const s = new PracticeSession(notes("F5 A5"), { ...opts, difficulty: "beginner" });
    expect(s.state.phase).toBe("listen");
    s.push({ hz: pitchToHz("F5"), rms: 0.2, t: 0 }); // ignored while listening
    s.beginPlay(0);
    let t = play(s, "G5", 500, 0);
    expect(s.state.feedback).toMatchObject({ kind: "wrong", heard: "G5" });
    expect(s.state.results[0]).toEqual({ status: "pending", mistakes: 1 });
    t = play(s, null, 100, t);
    t = play(s, "F5", 400, t);
    expect(s.state.results[0].status).toBe("correct");
    expect(s.state.phase).toBe("listen"); // next note is its own chunk
    s.beginPlay(t);
    play(s, "A5", 400, t);
    expect(s.state.phase).toBe("done");
    expect(s.summary()).toMatchObject({ correct: 2, mistakes: 1, attempted: 3 });
  });

  it("reports sharp/flat without counting a mistake", () => {
    const s = new PracticeSession(notes("A5"), { ...opts, difficulty: "beginner" });
    s.beginPlay(0);
    const sharp = pitchToHz("A5") * Math.pow(2, 45 / 1200);
    for (let t = 0; t < 600; t += 20) s.push({ hz: sharp, rms: 0.2, t });
    expect(s.state.feedback.kind).toBe("sharp");
    expect(s.state.results[0].mistakes).toBe(0);
  });

  it("warns after a long silence", () => {
    const s = new PracticeSession(notes("A5"), { ...opts, difficulty: "beginner", silentMs: 1000 });
    s.beginPlay(0);
    play(s, null, 1200, 0);
    expect(s.state.feedback.kind).toBe("silent");
  });

  it("needs a re-articulation for repeated notes", () => {
    const s = new PracticeSession(notes("A5 A5"), { ...opts, difficulty: "intermediate" });
    s.beginPlay(0);
    let t = play(s, "A5", 300, 0);
    expect(s.state.cursor).toBe(1);
    t = play(s, "A5", 600, t); // still the same breath
    expect(s.state.results[1].status).toBe("pending");
    expect(s.state.feedback.rearticulate).toBe(true);
    t = play(s, "A5", 60, t, 0.05); // tongue dip
    play(s, "A5", 300, t);
    expect(s.state.phase).toBe("done");
  });

  it("advanced: a skipped note is marked missed and play continues", () => {
    const s = new PracticeSession(notes("D5 F5 A5"), { ...opts, difficulty: "advanced" });
    s.beginPlay(0);
    let t = play(s, "D5", 200, 0);
    t = play(s, "A5", 400, t); // jumped over F5
    expect(s.state.results.map((r) => r.status)).toEqual(["correct", "missed", "correct"]);
    expect(s.state.phase).toBe("done");
    const sum = s.summary();
    expect(sum.sections[0].completed).toBe(false); // 2/3 < 80 %
  });
});
