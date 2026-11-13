/**
 * URL prefix the site is served under ("" at the root, "/ocarina-academy" on
 * GitHub Pages). Set at build time from BASE_PATH (see next.config.ts).
 * next/link and next/router add it on their own; use asset() for raw URLs
 * (images, the service worker, the web manifest).
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const asset = (path: string) => `${BASE_PATH}${path}`;

/** Public origin of the deployed site, for absolute URLs (share previews, sitemap). */
export const SITE_ORIGIN = process.env.SITE_URL ?? "https://etranqui.github.io";

/** Absolute URL of a page or file on the deployed site. */
export const absolute = (path: string) => `${SITE_ORIGIN}${asset(path)}`;
