import type { Arrangement } from "@/engine/music/schema";

const STYLES: Record<Arrangement["status"], { label: string; cls: string; dot: string }> = {
  verified: { label: "Verified", cls: "border-leaf-400/50 text-leaf-400 bg-leaf-500/10", dot: "bg-leaf-400" },
  partial: { label: "Partial", cls: "border-gold-400/60 text-gold-300 bg-gold-500/10", dot: "bg-gold-400" },
  "needs-transcription": {
    label: "Needs transcription",
    cls: "border-parchment-300/30 text-parchment-300/80 bg-white/5",
    dot: "bg-parchment-300/60",
  },
};

/** Badge text is derived from data status only — never written by hand. */
export function StatusBadge({ arrangement, prefix }: { arrangement: Arrangement; prefix?: string }) {
  const s = STYLES[arrangement.status];
  return (
    <span className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-xs tracking-wide ${s.cls}`}>
      <span className={`size-1.5 rounded-full ${s.dot}`} />
      {prefix && <span className="opacity-75">{prefix}:</span>}
      {s.label}
    </span>
  );
}
