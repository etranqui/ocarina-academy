import type { FingeringProfile, HoleId } from "../types";

/**
 * Ocarina of Time replica, 12-hole Alto C (the app's only target instrument).
 *
 * Layout: player's view — looking down at the instrument while playing, wide
 * end on the left, tail on the right, mouthpiece pointing toward the player.
 * Hole positions were measured from the official replica product photo
 * (rotated 180°, since product shots face the audience) and agree with the
 * user-supplied Saria's Song chart: left sub-hole below the left ring finger,
 * right sub-hole above the right middle finger.
 *
 * Fingerings: E5, F5, G5, A5, B5, C6, D6 and E6 are read from the user's Saria's
 * Song chart. Every other note comes from the user's full 12-hole Alto C chart
 * (ocarinatabs.com/12-hole-ocarina-finger-chart), which is written an octave
 * lower (its A3 = A4 here) and agrees with the Saria chart on all shared notes.
 * Its forked sharps all add the right ring finger; the traxitabs song charts
 * draw some forks differently (F# with R2, B♭ with R1) — both work on many
 * ocarinas, but the app follows the full chart.
 */

const MAIN: HoleId[] = ["L1", "L2", "L3", "L4", "R1", "R2", "R3", "R4", "LT", "RT"];
const without = (...open: HoleId[]) => MAIN.filter((h) => !open.includes(h));

export const ootReplicaAltoC: FingeringProfile = {
  id: "oot-replica-alto-c",
  name: "Ocarina of Time replica · 12-hole Alto C",
  description:
    "Sounds A4–F6. Eight finger holes, two thumb holes and two sub-holes for the lowest notes.",
  range: { low: "A4", high: "F6" },
  shell: { href: "/ocarina/replica-shell.svg", viewBox: { width: 1120, height: 600 } },
  holes: [
    { id: "L4", hand: "left", finger: "pinky", kind: "main", x: 215, y: 177, r: 30 },
    { id: "L3", hand: "left", finger: "ring", kind: "main", x: 325, y: 185, r: 33 },
    { id: "LS", hand: "left", finger: "ring", kind: "sub", x: 345, y: 250, r: 9 },
    { id: "L2", hand: "left", finger: "middle", kind: "main", x: 445, y: 180, r: 29 },
    { id: "L1", hand: "left", finger: "index", kind: "main", x: 565, y: 122, r: 25 },
    { id: "R1", hand: "right", finger: "index", kind: "main", x: 590, y: 248, r: 26 },
    { id: "RS", hand: "right", finger: "middle", kind: "sub", x: 688, y: 135, r: 9 },
    { id: "R2", hand: "right", finger: "middle", kind: "main", x: 690, y: 182, r: 15 },
    { id: "R3", hand: "right", finger: "ring", kind: "main", x: 816, y: 163, r: 22 },
    { id: "R4", hand: "right", finger: "pinky", kind: "main", x: 928, y: 155, r: 14 },
    { id: "LT", hand: "left", finger: "thumb", kind: "thumb", x: 232, y: 292, r: 26, underside: true },
    { id: "RT", hand: "right", finger: "thumb", kind: "thumb", x: 680, y: 292, r: 24, underside: true },
  ],
  fingerings: [
    { pitch: "A4", covered: [...without(), "LS", "RS"], evidence: "full-chart", note: "Every hole covered, both sub-holes too." },
    { pitch: "A#4", covered: [...without(), "LS"], evidence: "full-chart", note: "All main holes plus the left sub-hole." },
    { pitch: "B4", covered: [...without(), "RS"], evidence: "full-chart", note: "All main holes plus the right sub-hole." },
    { pitch: "C5", covered: without(), evidence: "full-chart", note: "All ten main holes covered; sub-holes open." },
    { pitch: "C#5", covered: [...without("R4"), "RS"], evidence: "full-chart", note: "D fingering plus the right sub-hole." },
    { pitch: "D5", covered: without("R4"), evidence: "full-chart", note: "Lift the right pinky." },
    { pitch: "D#5", covered: [...without("R3", "R4"), "RS"], evidence: "full-chart", note: "E fingering plus the right sub-hole." },
    { pitch: "E5", covered: without("R3", "R4"), evidence: "user-chart" },
    { pitch: "F5", covered: without("R2", "R3", "R4"), evidence: "user-chart" },
    { pitch: "F#5", covered: ["L1", "L2", "L3", "L4", "R3", "LT", "RT"], evidence: "full-chart", note: "Forked: G fingering plus the right ring finger." },
    { pitch: "G5", covered: ["L1", "L2", "L3", "L4", "LT", "RT"], evidence: "user-chart", note: "Right-hand fingers all lifted." },
    { pitch: "G#5", covered: ["L1", "L3", "L4", "R3", "LT", "RT"], evidence: "full-chart", note: "Forked: A fingering plus the right ring finger." },
    { pitch: "A5", covered: ["L1", "L3", "L4", "LT", "RT"], evidence: "user-chart", note: "Lift the left middle finger." },
    { pitch: "A#5", covered: ["L1", "L4", "R3", "LT", "RT"], evidence: "full-chart", note: "Forked: B fingering plus the right ring finger (B♭)." },
    { pitch: "B5", covered: ["L1", "L4", "LT", "RT"], evidence: "user-chart" },
    { pitch: "C6", covered: ["L1", "LT", "RT"], evidence: "user-chart" },
    { pitch: "C#6", covered: ["L1", "R3", "RT"], evidence: "full-chart", note: "Forked: D fingering plus the right ring finger." },
    { pitch: "D6", covered: ["L1", "RT"], evidence: "user-chart", note: "Lift the left thumb." },
    { pitch: "D#6", covered: ["L1", "R3"], evidence: "full-chart", note: "Forked: E fingering plus the right ring finger." },
    { pitch: "E6", covered: ["L1"], evidence: "user-chart", note: "Both thumbs lifted; left index stays down." },
    { pitch: "F6", covered: [], evidence: "full-chart", note: "Every hole open." },
  ],
  undefinedNotes: [],
};
