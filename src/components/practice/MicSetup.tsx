"use client";

import { useState } from "react";
import { centsBetween, displayPitch, hzToMidiFloat, midiToPitch, pitchToHz } from "@/engine/music/pitch";
import type { PitchFrame } from "@/engine/pitch/classify";
import { savePracticeSettings, type PracticeSettings } from "@/lib/practiceSettings";
import type { MicHandle } from "@/lib/useMic";
import { OcarinaDiagram } from "../OcarinaDiagram";

const CAL_NOTE = "A5";

type CalStep = null | "quiet" | "tone" | { done: string } | { failed: string };

/**
 * Microphone status, live level, and a two-step calibration:
 *  1. stay quiet → noise gate
 *  2. hold A5 → tuning offset of your instrument
 */
export function MicSetup({ mic, settings }: { mic: MicHandle; settings: PracticeSettings }) {
  const [step, setStep] = useState<CalStep>(null);
  const [open, setOpen] = useState(false);

  async function calibrate() {
    if (!(await mic.start())) return;
    setOpen(true);

    // 1. noise floor
    setStep("quiet");
    const quiet = await collect(mic, 1600);
    const levels = quiet.map((f) => f.rms).sort((a, b) => a - b);
    const floor = levels[Math.floor(levels.length * 0.9)] ?? 0.005;
    const noiseGate = Math.min(0.05, Math.max(0.004, floor * 2.5));
    savePracticeSettings({ noiseGate });

    // 2. tuning
    setStep("tone");
    await wait(600);
    const target = pitchToHz(CAL_NOTE);
    const tone = (await collect(mic, 3000))
      .filter((f) => f.hz !== null && f.rms > noiseGate)
      .map((f) => centsBetween(f.hz!, target))
      .filter((c) => Math.abs(c) < 100)
      .sort((a, b) => a - b);
    if (tone.length < 25) {
      setStep({ failed: `Couldn't hear a steady ${displayPitch(CAL_NOTE)}. The quiet level was saved — try the tuning step again, a little closer to the mic.` });
      return;
    }
    const median = tone[Math.floor(tone.length / 2)];
    const tuningCents = Math.round(Math.max(-50, Math.min(50, median)));
    savePracticeSettings({ tuningCents, calibratedAt: Date.now() });
    setStep({
      done:
        Math.abs(tuningCents) < 8
          ? "Your ocarina is in tune with the app. Calibration saved."
          : `Your ocarina plays ${Math.abs(tuningCents)}¢ ${tuningCents > 0 ? "sharp" : "flat"} with your normal breath — the app now allows for that. Calibration saved.`,
    });
  }

  const f = mic.frame;
  const heard = f?.hz ? midiToPitch(Math.round(hzToMidiFloat(f.hz) - settings.tuningCents / 100)) : null;
  const levelPct = f ? Math.min(100, (Math.sqrt(f.rms) / Math.sqrt(0.3)) * 100) : 0;
  const gatePct = Math.min(100, (Math.sqrt(settings.noiseGate) / Math.sqrt(0.3)) * 100);

  return (
    <div className="panel p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`size-2.5 rounded-full ${
            mic.status === "on" ? "bg-leaf-400 shadow-[0_0_8px_#4cc27a]" : mic.status === "error" ? "bg-red-400" : "bg-parchment-300/30"
          }`}
        />
        <span className="font-display text-sm tracking-widest text-parchment-50">Microphone</span>
        <span className="text-xs text-parchment-300/60">
          {mic.status === "on" ? "listening" : mic.status === "starting" ? "starting…" : mic.status === "error" ? "unavailable" : "off"}
          {settings.calibratedAt ? ` · calibrated ${new Date(settings.calibratedAt).toLocaleDateString()}` : " · not calibrated"}
        </span>
        <div className="ml-auto flex gap-2">
          {mic.status !== "on" ? (
            <button onClick={() => void mic.start()} className="border border-gold-300/50 px-3 py-1.5 text-xs text-gold-200 hover:bg-gold-300/10">
              Turn on
            </button>
          ) : (
            <button onClick={mic.stop} className="border border-gold-500/25 px-3 py-1.5 text-xs text-parchment-200/70 hover:text-parchment-50">
              Turn off
            </button>
          )}
          <button onClick={() => setOpen((o) => !o)} className="border border-gold-500/25 px-3 py-1.5 text-xs text-parchment-200/70 hover:text-parchment-50">
            {open ? "Hide setup" : "Calibrate & settings"}
          </button>
        </div>
      </div>

      {mic.error && <p className="mt-3 text-sm text-red-300">{mic.error}</p>}

      {mic.status === "on" && (
        <div className="mt-3 flex items-center gap-3 text-xs text-parchment-300/70">
          <span className="w-10">Level</span>
          <div className="relative h-2 flex-1 bg-black/30">
            <div className="absolute inset-y-0 left-0 bg-leaf-500/80 transition-[width] duration-75" style={{ width: `${levelPct}%` }} />
            <div className="absolute inset-y-[-3px] w-px bg-gold-300" style={{ left: `${gatePct}%` }} title="Noise gate" />
          </div>
          <span className="w-16 text-right font-display text-sm text-parchment-50">{heard ? displayPitch(heard) : "—"}</span>
        </div>
      )}

      {open && (
        <div className="mt-4 grid gap-4 border-t border-gold-500/15 pt-4 md:grid-cols-[1fr_1fr]">
          <div className="space-y-3 text-sm text-parchment-200/80">
            <p>
              Calibrate once per room and instrument. Step 1: stay silent for 2 seconds. Step 2: play a steady{" "}
              <strong className="text-parchment-50">{displayPitch(CAL_NOTE)}</strong> with your normal breath for 3 seconds.
            </p>
            {step === "quiet" && <p className="font-display text-gold-200">Step 1 — stay quiet…</p>}
            {step === "tone" && (
              <div className="parchment p-3">
                <p className="font-display text-ink-900">Step 2 — play and hold {displayPitch(CAL_NOTE)}</p>
                <OcarinaDiagram pitch={CAL_NOTE} variant="compact" />
              </div>
            )}
            {step && typeof step === "object" && "done" in step && <p className="text-leaf-400">{step.done}</p>}
            {step && typeof step === "object" && "failed" in step && <p className="text-gold-300">{step.failed}</p>}
            <button
              onClick={() => void calibrate()}
              disabled={step === "quiet" || step === "tone"}
              className="bg-gradient-to-b from-gold-300 to-gold-500 px-4 py-2 font-display text-xs tracking-widest text-forest-950 disabled:opacity-50"
            >
              {settings.calibratedAt ? "Calibrate again" : "Start calibration"}
            </button>
          </div>
          <div className="space-y-4 text-sm">
            <label className="block">
              <span className="flex justify-between text-parchment-200/80">
                <span>Tolerance</span>
                <span className="tabular-nums text-parchment-50">±{settings.toleranceCents}¢</span>
              </span>
              <input
                type="range"
                min={15}
                max={50}
                step={5}
                value={settings.toleranceCents}
                onChange={(e) => savePracticeSettings({ toleranceCents: Number(e.target.value) })}
                className="mt-1 w-full accent-[#d6b25a]"
              />
              <span className="text-xs text-parchment-300/60">Wider is more forgiving. 30¢ suits beginners; 15–20¢ for precise intonation.</span>
            </label>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-parchment-300/70">
              <span>Tuning offset: {settings.tuningCents > 0 ? "+" : ""}{settings.tuningCents}¢</span>
              <span>Noise gate: {settings.noiseGate.toFixed(3)}</span>
              <button
                onClick={() => savePracticeSettings({ tuningCents: 0, noiseGate: 0.012, calibratedAt: undefined })}
                className="text-gold-300 underline"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function collect(mic: MicHandle, ms: number): Promise<PitchFrame[]> {
  return new Promise((resolve) => {
    const frames: PitchFrame[] = [];
    const off = mic.onFrame((f) => frames.push(f));
    setTimeout(() => {
      off();
      resolve(frames);
    }, ms);
  });
}
