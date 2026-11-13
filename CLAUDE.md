# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Ocarina Academy: a fan-made PWA for learning the 12 *Ocarina of Time* songs on a **real 12-hole Alto C ocarina** (the OoT replica — the only target instrument). Fully static, no server. Deeper design notes, risks and roadmap: `docs/ARCHITECTURE.md`.

## Commands

```bash
npm run dev                      # http://localhost:3000 (service worker NOT registered in dev)
npm run lint                     # type-check only (tsc --noEmit) — there is no ESLint
npm test                         # vitest run
npx vitest run src/engine/engine.test.ts            # one file
npx vitest run -t "fully playable"                  # tests matching a name
npm run build                    # next build (static export → out/) + node scripts/build-sw.mjs (writes out/sw.js)
npx serve out                    # serve the built site (needed to exercise the service worker)
npm run icons                    # re-render public/icons/* and src/app/icon.svg from scripts/make-icons.mjs
npx next dev --experimental-https -H 0.0.0.0   # test the mic on a phone (mic needs HTTPS or localhost)
```

Stack: Next.js 16 App Router with `output: "export"` + `trailingSlash: true`, React 19, TypeScript, Tailwind v4 (theme tokens in `src/app/globals.css` `@theme`), Vitest. Path alias `@/*` → `src/*`. Every dynamic route needs `generateStaticParams` (static export).

## Architecture

**Single source of truth for music.** `src/data/songs.ts` defines `Song → arrangements.{game, full} → Phrase → events` (schema in `src/engine/music/schema.ts`). Everything downstream — fingering view, score, audio playback, mic practice, progress — consumes `buildTimeline(arrangement)` (`src/engine/music/timeline.ts`), which flattens phrases + `form` repeats into notes/rests/sections. Never derive note lists another way.

- `game` = the short in-game button sequence, always faithful to the game's key. In-game D F A B D' are played as D5 F5 A5 B5 D6.
- `full` = longer melodies read from tabs/charts the user supplied (`tabFull` / `chartFull` helpers in `songs.ts`). Status `"partial"`; the sources give pitches only, so every full arrangement's rhythm and tempo were set by ear by the author (`byEar(...)`, `rhythmNote` says so). The in-app `RhythmEditor` is switched off by `RHYTHM_EDITING = false` in `src/lib/arrangements.ts`, which also makes saved device rhythms ignored. If a chart had to be in a different key to fit the instrument (Zelda's Lullaby, Sun's Song), set `keyNote` — `SongView` shows it as a "Different key" banner.
- User imports (MusicXML/MIDI via `src/engine/import/`) and user rhythm edits are stored in LocalStorage and merged over bundled songs by `useSongs`/`useSong` in `src/lib/arrangements.ts`.

**Fingering engine.** `src/engine/fingering/profiles/oot-replica-alto-c.ts` holds hole geometry (in the coordinate space of `public/ocarina/replica-shell.svg`, 1120×600, player's view) and one fingering per pitch A4–F6, each tagged with `evidence` (`user-chart` | `full-chart` | `standard`). `OcarinaDiagram` draws the static shell image with an SVG hole overlay. Pitch notation is scientific, **sounding** pitch, sharps only (`A#5`, not `Bb5`); the user's charts are written an octave lower (chart A3 = app A4), and the score renders treble clef with an 8 above.

**Audio** (`src/engine/audio/`): custom Web Audio synth (no Tone.js). One shared `AudioContext` (`getAudioContext`) and synth (`getSynth`) for playback, previews and the mic — don't suspend the context while the mic may be in use. `Transport` is a look-ahead scheduler on the audio clock; UI follows `transport.position()` in a rAF loop.

**Practice** (`src/engine/pitch/`, `src/engine/practice/session.ts`): mic → YIN pitch detection → `classify` (cents vs target, tuning offset from calibration) → `PracticeSession` state machine (beginner/intermediate/advanced chunking, hold times, re-articulation for repeated notes). Results go to `recordPractice` in `src/lib/progress.ts`.

**Persistence:** small LocalStorage stores read via `useSyncExternalStore` (`src/lib/localStore.ts`, `progress.ts`, `practiceSettings.ts`). Progress phrase keys are `"<game|full>:<phraseId>"`; `sessions` log drives the streak/activity chart on `/progress`.

**Hosting:** GitHub Pages via `.github/workflows/pages.yml` on push to `main`, built with `BASE_PATH=/<repo>`. Any raw root-relative URL (img src, SVG `<image href>`, service worker, manifest) must go through `asset()` in `src/lib/basePath.ts`, or it breaks under the sub-path. Absolute URLs (share previews in `layout.tsx`, `sitemap.ts`, `robots.ts`) use `absolute()`, with the origin from `SITE_URL` (default `https://etranqui.github.io`). The share image `public/og.png` and the README screenshots in `docs/screenshots/` are captures of the real app; retake them after visible UI changes.

**PWA:** `src/app/manifest.ts`; `scripts/build-sw.mjs` precaches every file in `out/` (pages keyed by folder URL, RSC `.txt` payloads matched with `ignoreSearch`), versioned by content hash. `src/components/ServiceWorker.tsx` registers it in production only.

## Content rules (enforced by tests in `src/engine/*.test.ts`)

`status` and `source` stay in the data, but the UI shows neither: no Verified/Partial badges, no per-song source or rhythm notes, no fingering-evidence tags. Acknowledgements live only on `/credits` (`src/app/credits/page.tsx`, linked from the footer). The `keyNote` "Different key" banner is still shown.


- Never fabricate transcriptions or fingerings. Every note must come from a cited source (game data, user-supplied charts/tabs, or an imported file) and the source goes in `arrangement.source.note`; flag inferences ("check by ear") there.
- Every note in every song must have a fingering (`validateSong`), and no bundled full arrangement may be `"verified"` — only the user can confirm one.
- Game-sequence rhythms are marked `exact` only where Nintendo's official score and the decompiled game timings agree; otherwise an even pulse with `pulseNote` explaining why.
- Original artwork only; not affiliated with Nintendo.
