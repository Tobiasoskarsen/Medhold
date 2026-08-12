"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, m } from "motion/react";
import { ChevronDown } from "lucide-react";
import { VARIGHET, EASING } from "@/lib/bevegelse";

/**
 * SakensGangSeksjon — «Sakens gang» er lukket som standard og åpnes med ett
 * trykk på selve overskriften (WAI-ARIA-mønsteret: en <button> inni <h2>,
 * ikke en fristilt knapp under). Antallet hendelser vises som en liten hint
 * ved siden av pilen slik at man ser om det er noe å hente uten å åpne.
 * Samme høyde/opasitet-mekanikk og VARIGHET.rolig/EASING-tokens som
 * Utvidbar/Utregning/Veivalg. `children` er allerede ferdig rendret av
 * kalleren (Server Component) — trygt over server→klient-grensen, samme
 * mønster som Tidslinje/SekvensDel selv bruker.
 */
export function SakensGangSeksjon({
  antall,
  children,
}: {
  /** Totalt antall hendelser — vist som hint ved siden av pilen. */
  antall: number;
  children: ReactNode;
}) {
  const [åpen, setÅpen] = useState(false);

  return (
    <div>
      <h2 className="mt-8">
        <button
          type="button"
          onClick={() => setÅpen((o) => !o)}
          aria-expanded={åpen}
          className="trykk flex w-full items-center justify-between gap-2 py-1 text-left"
        >
          <span className="font-serif text-[19px] font-semibold text-blekk">
            Sakens gang
          </span>
          <span className="flex items-center gap-1 text-[13px] font-medium text-dempet">
            {åpen ? "Skjul" : antall === 1 ? "Vis 1 hendelse" : `Vis ${antall} hendelser`}
            <ChevronDown
              className={`size-[15px] shrink-0 transition-transform duration-200 ${
                åpen ? "rotate-180" : ""
              }`}
              aria-hidden
            />
          </span>
        </button>
      </h2>

      <AnimatePresence initial={false}>
        {åpen && (
          <m.div
            key="sakens-gang-innhold"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: VARIGHET.rolig, ease: EASING }}
            style={{ overflow: "hidden" }}
          >
            <div className="pt-3">{children}</div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
