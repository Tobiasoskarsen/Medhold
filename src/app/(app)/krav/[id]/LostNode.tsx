"use client";

import { useEffect, useState } from "react";
import { m, useReducedMotion } from "motion/react";
import { FJAER, VARIGHET } from "@/lib/bevegelse";
import { haptikk } from "@/lib/haptikk";

/**
 * Løst sak-seremonien (MEDHOLD_MOTION_ARBEIDSORDRE seksjon 7). Grønn sluttnode
 * skalerer 0.6 → 1, haken tegnes (pathLength 0 → 1), haptikk('suksess') når
 * streken er ferdig. «full» rett etter «marker som løst»; «rolig» (uten
 * haptikk) første gang en allerede løst sak åpnes i økten; ellers ferdig.
 */
export function LostNode({ sakId }: { sakId: string }) {
  const redusert = useReducedMotion();

  const [modus] = useState<"full" | "rolig" | "ferdig">(() => {
    if (typeof window === "undefined") return "ferdig";
    try {
      const nettopp = `medhold-lost-nettopp-${sakId}`;
      const sett = `medhold-lost-sett-${sakId}`;
      if (sessionStorage.getItem(nettopp) === "1") {
        sessionStorage.removeItem(nettopp);
        sessionStorage.setItem(sett, "1");
        return "full";
      }
      if (sessionStorage.getItem(sett) !== "1") {
        sessionStorage.setItem(sett, "1");
        return "rolig";
      }
      return "ferdig";
    } catch {
      return "ferdig";
    }
  });

  const animer = modus !== "ferdig" && !redusert;
  const varighet = modus === "full" ? VARIGHET.seremoni : VARIGHET.normal;

  // Haptikk beholdes ved redusert bevegelse (prinsipp 1.6) — fyres da på mount.
  useEffect(() => {
    if (modus === "full" && redusert) haptikk("suksess");
  }, [modus, redusert]);

  return (
    <m.span
      className="flex size-4 items-center justify-center rounded-full bg-aksent"
      initial={animer ? { scale: 0.6 } : false}
      animate={{ scale: 1 }}
      transition={FJAER}
    >
      <svg viewBox="0 0 16 16" className="size-2.5" fill="none" aria-hidden>
        <m.path
          d="M4 8.5 L6.8 11 L12 5"
          stroke="#fff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={animer ? { pathLength: 0 } : false}
          animate={{ pathLength: 1 }}
          transition={{ duration: varighet, ease: "easeInOut" }}
          onAnimationComplete={() => {
            if (modus === "full" && !redusert) haptikk("suksess");
          }}
        />
      </svg>
    </m.span>
  );
}
