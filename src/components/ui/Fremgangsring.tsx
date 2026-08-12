"use client";

import type { ReactNode } from "react";
import { m } from "motion/react";
import { VARIGHET, EASING } from "@/lib/bevegelse";

/**
 * Fremgangsring — sirkulær fremgangsindikator (designretning 2-mockupene:
 * «X/Y saker løst på reisen din» på Hjem, stadium-steg på sak-siden). Fyller
 * seg fra tom til `fraction` (0–1) én gang ved mount, samme «fyll ved
 * mount»-prinsipp som StadiumIndikator/Trapp. `text-strek`/`text-aksent` +
 * `stroke="currentColor"` — samme fargeteknikk som appens ikoner, ingen nye
 * farger.
 */
export function Fremgangsring({
  fraction,
  size = 84,
  strokeWidth = 9,
  children,
  className = "",
}: {
  /** 0–1. Klippes til gyldig område. */
  fraction: number;
  size?: number;
  strokeWidth?: number;
  children?: ReactNode;
  className?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const omkrets = 2 * Math.PI * r;
  const klippet = Math.min(1, Math.max(0, fraction));
  const midt = size / 2;

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={midt}
          cy={midt}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-strek"
        />
        <m.circle
          cx={midt}
          cy={midt}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={omkrets}
          className="text-aksent"
          transform={`rotate(-90 ${midt} ${midt})`}
          initial={{ strokeDashoffset: omkrets }}
          animate={{ strokeDashoffset: omkrets * (1 - klippet) }}
          transition={{ duration: VARIGHET.rolig, ease: EASING }}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}
