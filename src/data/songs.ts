import type { Arrangement, MusicEvent, Phrase, Song, SongId } from "@/engine/music/schema";

/*
 * Content policy
 * ──────────────
 * game     – the short in-game button sequence. Note order is well documented and
 *            was cross-checked against the user's reference image. On a 12-hole
 *            Alto C the game's five pitches (D F A B D') are played as
 *            D5 F5 A5 B5 D6.
 *            Rhythm: taken from Nintendo's official ocarina scores (Switch 2 remake
 *            site) and cross-checked note-by-note against the original game's playback
 *            timings (sOcarinaSongNotes, zeldaret/oot decompilation), which also give
 *            the tempo. A song keeps an even pulse unless both sources agree on every
 *            note before the final one (the game always holds its last note long).
 * full     – fuller melodies read from tabs and fingering charts the user supplied
 *            (below). Pitches only, so they stay "partial"; MusicXML/MIDI imports can replace them.
 */

const RHYTHM_SOURCES =
  "Rhythm from Nintendo's official ocarina score, cross-checked with the original game's playback timings.";

/** "B5:2 D6:1 R:0.5 A5" → events. Beats default to 1; "R" is a rest. */
const events = (spec: string): MusicEvent[] =>
  spec.trim().split(/\s+/).map((tok) => {
    const [p, b] = tok.split(":");
    const beats = b ? Number(b) : 1;
    return p === "R" ? { type: "rest", beats } : { type: "note", pitch: p, beats };
  });

const phrase = (id: string, label: string, spec: string): Phrase => ({ id, label, events: events(spec) });

/** Pitches of a phrase spec, ignoring lengths and rests. */
export const parseSpecPitches = (spec: string) =>
  events(spec).flatMap((e) => (e.type === "note" ? [e.pitch] : []));

interface GameOpts {
  form?: string[];
  /** Omit for an even pulse (rhythm not confirmed). */
  rhythm?: { bpm: number; time: [number, number]; note?: string };
  /** Why the rhythm is still an even pulse. */
  pulseNote?: string;
}

function game(phrases: Phrase[], opts: GameOpts = {}): Arrangement {
  const r = opts.rhythm;
  return {
    kind: "game-sequence",
    status: "verified",
    source: {
      kind: "game-reference",
      note: "In-game ocarina button sequence, transposed to the Alto C range.",
      rhythm: r ? "exact" : "uniform",
      rhythmNote: r ? (r.note ?? RHYTHM_SOURCES) : opts.pulseNote,
    },
    tempoBpm: r?.bpm ?? 96,
    beatUnit: 4,
    timeSignature: r?.time ?? [4, 4],
    phrases,
    form: opts.form,
  };
}

const NEEDS_TRANSCRIPTION: Arrangement = {
  kind: "full",
  status: "needs-transcription",
  source: {
    kind: "none",
    note: "No authorised full arrangement yet. Import a MusicXML or MIDI file you own to enable it.",
    rhythm: "unknown",
  },
  tempoBpm: 90,
  beatUnit: 4,
  timeSignature: [4, 4],
  phrases: [],
};

/*
 * Melodies from ocarinatabs.com (each page cross-checks fan MIDI sequences).
 * The tabs give letter names only, one octave below this app's notation, plus the
 * song's range and pitch count — octaves here are the only placement consistent
 * with both. No rhythm is given, so these play at an even pulse.
 */
const TAB_REF = "Melody from ocarinatabs.com (cross-checked fan MIDI sequences). Pitches only — no rhythm given, so every note gets one beat.";

function tabFull(phrases: Phrase[], missing: string, form?: string[]): Arrangement {
  return {
    kind: "full",
    status: "partial",
    source: { kind: "user-supplied", note: `${TAB_REF} ${missing}`, rhythm: "unknown" },
    tempoBpm: 120,
    beatUnit: 4,
    timeSignature: [4, 4],
    phrases,
    form,
  };
}

const CH = "Melody from the traxitabs fingering chart (its fingerings give the octave). Pitches only — no rhythm given, so every note gets one beat. ";
/** A melody read from one of the user's traxitabs charts. */
const chartFull = (phrases: Phrase[], opts: { form?: string[]; keyNote?: string; note?: string } = {}): Arrangement => ({
  ...tabFull(phrases, "", opts.form),
  source: { kind: "user-supplied", note: CH + (opts.note ?? ""), rhythm: "unknown" },
  keyNote: opts.keyNote,
});

