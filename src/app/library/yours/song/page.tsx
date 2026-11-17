import type { Metadata } from "next";
import { Suspense } from "react";
import { UserSongView } from "@/components/UserSongView";

export const metadata: Metadata = { title: "Your song" };

export default function UserSongPage() {
  return (
    <Suspense>
      <UserSongView />
    </Suspense>
  );
}
