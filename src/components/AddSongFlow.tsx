"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Midi } from "@tonejs/midi";
import { midiTracks, parseMidi, readMidi } from "@/engine/import/midi";
import { bestTransposition, describeShift, fitArrangement, playableShare } from "@/engine/import/fit";
import type { ImportedMelody, MidiTrackInfo } from "@/engine/import/types";
import { displayPitch, midiToPitch } from "@/engine/music/pitch";
import { buildTimeline } from "@/engine/music/timeline";
import { addUserSong, createCollection, userSongHref, useUserLibrary, yourSongsHref } from "@/lib/userSongs";
import { Score } from "./Score";
import { TrackRoll, useTrackPreview, type PreviewSource } from "./TrackPreview";

/** One melodic track, read and scored for the ocarina. */
interface TrackChoice {
  info: MidiTrackInfo;
  melody: ImportedMelody;
  midis: number[];
  shift: number;
  share: number;
  chords: boolean;
  /** The track as the ocarina would play it, for the preview. */
  preview: PreviewSource;
}

const KEYS = [
  { v: "auto", label: "Auto (best fit)" },
  { v: "0", label: "As in the file" },
  { v: "12", label: "Up 1 octave" },
  { v: "-12", label: "Down 1 octave" },
  { v: "24", label: "Up 2 octaves" },
  { v: "-24", label: "Down 2 octaves" },
];
const NEW_COLLECTION = "__new__";

const btn = "border border-gold-300/50 px-4 py-2 font-display text-xs tracking-widest text-gold-200 transition hover:bg-gold-300/10";
const primary =
  "bg-gradient-to-b from-gold-300 to-gold-500 px-5 py-2 font-display text-xs tracking-widest text-forest-950 hover:brightness-110";
const field = "w-full border border-gold-500/30 bg-forest-900 px-2 py-1.5 text-sm text-parchment-50";

/**
 * Add a song from a MIDI file: choose the file, pick the track with the
 * melody, then name it and save. The file is read in the browser and the
 * song is kept on this device only.
 */
