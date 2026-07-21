"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import { tellOpp } from "@/lib/tell";
import { formaterBelop } from "@/lib/format";

/**
 * Beløp som teller opp fra 0 til verdien én gang ved mount (FJAER-følelse, via
 * delt `tellOpp`-motor). Ved redusert bevegelse, eller når `tellOpp={false}`
 * (verdien er allerede kjent — f.eks. etter en delt layout-overgang, Motion2
 * §1), vises sluttverdien direkte uten telling. Rendrer «{tall} kr».
 */
export function Belop({
  verdi,
  className,
  tellOpp: skalTelle = true,
}: {
  verdi: number;
  className?: string;
  /** Sett til false når verdien allerede er vist (unngår dobbel telling). */
  tellOpp?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const redusert = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (redusert || !skalTelle) {
      el.textContent = `${formaterBelop(verdi)} kr`;
      return;
    }
    return tellOpp(el, verdi, (v) => `${formaterBelop(v)} kr`);
  }, [verdi, redusert, skalTelle]);

  // Sluttverdien er også initielt innhold (riktig uten JS / ved reduksjon).
  return (
    <span ref={ref} className={className}>
      {formaterBelop(verdi)} kr
    </span>
  );
}
