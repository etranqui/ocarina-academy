import type { NextConfig } from "next";

/**
 * Standalone, serverless app: `next build` emits a static site in /out
 * that can be hosted anywhere (GitHub Pages, Netlify, any HTTPS file host).
 * All audio, pitch detection, imports and progress run in the browser.
 */
// Served under a sub-path on GitHub Pages: BASE_PATH=/ocarina-academy npm run build
const basePath = process.env.BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
