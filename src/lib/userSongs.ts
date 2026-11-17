"use client";

import type { Arrangement, SongTheme, UserSongId } from "@/engine/music/schema";
import { createLocalStore } from "./localStore";
import { forgetSong } from "./progress";

/**
 * "Your songs": songs the user adds from their own MIDI files, and the
 * collections (playlists) they sort them into. Kept on this device, in a
 * store of its own: the bundled songs in src/data never mix with these, and
 * collections only ever hold user songs.
 */

export interface UserSong {
  id: UserSongId;
  title: string;
  /** The single arrangement fitted from the file (kind "full"). */
  arrangement: Arrangement;
  fileName: string;
  trackName: string;
  theme: SongTheme;
  createdAt: number;
  updatedAt: number;
}

export interface Collection {
  id: string;
  name: string;
  /** Ordered: the playlist order. */
  songIds: UserSongId[];
  createdAt: number;
}

export interface UserLibrary {
  version: 1;
  songs: Partial<Record<UserSongId, UserSong>>;
  collections: Collection[];
}

const EMPTY: UserLibrary = { version: 1, songs: {}, collections: [] };
const store = createLocalStore<UserLibrary>("ocarina-academy:user-songs:v1", EMPTY);

export const useUserLibrary = store.use;
export const readUserLibrary = store.read;

/** Pairs of accent / deep colours for user songs (picked in turn). */
export const USER_PALETTE: [string, string][] = [
  ["#7fb6e8", "#1d3a5c"],
  ["#e8a87f", "#5c321d"],
  ["#a99be8", "#2f255c"],
  ["#7fe0b9", "#1d5c45"],
  ["#e87fa6", "#5c1d34"],
  ["#e8d27f", "#5c4b1d"],
  ["#9fd47a", "#2e5c1d"],
  ["#7fd8e0", "#1d525c"],
];

const newId = (prefix: string) =>
  `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function nextTheme(lib: UserLibrary = store.read()): SongTheme {
  const [color, deep] = USER_PALETTE[Object.keys(lib.songs).length % USER_PALETTE.length];
  return { color, deep, emblem: "note" };
}

export function sortedSongs(lib: UserLibrary): UserSong[] {
  return (Object.values(lib.songs).filter(Boolean) as UserSong[]).sort((a, b) => b.createdAt - a.createdAt);
}

/** Songs of a collection in playlist order (skips ids whose song was deleted). */
export function collectionSongs(lib: UserLibrary, collectionId: string): UserSong[] {
  const c = lib.collections.find((x) => x.id === collectionId);
  return c ? (c.songIds.map((id) => lib.songs[id]).filter(Boolean) as UserSong[]) : [];
}

export function addUserSong(input: Omit<UserSong, "id" | "createdAt" | "updatedAt" | "theme">, collectionId?: string): UserSongId {
  const lib = store.read();
  const now = Date.now();
  const id = newId("u-") as UserSongId;
  const song: UserSong = { ...input, id, theme: nextTheme(lib), createdAt: now, updatedAt: now };
  store.write({
    ...lib,
    songs: { ...lib.songs, [id]: song },
    collections: lib.collections.map((c) => (c.id === collectionId ? { ...c, songIds: [...c.songIds, id] } : c)),
  });
  return id;
}

export function renameUserSong(id: UserSongId, title: string) {
  const lib = store.read();
  const song = lib.songs[id];
  if (!song || !title.trim()) return;
  store.write({ ...lib, songs: { ...lib.songs, [id]: { ...song, title: title.trim(), updatedAt: Date.now() } } });
}

/** Deletes the song, takes it out of every collection and drops its progress. */
export function deleteUserSong(id: UserSongId) {
  const lib = store.read();
  const songs = { ...lib.songs };
  delete songs[id];
  store.write({ ...lib, songs, collections: lib.collections.map((c) => ({ ...c, songIds: c.songIds.filter((s) => s !== id) })) });
  forgetSong(id);
}

export function createCollection(name: string): string {
  const lib = store.read();
  const id = newId("c-");
  store.write({ ...lib, collections: [...lib.collections, { id, name: name.trim() || "New collection", songIds: [], createdAt: Date.now() }] });
  return id;
}

export function renameCollection(id: string, name: string) {
  if (!name.trim()) return;
  const lib = store.read();
  store.write({ ...lib, collections: lib.collections.map((c) => (c.id === id ? { ...c, name: name.trim() } : c)) });
}

/** Deletes the collection only; its songs stay in "All your songs". */
export function deleteCollection(id: string) {
  const lib = store.read();
  store.write({ ...lib, collections: lib.collections.filter((c) => c.id !== id) });
}

export function setInCollection(collectionId: string, songId: UserSongId, inside: boolean) {
  const lib = store.read();
  store.write({
    ...lib,
    collections: lib.collections.map((c) => {
      if (c.id !== collectionId) return c;
      const has = c.songIds.includes(songId);
      if (inside === has) return c;
      return { ...c, songIds: inside ? [...c.songIds, songId] : c.songIds.filter((s) => s !== songId) };
    }),
  });
}

/** Moves a song one place up (-1) or down (+1) in a collection. */
export function moveInCollection(collectionId: string, songId: UserSongId, dir: -1 | 1) {
  const lib = store.read();
  store.write({
    ...lib,
    collections: lib.collections.map((c) => {
      if (c.id !== collectionId) return c;
      const i = c.songIds.indexOf(songId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= c.songIds.length) return c;
      const ids = [...c.songIds];
      [ids[i], ids[j]] = [ids[j], ids[i]];
      return { ...c, songIds: ids };
    }),
  });
}

/** Checks a value is a user library (for restoring backups). */
export function isUserLibrary(v: unknown): v is UserLibrary {
  const x = v as UserLibrary;
  return !!x && x.version === 1 && typeof x.songs === "object" && x.songs !== null && Array.isArray(x.collections);
}

export function replaceUserLibrary(lib: UserLibrary) {
  store.write({ version: 1, songs: lib.songs, collections: lib.collections });
}

// URLs. One static page per view; the song is picked by the query string.
export const userSongHref = (id: UserSongId, tab: "overview" | "listen" | "practice" = "overview", collectionId?: string) => {
  const q = new URLSearchParams({ id });
  if (tab !== "overview") q.set("tab", tab);
  if (collectionId) q.set("c", collectionId);
  return `/library/yours/song/?${q}`;
};
export const yourSongsHref = (collectionId?: string) => (collectionId ? `/library/yours/?c=${collectionId}` : "/library/yours/");
