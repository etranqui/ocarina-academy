"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { UserSongId } from "@/engine/music/schema";
import { analyze, formatDuration } from "@/engine/music/analysis";
import { useProgress, type SongProgress } from "@/lib/progress";
import {
  collectionSongs,
  createCollection,
  deleteCollection,
  deleteUserSong,
  moveInCollection,
  renameCollection,
  renameUserSong,
  setInCollection,
  sortedSongs,
  userSongHref,
  useUserLibrary,
  yourSongsHref,
  type Collection,
  type UserLibrary,
  type UserSong,
} from "@/lib/userSongs";
import { SongEmblem } from "./SongEmblem";

const btn = "border border-gold-300/50 px-3 py-1.5 font-display text-[11px] tracking-widest text-gold-200 transition hover:bg-gold-300/10";
const primary = "bg-gradient-to-b from-gold-300 to-gold-500 px-5 py-2 font-display text-xs tracking-widest text-forest-950 hover:brightness-110";
const field = "border border-gold-500/30 bg-forest-900 px-2 py-1.5 text-sm text-parchment-50";

/** Song Library → Your songs: songs from your MIDI files, sorted into collections. */
export function YourSongs() {
  const lib = useUserLibrary();
  const progress = useProgress();
  const router = useRouter();
  const cid = useSearchParams().get("c");
  const collection = lib.collections.find((c) => c.id === cid);
  const all = sortedSongs(lib);
  const songs = collection ? collectionSongs(lib, collection.id) : all;
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState(false);

  const addCollection = () => {
    const id = createCollection(name);
    setName("");
    setAdding(false);
    router.push(yourSongsHref(id));
  };

  if (!all.length && !lib.collections.length) {
    return (
      <section className="panel mx-auto max-w-2xl p-8 text-center">
        <h2 className="font-display text-2xl text-parchment-50">Bring your own song</h2>
        <p className="mx-auto mt-3 max-w-lg font-serif text-parchment-200/75">
          Add a MIDI file and learn it here like the Ocarina of Time songs: fingerings, play-along and practice with your
          microphone. Sort your songs into collections to make playlists.
        </p>
        <Link href="/library/yours/new/" className={`mt-6 inline-block ${primary}`}>
          Add a song
        </Link>
        <p className="mt-4 text-xs text-parchment-300/55">Your songs are saved on this device only. Include them in a backup from the Progress page.</p>
      </section>
    );
  }

  const chip = (active: boolean) =>
    `shrink-0 whitespace-nowrap border px-3 py-1.5 text-left text-sm transition md:w-full md:border-0 md:border-l-2 ${
      active ? "border-gold-300 bg-gold-300/10 text-gold-200" : "border-gold-500/25 text-parchment-200/75 hover:text-parchment-50 md:border-transparent"
    }`;

  return (
    <div className="grid gap-6 md:grid-cols-[210px_minmax(0,1fr)]">
      <nav aria-label="Collections" className="min-w-0">
        <p className="mb-2 hidden text-[11px] uppercase tracking-[0.18em] text-parchment-300/60 md:block">Collections</p>
        <ul className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] md:flex-col md:gap-0.5 md:overflow-visible">
          <li>
            <Link href={yourSongsHref()} aria-current={!collection ? "page" : undefined} className={chip(!collection)}>
              All your songs <span className="text-parchment-300/55">· {all.length}</span>
            </Link>
          </li>
          {lib.collections.map((c) => (
            <li key={c.id}>
              <Link href={yourSongsHref(c.id)} aria-current={collection?.id === c.id ? "page" : undefined} className={chip(collection?.id === c.id)}>
                {c.name} <span className="text-parchment-300/55">· {collectionSongs(lib, c.id).length}</span>
              </Link>
            </li>
          ))}
          <li>
            {adding ? (
              <form
                className="flex gap-1 md:mt-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  addCollection();
                }}
              >
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Collection name" maxLength={60} aria-label="Collection name" className={`${field} w-36 md:w-full`} />
                <button type="submit" className={btn}>Add</button>
              </form>
            ) : (
              <button onClick={() => setAdding(true)} className="shrink-0 whitespace-nowrap px-3 py-1.5 text-sm text-gold-300 hover:text-gold-200 md:mt-2">
                + New collection
              </button>
            )}
          </li>
        </ul>
      </nav>

      <section className="min-w-0">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          {collection && renaming ? (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                renameCollection(collection.id, new FormData(e.currentTarget).get("name") as string);
                setRenaming(false);
              }}
            >
              <input name="name" autoFocus defaultValue={collection.name} maxLength={60} aria-label="Collection name" className={field} />
              <button type="submit" className={btn}>Save</button>
              <button type="button" onClick={() => setRenaming(false)} className="px-2 text-sm text-parchment-300/70">Cancel</button>
            </form>
          ) : (
            <h2 className="font-display text-2xl text-parchment-50">
              {collection ? collection.name : "All your songs"} <span className="text-base text-parchment-300/55">· {songs.length}</span>
            </h2>
          )}
          {collection && !renaming && (
            <div className="flex gap-3 text-xs">
              <button onClick={() => setRenaming(true)} className="text-gold-300 underline hover:text-gold-200">Rename</button>
              <button
                onClick={() => {
                  if (confirm(`Delete the collection "${collection.name}"? Its songs stay in All your songs.`)) {
                    deleteCollection(collection.id);
                    router.push(yourSongsHref());
                  }
                }}
                className="text-red-300/80 underline hover:text-red-300"
              >
                Delete collection
              </button>
            </div>
          )}
          <Link href={collection ? `/library/yours/new/?c=${collection.id}` : "/library/yours/new/"} className={`ml-auto ${primary}`}>
            + Add a song
          </Link>
        </div>

        {songs.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {songs.map((s, i) => (
              <li key={s.id}>
                <UserSongCard
                  song={s}
                  lib={lib}
                  progress={progress.songs[s.id]}
                  collection={collection}
                  position={collection ? { index: i, count: songs.length } : undefined}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="panel p-6 text-sm text-parchment-200/75">
            {collection
              ? "This collection is empty. Add songs to it from a song's ⋯ menu in All your songs, or add a new song."
              : "You haven't added a song yet."}
          </p>
        )}
      </section>
    </div>
  );
}

