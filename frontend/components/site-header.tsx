"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/builder", label: "Builder" },
  { href: "/auditor", label: "Auditor" },
  { href: "/stress-test", label: "Stress Test" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/wallet", label: "Wallet Auditor", featured: true },
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
      <Link href="/" className="logo" aria-label="DeltaZero home">
        <span className="logo-mark">Δ</span>DELTA<span>ZERO</span>
      </Link>
      <nav aria-label="Primary navigation">
        {navItems.map((item) => {
          const active = isActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`site-nav-link${item.featured ? " site-nav-featured" : ""}${active ? " site-nav-active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
