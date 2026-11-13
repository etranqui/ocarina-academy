"use client";

import { useSyncExternalStore } from "react";

/** Tiny LocalStorage-backed store with cross-tab sync and a React hook. */
export function createLocalStore<T>(key: string, empty: T) {
  let cache: T | null = null;
  const listeners = new Set<() => void>();

  function read(): T {
    if (cache !== null) return cache;
    try {
      const raw = window.localStorage.getItem(key);
      cache = raw ? (JSON.parse(raw) as T) : empty;
    } catch {
      cache = empty;
    }
    return cache;
  }

  function write(next: T) {
    cache = next;
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      throw new Error("Could not save — browser storage is full or blocked.");
    } finally {
      listeners.forEach((l) => l());
    }
  }

  function subscribe(l: () => void) {
    listeners.add(l);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) {
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

  const use = () => useSyncExternalStore(subscribe, read, () => empty);

  return { read, write, subscribe, use };
}
