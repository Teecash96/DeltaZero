import type { Metadata } from "next";

import { LiveJob } from "@/components/hire/live-job";

export const metadata: Metadata = {
  title: "Live Risk Guard Job | DeltaZero",
  description: "Track payment, verification, Risk Guard, and completion for a DeltaZero agent job.",
};

export default async function JobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return <LiveJob jobId={jobId} />;
}
