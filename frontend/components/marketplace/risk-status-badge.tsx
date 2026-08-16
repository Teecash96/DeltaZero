import type { RiskStatus } from "@/src/lib/risk/types";
import styles from "./marketplace.module.css";

const labels: Record<RiskStatus, string> = { PROCEED: "Proceed", WATCH: "Watch", ADJUST: "Adjust", AVOID: "Avoid" };

export function RiskStatusBadge({ status }: { status: RiskStatus }) {
  const className = status === "PROCEED" ? styles.statusProceed : status === "WATCH" ? styles.statusWatch : status === "ADJUST" ? styles.statusAdjust : styles.statusAvoid;
  return <span className={`${styles.status} ${className}`}>{labels[status]}</span>;
}
