"use client";

import { useCallback } from "react";
import type { Asset, RiskTolerance, StrategyInputs, TargetStyle } from "@/lib/riskEngine";

interface InputPanelProps {
  inputs: StrategyInputs;
  onChange: (update: Partial<StrategyInputs>) => void;
}

const ASSETS: Asset[] = ["SOL", "ETH"];
const RISK_TOLERANCES: { key: RiskTolerance; label: string }[] = [
  { key: "conservative", label: "Conservative" },
  { key: "medium", label: "Medium" },
  { key: "aggressive", label: "Aggressive" },
];
const TARGET_STYLES: { key: TargetStyle; label: string }[] = [
  { key: "neutral_yield", label: "Neutral Yield" },
  { key: "conservative_income", label: "Conservative Income" },
  { key: "aggressive_carry", label: "Aggressive Carry" },
  { key: "capital_preservation", label: "Capital Preservation" },
];

export function InputPanel({ inputs, onChange }: InputPanelProps) {
  const set = useCallback((k: keyof StrategyInputs, v: number | string) => onChange({ [k]: v }), [onChange]);

  return (
    <div className="flex flex-col gap-5">
      {/* Asset Toggle */}
      <div className="flex gap-2 bg-slate-900 rounded-xl p-1 border border-slate-800">
        {ASSETS.map(a => (
          <button key={a} onClick={() => set("asset", a)}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200 ${
              inputs.asset === a ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}>{a}</button>
        ))}
      </div>

      {/* Capital */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Capital (USD)</label>
          <span className="text-sm font-mono text-slate-200">${inputs.capital_usd.toLocaleString()}</span>
        </div>
        <input type="range" min={1000} max={50000} step={500} value={inputs.capital_usd}
          onChange={e => set("capital_usd", Number(e.target.value))}
          className="w-full accent-emerald-500 h-2 rounded-lg appearance-none cursor-pointer bg-slate-800" />
      </div>

      {/* Long Yield APY */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Long Yield APY</label>
          <span className="text-sm font-mono text-slate-200">{inputs.long_yield_apy}%</span>
        </div>
        <input type="range" min={0} max={25} step={0.5} value={inputs.long_yield_apy}
          onChange={e => set("long_yield_apy", Number(e.target.value))}
          className="w-full accent-emerald-500 h-2 rounded-lg appearance-none cursor-pointer bg-slate-800" />
      </div>

      {/* Short Funding APY */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Short Funding APY</label>
          <span className={`text-sm font-mono ${inputs.short_funding_apy < 0 ? "text-rose-400" : "text-emerald-400"}`}>
            {inputs.short_funding_apy >= 0 ? "+" : ""}{inputs.short_funding_apy}%
          </span>
        </div>
        <input type="range" min={-15} max={15} step={0.5} value={inputs.short_funding_apy}
          onChange={e => set("short_funding_apy", Number(e.target.value))}
          className="w-full accent-emerald-500 h-2 rounded-lg appearance-none cursor-pointer bg-slate-800" />
      </div>

      {/* Fee Drag APY */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Fee Drag APY</label>
          <span className="text-sm font-mono text-slate-200">{inputs.fee_drag_apy}%</span>
        </div>
        <input type="range" min={0} max={5} step={0.1} value={inputs.fee_drag_apy}
          onChange={e => set("fee_drag_apy", Number(e.target.value))}
          className="w-full accent-emerald-500 h-2 rounded-lg appearance-none cursor-pointer bg-slate-800" />
      </div>

      {/* Risk Tolerance */}
      <div>
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Risk Tolerance</label>
        <div className="flex gap-1 bg-slate-900 rounded-xl p-1 border border-slate-800">
          {RISK_TOLERANCES.map(r => (
            <button key={r.key} onClick={() => set("risk_tolerance", r.key)}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${
                inputs.risk_tolerance === r.key ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-slate-400 hover:text-slate-200 border border-transparent"
              }`}>{r.label}</button>
          ))}
        </div>
      </div>

      {/* Target Style */}
      <div>
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Target Style</label>
        <select value={inputs.target_style} onChange={e => set("target_style", e.target.value)}
          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 font-semibold focus:outline-none focus:border-emerald-500/50 transition-colors cursor-pointer">
          {TARGET_STYLES.map(s => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
