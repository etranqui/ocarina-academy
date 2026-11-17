"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { isUserSongId, type UserSongId } from "@/engine/music/schema";
import { collectionSongs, userSongHref, useUserLibrary, yourSongsHref } from "@/lib/userSongs";
import { SongHeaderView, type SongTab } from "./SongHeader";
import { SongWorkspace } from "./SongView";

/** Page of one of your songs: /library/yours/song/?id=u-…&tab=listen&c=<collection> */
export function UserSongView() {
  const params = useSearchParams();
  const lib = useUserLibrary();
  const rawId = params.get("id") ?? "";
  const tabParam = params.get("tab");
  const tab: SongTab = tabParam === "listen" || tabParam === "practice" ? tabParam : "overview";
  const song = isUserSongId(rawId) ? lib.songs[rawId] : undefined;
  const collection = lib.collections.find((c) => c.id === params.get("c"));

  // The page is static, so its <title> can't know the song: set it here.
  useEffect(() => {
    if (song) document.title = `${song.title} · Ocarina Academy`;
  }, [song]);

  if (!song) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="font-display text-3xl text-parchment-50">Song not found</h1>
        <p className="mt-3 font-serif text-parchment-200/75">
          It may have been deleted, or it was added in another browser. Your songs are stored on the device you added them on.
        </p>
        <Link href={yourSongsHref()} className="mt-6 inline-block border border-gold-300/50 px-5 py-2 font-display text-xs tracking-widest text-gold-200 hover:bg-gold-300/10">
          Your songs
        </Link>
      </div>
    );
  }

  const id = song.id as UserSongId;
  const cid = collection?.id;
  const list = collection ? collectionSongs(lib, collection.id) : [];
  const pos = list.findIndex((s) => s.id === id);
  const next = pos >= 0 ? list[pos + 1] : undefined;
  const prev = pos > 0 ? list[pos - 1] : undefined;
  const hrefs = { overview: userSongHref(id, "overview", cid), listen: userSongHref(id, "listen", cid), practice: userSongHref(id, "practice", cid) };

  return (
    <SongWorkspace
      key={id}
      id={id}
      theme={song.theme}
      tab={tab}
      hrefs={hrefs}
      arrangements={{ full: song.arrangement }}
      header={
        <SongHeaderView
          back={{ href: yourSongsHref(cid), label: collection ? collection.name : "Your songs" }}
          eyebrow={`Your song · ${song.fileName}`}
          title={song.title}
          blurb={song.trackName ? `Track: ${song.trackName}` : undefined}
          theme={song.theme}
          tab={tab}
          hrefs={hrefs}
          extra={
            collection && pos >= 0 ? (
              <nav aria-label={`Playlist: ${collection.name}`} className="shrink-0 text-sm sm:text-right">
                <p className="text-xs text-parchment-300/60">
                  {pos + 1} of {list.length} in {collection.name}
                </p>
                <div className="mt-1 flex gap-4 sm:justify-end">
                  {prev && (
                    <Link href={userSongHref(prev.id, tab, cid)} className="text-gold-300 hover:text-gold-200">
                      ← {prev.title}
                    </Link>
                  )}
                  {next && (
                    <Link href={userSongHref(next.id, tab, cid)} className="text-gold-300 hover:text-gold-200">
                      Next: {next.title} →
                    </Link>
                  )}
                </div>
              </nav>
            ) : undefined
          }
        />
      }
    />
  );
}
