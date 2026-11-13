/**
 * MusicXML (score-partwise, uncompressed .musicxml/.xml) → ImportedMelody.
 *
 * Reads the first part, first voice. Handles divisions, time signatures,
 * tempo marks, rests, ties, chords (top-of-stack note kept), grace notes
 * (skipped), backup/forward, repeat barlines and 1st/2nd endings.
 * Uses only basic DOM calls so it runs on the browser DOMParser and in tests.
 */
import type { ImportedMelody, MelodyEvent } from "./types";

const STEP: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

interface ParsedMeasure {
  events: MelodyEvent[];
  forwardRepeat: boolean;
  backwardRepeat: boolean;
  endings: number[] | null;
  beats: number;
}

const kids = (el: Element) => Array.from(el.childNodes).filter((n): n is Element => n.nodeType === 1);
const child = (el: Element, tag: string) => kids(el).find((k) => k.tagName === tag) ?? null;
const text = (el: Element | null) => (el?.textContent ?? "").trim();
const num = (el: Element | null, fallback: number) => {
  const v = parseFloat(text(el));
  return Number.isFinite(v) ? v : fallback;
};

export function parseMusicXml(doc: Document): ImportedMelody {
  const root = doc.documentElement;
  if (!root || root.tagName === "parsererror" || doc.getElementsByTagName("parsererror").length)
    throw new Error("This file is not valid XML.");
  if (root.tagName === "score-timewise") throw new Error("Timewise MusicXML is not supported — export as partwise.");
  if (root.tagName !== "score-partwise") throw new Error("Not a MusicXML score.");

  const warnings: string[] = [];
  const parts = Array.from(root.getElementsByTagName("part"));
  if (!parts.length) throw new Error("The score has no parts.");
  if (parts.length > 1) warnings.push(`Score has ${parts.length} parts; using the first one.`);

  const title =
    text(root.getElementsByTagName("work-title")[0] ?? null) || text(root.getElementsByTagName("movement-title")[0] ?? null) || undefined;

  let divisions = 1;
  let timeSignature: [number, number] = [4, 4];
  let bpm: number | null = null;
  let firstVoice: string | null = null;
  let chordsSeen = false;
  let otherVoices = false;
  let activeEnding: number[] | null = null;

  const measures: ParsedMeasure[] = [];

  for (const m of kids(parts[0]).filter((k) => k.tagName === "measure")) {
    const pm: ParsedMeasure = { events: [], forwardRepeat: false, backwardRepeat: false, endings: activeEnding, beats: 0 };
    let inOtherVoice = false; // after <backup>, until <forward> / end of measure
    let pos = 0;

    for (const el of kids(m)) {
      switch (el.tagName) {
        case "attributes": {
          divisions = num(child(el, "divisions"), divisions);
          const time = child(el, "time");
          if (time && !measures.length && !pm.events.length) {
            timeSignature = [num(child(time, "beats"), 4), num(child(time, "beat-type"), 4)];
          } else if (time) {
            const ts: [number, number] = [num(child(time, "beats"), 4), num(child(time, "beat-type"), 4)];
            if (ts[0] !== timeSignature[0] || ts[1] !== timeSignature[1]) {
              warnings.push(`Time signature changes to ${ts[0]}/${ts[1]} in bar ${measures.length + 1}; bar lines use ${timeSignature[0]}/${timeSignature[1]}.`);
            }
          }
          break;
        }
        case "direction":
        case "sound": {
          const sound = el.tagName === "sound" ? el : el.getElementsByTagName("sound")[0];
          const t = sound?.getAttribute("tempo");
          if (t && bpm === null) bpm = parseFloat(t);
          break;
        }
        case "backup":
          inOtherVoice = true;
          pos -= num(child(el, "duration"), 0) / divisions;
          break;
        case "forward": {
          const beats = num(child(el, "duration"), 0) / divisions;
          if (!inOtherVoice && beats > 0) pm.events.push({ midi: null, beats });
          pos += beats;
          break;
        }
        case "note": {
          if (child(el, "grace")) break;
          const voice = text(child(el, "voice")) || "1";
          if (firstVoice === null) firstVoice = voice;
          if (voice !== firstVoice || inOtherVoice) {
            otherVoices = true;
            break;
          }
          const beats = num(child(el, "duration"), 0) / divisions;
          if (child(el, "chord")) {
            chordsSeen = true;
            // Keep the highest note of a chord (melody on top).
            const prev = pm.events[pm.events.length - 1];
            const midi = pitchOf(el);
            if (prev && prev.midi !== null && midi !== null && midi > prev.midi) prev.midi = midi;
            break;
          }
          if (beats <= 0) break;
          const isRest = !!child(el, "rest");
          const ties = kids(el).filter((k) => k.tagName === "tie");
          pm.events.push({
            midi: isRest ? null : pitchOf(el),
            beats,
            tie: ties.some((t) => t.getAttribute("type") === "start") || undefined,
          });
          pos += beats;
          break;
        }
        case "barline": {
          const rep = child(el, "repeat");
          if (rep?.getAttribute("direction") === "forward") pm.forwardRepeat = true;
          if (rep?.getAttribute("direction") === "backward") pm.backwardRepeat = true;
          const ending = child(el, "ending");
          if (ending) {
            const type = ending.getAttribute("type");
            const numbers = (ending.getAttribute("number") ?? "1")
              .split(/[,\s]+/)
              .map(Number)
              .filter(Number.isFinite);
            if (type === "start") {
              activeEnding = numbers;
              pm.endings = numbers;
            } else {
              activeEnding = null;
            }
          }
          break;
        }
      }
    }
    pm.beats = pm.events.reduce((s, e) => s + e.beats, 0);
    measures.push(pm);
  }

  if (chordsSeen) warnings.push("Chords found — only the top note of each chord is kept.");
  if (otherVoices) warnings.push("Extra voices found — only the first voice is kept.");

  // Expand repeats and endings into a play order.
  const order: number[] = [];
  let i = 0;
  let repeatStart = 0;
  let pass = 1;
  const repeated = new Set<number>();
  let guard = 0;
  while (i < measures.length && guard++ < 10000) {
    const m = measures[i];
    if (m.forwardRepeat && pass === 1) repeatStart = i;
    if (m.endings && !m.endings.includes(pass)) {
      i++;
      continue;
    }
    if (!m.endings && pass > 1 && i > 0 && measures[i - 1].endings) pass = 1;
    order.push(i);
    if (m.backwardRepeat && !repeated.has(i)) {
      repeated.add(i);
      pass++;
      i = repeatStart;
      continue;
    }
    if (m.backwardRepeat) pass = 1;
    i++;
  }

  const events: MelodyEvent[] = [];
  const barStarts: number[] = [];
  let beat = 0;
  for (const idx of order) {
    barStarts.push(beat);
    for (const e of measures[idx].events) events.push({ ...e });
    beat += measures[idx].beats;
  }

  if (!events.some((e) => e.midi !== null)) throw new Error("No notes found in the first part.");

  return {
    title,
    events: mergeRests(events),
    bpm: bpm ?? 100,
    timeSignature,
    barStarts,
    warnings: bpm === null ? [...warnings, "No tempo mark found; using 100 bpm."] : warnings,
  };
}

function pitchOf(note: Element): number | null {
  const p = child(note, "pitch");
  if (!p) return null;
  const step = text(child(p, "step"));
  const alter = Math.round(num(child(p, "alter"), 0));
  const octave = num(child(p, "octave"), 4);
  if (!(step in STEP)) return null;
  return (octave + 1) * 12 + STEP[step] + alter;
}

/** Join consecutive rests so the score shows fewer, longer rests. */
export function mergeRests(events: MelodyEvent[]): MelodyEvent[] {
  const out: MelodyEvent[] = [];
  for (const e of events) {
    const last = out[out.length - 1];
    if (e.midi === null && last && last.midi === null) last.beats += e.beats;
    else out.push(e);
  }
  return out;
}
