"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Home", icon: "M4 11 L12 4 L20 11 M6 10 V20 H18 V10" },
  { href: "/library", label: "Song Library", icon: "M5 4 V20 M10 4 V20 M15 5 L19 19 M5 4 H10" },
  { href: "/fingerings", label: "Fingerings", icon: "M3 13 C3 8 9 6 15 7 C19 8 21 10 21 12 C21 15 16 17 10 17 C6 17 3 16 3 13 Z" },
  { href: "/progress", label: "Progress", icon: "M6 20 V14 M12 20 V9 M18 20 V5 M3 20 H21" },
  { href: "/credits", label: "Credits", icon: "M12 3 L14.6 9 L21 9.5 L16 13.6 L17.6 20 L12 16.6 L6.4 20 L8 13.6 L3 9.5 L9.4 9 Z" },
];

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href) || (href === "/library" && path.startsWith("/songs"));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-gold-500/20 bg-forest-950/75 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="group flex items-center gap-3">
            <Crest />
            <span className="font-display text-lg tracking-[0.12em] text-gold-200 group-hover:text-gold-300">
              Ocarina Academy
            </span>
          </Link>
          <nav className="hidden gap-1 sm:flex" aria-label="Main">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`px-3 py-2 font-display text-sm tracking-widest transition-colors ${
                  isActive(path, n.href) ? "text-gold-200" : "text-parchment-200/70 hover:text-parchment-50"
                }`}
              >
                {n.label}
                <span
                  className={`mx-auto mt-1 block h-px bg-gold-400 transition-all ${isActive(path, n.href) ? "w-full" : "w-0"}`}
                />
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 pb-8 sm:pb-12">{children}</main>

      <footer className="border-t border-gold-500/10 px-4 pt-6 pb-24 text-center text-xs text-parchment-300/50 sm:pb-6">
        A fan-made learning companion. Not affiliated with or endorsed by Nintendo.{" "}
        <Link href="/credits/" className="text-gold-300/80 underline hover:text-gold-200">
          Credits
        </Link>
      </footer>

      {/* Mobile tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-gold-500/25 bg-forest-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
      >
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`flex flex-col items-center gap-1 py-2.5 text-[11px] tracking-wider ${
              isActive(path, n.href) ? "text-gold-200" : "text-parchment-200/60"
            }`}
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d={n.icon} />
            </svg>
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** Original crest: a leaf over a gold diamond. */
export function Crest({ size = 34 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden>
      <defs>
        <linearGradient id="crest-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3e2a9" />
          <stop offset="0.5" stopColor="#d6b25a" />
          <stop offset="1" stopColor="#94702a" />
        </linearGradient>
      </defs>
      <path d="M20 2 L38 20 L20 38 L2 20 Z" fill="none" stroke="url(#crest-g)" strokeWidth="2" />
      <path d="M20 8 L32 20 L20 32 L8 20 Z" fill="#15301f" stroke="url(#crest-g)" strokeWidth="1" opacity="0.9" />
      <path d="M20 11 C27 16 27 24 20 29 C13 24 13 16 20 11 Z" fill="#4cc27a" />
      <path d="M20 13 L20 28" stroke="#0e1f15" strokeWidth="1" />
    </svg>
  );
}
