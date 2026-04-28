import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { LangPicker } from "@/components/LangPicker";
import { getServerAuthSupabase } from "@/lib/supabase-server";
import { renderScopeBootScript } from "@/lib/account-scope";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EchoMind — The AI that listens",
  description:
    "Clinically-informed AI companion. Private, warm, always here. A speculative design artifact on emotional surveillance — built by NHSAST students at Sidi Abdallah, Algeria.",
  authors: [{ name: "NHSAST students · Sidi Abdallah, Algeria" }],
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Resolve the signed-in user server-side so we can inject the
  // correct account scope into the HTML before React hydrates. Any
  // failure (missing env, dead auth cookie, RLS hiccup) falls back
  // to the guest scope — the rest of the client still works, it
  // just runs under `guest` until /api/me resolves elsewhere.
  let authUserId: string | null = null;
  try {
    const supabase = getServerAuthSupabase();
    if (supabase) {
      const { data } = await supabase.auth.getUser();
      authUserId = data.user?.id ?? null;
    }
  } catch {
    authUserId = null;
  }
  const scopeBoot = renderScopeBootScript(authUserId);

  return (
    <html lang="en">
      <head>
        {/* Sets window.__echomindScope and wipes the `guest` bucket
             on sign-out/account-switch transitions. Runs before any
             client component so scoped localStorage reads are race-
             free from first paint. */}
        <script
          dangerouslySetInnerHTML={{ __html: scopeBoot }}
          suppressHydrationWarning
        />
      </head>
      <body
        className={`${fraunces.variable} ${inter.variable} ${jetbrains.variable} antialiased`}
      >
        <LangPicker />
        {children}
      </body>
    </html>
  );
}
