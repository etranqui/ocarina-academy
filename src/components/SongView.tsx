"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { analyze, formatDuration } from "@/engine/music/analysis";
import { displayPitch, midiToPitch } from "@/engine/music/pitch";
import type { SongId } from "@/engine/music/schema";
import { recordSongOpened } from "@/lib/progress";
import { RHYTHM_EDITING, USER_RHYTHM_NOTE, useSong } from "@/lib/arrangements";
import { SequenceExplorer } from "./SequenceExplorer";
import { ListenPlayer } from "./ListenPlayer";
import { ImportPanel } from "./ImportPanel";
import { RhythmEditor } from "./RhythmEditor";
import { PracticeView } from "./practice/PracticeView";
import { defaultMode, ModeToggle, SongHeader, type ArrangementMode, type SongTab } from "./SongHeader";

export function SongView({ songId, tab }: { songId: string; tab: SongTab }) {
  const song = useSong(songId)!;
  const [chosen, setChosen] = useState<ArrangementMode | null>(null);
  const [editing, setEditing] = useState(false);
  const mode = chosen ?? defaultMode(song);
  const arrangement = song.arrangements[mode];
  const stats = analyze(arrangement);
  const empty = arrangement.status === "needs-transcription";
  // Imported files carry their own rhythm; bundled arrangements can get one from the user.
  const editable = !empty && !["musicxml", "midi"].includes(arrangement.source.kind);
  const arrKey = hashKey(JSON.stringify(arrangement));

  useEffect(() => {
    recordSongOpened(song.id as SongId);
  }, [song.id]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <SongHeader song={song} tab={tab} />

      <div className="mt-6">
        <ModeToggle song={song} mode={mode} onChange={setChosen} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0 space-y-6">
          {editable && !editing && tab !== "practice" && (
            <div className="flex flex-wrap items-center justify-between gap-3 border border-gold-500/20 bg-black/15 px-4 py-3 text-sm">
              <span className="text-parchment-200/80">
                <span className="text-parchment-300/60">Rhythm: </span>
                {arrangement.source.rhythm === "exact"
                  ? arrangement.source.rhythmNote ?? "transcribed"
                  : arrangement.source.rhythmNote ?? (mode === "full" ? "one beat per note — not transcribed yet" : "even pulse — not transcribed yet")}
              </span>
              {RHYTHM_EDITING && (
                <button onClick={() => setEditing(true)} className="border border-gold-300/50 px-3 py-1 font-display text-[11px] tracking-widest text-gold-200 hover:bg-gold-300/10">
                  {arrangement.source.rhythmNote === USER_RHYTHM_NOTE ? "Edit my rhythm" : arrangement.source.rhythm === "exact" ? "Adjust rhythm" : "Set the rhythm"}
                </button>
              )}
            </div>
          )}
          {RHYTHM_EDITING && editable && editing && tab !== "practice" && <RhythmEditor key={mode} song={song} mode={mode} onClose={() => setEditing(false)} />}
          {mode === "full" && arrangement.keyNote && (
            <div role="note" className="border border-gold-300/40 bg-gold-300/10 px-4 py-3 text-sm text-parchment-100">
              <span className="font-display text-xs tracking-widest text-gold-200">Different key · </span>
              {arrangement.keyNote}
            </div>
          )}
          {empty ? (
            <div className="panel p-8 text-center">
              <p className="font-display text-xl text-parchment-50">Full arrangement not yet transcribed</p>
              <p className="mx-auto mt-3 max-w-lg font-serif text-parchment-200/75">{arrangement.source.note}</p>
              <button
                onClick={() => setChosen("game")}
                className="mt-6 border border-gold-300/50 px-5 py-2 font-display text-xs tracking-widest text-gold-200 hover:bg-gold-300/10"
              >
                Learn the game sequence instead
              </button>
            </div>
          ) : tab === "practice" ? (
            <PracticeView key={`${mode}-${arrKey}`} songId={song.id as SongId} mode={mode} arrangement={arrangement} accent={song.theme.color} />
          ) : tab === "listen" ? (
            <ListenPlayer key={`${mode}-${arrKey}`} arrangement={arrangement} accent={song.theme.color} />
          ) : (
            <SequenceExplorer key={`${mode}-${arrKey}`} arrangement={arrangement} accent={song.theme.color} />
          )}

          {mode === "full" && tab === "overview" && <ImportPanel song={song} />}
          {mode === "full" && tab !== "overview" && empty && (
            <p className="text-center text-sm text-parchment-300/60">
              Import a file on the{" "}
              <Link href={`/songs/${song.id}/`} className="text-gold-300 underline">
                Fingerings
              </Link>{" "}
              tab to use the full arrangement here.
            </p>
          )}
        </div>

        <aside className="space-y-4">
          <div className="panel p-5">
            <h2 className="font-display text-sm tracking-widest text-gold-200">About this arrangement</h2>
            {stats ? (
              <dl className="mt-3 space-y-2 text-sm">
                {[
                  ["Notes", stats.noteCount],
                  ["Fingerings to learn", stats.uniquePitches.length],
                  ["Range", `${displayPitch(midiToPitch(stats.lowestMidi))} – ${displayPitch(midiToPitch(stats.highestMidi))}`],
                  ["Widest leap", `${stats.maxLeap} semitones`],
                  ["Length", `${formatDuration(stats.durationSec)} at ${arrangement.tempoBpm} bpm`],
                  ["Difficulty", stats.difficulty],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex justify-between gap-3 border-b border-gold-500/10 pb-2">
                    <dt className="text-parchment-300/65">{k}</dt>
                    <dd className="text-right text-parchment-50">{v}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-3 text-sm text-parchment-300/65">No note data yet.</p>
            )}
            <p className="mt-4 text-xs leading-relaxed text-parchment-300/60">
              <span className="text-parchment-200/80">Source: </span>
              {arrangement.source.note}
            </p>
          </div>

          <div className="panel p-5">
            <h2 className="font-display text-sm tracking-widest text-gold-200">
              {tab === "overview" ? "Learn it in steps" : "How to use"}
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-parchment-200/75">
              {tab === "practice" ? (
                <>
                  <li>Calibrate once: stay quiet, then hold an A. The app learns your room and your instrument.</li>
                  <li>Start on Beginner, then move up when a phrase feels easy.</li>
                  <li>Sharp? Blow softer. Flat? Blow firmer and check every hole is sealed.</li>
                  <li>Use headphones or keep the phone away from the speaker for best detection.</li>
                </>
              ) : tab === "listen" ? (
                <>
                  <li>Start at 50 % and loop one phrase until the fingerings feel automatic.</li>
                  <li>Watch “Up next” to prepare your fingers before the note arrives.</li>
                  <li>Turn on the metronome to feel the pulse, then raise the tempo.</li>
                </>
              ) : (
                <>
                  <li>Step through each note with ← → and copy the fingering on your ocarina.</li>
                  <li>
                    Then open{" "}
                    <Link href={`/songs/${song.id}/listen/`} className="text-gold-300 underline">
                      Listen &amp; Learn
                    </Link>{" "}
                    to hear it and play along.
                  </li>
                  <li>
                    Finally,{" "}
                    <Link href={`/songs/${song.id}/practice/`} className="text-gold-300 underline">
                      Practice
                    </Link>{" "}
                    with your microphone for feedback on every note.
                  </li>
                </>
              )}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Short stable key for an arrangement, so players remount when its notes change. */
function hashKey(str: string) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
