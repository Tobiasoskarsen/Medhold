"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, m } from "motion/react";
import { ChevronDown } from "lucide-react";
import { VARIGHET, EASING } from "@/lib/bevegelse";

/**
 * SakensGangSeksjon — de to nyeste hendelsene er alltid synlige (`forhand`),
 * så brev og utkast ikke ligger bak en lukket overskrift (redesign-ordren
 * §2C). Resten åpnes med én knapp. Samme høyde/opasitet-mekanikk og tokens som
 * Utvidbar/Utregning/Veivalg, med ett tillegg: innholdet glir også noen px i Y
 * — NED ved åpning, OPP ved lukking — så lukkingen leses som «trekkes tilbake
 * opp» (brukertilbakemelding). Innholdet er allerede ferdig rendret av kalleren
 * (Server Component) — trygt over server→klient-grensen.
 */
export function SakensGangSeksjon({
  antall,
  forhand,
  children,
}: {
  /** Totalt antall hendelser. */
  antall: number;
  /** Alltid synlig: de nyeste hendelsene. */
  forhand: ReactNode;
  /** Resten, bak «Vis alle». Null når alt får plass i forhåndsvisningen. */
  children?: ReactNode;
}) {
  const [åpen, setÅpen] = useState(false);

  return (
    <div className="mt-seksjon">
      <h2 className="seksjonstittel mb-gruppe text-blekk">Sakens gang</h2>
      {forhand}

      <AnimatePresence initial={false}>
        {åpen && (
          <m.div
            key="sakens-gang-innhold"
            initial={{ height: 0, opacity: 0, y: -8 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -8 }}
            transition={{ duration: VARIGHET.rolig, ease: EASING }}
            style={{ overflow: "hidden" }}
          >
            {children}
          </m.div>
        )}
      </AnimatePresence>

      {children && (
        <button
          type="button"
          onClick={() => setÅpen((o) => !o)}
          aria-expanded={åpen}
          className="trykk flex min-h-11 items-center gap-1 text-hjelp font-medium text-dempet transition hover:text-blekk"
        >
          {åpen ? "Vis færre" : `Vis alle (${antall})`}
          <ChevronDown
            className={`size-[15px] shrink-0 transition-transform duration-200 ${
              åpen ? "rotate-180" : ""
            }`}
            aria-hidden
          />
        </button>
      )}
    </div>
  );
}
