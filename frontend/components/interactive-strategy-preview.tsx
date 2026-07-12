"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type StrategyStyle = "conservative_income" | "aggressive_carry";
type Volatility = "low" | "medium" | "high";

const PRESETS: Record<StrategyStyle, Record<Volatility, { carry: number; drift: number; buffer: number; action: string; longExposure: number; shortHedge: number }>> = {
  conservative_income: {
    low: { carry: 6.2, drift: 2.0, buffer: 86, action: "OPEN", longExposure: 70, shortHedge: 68 },
    medium: { carry: 5.4, drift: 5.0, buffer: 76, action: "HOLD", longExposure: 70, shortHedge: 64 },
    high: { carry: 3.1, drift: 9.0, buffer: 61, action: "REBALANCE", longExposure: 70, shortHedge: 58 },
  },
  aggressive_carry: {
    low: { carry: 13.4, drift: 5.0, buffer: 69, action: "OPEN", longExposure: 84, shortHedge: 76 },
    medium: { carry: 10.8, drift: 11.0, buffer: 55, action: "REBALANCE", longExposure: 84, shortHedge: 64 },
    high: { carry: 4.2, drift: 19.0, buffer: 39, action: "WAIT", longExposure: 84, shortHedge: 48 },
  },
};

const volatilityLabels: Record<Volatility, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const styleLabels: Record<StrategyStyle, string> = {
  conservative_income: "Conservative Income",
  aggressive_carry: "Aggressive Carry",
};

export function InteractiveStrategyPreview() {
  const [style, setStyle] = useState<StrategyStyle>("conservative_income");
  const [volatility, setVolatility] = useState<Volatility>("medium");
  const preset = useMemo(() => PRESETS[style][volatility], [style, volatility]);

  return (
    <section className="hero-preview panel">
      <div className="hero-preview-head">
        <div>
          <span className="hero-preview-badge">Illustrative simulation</span>
          <h2>Interactive Strategy Preview</h2>
        </div>
        <Link href="/builder" className="hero-preview-cta">
          Run a full analysis <span aria-hidden="true">→</span>
        </Link>
      </div>
      <p className="hero-preview-copy">
        Explore how strategy style and market stress affect hedge drift, Safety Buffer, and the recommended action.
      </p>
      <div className="hero-preview-controls" role="tablist" aria-label="Strategy style">
        {(Object.keys(styleLabels) as StrategyStyle[]).map((option) => (
          <button
            key={option}
            type="button"
            className={`preview-toggle ${style === option ? "preview-toggle-active" : ""}`}
            onClick={() => setStyle(option)}
            aria-pressed={style === option}
          >
            {styleLabels[option]}
          </button>
        ))}
      </div>
      <div className="hero-preview-controls hero-preview-controls-secondary" role="tablist" aria-label="Market volatility">
        {(Object.keys(volatilityLabels) as Volatility[]).map((option) => (
          <button
            key={option}
            type="button"
            className={`preview-toggle ${volatility === option ? "preview-toggle-active" : ""}`}
            onClick={() => setVolatility(option)}
            aria-pressed={volatility === option}
          >
            {volatilityLabels[option]}
          </button>
        ))}
      </div>
      <div className="hero-preview-visual" aria-hidden="true">
        <div className="preview-bar preview-bar-long" style={{ width: `${preset.longExposure}%` }} />
        <div className="preview-bar preview-bar-short" style={{ width: `${preset.shortHedge}%` }} />
        <svg viewBox="0 0 320 84" className="preview-bridge">
          <path d="M18 21 C 88 12, 122 12, 160 34" />
          <path d="M160 34 C 198 56, 232 56, 302 21" />
        </svg>
      </div>
      <div className="hero-preview-summary">
        <div>
          <span>Strategy style</span>
          <strong>{styleLabels[style]}</strong>
        </div>
        <div>
          <span>Market volatility</span>
          <strong>{volatilityLabels[volatility]}</strong>
        </div>
        <div>
          <span>Estimated net carry APY</span>
          <strong>{preset.carry.toFixed(1)}%</strong>
        </div>
        <div>
          <span>Hedge drift</span>
          <strong>{preset.drift.toFixed(1)}%</strong>
        </div>
        <div>
          <span>Safety Buffer</span>
          <strong>{preset.buffer.toFixed(0)}</strong>
        </div>
        <div>
          <span>Recommended action</span>
          <strong className={`preview-action preview-action-${preset.action.toLowerCase()}`}>{preset.action}</strong>
        </div>
      </div>
    </section>
  );
}
