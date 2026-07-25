"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { MonteCarloResult } from "@/lib/monteCarlo";

interface MonteCarloChartProps {
  data: MonteCarloResult | null;
  loading: boolean;
  onRun: () => void;
}

export function MonteCarloChart({ data, loading, onRun }: MonteCarloChartProps) {
  const [visiblePaths, setVisiblePaths] = useState<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null!);

  useEffect(() => {
    if (!data) return;
    setVisiblePaths(0);
    let i = 0;
    intervalRef.current = setInterval(() => {
      i++;
      setVisiblePaths(i);
      if (i >= data.paths.length && intervalRef.current) clearInterval(intervalRef.current);
    }, 50);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [data]);

  if (!data) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center h-[320px] gap-4">
        <div className="text-slate-500 text-sm">Run a simulation to see Monte Carlo paths</div>
        <button onClick={onRun} className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-semibold border border-emerald-500/30 hover:bg-emerald-500/30 transition-all">Run Simulation</button>
      </div>
    );
  }

  const { paths, p95_impairment, p99_impairment, spot_price } = data;
  const days = 30;
  const w = 600;
  const h = 280;
  const pad = { t: 20, r: 20, b: 30, l: 50 };
  const pw = w - pad.l - pad.r;
  const ph = h - pad.t - pad.b;

  const allVals = paths.flatMap(p => p.values);
  const minVal = Math.min(...allVals) * 0.98;
  const maxVal = Math.max(...allVals) * 1.02;
  const range = maxVal - minVal || 1;

  const xScale = (d: number) => pad.l + (d / days) * pw;
  const yScale = (v: number) => pad.t + ph - ((v - minVal) / range) * ph;

  const p95Line = yScale(spot_price * (1 - p95_impairment / 100));
  const p99Line = yScale(spot_price * (1 - p99_impairment / 100));

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Monte Carlo Simulation</div>
        <button onClick={onRun} disabled={loading}
          className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-semibold border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-50 transition-all shrink-0">
          {loading ? "Running..." : "Run Simulation"}
        </button>
      </div>

      <svg viewBox={`0 0 ${w} ${h + 20}`} className="w-full h-auto max-w-full" style={{ maxHeight: 300 }}>
        {/* Y axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const val = minVal + range * t;
          const y = yScale(val);
          return (
            <g key={t}>
              <text x={pad.l - 6} y={y + 3} textAnchor="end" className="text-[9px]" fill="#64748b">{val.toFixed(0)}</text>
              <line x1={pad.l} y1={y} x2={w - pad.r} y2={y} stroke="#1e293b" strokeWidth="0.5" />
            </g>
          );
        })}

        {/* P95 / P99 lines */}
        <line x1={pad.l} y1={p95Line} x2={w - pad.r} y2={p95Line} stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 3" />
        <text x={w - pad.r - 4} y={p95Line - 4} textAnchor="end" className="text-[8px]" fill="#f59e0b">P95</text>
        <line x1={pad.l} y1={p99Line} x2={w - pad.r} y2={p99Line} stroke="#f43f5e" strokeWidth="1" strokeDasharray="4 3" />
        <text x={w - pad.r - 4} y={p99Line - 4} textAnchor="end" className="text-[8px]" fill="#f43f5e">P99</text>

        {/* Price paths */}
        {paths.slice(0, visiblePaths).map((path, pi) => (
          <motion.path key={pi} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            d={path.values.map((v, di) => `${di === 0 ? "M" : "L"}${xScale(di)},${yScale(v)}`).join(" ")}
            fill="none" stroke={path.profitable ? "#34d399" : "#fb7185"} strokeWidth="1.2" opacity={0.7} />
        ))}

        {/* X axis labels */}
        {[0, 10, 20, 30].map(d => (
          <text key={d} x={xScale(d)} y={h + 12} textAnchor="middle" className="text-[9px]" fill="#64748b">Day {d}</text>
        ))}
      </svg>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[10px] text-slate-500">
        <span className="flex items-center gap-1.5"><i className="w-3 h-0.5 rounded bg-emerald-400 inline-block" /> Profitable</span>
        <span className="flex items-center gap-1.5"><i className="w-3 h-0.5 rounded bg-rose-400 inline-block" /> Impaired</span>
        <span className="flex items-center gap-1.5"><i className="w-3 h-0.5 rounded bg-amber-400 inline-block" style={{ borderTop: "1px dashed" }} /> P95</span>
        <span className="flex items-center gap-1.5"><i className="w-3 h-0.5 rounded bg-rose-500 inline-block" style={{ borderTop: "1px dashed" }} /> P99</span>
      </div>
    </div>
  );
}
