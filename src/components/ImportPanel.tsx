"use client";

import { useMemo, useState } from "react";
import type { Song, SongId } from "@/engine/music/schema";
import { parseMusicXml } from "@/engine/import/musicxml";
import { defaultTrack, midiTracks, parseMidi, readMidi } from "@/engine/import/midi";
import { fitArrangement } from "@/engine/import/fit";
import type { ImportedMelody, MidiTrackInfo } from "@/engine/import/types";
import { displayPitch, midiToPitch } from "@/engine/music/pitch";
import { removeImported, saveImported, useImported } from "@/lib/arrangements";
import type { Midi } from "@tonejs/midi";

type Loaded =
  | { kind: "musicxml"; fileName: string; melody: ImportedMelody }
  | { kind: "midi"; fileName: string; midi: Midi; tracks: MidiTrackInfo[] };

const SHIFTS = [
  { v: "auto", label: "Auto (best fit)" },
  { v: "-24", label: "Down 2 octaves" },
  { v: "-12", label: "Down 1 octave" },
  { v: "0", label: "As written" },
  { v: "12", label: "Up 1 octave" },
  { v: "24", label: "Up 2 octaves" },
];

/**
 * Import a MusicXML or MIDI file you own as this song's full arrangement.
 * Everything happens in the browser; the file never leaves the device.
 */
