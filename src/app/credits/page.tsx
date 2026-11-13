import type { Metadata } from "next";

export const metadata: Metadata = { title: "Credits" };

const ITEMS = [
  {
    title: "The music",
    body: "The songs of The Legend of Zelda: Ocarina of Time were composed by Koji Kondo for Nintendo. All rights to the music and the game belong to Nintendo.",
  },
  {
    title: "Tabs and charts",
    body: "The full arrangements and the 12-hole fingering chart were put together with help from the ocarina community's tabs, including ocarinatabs.com and traxitabs.",
  },
  {
    title: "This app",
    body: "Ocarina Academy is a free, fan-made learning companion. It is not affiliated with or endorsed by Nintendo. All artwork in the app is original.",
  },
];

export default function CreditsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-8 text-center">
        <p className="font-display text-xs tracking-[0.4em] text-gold-300/80">ACKNOWLEDGEMENTS</p>
        <h1 className="mt-2 font-display text-4xl text-parchment-50">Credits</h1>
        <div className="filigree mx-auto my-4 max-w-xs" />
      </header>
      <div className="space-y-4">
        {ITEMS.map((i) => (
          <section key={i.title} className="panel p-5 sm:p-6">
            <h2 className="font-display text-sm tracking-widest text-gold-200">{i.title}</h2>
            <p className="mt-2 font-serif text-parchment-200/80">{i.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
