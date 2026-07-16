"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getHyperliquidMarket } from "@/lib/api";
import type { HyperliquidMarketResponse } from "@/lib/types";

const ASSETS = ["SOL", "ETH", "BTC"] as const;

function usd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function compactUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function pct(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function HyperliquidLive() {
  const [asset, setAsset] = useState<(typeof ASSETS)[number]>("SOL");
  const [result, setResult] = useState<HyperliquidMarketResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh(selectedAsset = asset) {
    setLoading(true);
    setError(null);
    try {
      setResult(await getHyperliquidMarket(selectedAsset));
    } catch (caught) {
      setResult(null);
      setError(caught instanceof Error ? caught.message : "Hyperliquid data is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    getHyperliquidMarket("SOL")
      .then((data) => { if (active) setResult(data); })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Hyperliquid data is temporarily unavailable.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <div className="workspace hyperliquid-live-page">
      <header className="page-intro">
        <div>
          <p className="kicker"><span className="pulse-dot" />Free live data</p>
          <h1>Hyperliquid Live</h1>
          <p>Inspect current market, funding, open-interest, and volume context from Hyperliquid without payment, signatures, or wallet access.</p>
        </div>
        <span className="endpoint">GET /market/hyperliquid</span>
      </header>

      <section className="panel hyperliquid-live-toolbar" aria-label="Hyperliquid market selection">
        <div>
          <span>Market</span>
          <div className="hyperliquid-asset-tabs">
            {ASSETS.map((item) => (
              <button key={item} type="button" className={asset === item ? "active" : ""} onClick={() => { setAsset(item); void refresh(item); }}>{item}-PERP</button>
            ))}
          </div>
        </div>
        <button className="button button-secondary" type="button" onClick={() => void refresh()} disabled={loading}>{loading ? "Refreshing…" : "Refresh live data"}</button>
      </section>

      {error ? (
        <section className="error-box" role="alert"><span className="state-icon">!</span><div><strong>Live data unavailable</strong><p>{error}</p><small>Try refreshing in a moment. No cached or fabricated values are displayed.</small></div></section>
      ) : loading || !result ? (
        <section className="panel loading-state"><div><strong>Reading Hyperliquid</strong><p>Fetching current market and funding context…</p></div></section>
      ) : (
        <div className="hyperliquid-live-results">
          <section className="panel hyperliquid-live-status">
            <div><span>Live market</span><h2>{result.market}</h2><p>Source: Hyperliquid · {result.data_quality} data</p></div>
            <div><i /> <span>Snapshot</span><strong>{new Date(result.data_timestamp).toLocaleString()}</strong></div>
          </section>

          <section className="hyperliquid-live-metrics" aria-label="Live Hyperliquid metrics">
            <article className="panel"><span>Mark price</span><strong>{usd(result.mark_price_usd)}</strong><small>Current venue mark</small></article>
            <article className="panel"><span>Oracle price</span><strong>{usd(result.oracle_price_usd)}</strong><small>Current oracle reference</small></article>
            <article className="panel"><span>Funding APY</span><strong className={result.current_funding_apy >= 0 ? "metric-positive" : "metric-warning"}>{pct(result.current_funding_apy)}</strong><small>{result.funding_direction.replaceAll("_", " ")}</small></article>
            <article className="panel"><span>Open interest</span><strong>{compactUsd(result.open_interest_usd)}</strong><small>Current notional interest</small></article>
            <article className="panel"><span>24h volume</span><strong>{compactUsd(result.day_volume_usd)}</strong><small>Reported market volume</small></article>
            <article className="panel"><span>Premium</span><strong>{result.premium == null ? "Unavailable" : pct(result.premium * 100)}</strong><small>Mark-to-oracle spread</small></article>
          </section>

          {result.historical_funding ? (
            <section className="panel hyperliquid-funding-range">
              <div><span>Funding history</span><h2>{result.historical_funding.lookback_hours}-hour range</h2></div>
              <div className="hyperliquid-funding-grid">
                <article><span>Average APY</span><strong>{pct(result.historical_funding.average_funding_apy)}</strong></article>
                <article><span>Minimum APY</span><strong>{pct(result.historical_funding.minimum_funding_apy)}</strong></article>
                <article><span>Maximum APY</span><strong>{pct(result.historical_funding.maximum_funding_apy)}</strong></article>
                <article><span>Observations</span><strong>{result.historical_funding.observations}</strong></article>
              </div>
            </section>
          ) : null}

          <section className="panel hyperliquid-upgrade">
            <div><span>Free preview boundary</span><h2>Market context is free. Deterministic DeFi risk intelligence is premium.</h2><p>Unlock hedge-drift verdicts, Safety Buffer scoring, funding stress testing, Monte Carlo sensitivity, and actionable operator recommendations through the DeltaZero Risk Engine.</p></div>
            <div><Link href="/risk-engine" className="button button-primary">Open Risk Engine →</Link><Link href="/wallet" className="button button-secondary">Hedge Intelligence</Link></div>
          </section>
        </div>
      )}
    </div>
  );
}
