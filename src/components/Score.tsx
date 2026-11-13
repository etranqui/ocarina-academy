"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { Timeline } from "@/engine/music/timeline";
import { displayPitch, midiToPitch, parsePitch } from "@/engine/music/pitch";
import { beatsPerBar } from "@/engine/audio/schedule";

/**
 * Lightweight SVG staff notation, rendered from the shared timeline.
 * Treble clef with an "8" above: written one octave below sounding pitch,
 * the usual convention for Alto C ocarina music (keeps notes on the staff).
 */

export const S = 12; // staff line spacing
const MAX_W = 1000; // widest system (viewBox units)
const MIN_W = 420;
/** viewBox units per CSS pixel: keeps the staff readable on phones (fewer bars per line). */
const UNITS_PER_PX = 1.4;
const SYS_H = 150;
export const STAFF_TOP = 34;
export const BOTTOM = STAFF_TOP + 4 * S; // E4 line (written)
const CLEF_W = 54;
const TS_W = 30;

type Item =
  | { kind: "note"; index: number; midi: number; pitch: string; beats: number; start: number; tie: boolean }
  | { kind: "rest"; beats: number; start: number };

interface Placed {
  item: Item;
  x: number;
  w: number;
}

interface System {
  items: Placed[];
  bars: number[]; // x positions of bar lines
  first: boolean;
}

const BASES = [4, 2, 1, 0.5, 0.25];
function noteValue(beats: number): { base: number; dotted: boolean } {
  for (const b of BASES) {
    if (Math.abs(beats - b) < 1e-6) return { base: b, dotted: false };
    if (Math.abs(beats - b * 1.5) < 1e-6) return { base: b, dotted: true };
  }
  let best = 1;
  for (const b of BASES) if (Math.abs(b - beats) < Math.abs(best - beats)) best = b;
  return { base: best, dotted: false };
}

/** Staff position of a written pitch: 0 = bottom line (E4), 1 = first space … */
export function staffPos(soundingMidi: number) {
  const { step, octave } = parsePitch(midiToPitch(soundingMidi - 12));
  return octave * 7 + "CDEFGAB".indexOf(step) - 30;
}
export const yOf = (p: number) => BOTTOM - (p * S) / 2;

function itemWidth(it: Item) {
  const w = 26 + 22 * Math.pow(Math.min(it.beats, 4), 0.6);
  return it.kind === "note" && midiToPitch(it.midi).includes("#") ? w + 12 : w;
}

function layout(t: Timeline, ts: [number, number], W: number): System[] {
  const bpb = beatsPerBar(ts);
  const items: Item[] = [
    ...t.notes.map((n) => ({ kind: "note" as const, index: n.index, midi: n.midi, pitch: n.pitch, beats: n.beats, start: n.startBeat, tie: n.tie })),
    ...t.rests.map((r) => ({ kind: "rest" as const, beats: r.beats, start: r.startBeat })),
  ].sort((a, b) => a.start - b.start);

  // Group into measures.
  const measures: Item[][] = [];
  for (const it of items) {
    const m = Math.floor(it.start / bpb + 1e-6);
    (measures[m] ??= []).push(it);
  }

  const systems: System[] = [];
  let cur: { measures: Item[][]; width: number } = { measures: [], width: 0 };
  const flush = (last: boolean) => {
    if (!cur.measures.length) return;
    const first = systems.length === 0;
    const startX = CLEF_W + (first ? TS_W : 0) + 8;
    const natural = cur.width;
    const avail = W - startX - 6;
    const fill = natural > 0 ? Math.max(1, avail / natural) : 1;
    const stretch = last ? Math.min(fill, 1.8) : fill;
    let x = startX;
    const placed: Placed[] = [];
    const bars: number[] = [];
    for (const m of cur.measures) {
      for (const it of m) {
        const w = itemWidth(it) * stretch;
        placed.push({ item: it, x: x + Math.min(18, w / 2), w });
        x += w;
      }
      x += 10 * stretch;
      bars.push(x - 5 * stretch);
    }
    systems.push({ items: placed, bars, first });
    cur = { measures: [], width: 0 };
  };

  for (const m of measures) {
    if (!m) continue;
    const mw = m.reduce((s, it) => s + itemWidth(it), 0) + 10;
    const startX = CLEF_W + (systems.length === 0 ? TS_W : 0) + 8;
    if (cur.width + mw > W - startX - 6 && cur.measures.length) flush(false);
    cur.measures.push(m);
    cur.width += mw;
  }
  flush(true);
  return systems;
}