/** Rhythm the app's author set by ear in the rhythm editor (not from a published score). */
const byEar = (arr: Arrangement, tempoBpm = arr.tempoBpm): Arrangement => ({
  ...arr,
  tempoBpm,
  source: {
    ...arr.source,
    note: arr.source.note.replace(" — no rhythm given, so every note gets one beat.", "; the source gives no rhythm."),
    rhythm: "exact",
    rhythmNote: "Rhythm set by ear by the app's author (not from a published score).",
  },
});

const TAB_FULL = {
  zelda: byEar(chartFull(
    [
      phrase("call", "Call", "E5:2 G5:1 D5:2 C5:0.5 D5:0.5 E5:2 G5:1 D5:2 R:0.5"),
      phrase("rise", "Rise", "E5:2 G5:1 D6:2 C6:1 G5:3"),
    ],
    {
      note: "C D after the first E G D added from your correction; it matches the opening phrase on ocarinatabs.com (B D A G A B D A in the game's key).",
      keyNote: "This arrangement is a fifth lower than the game sequence (B D A becomes E G D) so it fits a standard 12-hole Alto C ocarina: in the game's key the last phrase would need A6 and G6, above the instrument's top note (F6).",
    },
  )),
  sun: byEar(chartFull(
    [
      phrase("call", "Call", "E5:0.25 C5:0.25 A5:1.5 R:0.5 E5:0.25 C5:0.25 A5:1.5 R:0.5"),
      phrase("climb", "Climb", "G5:0.25 A5:0.25 B5:0.25 C6:0.25"),
      phrase("shine", "Shine", "D6:0.25 D6:0.25 D6:0.25 D6:0.25 D6:0.25 E6:0.25 D6:1.5"),
    ],
    { keyNote: "This arrangement is a fourth lower than the game sequence (A F D becomes E C A) so it fits a standard 12-hole Alto C ocarina: in the game's key the second half would need G6 and A6, above the instrument's top note (F6)." },
  )),
  prelude: byEar(chartFull(
    [
      phrase("call", "Call", "D6:0.5 A5:2 R:0.5"),
      phrase("answer", "Answer", "D6:0.5 A5:0.5 B5:0.5 D6:3 R:0.5"),
      phrase("close", "Close", "D5:3 R:0.5 D5:3 R:0.5 C#5:4"),
    ],
    { form: ["call", "answer", "call", "answer", "close"] },
  )),
  minuet: byEar(chartFull(
    [
      phrase("minuet", "Minuet", "D5:0.5 D6:0.5 B5:2 A5:0.5 B5:0.5 A5:2 R:0.5"),
      phrase("dance", "Dance", "F5:0.5 A5:0.5 G5:1 A5:1"),
      phrase("bow", "Bow", "G5:0.25 A5:0.25 G5:0.25 F#5:1 E5:2"),
    ],
    {
      form: ["minuet", "minuet", "dance", "bow"],
      note: "ocarinatabs.com starts the dance phrase on E instead of F — check it by ear.",
    },
  ), 100),
  bolero: byEar(chartFull(
    [
      phrase("low", "Low swing", "F5:0.25 D5:0.25 F5:0.25 D5:0.25"),
      phrase("high", "High swing", "A5:0.25 F5:0.25 A5:0.25 F5:1 R:0.5"),
      phrase("lift", "Lift", "G5:0.25 E5:0.25 G5:0.25 E5:0.25"),
      phrase("flare", "Flare", "A#5:0.25 G5:0.25 A#5:0.25 G5:1 R:0.5"),
      phrase("return", "High swing (return)", "A5:0.25 F5:0.25 A5:0.25 F5:0.25"),
      phrase("leap", "Leap", "D6:0.25 C6:0.25 D6:0.25 C6:0.25"),
      phrase("peak", "Peak", "F6:0.25 D6:0.25 F6:0.25 D6:0.25"),
      phrase("ember", "Ember", "A5:0.25 E5:0.25 A5:0.25 E5:0.25"),
      phrase("smoulder", "Smoulder", "G5:0.25 C#5:0.25 G5:0.25 C#5:0.25"),
      phrase("ash", "Ash", "F5:0.25 E5:0.25 D5:1"),
    ],
    { form: ["low", "high", "low", "high", "lift", "flare", "return", "leap", "peak", "ember", "smoulder", "ash"] },
  ), 60),
  serenade: byEar(chartFull(
    [
      phrase("serenade", "Serenade", "D5:1 F5:1 A5:1 A5:1 B5:2 R:0.5"),
      phrase("flow", "Flow", "A5:1 D5:1 F5:1"),
      phrase("ebb", "Ebb", "G5:0.5 F5:0.5 E5:1"),
      phrase("close", "Close", "G5:1 F#5:2"),
    ],
    { form: ["serenade", "serenade", "flow", "ebb", "close"] },
  ), 90),
  nocturne: byEar(chartFull(
    [
      phrase("theme", "Theme", "B5:1 A5:1 A5:0.5 D5:0.5 B5:0.5 A5:0.5 F5:3 R:0.5"),
      phrase("echo", "Echo", "G5:1 F5:1 F5:0.5 C5:0.5 G5:0.5 F5:0.5"),
      phrase("shadow", "Shadow", "G#5:1 F#5:1 F#5:0.5 C#5:0.5 G#5:0.5 F#5:0.5 F5:3"),
    ],
    {
      form: ["theme", "theme", "echo", "shadow"],
      note: "The chart draws G♯ twice with different right-thumb positions; the app follows your full fingering chart (both thumbs down).",
    },
  ), 100),
  requiem: byEar(chartFull([phrase("requiem", "Requiem", "D5:1 F5:0.5 D5:0.5 A5:1 F5:1 D5:2")], {
    note: "The chart gives the same six notes as the game sequence.",
  }), 80),
  epona: byEar(tabFull(
    [
      phrase("call", "Call", "D6:0.5 B5:0.5 A5:2 R:0.5 D6:0.5 B5:0.5 A5:2 R:0.5"),
      phrase("answer", "Answer", "D6:0.5 B5:0.5 A5:1 B5:1 A5:3 R:0.5"),
      phrase("close", "Close", "F#5:1 F5:1 F#5:1 C#6:0.75 D6:0.25 B5:3 R:0.5"),
      phrase("end", "Ending", "D6:2 D6:1 C#6:0.75 B5:0.25 A5:2"),
    ],
    "The closing phrase comes from ocarinatabs.com (octaves from its stated F–D range); the ending (D D C♯ B A) was added from your own correction. Confirmed note-for-note, octaves included, by the traxitabs fingering chart for the call and answer.",
  )),
  time: byEar(tabFull(
    [
      phrase("song", "Song", "A5:1 D5:2 F5:1 A5:1 D5:2 F5:1"),
      phrase("rise", "Rise", "A5:0.5 C6:0.5 B5:1 G5:1 F5:0.5 G5:0.5"),
      phrase("settle", "Settle", "A5:1 D5:1 C5:0.5 E5:0.5 D5:2"),
    ],
    "Covers the Temple of Time melody line in the tab. Confirmed note-for-note, octaves included, by the traxitabs fingering chart for the whole song.",
  )),
  storms: byEar(tabFull(
    [
      phrase("verse", "Verse", "D5:0.25 F5:0.25 D6:2 D5:0.25 F5:0.25 D6:2 E6:1 F6:0.25 E6:0.25 F6:0.25 E6:0.25 C6:0.25 A5:2"),
      phrase("turn", "Turn", "A5:0.5 D5:0.5 F5:0.25 G5:0.25 A5:2"),
      phrase("turn2", "Turn back", "A5:0.5 D5:0.5 F5:0.25 G5:0.25 E5:2"),
      phrase("end", "Ending", "A5:0.5 D5:0.5 F5:0.25 G5:0.25 A5:2 A5:0.5 D5:2"),
    ],
    "Covers the Windmill Hut melody line in the tab. Confirmed note-for-note, octaves included, by the traxitabs fingering chart for the verse.",
    ["verse", "turn", "turn2", "verse", "end"],
  )),
};

