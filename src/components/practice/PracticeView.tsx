"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Arrangement, SongId } from "@/engine/music/schema";
import { buildTimeline } from "@/engine/music/timeline";
import { displayPitch } from "@/engine/music/pitch";
import { getFingering, HOLE_LABEL, transition } from "@/engine/fingering/engine";
import { playReference } from "@/engine/audio/transport";
import { PracticeSession, toPracticeNotes, type Difficulty, type Feedback } from "@/engine/practice/session";
import { usePracticeSettings } from "@/lib/practiceSettings";
import { recordPractice } from "@/lib/progress";
import { useMic } from "@/lib/useMic";
import { OcarinaDiagram } from "../OcarinaDiagram";
import { MicSetup } from "./MicSetup";
import { HoldRing, TuningMeter } from "./TuningMeter";

const DIFFICULTIES: { id: Difficulty; label: string; desc: string }[] = [
  { id: "beginner", label: "Beginner", desc: "One note at a time. Hear it, see it, play it — unlimited retries." },
  { id: "intermediate", label: "Intermediate", desc: "Short groups of 2–4 notes. Hear the group, then play it back." },
  { id: "advanced", label: "Advanced", desc: "Whole phrases without stopping. Mistakes are counted, not blocked." },
];

const TEMPOS = [0.5, 0.75, 1];

