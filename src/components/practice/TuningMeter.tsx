"use client";

/** Needle meter from −60 to +60 cents; the green zone is the accepted tolerance. */
export function TuningMeter({ cents, tolerance, active }: { cents: number | null; tolerance: number; active: boolean }) {
  const range = 60;
  const clamp = (c: number) => Math.max(-range, Math.min(range, c));
  const x = cents === null ? 50 : 50 + (clamp(cents) / range) * 50;
  const zone = (tolerance / range) * 50;
  const inTune = cents !== null && Math.abs(cents) <= tolerance;
  return (
    <div className="w-full select-none" aria-label={cents === null ? "No pitch" : `${Math.round(cents)} cents`}>
      <div className="relative h-9">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 bg-ink-900/12" />
        <div
          className="absolute top-1/2 h-3 -translate-y-1/2 bg-leaf-500/35"
          style={{ left: `${50 - zone}%`, width: `${zone * 2}%` }}
        />
        {[-50, -25, 0, 25, 50].map((c) => (
          <div
            key={c}
            className="absolute top-1/2 h-4 w-px -translate-y-1/2 bg-ink-700/40"
            style={{ left: `${50 + (c / range) * 50}%` }}
          />
        ))}
        <div
          className={`absolute top-0 h-9 w-1 -translate-x-1/2 rounded-full transition-[left,background-color,opacity] duration-100 ${
            inTune ? "bg-leaf-500" : "bg-gold-600"
          } ${active && cents !== null ? "opacity-100" : "opacity-25"}`}
          style={{ left: `${x}%` }}
        />
      </div>
      <div className="mt-0.5 flex justify-between text-[10px] uppercase tracking-wider text-ink-500">
        <span>Flat</span>
        <span className="tabular-nums">{cents === null || !active ? "—" : `${cents > 0 ? "+" : ""}${Math.round(cents)}¢`}</span>
        <span>Sharp</span>
      </div>
    </div>
  );
}

/** Circular progress for "hold the note". */
export function HoldRing({ value, size = 56 }: { value: number; size?: number }) {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="4" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#2fa35d"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 80ms linear" }}
      />
    </svg>
  );
}
