import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SONGS, getSong } from "@/data/songs";
import { SongView } from "@/components/SongView";

export function generateStaticParams() {
  return SONGS.map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const song = getSong((await params).id);
  return { title: song?.title ?? "Song" };
}

export default async function SongPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!getSong(id)) notFound();
  return <SongView songId={id} tab="overview" />;
}
