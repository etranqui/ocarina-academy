"use client";

import { useEffect, useRef, useState } from "react";
import { beatsPerBar, fullRange } from "@/engine/audio/schedule";
import { Transport } from "@/engine/audio/transport";
import type { Timeline } from "@/engine/music/timeline";
import { getFingering } from "@/engine/fingering/engine";

export interface PreviewSource {
  key: number;
  timeline: Timeline;
  bpm: number;
  timeSignature: [number, number];
}

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

/**
 * One preview player for the track picker: plays a whole track (as the
 * ocarina would), from any point, and reports where it is.
 */
export function useTrackPreview() {
  const cur = useRef<{ key: number; tr: Transport } | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [beat, setBeat] = useState(0);

  useEffect(() => () => cur.current?.tr.dispose(), []);

  useEffect(() => {
    if (!playing) return;
    let id = 0;
    const frame = () => {
      const c = cur.current;
      if (c) {
        if (c.tr.checkFinished()) {
          setBeat(0);
          return;
        }
        setBeat(c.tr.position());
      }
      id = requestAnimationFrame(frame);
    };
    id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
  }, [playing]);

  function transportFor(src: PreviewSource) {
    if (cur.current?.key !== src.key) {
      cur.current?.tr.dispose();
      const tr = new Transport(src.timeline, {
        bpm: src.bpm,
        tempoFactor: 1,
        loop: false,
        metronome: false,
        beatsPerBar: beatsPerBar(src.timeSignature),
        range: fullRange(src.timeline),
      });
      tr.onStateChange((s) => setPlaying(s === "playing"));
      cur.current = { key: src.key, tr };
      setActive(src.key);
      setBeat(0);
    }
    return cur.current.tr;
  }

  return {
    active,
    playing,
    beat,
    playFrom(src: PreviewSource, from: number) {
      const tr = transportFor(src);
      tr.seek(from);
      setBeat(from);
      void tr.play();
    },
    toggle(src: PreviewSource) {
      const tr = transportFor(src);
      if (tr.playbackState === "playing") tr.pause();
      else void tr.play();
    },
    stop() {
      cur.current?.tr.stop();
      setBeat(0);
    },
  };
}

/**
 * A track at a glance: every note as a dash (time across, pitch up), so a
 * single melody line looks different from chords or a bass part. Click or
 * drag anywhere to play from there; ← → skip 10 seconds when focused.
 */
export function TrackRoll({
  src,
  label,
  beat,
  active,
  playing,
  onSeek,
}: {
  src: PreviewSource;
  label: string;
  beat: number;
  active: boolean;
  playing: boolean;
  onSeek: (beat: number) => void;
}) {
  const { notes, totalBeats } = src.timeline;
  const W = 600;
  const H = 40;
  const lo = notes.length ? Math.min(...notes.map((n) => n.midi)) : 60;
  const hi = notes.length ? Math.max(...notes.map((n) => n.midi)) : 72;
  const span = Math.max(12, hi - lo);
  const x = (b: number) => (b / Math.max(totalBeats, 1)) * W;
  const y = (m: number) => H - 4 - ((m - lo) / span) * (H - 8);
  const spb = 60 / src.bpm;
  const total = totalBeats * spb;
  const pos = active ? beat : 0;

  const seekAt = (clientX: number, el: Element) => {
    const r = el.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * totalBeats);
  };

  return (
    <div className="flex items-center gap-3">
      <div
        role="slider"
        tabIndex={0}
        aria-label={`${label}: play from a point`}
        aria-valuemin={0}
        aria-valuemax={Math.round(total)}
        aria-valuenow={Math.round(pos * spb)}
        aria-valuetext={`${fmt(pos * spb)} of ${fmt(total)}`}
        className="relative h-10 min-w-0 flex-1 cursor-pointer border border-gold-500/20 bg-black/25 focus-visible:outline-2 focus-visible:outline-gold-300"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          seekAt(e.clientX, e.currentTarget);
        }}
        onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
        onKeyDown={(e) => {
          const step = 10 / spb;
          if (e.key === "ArrowRight") onSeek(Math.min(totalBeats - 0.01, pos + step));
          else if (e.key === "ArrowLeft") onSeek(Math.max(0, pos - step));
          else if (e.key === "Home") onSeek(0);
          else return;
          e.preventDefault();
        }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
          {notes.map((n) => (
            <rect
              key={n.index}
              x={x(n.startBeat)}
              y={y(n.midi) - 1.25}
              width={Math.max(1, x(n.beats) - 0.6)}
              height={2.5}
              className={getFingering(n.pitch) ? "fill-gold-300/75" : "fill-red-300/80"}
            />
          ))}
          {active && <rect x={0} y={0} width={x(pos)} height={H} className="fill-gold-300/10" />}
          {active && (
            <line x1={x(pos)} x2={x(pos)} y1={0} y2={H} className="stroke-gold-200" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          )}
        </svg>
      </div>
      <span className="w-[86px] shrink-0 text-right text-xs tabular-nums text-parchment-300/65">
        {active ? fmt(pos * spb) : "0:00"} / {fmt(total)}
        {active && playing && <span className="sr-only"> playing</span>}
      </span>
    </div>
  );
}
