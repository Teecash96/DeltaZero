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
};

const STORAGE_KEY = "deltazero_report_history_v1";
const MAX_ENTRIES = 25;

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
  const next = [{ ...entry, id: crypto.randomUUID() }, ...readReportHistory()].slice(0, MAX_ENTRIES);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("deltazero-history-updated"));
}

export function clearReportHistory() {
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("deltazero-history-updated"));
}
