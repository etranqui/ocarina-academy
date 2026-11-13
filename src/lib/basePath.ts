/**
 * URL prefix the site is served under ("" at the root, "/ocarina-academy" on
 * GitHub Pages). Set at build time from BASE_PATH (see next.config.ts).
 * next/link and next/router add it on their own; use asset() for raw URLs
 * (images, the service worker, the web manifest).
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const asset = (path: string) => `${BASE_PATH}${path}`;
