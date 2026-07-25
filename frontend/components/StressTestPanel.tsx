"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { RiskReport } from "@/lib/riskEngine";
import type { ScenarioKey } from "@/hooks/useRiskEngine";
import { ZONE_COLORS_DARK } from "@/lib/riskEngine";

interface StressTestPanelProps {
  scenarios: Record<ScenarioKey, { label: string; description: string }>;
  activeScenario: ScenarioKey | null;
  onApply: (key: ScenarioKey) => void;
  stressedReport?: RiskReport | null;
  baseReport: RiskReport;
  criticalProbability: number;
}

export function StressTestPanel({ scenarios, activeScenario, onApply, stressedReport, baseReport, criticalProbability }: StressTestPanelProps) {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Stress Test Scenarios</div>
      <div className="flex flex-wrap gap-2 mb-4">
        {(Object.entries(scenarios) as [ScenarioKey, typeof scenarios[ScenarioKey]][]).map(([key, s]) => (
          <button key={key} onClick={() => onApply(key)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all duration-200 ${
              activeScenario === key
                ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                : "bg-slate-800/50 text-slate-400 border-slate-700 hover:border-slate-600 hover:text-slate-200"
            }`}>
            {s.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {stressedReport && (
          <motion.div key={activeScenario} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700">
                <div className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Safety Buffer</div>
                <motion.div key={stressedReport.safety_buffer} initial={{ scale: 1.3 }} animate={{ scale: 1 }}
                  className="text-lg font-mono font-bold mt-1" style={{ color: ZONE_COLORS_DARK[stressedReport.risk_zone] }}>
                  {stressedReport.safety_buffer}
                  <span className="text-xs text-slate-500 ml-1">({stressedReport.safety_buffer - baseReport.safety_buffer >= 0 ? "+" : ""}{(stressedReport.safety_buffer - baseReport.safety_buffer).toFixed(1)})</span>
                </motion.div>
              </div>
              <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700">
                <div className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Risk Zone</div>
                <div className="text-lg font-bold mt-1" style={{ color: ZONE_COLORS_DARK[stressedReport.risk_zone] }}>
                  {stressedReport.risk_zone}
                </div>
              </div>
              <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700">
                <div className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Action</div>
                <div className="text-lg font-black mt-1 tracking-widest uppercase" style={{ color: ZONE_COLORS_DARK[stressedReport.risk_zone] }}>
                  {stressedReport.action}
                </div>
              </div>
            </div>
            <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700">
              <div className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">P(Critical) within 7 days</div>
              <div className="text-lg font-mono font-bold mt-1" style={{ color: criticalProbability > 50 ? "#fb7185" : criticalProbability > 20 ? "#fbbf24" : "#34d399" }}>
                {criticalProbability}%
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!stressedReport && (
        <p className="text-xs text-slate-500">Click a scenario above to see how the report changes under stress.</p>
      )}
    </div>
  );
}
