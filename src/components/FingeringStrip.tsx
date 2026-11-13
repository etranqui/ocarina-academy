"use client";

import { memo } from "react";
import type { Arrangement } from "@/engine/music/schema";
import type { Timeline } from "@/engine/music/timeline";
import { displayPitch } from "@/engine/music/pitch";
import { OcarinaDiagram } from "./OcarinaDiagram";

/** Whole sequence as compact fingering tiles, grouped by phrase (like a fingering chart). */
export const FingeringStrip = memo(function FingeringStrip({
  timeline,
  arrangement,
  current,
  onSelect,
  accent,
}: {
  timeline: Timeline;
  arrangement: Arrangement;
  current: number | null;
  onSelect: (index: number) => void;
  accent: string;
}) {
  return (
    <div className="space-y-4">
      {timeline.sections.map((sec) => {
        const repeats = arrangement.form?.filter((id) => id === sec.phraseId).length ?? 1;
        const nth = arrangement.form?.slice(0, sec.formIndex + 1).filter((id) => id === sec.phraseId).length ?? 1;
        return (
          <div key={sec.formIndex}>
            <p className="mb-2 font-display text-xs tracking-[0.2em] text-parchment-300/70">
              {sec.label}
              {repeats > 1 && <span className="ml-2 text-parchment-300/40">repeat {nth}</span>}
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {timeline.notes.slice(sec.noteRange[0], sec.noteRange[1]).map((tn) => {
                const active = tn.index === current;
                return (
                  <button
                    key={tn.index}
                    onClick={() => onSelect(tn.index)}
                    aria-label={`Note ${tn.index + 1}: ${displayPitch(tn.pitch)}`}
                    aria-current={active}
                    data-note={tn.index}
                    className={`parchment px-1.5 pb-1.5 pt-1 text-left transition ${
                      active ? "ring-2 ring-offset-2 ring-offset-forest-950" : "opacity-80 hover:opacity-100"
                    }`}
                    style={active ? ({ ["--tw-ring-color" as string]: accent } as React.CSSProperties) : undefined}
                  >
                    <OcarinaDiagram pitch={tn.pitch} variant="compact" />
                    <span className="flex items-baseline justify-between px-1">
                      <span className="font-serif text-lg italic text-leaf-500">{displayPitch(tn.pitch, { octave: false })}</span>
                      <span className="text-[10px] text-ink-500">{tn.index + 1}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
});
