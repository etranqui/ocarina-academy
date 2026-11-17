import { beforeAll, describe, expect, it } from "vitest";
import { toMidi } from "@/engine/music/pitch";
import { bestTransposition, describeShift, fitArrangement, playableShare } from "@/engine/import/fit";
import type { Arrangement } from "@/engine/music/schema";

// The stores read window.localStorage: give them an in-memory one.
beforeAll(() => {
  const mem = new Map<string, string>();
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
});

const midis = (...names: string[]) => names.map((n) => toMidi(n as never));

describe("fitting a melody in any key", () => {
  it("keeps the key when an octave move is enough", () => {
    expect(bestTransposition(midis("C4", "E4", "G4", "C5"))).toBe(12);
  });

  it("moves to another key only when that makes more notes playable", () => {
    // G4 is below the range; a whole octave up pushes the top note past F6, but up 2 semitones fits (A4–F6).
    const m = midis("G4", "C5", "E5", "G5", "C6", "D#6");
    const shift = bestTransposition(m);
    expect(shift % 12).not.toBe(0);
    expect(playableShare(m, shift)).toBe(1);
    expect(playableShare(m, 0)).toBeLessThan(1);
  });

  it("describes shifts in plain words and flags a new key on the arrangement", () => {
    expect(describeShift(12)).toBe("up 1 octave");
    expect(describeShift(-24)).toBe("down 2 octaves");
    expect(describeShift(2)).toBe("up 2 semitones");
    const melody = { events: midis("G4", "C5", "E5", "G5", "C6", "D#6").map((m) => ({ midi: m, beats: 1 })), bpm: 100, timeSignature: [4, 4] as [number, number], barStarts: [0, 4], warnings: [] };
    const { arrangement, report } = fitArrangement(melody, { sourceKind: "midi", fileName: "x.mid", complete: false, anyKey: true });
    expect(report.unplayable).toEqual([]);
    expect(arrangement.keyNote).toMatch(/semitone/);
    expect(arrangement.status).toBe("partial");
  });
});

describe("your songs and collections", () => {
  const arr: Arrangement = {
    kind: "full",
    status: "partial",
    source: { kind: "midi", note: "Imported from a.mid.", rhythm: "exact" },
    tempoBpm: 100,
    beatUnit: 4,
    timeSignature: [4, 4],
    phrases: [{ id: "p1", label: "Phrase 1", events: [{ type: "note", pitch: "C5", beats: 1 }] }],
  };

  it("adds, renames, files, orders and deletes songs", async () => {
    const u = await import("@/lib/userSongs");
    const c = u.createCollection("Christmas");
    const a = u.addUserSong({ title: "A", arrangement: arr, fileName: "a.mid", trackName: "Flute" }, c);
    const b = u.addUserSong({ title: "B", arrangement: arr, fileName: "b.mid", trackName: "Flute" }, c);
    expect(a.startsWith("u-")).toBe(true);
    expect(u.readUserLibrary().songs[a]!.theme.emblem).toBe("note");
    expect(u.collectionSongs(u.readUserLibrary(), c).map((s) => s.title)).toEqual(["A", "B"]);

    u.moveInCollection(c, b, -1);
    expect(u.collectionSongs(u.readUserLibrary(), c).map((s) => s.title)).toEqual(["B", "A"]);
    u.moveInCollection(c, b, -1); // already first: no change
    expect(u.readUserLibrary().collections[0].songIds).toEqual([b, a]);

    u.renameUserSong(a, "  Silent Night ");
    expect(u.readUserLibrary().songs[a]!.title).toBe("Silent Night");

    u.setInCollection(c, a, false);
    expect(u.readUserLibrary().collections[0].songIds).toEqual([b]);

    u.deleteUserSong(b);
    expect(u.readUserLibrary().songs[b]).toBeUndefined();
    expect(u.readUserLibrary().collections[0].songIds).toEqual([]);

    u.deleteCollection(c);
    expect(u.readUserLibrary().collections).toEqual([]);
    expect(u.readUserLibrary().songs[a]).toBeDefined(); // songs outlive their collection
  });

  it("keeps your songs out of the n / 12 counters", async () => {
    const { summarize } = await import("@/lib/progress");
    const entry = (songId: string, completed: boolean) => ({ songId, firstOpenedAt: 1, lastOpenedAt: 1, practiceSeconds: 60, notesAttempted: 10, notesCorrect: 9, completed, phrases: {} });
    const s = summarize({ version: 1, songs: { "sarias-song": entry("sarias-song", true), "u-abc": entry("u-abc", true) } as never });
    expect(s.started).toBe(1);
    expect(s.completed).toBe(1);
    expect(s.practiceSeconds).toBe(120);
    expect(s.recent).toHaveLength(2);
  });
});

describe("backups", () => {
  it("restores old progress-only backups and new ones with your songs", async () => {
    const { parseBackup } = await import("@/lib/backup");
    const progress = { version: 1, songs: {}, sessions: [] };
    expect(parseBackup(JSON.stringify(progress)).library).toBeUndefined();
    const library = { version: 1, songs: {}, collections: [] };
    const v2 = parseBackup(JSON.stringify({ app: "ocarina-academy", version: 2, progress, library }));
    expect(v2.library).toEqual(library);
    expect(() => parseBackup("{}")).toThrow(/isn't an Ocarina Academy backup/);
    expect(() => parseBackup("not json")).toThrow(/isn't an Ocarina Academy backup/);
  });

  it("round-trips through export and restore", async () => {
    const { exportBackup, restoreBackup } = await import("@/lib/backup");
    const u = await import("@/lib/userSongs");
    const before = Object.keys(u.readUserLibrary().songs).length;
    expect(restoreBackup(exportBackup())).toBe(before);
  });
});
