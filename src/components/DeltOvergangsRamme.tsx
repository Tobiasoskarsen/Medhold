"use client";

import type { ReactNode } from "react";
import { LazyMotion, domMax } from "motion/react";

/**
 * Legger til `layout`-funksjonen (delte layoutId-overganger, Motion2 §1) for
 * et avgrenset undertre — KUN kravlisten og krav-detalj-headeren, der navn og
 * beløp glir kontinuerlig mellom skjermene. `domMax` inneholder allerede alt
 * fra `domAnimation` (superset), så nesting inni den app-brede
 * `Bevegelsesramme` fungerer uten konflikt — resten av appen forblir på den
 * lette `domAnimation`-bunten (holder JS-vekst nede utenfor disse to rutene).
 */
export function DeltOvergangsRamme({ children }: { children: ReactNode }) {
  return <LazyMotion features={domMax}>{children}</LazyMotion>;
}