function UserSongCard({
  song,
  lib,
  progress,
  collection,
  position,
}: {
  song: UserSong;
  lib: UserLibrary;
  progress?: SongProgress;
  collection?: Collection;
  position?: { index: number; count: number };
}) {
  const [menu, setMenu] = useState(false);
  const stats = analyze(song.arrangement);
  const acc = progress?.notesAttempted ? Math.round((progress.notesCorrect / progress.notesAttempted) * 100) : null;
  const href = userSongHref(song.id, "overview", collection?.id);
  const id = song.id as UserSongId;

  return (
    <div className="panel flex h-full flex-col gap-4 p-5" style={{ ["--song" as string]: song.theme.color }}>
      <div className="flex items-start gap-4">
        <Link href={href} tabIndex={-1} aria-hidden className="shrink-0">
          <SongEmblem theme={song.theme} size={60} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={href} className="block font-display text-xl leading-tight text-parchment-50 hover:text-gold-200">
            <span className="break-words">{song.title}</span>
          </Link>
          <p className="mt-1 truncate text-xs text-parchment-300/60">{song.fileName}</p>
        </div>
        <button
          onClick={() => setMenu((m) => !m)}
          aria-expanded={menu}
          aria-label={`Options for ${song.title}`}
          className="shrink-0 px-2 text-lg leading-none text-parchment-200/70 hover:text-gold-200"
        >
          ⋯
        </button>
      </div>

      {menu ? (
        <SongMenu song={song} lib={lib} collection={collection} onDone={() => setMenu(false)} />
      ) : (
        <dl className="grid grid-cols-3 gap-2 text-center text-xs">
          {[
            ["Difficulty", stats?.difficulty ?? "—"],
            ["Length", stats ? formatDuration(stats.durationSec) : "—"],
            ["Accuracy", acc === null ? "—" : `${acc}%`],
          ].map(([k, v]) => (
            <div key={k} className="border border-gold-500/15 bg-black/15 py-2">
              <dt className="text-parchment-300/55">{k}</dt>
              <dd className="mt-0.5 font-medium text-parchment-50">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-auto flex items-center gap-2">
        {collection && position && (
          <>
            <button
              onClick={() => moveInCollection(collection.id, id, -1)}
              disabled={position.index === 0}
              aria-label={`Move ${song.title} up`}
              className="border border-gold-500/30 px-2 py-0.5 text-sm text-parchment-200/80 hover:text-gold-200 disabled:opacity-30"
            >
              ↑
            </button>
            <button
              onClick={() => moveInCollection(collection.id, id, 1)}
              disabled={position.index === position.count - 1}
              aria-label={`Move ${song.title} down`}
              className="border border-gold-500/30 px-2 py-0.5 text-sm text-parchment-200/80 hover:text-gold-200 disabled:opacity-30"
            >
              ↓
            </button>
            <span className="text-xs tabular-nums text-parchment-300/55">{position.index + 1}</span>
          </>
        )}
        <Link href={href} className="ml-auto font-display text-xs tracking-widest text-gold-300 hover:text-gold-200">
          Learn →
        </Link>
      </div>
    </div>
  );
}

function SongMenu({ song, lib, collection, onDone }: { song: UserSong; lib: UserLibrary; collection?: Collection; onDone: () => void }) {
  const id = song.id as UserSongId;
  return (
    <div className="space-y-3 border border-gold-500/20 bg-black/20 p-3 text-sm">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          renameUserSong(id, new FormData(e.currentTarget).get("title") as string);
          onDone();
        }}
      >
        <input name="title" defaultValue={song.title} maxLength={80} aria-label="Song title" className={`${field} min-w-0 flex-1`} />
        <button type="submit" className={btn}>Rename</button>
      </form>

      {lib.collections.length > 0 && (
        <fieldset>
          <legend className="mb-1 text-[11px] uppercase tracking-[0.16em] text-parchment-300/60">In collections</legend>
          <div className="space-y-1">
            {lib.collections.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-parchment-200/85">
                <input
                  type="checkbox"
                  checked={c.songIds.includes(id)}
                  onChange={(e) => setInCollection(c.id, id, e.target.checked)}
                  className="accent-gold-300"
                />
                {c.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex flex-wrap gap-3 text-xs">
        {collection && (
          <button onClick={() => setInCollection(collection.id, id, false)} className="text-gold-300 underline hover:text-gold-200">
            Remove from {collection.name}
          </button>
        )}
        <button
          onClick={() => {
            if (confirm(`Delete "${song.title}" from this device? Its practice results go too.`)) deleteUserSong(id);
          }}
          className="text-red-300/80 underline hover:text-red-300"
        >
          Delete song
        </button>
        <button onClick={onDone} className="ml-auto text-parchment-300/70 hover:text-parchment-50">
          Close
        </button>
      </div>
    </div>
  );
}