export function ImportPanel({ song, onSaved }: { song: Song; onSaved?: () => void }) {
  const imported = useImported()[song.id as SongId];
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [track, setTrack] = useState(0);
  const [shift, setShift] = useState("auto");
  const [bars, setBars] = useState(4);
  const [complete, setComplete] = useState(false);

  async function onFile(file: File) {
    setError(null);
    setLoaded(null);
    const name = file.name;
    const ext = name.toLowerCase().split(".").pop() ?? "";
    try {
      if (ext === "mxl") throw new Error("Compressed .mxl files aren't supported yet — export uncompressed MusicXML (.musicxml) instead.");
      if (ext === "mid" || ext === "midi") {
        const midi = readMidi(new Uint8Array(await file.arrayBuffer()));
        const tracks = midiTracks(midi);
        if (!tracks.length) throw new Error("This MIDI file contains no notes.");
        setTrack(defaultTrack(tracks));
        setLoaded({ kind: "midi", fileName: name, midi, tracks });
      } else if (ext === "musicxml" || ext === "xml") {
        const doc = new DOMParser().parseFromString(await file.text(), "application/xml");
        setLoaded({ kind: "musicxml", fileName: name, melody: parseMusicXml(doc) });
      } else throw new Error("Choose a .musicxml, .xml, .mid or .midi file.");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const result = useMemo(() => {
    if (!loaded) return null;
    try {
      const melody = loaded.kind === "midi" ? parseMidi(loaded.midi, track) : loaded.melody;
      const fit = fitArrangement(melody, {
        sourceKind: loaded.kind,
        fileName: loaded.fileName,
        complete,
        barsPerPhrase: bars,
        octaveShift: shift === "auto" ? undefined : Number(shift),
      });
      return { melody, ...fit };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [loaded, track, complete, bars, shift]);

  function save() {
    if (!result || "error" in result || !loaded) return;
    try {
      saveImported(song.id as SongId, { arrangement: result.arrangement, fileName: loaded.fileName, importedAt: Date.now() });
      setLoaded(null);
      onSaved?.();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="panel p-5 sm:p-6">
      <h2 className="font-display text-lg text-parchment-50">Import a full arrangement</h2>
      <p className="mt-1 text-sm text-parchment-200/70">
        MusicXML (.musicxml) or MIDI (.mid) that you own or are licensed to use. The file is read in your browser and saved on
        this device only. It&apos;s fitted to the Alto C range and checked against the replica&apos;s verified fingerings.
      </p>

      {imported && !loaded && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-gold-500/25 bg-black/15 p-3 text-sm">
          <span className="text-parchment-200/80">
            Current: <span className="text-parchment-50">{imported.fileName}</span> · imported{" "}
            {new Date(imported.importedAt).toLocaleDateString()}
          </span>
          <button
            onClick={() => removeImported(song.id as SongId)}
            className="border border-red-300/40 px-3 py-1 text-xs text-red-200 hover:bg-red-300/10"
          >
            Remove
          </button>
        </div>
      )}

      <label className="mt-4 flex cursor-pointer items-center justify-center gap-3 border border-dashed border-gold-400/50 bg-black/10 px-4 py-6 text-sm text-gold-200 transition hover:bg-gold-300/5">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></svg>
        {loaded ? `Loaded ${loaded.fileName} — choose another` : imported ? "Replace with another file" : "Choose a MusicXML or MIDI file"}
        <input
          type="file"
          accept=".musicxml,.xml,.mid,.midi,.mxl"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = "";
          }}
        />
      </label>

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

      {loaded && result && (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {loaded.kind === "midi" && (
              <Opt label="Track">
                <select value={track} onChange={(e) => setTrack(Number(e.target.value))} className="w-full border border-gold-500/30 bg-forest-900 px-2 py-1.5 text-sm">
                  {loaded.tracks.map((t) => (
                    <option key={t.index} value={t.index}>
                      {t.name} · {t.noteCount} notes · {displayPitch(midiToPitch(t.lowest))}–{displayPitch(midiToPitch(t.highest))}
                      {t.percussion ? " (drums)" : ""}
                    </option>
                  ))}
                </select>
              </Opt>
            )}
            <Opt label="Octave">
              <select value={shift} onChange={(e) => setShift(e.target.value)} className="w-full border border-gold-500/30 bg-forest-900 px-2 py-1.5 text-sm">
                {SHIFTS.map((s) => (
                  <option key={s.v} value={s.v}>{s.label}</option>
                ))}
              </select>
            </Opt>
            <Opt label="Phrase length">
              <select value={bars} onChange={(e) => setBars(Number(e.target.value))} className="w-full border border-gold-500/30 bg-forest-900 px-2 py-1.5 text-sm">
                {[1, 2, 4, 8].map((b) => (
                  <option key={b} value={b}>{b} bar{b > 1 ? "s" : ""}</option>
                ))}
              </select>
            </Opt>
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
                  ["Tempo · time", `${result.melody.bpm} bpm · ${result.melody.timeSignature.join("/")}`],
                ].map(([k, v]) => (
                  <div key={k as string} className="border border-gold-500/15 bg-black/15 px-3 py-2">
                    <dt className="text-[11px] text-parchment-300/60">{k}</dt>
                    <dd className="text-parchment-50">{v}</dd>
                  </div>
                ))}
              </dl>

              {result.report.octaveShift !== 0 && (
                <p className="text-sm text-parchment-200/75">
                  Transposed {result.report.octaveShift > 0 ? "up" : "down"} {Math.abs(result.report.octaveShift) / 12} octave(s) to fit the ocarina.
                </p>
              )}
              {result.report.unplayable.length > 0 && (
                <p className="border border-gold-400/40 bg-gold-500/10 p-3 text-sm text-gold-200">
                  No verified fingering yet for:{" "}
                  {result.report.unplayable.map((u) => `${displayPitch(u.pitch)} (×${u.count})`).join(", ")}. These notes still play and show in
                  the score, but the diagram will say the fingering isn&apos;t defined, and the arrangement stays “Partial”.
                </p>
              )}
              {result.melody.warnings.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-xs text-parchment-300/70">
                  {result.melody.warnings.map((w) => <li key={w}>{w}</li>)}
                </ul>
              )}

              <label className="flex items-start gap-2 text-sm text-parchment-100">
                <input type="checkbox" checked={complete} onChange={(e) => setComplete(e.target.checked)} className="mt-1 accent-leaf-500" />
                <span>
                  This file is the complete song, from start to finish.
                  <span className="block text-xs text-parchment-300/60">
                    Only then — and only if every note is playable — is it labelled “Verified”. Otherwise it&apos;s saved as “Partial”.
                  </span>
                </span>
              </label>

              <div className="flex items-center gap-3">
                <button
                  onClick={save}
                  className="bg-gradient-to-b from-gold-300 to-gold-500 px-5 py-2 font-display text-xs tracking-widest text-forest-950 hover:brightness-110"
                >
                  Save as full arrangement
                </button>
                <span className="text-xs text-parchment-300/60">
                  Will be labelled: {result.arrangement.status === "verified" ? "Verified" : "Partial"}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Opt({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block uppercase tracking-[0.16em] text-parchment-300/60">{label}</span>
      {children}
    </label>
  );
}