export function PracticeView({
  songId,
  mode,
  arrangement,
  accent,
}: {
  songId: SongId;
  mode: "game" | "full";
  arrangement: Arrangement;
  accent: string;
}) {
  const timeline = useMemo(() => buildTimeline(arrangement), [arrangement]);
  const settings = usePracticeSettings();
  const mic = useMic(settings.noiseGate);

  const [difficulty, setDifficulty] = useState<Difficulty>("beginner");
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(timeline.sections.length - 1);
  const [memory, setMemory] = useState(false);
  const [tempo, setTempo] = useState(0.75);

  const session = useRef<PracticeSession | null>(null);
  const [snap, setSnap] = useState<PracticeSession["state"] | null>(null);
  const [hearing, setHearing] = useState(false);
  const [peek, setPeek] = useState(false);
  const [result, setResult] = useState<ReturnType<PracticeSession["summary"]> | null>(null);
  const abort = useRef<AbortController | null>(null);
  /** True while the example plays: the mic would otherwise hear the app itself. */
  const hearingRef = useRef(false);

  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  const fullScope = lo === 0 && hi === timeline.sections.length - 1;

  const sync = () => session.current && setSnap(session.current.state);

  // Microphone frames → session
  useEffect(
    () =>
      mic.onFrame((f) => {
        const s = session.current;
        if (s && !hearingRef.current && s.push(f)) setSnap(s.state);
      }),
    [mic],
  );

  /** Play the current chunk (or note), then start listening. */
  const hear = useCallback(
    async (thenListen: boolean) => {
      const s = session.current;
      if (!s) return;
      const ch = s.currentChunk;
      if (!ch) return;
      abort.current?.abort();
      const ac = new AbortController();
      abort.current = ac;
      setHearing(true);
      hearingRef.current = true;
      const spb = 60 / (arrangement.tempoBpm * tempo);
      const ref = s.notes.slice(ch[0], ch[1]).map((n) => {
        const beats = timeline.notes[n.index].beats;
        return { hz: n.hz, sec: s.opts.difficulty === "beginner" ? Math.max(0.7, beats * spb) : beats * spb };
      });
      await playReference(ref, ac.signal);
      hearingRef.current = false;
      if (ac.signal.aborted) return;
      setHearing(false);
      if (thenListen) {
        s.beginPlay(performance.now());
        sync();
      }
    },
    [arrangement.tempoBpm, tempo, timeline],
  );

  // Auto-play the reference whenever a new chunk starts (beginner / intermediate).
  const phase = snap?.phase;
  const chunk = snap?.chunk;
  useEffect(() => {
    const s = session.current;
    if (!s || phase !== "listen" || s.opts.difficulty === "advanced") return;
    const id = setTimeout(() => void hear(true), s.state.cursor === 0 ? 250 : 650);
    return () => clearTimeout(id);
  }, [phase, chunk, hear]);

  // Finished → save progress once.
  useEffect(() => {
    const s = session.current;
    if (!s || phase !== "done" || result) return;
    const sum = s.summary();
    setResult(sum);
    recordPractice(songId, {
      seconds: sum.playedMs / 1000,
      notesAttempted: sum.attempted,
      notesCorrect: sum.correct,
      phrases: sum.sections.map((x) => ({ key: `${mode}:${x.phraseId}`, attempted: x.attempted, correct: x.correct, completed: x.completed })),
      songCompleted: s.opts.difficulty === "advanced" && fullScope && sum.accuracy >= 0.8,
    });
  }, [phase, result, songId, mode, fullScope]);

  useEffect(() => () => abort.current?.abort(), []);

  async function start(level: Difficulty = difficulty) {
    if (!(await mic.start())) return;
    const notes = toPracticeNotes(
      timeline.notes.filter((n) => n.formIndex >= lo && n.formIndex <= hi),
      (n) => n.formIndex,
    );
    session.current = new PracticeSession(notes, {
      difficulty: level,
      toleranceCents: settings.toleranceCents,
      tuningCents: settings.tuningCents,
    });
    setResult(null);
    setPeek(false);
    sync();
  }

  function stop() {
    abort.current?.abort();
    setHearing(false);
    const s = session.current;
    // Save what was done so far if anything was played.
    if (s && s.state.phase !== "done" && s.summary().attempted > 0) {
      const sum = s.summary();
      recordPractice(songId, {
        seconds: sum.playedMs / 1000,
        notesAttempted: sum.attempted,
        notesCorrect: sum.correct,
        phrases: sum.sections.map((x) => ({ key: `${mode}:${x.phraseId}`, attempted: x.attempted, correct: x.correct, completed: x.completed })),
        songCompleted: false,
      });
    }
    session.current = null;
    setSnap(null);
    setResult(null);
  }

  // ── setup screen ──────────────────────────────────────────
  if (!snap) {
    return (
      <div className="space-y-5">
        <MicSetup mic={mic} settings={settings} />

        <div className="panel space-y-5 p-5 sm:p-6">
          <div>
            <h2 className="font-display text-sm tracking-widest text-gold-200">Difficulty</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDifficulty(d.id)}
                  aria-pressed={difficulty === d.id}
                  className={`border p-3 text-left transition ${
                    difficulty === d.id ? "border-gold-300 bg-gold-300/10" : "border-gold-500/20 hover:border-gold-400/50"
                  }`}
                >
                  <p className="font-display text-sm text-parchment-50">{d.label}</p>
                  <p className="mt-1 text-xs text-parchment-200/65">{d.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
            <label className="block text-xs">
              <span className="mb-1 block uppercase tracking-[0.16em] text-parchment-300/60">From</span>
              <select value={from} onChange={(e) => setFrom(Number(e.target.value))} className="border border-gold-500/30 bg-forest-900 px-2 py-1.5 text-sm">
                {timeline.sections.map((s) => (
                  <option key={s.formIndex} value={s.formIndex}>{sectionName(timeline.sections, s.formIndex)}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              <span className="mb-1 block uppercase tracking-[0.16em] text-parchment-300/60">To</span>
              <select value={to} onChange={(e) => setTo(Number(e.target.value))} className="border border-gold-500/30 bg-forest-900 px-2 py-1.5 text-sm">
                {timeline.sections.map((s) => (
                  <option key={s.formIndex} value={s.formIndex}>{sectionName(timeline.sections, s.formIndex)}</option>
                ))}
              </select>
            </label>
            <div className="text-xs">
              <span className="mb-1 block uppercase tracking-[0.16em] text-parchment-300/60">Example tempo</span>
              <div className="inline-flex border border-gold-500/30">
                {TEMPOS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTempo(t)}
                    aria-pressed={tempo === t}
                    className={`px-3 py-1.5 tabular-nums ${tempo === t ? "bg-gold-300/15 text-gold-200" : "text-parchment-200/65"}`}
                  >
                    {t * 100}%
                  </button>
                ))}
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-parchment-200/80">
              <input type="checkbox" checked={memory} onChange={(e) => setMemory(e.target.checked)} className="accent-[#d6b25a]" />
              Play from memory (hide fingering &amp; note names)
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() => void start()}
              disabled={mic.status === "starting"}
              className="bg-gradient-to-b from-gold-300 to-gold-500 px-6 py-3 font-display text-sm tracking-widest text-forest-950 shadow-[0_8px_30px_-8px_rgb(214_178_90/0.7)] hover:brightness-110 disabled:opacity-60"
            >
              Start practice
            </button>
            <span className="text-xs text-parchment-300/60">
              {timeline.notes.filter((n) => n.formIndex >= lo && n.formIndex <= hi).length} notes ·{" "}
              {fullScope ? "whole " + (mode === "game" ? "sequence" : "arrangement") : `${hi - lo + 1} phrase${hi > lo ? "s" : ""}`}
              {!settings.calibratedAt && " · tip: calibrate first for best results"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ── session screen ────────────────────────────────────────
  const s = session.current!;
  const cur = snap.phase === "done" ? null : s.notes[snap.cursor];
  const prev = snap.cursor > 0 ? s.notes[snap.cursor - 1] : null;
  const fb = snap.feedback;
  const listening = snap.phase === "play";
  const hide = memory && !peek;

  return (
    <div className="space-y-5">
      <div className="panel flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
        <span className="font-display tracking-widest text-gold-200">{DIFFICULTIES.find((d) => d.id === difficulty)!.label}</span>
        {difficulty === "beginner" && cur && (
          <ol className="flex items-center gap-1 text-[11px] uppercase tracking-wider">
            {["Listen", "Look", "Play", "Check"].map((label, i) => {
              const activeStep = hearing ? 0 : listening ? (fb.kind === "listening" || fb.kind === "silent" ? 2 : 3) : 1;
              return (
                <li key={label} className={`px-2 py-0.5 ${i === activeStep ? "bg-gold-300/20 text-gold-200" : i < activeStep ? "text-leaf-400" : "text-parchment-300/40"}`}>
                  {i + 1}. {label}
                </li>
              );
            })}
          </ol>
        )}
        <span className={`ml-auto flex items-center gap-2 text-xs ${listening ? "text-leaf-400" : "text-parchment-300/60"}`}>
          <span className={`size-2 rounded-full ${listening ? "animate-pulse bg-leaf-400" : "bg-parchment-300/30"}`} />
          {hearing ? "Playing example — listen" : listening ? "Listening to you" : snap.phase === "done" ? "Finished" : "Ready"}
        </span>
      </div>

      {snap.phase !== "done" && cur && (
        <div className="parchment p-4 sm:p-6">
          <div className="grid gap-5 md:grid-cols-[1.3fr_1fr] md:items-center">
            <div className="relative">
              {hide ? (
                <div className="grid aspect-[1120/600] place-items-center border border-dashed border-ink-500/30 text-center text-sm text-ink-500">
                  <div>
                    Playing from memory
                    <button onClick={() => setPeek(true)} className="mt-2 block w-full text-xs text-gold-600 underline">
                      Peek at the fingering
                    </button>
                  </div>
                </div>
              ) : (
                <OcarinaDiagram pitch={cur.pitch} previousPitch={prev?.pitch ?? null} animationKey={snap.cursor} />
              )}
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.25em] text-ink-500">
                    Note {snap.cursor + 1} of {s.notes.length}
                  </p>
                  <p className="font-display text-6xl leading-none text-ink-900">{hide ? "?" : displayPitch(cur.pitch, { octave: false })}</p>
                </div>
                <div className="ml-auto text-ink-900">
                  <HoldRing value={listening && fb.kind === "correct" ? fb.hold : 0} />
                </div>
              </div>
              <TuningMeter
                cents={fb.kind === "correct" || fb.kind === "sharp" || fb.kind === "flat" ? (fb.cents ?? null) : null}
                tolerance={settings.toleranceCents}
                active={listening}
              />
              <FeedbackMessage fb={fb} target={cur.pitch} listening={listening} hearing={hearing} difficulty={difficulty} hide={hide} />
            </div>
          </div>
        </div>
      )}

      {snap.phase === "done" && result && (
        <div className="parchment p-5 sm:p-6">
          <h2 className="font-display text-2xl text-ink-900">
            {result.accuracy >= 0.9 ? "Beautifully played!" : result.accuracy >= 0.7 ? "Well done!" : "Keep practicing — it's coming!"}
          </h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Accuracy", `${Math.round(result.accuracy * 100)}%`],
              ["Notes right", `${result.correct} / ${s.notes.length}`],
              ["Wrong notes", result.mistakes],
              ["Skipped", result.missed],
            ].map(([k, v]) => (
              <div key={k as string} className="border border-ink-500/20 bg-white/40 px-3 py-2">
                <dt className="text-[11px] uppercase tracking-wider text-ink-500">{k}</dt>
                <dd className="font-display text-2xl text-ink-900">{v}</dd>
              </div>
            ))}
          </dl>
          <table className="mt-4 w-full text-sm text-ink-700">
            <tbody>
              {result.sections.map((x) => (
                <tr key={x.section} className="border-b border-ink-500/15">
                  <td className="py-1.5">{sectionName(timeline.sections, x.section)}</td>
                  <td className="py-1.5 text-right tabular-nums">{Math.round(x.accuracy * 100)}%</td>
                  <td className="w-28 py-1.5 text-right">{x.completed ? <span className="text-leaf-500">✓ completed</span> : <span className="text-ink-500">needs work</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {difficulty === "advanced" && fullScope && result.accuracy >= 0.8 && (
            <p className="mt-3 font-display text-leaf-500">Song mastered — marked complete in your progress.</p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={() => void start(difficulty)} className="bg-forest-700 px-5 py-2 font-display text-xs tracking-widest text-parchment-50 hover:bg-forest-600">
              Practice again
            </button>
            {difficulty !== "advanced" && (
              <button
                onClick={() => {
                  const next = difficulty === "beginner" ? "intermediate" : "advanced";
                  setDifficulty(next);
                  void start(next);
                }}
                className="border border-ink-500/40 px-5 py-2 font-display text-xs tracking-widest text-ink-900 hover:bg-ink-900/5"
              >
                Try {difficulty === "beginner" ? "Intermediate" : "Advanced"} next
              </button>
            )}
            <button onClick={stop} className="px-3 py-2 text-xs text-ink-500 underline">
              Back to setup
            </button>
          </div>
        </div>
      )}

      {/* note-by-note progress */}
      <div className="flex flex-wrap gap-1.5" aria-label="Progress">
        {s.notes.map((n, i) => {
          const r = snap.results[i];
          const isCur = i === snap.cursor && snap.phase !== "done";
          const inChunk = s.currentChunk && i >= s.currentChunk[0] && i < s.currentChunk[1];
          return (
            <span
              key={i}
              title={`${displayPitch(n.pitch)}${r.mistakes ? ` · ${r.mistakes} wrong` : ""}`}
              className={`relative grid h-8 min-w-8 place-items-center border px-1 font-serif text-sm italic ${
                r.status === "correct"
                  ? "border-leaf-500/60 bg-leaf-500/20 text-leaf-400"
                  : r.status === "missed"
                    ? "border-red-300/50 bg-red-400/10 text-red-200"
                    : isCur
                      ? "border-gold-300 bg-gold-300/15 text-gold-200"
                      : inChunk
                        ? "border-gold-500/40 text-parchment-200/80"
                        : "border-gold-500/15 text-parchment-300/40"
              }`}
              style={isCur ? { boxShadow: `0 0 0 1px ${accent}` } : undefined}
            >
              {hide && r.status === "pending" ? "·" : displayPitch(n.pitch, { octave: false })}
              {r.mistakes > 0 && <span className="absolute -right-1 -top-1 size-2 rounded-full bg-gold-400" />}
            </span>
          );
        })}
      </div>

      {snap.phase !== "done" && (
        <div className="flex flex-wrap items-center gap-2">
          {snap.phase === "listen" && difficulty === "advanced" && (
            <>
              <button
                onClick={() => void hear(true)}
                disabled={hearing}
                className="bg-gradient-to-b from-gold-300 to-gold-500 px-5 py-2 font-display text-xs tracking-widest text-forest-950 disabled:opacity-60"
              >
                Hear it, then play
              </button>
              <button
                onClick={() => {
                  s.beginPlay(performance.now());
                  sync();
                }}
                className="border border-gold-300/50 px-5 py-2 font-display text-xs tracking-widest text-gold-200 hover:bg-gold-300/10"
              >
                I&apos;m ready — start listening
              </button>
            </>
          )}
          {(snap.phase === "play" || (snap.phase === "listen" && difficulty !== "advanced")) && (
            <button
              onClick={() => void hear(true)}
              disabled={hearing}
              className="border border-gold-300/50 px-4 py-2 text-xs text-gold-200 hover:bg-gold-300/10 disabled:opacity-50"
            >
              ♪ Hear again
            </button>
          )}
          <button
            onClick={() => {
              abort.current?.abort();
              setHearing(false);
              s.skip(performance.now());
              sync();
            }}
            className="border border-gold-500/25 px-4 py-2 text-xs text-parchment-200/75 hover:text-parchment-50"
          >
            Skip note
          </button>
          <button
            onClick={() => {
              abort.current?.abort();
              setHearing(false);
              s.retryChunk(performance.now());
              sync();
            }}
            className="border border-gold-500/25 px-4 py-2 text-xs text-parchment-200/75 hover:text-parchment-50"
          >
            {difficulty === "advanced" ? "Start over" : "Restart group"}
          </button>
          <button onClick={stop} className="ml-auto px-3 py-2 text-xs text-parchment-300/60 underline hover:text-parchment-50">
            End session
          </button>
        </div>
      )}
    </div>
  );
}

function sectionName(sections: { label: string; phraseId: string; formIndex: number }[], i: number) {
  const s = sections[i];
  const same = sections.filter((x) => x.phraseId === s.phraseId);
  return same.length > 1 ? `${s.label} (${same.indexOf(s) + 1})` : s.label;
}

function FeedbackMessage({
  fb,
  target,
  listening,
  hearing,
  difficulty,
  hide,
}: {
  fb: Feedback;
  target: string;
  listening: boolean;
  hearing: boolean;
  difficulty: Difficulty;
  hide: boolean;
}) {
  const t = hide ? "the next note" : displayPitch(target);
  let tone = "text-ink-700";
  let msg: React.ReactNode;
  let hint: React.ReactNode = null;

  if (hearing) msg = "Listen to the example…";
  else if (!listening) msg = difficulty === "advanced" ? "Hear the phrase first, or start when you're ready." : "Get ready…";
  else
    switch (fb.kind) {
      case "listening":
        msg = `Play ${t}`;
        break;
      case "silent":
        tone = "text-gold-600";
        msg = "No sound detected";
        hint = "Is the microphone on and close enough? Play a little louder, or recalibrate.";
        break;
      case "correct":
        tone = "text-leaf-500";
        if (fb.rearticulate) {
          msg = "Same note again";
          hint = "Re-tongue it (“too”) so the new note starts cleanly.";
        } else msg = fb.hold >= 1 ? "Correct!" : "That's it — hold it…";
        break;
      case "sharp":
        tone = "text-gold-600";
        msg = `A little sharp (+${Math.round(fb.cents ?? 0)}¢)`;
        hint = "Blow a bit more gently.";
        break;
      case "flat":
        tone = "text-gold-600";
        msg = `A little flat (${Math.round(fb.cents ?? 0)}¢)`;
        hint = "Blow a bit more firmly, and check each hole is fully sealed.";
        break;
      case "octave":
        tone = "text-red-700";
        msg = `Right note name, wrong octave (heard ${displayPitch(fb.heard ?? target)})`;
        hint = "Check the thumb holes and your breath strength.";
        break;
      case "wrong": {
        tone = "text-red-700";
        msg = `That's ${displayPitch(fb.heard ?? target)} — ${hide ? "not quite" : `looking for ${t}`}`;
        const from = fb.heard ? getFingering(fb.heard) : null;
        const to = getFingering(target);
        if (from && to && !hide) {
          const ch = transition(from, to);
          const parts = [
            ch.press.length ? `cover ${ch.press.map((h) => HOLE_LABEL[h].toLowerCase()).join(", ")}` : "",
            ch.lift.length ? `lift ${ch.lift.map((h) => HOLE_LABEL[h].toLowerCase()).join(", ")}` : "",
          ].filter(Boolean);
          if (parts.length) hint = `Try: ${parts.join("; ")}.`;
        }
        break;
      }
    }

  return (
    <div aria-live="polite" className="min-h-14">
      <p className={`font-display text-xl ${tone}`}>{msg}</p>
      {hint && <p className="mt-0.5 text-sm text-ink-700">{hint}</p>}
    </div>
  );
}
