"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OcarinaDiagram } from "@/components/OcarinaDiagram";
import { Clef, S, STAFF_TOP, staffPos, yOf } from "@/components/Score";
import { SONGS } from "@/data/songs";
import { playReference } from "@/engine/audio/transport";
import { chart, DEFAULT_PROFILE, HOLE_LABEL } from "@/engine/fingering/engine";
import { buildTimeline } from "@/engine/music/timeline";
import { displayPitch, parsePitch, pitchToHz, toMidi } from "@/engine/music/pitch";

const FLAT_OF: Record<string, string> = { "C#": "D♭", "D#": "E♭", "F#": "G♭", "G#": "A♭", "A#": "B♭" };

/** Registers of the instrument, for the organised chart. */
const GROUPS = [
  { title: "Low notes", hint: "The sub-holes extend the range below C.", from: "A4", to: "B4" },
  { title: "Middle octave", hint: "Lift one finger at a time, from the right pinky up.", from: "C5", to: "B5" },
  { title: "High notes", hint: "The thumbs come off, then the left index alone.", from: "C6", to: "F6" },
];

// Staff geometry (same as the score: treble clef, written an octave below sounding pitch).
const COL = 44;
const X0 = 70;
const LABEL_Y = 136;
const H = 150;

/** Which songs (game sequence or full arrangement) use a pitch. */
function songsUsing(pitch: string) {
  return SONGS.filter((s) =>
    (["game", "full"] as const).some((m) => buildTimeline(s.arrangements[m]).notes.some((n) => n.pitch === pitch)),
  );
}

/**
 * Pick a note on a staff (or step through with ← →) and see its fingering,
 * hear it, and find the songs that use it. The full chart sits below, grouped
 * by register.
 */
