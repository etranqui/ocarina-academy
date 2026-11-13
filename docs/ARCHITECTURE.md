# Zelda Ocarina Academy — Architecture & Plan

A personal, fan-made learning companion for playing the 12 songs of *Ocarina of Time*
on a physical 12-hole Alto C ocarina. Not affiliated with Nintendo. No Nintendo
artwork, models or audio are used; all art is original SVG. The Triforce on the replica collar is a
Nintendo trademark, fine for personal use but worth revisiting before any public release.

---

## 1. Requirements analysis

| Area | What matters most | Consequence for design |
|---|---|---|
| Single source of truth | Audio, score, fingering, practice and validation must never disagree | One `Song → Arrangement → Phrase → Event` model, flattened once into a **timeline**; every feature consumes the timeline |
| Honest content | No fabricated transcriptions, no placeholder posing as a full song | Every arrangement carries `status` + `source`; UI badges are derived from `status`, never hand-written |
| Fingering accuracy | Fingerings must be verified, not guessed | One target instrument (OoT replica, 12-hole Alto C), kept as a data profile; each fingering records its evidence; unverified notes are simply absent |
| Practice with a mic | Pitch detection in noisy, real rooms on phones | Isolated pitch engine (YIN), configurable tolerance in cents, calibration offset per instrument |
| Standalone, cross-device | No server; iPhone/iPad Safari, Android Chrome, desktop | Static export (`output: "export"`) to `/out`, hostable on any HTTPS static host; all logic runs in the browser; HTTPS required for `getUserMedia` |

## 2. Architecture

```
src/
  engine/                 ← framework-free TypeScript, unit-tested
    music/
      pitch.ts            note name ⇄ MIDI ⇄ Hz ⇄ cents
      schema.ts           Song / Arrangement / Phrase / Event types
      timeline.ts         flattens an arrangement → TimelineNote[] (the single source of truth)
      analysis.ts         derived metadata (difficulty, duration, range) — computed, never typed in
      validate.ts         checks every note is playable on a fingering profile
    fingering/
      types.ts            HoleId, HoleDef, Fingering, FingeringProfile
      profiles/oot-replica-alto-c.ts   the target instrument: hole geometry + fingerings + evidence
      engine.ts           lookup(pitch, profile), transitions between fingerings
    audio/       Web Audio ocarina synth (synth.ts), look-ahead transport (transport.ts), pure timing (schedule.ts)
    pitch/       YIN detector (yin.ts), note classifier (classify.ts), mic input (mic.ts)
    practice/    practice session state machine: chunks, hold detection, re-articulation, scoring
    import/      MusicXML + MIDI readers → range fit + phrasing (fit.ts) → Arrangement
  data/songs/             the 12 songs (metadata + arrangements)
  lib/progress/           local persistence (LocalStorage now, IndexedDB-ready interface)
  components/             React UI (OcarinaDiagram SVG, SongEmblem, cards, shell)
  app/                    Next.js routes: /, /library, /songs/[id], /fingerings
```

The engine has **no React imports**, so audio, pitch and fingering logic stay independent
of the UI and are tested with Vitest.

### Data flow
```
Song.arrangements[mode]
   └─ buildTimeline()  ──►  TimelineNote[] { index, pitch, midi, hz, startBeat, beats, phraseId }
                               ├─► fingering lookup  → OcarinaDiagram
                               ├─► score renderer    (Sprint 2)
                               ├─► Web Audio transport (look-ahead scheduler)
                               └─► practice/validator (Sprint 3) compares mic Hz ↔ note.hz
```

## 3. Fingering data model (OoT replica, 12-hole Alto C)

**Scope:** the app targets one instrument — the *Ocarina of Time* replica, 12-hole Alto C.
No multi-maker support. The profile is still data (not hard-coded in components), so a
missing fingering is a one-line addition.

