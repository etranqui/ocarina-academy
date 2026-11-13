# Ocarina Academy

Learn the 12 songs of *Ocarina of Time* on a real 12-hole Alto C ocarina (the OoT replica).
Fan-made, not affiliated with Nintendo; all artwork is original.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for architecture, data models, risks and roadmap.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # engine unit tests (pitch, fingering, song data validation)
npm run build      # static export to out/ + offline service worker (out/sw.js)
npm run icons      # re-render app icons from scripts/make-icons.mjs
```

## Where things live

| What | File |
|---|---|
| Fingerings + hole geometry | `src/engine/fingering/profiles/oot-replica-alto-c.ts` |
| Ocarina shell artwork | `public/ocarina/replica-shell.svg` |
| Song data (game sequences + chart-based full arrangements) | `src/data/songs.ts` |
| Music schema / timeline (single source of truth) | `src/engine/music/` |
| Progress (LocalStorage) + dashboard | `src/lib/progress.ts`, `src/components/ProgressDashboard.tsx` |
| PWA manifest / service worker | `src/app/manifest.ts`, `scripts/build-sw.mjs` |

## Deploy (no server needed)

`npm run build` writes a fully static site to `out/`. Upload that folder to any static host
(GitHub Pages, Netlify, Cloudflare Pages). Use HTTPS — browsers only allow the microphone
on HTTPS or localhost. To try the built site locally:

```bash
npx serve out
```

## Install & offline

The app is a PWA. On a phone open the HTTPS site and use **Add to Home Screen** (iOS Safari: Share menu;
Android Chrome: Install app). After the first visit every page, song, fingering and the ocarina
voice work offline; progress and imported arrangements stay on the device. Deploying a new build
changes the service worker version, and the app shows *A new version is ready → Reload*. Service
workers only run on HTTPS or localhost, and only in production builds (not `npm run dev`).

Progress lives in this browser only: **Progress → Download backup / Restore backup** moves it
between devices.

## Importing full arrangements

Song page → **Full arrangement** → **Import a full arrangement**. Accepts uncompressed
MusicXML (`.musicxml`/`.xml`) and MIDI (`.mid`). The file is fitted to the Alto C range and
saved in this browser only.

## Rhythm

Every bundled full arrangement has a rhythm and tempo set by ear by the app's author (the tabs and charts give
pitches only). The in-app rhythm editor is switched off; set `RHYTHM_EDITING`
in `src/lib/arrangements.ts` to `true` to bring it back. Imported MusicXML/MIDI files keep their own rhythm.

## Practicing with the microphone

Song page → **Practice**. Turn on the microphone, run **Calibrate** once (stay quiet, then
hold an A), pick Beginner / Intermediate / Advanced and a phrase range. The microphone only
works on HTTPS or localhost. To test on a phone on your Wi-Fi, run the dev server over HTTPS:

```bash
npx next dev --experimental-https -H 0.0.0.0
```
