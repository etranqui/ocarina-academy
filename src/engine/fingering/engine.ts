import { canonicalPitch, chromaticRange, type PitchName } from "../music/pitch";
import type { Fingering, FingeringProfile, HoleDef, HoleId } from "./types";
import { ootReplicaAltoC } from "./profiles/oot-replica-alto-c";

export const DEFAULT_PROFILE = ootReplicaAltoC;

const indexCache = new WeakMap<FingeringProfile, Map<PitchName, Fingering>>();

function index(profile: FingeringProfile) {
  let map = indexCache.get(profile);
  if (!map) {
    map = new Map(profile.fingerings.map((f) => [canonicalPitch(f.pitch), f]));
    indexCache.set(profile, map);
  }
  return map;
}

/** Fingering for a pitch (any enharmonic spelling), or null if not defined. */
export function getFingering(pitch: PitchName, profile = DEFAULT_PROFILE): Fingering | null {
  return index(profile).get(canonicalPitch(pitch)) ?? null;
}

export const isPlayable = (pitch: PitchName, profile = DEFAULT_PROFILE) => getFingering(pitch, profile) !== null;

export function holeStates(f: Fingering | null, profile = DEFAULT_PROFILE): Record<HoleId, boolean> {
  const covered = new Set(f?.covered ?? []);
  return Object.fromEntries(profile.holes.map((h) => [h.id, covered.has(h.id)])) as Record<HoleId, boolean>;
}

export interface FingeringChange {
  lift: HoleId[];
  press: HoleId[];
}

/** Holes that change between two consecutive notes — drives transition hints. */
export function transition(from: Fingering | null, to: Fingering | null): FingeringChange {
  const a = new Set(from?.covered ?? []);
  const b = new Set(to?.covered ?? []);
  return {
    lift: [...a].filter((h) => !b.has(h)),
    press: [...b].filter((h) => !a.has(h)),
  };
}

export const holeById = (id: HoleId, profile = DEFAULT_PROFILE): HoleDef => {
  const h = profile.holes.find((x) => x.id === id);
  if (!h) throw new Error(`Unknown hole ${id}`);
  return h;
};

/** Every chromatic note in range with its fingering (null = not yet defined). */
export function chart(profile = DEFAULT_PROFILE): { pitch: PitchName; fingering: Fingering | null }[] {
  return chromaticRange(profile.range.low, profile.range.high).map((pitch) => ({
    pitch,
    fingering: getFingering(pitch, profile),
  }));
}

export const HOLE_LABEL: Record<HoleId, string> = {
  L1: "Left index",
  L2: "Left middle",
  L3: "Left ring",
  L4: "Left pinky",
  LS: "Left sub-hole",
  LT: "Left thumb",
  R1: "Right index",
  R2: "Right middle",
  R3: "Right ring",
  R4: "Right pinky",
  RS: "Right sub-hole",
  RT: "Right thumb",
};
