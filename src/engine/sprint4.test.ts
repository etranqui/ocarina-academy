import { describe, expect, it } from "vitest";
import { activity, type ProgressState } from "@/lib/progress";

const DAY = 86_400_000;
const NOW = new Date(2026, 10, 12, 18, 0).getTime();
const at = (daysAgo: number, seconds = 60) => ({
  at: NOW - daysAgo * DAY,
  songId: "sarias-song" as const,
  mode: "game" as const,
  seconds,
  notesAttempted: 10,
  notesCorrect: 8,
});
const state = (sessions: ReturnType<typeof at>[]): ProgressState => ({ version: 1, songs: {}, sessions });

describe("progress activity", () => {
  it("sums practice per day over the window, oldest first", () => {
    const a = activity(state([at(0, 30), at(0, 90), at(3, 120), at(40)]), 28, NOW);
    expect(a.series).toHaveLength(28);
    expect(a.series[27].seconds).toBe(120);
    expect(a.series[24].seconds).toBe(120);
    expect(a.series.reduce((n, d) => n + d.seconds, 0)).toBe(240); // day 40 is outside the window
  });

  it("counts a streak ending today", () => {
    expect(activity(state([at(0), at(1), at(2), at(4)]), 28, NOW).streak).toBe(3);
  });

  it("keeps yesterday's streak alive until you practise today", () => {
    expect(activity(state([at(1), at(2)]), 28, NOW).streak).toBe(2);
    expect(activity(state([at(2), at(3)]), 28, NOW).streak).toBe(0);
  });

  it("works with progress saved before sessions were recorded", () => {
    const a = activity({ version: 1, songs: {} }, 28, NOW);
    expect(a.streak).toBe(0);
    expect(a.activeDays).toBe(0);
  });
});

describe("rhythm on full arrangements", async () => {
  const { applyRhythm, extractRhythm } = await import("./music/rhythm");
  const { buildTimeline } = await import("./music/timeline");
  const { SONGS } = await import("@/data/songs");
  const storms = SONGS.find((s) => s.id === "song-of-storms")!.arrangements.full;

  it("one rhythm per phrase is reused wherever the form repeats it", () => {
    const r = extractRhythm(storms);
    r.tempoBpm = 164;
    r.phrases.verse = r.phrases.verse.map((n, i) => ({ beats: i < 3 ? 0.5 : 1, restAfter: i === 12 ? 1 : 0 }));
    const out = applyRhythm(storms, r, "mine");
    const t = buildTimeline(out);
    expect(t.notes).toHaveLength(43); // pitches untouched
    const verses = t.sections.filter((s) => s.phraseId === "verse");
    expect(verses).toHaveLength(2);
    for (const v of verses) expect(t.notes.slice(v.noteRange[0], v.noteRange[0] + 3).map((n) => n.beats)).toEqual([0.5, 0.5, 0.5]);
    expect(t.rests).toHaveLength(2); // the rest after the verse, both times
    expect(out.status).toBe("partial"); // a user rhythm never marks bundled content verified
    expect(out.source.rhythm).toBe("exact");
  });
});

describe("saved rhythms follow note corrections", async () => {
  const { alignRhythm, applyRhythm } = await import("./music/rhythm");
  const { buildTimeline } = await import("./music/timeline");
  const { SONGS } = await import("@/data/songs");
  const { withHistory } = await import("@/lib/arrangements");
  const zelda = SONGS.find((s) => s.id === "zeldas-lullaby")!.arrangements.full;
  // Saved before C D were inserted, and before lengths remembered their pitch.
  const legacy = {
    timeSignature: [4, 4] as [number, number],
    tempoBpm: 90,
    updatedAt: 1,
    phrases: { call: [2, 1, 3, 2, 1, 3].map((beats) => ({ beats, restAfter: 0 })) },
  };

  it("keeps lengths on the notes they were set for, new notes get a default", () => {
    const { rhythm, changed } = alignRhythm(zelda, withHistory("zeldas-lullaby", "full", legacy));
    expect(changed).toEqual(["call"]);
    expect(rhythm.phrases.call.map((n) => `${n.pitch}:${n.beats}`)).toEqual([
      "E5:2", "G5:1", "D5:3", "C5:0.5", "D5:0.5", "E5:2", "G5:1", "D5:3",
    ]);
    const t = buildTimeline(applyRhythm(zelda, withHistory("zeldas-lullaby", "full", legacy), "mine"));
    expect(t.notes.slice(0, 8).map((n) => n.beats)).toEqual([2, 1, 3, 0.5, 0.5, 2, 1, 3]);
  });

  it("without history, falls back to position and flags the phrase", () => {
    const { rhythm, changed } = alignRhythm(zelda, legacy);
    expect(changed).toEqual(["call"]);
    expect(rhythm.phrases.call).toHaveLength(8);
  });

  it("leaves untouched phrases alone", () => {
    const r = { ...legacy, phrases: { rise: [1, 1, 2, 1, 3].map((beats) => ({ beats, restAfter: 0 })) } };
    expect(alignRhythm(zelda, r).changed).toEqual([]);
  });
});

describe("Bolero's third high swing has its own rhythm", async () => {
  const { applyRhythm, extractRhythm } = await import("./music/rhythm");
  const { buildTimeline } = await import("./music/timeline");
  const { SONGS } = await import("@/data/songs");
  const { withHistory } = await import("@/lib/arrangements");
  const bolero = SONGS.find((s) => s.id === "bolero-of-fire")!.arrangements.full;

  it("splits it from the first two and seeds it from an older save", () => {
    const r = extractRhythm(bolero);
    const legacy = { ...r, phrases: { ...r.phrases, high: [0.25, 0.25, 0.25, 1].map((beats) => ({ beats, restAfter: 0.5 })) } };
    delete (legacy.phrases as Record<string, unknown>).return;
    const seeded = withHistory("bolero-of-fire", "full", legacy);
    expect(seeded.phrases.return).toEqual(seeded.phrases.high);
    seeded.phrases.return = [1, 1, 1, 1].map((beats) => ({ beats, restAfter: 0 }));
    const t = buildTimeline(applyRhythm(bolero, seeded, "mine"));
    const len = (id: string) => t.sections.filter((s) => s.phraseId === id).map((s) => t.notes[s.noteRange[0]].beats);
    expect(len("high")).toEqual([0.25, 0.25]);
    expect(len("return")).toEqual([1]);
  });
});