**Visual approach:** a static illustrated shell (`public/ocarina/replica-shell.svg`, original
artwork modelled on the replica) with an SVG overlay drawn in the same 1120×600 coordinate
space. Hole centres and radii live in the profile, measured from the replica product photo
(rotated 180° into the player's view) and consistent with the Saria's Song chart. To use a
photo of your own instrument, put it in `public/ocarina/`, point `shell.href` at it and
adjust the hole `x/y/r` values.

Player's view: mouthpiece toward you, wide end (left hand) on the left.

Hole IDs: `L1–L4` (left index→pinky), `LS` (left sub-hole), `LT` (left thumb),
`R1–R4` (right index→pinky), `RS` (right sub-hole), `RT` (right thumb).

A fingering = the set of **covered** holes plus evidence:

```ts
{ pitch: "A5", covered: ["L1","L3","L4","LT","RT"], evidence: "user-chart" }
```

Range of an Alto C: A4 (all 12 covered) → F6 (all open), sounding pitch; C5 ≈ 523 Hz.
The in-game songs use D, F, A, B and high D; on an Alto C they sit at **D5 F5 A5 B5 D6**.

| Pitch | Covered holes | Evidence |
|---|---|---|
| C5 | all 10 main holes (sub-holes open) | standard progression |
| D5 | all main except R4 | standard progression (same R4→R1 order the chart shows for E5/F5) |
| E5 | all main except R3, R4 | **user chart** (Saria's Song, final note) |
| F5 | all main except R2–R4 | **user chart** |
| G5 | L1–L4 + LT + RT | **user chart** |
| A5 | L1, L3, L4 + LT + RT | **user chart** |
| B5 | L1, L4 + LT + RT | **user chart** |
| C6 | L1 + LT + RT | **user chart** |
| D6 | L1 + RT | **user chart** |
| E6 | L1 | **user chart** |
| F6 | none | standard (all open) |

**Not yet defined:** A4, B4 (sub-hole notes) and all sharps/flats. Sub-hole and
cross-fingering conventions vary by maker, and I could not verify them from a supplied
source, so they are left out rather than guessed. The `/fingerings` page lists them as
"Not defined". Adding them is a one-line data change in
`src/engine/fingering/profiles/oot-replica-alto-c.ts` once taken from the replica's fingering card. None of the 12 game sequences need them.

## 4. Music-data schema

```ts
Song        { id, title, order, theme, blurb, arrangements: { game, full } }
Arrangement { kind: "game-sequence" | "full", status, source, tempoBpm, beatUnit,
              timeSignature, phrases: Phrase[], form?: PhraseId[] }
Phrase      { id, label, events: (NoteEvent | RestEvent)[] }
NoteEvent   { type: "note", pitch: "F5", beats: 1, tie?: boolean }
RestEvent   { type: "rest", beats: 1 }
status      "verified" | "partial" | "needs-transcription"
source      { kind: "game-reference" | "user-supplied" | "musicxml" | "midi", note, rhythm }
```

- `form` lets a song repeat phrases (e.g. `["A","A","B","A"]`) without duplicating data.
- Rhythm honesty: game-sequence rhythms come from Nintendo’s official ocarina scores, cross-checked
  note by note with the original game’s playback timings (`sOcarinaSongNotes`, zeldaret/oot), which also
  give the tempo. 11 songs agree; Sun’s Song keeps an even pulse (`rhythm = "uniform"`) with the reason
  shown. Users can set or override any rhythm in the editor (saved locally, labelled as theirs).
- `full` is `null` or `needs-transcription` until a user-supplied MusicXML/MIDI is imported.

### Current content status
| | Game sequence | Full arrangement |
|---|---|---|
| All 12 songs | ✔ verified note order; rhythm confirmed for 11 (Sun’s Song: even pulse) | ✘ needs transcription |
| Saria's Song | ✔ | ◐ **partial** — 4 phrases from your chart, pitches only, rhythm unknown |

## 5. Dependencies & risks

| Risk | Mitigation |
|---|---|
| **No licensed full arrangements available** (Koji Kondo compositions are copyrighted) | Import pipeline for your own MusicXML/MIDI files (Sprint 2); everything else works on game sequences; status badges prevent overclaiming |
| Replica's sub-hole and sharp fingerings unknown | Omitted until taken from the replica's own fingering card |
| iOS Safari audio unlock & mic | Start `AudioContext` only on user gesture; HTTPS dev server for device testing |
| Pitch detection with breath noise | YIN with RMS gate, median smoothing over ~80 ms, tolerance in cents, calibration offset |
| Ocarina octave errors in detection | Ocarina is near-sinusoidal (weak harmonics) which helps YIN; also compare pitch class + octave separately and report "octave off" |
| Audio sync and bundle size | Custom Web Audio synth instead of Tone.js: no dependency, notes scheduled on the AudioContext clock, UI reads the same clock minus output latency |

## 6. Roadmap

- **Sprint 1 — Foundation** (this sprint): shell, design system, home, library, song page,
  fingering engine + SVG diagram, music schema + 12 songs, local progress store, tests.
- **Sprint 2 — Music (done):** Web Audio ocarina synth, transport from timeline, tempo 50/75/100 %,
  loop song/phrase, metronome, score view, MusicXML + MIDI import.
- **Sprint 3 — Learning (done):** mic + YIN, calibration, note/phrase practice with
  correct / wrong / sharp / flat / silent feedback, beginner/intermediate/advanced modes.
- **Sprint 4 — Polish (done):** progress dashboard (stats, 28-day activity, streak, per-song and
  per-phrase progress, "focus next", backup/restore); PWA manifest + icons; generated precaching
  service worker (cache-first, versioned by content hash, update notice); phone layout fixes
  (score reflows to the screen width); audio: per-voice node cleanup, de-clicked stop, playback
  pauses when the tab is hidden.
