import type { NextConfig } from "next";

/**
 * Standalone, serverless app: `next build` emits a static site in /out
 * that can be hosted anywhere (GitHub Pages, Netlify, any HTTPS file host).
 * All audio, pitch detection, imports and progress run in the browser.
 */
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
