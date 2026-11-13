import type { MetadataRoute } from "next";
import { asset } from "@/lib/basePath";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: asset("/"),
    name: "Ocarina Academy",
    short_name: "Ocarina",
    description: "Learn the songs of Ocarina of Time on a real 12-hole Alto C ocarina.",
    start_url: asset("/"),
    scope: asset("/"),
    display: "standalone",
    orientation: "any",
    background_color: "#0e1f15",
    theme_color: "#0e1f15",
    categories: ["education", "music"],
    icons: [
      { src: asset("/icons/icon-192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: asset("/icons/icon-512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: asset("/icons/icon-maskable-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Song Library", url: asset("/library/") },
      { name: "Fingering chart", url: asset("/fingerings/") },
      { name: "My progress", url: asset("/progress/") },
    ],
  };
}
