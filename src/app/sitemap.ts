import type { MetadataRoute } from "next";
import { SONGS } from "@/data/songs";
import { absolute } from "@/lib/basePath";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["/", "/library/", "/fingerings/", "/credits/"];
  const songs = SONGS.flatMap((s) => [`/songs/${s.id}/`, `/songs/${s.id}/listen/`, `/songs/${s.id}/practice/`]);
  return [...pages, ...songs].map((p) => ({ url: absolute(p) }));
}
