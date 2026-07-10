"use client";

import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "motion/react";
import { FJAER } from "@/lib/bevegelse";
import { formaterBelop } from "@/lib/format";

/**
 * Beløp som teller opp fra 0 til verdien én gang ved mount (FJAER-følelse).
 * Oppdaterer textContent direkte (ingen React-state per frame). Ved redusert
 * bevegelse vises sluttverdien direkte. Rendrer «{tall} kr».
 */
export function Belop({
  verdi,
  className,
}: {
  verdi: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const redusert = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (redusert) {
      el.textContent = `${formaterBelop(verdi)} kr`;
      return;
    }
    const kontroll = animate(0, verdi, {
      ...FJAER,
      onUpdate: (v) => {
        el.textContent = `${formaterBelop(Math.round(v))} kr`;
      },
    });
    return () => kontroll.stop();
  }, [verdi, redusert]);

  // Sluttverdien er også initielt innhold (riktig uten JS / ved reduksjon).
  return (
    <span ref={ref} className={className}>
      {formaterBelop(verdi)} kr
    </span>
  );
}
