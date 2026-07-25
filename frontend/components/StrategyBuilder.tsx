"use client";

import { useCallback } from "react";
import { InputPanel } from "./InputPanel";
import { RiskDashboard } from "./RiskDashboard";
import { MonteCarloChart } from "./MonteCarloChart";
import { StressTestPanel } from "./StressTestPanel";
import { useRiskEngine } from "@/hooks/useRiskEngine";

export function StrategyBuilder() {
  const {
    inputs, setInputs, report, stressedReport, activeReport,
    stressScenario, applyScenario, criticalProbability,
    mcResult, mcLoading, runSimulation, shareUrl, scenarios,
  } = useRiskEngine();

  return (
    <div className="w-full max-w-7xl mx-auto overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Input Panel - Left */}
        <div className="lg:col-span-3 bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5 min-w-0">
          <div className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-bold">Δ</span>
            Strategy Inputs
          </div>
          <InputPanel inputs={inputs} onChange={setInputs} />
        </div>

        {/* Dashboard - Center */}
        <div className="lg:col-span-5 space-y-3 min-w-0">
          <RiskDashboard report={activeReport} previousReport={report} />
        </div>

        {/* Monte Carlo + Stress - Right */}
        <div className="lg:col-span-4 space-y-3 min-w-0">
          <MonteCarloChart data={mcResult} loading={mcLoading} onRun={runSimulation} />
          <StressTestPanel
            scenarios={scenarios}
            activeScenario={stressScenario}
            onApply={applyScenario}
            stressedReport={stressedReport}
            baseReport={report}
            criticalProbability={criticalProbability}
          />
        </div>
      </div>

      {/* Share Button */}
      <div className="mt-4 flex justify-center">
        <button onClick={shareUrl}
          className="px-5 py-2.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 rounded-xl text-sm font-semibold border border-slate-700 transition-all duration-200 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
          Share This Scenario
        </button>
      </div>
    </div>
  );
}
