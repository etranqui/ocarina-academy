"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { Song } from "@/engine/music/schema";
import { useSongs } from "@/lib/arrangements";
import {
  activity,
  exportProgress,
  importProgress,
  resetProgress,
  summarize,
  useProgress,
  type SongProgress,
} from "@/lib/progress";
import { SongEmblem } from "./SongEmblem";

const fmtTime = (sec: number) =>
  sec < 60 ? `${Math.round(sec)} s` : sec < 3600 ? `${Math.round(sec / 60)} min` : `${(sec / 3600).toFixed(1)} h`;
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);
const ago = (t?: number) => {
  if (!t) return "—";
  const d = Math.floor((Date.now() - t) / 86_400_000);
  return d <= 0 ? "Today" : d === 1 ? "Yesterday" : `${d} days ago`;
};

function phraseIds(song: Song, mode: "game" | "full") {
  return [...new Set(song.arrangements[mode].phrases.map((p) => p.id))];
}

function songStatus(p?: SongProgress) {
  if (!p) return { label: "Not started", cls: "text-parchment-300/55" };
  if (p.completed) return { label: "Mastered", cls: "text-gold-200" };
  if (p.notesAttempted) return { label: "Practising", cls: "text-leaf-400" };
  return { label: "Opened", cls: "text-parchment-200/75" };
}

