"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { RiskReport } from "@/lib/riskEngine";
import { ZONE_COLORS_DARK } from "@/lib/riskEngine";

function useAnimatedValue(target: number): number {
  const [current, setCurrent] = useState(target);
  const raf = useRef<number>(undefined);
  const startRef = useRef({ value: target, time: 0 });

  useEffect(() => {
    const from = current;
    startRef.current = { value: from, time: performance.now() };
    const duration = 500;

    function tick(now: number) {
      const elapsed = now - startRef.current.time;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(from + (target - from) * eased);
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  return current;
}

function MetricCard({ label, value, suffix, color }: { label: string; value: number; suffix?: string; color?: string }) {
  const animated = useAnimatedValue(value);
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all duration-300">
      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-2xl font-mono font-bold" style={{ color: color ?? "#e2e8f0" }}>
        {animated.toFixed(1)}{suffix ?? ""}
      </div>
    </div>
  );
}

function ConfidenceRing({ value, color }: { value: number; color: string }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="88" height="88" className="transform -rotate-90">
        <circle cx="44" cy="44" r={r} fill="none" stroke="#1e293b" strokeWidth="6" />
        <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 0.5s ease" }} />
      </svg>
      <div className="text-sm font-mono font-bold" style={{ color }}>{value}%</div>
    </div>
  );
}

interface RiskDashboardProps {
  report: RiskReport;
  previousReport?: RiskReport;
}

export function RiskDashboard({ report, previousReport }: RiskDashboardProps) {
  const zc = ZONE_COLORS_DARK[report.risk_zone];
  const zoneChanged = previousReport && previousReport.risk_zone !== report.risk_zone;

  return (
    <div className="flex flex-col gap-3">
      {/* Risk Zone Badge */}
      <AnimatePresence mode="wait">
        <motion.div key={report.risk_zone} initial={zoneChanged ? { scale: 1.3 } : false}
          animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 15 }}
          className="rounded-xl px-5 py-3 text-center border"
          style={{ backgroundColor: `${zc}15`, borderColor: `${zc}40`, color: zc }}>
          <div className="text-[10px] font-semibold uppercase tracking-widest opacity-70">Risk Zone</div>
          <div className="text-2xl font-bold tracking-tight">{report.risk_zone}</div>
        </motion.div>
      </AnimatePresence>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-2">
        <MetricCard label="Safety Buffer" value={report.safety_buffer} suffix="" color={zc} />
        <MetricCard label="Net Carry APY" value={report.net_carry_apy} suffix="%" color={report.net_carry_apy >= 0 ? "#34d399" : "#fb7185"} />
        <MetricCard label="Hedge Drift" value={report.hedge_drift_pct} suffix="%" color={report.hedge_drift_pct < 3 ? "#34d399" : report.hedge_drift_pct < 6 ? "#fbbf24" : "#fb7185"} />
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all duration-300 flex flex-col items-center justify-center">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Decision Confidence</div>
          <ConfidenceRing value={report.decision_confidence} color={zc} />
        </div>
      </div>

      {/* Action Button */}
      <motion.div whileHover={{ scale: 1.02 }} className="rounded-xl py-4 text-center text-lg font-black tracking-widest uppercase border-2 cursor-default"
        style={{ backgroundColor: `${zc}20`, borderColor: `${zc}60`, color: zc }}>
        {report.action}
      </motion.div>
    </div>
  );
}
