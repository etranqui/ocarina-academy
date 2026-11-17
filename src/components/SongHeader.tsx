"use client";

import Link from "next/link";
import type { Song, SongTheme } from "@/engine/music/schema";
import { SongEmblem } from "./SongEmblem";

export type SongTab = "overview" | "listen" | "practice";
export type ArrangementMode = "game" | "full";

export const defaultMode = (song: Song): ArrangementMode =>
  song.arrangements.full.status === "needs-transcription" ? "game" : "full";

export type TabHrefs = Record<SongTab, string>;

export const songTabHrefs = (id: string): TabHrefs => ({
  overview: `/songs/${id}/`,
  listen: `/songs/${id}/listen/`,
  practice: `/songs/${id}/practice/`,
});

/** Header of a bundled song. */
export function SongHeader({ song, tab }: { song: Song; tab: SongTab }) {
  return (
    <SongHeaderView
      back={{ href: "/library", label: "Song Library" }}
      eyebrow={`Song ${song.order} of 12 · ${song.group === "warp" ? "Warp song" : "Melody"}`}
      title={song.title}
      blurb={song.blurb}
      theme={song.theme}
      tab={tab}
      hrefs={songTabHrefs(song.id)}
    />
  );
}

/** Song header layout shared by bundled songs and your songs. */
export function SongHeaderView({
  back,
  eyebrow,
  title,
  blurb,
  theme,
  tab,
  hrefs,
  extra,
}: {
  back: { href: string; label: string };
  eyebrow: React.ReactNode;
  title: string;
  blurb?: React.ReactNode;
  theme: SongTheme;
  tab: SongTab;
  hrefs: TabHrefs;
  extra?: React.ReactNode;
}) {
  const tabs = [
    { id: "overview", label: "Fingerings" },
    { id: "listen", label: "Listen & Learn" },
    { id: "practice", label: "Practice" },
  ] as const;
  return (
    <>
      <Link href={back.href} className="font-display text-xs tracking-widest text-parchment-300/70 hover:text-gold-200">
        ← {back.label}
      </Link>
      <header className="relative mt-4">
        <div
          className="pointer-events-none absolute -left-40 -top-40 size-[28rem]"
          style={{ background: `radial-gradient(closest-side, ${theme.color}22, transparent)` }}
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <SongEmblem theme={theme} size={104} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.25em] text-parchment-300/60">{eyebrow}</p>
            <h1 className="break-words font-display text-3xl text-parchment-50 sm:text-5xl">{title}</h1>
            {blurb && <p className="mt-1 font-serif text-lg italic text-parchment-200/75">{blurb}</p>}
          </div>
          {extra}
        </div>
      </header>
      <nav aria-label="Song sections" className="mt-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-gold-500/20 [scrollbar-width:none]">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={hrefs[t.id]}
            aria-current={tab === t.id ? "page" : undefined}
            className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 font-display text-xs tracking-widest transition sm:px-4 ${
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

export function ModeToggle({ mode, onChange }: { mode: ArrangementMode; onChange: (m: ArrangementMode) => void }) {
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
    </div>
  );
}
