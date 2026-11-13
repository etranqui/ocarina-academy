"use client";

import Link from "next/link";
import type { Song } from "@/engine/music/schema";
import { analyze, formatDuration } from "@/engine/music/analysis";
import { SongEmblem } from "./SongEmblem";
import type { SongProgress } from "@/lib/progress";

export function SongCard({ song, progress }: { song: Song; progress?: SongProgress }) {
  const game = analyze(song.arrangements.game);
  const full = analyze(song.arrangements.full);
  const accuracy = progress && progress.notesAttempted ? Math.round((progress.notesCorrect / progress.notesAttempted) * 100) : null;
  const phraseCount = song.arrangements.game.phrases.length;
  const phrasesDone = progress
    ? song.arrangements.game.phrases.filter((p) => progress.phrases[`game:${p.id}`]?.completed).length
    : 0;
  const pct = progress?.completed ? 100 : Math.round((phrasesDone / phraseCount) * 100);

  return (
    <Link
      href={`/songs/${song.id}`}
      className="panel group relative flex flex-col gap-4 p-5 transition duration-300 hover:-translate-y-0.5 hover:shadow-[inset_0_0_0_1px_rgb(232_207_134/0.6),0_24px_50px_-24px_rgb(0_0_0/0.9)] focus-visible:outline-2 focus-visible:outline-gold-300"
      style={{ ["--song" as string]: song.theme.color }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: `radial-gradient(60% 50% at 20% 0%, ${song.theme.color}22, transparent 70%)` }}
      />
      <div className="flex items-start gap-4">
        <SongEmblem theme={song.theme} size={72} className="shrink-0 transition-transform duration-500 group-hover:scale-105" />
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.22em] text-parchment-300/60">
            {String(song.order).padStart(2, "0")} · {song.group === "warp" ? "Warp song" : "Melody"}
          </p>
          <h3 className="font-display text-xl leading-tight text-parchment-50">{song.title}</h3>
          <p className="mt-1 line-clamp-2 font-serif text-sm italic text-parchment-200/70">{song.blurb}</p>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="border border-gold-500/15 bg-black/15 py-2">
          <dt className="text-parchment-300/55">Difficulty</dt>
          <dd className="mt-0.5 font-medium text-parchment-50">{game?.difficulty ?? "—"}</dd>
        </div>
        <div className="border border-gold-500/15 bg-black/15 py-2">
          <dt className="text-parchment-300/55">Length</dt>
          <dd className="mt-0.5 font-medium text-parchment-50">
            {full ? formatDuration(full.durationSec) : game ? formatDuration(game.durationSec) : "—"}
          </dd>
        </div>
        <div className="border border-gold-500/15 bg-black/15 py-2">
          <dt className="text-parchment-300/55">Accuracy</dt>
          <dd className="mt-0.5 font-medium text-parchment-50">{accuracy === null ? "—" : `${accuracy}%`}</dd>
        </div>
      </dl>

      <div>
        <div className="mb-1.5 flex justify-between text-[11px] text-parchment-300/60">
          <span>{progress ? "Progress" : "Not started"}</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1 bg-black/30">
          <div className="h-full transition-all" style={{ width: `${pct}%`, background: song.theme.color }} />
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2">
        <span className="ml-auto font-display text-xs tracking-widest text-gold-300 opacity-80 group-hover:opacity-100">
          Learn →
        </span>
      </div>
    </Link>
  );
}
