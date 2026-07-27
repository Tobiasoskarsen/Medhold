"use client";

import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  type ReactElement,
  type ReactNode,
} from "react";
import { m, useReducedMotion } from "motion/react";
import {
  EASING,
  INNTREDEN,
  MAKS_STAGGER,
  ORKESTER_STIGRING,
  VARIGHET,
} from "@/lib/bevegelse";

/**
 * Sekvens — orkestrerer inntredenen av navngitte seksjoner INNI en skjerm
 * (Motion3 §2), adskilt fra Skjermrammens egen per-barn-stagger (STIGRING):
 * Sekvens er for FÅ, STORE deler («header», «Trapp», «Sakens gang» …), ikke
 * lange lister. Usynlig wrapper — hvert direkte <Sekvens.Del>-barn får sin
 * rekkefølgeindeks automatisk (posisjon blant Sekvens sine barn, ikke en
 * manuelt oppgitt prop) og toner inn med INNTREDEN, forsinket
 * indeks*ORKESTER_STIGRING (cappet ved MAKS_STAGGER — lange skjermer drypper
 * ikke lenge, jf. guardrail 7).
 *
 * Når Sekvens brukes på en skjerm, sett Skjermramme sin `animerInn={false}`
 * på samme skjerm — de to stagger-mekanismene er ikke ment å kombineres
 * (guardrail 6: maks én orkestrert inntreden per skjerm).
 */
export function Sekvens({ children }: { children: ReactNode }) {
  const barn = Children.toArray(children).filter(isValidElement) as ReactElement<{
    indeks?: number;
  }>[];
  return <>{barn.map((c, i) => cloneElement(c, { indeks: i }))}</>;
}

// Gjør en Dels egen (cappede) forsinkelse tilgjengelig for barn som skal
// KJEDES etter Del-en sin egen inntreden, ikke løpe parallelt med den (f.eks.
// Trapp-veksten på krav-detalj, Motion3 §2.2). Uten en omsluttende Sekvens.Del
// er verdien 0 — helt trygt for komponenter som også brukes utenfor Sekvens.
const SekvensForsinkelseContext = createContext(0);

export function useSekvensForsinkelse(): number {
  return useContext(SekvensForsinkelseContext);
}

/**
 * INNTREDEN-props (initial/animate/transition) for en gitt forsinkelse,
 * reduced-motion-korrekt (kun opasitet, ingen y, ingen delay — Motion3 §2.1).
 * Delt av Sekvens.Del og steder som kjeder egne del-lister etter en Del sin
 * forsinkelse (useSekvensForsinkelse) i stedet for å bruke en ny Sekvens.
 *
 * `varighet` (default VARIGHET.normal) lar småelementer som chips/piller på
 * et kort (Motion3 §2.3) bruke VARIGHET.hurtig i stedet — de er små nok til
 * at en kortere tone-inn leses riktigere enn seksjonenes normale varighet.
 */
export function useInntreden(delay = 0, varighet: number = VARIGHET.normal) {
  const redusert = useReducedMotion();
  if (redusert) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      transition: { duration: varighet },
    };
  }
  return {
    initial: INNTREDEN.initial,
    animate: INNTREDEN.animate,
    transition: { duration: varighet, ease: EASING, delay },
  };
}

function Del({
  children,
  indeks = 0,
}: {
  children: ReactNode;
  indeks?: number;
}) {
  const redusert = useReducedMotion();
  const delay = Math.min(indeks, MAKS_STAGGER - 1) * ORKESTER_STIGRING;
  // Reduced motion: ingen delay, heller ikke for barn som kjeder seg via
  // useSekvensForsinkelse (Motion3 §2.1/guardrail 4).
  const effektivDelay = redusert ? 0 : delay;
  // Kjøres kun ved mount: samme statiske initial/animate-mekanisme som
  // Dom-stempelet (Motion2 §4) — motion spiller initial→animate kun på selve
  // mount-et av DENNE instansen, aldri på re-render.
  const props = useInntreden(delay);

  return (
    <SekvensForsinkelseContext.Provider value={effektivDelay}>
      <m.div {...props}>{children}</m.div>
    </SekvensForsinkelseContext.Provider>
  );
}

Sekvens.Del = Del;
