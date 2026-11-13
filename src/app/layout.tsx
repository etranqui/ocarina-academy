import type { Metadata, Viewport } from "next";
import { Alegreya, Alegreya_Sans, Cinzel } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

const cinzel = Cinzel({ subsets: ["latin"], variable: "--font-cinzel", weight: ["400", "600", "700"] });
const alegreya = Alegreya({ subsets: ["latin"], variable: "--font-alegreya", style: ["normal", "italic"] });
const alegreyaSans = Alegreya_Sans({ subsets: ["latin"], variable: "--font-alegreya-sans", weight: ["400", "500", "700"] });

export const metadata: Metadata = {
  title: { default: "Ocarina Academy", template: "%s · Ocarina Academy" },
  description: "Learn the songs of Ocarina of Time on a real 12-hole Alto C ocarina.",
  applicationName: "Ocarina Academy",
  appleWebApp: { capable: true, title: "Ocarina", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#0e1f15",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${alegreya.variable} ${alegreyaSans.variable}`}>
      <body className="antialiased">
        <AppShell>{children}</AppShell>
        <ServiceWorker />
      </body>
    </html>
  );
}
