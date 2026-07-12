import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = { title: "DeltaZero — Neutral Carry Intelligence", description: "Deterministic risk analysis for pseudo-delta-neutral DeFi strategies." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link href="/" className="logo" aria-label="DeltaZero home">
            <span className="logo-mark">Δ</span>DELTA<span>ZERO</span>
          </Link>
          <nav aria-label="Primary navigation">
            <Link href="/builder">Builder</Link>
            <Link href="/auditor">Auditor</Link>
            <Link href="/stress-test">Stress Test</Link>
            <Link href="/#how-it-works">How It Works</Link>
          </nav>
        </header>
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