export function AddSongFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const lib = useUserLibrary();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fileName, setFileName] = useState("");
  const [midi, setMidi] = useState<Midi | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [track, setTrack] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [key, setKey] = useState("auto");
  const [bars, setBars] = useState(4);
  const [collection, setCollection] = useState(params.get("c") ?? "");
  const [newName, setNewName] = useState("");
  const player = useTrackPreview();
  const stopPlayer = player.stop;
  // Leaving the track step stops the preview.
  useEffect(() => {
    if (step !== 2) stopPlayer();
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const { tracks, drums } = useMemo(() => {
    if (!midi) return { tracks: [] as TrackChoice[], drums: 0 };
    const all = midiTracks(midi);
    const choices: TrackChoice[] = [];
    for (const info of all.filter((t) => !t.percussion)) {
      try {
        const melody = parseMidi(midi, info.index);
        const midis = melody.events.filter((e) => e.midi !== null).map((e) => e.midi!) as number[];
        const shift = bestTransposition(midis);
        const fitted = fitArrangement(melody, {
          sourceKind: "midi",
          fileName: "",
          complete: false,
          octaveShift: shift,
        }).arrangement;
        choices.push({
          info,
          melody,
          midis,
          shift,
          share: playableShare(midis, shift),
          chords: melody.warnings.some((w) => w.startsWith("Overlapping")),
          preview: {
            key: info.index,
            timeline: buildTimeline(fitted),
            bpm: fitted.tempoBpm,
            timeSignature: fitted.timeSignature,
          },
        });
      } catch {
        /* a track that can't be read is simply not offered */
      }
    }
    return {
      tracks: choices,
      drums: all.length - all.filter((t) => !t.percussion).length,
    };
  }, [midi]);

  const chosen = tracks.find((t) => t.info.index === track) ?? null;

  const result = useMemo(() => {
    if (!chosen) return null;
    try {
      return fitArrangement(chosen.melody, {
        sourceKind: "midi",
        fileName,
        complete: false,
        barsPerPhrase: bars,
        anyKey: true,
        octaveShift: key === "auto" ? undefined : Number(key),
      });
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [chosen, fileName, bars, key]);

  const timeline = useMemo(() => (result && !("error" in result) ? buildTimeline(result.arrangement) : null), [result]);

  async function onFile(file: File) {
    setError(null);
    const ext = file.name.toLowerCase().split(".").pop() ?? "";
    if (ext !== "mid" && ext !== "midi") {
      setError("Choose a MIDI file (.mid or .midi).");
      return;
    }
    try {
      const m = readMidi(new Uint8Array(await file.arrayBuffer()));
      const melodic = midiTracks(m).filter((t) => !t.percussion);
      if (!melodic.length) throw new Error("This MIDI file has no melody tracks, only drums or nothing at all.");
      setMidi(m);
      setFileName(file.name);
      setTitle((m.name || file.name.replace(/\.(mid|midi)$/i, "")).trim());
      setTrack(null);
      setKey("auto");
      setStep(2);
    } catch (e) {
      setError((e as Error).message.startsWith("This MIDI") ? (e as Error).message : "This file couldn't be read as MIDI.");
    }
  }

  // Default track: the one with the most playable notes.
  useEffect(() => {
    if (track !== null || !tracks.length) return;
    const best = tracks.reduce((a, b) => (b.share * b.midis.length > a.share * a.midis.length ? b : a));
    setTrack(best.info.index);
  }, [tracks, track]);

  function save() {
    if (!chosen || !result || "error" in result) return;
    try {
      let cid = collection || undefined;
      if (collection === NEW_COLLECTION) cid = createCollection(newName || "New collection");
      const id = addUserSong(
        {
          title: title.trim() || "Untitled song",
          arrangement: result.arrangement,
          fileName,
          trackName: chosen.info.name,
        },
        cid,
      );
      player.stop();
      router.push(userSongHref(id, "overview", cid));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const steps = ["Choose a file", "Pick the melody", "Name and save"];

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap items-center gap-2 text-xs" aria-label="Steps">
        {steps.map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3;
          const reachable = n === 1 || (n === 2 && midi) || (n === 3 && chosen);
          return (
            <li key={label} className="flex items-center gap-2">
              {i > 0 && <span className="text-parchment-300/40">›</span>}
              <button
                disabled={!reachable}
                onClick={() => setStep(n)}
                aria-current={step === n ? "step" : undefined}
                className={`border px-3 py-1.5 font-display tracking-widest ${
                  step === n
                    ? "border-gold-300 bg-gold-300/15 text-gold-200"
                    : "border-gold-500/25 text-parchment-200/70 disabled:opacity-40"
                }`}
              >
                {n} · {label}
              </button>
            </li>
          );
        })}
      </ol>

      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}

      {step === 1 && (
        <section className="panel p-5 sm:p-6">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-gold-400/50 bg-black/10 px-4 py-10 text-center text-sm text-gold-200 transition hover:bg-gold-300/5">
            <svg
              viewBox="0 0 24 24"
              className="size-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
            </svg>
            <span className="font-display tracking-widest">{midi ? `${fileName} · choose another file` : "Choose a MIDI file"}</span>
            <span className="text-xs text-parchment-300/60">.mid or .midi</span>
            <input
              type="file"
              accept=".mid,.midi,audio/midi,audio/x-midi"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
                e.target.value = "";
              }}
            />
          </label>
          <ul className="mt-4 space-y-1 text-sm text-parchment-200/70">
            <li>Use a file you own or are allowed to use. It&apos;s read in your browser and never uploaded.</li>
            <li>Simple melodies work best: the ocarina plays one note at a time, from A4 to F6.</li>
          </ul>
        </section>
      )}

      {step === 2 && midi && (
        <section className="panel p-5 sm:p-6">
          <h2 className="font-display text-lg text-parchment-50">Which track is the melody?</h2>
          <p className="mt-1 text-sm text-parchment-200/70">
            The track that fits the ocarina best is selected. Press ▶ to hear a track, or click anywhere on its notes to play from there.
            {drums > 0 && ` ${drums} drum track${drums > 1 ? "s are" : " is"} hidden.`}
          </p>
          <div role="radiogroup" aria-label="Tracks" className="mt-4 space-y-2">
            {tracks.map((t) => {
              const pct = Math.round(t.share * 100);
              const isPlaying = player.playing && player.active === t.info.index;
              const tone =
                pct >= 95
                  ? "text-leaf-400 border-leaf-400/40"
                  : pct >= 70
                    ? "text-gold-200 border-gold-300/40"
                    : "text-red-300 border-red-300/40";
              return (
                <div
                  key={t.info.index}
                  className={`space-y-2 border px-3 py-2.5 ${track === t.info.index ? "border-gold-300/70 bg-gold-300/10" : "border-gold-500/20 bg-black/15"}`}
                >
                  <div className="flex items-center gap-3">
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                      <input
                        type="radio"
                        name="track"
                        checked={track === t.info.index}
                        onChange={() => setTrack(t.info.index)}
                        className="accent-gold-300"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-parchment-50">{t.info.name}</span>
                        <span className="block text-xs text-parchment-300/65">
                          {t.info.noteCount} notes · {displayPitch(midiToPitch(t.info.lowest))}–{displayPitch(midiToPitch(t.info.highest))}
                          {t.shift !== 0 && ` · plays ${describeShift(t.shift)}`}
                          {t.chords && " · has chords"}
                        </span>
                      </span>
                    </label>
                    <span
                      className={`shrink-0 border px-2 py-0.5 text-xs tabular-nums ${tone}`}
                      title="Notes the ocarina can play after the best transposition"
                    >
                      {pct}% playable
                    </span>
                    <button
                      onClick={() => player.toggle(t.preview)}
                      aria-label={`${isPlaying ? "Pause" : "Play"} ${t.info.name}`}
                      className="shrink-0 border border-gold-500/30 px-2.5 py-1 text-gold-200 hover:bg-gold-300/10"
                    >
                      {isPlaying ? "❚❚" : "▶"}
                    </button>
                  </div>
                  <TrackRoll
                    src={t.preview}
                    label={t.info.name}
                    beat={player.beat}
                    active={player.active === t.info.index}
                    playing={isPlaying}
                    onSeek={(b) => player.playFrom(t.preview, b)}
                  />
                </div>
              );
            })}
          </div>
          {chosen?.chords && (
            <p className="mt-3 text-sm text-parchment-200/70">This track plays chords. Only the top note of each chord is kept.</p>
          )}
          <div className="mt-5 flex justify-between gap-3">
            <button
              onClick={() => {
                player.stop();
                setStep(1);
              }}
              className={btn}
            >
              Back
            </button>
            <button
              onClick={() => {
                player.stop();
                setStep(3);
              }}
              disabled={!chosen}
              className={primary}
            >
              Continue
            </button>
          </div>
        </section>
      )}

      {step === 3 && chosen && result && (
        <section className="panel space-y-5 p-5 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Opt label="Title">
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className={field} />
            </Opt>
            <Opt label="Collection">
              <select value={collection} onChange={(e) => setCollection(e.target.value)} className={field}>
                <option value="">None</option>
                {lib.collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value={NEW_COLLECTION}>New collection…</option>
              </select>
            </Opt>
            <Opt label="Key">
              <select value={key} onChange={(e) => setKey(e.target.value)} className={field}>
                {KEYS.map((k) => (
                  <option key={k.v} value={k.v}>
                    {k.label}
                  </option>
                ))}
              </select>
            </Opt>
            <Opt label="Phrase length">
              <select value={bars} onChange={(e) => setBars(Number(e.target.value))} className={field}>
                {[1, 2, 4, 8].map((b) => (
                  <option key={b} value={b}>
                    {b} bar{b > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </Opt>
            {collection === NEW_COLLECTION && (
              <Opt label="New collection name">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Christmas songs"
                  maxLength={60}
                  className={field}
                />
              </Opt>
            )}
          </div>

          {"error" in result ? (
            <p className="text-sm text-red-300">{result.error}</p>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                {[
                  ["Notes", result.report.noteCount],
                  ["Bars · phrases", `${result.report.barCount} · ${result.report.phraseCount}`],
                  ["Range", `${displayPitch(result.report.lowest)}–${displayPitch(result.report.highest)}`],
                  ["Tempo · time", `${chosen.melody.bpm} bpm · ${chosen.melody.timeSignature.join("/")}`],
                ].map(([k, v]) => (
                  <div key={k as string} className="border border-gold-500/15 bg-black/15 px-3 py-2">
                    <dt className="text-[11px] text-parchment-300/60">{k}</dt>
                    <dd className="text-parchment-50">{v}</dd>
                  </div>
                ))}
              </dl>
              {result.report.octaveShift !== 0 && (
                <p className="text-sm text-parchment-200/75">
                  Moved {describeShift(result.report.octaveShift)} from the file to fit the ocarina.
                </p>
              )}
              {result.report.unplayable.length > 0 && (
                <p className="border border-gold-400/40 bg-gold-500/10 p-3 text-sm text-gold-200">
                  Out of the ocarina&apos;s range:{" "}
                  {result.report.unplayable.map((u) => `${displayPitch(u.pitch)} (×${u.count})`).join(", ")}. These notes still play and
                  show in the score, but they have no fingering. Try another key, or a simpler file.
                </p>
              )}
              {chosen.melody.warnings.filter((w) => !w.startsWith("Overlapping")).length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-xs text-parchment-300/70">
                  {chosen.melody.warnings
                    .filter((w) => !w.startsWith("Overlapping"))
                    .map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                </ul>
              )}
              {timeline && (
                <div className="parchment max-h-[420px] overflow-y-auto p-3 sm:p-5">
                  <Score timeline={timeline} timeSignature={result.arrangement.timeSignature} current={null} />
                </div>
              )}
            </>
          )}

          <div className="flex justify-between gap-3">
            <button onClick={() => setStep(2)} className={btn}>
              Back
            </button>
            <button onClick={save} disabled={"error" in result} className={primary}>
              Save song
            </button>
          </div>
        </section>
      )}

      <p className="text-sm text-parchment-300/60">
        <Link href={yourSongsHref(params.get("c") ?? undefined)} className="text-gold-300 underline">
          Cancel
        </Link>
      </p>
    </div>
  );
}

function Opt({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-parchment-300/60">{label}</span>
      {children}
    </label>
  );
}
