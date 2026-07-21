"use client";

import { useState } from "react";
import { Belop } from "@/components/ui";
import { DELT_OVERGANG_NOKKEL } from "@/lib/bevegelse";

/**
 * Leser (og fjerner) det delte-overgang-flagget ÉN gang ved mount. Sant →
 * navigasjonen kom fra et kravkort via en View-Transition, så beløpet er
 * allerede synlig (morfes fra kortet) og skal ikke telle opp på nytt
 * (Motion2 §1). Direkte-lenke/refresh mangler flagget → teller som vanlig.
 */
function brukteDeltOvergang(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(DELT_OVERGANG_NOKKEL) === "1") {
      sessionStorage.removeItem(DELT_OVERGANG_NOKKEL);
      return true;
    }
  } catch {
    /* ignorer */
  }
  return false;
}

/**
 * Krav-detaljens navn (H1) — deler view-transition-name med kravkortet KUN når
 * `delNavn` (samme betingelse som listen: ingen opprinnelig_kreditor, så
 * tekstene er garantert like). Detaljen har bare ett slikt element → unikt navn.
 */
export function KravNavn({
  navn,
  delId,
  delNavn,
}: {
  navn: string;
  delId: string;
  delNavn: boolean;
}) {
  return (
    <h1
      className="font-serif text-[26px] font-medium tracking-[-0.01em] text-blekk"
      style={
        delNavn ? { viewTransitionName: `sak-navn-${delId}` } : undefined
      }
    >
      {navn}
    </h1>
  );
}

/**
 * Krav-detaljens beløp — deler view-transition-name med kravkortet, og slår av
 * opptellingen når vi kom via delt overgang (tallet morfes allerede fra kortet).
 */
export function KravBelop({
  verdi,
  delId,
  className,
}: {
  verdi: number;
  delId: string;
  className?: string;
}) {
  const [delt] = useState(brukteDeltOvergang);
  return (
    <span
      className="inline-block"
      style={{ viewTransitionName: `sak-belop-${delId}` }}
    >
      <Belop verdi={verdi} tellOpp={!delt} className={className} />
    </span>
  );
}
