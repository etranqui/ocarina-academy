"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Arrangement } from "@/engine/music/schema";
import { buildTimeline } from "@/engine/music/timeline";
import { displayPitch } from "@/engine/music/pitch";
import { beatsPerBar, fullRange, noteAt, sectionRange, type PlayRange } from "@/engine/audio/schedule";
import { playReference, Transport, type TransportState } from "@/engine/audio/transport";
import { formatDuration } from "@/engine/music/analysis";
import { OcarinaDiagram } from "./OcarinaDiagram";
import { Score } from "./Score";
import { FingeringStrip } from "./FingeringStrip";

const TEMPOS = [0.5, 0.75, 1] as const;

/**
 * Listen & Learn: plays the arrangement on the synthetic ocarina while the
 * fingering diagram, upcoming-note preview and score follow the audio clock.
 */
export function ListenPlayer({ arrangement, accent }: { arrangement: Arrangement; accent: string }) {
  const timeline = useMemo(() => buildTimeline(arrangement), [arrangement]);
  const bpb = beatsPerBar(arrangement.timeSignature);

  const [state, setState] = useState<TransportState>("stopped");
  const [tempo, setTempo] = useState<number>(1);
  const [loop, setLoop] = useState(false);
  const [metronome, setMetronome] = useState(false);
  const [section, setSection] = useState(-1); // -1 = whole song
  const [view, setView] = useState<"score" | "fingerings">("score");
  const [pos, setPos] = useState({ current: 0 as number | null, upcoming: 1 as number | null, beat: 0 });
  const [audioError, setAudioError] = useState<string | null>(null);

  const transport = useRef<Transport | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const clock = useRef<HTMLSpanElement>(null);

  const range: PlayRange = useMemo(
    () => (section < 0 ? fullRange(timeline) : sectionRange(timeline, section)),
    [section, timeline],
  );
  const settings = useMemo(
    () => ({ bpm: arrangement.tempoBpm, tempoFactor: tempo, loop, metronome, beatsPerBar: bpb, range }),
    [arrangement.tempoBpm, tempo, loop, metronome, bpb, range],
  );

  // Push setting changes into a live transport.
  useEffect(() => {
    transport.current?.update(settings);
  }, [settings]);

  useEffect(
    () => () => {
      transport.current?.dispose();
    },
    [],
  );

  const showBeat = useCallback(
    (beat: number) => {
      const p = noteAt(timeline, beat);
      setPos((prev) => (prev.current === p.current && prev.upcoming === p.upcoming ? prev : { ...p, beat }));
      const span = range.endBeat - range.startBeat;
      if (bar.current) bar.current.style.width = `${Math.min(100, Math.max(0, ((beat - range.startBeat) / span) * 100))}%`;
      if (clock.current) clock.current.textContent = formatClock(((beat - range.startBeat) * 60) / (arrangement.tempoBpm * tempo));
    },
    [timeline, range, arrangement.tempoBpm, tempo],
  );

  /** One animation-frame step; returns false when playback has ended. */
  const frame = () => {
    const t = transport.current;
    if (!t) return false;
    if (t.checkFinished()) {
      showBeat(range.startBeat);
      return false;
    }
    showBeat(t.position());
    return true;
  };
  const frameRef = useRef(frame);
  frameRef.current = frame;

  useEffect(() => {
    if (state !== "playing") return;
    let id = 0;
    const tick = () => {
      if (frameRef.current()) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [state]);

  const ensureTransport = () => {
    if (!transport.current) {
      transport.current = new Transport(timeline, settings);
      transport.current.onStateChange(setState);
    }
    return transport.current;
  };

  const togglePlay = async () => {
    try {
      setAudioError(null);
      const t = ensureTransport();
      if (t.playbackState === "playing") t.pause();
      else {
        if (pos.beat >= range.startBeat && pos.beat < range.endBeat && t.playbackState !== "paused") t.seek(pos.beat);
        await t.play();
      }
    } catch (e) {
      setAudioError((e as Error).message || "Audio could not start in this browser.");
    }
  };

  const restart = () => {
    const t = transport.current;
    if (t) {
      t.seek(range.startBeat);
    }
    showBeat(range.startBeat);
  };

  const selectNote = useCallback(
    (index: number) => {
      const n = timeline.notes[index];
      if (n.startBeat < range.startBeat || n.startBeat >= range.endBeat) setSection(-1);
      transport.current?.seek(n.startBeat);
      showBeat(n.startBeat);
    },
    [timeline, range, showBeat],
  );

  /** Move to the previous/next note. While stopped or paused, the note sounds once so you can play along. */
  const preview = useRef<AbortController | null>(null);
  const step = (d: number) => {
    // During a rest, "next" means the upcoming note.
    const from = pos.current ?? (pos.upcoming ?? 0) - (d > 0 ? 1 : 0);
    const to = Math.min(timeline.notes.length - 1, Math.max(0, from + d));
    if (to === from && pos.current !== null) return;
    selectNote(to);
    if (transport.current?.playbackState === "playing") return;
    preview.current?.abort();
    preview.current = new AbortController();
    const n = timeline.notes[to];
    const sec = Math.min(1.2, (n.beats * 60) / (arrangement.tempoBpm * tempo));
    void playReference([{ hz: n.hz, sec }], preview.current.signal).catch(() => {});
  };

  // Space = play/pause, R = restart, ← → (or number pad 4/6) = previous/next note, Home/End = first/last
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = e.target instanceof HTMLElement ? e.target.tagName : "";
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag) || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowRight" || e.code === "Numpad6") {
        e.preventDefault();
        step(1);
      } else if (e.key === "ArrowLeft" || e.code === "Numpad4") {
        e.preventDefault();
        step(-1);
      } else if (e.key === "Home" || e.code === "Numpad7") {
        e.preventDefault();
        step(-timeline.notes.length);
      } else if (e.key === "End" || e.code === "Numpad1") {
        e.preventDefault();
        step(timeline.notes.length);
      }
      if (tag === "BUTTON") return; // Space/R on a focused button keep their normal meaning
      if (e.code === "Space") {
        e.preventDefault();
        void togglePlay();
      }
      if (e.key === "r") restart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Background tabs throttle timers, which would make the scheduler stutter: pause instead.
  useEffect(() => {
    const onHide = () => {
      if (document.hidden && transport.current?.playbackState === "playing") transport.current.pause();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  // Reset display when range changes while stopped.
  useEffect(() => {
    if (transport.current?.playbackState !== "playing") showBeat(range.startBeat);
  }, [range, showBeat]);

  const shown = pos.current ?? pos.upcoming;
  const note = shown !== null ? timeline.notes[shown] : null;
  const prevNote = shown !== null && shown > 0 ? timeline.notes[shown - 1] : null;
  const next = pos.current !== null ? (pos.upcoming !== null ? timeline.notes[pos.upcoming] : null) : shown !== null && shown + 1 < timeline.notes.length ? timeline.notes[shown + 1] : null;
  const resting = pos.current === null && state === "playing";
  const totalSec = ((range.endBeat - range.startBeat) * 60) / (arrangement.tempoBpm * tempo);

  return (
    <div className="space-y-5">
      {/* Now playing */}
      <div className="parchment p-4 sm:p-6">
        <div className="grid gap-4 md:grid-cols-[1fr_200px] md:items-center">
          <div>
            <div className="flex items-baseline justify-between">
              <p className="text-[11px] uppercase tracking-[0.25em] text-ink-500">
                {note ? `Note ${note.index + 1} of ${timeline.notes.length} · ${timeline.sections[note.formIndex].label}` : "—"}
              </p>
              {resting && <p className="text-xs italic text-ink-500">rest…</p>}
            </div>
            <div className={`transition-opacity ${resting ? "opacity-55" : ""}`}>
              <OcarinaDiagram pitch={note?.pitch ?? null} previousPitch={prevNote?.pitch ?? null} animationKey={note?.index} />
            </div>
          </div>
          <div className="flex flex-row items-center gap-4 md:flex-col md:items-stretch">
            <div className="text-center">
              <p className="font-display text-6xl leading-none text-ink-900">{note ? displayPitch(note.pitch, { octave: false }) : "—"}</p>
              <p className="mt-1 text-xs text-ink-500">{note ? `${note.pitch} · ${Math.round(note.hz)} Hz` : ""}</p>
            </div>
            <div className="flex-1 border-t border-ink-500/20 pt-3 md:flex-none">
              <p className="text-[11px] uppercase tracking-[0.2em] text-ink-500">Up next</p>
              {next ? (
                <div className="flex items-center gap-2">
                  <div className="w-28 opacity-80">
                    <OcarinaDiagram pitch={next.pitch} variant="compact" />
                  </div>
                  <span className="font-serif text-2xl italic text-leaf-500">{displayPitch(next.pitch, { octave: false })}</span>
                </div>
              ) : (
                <p className="text-sm text-ink-500">End of {section < 0 ? "song" : "phrase"}</p>
              )}
            </div>
          </div>
        </div>

        {/* progress */}
        <div className="mt-4 flex items-center gap-3 text-xs tabular-nums text-ink-700">
          <span ref={clock}>0:00</span>
          <div className="relative h-1.5 flex-1 bg-ink-900/10">
            <div ref={bar} className="absolute inset-y-0 left-0" style={{ width: "0%", background: accent }} />
          </div>
          <span>{formatClock(totalSec)}</span>
        </div>
      </div>

      {/* Transport */}
      <div className="panel flex flex-wrap items-center gap-x-5 gap-y-3 p-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => step(-1)}
            aria-label="Previous note"
            title="Previous note (←)"
            className="grid size-10 place-items-center rounded-full border border-gold-300/40 text-gold-200 hover:bg-gold-300/10"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="currentColor"><rect x="5" y="5" width="2.5" height="14" /><path d="M19 5v14L8.5 12z" /></svg>
          </button>
          <button
            onClick={togglePlay}
            aria-label={state === "playing" ? "Pause" : "Play"}
            className="grid size-12 place-items-center rounded-full bg-gradient-to-b from-gold-300 to-gold-500 text-forest-950 shadow-[0_8px_24px_-8px_rgb(214_178_90/0.8)] transition hover:brightness-110"
          >
            {state === "playing" ? (
              <svg viewBox="0 0 24 24" className="size-5" fill="currentColor"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" className="ml-0.5 size-5" fill="currentColor"><path d="M7 4.5v15l13-7.5z" /></svg>
            )}
          </button>
          <button
            onClick={restart}
            aria-label="Restart"
            className="grid size-10 place-items-center rounded-full border border-gold-300/40 text-gold-200 hover:bg-gold-300/10"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" /></svg>
          </button>
          <button
            onClick={() => step(1)}
            aria-label="Next note"
            title="Next note (→)"
            className="grid size-10 place-items-center rounded-full border border-gold-300/40 text-gold-200 hover:bg-gold-300/10"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="currentColor"><rect x="16.5" y="5" width="2.5" height="14" /><path d="M5 5v14l10.5-7z" /></svg>
          </button>
        </div>

        <Field label="Tempo">
          <div className="inline-flex border border-gold-500/30">
            {TEMPOS.map((t) => (
              <button
                key={t}
                onClick={() => setTempo(t)}
                aria-pressed={tempo === t}
                className={`px-3 py-1.5 text-xs tabular-nums ${tempo === t ? "bg-gold-300/15 text-gold-200" : "text-parchment-200/65 hover:text-parchment-50"}`}
              >
                {t * 100}%
              </button>
            ))}
          </div>
          <span className="ml-2 text-xs tabular-nums text-parchment-300/60">{Math.round(arrangement.tempoBpm * tempo)} bpm</span>
        </Field>

        <Field label="Play">
          <select
            value={section}
            onChange={(e) => setSection(Number(e.target.value))}
            className="border border-gold-500/30 bg-forest-900 px-2 py-1.5 text-xs text-parchment-100"
          >
            <option value={-1}>Whole {arrangement.kind === "full" ? "arrangement" : "sequence"}</option>
            {timeline.sections.map((s) => (
              <option key={s.formIndex} value={s.formIndex}>
                {s.label} ({s.noteRange[1] - s.noteRange[0]} notes{timeline.sections.filter((x) => x.phraseId === s.phraseId).length > 1 ? `, #${timeline.sections.filter((x, i) => x.phraseId === s.phraseId && i <= s.formIndex).length}` : ""})
              </option>
            ))}
          </select>
        </Field>

        <Toggle label="Loop" on={loop} onChange={setLoop} />
        <Toggle label="Metronome" on={metronome} onChange={setMetronome} />
      </div>

      {audioError && <p className="text-sm text-red-300">{audioError}</p>}

      {/* Score / fingerings */}
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div role="tablist" className="inline-flex border border-gold-500/30">
            {(["score", "fingerings"] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`whitespace-nowrap px-3 py-1.5 font-display text-[11px] tracking-widest ${view === v ? "bg-gold-300/15 text-gold-200" : "text-parchment-200/65"}`}
              >
                {v === "score" ? "Notation" : "Fingering chart"}
              </button>
            ))}
          </div>
          <p className="hidden text-right text-[11px] text-parchment-300/55 sm:block">Tap a note to jump · ← → step · Space play/pause · R restart</p>
        </div>
        {view === "score" ? (
          <div className="parchment p-3 sm:p-5">
            <Score timeline={timeline} timeSignature={arrangement.timeSignature} current={shown} onSelect={selectNote} accent={accent} />
            <p className="mt-2 text-[11px] text-ink-500">
              Treble clef, written an octave below sounding pitch (standard for Alto C ocarina).
            </p>
          </div>
        ) : (
          <FingeringStrip timeline={timeline} arrangement={arrangement} current={shown} onSelect={selectNote} accent={accent} />
        )}
      </div>

      <p className="text-xs text-parchment-300/50">
        Length {formatDuration(totalSec)} at this tempo. Synthetic ocarina voice — a learning reference, not the game soundtrack.
      </p>
    </div>
  );
}

function formatClock(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] uppercase tracking-[0.18em] text-parchment-300/60">{label}</span>
      {children}
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      aria-pressed={on}
      className={`flex items-center gap-2 border px-3 py-1.5 text-xs transition ${
        on ? "border-gold-300/70 bg-gold-300/15 text-gold-200" : "border-gold-500/25 text-parchment-200/65 hover:text-parchment-50"
      }`}
    >
      <span className={`size-2 rounded-full ${on ? "bg-gold-300" : "bg-parchment-300/30"}`} />
      {label}
    </button>
  );
}
