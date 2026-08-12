"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, m } from "motion/react";
import { ChevronDown } from "lucide-react";
import { VARIGHET, EASING } from "@/lib/bevegelse";

/**
 * SeMerTidslinje — kollapser de eldste hendelsene på «Sakens gang» bak en
 * «Vis X til»-rad. Raden følger tidslinjens eget node+linje-mønster
 * (TidslinjeHendelse) i stedet for å bryte den visuelt med en fremmed
 * knappestil — leses som en naturlig del av tidslinjen, ikke et påklistret
 * kontrollelement. De skjulte hendelsene er allerede ferdig rendret av
 * kalleren (Server Component, samme mønster som Tidslinje/SekvensDel sine
 * `children`) — denne komponenten legger kun til klient-tilstanden for
 * åpen/lukket + avsløringsanimasjonen (høyde/opasitet, samme
 * VARIGHET.rolig/EASING som Utvidbar/Utregning/Veivalg).
 */
export function SeMerTidslinje({
  antall,
  children,
}: {
  /** Antall skjulte hendelser — vist i knappeteksten. */
  antall: number;
  children: ReactNode;
}) {
  const [åpen, setÅpen] = useState(false);

  return (
    <div>
      <div className="flex gap-3.5">
        <div className="flex w-4 flex-col items-center">
          <span className="mt-0.5 size-2.5 rounded-full border-2 border-dashed border-dempet bg-bakgrunn" />
          <span className="w-0.5 flex-1 bg-aksent opacity-35" />
        </div>
        <div className="flex-1 pb-4">
          <button
            type="button"
            onClick={() => setÅpen((o) => !o)}
            aria-expanded={åpen}
            className="trykk flex items-center gap-1 text-[13.5px] font-medium text-aksent-dyp"
          >
            {åpen ? "Vis færre" : `Vis ${antall} til`}
            <ChevronDown
              className={`size-[15px] transition-transform duration-200 ${
                åpen ? "rotate-180" : ""
              }`}
              aria-hidden
            />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {åpen && (
          <m.div
            key="skjulte-hendelser"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: VARIGHET.rolig, ease: EASING }}
            style={{ overflow: "hidden" }}
          >
            {children}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
