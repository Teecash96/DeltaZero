import Link from "next/link";

const quickLinks = [
  { label: "Home", href: "/#home" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Products", href: "/#products" },
  { label: "Integrations", href: "/#integrations" },
  { label: "Docs", href: "/#docs" },
  { label: "Methodology", href: "/methodology" },
  { label: "Strategy Registry", href: "/registry" },
  { label: "Support", href: "/support" },
  { label: "Agents", href: "/#agents" },
  { label: "FAQs", href: "/#faqs" },
];

const externalLinks = [
  { label: "GitHub", href: "https://github.com/Teecash96/DeltaZero" },
  { label: "X", href: "https://x.com/DeltaZeroASP" },
  { label: "Live Demo", href: "https://delta-zero-alpha.vercel.app" },
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-columns">
        <div>
          <strong>Quick links</strong>
          <nav aria-label="Footer quick links">
            {quickLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div>
          <strong>External links</strong>
          <nav aria-label="Footer external links">
            {externalLinks.map((link) => (
              <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </div>

      <div className="footer-brand">
        <Link href="/" className="logo footer-logo" aria-label="DeltaZero home">
          <span className="logo-mark">Δ</span>
          DELTA<span>ZERO</span>
        </Link>
        <a className="footer-license" href="https://github.com/Teecash96/DeltaZero/blob/main/LICENSE" target="_blank" rel="noreferrer">
          MIT Licensed
        </a>
        <small className="footer-copyright">Copyright © 2026 Akanbi Labs</small>
      </div>
    </footer>
  );
}