export const SONGS: Song[] = [
  {
    id: "zeldas-lullaby",
    title: "Zelda's Lullaby",
    order: 1,
    group: "melody",
    theme: { color: "#a99be6", deep: "#3c2f7a", emblem: "harp" },
    blurb: "A tender royal lullaby and the first song most heroes learn.",
    arrangements: {
      game: game([phrase("motif", "Motif", "B5:2 D6:1 A5:3")], { form: ["motif", "motif"], rhythm: { bpm: 140, time: [3, 4] } }),
      full: TAB_FULL.zelda,
    },
  },
  {
    id: "minuet-of-forest",
    title: "Minuet of Forest",
    order: 2,
    group: "warp",
    theme: { color: "#4fbf6b", deep: "#173f22", emblem: "leaf" },
    blurb: "A courtly dance that carries you back beneath the ancient trees.",
    arrangements: {
      game: game([phrase("minuet", "Minuet", "D5:0.5 D6:0.5 B5:2 A5:0.5 B5:0.5 A5:2")], { rhythm: { bpm: 100, time: [3, 4] } }),
      full: TAB_FULL.minuet,
    },
  },
  {
    id: "eponas-song",
    title: "Epona's Song",
    order: 3,
    group: "melody",
    theme: { color: "#d39a5c", deep: "#5a3416", emblem: "horseshoe" },
    blurb: "A ranch-hand's tune that every horse in the valley knows.",
    arrangements: {
      game: game([phrase("call", "Call", "D6:0.5 B5:0.5 A5:1.5 R:0.5")], { form: ["call", "call"], rhythm: { bpm: 100, time: [3, 4] } }),
      full: TAB_FULL.epona,
    },
  },
  {
    id: "bolero-of-fire",
    title: "Bolero of Fire",
    order: 4,
    group: "warp",
    theme: { color: "#e45a43", deep: "#5c1710", emblem: "flame" },
    blurb: "A smouldering, insistent rhythm born on the slopes of the volcano.",
    arrangements: {
      game: game([phrase("low", "Low swing", "F5:0.25 D5:0.25 F5:0.25 D5:0.25"), phrase("high", "High swing", "A5:0.25 F5:0.25 A5:0.25 F5:0.75 R:0.5")], { rhythm: { bpm: 60, time: [3, 4] } }),
      full: TAB_FULL.bolero,
    },
  },
  {
    id: "sarias-song",
    title: "Saria's Song",
    order: 5,
    group: "melody",
    theme: { color: "#8fd16a", deep: "#244a18", emblem: "leaf-flute" },
    blurb: "A bright, bouncing woodland melody shared between old friends.",
    arrangements: {
      game: game([phrase("motif", "Motif", "F5:0.5 A5:0.5 B5:1")], { form: ["motif", "motif"], rhythm: { bpm: 106, time: [2, 4] } }),
      full: {
        kind: "full",
        status: "partial",
        source: {
          kind: "user-supplied",
          note:
            "Lost Woods main theme (A section) from ocarinatabs.com, which cross-checks two VGMusic MIDIs and John Chambers' ABC. " +
            "The tab gives letter names only: octaves were inferred from its stated D–E range (shifted up one octave to this ocarina's range), " +
            "and the E in phrase 5 (B C E B G) is taken as the high E — check it by ear. The traxitabs fingering chart confirms phrases 1–2, octaves included. The bridge (B section) is not included.",
          rhythm: "exact",
          rhythmNote: "Rhythm set by ear by the app's author (not from a published score).",
        },
        tempoBpm: 120,
        beatUnit: 4,
        timeSignature: [4, 4],
        phrases: [
          phrase("a1", "Call", "F5:0.5 A5:0.5 B5:1 F5:0.5 A5:0.5 B5:1 F5:0.5 A5:0.5 B5:0.5"),
          phrase("a2", "Answer", "E6:0.5 D6:1 B5:0.5 C6:0.5 B5:0.5 G5:0.5 E5:3"),
          phrase("a3", "Tag", "D5:0.5 E5:0.5 G5:0.5 E5:3 R:0.5"),
          phrase("b1", "Call again", "F5:0.5 A5:0.5 B5:1 F5:0.5 A5:0.5 B5:1 F5:0.5 A5:0.5 B5:0.5"),
          phrase("b2", "Second answer", "E6:0.5 D6:1 B5:0.5 C6:0.5 E6:0.5 B5:0.5 G5:3"),
          phrase("b3", "Close", "B5:0.5 G5:0.5 D5:0.5 E5:3 R:0.5"),
        ],
      },
    },
  },
  {
    id: "serenade-of-water",
    title: "Serenade of Water",
    order: 6,
    group: "warp",
    theme: { color: "#4f95ea", deep: "#0f2f63", emblem: "wave" },
    blurb: "A rippling serenade that flows like water over a still lake.",
    arrangements: {
      game: game([phrase("serenade", "Serenade", "D5 F5 A5 A5 B5:2")], { rhythm: { bpm: 100, time: [3, 4] } }),
      full: TAB_FULL.serenade,
    },
  },
  {
    id: "suns-song",
    title: "Sun's Song",
    order: 7,
    group: "melody",
    theme: { color: "#f3c845", deep: "#6b4a07", emblem: "sun" },
    blurb: "A rising fanfare that hurries the dawn over the fields.",
    arrangements: {
      game: game([phrase("rise", "Rise", "A5 F5 D6")], {
        form: ["rise", "rise"],
        pulseNote:
          "Even pulse: the official score and the game agree on the two quick notes but not on the pause before the repeat, so it is left for you to set.",
      }),
      full: TAB_FULL.sun,
    },
  },
  {
    id: "requiem-of-spirit",
    title: "Requiem of Spirit",
    order: 8,
    group: "warp",
    theme: { color: "#e3913d", deep: "#5e300c", emblem: "dune" },
    blurb: "A solemn desert requiem echoing between colossal stone.",
    arrangements: {
      game: game([phrase("requiem", "Requiem", "D5 F5:0.5 D5:0.5 A5 F5 D5:3 R:1")], { rhythm: { bpm: 80, time: [4, 4] } }),
      full: TAB_FULL.requiem,
    },
  },
  {
    id: "song-of-time",
    title: "Song of Time",
    order: 9,
    group: "melody",
    theme: { color: "#8fc3d8", deep: "#1c4656", emblem: "hourglass" },
    blurb: "A stately, timeless theme that resonates within sacred halls.",
    arrangements: {
      game: game([phrase("motif", "Motif", "A5:1 D5:2 F5:1")], { form: ["motif", "motif"], rhythm: { bpm: 110, time: [4, 4] } }),
      full: TAB_FULL.time,
    },
  },
  {
    id: "nocturne-of-shadow",
    title: "Nocturne of Shadow",
    order: 10,
    group: "warp",
    theme: { color: "#a873e0", deep: "#33145a", emblem: "moon" },
    blurb: "A haunting night piece that lingers where the light cannot reach.",
    arrangements: {
      game: game([phrase("dusk", "Dusk", "B5 A5 A5:0.5 D5:0.5"), phrase("night", "Night", "B5:0.5 A5:0.5 F5:3 R:1")], { rhythm: { bpm: 100, time: [4, 4] } }),
      full: TAB_FULL.nocturne,
    },
  },
  {
    id: "song-of-storms",
    title: "Song of Storms",
    order: 11,
    group: "melody",
    theme: { color: "#93a3c4", deep: "#26304a", emblem: "storm" },
    blurb: "A whirling waltz said to call the rain from a clear sky.",
    arrangements: {
      game: game([phrase("gust", "Gust", "D5:0.5 F5:0.5 D6:2")], { form: ["gust", "gust"], rhythm: { bpm: 164, time: [3, 4] } }),
      full: TAB_FULL.storms,
    },
  },
  {
    id: "prelude-of-light",
    title: "Prelude of Light",
    order: 12,
    group: "warp",
    theme: { color: "#efe07a", deep: "#5d5212", emblem: "rays" },
    blurb: "A radiant prelude that lifts you toward the temple's light.",
    arrangements: {
      game: game([phrase("call", "Call", "D6:0.5 A5:1.5 D6:0.5 A5:0.5"), phrase("answer", "Answer", "B5:0.5 D6:3.5 R:1")], { rhythm: { bpm: 120, time: [4, 4] } }),
      full: TAB_FULL.prelude,
    },
  },
];

export const SONGS_BY_ID = new Map<SongId, Song>(SONGS.map((s) => [s.id, s]));

export function getSong(id: string): Song | undefined {
  return SONGS_BY_ID.get(id as SongId);
}
