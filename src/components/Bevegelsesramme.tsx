"use client";

import type { ReactNode } from "react";
import { MotionConfig, LazyMotion, domAnimation } from "motion/react";

/**
 * Felles bevegelsesramme: MotionConfig (redusert bevegelse følger OS) +
 * LazyMotion med `domAnimation`-settet (holder JS-veksten under budsjett;
 * `m`-komponenter får animasjonsfunksjonene herfra). Klientkomponent slik at
 * `domAnimation` ikke må krysse server/klient-grensen som prop.
 */
export function Bevegelsesramme({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation}>{children}</LazyMotion>
    </MotionConfig>
  );
}
