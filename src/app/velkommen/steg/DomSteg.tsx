"use client";

import type { CSSProperties } from "react";
import { m } from "motion/react";
import { FJAER } from "@/lib/bevegelse";
import { useForstegangsvisning } from "./useForstegangsvisning";

/**
 * Steg 3 — rødbrun paragrafboks («§» + «Gebyrsjekk»), samme token-par som
 * DomMini (border-dom-rod/40 + bg-dom-rod-bg). Tekst ordrett fra mockup.
 *
 * Gjenbruker Dom-stempelets eksakte verdier (Dom.tsx: skala 1.04→1, rotasjon
 * −0.6°→0, FJAER — Motion3 §4.2) idet steget vises for første gang.
 */
export function DomSteg({
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
          <m.div
            className="flex size-[150px] flex-col items-center justify-center gap-0.5 rounded-[20px] border-[1.5px] border-dom-rod/40 bg-dom-rod-bg"
            initial={{ scale: 1.04, rotate: -0.6, opacity: 0 }}
            animate={
              vist
                ? { scale: 1, rotate: 0, opacity: 1 }
                : { scale: 1.04, rotate: -0.6, opacity: 0 }
            }
            transition={FJAER}
          >
            <span className="font-serif text-[52px] font-semibold leading-none text-dom-rod">
              §
            </span>
            <span className="font-serif text-[22px] font-semibold text-dom-rod">
              Gebyrsjekk
            </span>
          </m.div>
        </div>
      </div>

      <div style={tekstStil}>
        <h1 className="mt-[26px] font-serif text-[25px] font-medium leading-[1.25] tracking-[-0.01em] text-blekk">
          Vi sjekker om
          <br />
          <em className="italic text-aksent-dyp">gebyrene stemmer</em>
        </h1>
        <p className="mt-2.5 max-w-[270px] text-sm leading-[1.6] text-dempet">
          Alle beløp kontrolleres automatisk mot lovens maksimalsatser. Finner
          vi noe, hjelper vi deg å si ifra.
        </p>
      </div>
    </>
  );
}
