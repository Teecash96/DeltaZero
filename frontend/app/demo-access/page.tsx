import type { Metadata } from "next";

import { DemoAccessForm } from "@/components/demo-access-form";

export const metadata: Metadata = {
  title: "DeltaZero Demo Access",
  robots: { index: false, follow: false },
};

export default function DemoAccessPage() {
  return <DemoAccessForm />;
}
