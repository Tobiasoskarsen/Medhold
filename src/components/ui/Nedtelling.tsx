"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import { dagerTil, erHastende } from "@/lib/frist";
import { tellOpp } from "@/lib/tell";

/** «24. juli» — dag + full måned, uten år (som i mockupen). */
function langDato(iso: string): string {
  return new Date(iso).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
  });
}

/**
 * Nedtelling — fristkort: dato i serif venstre + hva fristen gjelder, antall
 * dager i stor serif høyre. Tallet er `dom-rod` KUN når ≤10 dager gjenstår
 * (eller fristen er passert); ellers `blekk`.
 */
export function Nedtelling({
  forfallsdato,
  tittel,
  className = "",
}: {
  forfallsdato: string;
  tittel: string;
  className?: string;
}) {
  const d = dagerTil(forfallsdato);
  const rod = erHastende(d);
  const tallFarge = rod ? "text-dom-rod" : "text-blekk";
  const ref = useRef<HTMLSpanElement>(null);
  const redusert = useReducedMotion();

  // Dagtallet ruller 0 → d ved mount (delt tellOpp-motor, Motion2 §5).
  useEffect(() => {
    const el = ref.current;
    if (!el || d <= 0) return;
    if (redusert) {
      el.textContent = String(d);
      return;
    }
    return tellOpp(el, d, (v) => String(v));
  }, [d, redusert]);

  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-2xl border-[0.5px] border-strek bg-flate px-4 py-3.5 ${className}`}
    >
      <div className="min-w-0">
        <p className="font-serif text-[19px] font-semibold text-blekk">
          {langDato(forfallsdato)}
        </p>
        <p className="mt-0.5 text-[12px] text-dempet">{tittel}</p>
      </div>
      <div className="shrink-0 text-right">
        {d < 0 ? (
          <p className={`font-serif text-[26px] font-semibold ${tallFarge}`}>
            Utløpt
          </p>
        ) : d === 0 ? (
          <p className={`font-serif text-[26px] font-semibold ${tallFarge}`}>
            I dag
          </p>
        ) : (
          <>
            <span
              ref={ref}
              className={`font-serif text-[26px] font-semibold leading-none tabular-nums ${tallFarge}`}
            >
              {d}
            </span>
            <span className="mt-0.5 block text-[12px] font-semibold text-dempet">
              {d === 1 ? "dag igjen" : "dager igjen"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
