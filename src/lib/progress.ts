"use client";

import { useSyncExternalStore } from "react";
import { isUserSongId, type AnySongId } from "@/engine/music/schema";

/**
 * Local progress store (LocalStorage, versioned). The interface is small on
 * purpose so it can move to IndexedDB without touching callers.
 * Practice counters are written by the Sprint 3 practice engine; Sprint 1
 * records song visits so "Continue learning" works today.
 */

export interface PhraseProgress {
  attempts: number;
  notesCorrect: number;
  notesAttempted: number;
  completed: boolean;
}

export interface SongProgress {
  songId: AnySongId;
  firstOpenedAt: number;
  lastOpenedAt: number;
  lastPracticedAt?: number;
  practiceSeconds: number;
  notesAttempted: number;
  notesCorrect: number;
  completed: boolean;
  phrases: Record<string, PhraseProgress>;
}

/** One practice run, kept for the activity chart and streak (newest last, capped). */
export interface PracticeSession {
  at: number;
  songId: AnySongId;
  mode: "game" | "full";
  seconds: number;
  notesAttempted: number;
  notesCorrect: number;
}

export interface ProgressState {
  version: 1;
  songs: Partial<Record<AnySongId, SongProgress>>;
  sessions?: PracticeSession[];
}

const MAX_SESSIONS = 500;

const KEY = "ocarina-academy:progress";
const EMPTY: ProgressState = { version: 1, songs: {} };

let cache: ProgressState | null = null;
const listeners = new Set<() => void>();

function read(): ProgressState {
  if (cache) return cache;
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
    const parsed = raw ? (JSON.parse(raw) as ProgressState) : null;
    cache = parsed?.version === 1 ? parsed : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function write(next: ProgressState) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked (private mode) — keep in memory */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useProgress(): ProgressState {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function recordSongOpened(songId: AnySongId) {
  const state = read();
  const now = Date.now();
  const prev = state.songs[songId];
  write({
    ...state,
    songs: {
      ...state.songs,
      [songId]: prev
        ? { ...prev, lastOpenedAt: now }
        : {
            songId,
            firstOpenedAt: now,
            lastOpenedAt: now,
            practiceSeconds: 0,
            notesAttempted: 0,
            notesCorrect: 0,
            completed: false,
            phrases: {},
          },
    },
  });
}

/** Drops a deleted user song from the totals. Its practice sessions stay, so past days on the chart don't change. */
export function forgetSong(songId: AnySongId) {
  const state = read();
  if (!state.songs[songId]) return;
  const songs = { ...state.songs };
  delete songs[songId];
  write({ ...state, songs });
}

export function resetProgress() {
  write(EMPTY);
}

export function summarize(state: ProgressState) {
  const all = Object.values(state.songs).filter(Boolean) as SongProgress[];
  const attempted = all.reduce((n, s) => n + s.notesAttempted, 0);
  const correct = all.reduce((n, s) => n + s.notesCorrect, 0);
  // "Started" and "mastered" count the 12 bundled songs only (shown as "n / 12").
  const bundled = all.filter((s) => !isUserSongId(s.songId));
  return {
    started: bundled.length,
    completed: bundled.filter((s) => s.completed).length,
    notesCorrect: correct,
    accuracy: attempted ? Math.round((correct / attempted) * 100) : null,
    practiceSeconds: all.reduce((n, s) => n + s.practiceSeconds, 0),
    recent: [...all].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt),
  };
}

export interface PracticeRecord {
  seconds: number;
  notesAttempted: number;
  notesCorrect: number;
  /** key = "<game|full>:<phraseId>" */
  phrases: { key: string; attempted: number; correct: number; completed: boolean }[];
  songCompleted: boolean;
}

/** Add the results of one practice run to the song's progress. */
export function recordPractice(songId: AnySongId, r: PracticeRecord) {
  recordSongOpened(songId); // make sure the entry exists
  const state = read();
  const prev = state.songs[songId]!;
  const phrases = { ...prev.phrases };
  for (const p of r.phrases) {
    const old = phrases[p.key] ?? { attempts: 0, notesAttempted: 0, notesCorrect: 0, completed: false };
    phrases[p.key] = {
      attempts: old.attempts + 1,
      notesAttempted: old.notesAttempted + p.attempted,
      notesCorrect: old.notesCorrect + p.correct,
      completed: old.completed || p.completed,
    };
  }
  const session: PracticeSession = {
    at: Date.now(),
    songId,
    mode: r.phrases[0]?.key.startsWith("full:") ? "full" : "game",
    seconds: Math.round(r.seconds),
    notesAttempted: r.notesAttempted,
    notesCorrect: r.notesCorrect,
  };
  write({
    ...state,
    sessions: [...(state.sessions ?? []), session].slice(-MAX_SESSIONS),
    songs: {
      ...state.songs,
      [songId]: {
        ...prev,
        lastPracticedAt: session.at,
        practiceSeconds: prev.practiceSeconds + Math.round(r.seconds),
        notesAttempted: prev.notesAttempted + r.notesAttempted,
        notesCorrect: prev.notesCorrect + r.notesCorrect,
        completed: prev.completed || r.songCompleted,
        phrases,
      },
    },
  });
}

const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

/** Practice minutes per day for the last `days` days (oldest first) and the current streak. */
export function activity(state: ProgressState, days = 28, now = Date.now()) {
  const perDay = new Map<string, number>();
  const add = (at: number, seconds: number) => perDay.set(dayKey(at), (perDay.get(dayKey(at)) ?? 0) + seconds);
  for (const s of state.sessions ?? []) add(s.at, s.seconds);
  // Practice saved before sessions were logged only exists in the song totals:
  // count what the log doesn't cover on the day the song was last practiced.
  for (const song of Object.values(state.songs)) {
    if (!song?.lastPracticedAt) continue;
    const logged = (state.sessions ?? []).filter((s) => s.songId === song.songId).reduce((n, s) => n + s.seconds, 0);
    if (song.practiceSeconds > logged) add(song.lastPracticedAt, song.practiceSeconds - logged);
  }
  const DAY = 86_400_000;
  const series = Array.from({ length: days }, (_, i) => {
    const t = now - (days - 1 - i) * DAY;
    return { date: new Date(t), seconds: perDay.get(dayKey(t)) ?? 0 };
  });
  // Streak: consecutive days with practice, ending today (or yesterday, so it survives until you practice today).
  let streak = 0;
  let t = perDay.has(dayKey(now)) ? now : now - DAY;
  while (perDay.has(dayKey(t))) {
    streak++;
    t -= DAY;
  }
  return { series, streak, activeDays: perDay.size };
}

/** The whole progress state (for backups, see backup.ts). */
export const readProgress = (): ProgressState => read();

/** Checks a value is a progress state. */
export function isProgressState(v: unknown): v is ProgressState {
  const x = v as ProgressState;
  return !!x && x.version === 1 && typeof x.songs === "object" && x.songs !== null;
}

export function replaceProgress(p: ProgressState) {
  write({ version: 1, songs: p.songs, sessions: Array.isArray(p.sessions) ? p.sessions : [] });
}
