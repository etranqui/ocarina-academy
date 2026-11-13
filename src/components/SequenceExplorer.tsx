"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Arrangement } from "@/engine/music/schema";
import { buildTimeline } from "@/engine/music/timeline";
import { displayPitch } from "@/engine/music/pitch";
import { getFingering, HOLE_LABEL, transition } from "@/engine/fingering/engine";
import { OcarinaDiagram } from "./OcarinaDiagram";
import { FingeringStrip } from "./FingeringStrip";

/**
 * Step through an arrangement note by note. Reads only the shared timeline,
 * so what is shown here is exactly what audio and practice will use.
 */
export function SequenceExplorer({ arrangement, accent }: { arrangement: Arrangement; accent: string }) {
  const timeline = useMemo(() => buildTimeline(arrangement), [arrangement]);
  const [i, setI] = useState(0);
  const [labels, setLabels] = useState(false);
  const n = timeline.notes.length;
  const note = timeline.notes[i];
  const prev = i > 0 ? timeline.notes[i - 1] : null;
  const next = i < n - 1 ? timeline.notes[i + 1] : null;
  const fingering = getFingering(note.pitch);
  const change = transition(prev ? getFingering(prev.pitch) : null, fingering);

  const go = useCallback((d: number) => setI((x) => Math.min(n - 1, Math.max(0, x + d))), [n]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const k = e.key === "ArrowRight" || e.code === "Numpad6" ? "next"
        : e.key === "ArrowLeft" || e.code === "Numpad4" ? "prev"
        : e.key === "Home" || e.code === "Numpad7" ? "first"
        : e.key === "End" || e.code === "Numpad1" ? "last" : null;
      if (!k) return;
      e.preventDefault();
      if (k === "next") go(1);
      if (k === "prev") go(-1);
      if (k === "first") setI(0);
      if (k === "last") setI(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, n]);

  const rhythmNote =
    arrangement.source.rhythm === "uniform"
      ? "Shown as an even pulse — the game sequence records which notes, not their exact rhythm."
      : arrangement.source.rhythm === "unknown"
        ? "Pitches only — the rhythm of this passage has not been transcribed yet."
        : null;

  return (
    <div className="space-y-5">
      {/* Focus note */}
      <div className="parchment relative overflow-hidden p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-ink-500">
              Note {i + 1} of {n} · {timeline.sections[note.formIndex].label}
            </p>
            <p className="font-display text-5xl leading-none text-ink-900">
              {displayPitch(note.pitch, { octave: false })}
              <span className="ml-1 align-top text-xl text-ink-500">{note.pitch.replace(/\D/g, "")}</span>
            </p>
            <p className="mt-1 text-sm text-ink-700">{Math.round(note.hz)} Hz</p>
          </div>
          <div className="max-w-xs text-sm text-ink-700">
            {prev ? (
              change.lift.length || change.press.length ? (
                <>
                  <p className="font-medium text-ink-900">From {displayPitch(prev.pitch)}:</p>
                  {change.lift.length > 0 && <p>Lift {change.lift.map((h) => HOLE_LABEL[h].toLowerCase()).join(", ")}</p>}
                  {change.press.length > 0 && <p>Cover {change.press.map((h) => HOLE_LABEL[h].toLowerCase()).join(", ")}</p>}
                </>
              ) : (
                <p>Same fingering as the previous note — re-articulate with your breath.</p>
              )
            ) : (
              <p>{fingering?.note ?? "Starting note. Cover the green holes."}</p>
            )}
          </div>
        </div>

        <div className="mx-auto mt-2 max-w-2xl">
          <OcarinaDiagram pitch={note.pitch} previousPitch={prev?.pitch ?? null} animationKey={i} showLabels={labels} />
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} className="accent-leaf-500" />
            Show hole names
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => go(-1)}
              disabled={i === 0}
              className="border border-ink-500/40 px-4 py-2 font-display text-xs tracking-widest text-ink-900 transition hover:bg-ink-900/5 disabled:opacity-35"
            >
              ← Prev
            </button>
            <button
              onClick={() => go(1)}
              disabled={i === n - 1}
              className="bg-forest-700 px-4 py-2 font-display text-xs tracking-widest text-parchment-50 transition hover:bg-forest-600 disabled:opacity-35"
            >
              Next{next ? ` · ${displayPitch(next.pitch)}` : ""} →
            </button>
          </div>
        </div>
      </div>

      <FingeringStrip timeline={timeline} arrangement={arrangement} current={i} onSelect={setI} accent={accent} />

      {rhythmNote && <p className="text-xs text-parchment-300/60">{rhythmNote}</p>}
      <p className="hidden text-xs text-parchment-300/60 sm:block">Keys: ← → (or number pad 4 / 6) step through notes · Home / End jump to the first / last.</p>
    </div>
  );
}
