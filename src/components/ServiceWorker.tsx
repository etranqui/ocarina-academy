"use client";

import { useEffect, useState } from "react";
import { asset } from "@/lib/basePath";

/**
 * Registers the offline service worker (production builds only) and shows a
 * small notice when a new version has been installed or the device is offline.
 */
export function ServiceWorker() {
  const [updated, setUpdated] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);

    let onChange: (() => void) | null = null;
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      const hadController = !!navigator.serviceWorker.controller;
      onChange = () => {
        if (hadController) setUpdated(true); // first install needs no notice
      };
      navigator.serviceWorker.addEventListener("controllerchange", onChange);
      navigator.serviceWorker.register(asset("/sw.js")).catch(() => {
        /* unsupported context (e.g. plain http on a LAN IP) — the app still works online */
      });
    }
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      if (onChange) navigator.serviceWorker.removeEventListener("controllerchange", onChange);
    };
  }, []);

  if (!updated && !offline) return null;
  return (
    <div role="status" className="fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 sm:bottom-6">
      <div className="flex items-center gap-3 border border-gold-300/40 bg-forest-950/95 px-4 py-2 text-sm text-parchment-100 shadow-lg backdrop-blur">
        {updated ? (
          <>
            <span>A new version is ready.</span>
            <button onClick={() => location.reload()} className="font-display text-xs tracking-widest text-gold-200 underline">
              Reload
            </button>
          </>
        ) : (
          <span>Offline — songs, practice and your progress still work.</span>
        )}
      </div>
    </div>
  );
}
