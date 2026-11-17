import type { Metadata } from "next";
import { Suspense } from "react";
import { LibraryHeader } from "@/components/LibraryHeader";
import { YourSongs } from "@/components/YourSongs";

export const metadata: Metadata = { title: "Your songs" };

export default function YourSongsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <LibraryHeader active="yours" intro="Songs you added from your own MIDI files, kept on this device." />
      <Suspense>
        <YourSongs />
      </Suspense>
    </div>
  );
}
