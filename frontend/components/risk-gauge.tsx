"use client";

type GaugeTone = "positive" | "warning" | "danger" | "neutral";

export function RiskGauge({
  value,
  max = 100,
  tone,
  label,
  caption,
  suffix = "",
  size = "md",
}: {
  value: number;
  max?: number;
  tone: GaugeTone;
  label: string;
  caption: string;
  suffix?: string;
  size?: "sm" | "md";
}) {
  const normalized = Number.isFinite(value) && max > 0 ? Math.max(0, Math.min(value / max, 1)) : 0;
  const radius = size === "sm" ? 28 : 32;
  const stroke = size === "sm" ? 5.5 : 6;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - normalized);

  return (
    <div className={`risk-gauge risk-gauge-${tone} risk-gauge-${size}`} aria-label={`${label}: ${caption}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <circle className="risk-gauge-track" cx="50" cy="50" r={radius} strokeWidth={stroke} />
        <circle
          className="risk-gauge-fill"
          cx="50"
          cy="50"
          r={radius}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="risk-gauge-copy">
        <strong>
          {value.toFixed(1)}
          {suffix}
        </strong>
        <span>{label}</span>
        <small>{caption}</small>
      </div>
    </div>
  );
}
