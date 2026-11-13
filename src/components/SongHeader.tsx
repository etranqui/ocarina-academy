"use client";

import Link from "next/link";
import type { Arrangement, Song } from "@/engine/music/schema";
import { SongEmblem } from "./SongEmblem";
import { StatusBadge } from "./StatusBadge";

export type SongTab = "overview" | "listen" | "practice";
export type ArrangementMode = "game" | "full";

export const defaultMode = (song: Song): ArrangementMode =>
  song.arrangements.full.status === "needs-transcription" ? "game" : "full";

export function SongHeader({ song, tab }: { song: Song; tab: SongTab }) {
  const tabs = [
    { id: "overview", label: "Fingerings", href: `/songs/${song.id}/` },
    { id: "listen", label: "Listen & Learn", href: `/songs/${song.id}/listen/` },
    { id: "practice", label: "Practice", href: `/songs/${song.id}/practice/` },
  ] as const;
  return (
    <>
      <Link href="/library" className="font-display text-xs tracking-widest text-parchment-300/70 hover:text-gold-200">
        ← Song Library
      </Link>
      <header className="relative mt-4">
        <div
          className="pointer-events-none absolute -left-40 -top-40 size-[28rem]"
          style={{ background: `radial-gradient(closest-side, ${song.theme.color}22, transparent)` }}
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <SongEmblem theme={song.theme} size={104} />
          <div className="flex-1">
            <p className="text-[11px] uppercase tracking-[0.25em] text-parchment-300/60">
              Song {song.order} of 12 · {song.group === "warp" ? "Warp song" : "Melody"}
            </p>
            <h1 className="font-display text-3xl text-parchment-50 sm:text-5xl">{song.title}</h1>
            <p className="mt-1 font-serif text-lg italic text-parchment-200/75">{song.blurb}</p>
          </div>
        </div>
      </header>
      <nav aria-label="Song sections" className="mt-6 flex gap-1 overflow-x-auto border-b border-gold-500/20">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={t.href}
            aria-current={tab === t.id ? "page" : undefined}
            className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 font-display text-xs tracking-widest transition sm:px-4 ${
              tab === t.id ? "border-gold-300 text-gold-200" : "border-transparent text-parchment-200/60 hover:text-parchment-50"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </>
  );
}

export function ModeToggle({
  song,
  mode,
  onChange,
}: {
  song: Song;
  mode: ArrangementMode;
  onChange: (m: ArrangementMode) => void;
}) {
  const arrangement: Arrangement = song.arrangements[mode];
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div role="tablist" aria-label="Arrangement" className="inline-flex border border-gold-500/30">
        {(["game", "full"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => onChange(m)}
            className={`px-4 py-2 font-display text-xs tracking-widest transition ${
              mode === m ? "bg-gold-300/15 text-gold-200" : "text-parchment-200/65 hover:text-parchment-50"
            }`}
          >
            {m === "game" ? "Game sequence" : "Full arrangement"}
          </button>
        ))}
      </div>
      <StatusBadge arrangement={arrangement} />
    </div>
  );
}
