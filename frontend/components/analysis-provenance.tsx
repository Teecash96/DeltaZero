import Link from "next/link";

type AnalysisProvenanceProps = {
  source: string;
  sourceTimestamp?: string | null;
  generatedAt?: string | null;
  freshness?: string;
  quality?: string | null;
  methodologyVersion?: string;
  formulas?: string[];
  thresholds?: string[];
  assumptions?: string[];
  limitations?: string[];
  note?: string;
};

function formatTimestamp(value?: string | null) {
  if (!value) return "Not supplied";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

export function AnalysisProvenance({
  source,
  sourceTimestamp,
  generatedAt,
  freshness,
  quality,
  methodologyVersion = "deltazero-v1",
  formulas = [],
  thresholds = [],
  assumptions = [],
  limitations = [],
  note,
}: AnalysisProvenanceProps) {
  return (
    <section className="panel provenance-panel" aria-label="Analysis data provenance">
      <div className="provenance-heading">
        <div>
          <span className="decision-eyebrow">Evidence trail</span>
          <h2 className="panel-title">Data provenance</h2>
        </div>
        <Link href="/methodology">Review methodology →</Link>
      </div>
      <div className="provenance-grid">
        <article><span>Source</span><strong>{source}</strong></article>
        <article><span>Source snapshot</span><strong>{formatTimestamp(sourceTimestamp)}</strong></article>
        <article><span>Report generated</span><strong>{formatTimestamp(generatedAt)}</strong></article>
        <article><span>Data freshness</span><strong>{freshness ?? (sourceTimestamp ? "Timestamped source snapshot" : "Not applicable")}</strong></article>
        <article><span>Data quality</span><strong>{quality ?? "User supplied"}</strong></article>
      </div>
      <details className="provenance-methodology" open>
        <summary><span><b>Methodology and assumptions</b><small>{methodologyVersion} · values shown are from this report</small></span><i aria-hidden="true">⌄</i></summary>
        <div className="provenance-evidence-grid">
          <article><span>Formula used</span><ul>{formulas.length ? formulas.map((item) => <li key={item}>{item}</li>) : <li>See the linked methodology record.</li>}</ul></article>
          <article><span>Threshold used</span><ul>{thresholds.length ? thresholds.map((item) => <li key={item}>{item}</li>) : <li>No threshold detail was returned.</li>}</ul></article>
          <article><span>Simulation assumptions</span><ul>{assumptions.length ? assumptions.map((item) => <li key={item}>{item}</li>) : <li>No simulation was used for this report.</li>}</ul></article>
          <article><span>Known limitations</span><ul>{limitations.length ? limitations.map((item) => <li key={item}>{item}</li>) : <li>Review the methodology page before acting.</li>}</ul></article>
        </div>
      </details>
      {note ? <p>{note}</p> : null}
    </section>
  );
}
