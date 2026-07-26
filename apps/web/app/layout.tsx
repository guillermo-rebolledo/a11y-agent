import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Accessibility Journey",
  description: "Accessible GitHub Project onboarding",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main"
          className="sr-only z-50 rounded bg-white px-4 py-3 text-slate-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to main content
        </a>
        <header className="border-b border-slate-800">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
            <a className="font-semibold no-underline" href="/">
              Accessibility Journey
            </a>
            <span className="rounded-full border border-amber-400/50 px-3 py-1 text-sm text-amber-200">
              Scaffold mode
            </span>
          </div>
        </header>
        {children}
        <footer className="mx-auto max-w-6xl border-t border-slate-800 px-6 py-8 text-sm text-slate-400">
          Deterministic accessibility checks. No automated conformance claims.
        </footer>
      </body>
    </html>
  );
}
