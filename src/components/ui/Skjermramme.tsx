"use client";

import { Children, type ReactNode } from "react";
import { m, useReducedMotion } from "motion/react";
import { INNTREDEN, STIGRING, MAKS_STAGGER, FJAER } from "@/lib/bevegelse";

/**
 * Skjermramme — sentrert kolonne, maks-bredde 640px, side-padding 20px.
 * `bred` slipper bredden på store skjermer (Hjem med to kolonner).
 * Med `animerInn` (default true) toner direktebarna inn i sekvens (stagger),
 * maks 8 forsinkelser slik at lange lister ikke drypper lenge.
 */
export function Skjermramme({
  children,
  className = "",
  animerInn = true,
  bred = false,
}: {
  children: ReactNode;
  className?: string;
  animerInn?: boolean;
  bred?: boolean;
}) {
  const redusert = useReducedMotion();
  const ramme = `mx-auto w-full max-w-[640px] px-5 ${bred ? "lg:max-w-[1040px]" : ""} ${className}`;

  if (!animerInn) {
    return <div className={ramme}>{children}</div>;
  }

  const barn = Children.toArray(children);
  // Behold samme DOM før/etter hydrering og ved endret systemvalg.
  return (
    <m.div className={ramme} initial={redusert ? false : "initial"} animate="animate">
      {barn.map((child, i) => (
        <m.div
          key={i}
          className="skjerm-inntreden"
          variants={{
            initial: INNTREDEN.initial,
            animate: {
              ...INNTREDEN.animate,
              transition: redusert ? { duration: 0 } : {
                ...FJAER,
                delay: Math.min(i, MAKS_STAGGER - 1) * STIGRING,
              },
            },
          }}
        >
          {child}
        </m.div>
      ))}
    </m.div>
  );
}
