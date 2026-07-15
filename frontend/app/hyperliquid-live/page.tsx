import type { Metadata } from "next";

import { HyperliquidLive } from "@/components/hyperliquid-live";

export const metadata: Metadata = {
  title: "Hyperliquid Live — DeltaZero",
  description: "Free read-only Hyperliquid market and funding context from DeltaZero.",
};

export default function HyperliquidLivePage() {
  return <HyperliquidLive />;
}
