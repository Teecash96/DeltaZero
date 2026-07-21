import type { Metadata } from "next";

import { ReportHistory } from "@/components/report-history";

export const metadata: Metadata = { title: "Strategy Registry | DeltaZero", description: "Review recommendations and record observed strategy outcomes." };

export default function HistoryPage() { return <ReportHistory />; }
