import type { Metadata } from "next";
import { OcarinaDiagram } from "@/components/OcarinaDiagram";
import { chart, DEFAULT_PROFILE, HOLE_LABEL } from "@/engine/fingering/engine";
import { displayPitch } from "@/engine/music/pitch";

export const metadata: Metadata = { title: "Fingering chart" };

const EVIDENCE = {
  "user-chart": { label: "From your chart", cls: "text-leaf-500 border-leaf-500/40" },
  "full-chart": { label: "From your full chart", cls: "text-leaf-500 border-leaf-500/40" },
  standard: { label: "Standard", cls: "text-gold-600 border-gold-500/50" },
};

export default function FingeringsPage() {
  const profile = DEFAULT_PROFILE;
  const rows = chart(profile);
  const reasons = new Map(profile.undefinedNotes.flatMap((u) => u.pitches.map((p) => [p, u.reason] as const)));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8 text-center">
        <p className="font-display text-xs tracking-[0.4em] text-gold-300/80">THE INSTRUMENT</p>
        <h1 className="mt-2 font-display text-4xl text-parchment-50">Fingering Chart</h1>
        <div className="filigree mx-auto my-4 max-w-xs" />
        <p className="mx-auto max-w-2xl font-serif text-parchment-200/70">{profile.name}. {profile.description}</p>
      </header>

      <section className="parchment mb-10 grid gap-6 p-5 sm:p-8 md:grid-cols-[1.4fr_1fr] md:items-center">
        <OcarinaDiagram pitch="C5" showLabels />
        <div className="text-ink-700">
          <h2 className="font-display text-lg text-ink-900">Reading the diagrams</h2>
          <p className="mt-2 text-sm">
            Seen from above while you play: mouthpiece toward you, left hand on the wide end.{" "}
            <span className="font-medium text-leaf-500">Green</span> holes are covered; open holes are dark.
            Dashed rings are the two thumb holes underneath.
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {profile.holes.map((h) => (
              <li key={h.id}>
                <span className="inline-block w-7 font-semibold text-ink-900">{h.id}</span>
                {HOLE_LABEL[h.id]}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {rows.map(({ pitch, fingering }) => (
          <article
            key={pitch}
            className={`parchment flex flex-col p-4 ${fingering ? "" : "opacity-55 saturate-50"}`}
            aria-label={`${displayPitch(pitch)} fingering`}
          >
            <div className="flex items-baseline justify-between">
              <h3 className="font-display text-2xl text-ink-900">{displayPitch(pitch)}</h3>
              {fingering ? (
                <span className={`border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${EVIDENCE[fingering.evidence].cls}`}>
                  {EVIDENCE[fingering.evidence].label}
                </span>
              ) : (
                <span className="border border-ink-500/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-500">
                  Not defined
                </span>
              )}
            </div>
            <OcarinaDiagram pitch={fingering ? pitch : null} variant="compact" />
            <p className="mt-1 text-xs text-ink-700">{fingering ? fingering.note ?? " " : reasons.get(pitch)}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
