"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MicInput, MicStartError } from "@/engine/pitch/mic";
import type { PitchFrame } from "@/engine/pitch/classify";

export type MicStatus = "off" | "starting" | "on" | "error";

/**
 * Microphone lifecycle + a ~40 fps frame loop. Consumers subscribe with
 * `onFrame` (every frame, no re-render) and get a throttled `frame` state
 * (~12 fps) for meters.
 */
export function useMic(noiseGate: number) {
  const mic = useRef<MicInput | null>(null);
  const listeners = useRef(new Set<(f: PitchFrame) => void>());
  const [status, setStatus] = useState<MicStatus>("off");
  const [error, setError] = useState<string | null>(null);
  const [frame, setFrame] = useState<PitchFrame | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (mic.current) mic.current.noiseGate = noiseGate;
  }, [noiseGate]);

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    mic.current?.stop();
    mic.current = null;
    setStatus("off");
    setFrame(null);
  }, []);

  const start = useCallback(async () => {
    if (mic.current) return true;
    setStatus("starting");
    setError(null);
    const m = new MicInput();
    m.noiseGate = noiseGate;
    try {
      await m.start();
    } catch (e) {
      setStatus("error");
      setError(e instanceof MicStartError ? e.message : (e as Error).message);
      return false;
    }
    mic.current = m;
    setStatus("on");
    let last = 0;
    timer.current = setInterval(() => {
      const f = m.read();
      listeners.current.forEach((l) => l(f));
      if (f.t - last > 80) {
        last = f.t;
        setFrame(f);
      }
    }, 25);
    return true;
  }, [noiseGate]);

  const onFrame = useCallback((fn: (f: PitchFrame) => void) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  useEffect(() => stop, [stop]);

  return { status, error, frame, start, stop, onFrame };
}

export type MicHandle = ReturnType<typeof useMic>;