export function Clef() {
  return (
    // Drawn for STAFF_TOP = 34, S = 12 (lines at y 34–82; the spiral wraps the G line at y 70).
    // Stem rises from the dot-hook, the top loop bulges right, crosses the stem and
    // sweeps down into the belly, which curls clockwise into the G line.
    <g fill="none" stroke="currentColor" strokeLinecap="round" transform={`translate(0 ${STAFF_TOP - 34})`}>
      <path
        strokeWidth="2.4"
        d="M19 94 C20 70 16 42 20 26 C23 13 31 12 29 24 C27 35 8 43 7 62 C6 77 16 86 24 82 C32 78 31 62 22 61 C15 60 13 68 18 72"
      />
      <path strokeWidth="2.4" d="M19 94 C20 105 10 107 10 100" />
      <circle cx="12" cy="99" r="3.6" fill="currentColor" stroke="none" />
      <text x="27" y="10" fontSize="11" textAnchor="middle" fill="currentColor" stroke="none" fontStyle="italic">
        8
      </text>
    </g>
  );
}

function Rest({ x, beats }: { x: number; beats: number }) {
  const { base, dotted } = noteValue(beats);
  const mid = STAFF_TOP + 2 * S;
  let glyph: React.ReactNode;
  if (base >= 4) glyph = <rect x={x - 7} y={STAFF_TOP + S} width="14" height="6" />;
  else if (base >= 2) glyph = <rect x={x - 7} y={mid - 6} width="14" height="6" />;
  else if (base >= 1)
    glyph = (
      <path
        d={`M${x - 2} ${mid - 18} l7 9 l-6 7 l6 8 c-6 -3 -10 0 -6 5 c-8 -3 -8 -10 0 -9 l-6 -6 l6 -7 z`}
      />
    );
  else
    glyph = (
      <g>
        <circle cx={x - 3} cy={mid - 6} r="3.2" />
        <path d={`M${x - 3} ${mid - 3} Q${x + 3} ${mid - 3} ${x + 5} ${mid - 9} L${x - 1} ${mid + 12}`} fill="none" stroke="currentColor" strokeWidth="1.8" />
        {base < 0.5 && <circle cx={x - 5} cy={mid + 2} r="3" />}
      </g>
    );
  return (
    <g fill="currentColor">
      {glyph}
      {dotted && <circle cx={x + 12} cy={mid - 4} r="2.2" />}
    </g>
  );
}

function Note({ x, item, active, accent }: { x: number; item: Extract<Item, { kind: "note" }>; active: boolean; accent: string }) {
  const p = staffPos(item.midi);
  const y = yOf(p);
  const { base, dotted } = noteValue(item.beats);
  const hollow = base >= 2;
  const up = p < 4;
  const stemX = up ? x + 6.3 : x - 6.3;
  const stemEnd = up ? y - 36 : y + 36;
  const color = active ? accent : "currentColor";
  const sharp = midiToPitch(item.midi).includes("#");

  const ledgers: number[] = [];
  for (let q = -2; q >= p; q -= 2) ledgers.push(q);
  for (let q = 10; q <= p; q += 2) ledgers.push(q);

  return (
    <g style={{ color }}>
      {ledgers.map((q) => (
        <line key={q} x1={x - 11} x2={x + 11} y1={yOf(q)} y2={yOf(q)} stroke="currentColor" strokeWidth="1.4" />
      ))}
      {sharp && (
        <text x={x - 18} y={y + 5} fontSize="17" textAnchor="middle" fill="currentColor">
          ♯
        </text>
      )}
      <ellipse
        cx={x}
        cy={y}
        rx="7"
        ry="5"
        transform={`rotate(-20 ${x} ${y})`}
        fill={hollow ? "var(--score-bg)" : "currentColor"}
        stroke="currentColor"
        strokeWidth={hollow ? 2 : 1}
      />
      {base < 4 && <line x1={stemX} x2={stemX} y1={y} y2={stemEnd} stroke="currentColor" strokeWidth="1.5" />}
      {base <= 0.5 &&
        Array.from({ length: base <= 0.25 ? 2 : 1 }, (_, k) => {
          const fy = stemEnd + (up ? k * 8 : -k * 8);
          const d = up
            ? `M${stemX} ${fy} c2 8 12 10 9 22 c0 -8 -5 -12 -9 -14`
            : `M${stemX} ${fy} c2 -8 12 -10 9 -22 c0 8 -5 12 -9 14`;
          return <path key={k} d={d} fill="currentColor" />;
        })}
      {dotted && <circle cx={x + 12} cy={p % 2 === 0 ? y - S / 2 : y} r="2.2" fill="currentColor" />}
      <text x={x} y={SYS_H - 14} textAnchor="middle" fontSize="15" fontStyle="italic" fontFamily="var(--font-serif)" fill={active ? accent : "#2fa35d"}>
        {displayPitch(item.pitch, { octave: false })}
      </text>
    </g>
  );
}

