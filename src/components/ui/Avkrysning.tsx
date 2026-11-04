"use client";

import { m } from "motion/react";
import { FJAER, VARIGHET, EASING } from "@/lib/bevegelse";

/**
 * Avkrysning — erstatning for `<input type="checkbox">` med en hake som
 * tegnes (pathLength) og en boks som fylles med fjær. Selve inputen ligger
 * usynlig over boksen, så label-klikk, tastatur og skjermlesere virker som
 * før. Plasseres inne i en eksisterende <label>. Ved redusert bevegelse blir
 * fjæren og tegningen ren fade (MotionConfig).
 */
export function Avkrysning({
  checked,
  onChange,
  disabled = false,
  className = "",
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <span className={`relative inline-flex size-[18px] shrink-0 ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.checked)}
        className="peer absolute inset-0 z-10 m-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
      <m.span
        aria-hidden
        className={`flex size-full items-center justify-center rounded-[5px] border-[1.5px] transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-aksent/40 peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-flate peer-disabled:opacity-40 ${
          checked ? "border-aksent bg-aksent" : "border-strek bg-flate"
        }`}
        initial={false}
        animate={{ scale: checked ? [0.85, 1] : 1 }}
        transition={FJAER}
      >
        <svg viewBox="0 0 16 16" className="size-3 text-aksent-tekst" fill="none">
          <m.path
            d="M3.5 8.5 6.5 11.5 12.5 4.5"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
            transition={{ duration: VARIGHET.rolig, ease: EASING }}
          />
        </svg>
      </m.span>
    </span>
  );
}
