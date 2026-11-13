// Renders the app icons from the original crest artwork.
// Run once after changing the design: node scripts/make-icons.mjs
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

const crest = (scale) => `
  <g transform="translate(256 256) scale(${scale}) translate(-20 -20)">
    <path d="M20 2 L38 20 L20 38 L2 20 Z" fill="none" stroke="url(#g)" stroke-width="2"/>
    <path d="M20 8 L32 20 L20 32 L8 20 Z" fill="#15301f" stroke="url(#g)" stroke-width="1"/>
    <path d="M20 11 C27 16 27 24 20 29 C13 24 13 16 20 11 Z" fill="#4cc27a"/>
    <path d="M20 13 L20 28" stroke="#0e1f15" stroke-width="1"/>
  </g>`;

const svg = (scale, rounded) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f3e2a9"/><stop offset="0.5" stop-color="#d6b25a"/><stop offset="1" stop-color="#94702a"/>
    </linearGradient>
    <radialGradient id="bg" cx="0.5" cy="0.4" r="0.7">
      <stop offset="0" stop-color="#1d4029"/><stop offset="1" stop-color="#0b1a11"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" ${rounded ? 'rx="112"' : ""} fill="url(#bg)"/>
  ${crest(scale)}
</svg>`;

await mkdir("public/icons", { recursive: true });
const out = [
  ["icon-192.png", 192, svg(10, true)],
  ["icon-512.png", 512, svg(10, true)],
  // Maskable: full-bleed background, crest inside the 80% safe zone.
  ["icon-maskable-512.png", 512, svg(8, false)],
  ["apple-touch-icon.png", 180, svg(9.5, false)],
];
for (const [name, size, src] of out) {
  await sharp(Buffer.from(src)).resize(size, size).png().toFile(`public/icons/${name}`);
}
await writeFile("src/app/icon.svg", svg(10, true));
console.log("icons written");
