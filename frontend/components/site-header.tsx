"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";

const navItems = [
  { href: "/risk-engine", label: "Risk Engine" },
  { href: "/agent", label: "Agent Console" },
  { href: "/registry", label: "Strategy Registry" },
];

function isActive(pathname: string, href: string) {
  if (href.startsWith("/#")) {
    return pathname === "/";
  }
  return pathname === href;
}

export function SiteHeader() {
  const pathname = usePathname();
  const protocolDataActive = pathname === "/hyperliquid-live" || pathname === "/wallet";

  return (
    <header className="site-header">
      <div className="site-brand-block">
        <Link href="/" className="logo" aria-label="DeltaZero home">
          <span className="logo-mark">Δ</span>DELTA<span>ZERO</span>
        </Link>
      </div>
      <nav aria-label="Primary navigation">
        {navItems.map((item) => {
          const active = isActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`site-nav-link${active ? " site-nav-active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
        <details className="site-nav-menu">
          <summary className={`site-nav-link${protocolDataActive ? " site-nav-active" : ""}`}>
            Protocol Data <span aria-hidden="true">⌄</span>
          </summary>
          <div className="site-nav-menu-panel">
            <Link href="/hyperliquid-live">
              <strong>Hyperliquid</strong>
              <small>Free live market and funding</small>
            </Link>
            <Link href="/wallet?protocol=aave">
              <strong>Aave</strong>
              <small>Free read-only lending positions</small>
            </Link>
            <Link href="/wallet?protocol=morpho">
              <strong>Morpho</strong>
              <small>Free read-only market and vault positions</small>
            </Link>
          </div>
        </details>
        <ThemeToggle />
      </nav>
    </header>
  );
}
