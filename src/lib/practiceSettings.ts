"use client";

import { createLocalStore } from "./localStore";

export interface PracticeSettings {
  /** Microphone RMS below this counts as silence. */
  noiseGate: number;
  /** Your instrument's tuning offset in cents (positive = plays sharp). */
  tuningCents: number;
  /** ± cents accepted as "in tune". */
  toleranceCents: number;
  calibratedAt?: number;
}

export const DEFAULT_SETTINGS: PracticeSettings = { noiseGate: 0.012, tuningCents: 0, toleranceCents: 30 };

const store = createLocalStore<PracticeSettings>("ocarina-academy:practice-settings:v1", DEFAULT_SETTINGS);

export const usePracticeSettings = store.use;
export const savePracticeSettings = (patch: Partial<PracticeSettings>) => store.write({ ...store.read(), ...patch });
