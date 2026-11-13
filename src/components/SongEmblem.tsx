import type { EmblemId, SongTheme } from "@/engine/music/schema";

/** Original line-art emblems, one per song, drawn in a 64×64 box. */
const GLYPHS: Record<EmblemId, React.ReactNode> = {
  harp: (
    <>
      <path d="M20 50 C18 30 26 14 44 12 C40 22 42 34 48 44" />
      <path d="M20 50 L48 44" />
      <path d="M27 46 L28 24 M34 45 L35 19 M41 44 L41 22" />
      <circle cx="44" cy="12" r="2.2" />
    </>
  ),
  horseshoe: (
    <>
      <path d="M20 46 L20 30 C20 18 26 12 32 12 C38 12 44 18 44 30 L44 46" strokeWidth="6" />
      <path d="M16 48 L24 48 M40 48 L48 48" />
      <circle cx="20" cy="26" r="1.4" /> <circle cx="44" cy="26" r="1.4" />
      <circle cx="21" cy="36" r="1.4" /> <circle cx="43" cy="36" r="1.4" />
    </>
  ),
  "leaf-flute": (
    <>
      <path d="M14 46 C20 22 40 14 52 14 C50 30 38 46 14 46 Z" />
      <path d="M14 46 C26 36 36 28 46 20" />
      <circle cx="26" cy="38" r="1.6" /> <circle cx="32" cy="33" r="1.6" /> <circle cx="38" cy="28" r="1.6" />
    </>
  ),
  sun: (
    <>
      <circle cx="32" cy="32" r="9" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6;
        const r1 = 14, r2 = i % 2 ? 19 : 23;
        return <path key={i} d={`M${32 + r1 * Math.cos(a)} ${32 + r1 * Math.sin(a)} L${32 + r2 * Math.cos(a)} ${32 + r2 * Math.sin(a)}`} />;
      })}
    </>
  ),
  hourglass: (
    <>
      <path d="M20 12 L44 12 M20 52 L44 52" />
      <path d="M22 12 C22 26 31 28 31 32 C31 36 22 38 22 52 M42 12 C42 26 33 28 33 32 C33 36 42 38 42 52" />
      <path d="M26 48 C28 42 36 42 38 48 Z" fill="currentColor" stroke="none" />
      <path d="M32 33 L32 44" strokeDasharray="1.5 3" />
    </>
  ),
  storm: (
    <>
      <path d="M18 34 C12 34 12 24 19 24 C20 16 32 14 35 21 C42 17 50 22 47 30 C52 31 51 38 46 38 L20 38" />
      <path d="M32 40 L27 48 L33 48 L29 56" />
      <path d="M20 44 L18 49 M42 42 L40 48" />
    </>
  ),
  leaf: (
    <>
      <path d="M32 54 C16 44 14 24 32 10 C50 24 48 44 32 54 Z" />
      <path d="M32 54 L32 18 M32 30 L24 24 M32 38 L40 31 M32 44 L25 39" />
    </>
  ),
  flame: (
    <>
      <path d="M32 54 C20 54 16 44 20 36 C22 42 26 42 26 38 C26 28 34 24 32 12 C42 18 48 30 46 40 C45 48 40 54 32 54 Z" />
      <path d="M32 50 C27 50 26 45 28 41 C30 44 32 43 32 40 C36 42 38 46 36 48" />
    </>
  ),
  wave: (
    <>
      <path d="M10 30 C16 22 22 22 26 28 C30 34 36 34 40 26 C44 18 52 20 54 26" />
      <path d="M10 40 C16 32 22 32 26 38 C30 44 36 44 40 36 C44 28 52 30 54 36" />
      <circle cx="44" cy="16" r="2" /> <circle cx="20" cy="50" r="1.6" />
    </>
  ),
  dune: (
    <>
      <path d="M8 48 C18 38 28 38 36 44 C42 36 50 34 56 40" />
      <path d="M8 54 L56 54" />
      <path d="M24 38 L24 16 L32 10 L40 16 L40 36" />
      <path d="M28 22 L36 22 M28 28 L36 28" />
    </>
  ),
  moon: (
    <>
      <path d="M40 12 C28 14 20 24 22 36 C24 47 36 54 48 50 C36 48 30 38 32 28 C33 20 36 15 40 12 Z" />
      <circle cx="46" cy="22" r="1.4" /> <circle cx="50" cy="34" r="1" /> <circle cx="16" cy="18" r="1.2" />
    </>
  ),
  rays: (
    <>
      <path d="M32 10 L36 28 L54 32 L36 36 L32 54 L28 36 L10 32 L28 28 Z" />
      <path d="M20 20 L25 25 M44 20 L39 25 M20 44 L25 39 M44 44 L39 39" />
    </>
  ),
};

export function SongEmblem({ theme, size = 88, className = "" }: { theme: SongTheme; size?: number; className?: string }) {
  const id = `emb-${theme.emblem}`;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden>
      <defs>
        <radialGradient id={`${id}-bg`} cx="0.4" cy="0.35" r="0.75">
          <stop offset="0" stopColor={theme.color} stopOpacity="0.55" />
          <stop offset="0.6" stopColor={theme.deep} stopOpacity="0.95" />
          <stop offset="1" stopColor="#08130d" />
        </radialGradient>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3e2a9" />
          <stop offset="0.5" stopColor="#bf963b" />
          <stop offset="1" stopColor="#6b4f1a" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="47" fill={`url(#${id}-bg)`} stroke={`url(#${id}-rim)`} strokeWidth="3" />
      <circle cx="50" cy="50" r="40" fill="none" stroke="#e8cf86" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="2 4" />
      <g
        transform="translate(18 18)"
        fill="none"
        stroke={theme.color}
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: theme.color, filter: `drop-shadow(0 0 4px ${theme.color})` }}
      >
        {GLYPHS[theme.emblem]}
      </g>
    </svg>
  );
}