export const Score = memo(function Score({
  timeline,
  timeSignature,
  current,
  onSelect,
  accent = "#bf963b",
}: {
  timeline: Timeline;
  timeSignature: [number, number];
  current: number | null;
  onSelect?: (noteIndex: number) => void;
  accent?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(MAX_W);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(Math.min(MAX_W, Math.max(MIN_W, e.contentRect.width * UNITS_PER_PX)) / 20) * 20;
      setW((old) => (old === w ? old : w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const systems = useMemo(() => layout(timeline, timeSignature, W), [timeline, timeSignature, W]);
  const height = systems.length * SYS_H + 10;

  return (
    <div ref={box}>
    <svg
      viewBox={`0 0 ${W} ${height}`}
      className="block w-full text-ink-900 [--score-bg:#f6eedb]"
      role="img"
      aria-label="Music notation"
    >
      {systems.map((sys, si) => {
        const ty = si * SYS_H + 6;
        const end = sys.bars[sys.bars.length - 1] ?? W - 6;
        const lastSystem = si === systems.length - 1;
        return (
          <g key={si} transform={`translate(0 ${ty})`}>
            {[0, 1, 2, 3, 4].map((l) => (
              <line key={l} x1={4} x2={end} y1={STAFF_TOP + l * S} y2={STAFF_TOP + l * S} stroke="currentColor" strokeOpacity="0.55" strokeWidth="1" />
            ))}
            <g transform="translate(6 0) scale(1.1 1)">
              <Clef />
            </g>
            {sys.first && (
              <g fontFamily="var(--font-display)" fontWeight="700" fontSize="22" textAnchor="middle" fill="currentColor">
                <text x={CLEF_W + 12} y={STAFF_TOP + S * 2 - 3}>{timeSignature[0]}</text>
                <text x={CLEF_W + 12} y={STAFF_TOP + S * 4 - 3}>{timeSignature[1]}</text>
              </g>
            )}
            {sys.bars.map((bx, bi) => {
              const final = lastSystem && bi === sys.bars.length - 1;
              return (
                <g key={bi}>
                  <line x1={bx} x2={bx} y1={STAFF_TOP} y2={BOTTOM} stroke="currentColor" strokeWidth={final ? 1.2 : 1.2} />
                  {final && <line x1={bx + 4} x2={bx + 4} y1={STAFF_TOP} y2={BOTTOM} stroke="currentColor" strokeWidth="4" />}
                </g>
              );
            })}
            {sys.items.map((pl, k) => {
              if (pl.item.kind === "rest") return <Rest key={k} x={pl.x} beats={pl.item.beats} />;
              const it = pl.item;
              const active = it.index === current;
              const next = sys.items[k + 1];
              return (
                <g
                  key={k}
                  onClick={onSelect ? () => onSelect(it.index) : undefined}
                  className={onSelect ? "cursor-pointer" : undefined}
                  data-note={it.index}
                >
                  <rect
                    x={pl.x - 16}
                    y={4}
                    width="32"
                    height={SYS_H - 8}
                    rx="4"
                    fill={active ? accent : "transparent"}
                    fillOpacity={active ? 0.16 : 0}
                    style={{ transition: "fill-opacity 120ms" }}
                  />
                  <Note x={pl.x} item={it} active={active} accent={accent} />
                  {it.tie && next?.item.kind === "note" && (
                    <path
                      d={`M${pl.x + 6} ${yOf(staffPos(it.midi)) + 9} Q${(pl.x + next.x) / 2} ${yOf(staffPos(it.midi)) + 20} ${next.x - 6} ${yOf(staffPos(it.midi)) + 9}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
    </div>
  );
});
