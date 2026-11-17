import Link from "next/link";

/** Song Library header with its two shelves: the bundled songs and your songs. */
export function LibraryHeader({ active, intro }: { active: "oot" | "yours"; intro: string }) {
  const tabs = [
    { id: "oot", label: "Ocarina of Time", href: "/library/" },
    { id: "yours", label: "Your songs", href: "/library/yours/" },
  ] as const;
  return (
    <>
      <header className="mb-6 text-center">
        <p className="font-display text-xs tracking-[0.4em] text-gold-300/80">THE SONGBOOK</p>
        <h1 className="mt-2 font-display text-4xl text-parchment-50">Song Library</h1>
        <div className="filigree mx-auto my-4 max-w-xs" />
        <p className="mx-auto max-w-xl font-serif text-parchment-200/70">{intro}</p>
      </header>
      <nav aria-label="Song shelves" className="mb-8 flex justify-center border-b border-gold-500/20">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={t.href}
            aria-current={active === t.id ? "page" : undefined}
            className={`border-b-2 px-4 py-2.5 font-display text-xs tracking-widest transition sm:px-6 ${
              active === t.id ? "border-gold-300 text-gold-200" : "border-transparent text-parchment-200/60 hover:text-parchment-50"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
