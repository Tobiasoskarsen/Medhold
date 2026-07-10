"use client";

import { Children, type ReactNode } from "react";
import { m } from "motion/react";
import { INNTREDEN, STIGRING, MAKS_STAGGER, FJAER } from "@/lib/bevegelse";

/**
 * Skjermramme — sentrert kolonne, maks-bredde 640px, side-padding 20px.
 * Med `animerInn` (default true) toner direktebarna inn i sekvens (stagger),
 * maks 8 forsinkelser slik at lange lister ikke drypper lenge.
 */
export function Skjermramme({
  children,
  className = "",
  animerInn = true,
}: {
  children: ReactNode;
  className?: string;
  animerInn?: boolean;
}) {
  const ramme = `mx-auto w-full max-w-[640px] px-5 ${className}`;

  if (!animerInn) {
    return <div className={ramme}>{children}</div>;
  }

  const barn = Children.toArray(children);
  return (
    <m.div className={ramme} initial="initial" animate="animate">
      {barn.map((child, i) => (
        <m.div
          key={i}
          variants={{
            initial: INNTREDEN.initial,
            animate: {
              ...INNTREDEN.animate,
              transition: {
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
