"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Song, SongId } from "@/engine/music/schema";
import { alignRhythm, applyRhythm, DURATIONS, extractRhythm, tapsToBeats, type RhythmOverride } from "@/engine/music/rhythm";
import { buildTimeline } from "@/engine/music/timeline";
import { displayPitch } from "@/engine/music/pitch";
import { beatsPerBar, fullRange } from "@/engine/audio/schedule";
import { Transport } from "@/engine/audio/transport";
import { bundledSong, removeRhythm, saveRhythm, useRhythms, withHistory, type RhythmMode } from "@/lib/arrangements";

const TIME_SIGS: [number, number][] = [[2, 4], [3, 4], [4, 4], [6, 8]];
const RESTS = [0, 0.5, 1, 1.5, 2, 3, 4];

/**
 * Set the real rhythm of a game sequence or full arrangement: choose each
 * note's length (and an optional rest after it), or tap along while listening.
 */
export function RhythmEditor({ song, mode = "game", onClose }: { song: Song; mode?: RhythmMode; onClose: () => void }) {
  const base = bundledSong(song.id)!.arrangements[mode];
  const saved = useRhythms(mode)[song.id as SongId];
  // Start from what is playing now (the saved rhythm already fitted to the current notes).
  const [draft, setDraft] = useState<RhythmOverride>(() => extractRhythm(song.arrangements[mode]));
  /** Phrases whose notes changed since the rhythm was saved. */
  const changed = useMemo(
    () => (saved ? alignRhythm(base, withHistory(song.id as SongId, mode, saved)).changed : []),
    [base, saved, song.id, mode],
  );
  const [taps, setTaps] = useState<number[] | null>(null);
  /** Phrase being tapped; null = the whole song (each phrase once). */
  const [tapPhrase, setTapPhrase] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const preview = useRef<Transport | null>(null);

  // Flat list of [phraseId, noteIndexInPhrase, pitch] in phrase order (each phrase once).
  const slots = useMemo(
    () =>
      base.phrases.flatMap((p) =>
        p.events.filter((e) => e.type === "note").map((e, i) => ({ phraseId: p.id, phraseLabel: p.label, i, pitch: (e as { pitch: string }).pitch })),
      ),
    [base],
  );

  const draftArr = useMemo(() => applyRhythm(base, draft, ""), [base, draft]);

  useEffect(() => () => preview.current?.dispose(), []);
  // Stop preview whenever the draft changes.
  useEffect(() => {
    preview.current?.stop();
  }, [draft]);

  const setNote = (phraseId: string, i: number, patch: Partial<{ beats: number; restAfter: number }>) =>
    setDraft((d) => ({
      ...d,
      phrases: { ...d.phrases, [phraseId]: d.phrases[phraseId].map((n, k) => (k === i ? { ...n, ...patch } : n)) },
    }));

  async function togglePreview() {
    if (preview.current?.playbackState === "playing") {
      preview.current.stop();
      return;
    }
    const tl = buildTimeline(draftArr);
    preview.current?.dispose();
    preview.current = new Transport(tl, {
      bpm: draft.tempoBpm,
      tempoFactor: 1,
      loop: false,
      metronome: true,
      beatsPerBar: beatsPerBar(draft.timeSignature),
      range: fullRange(tl),
    });
    preview.current.onStateChange((s) => setPreviewing(s === "playing"));
    await preview.current.play();
    const check = () => {
      if (preview.current?.checkFinished() === false && preview.current.playbackState === "playing") requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }

  const tapSlots = tapPhrase ? slots.filter((s) => s.phraseId === tapPhrase) : slots;
  const startTapping = (phraseId: string | null) => {
    setTapPhrase(phraseId);
    setTaps([]);
  };

  // Tap-along: one tap per note onset, plus a final tap to end the last note.
  const tap = () => {
    const now = performance.now();
    setTaps((t) => {
      const next = [...(t ?? []), now];
      if (next.length === tapSlots.length + 1) {
        const beats = tapsToBeats(next, draft.tempoBpm);
        setDraft((d) => {
          const phrases = { ...d.phrases };
          tapSlots.forEach((s, k) => {
            phrases[s.phraseId] = phrases[s.phraseId].map((n, i) => (i === s.i ? { beats: beats[k], restAfter: 0, pitch: s.pitch } : n));
          });
          return { ...d, phrases };
        });
        return null;
      }
      return next;
    });
  };

  useEffect(() => {
    if (!taps) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        tap();
      }
      if (e.key === "Escape") setTaps(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const totalBeats = buildTimeline(draftArr).totalBeats;
  const bars = totalBeats / beatsPerBar(draft.timeSignature);

  return (
    <div className="panel p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg text-parchment-50">Set the rhythm</h2>
          <p className="mt-1 max-w-xl text-sm text-parchment-200/70">
            Listen to the song {mode === "game" ? "in the game" : "(the game soundtrack or a recording)"}, then set how long each note lasts. Pitches don&apos;t change. Saved on this device and labelled as
            your own transcription.
          </p>
        </div>
        <button onClick={onClose} className="text-xs text-parchment-300/70 hover:text-parchment-50">
          Close ✕
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-4 text-xs">
        <label className="block">
          <span className="mb-1 block uppercase tracking-[0.16em] text-parchment-300/60">Time</span>
          <select
            value={draft.timeSignature.join("/")}
            onChange={(e) => setDraft((d) => ({ ...d, timeSignature: e.target.value.split("/").map(Number) as [number, number] }))}
            className="border border-gold-500/30 bg-forest-900 px-2 py-1.5 text-sm"
          >
            {TIME_SIGS.map((t) => (
              <option key={t.join("/")} value={t.join("/")}>{t.join("/")}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block uppercase tracking-[0.16em] text-parchment-300/60">Tempo (bpm)</span>
          <input
            type="number"
            min={30}
            max={240}
            value={draft.tempoBpm}
            onChange={(e) => setDraft((d) => ({ ...d, tempoBpm: Math.min(240, Math.max(30, Number(e.target.value) || 30)) }))}
            className="w-20 border border-gold-500/30 bg-forest-900 px-2 py-1.5 text-sm"
          />
        </label>
        <button
          onClick={togglePreview}
          className="border border-gold-300/50 px-3 py-1.5 text-sm text-gold-200 hover:bg-gold-300/10"
        >
          {previewing ? "■ Stop" : "▶ Preview"}
        </button>
        <button
          onClick={() => (taps ? setTaps(null) : startTapping(null))}
          className={`border px-3 py-1.5 text-sm ${taps ? "border-fairy-400 bg-fairy-500/15 text-fairy-300" : "border-gold-500/30 text-parchment-200/80 hover:text-parchment-50"}`}
        >
          {taps ? "Cancel tapping" : "Tap along (whole song)…"}
        </button>
        <span className="text-parchment-300/60">
          {bars % 1 === 0 ? `${bars} bars` : `${bars.toFixed(2)} bars — doesn't fill the last bar`}
        </span>
      </div>

      {taps && (
        <div className="mt-4 border border-fairy-400/40 bg-fairy-500/10 p-4 text-sm text-parchment-100">
          <p>
            Set the tempo above first. Then tap once per note, in time with the music —{" "}
            {tapPhrase ? `${tapSlots.length} notes of “${tapSlots[0]?.phraseLabel}”` : `${slots.length} notes (each phrase once)`} —
            and once more when the last note ends. Rests become part of the note before them; adjust those afterwards.
          </p>
          <div className="mt-3 flex items-center gap-4">
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                tap();
              }}
              className="grid size-20 place-items-center rounded-full bg-gradient-to-b from-fairy-300 to-fairy-500 font-display text-sm tracking-widest text-forest-950 active:scale-95"
            >
              TAP
            </button>
            <div>
              <p className="font-display text-2xl text-fairy-300">
                {taps.length < tapSlots.length ? displayPitch(tapSlots[taps.length].pitch) : "End"}
              </p>
              <p className="text-xs text-parchment-300/70">
                {taps.length} / {tapSlots.length + 1} taps · key T works too · Esc cancels
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 space-y-4">
        {base.phrases.map((p) => {
          const repeats = base.form?.filter((id) => id === p.id).length ?? 1;
          return (
            <div key={p.id}>
              <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="font-display text-xs tracking-[0.2em] text-parchment-300/70">
                  {p.label}
                  {repeats > 1 && <span className="ml-2 normal-case tracking-normal text-parchment-300/45">played {repeats}× — one rhythm for all</span>}
                </p>
                {changed.includes(p.id) && (
                  <span className="text-[11px] text-gold-300">Notes changed since you saved — check the new ones</span>
                )}
                {base.phrases.length > 1 && !taps && (
                  <button onClick={() => startTapping(p.id)} className="text-[11px] text-fairy-300 underline hover:text-fairy-200">
                    Tap this phrase
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {(draft.phrases[p.id] ?? []).map((n, i) => {
                  const pitch = slots.find((s) => s.phraseId === p.id && s.i === i)?.pitch ?? "";
                  return (
                    <div key={i} className="w-36 border border-gold-500/20 bg-black/20 p-2">
                      <p className="font-serif text-lg italic text-leaf-400">{displayPitch(pitch, { octave: false })}</p>
                      <select
                        aria-label={`Length of note ${i + 1}`}
                        value={n.beats}
                        onChange={(e) => setNote(p.id, i, { beats: Number(e.target.value) })}
                        className="mt-1 w-full border border-gold-500/25 bg-forest-900 px-1 py-1 text-xs"
                      >
                        {!DURATIONS.some((d) => d.beats === n.beats) && <option value={n.beats}>{n.beats} beats</option>}
                        {DURATIONS.map((d) => (
                          <option key={d.beats} value={d.beats}>{d.label}</option>
                        ))}
                      </select>
                      <select
                        aria-label={`Rest after note ${i + 1}`}
                        value={n.restAfter}
                        onChange={(e) => setNote(p.id, i, { restAfter: Number(e.target.value) })}
                        className="mt-1 w-full border border-gold-500/15 bg-forest-900/60 px-1 py-1 text-xs text-parchment-200/80"
                      >
                        {!RESTS.includes(n.restAfter) && <option value={n.restAfter}>rest {n.restAfter}</option>}
                        {RESTS.map((r) => (
                          <option key={r} value={r}>{r === 0 ? "no rest after" : `rest ${r} beat${r === 1 ? "" : "s"}`}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          onClick={() => {
            saveRhythm(song.id as SongId, { ...draft, updatedAt: Date.now() }, mode);
            onClose();
          }}
          className="bg-gradient-to-b from-gold-300 to-gold-500 px-5 py-2 font-display text-xs tracking-widest text-forest-950 hover:brightness-110"
        >
          Save rhythm
        </button>
        {saved && (
          <button
            onClick={() => {
              removeRhythm(song.id as SongId, mode);
              onClose();
            }}
            className="border border-red-300/40 px-4 py-2 text-xs text-red-200 hover:bg-red-300/10"
          >
            Remove my rhythm
          </button>
        )}
      </div>
    </div>
  );
}