export function FingeringExplorer() {
  const rows = useMemo(() => chart(DEFAULT_PROFILE), []);
  const pitches = useMemo(() => rows.map((r) => r.pitch), [rows]);
  const naturals = pitches.filter((p) => !p.includes("#"));
  const [pitch, setPitch] = useState("C5");
  const [prev, setPrev] = useState<string | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const audio = useRef<AbortController | null>(null);

  // Deep link: /fingerings/#A%235 opens A♯5.
  useEffect(() => {
    const fromHash = () => {
      const p = decodeURIComponent(location.hash.slice(1));
      if (pitches.includes(p)) setPitch(p);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [pitches]);

  const select = useCallback(
    (p: string, scroll = false) => {
      setPrev(pitch);
      setPitch(p);
      history.replaceState(null, "", `#${encodeURIComponent(p)}`);
      if (scroll) top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [pitch],
  );

  const idx = pitches.indexOf(pitch);
  const step = useCallback((d: number) => {
    const next = pitches[idx + d];
    if (next) select(next);
  }, [idx, pitches, select]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, select, textarea")) return;
      if (e.key === "ArrowLeft" || e.key === "4") { e.preventDefault(); step(-1); }
      if (e.key === "ArrowRight" || e.key === "6") { e.preventDefault(); step(1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  const play = () => {
    audio.current?.abort();
    audio.current = new AbortController();
    void playReference([{ hz: pitchToHz(pitch), sec: 1.2 }], audio.current.signal).catch(() => {});
  };

  const { step: letter, alter } = parsePitch(pitch);
  const natural = alter ? pitch.replace("#", "") : pitch;
  const sharp = alter ? pitch : `${letter}#${parsePitch(pitch).octave}`;
  const hasSharp = pitches.includes(sharp);
  const fingering = rows[idx]?.fingering ?? null;
  const users = useMemo(() => songsUsing(pitch), [pitch]);
  /** One staff of natural notes (sharps are reached with the ♯ button or the arrow keys). */
  const staff = (notes: string[], className: string, cols = notes.length) => {
    const W = X0 + cols * COL + 10;
    return (
            <svg viewBox={`0 0 ${W} ${H}`} className={`${className} w-full text-ink-900 [--score-bg:#f6eedb]`} role="group" aria-label={`Notes ${displayPitch(notes[0])} to ${displayPitch(notes[notes.length - 1])}`}>
              {[0, 1, 2, 3, 4].map((i) => (
                <line key={i} x1={6} x2={W - 4} y1={STAFF_TOP + i * S} y2={STAFF_TOP + i * S} stroke="currentColor" strokeWidth="1.2" opacity="0.55" />
              ))}
              <g transform="translate(10 0)"><Clef /></g>
              {notes.map((n, i) => {
                const x = X0 + i * COL + COL / 2;
                const active = natural === n;
                const shown = active ? pitch : n;
                const p = staffPos(toMidi(shown));
                const y = yOf(p);
                const ledgers: number[] = [];
                for (let q = -2; q >= p; q -= 2) ledgers.push(q);
                for (let q = 10; q <= p; q += 2) ledgers.push(q);
                return (
                  <g
                    key={n}
                    role="button"
                    tabIndex={0}
                    aria-label={displayPitch(n)}
                    aria-pressed={active}
                    onClick={() => select(n)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), select(n))}
                    className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-gold-600"
                    style={{ color: active ? "#1f8a4c" : undefined }}
                  >
                    <rect x={x - COL / 2} y={4} width={COL} height={H - 8} rx={4} fill={active ? "#2fa35d22" : "transparent"} stroke="transparent" strokeWidth="2" />
                    {ledgers.map((q) => (
                      <line key={q} x1={x - 12} x2={x + 12} y1={yOf(q)} y2={yOf(q)} stroke="currentColor" strokeWidth="1.4" />
                    ))}
                    {shown.includes("#") && (
                      <text x={x - 17} y={y + 5} fontSize="17" textAnchor="middle" fill="currentColor">♯</text>
                    )}
                    <ellipse cx={x} cy={y} rx="7.5" ry="5.2" transform={`rotate(-20 ${x} ${y})`} fill="var(--score-bg)" stroke="currentColor" strokeWidth={active ? 2.6 : 2} />
                    <text x={x} y={LABEL_Y} textAnchor="middle" fontSize="17" fontStyle="italic" fontFamily="var(--font-serif)" fill={active ? "#1f8a4c" : "#6b5a3a"}>
                      {displayPitch(shown, { octave: false })}
                    </text>
                  </g>
                );
              })}
            </svg>
    );
  };

  return (
    <>
      {/* Phones: diagram first, then the staves right under it, so a tap shows its result on screen. */}
      <div ref={top} className="grid scroll-mt-20 gap-4 md:grid-cols-[1.5fr_1fr]">
        {/* Note picker */}
        <section className="parchment order-2 p-3 sm:p-5 md:order-1 md:col-span-2" aria-label="Pick a note">
          <p className="px-1 text-[11px] uppercase tracking-[0.25em] text-ink-500">Tap a note to see its fingering</p>
          {staff(naturals, "mt-1 hidden sm:block")}
          {/* Phones: two shorter staves so each note is big enough to tap. */}
          {staff(naturals.slice(0, 7), "mt-1 block sm:hidden")}
          {staff(naturals.slice(7), "block sm:hidden", 7)}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => step(-1)}
                disabled={idx <= 0}
                aria-label="Previous note"
                className="border border-ink-500/30 px-3 py-1.5 text-sm text-ink-800 hover:bg-ink-900/5 disabled:opacity-35"
              >
                ←
              </button>
              <button
                onClick={() => step(1)}
                disabled={idx >= pitches.length - 1}
                aria-label="Next note"
                className="border border-ink-500/30 px-3 py-1.5 text-sm text-ink-800 hover:bg-ink-900/5 disabled:opacity-35"
              >
                →
              </button>
              {(hasSharp || alter) && (
                <button
                  onClick={() => select(alter ? natural : sharp)}
                  aria-pressed={!!alter}
                  className={`border px-3 py-1.5 text-sm ${alter ? "border-leaf-500/60 bg-leaf-500/10 text-leaf-500" : "border-ink-500/30 text-ink-800 hover:bg-ink-900/5"}`}
                >
                  {alter ? `♮ Back to ${displayPitch(natural, { octave: false })}` : `♯ Raise to ${displayPitch(sharp, { octave: false })}`}
                </button>
              )}
            </div>
            <p className="hidden text-[11px] text-ink-500 sm:block">← → step through every note, sharps included</p>
          </div>
        </section>

        {/* Selected note: name + diagram */}
        <section className="parchment order-1 p-3 sm:p-5 md:order-2" aria-live="polite">
          <div className="flex flex-wrap items-baseline gap-x-3 px-1">
            <h2 className="font-display text-3xl text-ink-900 md:text-5xl">
              {displayPitch(pitch, { octave: false })}
              <span className="ml-1 text-lg text-ink-500 md:text-xl">{parsePitch(pitch).octave}</span>
            </h2>
            {alter ? <span className="text-sm text-ink-500">also called {FLAT_OF[`${letter}#`]}</span> : null}
            <span className="text-xs text-ink-500">{Math.round(pitchToHz(pitch))} Hz</span>
          </div>
          <OcarinaDiagram pitch={fingering ? pitch : null} previousPitch={prev} animationKey={pitch} />
        </section>

        {/* Selected note: how to play it, where it is used */}
        <section className="parchment order-3 p-4 text-ink-800 sm:p-6">
          <p className="text-base">{fingering?.note ?? "No fingering for this note."}</p>
          {fingering && (
            <p className="mt-2 text-xs text-ink-500">
              Covered:{" "}
              {fingering.covered.length ? fingering.covered.map((h) => HOLE_LABEL[h].toLowerCase()).join(", ") : "nothing — every hole open"}
            </p>
          )}
          <button
            onClick={play}
            className="mt-4 bg-gradient-to-b from-gold-300 to-gold-500 px-4 py-2 font-display text-xs tracking-widest text-forest-950 hover:brightness-110"
          >
            ▶ Hear it
          </button>
          <div className="mt-5">
            <p className="text-[11px] uppercase tracking-[0.2em] text-ink-500">Used in</p>
            {users.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {users.map((s) => (
                  <Link key={s.id} href={`/songs/${s.id}/`} className="border border-ink-500/25 px-2 py-0.5 text-xs text-ink-800 hover:border-leaf-500 hover:text-leaf-500">
                    {s.title}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs text-ink-500">None of the twelve songs.</p>
            )}
          </div>
        </section>
      </div>

      {/* Organised chart */}
      <h2 className="mt-12 font-display text-2xl text-parchment-50">All fingerings</h2>
      <p className="mt-1 text-sm text-parchment-200/70">Grouped by register. Tap one to open it above.</p>
      {GROUPS.map((g) => {
        const from = pitches.indexOf(g.from);
        const to = pitches.indexOf(g.to);
        const group = rows.slice(from, to + 1);
        return (
          <section key={g.title} className="mt-6">
            <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
              <h3 className="font-display text-sm tracking-widest text-gold-200">{g.title}</h3>
              <span className="text-xs text-parchment-300/60">{g.hint}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {group.map(({ pitch: p, fingering: f }) => (
                <button
                  key={p}
                  onClick={() => select(p, true)}
                  aria-label={`${displayPitch(p)} fingering`}
                  className={`parchment flex flex-col items-center p-2 text-left transition hover:brightness-105 ${
                    p === pitch ? "ring-2 ring-leaf-500" : ""
                  } ${f ? "" : "opacity-55"}`}
                >
                  <span className="font-display text-lg text-ink-900">
                    {displayPitch(p, { octave: false })}
                    <span className="ml-0.5 text-xs text-ink-500">{parsePitch(p).octave}</span>
                  </span>
                  <OcarinaDiagram pitch={f ? p : null} variant="compact" />
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
