import { describe, expect, it } from "vitest";
import { DOMParser } from "@xmldom/xmldom";
import { Midi } from "@tonejs/midi";
import { SONGS } from "@/data/songs";
import { buildTimeline } from "./music/timeline";
import type { Arrangement } from "./music/schema";
import { metronomeTicks, noteAt, sectionRange, soundEvents, fullRange } from "./audio/schedule";
import { parseMusicXml } from "./import/musicxml";
import { defaultTrack, midiTracks, parseMidi } from "./import/midi";
import { bestOctaveShift, fitArrangement } from "./import/fit";

const xml = (body: string) =>
  new DOMParser().parseFromString(
    `<?xml version="1.0"?><score-partwise><work><work-title>Test</work-title></work><part-list/><part id="P1">${body}</part></score-partwise>`,
    "text/xml",
  ) as unknown as Document;

const n = (step: string, oct: number, dur: number, extra = "") =>
  `<note><pitch><step>${step}</step><octave>${oct}</octave></pitch><duration>${dur}</duration><voice>1</voice>${extra}</note>`;
const rest = (dur: number) => `<note><rest/><duration>${dur}</duration><voice>1</voice></note>`;

describe("schedule", () => {
  const saria = SONGS.find((s) => s.id === "sarias-song")!;
  const t = buildTimeline(saria.arrangements.full);

  it("produces one sound event per note in range", () => {
    expect(soundEvents(t, fullRange(t))).toHaveLength(40);
    expect(soundEvents(t, sectionRange(t, 2)).map((e) => e.indices[0])).toEqual([16, 17, 18, 19]);
  });

  it("merges ties into one event", () => {
    const arr: Arrangement = {
      ...saria.arrangements.game,
      form: undefined,
      phrases: [{ id: "a", label: "A", events: [
        { type: "note", pitch: "C5", beats: 1, tie: true },
        { type: "note", pitch: "C5", beats: 1 },
        { type: "rest", beats: 1 },
        { type: "note", pitch: "D5", beats: 1 },
      ] }],
    };
    const tl = buildTimeline(arr);
    const ev = soundEvents(tl, fullRange(tl));
    expect(ev).toHaveLength(2);
    expect(ev[0]).toMatchObject({ indices: [0, 1], beats: 2, connected: false });
    expect(noteAt(tl, 2.5)).toEqual({ current: null, upcoming: 2 });
    expect(noteAt(tl, 3.2)).toEqual({ current: 2, upcoming: null });
  });

  it("finds the sounding and upcoming note", () => {
    expect(noteAt(t, 0)).toEqual({ current: 0, upcoming: 1 });
    expect(noteAt(t, 4.5)).toEqual({ current: 7, upcoming: 8 }); // F A B F A B F | A — eighths and quarters
    expect(noteAt(t, -1)).toEqual({ current: null, upcoming: 0 });
  });

  it("accents bar downbeats", () => {
    expect(metronomeTicks({ startBeat: 2, endBeat: 6 }, 4)).toEqual([
      { beat: 2, accent: false }, { beat: 3, accent: false }, { beat: 4, accent: true }, { beat: 5, accent: false },
    ]);
  });
});

describe("MusicXML import", () => {
  it("reads notes, rests, ties, tempo and time signature", () => {
    const m = parseMusicXml(xml(`
      <measure number="1"><attributes><divisions>2</divisions><time><beats>3</beats><beat-type>4</beat-type></time></attributes>
        <direction><sound tempo="88"/></direction>
        ${n("F", 4, 2)}${n("A", 4, 1)}${n("B", 4, 1)}${rest(2)}</measure>
      <measure number="2">${n("C", 5, 6, '<tie type="start"/>')}</measure>
      <measure number="3">${n("C", 5, 2, '<tie type="stop"/>')}${rest(4)}</measure>`));
    expect(m.title).toBe("Test");
    expect(m.bpm).toBe(88);
    expect(m.timeSignature).toEqual([3, 4]);
    expect(m.barStarts).toEqual([0, 3, 6]);
    expect(m.events).toEqual([
      { midi: 65, beats: 1 }, { midi: 69, beats: 0.5 }, { midi: 71, beats: 0.5 }, { midi: null, beats: 1 },
      { midi: 72, beats: 3, tie: true }, { midi: 72, beats: 1 }, { midi: null, beats: 2 },
    ]);
  });

  it("expands repeats with first and second endings", () => {
    const m = parseMusicXml(xml(`
      <measure number="1"><attributes><divisions>1</divisions></attributes><barline location="left"><repeat direction="forward"/></barline>${n("C", 5, 4)}</measure>
      <measure number="2"><barline location="left"><ending number="1" type="start"/></barline>${n("D", 5, 4)}<barline location="right"><ending number="1" type="stop"/><repeat direction="backward"/></barline></measure>
      <measure number="3"><barline location="left"><ending number="2" type="start"/></barline>${n("E", 5, 4)}<barline location="right"><ending number="2" type="stop"/></barline></measure>
      <measure number="4">${n("F", 5, 4)}</measure>`));
    expect(m.events.map((e) => e.midi)).toEqual([72, 74, 72, 76, 77]);
  });

  it("keeps the top note of chords and drops other voices", () => {
    const m = parseMusicXml(xml(`
      <measure number="1"><attributes><divisions>1</divisions></attributes>
        ${n("C", 5, 2)}<note><chord/><pitch><step>E</step><octave>5</octave></pitch><duration>2</duration><voice>1</voice></note>
        ${n("D", 5, 2)}<backup><duration>4</duration></backup>${n("C", 3, 4).replace("<voice>1</voice>", "<voice>2</voice>")}</measure>`));
    expect(m.events.map((e) => e.midi)).toEqual([76, 74]);
    expect(m.warnings.join(" ")).toMatch(/top note/);
  });

  it("rejects non-MusicXML", () => {
    const doc = new DOMParser().parseFromString("<html/>", "text/xml") as unknown as Document;
    expect(() => parseMusicXml(doc)).toThrow(/Not a MusicXML/);
  });
});

