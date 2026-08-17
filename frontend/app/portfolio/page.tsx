import type { Metadata } from "next";

import { WorkspaceStatus } from "@/components/marketplace/workspace-status";

export const metadata: Metadata = { title: "My Agents | DeltaZero", description: "Review connected agent jobs and Risk Guard state." };

export default function PortfolioPage() { return <WorkspaceStatus mode="portfolio" />; }
