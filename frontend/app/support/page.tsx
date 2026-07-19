import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support — DeltaZero",
  description: "Product, API, payment, and data-quality support for DeltaZero.",
};

export default function SupportPage() {
  return (
    <div className="workspace evidence-page support-page">
      <header className="page-intro">
        <div><p className="kicker">Akanbi Labs support</p><h1>How can we help?</h1><p>Use the right channel for product questions, payment issues, integration bugs, or data-quality reports. Never include private keys, seed phrases, admin keys, or API secrets.</p></div>
        <span className="endpoint">READ-ONLY SUPPORT</span>
      </header>
      <section className="support-grid">
        <article className="panel"><span>Product support</span><h2>Ask DeltaZero</h2><p>Questions about Strategy Build, Hedge Intelligence, Funding Stress Testing, Monte Carlo, or Agent Console.</p><a className="button button-secondary" href="https://x.com/DeltaZeroASP" target="_blank" rel="noreferrer">Message on X</a></article>
        <article className="panel"><span>Bug reports</span><h2>Open an issue</h2><p>Report reproducible UI, API, integration, or data-quality problems in the public repository.</p><a className="button button-secondary" href="https://github.com/Teecash96/DeltaZero/issues/new" target="_blank" rel="noreferrer">Create GitHub issue</a></article>
        <article className="panel"><span>Developer help</span><h2>Inspect the API</h2><p>Review live schemas, validation rules, response formats, and temporarily free analysis endpoints.</p><a className="button button-secondary" href="https://deltazero-production.up.railway.app/docs" target="_blank" rel="noreferrer">Open API docs</a></article>
      </section>
      <section className="panel support-checklist">
        <div className="methodology-heading"><span>Faster resolution</span><h2>What to include</h2></div>
        <ol><li>The page or API route involved.</li><li>The approximate time and your timezone.</li><li>The wallet address only if it is already public and relevant.</li><li>A screenshot with secrets and personal information removed.</li><li>The expected result and what happened instead.</li></ol>
      </section>
      <section className="panel support-safety"><strong>Security boundary</strong><p>DeltaZero support will never ask for your seed phrase, private key, wallet approval, admin bypass key, OKX API secret, or payment passphrase.</p></section>
    </div>
  );
}
