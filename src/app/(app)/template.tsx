"use client";

import { useState, type ReactNode } from "react";
import { m } from "motion/react";
import { VARIGHET, FJAER, GLID_DYBDE } from "@/lib/bevegelse";
import { FANE_NAV_NOKKEL } from "@/components/ui/BunnNav";

/**
 * Ruteovergang for de innloggede skjermene. Template re-mountes ved hver
 * navigasjon → gir konsistent inntreden. Kun inntreden, ingen exit (bevisst).
 * - Dybde-navigasjon (åpne et krav e.l.): fade + lite glid (GLID_DYBDE) fra
 *   høyre — bevisst kort slik at delte View-Transition-overganger (Motion2 §1)
 *   dominerer i stedet for å konkurrere med sideglidet.
 * - Fane-bytte via BunnNav (søsken): ren fade, ingen sideveis glid.
 * MotionConfig i (app)/layout gjør at redusert bevegelse → ren opasitetsfade.
 */
export default function Template({ children }: { children: ReactNode }) {
  const [faneNav] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const f = sessionStorage.getItem(FANE_NAV_NOKKEL) === "1";
      if (f) sessionStorage.removeItem(FANE_NAV_NOKKEL);
      return f;
    } catch {
      return false;
    }
  });

  if (faneNav) {
    return (
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: VARIGHET.hurtig }}
      >
        {children}
      </m.div>
    );
  }

  return (
    <m.div
      initial={{ opacity: 0, x: GLID_DYBDE }}
      animate={{ opacity: 1, x: 0 }}
      transition={FJAER}
    >
      {children}
    </m.div>
  );
}
