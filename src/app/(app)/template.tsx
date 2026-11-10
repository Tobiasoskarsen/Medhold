"use client";

import { useState, type ReactNode } from "react";
import { m, useReducedMotion } from "motion/react";
import { DELT_OVERGANG_NOKKEL, VARIGHET } from "@/lib/bevegelse";
import { FANE_NAV_NOKKEL } from "@/components/ui/BunnNav";

/**
 * Ruteovergang for de innloggede skjermene. Template re-mountes ved hver
 * navigasjon. Kun opasitet: bevegelsen eies av Sekvens inni skjermen, så to
 * glid ikke legger seg oppå hverandre (redesign-ordren §6).
 * - Delt View Transition (kort → sak): ingen fade her — nettleseren kryssfader
 *   allerede roten, og en fade til ville blitt en dobbeltfade.
 * - Fane-bytte via BunnNav: rask fade. Dybde-navigasjon: litt roligere fade.
 */
export default function Template({ children }: { children: ReactNode }) {
  const redusert = useReducedMotion();
  const [modus] = useState<"fane" | "delt" | "dybde">(() => {
    if (typeof window === "undefined") return "dybde";
    try {
      // Bare lest her: KravBelop eier og fjerner det delte flagget.
      if (sessionStorage.getItem(DELT_OVERGANG_NOKKEL) === "1") return "delt";
      const f = sessionStorage.getItem(FANE_NAV_NOKKEL) === "1";
      if (f) sessionStorage.removeItem(FANE_NAV_NOKKEL);
      return f ? "fane" : "dybde";
    } catch {
      return "dybde";
    }
  });

  if (modus === "delt") return <>{children}</>;

  return (
    <m.div
      className="skjerm-inntreden"
      initial={redusert ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: redusert ? 0 : modus === "fane" ? VARIGHET.hurtig : VARIGHET.normal }}
    >
      {children}
    </m.div>
  );
}
