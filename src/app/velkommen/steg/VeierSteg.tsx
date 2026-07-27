"use client";

import type { CSSProperties } from "react";
import { m } from "motion/react";
import { EASING, STIGRING, VARIGHET } from "@/lib/bevegelse";
import { useForstegangsvisning } from "./useForstegangsvisning";

/**
 * Steg 4 — tre rader (innsigelse / nedbetaling / betal). Tekst ordrett fra
 * mockup. Ingen italic H1-klausul her (avviker bevisst fra steg 2/3 — matcher
 * mockupens rene h1 uten <em>).
 *
 * Radene kaskaderer inn med liste-STIGRING (Motion3 §4.2) idet steget vises
 * for første gang.
 */
const RADER = [
  "Skriv en innsigelse",
  "Foreslå en nedbetaling",
  "Betal, trygt og riktig",
] as const;

export function VeierSteg({
  aktiv,
  illustrasjonStil,
  tekstStil,
}: {
  aktiv: boolean;
  illustrasjonStil: CSSProperties;
  tekstStil: CSSProperties;
}) {
  const vist = useForstegangsvisning(aktiv);

  return (
    <>
      <div style={illustrasjonStil}>
        <div className="flex size-[180px] items-center justify-center">
          <div className="flex w-[200px] flex-col gap-2.5">
            {RADER.map((rad, i) => (
              <m.div
                key={rad}
                className="flex items-center gap-2.5 rounded-xl border-[0.5px] border-strek bg-flate px-3.5 py-2.5 text-left text-[13px] font-medium text-blekk"
                initial={{ opacity: 0, y: 8 }}
                animate={vist ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
                transition={{
                  duration: VARIGHET.normal,
                  ease: EASING,
                  delay: i * STIGRING,
                }}
              >
                <span className="size-2 shrink-0 rounded-full bg-trygg" />
                {rad}
              </m.div>
            ))}
          </div>
        </div>
      </div>

      <div style={tekstStil}>
        <h1 className="mt-[26px] font-serif text-[25px] font-medium leading-[1.25] tracking-[-0.01em] text-blekk">
          Uansett hva som
          <br />
          er riktig for deg
        </h1>
        <p className="mt-2.5 max-w-[270px] text-sm leading-[1.6] text-dempet">
          Vi følger opp saken til den er løst — enten det ender med medhold
          eller en avtale du kan leve med.
        </p>
      </div>
    </>
  );
}
