import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
      <p className="font-display text-xs tracking-[0.4em] text-gold-300/80">LOST IN THE WOODS</p>
      <h1 className="mt-2 font-display text-4xl text-parchment-50">Page not found</h1>
      <div className="filigree mx-auto my-4 max-w-xs" />
      <p className="font-serif text-parchment-200/75">This path leads nowhere. Head back and pick a song.</p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/" className="bg-gradient-to-b from-gold-300 to-gold-500 px-5 py-2 font-display text-xs tracking-widest text-forest-950 hover:brightness-110">
          Home
        </Link>
        <Link href="/library/" className="border border-gold-300/50 px-5 py-2 font-display text-xs tracking-widest text-gold-200 hover:bg-gold-300/10">
          Song Library
        </Link>
      </div>
    </div>
  );
}
