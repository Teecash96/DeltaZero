import { getRiskZone, type RiskZoneInput } from "@/lib/risk-zones";

export function RiskZonePanel({ metrics }: { metrics: RiskZoneInput }) {
  const result = getRiskZone(metrics);

  return (
    <section className={`panel risk-zone-panel risk-zone-${result.zone.toLowerCase()}`} aria-labelledby="risk-zone-title">
      <div className="risk-zone-heading">
        <div>
          <span>DeltaZero Risk Zone</span>
          <small>Deterministic metric interpretation</small>
        </div>
        <i aria-hidden="true"><b style={{ width: `${result.severity * 20}%` }} /></i>
      </div>
      <div className="risk-zone-layout">
        <div className="risk-zone-summary">
          <strong id="risk-zone-title">{result.zone}</strong>
          <p>{result.explanation}</p>
          <small>{result.metricInterpretation}</small>
        </div>
        <div className="risk-zone-action">
          <span>Recommended operator action</span>
          <p>{result.action}</p>
        </div>
        <div className="risk-zone-drivers">
          <span>Key drivers</span>
          {result.keyDrivers.length > 0 ? (
            <ul>{result.keyDrivers.map((driver) => <li key={driver}>{driver}</li>)}</ul>
          ) : (
            <p>Available metrics remain inside the selected zone thresholds.</p>
          )}
        </div>
      </div>
    </section>
  );
}
