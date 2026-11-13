"use client";

import { useMemo } from "react";
import type { Arrangement, Song, SongId } from "@/engine/music/schema";
import { applyRhythm, type RhythmOverride } from "@/engine/music/rhythm";
import { parseSpecPitches } from "@/data/songs";
import { SONGS, SONGS_BY_ID } from "@/data/songs";
import { createLocalStore } from "./localStore";

/**
 * User data layered on top of the bundled songs, stored on this device:
 *  - imported full arrangements (MusicXML/MIDI)
 *  - rhythms the user set (per song, separately for the game sequence and the full arrangement)
 * The bundled data itself is never modified.
 */

export interface ImportedArrangement {
  arrangement: Arrangement;
  fileName: string;
  importedAt: number;
}

type ImportStore = Partial<Record<SongId, ImportedArrangement>>;
type RhythmStore = Partial<Record<SongId, RhythmOverride>>;

const imports = createLocalStore<ImportStore>("ocarina-academy:arrangements:v1", {});
export type RhythmMode = "game" | "full";
const rhythmStores = {
  game: createLocalStore<RhythmStore>("ocarina-academy:rhythms:v1", {}),
  full: createLocalStore<RhythmStore>("ocarina-academy:rhythms-full:v1", {}),
};

export const useImported = imports.use;
export const useRhythms = (mode: RhythmMode = "game") => rhythmStores[mode].use();

export function saveImported(songId: SongId, value: ImportedArrangement) {
  imports.write({ ...imports.read(), [songId]: value });
}

export function removeImported(songId: SongId) {
  const next = { ...imports.read() };
  delete next[songId];
  imports.write(next);
}

export function saveRhythm(songId: SongId, value: RhythmOverride, mode: RhythmMode = "game") {
  const store = rhythmStores[mode];
  store.write({ ...store.read(), [songId]: value });
}

export function removeRhythm(songId: SongId, mode: RhythmMode = "game") {
  const store = rhythmStores[mode];
  const next = { ...store.read() };
  delete next[songId];
  store.write(next);
}

export const USER_RHYTHM_NOTE = "Rhythm set by you on this device.";

/**
 * Notes a bundled phrase had before it was corrected. Rhythms saved before
 * lengths remembered their pitch are matched against these, so a correction
 * (e.g. inserting notes) keeps the user's lengths on the right notes.
 * Key: "<songId>:<game|full>:<phraseId>".
 */
const PHRASE_HISTORY: Record<string, string> = {
  "zeldas-lullaby:full:call": "E5 G5 D5 E5 G5 D5",
};

/**
 * Phrases split off from a repeated one: a rhythm saved before the split
 * starts the new phrase with the old phrase's lengths.
 * Key: "<songId>:<game|full>:<newPhraseId>" → old phrase id.
 */
const PHRASE_SPLITS: Record<string, string> = {
  "bolero-of-fire:full:return": "high",
};

/** Attach pitches to saved lengths that predate pitch tracking, where the phrase history allows. */
export function withHistory(songId: SongId, mode: RhythmMode, r: RhythmOverride): RhythmOverride {
  let phrases = r.phrases;
  for (const [key, from] of Object.entries(PHRASE_SPLITS)) {
    const [s, m, id] = key.split(":");
    if (s === songId && m === mode && !phrases[id] && phrases[from]) phrases = { ...phrases, [id]: phrases[from] };
  }
  for (const [id, list] of Object.entries(r.phrases)) {
    const old = PHRASE_HISTORY[`${songId}:${mode}:${id}`];
    if (!old || list.some((e) => e.pitch)) continue;
    const pitches = parseSpecPitches(old);
    if (pitches.length !== list.length) continue;
    phrases = { ...phrases, [id]: list.map((e, i) => ({ ...e, pitch: pitches[i] })) };
  }
  return phrases === r.phrases ? r : { ...r, phrases };
}

/**
 * Rhythm editing is switched off: every bundled arrangement now carries its
 * rhythm, and rhythms saved on a device are ignored so the bundled one plays.
 * Set to true to bring back "Set the rhythm" and saved rhythms.
 */
export const RHYTHM_EDITING = false;

function merge(song: Song, imp: ImportStore, rhStore: RhythmStore, rhFullStore: RhythmStore): Song {
  const rh = RHYTHM_EDITING ? rhStore : {};
  const rhFull = RHYTHM_EDITING ? rhFullStore : {};
  const imported = imp[song.id]?.arrangement;
  const rf = rhFull[song.id];
  // A user rhythm applies to the bundled full arrangement; an imported file brings its own rhythm.
  const full = imported ?? (rf ? applyRhythm(song.arrangements.full, withHistory(song.id, "full", rf), USER_RHYTHM_NOTE) : song.arrangements.full);
  const r = rh[song.id];
  const game = r ? applyRhythm(song.arrangements.game, withHistory(song.id, "game", r), USER_RHYTHM_NOTE) : song.arrangements.game;
  return full === song.arrangements.full && game === song.arrangements.game
    ? song
    : { ...song, arrangements: { game, full } };
}

/** Song with any user imports / rhythms applied. */
export function useSong(id: string): Song | undefined {
  const imp = useImported();
  const rh = useRhythms("game");
  const rhFull = useRhythms("full");
  return useMemo(() => {
    const s = SONGS_BY_ID.get(id as SongId);
    return s ? merge(s, imp, rh, rhFull) : undefined;
  }, [id, imp, rh, rhFull]);
}

export function useSongs(): Song[] {
  const imp = useImported();
  const rh = useRhythms("game");
  const rhFull = useRhythms("full");
  return useMemo(() => SONGS.map((s) => merge(s, imp, rh, rhFull)), [imp, rh, rhFull]);
}

/** The bundled song without user changes (editor's "reset" baseline). */
export const bundledSong = (id: string) => SONGS_BY_ID.get(id as SongId);
