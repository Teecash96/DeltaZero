"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";

const navItems = [
  { href: "/risk-engine", label: "Risk Engine" },
  { href: "/agent", label: "Agent Console" },
  { href: "/hyperliquid-live", label: "Hyperliquid Live" },
];

function isActive(pathname: string, href: string) {
  if (href.startsWith("/#")) {
    return pathname === "/";
  }
  return pathname === href;
}

export function SiteHeader() {
  const pathname = usePathname();

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
        <ThemeToggle />
      </nav>
    </header>
  );
}
