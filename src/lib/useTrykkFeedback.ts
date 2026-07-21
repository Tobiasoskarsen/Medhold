"use client";

import { useCallback, useRef, useState } from "react";
import { VARIGHET } from "./bevegelse";

const MIN_VARIGHET_MS = VARIGHET.hurtig * 1000;

/**
 * Umiddelbar trykk-tilbakemelding, uavhengig av nettverkstiming. Next sin
 * `useLinkStatus`-pending blir ofte ALDRI sann når destinasjonen er
 * forhåndshentet (navigasjonen er ferdig før React rekker å markere den som
 * pending) — da fikk brukeren ingen respons i det hele tatt. Denne hooken
 * demper i minst `MIN_VARIGHET_MS` fra hvert trykk, garantert, kombineres
 * med ekte pending-status der den finnes (Motion2 §2).
 */
export function useTrykkFeedback() {
  const [aktiv, setAktiv] = useState(false);
  const tidsavbrudd = useRef<number | null>(null);

  const start = useCallback(() => {
    if (tidsavbrudd.current !== null) window.clearTimeout(tidsavbrudd.current);
    setAktiv(true);
    tidsavbrudd.current = window.setTimeout(() => {
      setAktiv(false);
      tidsavbrudd.current = null;
    }, MIN_VARIGHET_MS);
  }, []);

  return { aktiv, start };
}
