import type { Metadata } from "next";

import { ReportHistory } from "@/components/report-history";

export const metadata: Metadata = {
  title: "Strategy Registry | DeltaZero",
  description: "Opt-in agent memory connecting DeltaZero recommendations with observed outcomes.",
};

export default function RegistryPage() {
  return <ReportHistory />;
}