export function ProgressDashboard() {
  const progress = useProgress();
  const songs = useSongs();
  const stats = summarize(progress);
  const act = activity(progress);
  const [message, setMessage] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  // Phrases that need attention: practised, lowest accuracy first.
  const focus = songs
    .flatMap((song) =>
      Object.entries(progress.songs[song.id]?.phrases ?? {}).map(([key, ph]) => {
        const [mode, id] = key.split(":") as ["game" | "full", string];
        const label = song.arrangements[mode]?.phrases.find((p) => p.id === id)?.label ?? id;
        return { song, mode, label, acc: pct(ph.notesCorrect, ph.notesAttempted), done: ph.completed };
      }),
    )
    .filter((f) => f.acc !== null && f.acc < 90)
    .sort((a, b) => a.acc! - b.acc!)
    .slice(0, 4);

  const download = () => {
    const blob = new Blob([exportProgress()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ocarina-academy-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const restore = async (f: File) => {
    try {
      importProgress(await f.text());
      setMessage("Progress restored from backup.");
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  const tiles = [
    { label: "Songs mastered", value: `${stats.completed} / 12`, hint: "Advanced run of the whole song at 80%+" },
    { label: "Practice streak", value: act.streak ? `${act.streak} day${act.streak > 1 ? "s" : ""}` : "—", hint: `${act.activeDays} day${act.activeDays === 1 ? "" : "s"} practised in total` },
    { label: "Accuracy", value: stats.accuracy === null ? "—" : `${stats.accuracy}%`, hint: `${stats.notesCorrect} notes played correctly` },
    { label: "Practice time", value: fmtTime(stats.practiceSeconds), hint: `${stats.started} of 12 songs started` },
  ];

  return (
    <div className="space-y-8">
      <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="panel px-5 py-4">
            <p className="text-xs uppercase tracking-[0.18em] text-parchment-300/60">{t.label}</p>
            <p className="mt-1 font-display text-3xl text-gold-200">{t.value}</p>
            <p className="mt-1 text-xs text-parchment-300/55">{t.hint}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <ActivityChart series={act.series} />

        <section className="panel p-5">
          <h2 className="font-display text-sm tracking-widest text-gold-200">Focus next</h2>
          {focus.length ? (
            <ul className="mt-3 space-y-3">
              {focus.map((f) => (
                <li key={`${f.song.id}-${f.mode}-${f.label}`} className="flex items-center gap-3">
                  <SongEmblem theme={f.song.theme} size={36} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-parchment-50">{f.song.title}</p>
                    <p className="text-xs text-parchment-300/60">
                      {f.label} · {f.mode === "game" ? "game" : "full"} · {f.acc}%
                    </p>
                  </div>
                  <Link href={`/songs/${f.song.id}/practice/`} className="shrink-0 text-xs text-gold-300 underline">
                    Practise
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-parchment-200/70">
              {stats.accuracy === null
                ? "Practise a song with the microphone and your weakest phrases will show up here."
                : "Every phrase you've practised is at 90% or better. Try a new song or a harder level."}
            </p>
          )}
        </section>
      </div>

      <section>
        <h2 className="mb-3 font-display text-xl text-parchment-50">Songs</h2>
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-gold-500/20 text-left text-xs uppercase tracking-[0.14em] text-parchment-300/60">
                <th className="px-4 py-3 font-normal">Song</th>
                <th className="px-3 py-3 font-normal">Status</th>
                <th className="px-3 py-3 font-normal">Game phrases</th>
                <th className="px-3 py-3 font-normal">Full phrases</th>
                <th className="px-3 py-3 text-right font-normal">Accuracy</th>
                <th className="px-3 py-3 text-right font-normal">Time</th>
                <th className="px-4 py-3 text-right font-normal">Last practised</th>
              </tr>
            </thead>
            <tbody>
              {songs.map((song) => {
                const p = progress.songs[song.id];
                const st = songStatus(p);
                const cells = (["game", "full"] as const).map((m) => {
                  const ids = phraseIds(song, m);
                  const done = ids.filter((id) => p?.phrases[`${m}:${id}`]?.completed).length;
                  return { done, total: ids.length };
                });
                const acc = p ? pct(p.notesCorrect, p.notesAttempted) : null;
                return (
                  <tr key={song.id} className="border-b border-gold-500/10 last:border-0 hover:bg-gold-300/5">
                    <td className="px-4 py-2.5">
                      <Link href={`/songs/${song.id}/practice/`} className="flex items-center gap-3 hover:text-gold-200">
                        <SongEmblem theme={song.theme} size={32} className="shrink-0" />
                        <span className="text-parchment-50">{song.title}</span>
                      </Link>
                    </td>
                    <td className={`px-3 py-2.5 ${st.cls}`}>{st.label}</td>
                    {cells.map((c, i) => (
                      <td key={i} className="px-3 py-2.5">
                        {c.total ? (
                          <div className="flex items-center gap-2">
                            <div className="h-1 w-16 bg-black/30" aria-hidden>
                              <div className="h-full" style={{ width: `${(c.done / c.total) * 100}%`, background: song.theme.color }} />
                            </div>
                            <span className="tabular-nums text-parchment-200/80">
                              {c.done}/{c.total}
                            </span>
                          </div>
                        ) : (
                          <span className="text-parchment-300/45">—</span>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right tabular-nums text-parchment-50">{acc === null ? "—" : `${acc}%`}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-parchment-200/80">{p ? fmtTime(p.practiceSeconds) : "—"}</td>
                    <td className="px-4 py-2.5 text-right text-parchment-200/70">{ago(p?.lastPracticedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel flex flex-wrap items-center gap-3 p-5">
        <div className="mr-auto">
          <h2 className="font-display text-sm tracking-widest text-gold-200">Your data</h2>
          <p className="mt-1 text-xs text-parchment-300/60">
            Progress lives only on this device. Download a backup to move it to another browser or phone.
          </p>
          {message && <p className="mt-2 text-sm text-leaf-400">{message}</p>}
        </div>
        <button onClick={download} className="border border-gold-300/50 px-4 py-2 font-display text-xs tracking-widest text-gold-200 hover:bg-gold-300/10">
          Download backup
        </button>
        <button onClick={() => file.current?.click()} className="border border-gold-500/30 px-4 py-2 font-display text-xs tracking-widest text-parchment-200/80 hover:text-parchment-50">
          Restore backup
        </button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void restore(f);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => {
            if (confirm("Erase all progress on this device? This can't be undone unless you have a backup.")) {
              resetProgress();
              setMessage("Progress erased.");
            }
          }}
          className="px-3 py-2 text-xs text-red-300/80 underline hover:text-red-300"
        >
          Reset progress
        </button>
      </section>
    </div>
  );
}

/** Practice minutes per day, last 28 days. Single series: one hue, no legend. */
function ActivityChart({ series }: { series: { date: Date; seconds: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560;
  const H = 150;
  const PAD_B = 22;
  const PAD_L = 30;
  const max = Math.max(5 * 60, ...series.map((d) => d.seconds));
  const maxMin = Math.ceil(max / 60 / 5) * 5;
  const step = (W - PAD_L) / series.length;
  const bw = Math.max(4, step - 2); // 2px gap between bars
  const y = (sec: number) => H - PAD_B - (sec / 60 / maxMin) * (H - PAD_B - 8);
  const label = (d: Date) => d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const total = series.reduce((n, d) => n + d.seconds, 0);

  return (
    <section className="panel p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-sm tracking-widest text-gold-200">Practice minutes · last 4 weeks</h2>
        <span className="text-xs tabular-nums text-parchment-300/60">
          {hover !== null ? `${label(series[hover].date)} · ${Math.round(series[hover].seconds / 60)} min` : `${Math.round(total / 60)} min total`}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={`Practice minutes per day for the last 4 weeks, ${Math.round(total / 60)} minutes in total`} onMouseLeave={() => setHover(null)}>
        {[0, maxMin / 2, maxMin].map((m) => (
          <g key={m}>
            <line x1={PAD_L} x2={W} y1={y(m * 60)} y2={y(m * 60)} stroke="currentColor" className="text-parchment-300/12" />
            <text x={PAD_L - 6} y={y(m * 60) + 3} textAnchor="end" fontSize="9" className="fill-parchment-300/55">
              {m}
            </text>
          </g>
        ))}
        {series.map((d, i) => {
          const x = PAD_L + i * step + 1;
          const top = y(d.seconds);
          const h = H - PAD_B - top;
          const r = Math.min(4, h, bw / 2);
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={-1}>
              {/* full-height hit target, wider than the mark */}
              <rect x={x - 1} y={8} width={step} height={H - PAD_B - 8} fill="transparent" />
              {d.seconds > 0 && (
                <path
                  d={`M${x} ${H - PAD_B} V${top + r} Q${x} ${top} ${x + r} ${top} H${x + bw - r} Q${x + bw} ${top} ${x + bw} ${top + r} V${H - PAD_B} Z`}
                  fill="#d6b25a"
                  opacity={hover === null || hover === i ? 1 : 0.55}
                />
              )}
              {(i === 0 || d.date.getDay() === 1) && i < series.length - 2 && (
                <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize="9" className="fill-parchment-300/55">
                  {d.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </text>
              )}
            </g>
          );
        })}
        <line x1={PAD_L} x2={W} y1={H - PAD_B} y2={H - PAD_B} stroke="currentColor" className="text-parchment-300/30" />
      </svg>
      <table className="sr-only">
        <caption>Practice minutes per day</caption>
        <tbody>
          {series.map((d, i) => (
            <tr key={i}>
              <th>{label(d.date)}</th>
              <td>{Math.round(d.seconds / 60)} min</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
