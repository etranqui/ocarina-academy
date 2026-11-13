import { describe, expect, it } from "vitest";
import { SONGS } from "@/data/songs";
import { canonicalPitch, centsBetween, displayPitch, pitchToHz, toMidi } from "./music/pitch";
import { buildTimeline } from "./music/timeline";
import { analyze } from "./music/analysis";
import { validateSong } from "./music/validate";
import { chart, getFingering, transition, DEFAULT_PROFILE } from "./fingering/engine";

describe("pitch", () => {
  it("converts names to MIDI and Hz", () => {
    expect(toMidi("A4")).toBe(69);
    expect(toMidi("C5")).toBe(72);
    expect(pitchToHz("C5")).toBeCloseTo(523.25, 2);
    expect(canonicalPitch("Bb5")).toBe("A#5");
    expect(displayPitch("A#5")).toBe("A♯5");
    expect(centsBetween(pitchToHz("C#5"), pitchToHz("C5"))).toBeCloseTo(100, 6);
  });
});

describe("fingering profile", () => {
  const holeIds = new Set(DEFAULT_PROFILE.holes.map((h) => h.id));

  it("has 12 unique holes", () => {
    expect(holeIds.size).toBe(12);
  });

  it("only references real holes and uses sub-holes only below E5", () => {
    for (const f of DEFAULT_PROFILE.fingerings) {
      for (const h of f.covered) expect(holeIds.has(h)).toBe(true);
      if (toMidi(f.pitch) >= toMidi("E5")) {
        expect(f.covered).not.toContain("LS");
        expect(f.covered).not.toContain("RS");
      }
    }
  });

  it("covers fewer holes as pitch rises (naturals C5–F6)", () => {
    const counts = DEFAULT_PROFILE.fingerings
      .filter((f) => !f.pitch.includes("#") && toMidi(f.pitch) >= toMidi("C5"))
      .map((f) => f.covered.length);
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeLessThan(counts[i - 1]);
  });

  it("matches the user's Saria's Song chart", () => {
    expect(getFingering("A5")!.covered.sort()).toEqual(["L1", "L3", "L4", "LT", "RT"]);
    expect(getFingering("D6")!.covered.sort()).toEqual(["L1", "RT"]);
    expect(getFingering("E6")!.covered).toEqual(["L1"]);
  });

  it("leaves undefined notes empty instead of guessing", () => {
    const undefinedPitches = DEFAULT_PROFILE.undefinedNotes.flatMap((u) => u.pitches);
    for (const p of undefinedPitches) expect(getFingering(p)).toBeNull();
    expect(chart().filter((c) => !c.fingering).map((c) => c.pitch).sort()).toEqual([...undefinedPitches].sort());
  });

  it("computes hole transitions", () => {
    expect(transition(getFingering("F5"), getFingering("A5"))).toEqual({ lift: ["L2", "R1"], press: [] });
  });
});

describe("songs", () => {
  it("has all 12 songs", () => {
    expect(SONGS).toHaveLength(12);
    expect(new Set(SONGS.map((s) => s.id)).size).toBe(12);
  });

  it.each(SONGS.map((s) => [s.title, s] as const))("%s is fully playable on the replica", (_, song) => {
    expect(validateSong(song)).toEqual([]);
  });

  it("never presents an unverified full arrangement as verified", () => {
    for (const s of SONGS) expect(s.arrangements.full.status).not.toBe("verified");
  });

  it("expands forms into a timeline", () => {
    const zelda = SONGS.find((s) => s.id === "zeldas-lullaby")!;
    const t = buildTimeline(zelda.arrangements.game);
    expect(t.notes.map((n) => n.pitch)).toEqual(["B5", "D6", "A5", "B5", "D6", "A5"]);
    expect(t.sections).toHaveLength(2);
    expect(t.notes[3].formIndex).toBe(1);
  });

  it("computes difficulty only for real content", () => {
    const prelude = SONGS.find((s) => s.id === "prelude-of-light")!;
    expect(analyze({ ...prelude.arrangements.full, phrases: [], form: undefined })).toBeNull();
    expect(analyze(prelude.arrangements.game)?.noteCount).toBe(6);
    expect(analyze(prelude.arrangements.full)?.noteCount).toBe(15);
    const storms = SONGS.find((s) => s.id === "song-of-storms")!;
    expect(analyze(storms.arrangements.full)?.noteCount).toBe(43);
  });
});

describe("game rhythms", () => {
  it("fill whole bars when the rhythm is confirmed", () => {
    for (const s of SONGS) {
      const g = s.arrangements.game;
      if (g.source.rhythm !== "exact") continue;
      const t = buildTimeline(g);
      const bar = (g.timeSignature[0] * 4) / g.timeSignature[1];
      expect(t.totalBeats % bar, s.title).toBe(0);
    }
  });

  it("keeps Sun's Song as an explained even pulse", () => {
    const sun = SONGS.find((s) => s.id === "suns-song")!.arrangements.game;
    expect(sun.source.rhythm).toBe("uniform");
    expect(sun.source.rhythmNote).toMatch(/pause before the repeat/);
    expect(SONGS.filter((s) => s.arrangements.game.source.rhythm === "exact")).toHaveLength(11);
  });
});
