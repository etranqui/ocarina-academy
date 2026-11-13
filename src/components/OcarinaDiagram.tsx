"use client";

import { useId } from "react";
import { DEFAULT_PROFILE, getFingering, HOLE_LABEL, transition } from "@/engine/fingering/engine";
import type { FingeringProfile, HoleDef } from "@/engine/fingering/types";
import { displayPitch } from "@/engine/music/pitch";

interface Props {
  pitch: string | null;
  /** Previous note, to highlight holes that change. */
  previousPitch?: string | null;
  variant?: "compact" | "large";
  showLabels?: boolean;
  /** Re-trigger change pulses when this key changes. */
  animationKey?: string | number;
  profile?: FingeringProfile;
  className?: string;
}

/**
 * Fingering diagram = static illustrated shell + SVG overlay in the same
 * coordinate space. Green = covered, open holes show the dark recess with an
 * ivory rim. Thumb holes sit on the underside and are drawn dashed.
 */
export function OcarinaDiagram({
  pitch,
  previousPitch,
  variant = "large",
  showLabels = false,
  animationKey,
  profile = DEFAULT_PROFILE,
  className = "",
}: Props) {
  const uid = useId().replace(/:/g, "");
  const fingering = pitch ? getFingering(pitch, profile) : null;
  const covered = new Set(fingering?.covered ?? []);
  const change =
    previousPitch !== undefined && pitch
      ? transition(previousPitch ? getFingering(previousPitch, profile) : null, fingering)
      : { lift: [], press: [] };
  const changed = new Set([...change.lift, ...change.press]);
  const { width, height } = profile.shell.viewBox;
  const compact = variant === "compact";

  const label = fingering
    ? `${displayPitch(fingering.pitch)} fingering: ${
        fingering.covered.length ? fingering.covered.map((h) => HOLE_LABEL[h]).join(", ") + " covered" : "all holes open"
      }`
    : pitch
      ? `${pitch}: no fingering`
      : "Ocarina";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      className={`block w-full select-none ${className}`}
    >
      <defs>
        <radialGradient id={`cov-${uid}`} cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#b8f5c8" />
          <stop offset="0.35" stopColor="#4cd383" />
          <stop offset="1" stopColor="#1a8a49" />
        </radialGradient>
        <filter id={`glow-${uid}`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <image href={profile.shell.href} width={width} height={height} />

      {profile.holes.map((h) => (
        <Hole
          key={h.id}
          hole={h}
          covered={covered.has(h.id)}
          changed={changed.has(h.id)}
          pulseKey={`${animationKey ?? pitch}-${h.id}`}
          fillId={`cov-${uid}`}
          glowId={`glow-${uid}`}
          compact={compact}
          showLabel={showLabels}
        />
      ))}

      {!fingering && pitch && (
        <text x={width / 2} y={height - 30} textAnchor="middle" fontSize="34" fill="#f6eedb" opacity="0.9">
          No fingering for {pitch}
        </text>
      )}
    </svg>
  );
}

function Hole({
  hole: h,
  covered,
  changed,
  pulseKey,
  fillId,
  glowId,
  compact,
  showLabel,
}: {
  hole: HoleDef;
  covered: boolean;
  changed: boolean;
  pulseKey: string;
  fillId: string;
  glowId: string;
  compact: boolean;
  showLabel: boolean;
}) {
  // Small sub-holes need a minimum visual size to stay readable.
  const r = Math.max(h.r, compact ? 13 : 10);
  const thumb = h.underside;
  const ring = compact ? 5 : 3.5;

  return (
    <g>
      {thumb && (
        // Underside hole: dashed halo marks it as "behind the instrument".
        <circle
          cx={h.x}
          cy={h.y}
          r={r + (compact ? 14 : 11)}
          fill="rgba(6,12,30,0.35)"
          stroke="#f6eedb"
          strokeOpacity={0.9}
          strokeWidth={compact ? 5 : 3}
          strokeDasharray={compact ? "9 8" : "6 6"}
        />
      )}
      <circle
        cx={h.x}
        cy={h.y}
        r={r}
        className={`hole ${covered ? "hole-covered" : "hole-open"}`}
        fill={covered ? `url(#${fillId})` : thumb ? "rgba(4,8,22,0.85)" : "transparent"}
        stroke={covered ? "#0f5e31" : "#f6eedb"}
        strokeOpacity={covered ? 1 : thumb ? 0.4 : 0.5}
        strokeWidth={ring}
        filter={covered && !compact ? `url(#${glowId})` : undefined}
      />
      {thumb && !compact && (
        <text x={h.x} y={h.y + 7} textAnchor="middle" fontSize="20" fontWeight={700} fill={covered ? "#0b3d20" : "#f6eedb"} opacity={0.8}>
          T
        </text>
      )}
      {changed && (
        <circle
          key={pulseKey}
          cx={h.x}
          cy={h.y}
          r={r}
          fill="none"
          stroke="#e8cf86"
          strokeWidth={compact ? 6 : 4}
          className="hole-change"
        />
      )}
      {showLabel && (
        <text
          x={h.x}
          y={h.kind === "sub" ? h.y + r + 22 : thumb ? h.y + r + 34 : h.y - r - 12}
          textAnchor="middle"
          fontSize={h.kind === "sub" ? 18 : 22}
          fontWeight={600}
          fill="#fdf9ef"
          stroke="#0b1a3e"
          strokeWidth={4}
          paintOrder="stroke"
        >
          {thumb ? `${h.id} · underside` : h.id}
        </text>
      )}
    </g>
  );
}
