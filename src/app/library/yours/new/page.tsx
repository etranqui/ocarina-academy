import type { Metadata } from "next";
import { Suspense } from "react";
import { AddSongFlow } from "@/components/AddSongFlow";

export const metadata: Metadata = { title: "Add a song" };

export default function AddSongPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="mb-6">
        <p className="font-display text-xs tracking-[0.4em] text-gold-300/80">YOUR SONGS</p>
        <h1 className="mt-2 font-display text-4xl text-parchment-50">Add a song</h1>
        <p className="mt-2 max-w-2xl font-serif text-parchment-200/70">
          Bring a MIDI file and learn it like the Ocarina of Time songs: fingerings, play-along and practice with your microphone.
        </p>
      </header>
      <Suspense>
        <AddSongFlow />
      </Suspense>
    </div>
  );
}
