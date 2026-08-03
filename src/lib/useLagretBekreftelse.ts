"use client";

import { useEffect, useState } from "react";

/** Viser en «Lagret»-bekreftelse i {varighetMs} ms, ryddet automatisk.
 *  Erstatter den duplikate useState+useEffect-logikken i Telefon.tsx og
 *  Brevnavn.tsx. */
export function useLagretBekreftelse(varighetMs = 2500) {
  const [lagret, setLagret] = useState(false);

  useEffect(() => {
    if (!lagret) return;
    const t = setTimeout(() => setLagret(false), varighetMs);
    return () => clearTimeout(t);
  }, [lagret, varighetMs]);

  return [lagret, setLagret] as const;
}
