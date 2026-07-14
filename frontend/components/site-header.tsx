"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

import { hasDemoAccess, subscribeToDemoAccess } from "@/lib/demo-access";

const navItems = [
  { href: "/builder", label: "Builder" },
  { href: "/auditor", label: "Auditor" },
  { href: "/stress-test", label: "Stress Test" },
  { href: "/monte-carlo", label: "Monte Carlo" },
  { href: "/#how-it-works", label: "How It Works" },
];

function isActive(pathname: string, href: string) {
  if (href.startsWith("/#")) {
    return pathname === "/";
  }
  return pathname === href;
}

export function SiteHeader() {
  const pathname = usePathname();
  const demoAccessActive = useSyncExternalStore(subscribeToDemoAccess, hasDemoAccess, () => false);

  return (
    <header className="site-header">
      <div className="site-brand-block">
        <Link href="/" className="logo" aria-label="DeltaZero home">
          <span className="logo-mark">Δ</span>DELTA<span>ZERO</span>
        </Link>
        {demoAccessActive ? <span className="demo-access-indicator">Demo access active</span> : null}
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
      </nav>
    </header>
  );
}
