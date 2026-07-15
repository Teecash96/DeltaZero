import Link from "next/link";

type AnalysisProvenanceProps = {
  source: string;
  sourceTimestamp?: string | null;
  generatedAt?: string | null;
  quality?: string | null;
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
  quality,
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
        <article><span>Data quality</span><strong>{quality ?? "User supplied"}</strong></article>
      </div>
      {note ? <p>{note}</p> : null}
    </section>
  );
}
