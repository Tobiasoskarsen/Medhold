"use client";

import { useState } from "react";
import { m } from "motion/react";
import { Belop } from "@/components/ui";
import { DELT_OVERGANG_NOKKEL } from "@/lib/bevegelse";

/**
 * Leser (og fjerner) det delte-overgang-flagget ÉN gang ved mount. Sant →
 * navigasjonen kom fra et kravkort via en delt layoutId-overgang, så beløpet
 * er allerede kjent og skal ikke telle opp på nytt (Motion2 §1). Direkte-
 * lenke/refresh mangler flagget → teller som vanlig.
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
 * Krav-detaljens navn (H1) — deler layoutId med kravkortet KUN når `delNavn`
 * (samme betingelse som listen: ingen opprinnelig_kreditor, så tekstene er
 * garantert like). Reduced motion håndteres av MotionConfig i (app)-layout.
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
  const felles =
    "font-serif text-[26px] font-medium tracking-[-0.01em] text-blekk";
  if (!delNavn) return <h1 className={felles}>{navn}</h1>;
  return (
    <m.h1 layoutId={`sak-navn-${delId}`} className={felles}>
      {navn}
    </m.h1>
  );
}

/**
 * Krav-detaljens beløp — deler layoutId med kravkortet. Wrapper `Belop` og slår
 * av opptellingen når vi kom via delt overgang (tallet er allerede synlig fra
 * kortet). Delt-flagget leses her, i det samme mount-øyeblikket beløpet vises.
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
    <m.span layoutId={`sak-belop-${delId}`} className="inline-block">
      <Belop verdi={verdi} tellOpp={!delt} className={className} />
    </m.span>
  );
}