describe("MIDI import", () => {
  function sampleMidi() {
    const midi = new Midi();
    midi.header.setTempo(100);
    const drums = midi.addTrack();
    drums.channel = 9;
    drums.addNote({ midi: 36, ticks: 0, durationTicks: 100 });
    const tr = midi.addTrack();
    tr.name = "Melody";
    const ppq = midi.header.ppq;
    // D4 F4 (with a lower chord tone) rest A4 — written an octave below the ocarina
    tr.addNote({ midi: 62, ticks: 0, durationTicks: ppq });
    tr.addNote({ midi: 65, ticks: ppq, durationTicks: ppq });
    tr.addNote({ midi: 57, ticks: ppq, durationTicks: ppq });
    tr.addNote({ midi: 69, ticks: ppq * 3, durationTicks: ppq * 2 - 7 });
    return new Midi(midi.toArray());
  }

  it("picks the melodic track and reduces it to one line", () => {
    const midi = sampleMidi();
    const tracks = midiTracks(midi);
    expect(tracks.find((t) => t.percussion)).toBeTruthy();
    const idx = defaultTrack(tracks);
    expect(midi.tracks[idx].name).toBe("Melody");
    const m = parseMidi(midi, idx);
    expect(m.bpm).toBe(100);
    expect(m.events).toEqual([
      { midi: 62, beats: 1 }, { midi: 65, beats: 1 }, { midi: null, beats: 1 }, { midi: 69, beats: 2 },
    ]);
  });

  it("fits imported melodies into the Alto C range", () => {
    const m = parseMidi(sampleMidi(), 1);
    expect(bestOctaveShift([62, 65, 69])).toBe(12);
    const { arrangement, report } = fitArrangement(m, { sourceKind: "midi", fileName: "x.mid", complete: true });
    expect(report.octaveShift).toBe(12);
    expect(report.unplayable).toEqual([]);
    expect(arrangement.status).toBe("verified");
    expect(buildTimeline(arrangement).notes.map((x) => x.pitch)).toEqual(["D5", "F5", "A5"]);
  });

  it("never marks content verified unless complete and fully playable", () => {
    const m = parseMidi(sampleMidi(), 1);
    expect(fitArrangement(m, { sourceKind: "midi", fileName: "x.mid", complete: false }).arrangement.status).toBe("partial");
    const sharp = { ...m, events: [...m.events, { midi: 79, beats: 1 }] }; // G5 → G6, above the instrument
    const r = fitArrangement(sharp, { sourceKind: "midi", fileName: "x.mid", complete: true });
    expect(r.arrangement.status).toBe("partial");
    expect(r.report.unplayable).toEqual([{ pitch: "G6", count: 1 }]);
  });
});

describe("rhythm", async () => {
  const { applyRhythm, extractRhythm, tapsToBeats } = await import("./music/rhythm");
  const zelda = SONGS.find((s) => s.id === "zeldas-lullaby")!.arrangements.game;
  const sun = SONGS.find((s) => s.id === "suns-song")!.arrangements.game;

  it("round-trips the current rhythm", () => {
    const r = extractRhythm(zelda);
    expect(r.phrases.motif).toEqual([{ beats: 2, restAfter: 0, pitch: "B5" }, { beats: 1, restAfter: 0, pitch: "D6" }, { beats: 3, restAfter: 0, pitch: "A5" }]);
    expect(buildTimeline(applyRhythm(zelda, r, "x")).notes.map((n) => n.beats)).toEqual([2, 1, 3, 2, 1, 3]);
    const epona = SONGS.find((s) => s.id === "eponas-song")!.arrangements.game;
    expect(extractRhythm(epona).phrases.call[2]).toEqual({ beats: 1.5, restAfter: 0.5, pitch: "A5" });
  });

  it("applies durations and rests without touching pitches", () => {
    const r = extractRhythm(sun);
    r.timeSignature = [3, 4];
    r.phrases.rise = [{ beats: 2, restAfter: 0 }, { beats: 1, restAfter: 0 }, { beats: 2, restAfter: 1 }];
    const arr = applyRhythm(sun, r, "mine");
    const t = buildTimeline(arr);
    expect(t.notes.map((n) => n.pitch)).toEqual(["A5", "F5", "D6", "A5", "F5", "D6"]);
    expect(t.notes.map((n) => n.startBeat)).toEqual([0, 2, 3, 6, 8, 9]);
    expect(t.totalBeats).toBe(12);
    expect(arr.source).toMatchObject({ rhythm: "exact", rhythmNote: "mine" });
  });

  it("quantises taps to the grid", () => {
    // 120 bpm → 500 ms per beat
    expect(tapsToBeats([0, 1000, 1480, 2270, 2500], 120)).toEqual([2, 1, 1.5, 0.5]);
  });
});
