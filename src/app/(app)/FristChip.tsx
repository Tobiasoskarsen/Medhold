"use client";

import type { ReactNode } from "react";
import { m } from "motion/react";
import { Pill, useInntreden, useSekvensForsinkelse } from "@/components/ui";
import { ORKESTER_STIGRING, VARIGHET } from "@/lib/bevegelse";

/**
 * Frist-pillen på Hjem sitt handlingskort — lander et blunk etter kortet sitt
 * eget (SekvensDel), samme mekanikk som Kravkort sine chips/piller
 * (Motion3 §2.3).
 */
export function FristChip({ children }: { children: ReactNode }) {
  const kjedet = useSekvensForsinkelse();
  const inntreden = useInntreden(kjedet + ORKESTER_STIGRING, VARIGHET.hurtig);
  return (
    <m.div {...inntreden}>
      <Pill variant="varsel">{children}</Pill>
    </m.div>
  );
}
