import type { Metadata } from "next";

import { ReportHistory } from "@/components/report-history";

export const metadata: Metadata = { title: "Risk Report History | DeltaZero", description: "Review and share saved DeltaZero risk reports." };

export default function HistoryPage() { return <ReportHistory />; }
