"use client";

export type ReportHistoryEntry = {
  id: string;
  type: "risk_engine" | "monte_carlo";
  asset: string;
  generatedAt: string;
  recommendation: string;
  safetyBuffer?: number;
  p95Impairment?: number;
  payload: unknown;
  outcome?: StrategyOutcome;
};

export type StrategyOutcomeStatus =
  | "avoided_loss"
  | "within_tolerance"
  | "exceeded_risk"
  | "not_executed"
  | "incomplete";

export type StrategyOutcome = {
  status: StrategyOutcomeStatus;
  observedAt: string;
  realizedReturnPct?: number;
  maxDrawdownPct?: number;
  finalSafetyBuffer?: number;
  notes?: string;
  source: "user_observed";
};

const STORAGE_KEY = "deltazero_report_history_v1";
const ENABLED_KEY = "deltazero_strategy_registry_enabled_v1";
const MAX_ENTRIES = 25;

function emitUpdate() {
  window.dispatchEvent(new Event("deltazero-history-updated"));
}

export function isStrategyRegistryEnabled() {
  return typeof window !== "undefined" && window.localStorage.getItem(ENABLED_KEY) === "true";
}

export function setStrategyRegistryEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  if (enabled) window.localStorage.setItem(ENABLED_KEY, "true");
  else window.localStorage.removeItem(ENABLED_KEY);
  emitUpdate();
}

export function readReportHistory(): ReportHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function appendReportHistory(entry: Omit<ReportHistoryEntry, "id">) {
  if (!isStrategyRegistryEnabled()) return false;
  const next = [{ ...entry, id: crypto.randomUUID() }, ...readReportHistory()].slice(0, MAX_ENTRIES);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  emitUpdate();
  return true;
}

export function updateStrategyOutcome(id: string, outcome: StrategyOutcome) {
  const next = readReportHistory().map((entry) => entry.id === id ? { ...entry, outcome } : entry);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  emitUpdate();
}

export function importStrategyRegistry(value: unknown) {
  if (!Array.isArray(value)) throw new Error("Registry file must contain an array of entries.");
  const entries = value.filter((entry): entry is ReportHistoryEntry => {
    if (!entry || typeof entry !== "object") return false;
    const candidate = entry as Partial<ReportHistoryEntry>;
    return typeof candidate.id === "string"
      && (candidate.type === "risk_engine" || candidate.type === "monte_carlo")
      && typeof candidate.asset === "string"
      && typeof candidate.generatedAt === "string"
      && typeof candidate.recommendation === "string";
  });
  if (!entries.length && value.length) throw new Error("No valid DeltaZero registry entries were found.");
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  setStrategyRegistryEnabled(true);
  emitUpdate();
  return entries.length;
}

export function clearReportHistory() {
  window.localStorage.removeItem(STORAGE_KEY);
  emitUpdate();
}
