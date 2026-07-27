"use client";

import { useEffect, useState } from "react";

/**
 * Sant fra og med FØRSTE gang `aktiv` er true — og forblir sant resten av
 * øktens levetid (ingen replay ved tilbake-navigering til samme steg,
 * Motion3 §4.2). Stegene i onboardingen mountes alle samtidig ved appstart
 * (aldri på nytt ved steg-bytte); uten denne gaten ville illustrasjonens
 * inntreden spilt usynlig i bakgrunnen med det samme — ikke idet steget
 * faktisk vises.
 */
export function useForstegangsvisning(aktiv: boolean): boolean {
  const [vist, setVist] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (aktiv) setVist(true);
  }, [aktiv]);
  return vist;
}
