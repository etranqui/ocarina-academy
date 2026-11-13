"use client";

import { useState } from "react";
import { SongCard } from "@/components/SongCard";
import { useSongs } from "@/lib/arrangements";
import { useProgress } from "@/lib/progress";

const FILTERS = [
  { id: "all", label: "All songs" },
  { id: "melody", label: "Melodies" },
  { id: "warp", label: "Warp songs" },
] as const;

export default function LibraryPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const progress = useProgress();
  const all = useSongs();
  const songs = all.filter((s) => filter === "all" || s.group === filter);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8 text-center">
        <p className="font-display text-xs tracking-[0.4em] text-gold-300/80">THE SONGBOOK</p>
        <h1 className="mt-2 font-display text-4xl text-parchment-50">Song Library</h1>
        <div className="filigree mx-auto my-4 max-w-xs" />
        <p className="mx-auto max-w-xl font-serif text-parchment-200/70">
          Difficulty and length are computed from each song&apos;s notes. Badges show exactly which content is verified.
        </p>
      </header>

      <div role="tablist" aria-label="Filter songs" className="mb-8 flex justify-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`border px-4 py-1.5 font-display text-xs tracking-widest transition ${
              filter === f.id
                ? "border-gold-300 bg-gold-300/15 text-gold-200"
                : "border-gold-500/25 text-parchment-200/70 hover:border-gold-400/60"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {songs.map((song, i) => (
          <div key={song.id} className="animate-rise" style={{ animationDelay: `${i * 40}ms` }}>
            <SongCard song={song} progress={progress.songs[song.id]} />
          </div>
        ))}
      </div>
    </div>
  );
}
