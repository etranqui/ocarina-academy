import type { Metadata } from "next";
import { ProgressDashboard } from "@/components/ProgressDashboard";

export const metadata: Metadata = { title: "My progress" };

export default function ProgressPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="font-display text-xs tracking-[0.4em] text-gold-300/90">YOUR JOURNEY</p>
      <h1 className="mt-2 font-display text-3xl text-parchment-50 sm:text-5xl">My progress</h1>
      <p className="mt-2 max-w-2xl font-serif text-lg italic text-parchment-200/75">
        Every microphone practice run is recorded here: accuracy, time, and which phrases you have completed.
      </p>
      <div className="filigree my-6 max-w-sm" />
      <ProgressDashboard />
    </div>
  );
}
