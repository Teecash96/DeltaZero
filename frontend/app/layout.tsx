import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = { title: "DeltaZero — Neutral Carry Intelligence", description: "Deterministic risk analysis for pseudo-delta-neutral DeFi strategies." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header"><Link href="/" className="logo"><span className="logo-mark">Δ</span>DELTA<span>ZERO</span></Link><nav><Link href="/builder">Builder</Link><Link href="/auditor">Auditor</Link><Link href="/stress-test">Stress Test</Link><Link href="/demo" className="nav-demo">Demo</Link></nav></header>
        <main>{children}</main>
        <footer><Link href="/" className="logo"><span className="logo-mark">Δ</span>DELTA<span>ZERO</span></Link><p>Decision support for neutral carry strategies.</p><span>Built for clear thinking.</span></footer>
      </body>
    </html>
  );
}
