import type { PitchName } from "../music/pitch";

/**
 * L1–L4 = left index→pinky, LS = left sub-hole, LT = left thumb
 * R1–R4 = right index→pinky, RS = right sub-hole, RT = right thumb
 */
export type HoleId =
  | "L1" | "L2" | "L3" | "L4" | "LS" | "LT"
  | "R1" | "R2" | "R3" | "R4" | "RS" | "RT";

export interface HoleDef {
  id: HoleId;
  hand: "left" | "right";
  finger: "index" | "middle" | "ring" | "pinky" | "thumb";
  kind: "main" | "sub" | "thumb";
  /** Centre + radius in the shell artwork's coordinate space (player's view). */
  x: number;
  y: number;
  r: number;
  /** Thumb holes sit on the underside and are drawn as projections. */
  underside?: boolean;
}

/**
 * user-chart – read directly from the user-supplied Saria's Song chart.
 * standard   – follows the opening order the chart demonstrates (documented in the profile).
 * full-chart – read from the user-supplied full 12-hole Alto C fingering chart.
 */
export type FingeringEvidence = "user-chart" | "standard" | "full-chart";

export interface Fingering {
  pitch: PitchName;
  covered: HoleId[];
  evidence: FingeringEvidence;
  note?: string;
}

export interface ShellArtwork {
  /** Path under /public. Swap for a photo of your own replica; then retune hole x/y/r. */
  href: string;
  viewBox: { width: number; height: number };
}

export interface FingeringProfile {
  id: string;
  name: string;
  description: string;
  /** Sounding pitch with every hole covered / uncovered. */
  range: { low: PitchName; high: PitchName };
  shell: ShellArtwork;
  holes: HoleDef[];
  fingerings: Fingering[];
  /** Notes in range intentionally left undefined, with the reason. */
  undefinedNotes: { pitches: PitchName[]; reason: string }[];
}
