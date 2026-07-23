"use client";

import { useCallback } from "react";

export function WhyDeltaZeroButton() {
  const handleClick = useCallback(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const el = document.getElementById("why-deltazero");
    if (!el) return;

    el.scrollIntoView({
      behavior: prefersReducedMotion ? "instant" : "smooth",
      block: "start",
    });

    history.replaceState(null, "", "/#why-deltazero");
  }, []);

  return (
    <button
      type="button"
      className="why-deltazero-fab"
      onClick={handleClick}
      aria-label="Scroll to Why DeltaZero section"
    >
      Why DeltaZero?
    </button>
  );
}
