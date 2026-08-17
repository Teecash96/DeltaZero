import type { Metadata } from "next";

import { WorkspaceStatus } from "@/components/marketplace/workspace-status";

export const metadata: Metadata = { title: "Activity | DeltaZero", description: "Review local DeltaZero analysis activity." };

export default function ActivityPage() { return <WorkspaceStatus mode="activity" />; }
