"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import { dagerTil } from "@/lib/dato";
import { erHastende } from "@/lib/frist";
import { tellOpp } from "@/lib/tell";

/** «24. juli» — dag + full måned, uten år (som i mockupen). */
function langDato(iso: string): string {
  return new Date(iso).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
  });
}

/**
 * Nedtelling — fristkort (bento-tile, designretning 2): dato + hva fristen
 * gjelder øverst, antall dager i stor serif under. Tallet er `dom-rod` KUN
 * når ≤10 dager gjenstår (eller fristen er passert); ellers `blekk`.
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
      className={`flex flex-col justify-center rounded-2xl border-[0.5px] border-strek bg-flate p-3.5 ${className}`}
    >
      <p className="text-[11px] font-semibold text-dempet">
        Frist {langDato(forfallsdato)}
      </p>
      <p className="mt-0.5 text-[10.5px] leading-snug text-dempet">{tittel}</p>
      <div className="mt-2">
        {d < 0 ? (
          <p className={`font-serif text-[26px] font-semibold leading-none ${tallFarge}`}>
            Utløpt
          </p>
        ) : d === 0 ? (
          <p className={`font-serif text-[26px] font-semibold leading-none ${tallFarge}`}>
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
            <span className="mt-0.5 block text-[11px] font-semibold text-dempet">
              {d === 1 ? "dag igjen" : "dager igjen"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
