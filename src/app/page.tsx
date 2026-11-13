"use client";

import Link from "next/link";
import { HeroScene } from "@/components/HeroScene";
import { SongCard } from "@/components/SongCard";
import { SongEmblem } from "@/components/SongEmblem";
import { SONGS } from "@/data/songs";
import { useSongs } from "@/lib/arrangements";
import { asset } from "@/lib/basePath";
import { summarize, useProgress } from "@/lib/progress";

function formatMinutes(sec: number) {
  return sec < 60 ? `${Math.round(sec)} s` : `${Math.round(sec / 60)} min`;
}

export default function HomePage() {
  const progress = useProgress();
  const merged = useSongs();
  const SONGS_BY_ID = new Map(merged.map((s) => [s.id, s]));
  const stats = summarize(progress);
  const recent = stats.recent.slice(0, 3);
  const continueSong = recent[0] ? SONGS_BY_ID.get(recent[0].songId) : SONGS[0];

  return (
    <>
      <section className="relative isolate overflow-hidden">
        <HeroScene />
        <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 pb-14 pt-14 sm:px-6 md:grid-cols-[1.1fr_1fr] md:pb-20 md:pt-20">
          <div className="animate-rise">
            <p className="font-display text-xs tracking-[0.4em] text-gold-300/90">A COMPANION FOR THE 12-HOLE ALTO C</p>
            <h1 className="mt-3 font-display text-4xl leading-[1.05] text-parchment-50 drop-shadow-[0_2px_12px_rgb(0_0_0/0.6)] sm:text-6xl">
              Ocarina
              <br />
              Academy
            </h1>
            <div className="filigree my-5 max-w-sm" />
            <p className="max-w-md font-serif text-lg text-parchment-100/90">
              Learn all twelve songs of <em>Ocarina of Time</em> on a real instrument — one fingering, one phrase,
              one song at a time.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              {continueSong && (
                <Link
                  href={`/songs/${continueSong.id}`}
                  className="bg-gradient-to-b from-gold-300 to-gold-500 px-6 py-3 font-display text-sm tracking-widest text-forest-950 shadow-[0_8px_30px_-8px_rgb(214_178_90/0.7)] transition hover:brightness-110"
                >
                  {recent.length ? `Continue · ${continueSong.title}` : `Begin with ${continueSong.title}`}
                </Link>
              )}
              <Link
                href="/library"
                className="border border-gold-300/50 px-6 py-3 font-display text-sm tracking-widest text-gold-200 transition hover:bg-gold-300/10"
              >
                Song Library
              </Link>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-lg animate-float">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset("/ocarina/replica-shell.svg")}
              alt="Illustration of a blue 12-hole ocarina"
              className="w-full drop-shadow-[0_30px_40px_rgb(0_0_0/0.55)]"
            />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-12 px-4 sm:px-6">
        <section aria-labelledby="journey" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <h2 id="journey" className="sr-only">
            Your progress
          </h2>
          {[
            { label: "Songs started", value: `${stats.started} / 12` },
            { label: "Songs mastered", value: `${stats.completed} / 12` },
            { label: "Notes played correctly", value: String(stats.notesCorrect) },
            {
              label: "Accuracy · practice time",
              value: stats.accuracy === null && !stats.practiceSeconds ? "—" : `${stats.accuracy === null ? "—" : `${stats.accuracy}%`} · ${formatMinutes(stats.practiceSeconds)}`,
            },
          ].map((s) => (
            <div key={s.label} className="panel px-5 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-parchment-300/60">{s.label}</p>
              <p className="mt-1 font-display text-2xl text-gold-200">{s.value}</p>
            </div>
          ))}
          <p className="text-xs text-parchment-300/50 sm:col-span-2 lg:col-span-4">
            Progress is stored on this device only.{" "}
            <Link href="/progress" className="text-gold-300 underline">
              See your full progress
            </Link>
          </p>
        </section>

        <section>
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl text-parchment-50">{recent.length ? "Continue learning" : "Start here"}</h2>
              <p className="font-serif text-sm italic text-parchment-200/60">
                {recent.length ? "Songs you opened most recently." : "Three gentle songs that use only a handful of fingerings."}
              </p>
            </div>
            <Link href="/library" className="shrink-0 font-display text-xs tracking-widest text-gold-300 hover:text-gold-200">
              All 12 songs →
            </Link>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {(recent.length
              ? recent.map((r) => SONGS_BY_ID.get(r.songId)!)
              : ["sarias-song", "zeldas-lullaby", "song-of-time"].map((id) => SONGS_BY_ID.get(id as never)!)
            ).map((song) => (
              <SongCard key={song.id} song={song} progress={progress.songs[song.id]} />
            ))}
          </div>
        </section>

        <section className="panel grid gap-6 p-6 md:grid-cols-[auto_1fr] md:items-center">
          <div className="flex -space-x-3">
            {SONGS.filter((s) => s.group === "warp").map((s) => (
              <SongEmblem key={s.id} theme={s.theme} size={52} />
            ))}
          </div>
          <div>
            <h2 className="font-display text-xl text-parchment-50">Twelve songs, two ways to learn each</h2>
            <p className="mt-1 font-serif text-parchment-200/75">
              Every song has its short <strong className="text-parchment-50">game sequence</strong> — the notes you play
              in the game — and a longer <strong className="text-parchment-50">full arrangement</strong> of the melody.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
